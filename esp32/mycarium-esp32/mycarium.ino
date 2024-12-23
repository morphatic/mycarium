#pragma region includes
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <ArduinoJson.h>
#include <esp_sntp.h>
#include <PubSubClient.h>
#include <SSLClient.h>
#include <time.h>
#include <WiFi.h>
#include <Wire.h>
#pragma endregion includes

#pragma region local_includes
#include "certificates.h"
#include "secrets.h"
#pragma endregion local_includes

#pragma region defines
#define DEBUG 1 // set to 1 to enable serial output while programming
#define POLL_FREQ 5000 // 5 sec
#define HEATER_PIN 12
#define FOGGER_PIN 13
#define SEALEVELPRESSURE_HPA (1013.25)
#define ON true
#define OFF false
#define TZ_America_New_York	PSTR("EST5EDT,M3.2.0,M11.1.0")
#pragma endregion defines

#pragma region constants
const char* device_id = "mycarium-1";
const char* mqtt_client_id = "mycarium-1";
const char* mqtt_server = "mycarium.morphatic.com"; // 45.55.197.187
const int mqtt_port = 8883;
const char* ntpServer1 = "pool.ntp.org";
const char* ntpServer2 = "time.nist.gov";
const String wifi_ssid = SECRET_SSID;
const String wifi_pass = SECRET_PASS;
#pragma endregion constants

#pragma region variables
SSLClientParameters mTLS = SSLClientParameters::fromPEM(myc_cert, sizeof myc_cert, myc_key, sizeof myc_key);
WiFiClient espClient;
SSLClient espClientSSL(espClient, TAs, (size_t)TAs_NUM, A6);
PubSubClient client(espClientSSL);
Adafruit_BME280 sensor;
bool heater_is_on = false;
bool fogger_is_on = false;
char* heater_action = "none";
char* fogger_action = "none";
char* heater_mode = "auto";
char* fogger_mode = "auto";
char* controlTopic = "mycarium/control/mycarium-1";
char* statusTopic = "mycarium/status/mycarium-1";
float humidity = 0;
float temperature = 0;
float max_temp = 27.8;
float min_temp = 23.9;
float max_humidity = 92.0;
float min_humidity = 85.0;
long lastMsg = 0;
#pragma endregion variables

struct Mycarium {
  float temp;
  float humidity;
};

void setup() {
  if (DEBUG) {
    Serial.begin(115200);
    while (!Serial);
  }

  /***************************
   * Configure BME280 Sensor *
   ***************************/
  unsigned sensor_status;
  sensor_status = sensor.begin(0x76, &Wire);
  if (!sensor_status) {
    // handle if the sensor is not available
    Serial.print("Sensor is not available");
  }

  // set the pins to control the relays
  pinMode(HEATER_PIN, OUTPUT);
  pinMode(FOGGER_PIN, OUTPUT);

  // default them to "off"
  digitalWrite(HEATER_PIN, LOW);
  digitalWrite(FOGGER_PIN, LOW);

  /******************
   * Configure WiFi *
   ******************/
  Serial.println();
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(wifi_ssid);
  espClientSSL.setMutualAuthParams(mTLS);
  WiFi.begin(wifi_ssid, wifi_pass);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected.");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());

  /******************
   * Configure Time *
   ******************/
  sntp_sync_status_t syncStatus;
  Serial.print("Syncing time with NTP");
  configTzTime(TZ_America_New_York, ntpServer1, ntpServer2);
  while (syncStatus != SNTP_SYNC_STATUS_COMPLETED) {
    syncStatus = sntp_get_sync_status();
    Serial.print(".");
    delay(100);
  }
  struct tm timeInfo;
  getLocalTime(&timeInfo);
  Serial.println("");
  Serial.println("Time successfully synced with NTP!");
  Serial.println(&timeInfo, "%A, %B %d %Y %H:%M:%S");

  // We MUST set the SSLClient verification time in order for
  // the certs to not be considerered expired or not yet active.
  // This is the number of seconds since 1/1/0 (0 AD)
  // Calculation comes from:
  // https://github.com/khoih-prog/EthernetWebServer_SSL/blob/6b0b412c940d35b122748d78df6de74dbf8e7398/src/SSLClient/TLS12_only_profile.c#L424
  time_t now;
  time(&now);
  espClientSSL.setVerificationTime(
    (uint32_t)((now / (60 * 60 * 24)) + 719528UL),
    (uint32_t)(now % (60 * 60 * 24))
  );

  /*************************
   * Configure MQTT Client *
   *************************/
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(handleMycariumControlMessage);
}

void loop() {
  // maintain MQTT Client connection
  if(!client.connected()) {
    reconnect();
  }
  
  // handle incoming MQTT messages
  client.loop();

  // take automated actions and publish status
  long elapsed = millis();
  if (elapsed - lastMsg > POLL_FREQ) {
    lastMsg = elapsed;

    // read the sensor
    Mycarium myc = readSensor();

    // take action, if necessary
    heater_action = "none";
    fogger_action = "none";

    if (
      (heater_mode == "auto" && myc.temp < min_temp && !heater_is_on) ||
      (heater_mode == "manual" && heater_is_on)
    ) {
      toggleHeater(ON);
    }

    if (
      (heater_mode == "auto" && myc.temp > max_temp && heater_is_on) ||
      (heater_mode == "manual" && !heater_is_on)
    ) {
      toggleHeater(OFF);
    }

    if (
      (fogger_mode == "auto" && myc.humidity < min_humidity && !fogger_is_on) ||
      (fogger_mode == "manual" && fogger_is_on)
    ) {
      toggleFogger(ON);
    }

    if (
      (fogger_mode == "auto" && myc.humidity > max_humidity && fogger_is_on) ||
      (fogger_mode == "manual" && !fogger_is_on)
    ) {
      toggleFogger(OFF);
    }

    /**
     * Publish the Status
     */
    // create a JSON doc
    JsonDocument status;
    char statusMsg[256];
    time_t now;
    time(&now);
    // populate the JSON values
    status["ts"] = now; // seconds since epoch, i.e. timestamp
    JsonObject temp = status["t"].to<JsonObject>();
    temp["c"] = myc.temp;
    temp["f"] = c_to_f(myc.temp);
    temp["xc"] = max_temp;
    temp["xf"] = c_to_f(max_temp);
    temp["nc"] = min_temp;
    temp["nf"] = c_to_f(min_temp);
    JsonObject humidity = status["h"].to<JsonObject>();
    humidity["c"] = myc.humidity;
    humidity["x"] = max_humidity;
    humidity["n"] = min_humidity;
    JsonObject heater = status["ht"].to<JsonObject>();
    heater["md"] = heater_mode;
    heater["st"] = heater_is_on?"on":"off";
    heater["xn"] = heater_action;
    JsonObject fogger = status["fg"].to<JsonObject>();
    fogger["md"] = fogger_mode;
    fogger["st"] = fogger_is_on?"on":"off";
    fogger["xn"] = fogger_action;

    // serialize the JSON for Serial output and MQTT
    serializeJsonPretty(status, Serial);
    size_t statusMsgCapacity = serializeJson(status, statusMsg);

    // publish the status to MQTT
    Serial.print("Posting to ");
    Serial.print(statusTopic);
    Serial.println(": ");
    client.publish(statusTopic, statusMsg, statusMsgCapacity);
  }
}

Mycarium readSensor() {
  Mycarium reading;
  reading.temp = sensor.readTemperature();
  reading.humidity = sensor.readHumidity();
  return reading;
}

void toggleFogger(bool status) {
  // only take action on status change
  if (fogger_is_on != status) {
    fogger_is_on = status;
    digitalWrite(FOGGER_PIN, fogger_is_on?HIGH:LOW);
    if (fogger_is_on) {
      fogger_action = "turned on";
    } else {
      fogger_action = "turned off";
    }
  }
}

void toggleHeater(bool status) {
  // only take action on status change
  if (heater_is_on != status) {
    heater_is_on = status;
    digitalWrite(HEATER_PIN, heater_is_on?HIGH:LOW);
    if (heater_is_on) {
      heater_action = "turned on";
    } else {
      heater_action = "turned off";
    }
  }
}

float c_to_f(float tempC) {
  return (tempC * 9 / 5) + 32.0;
}

void handleMycariumControlMessage(char* topic, byte* message, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.print(topic);
  Serial.print(". Message: ");
  char* msg;
  
  for (int i = 0; i < length; i++) {
    Serial.print((char)message[i]);
    msg += (char)message[i];
  }
  Serial.println();

  JsonDocument control;
  DeserializationError err = deserializeJson(control, msg);

  if (err) {
    // handle deserialization error
    return;
  }

  if (control["temp"].is<JsonObject>()) {
    // get min and max temp values from MQTT message
    // or the existing min/max values if unset
    float max_t = control["temp"]["max"].is<float>()
      ? control["temp"]["max"]
      : max_temp;
    float min_t = control["temp"]["min"].is<float>()
      ? control["temp"]["min"]
      : min_temp;
    // only make changes if MAX > MIN
    if (max_t > min_t) {
      // only reassign if different from current value
      if (max_t != max_temp) {
        max_temp = max_t;
      }
      if (min_t != min_temp) {
        min_temp = min_t;
      }
    }
  }

  if (control["humidity"].is<JsonObject>()) {
    // get min and max humidity values from MQTT message
    // or the existing min/max values if unset
    float max_h = control["humidity"]["max"].is<float>()
      ? control["humidity"]["max"]
      : max_humidity;
    float min_h = control["humidity"]["min"].is<float>()
      ? control["humidity"]["min"]
      : min_humidity;
    // only make changes if MAX > MIN
    if (max_h > min_h) {
      // only reassign if different from current value
      if (max_h != max_humidity) {
        max_humidity = max_h;
      }
      if (min_h != min_humidity) {
        min_humidity = min_h;
      }
    }
  }

  if (control["heater"].is<JsonObject>()) {
    const char* h_mode = control["heater"]["mode"].is<const char*>()
      ? control["heater"]["mode"]
      : (const char*)heater_mode;
    // We only care about on/off status if mode is manual AND
    // the incoming message represents a change
    if (h_mode == "manual" && h_mode != heater_mode) {
      // update heater_mode
      heater_mode = "manual";
      // check manual status
      const char* h_status = control["heater"]["status"].is<const char*>()
        ? control["heater"]["status"]
        : (const char*)(heater_is_on?"on":"off");
      if (
        (h_status == "on" && !heater_is_on) ||
        (h_status == "off" && heater_is_on)
      ) {
        // toggle heater status
        heater_is_on = !heater_is_on;
      }
    }
    if (h_mode == "auto" && h_mode != heater_mode) {
      heater_mode = "auto";
    }
  }

  if (control["fogger"].is<JsonObject>()) {
    const char* f_mode = control["fogger"]["mode"].is<const char*>()
      ? control["fogger"]["mode"]
      : (const char*)fogger_mode;
    // We only care about on/off status if mode is manual AND
    // the incoming message represents a change
    if (f_mode == "manual" && f_mode != fogger_mode) {
      // update fogger_mode
      fogger_mode = "manual";
      // check manual status
      const char* f_status = control["fogger"]["status"].is<const char*>()
        ? control["fogger"]["status"]
        : (const char*)(fogger_is_on?"on":"off");
      if (
        (f_status == "on" && !fogger_is_on) ||
        (f_status == "off" && fogger_is_on)
      ) {
        // toggle fogger status
        fogger_is_on = !fogger_is_on;
      }
    }
    if (f_mode == "auto" && f_mode != fogger_mode) {
      fogger_mode = "auto";
    }
  }
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect(mqtt_client_id)) {
      Serial.println("connected");
      // Subscribe
      client.subscribe(controlTopic);
      Serial.print("subscribed to: ");
      Serial.println(controlTopic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}
