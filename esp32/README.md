# Setting up the Mycarium Ecosystem

It was kind of a pain in the ass to get the ESP32 to be able to connect to the MQTT broker over SSL/TLS. The skeleton for the actual code is in the `mycarium-esp32` directory.

Here are the steps that I followed:

## The Mosquitto Broker

The [Mosquitto Broker](https://mosquitto.org) is an open source MQTT message broker maintained by the Eclipse Foundation. Make sure to consult [the Mosquitto docs](https://mosquitto.org/documentation/)!

### Setting it up on Ubuntu

To get it working on the server, you need to add the repo because the one in Ubuntu's default repo is out of date:

1. `sudo apt-add-repository ppa:mosquitto-dev/mosquitto-ppa`
2. `sudo apt-get update`
3. `sudo apt-get install mosquitto mosquitto-clients`

Once installed, it should startup on its own, but in case you need to control or check on it:

```sh
# to start
sudo service mosquitto start

# to stop
sudo service mosquitto stop

# to restart
sudo service mosquitto restart

# to check the status
sudo service mosquitto status

# to check the logs
# note: [alt]+[/] will jump to the end of the file in nano
sudo [nano/cat] /var/log/mosquitto/mosquitto.log

# if Mosquitto fails to start due to config error
# this works even if you're NOT using mosquitto.conf as your config
sudo /usr/sbin/mosquitto -c /etc/mosquitto/mosquitto.conf
```

The default config is in `/etc/mosquitto/mosquitto.conf` but I deleted the contents of this file and created a file at `/etc/mosquitto/conf.d/default.conf` with the following configuration:

```sh
log_type all # includes info, notice, warning, and error
log_dest file /var/log/mosquitto/mosquitto.log
persistence true
persistence_location /var/lib/mosquitto/ # defaults to mosquitto.db
per_listener_settings true

# This is the port that ESP32 clients will connect to
listener 8883
protocol mqtt
use_identity_as_username true
use_username_as_clientid true
allow_anonymous false
cafile   /etc/mosquitto/certs/mycarium.morphatic.com/ca.crt
keyfile  /etc/mosquitto/certs/mycarium.morphatic.com/server.key
certfile /etc/mosquitto/certs/mycarium.morphatic.com/server.crt
tls_version tlsv1.1
require_certificate true

# This is the port that web-based/node clients will connect to
listener 8083
protocol websockets
use_identity_as_username true
use_username_as_clientid true
allow_anonymous false
cafile   /etc/mosquitto/certs/mycarium.morphatic.com/ca.crt
keyfile  /etc/mosquitto/certs/mycarium.morphatic.com/server.key
certfile /etc/mosquitto/certs/mycarium.morphatic.com/server.crt
tls_version tlsv1.1
require_certificate true
```

### Setting Up TLS/SSL

By far, the best tutorials for getting an MQTT broker configured to use TLS/SSL was from Steve Cope. He wrote a [tutorial for servers](http://www.steves-internet-guide.com/mosquitto-tls/#server) and a [tutorial for clients](http://www.steves-internet-guide.com/creating-and-using-client-certificates-with-mqtt-and-mosquitto/), without which I don't think I could have gotten this working. Here's a summary of the steps:

1. For the Server:
   1. Create a private key for a self-signed certificate authority (CA):<br>
   `openssl genrsa -des3 -out ca.key 2048`
   2. Then create the CA certificate:<br>
   `openssl req -new -x509 -days 1826 -key ca.key -out ca.crt`
      * The key is to use your **domain name** (FQDN) as the CN field, i.e. "mycarium.morphatic.com"
      * I decided to set a password on the CA so I could control which clients were allowed to get signed certs
   3. Now create the server's private key:<br>
   `openssl genrsa -out server.key 2048`
   4. Create a certificate signing request (CSR) for the server:<br>
   `openssl req -new -out server.csr -key server.key`
   5. Then create the server's signed certificate, which will require typing in the password for the CA key:<br>
   `openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 360`
   6. Store/copy `ca.crt`, `server.key`, and `server.crt` in `/etc/mosquitto/certs/mycarium.morphatic.com/` (or whatever FQDN was used in step 1.2)
2. For the Clients:<br>
   You'll need `ca.crt` and `ca.key` to sign client certificates. You can either create all the client certs on the server or on your dev machine, but you'll need the `ca.crt` file as well as `client.crt` and `client.key` stored locally to your client code to get TLS to work. Upon reflection, I think it makes the most sense to [create all of the certs on the server, so you can keep track of the clients](https://stackoverflow.com/a/66357989/296725) all in one place. To create the client certificates:
   1. Create a private key for the client:<br>
   `openssl genrsa -out client.key 2048`
   2. Create a CSR for the client using `ca.crt` and `ca.key`:<br>
   `openssl req -new -out client.csr -key client.key`
      * For *client* certs, you want to make sure to user your intended username as the CN field in the CSR
      * I decided NOT to set a password on the client certs
   3. Create the client's signed certificate:<br>
   `openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 360`
   4. Repeat these steps for every user/client that will be allowed to connect to your MQTT server.
   5. If you want to use the original `client.csr` multiple times to generate new client certs for the SAME USER, you can use the same command as the previous step EXCEPT swap `-CAserial ca.srl` in place of `-CAcreateserial` which will be much faster and make sure that no two certs have the same serial number.

NOTE: because we configured the MQTT broker to `use_identity_as_username` and `use_username_as_clientid`, we do NOT need to use a password file or handle authentication to the MQTT broker via username/password. Also, when I setup my certificates, I didn't want to have to remember to renew them or figure out how to update them several years from now when/if I revisit this project, so I set the expiration dates to be 10,958 days, i.e. 30 years, from now.

### Testing

Here is the command I used for testing the MQTT broker setup:

```sh
mosquitto_sub -h mycarium.morphatic.com -p 8883 -t mycarium/status/mycarium-1 --cafile ca.crt --cert client.crt --key client.key
```

### BIG Misconception

I started out by using `certbot` to generate an SSL certificate for `mycarium.morphatic.com` from LetsEncrypt. I believed that since the root LE CA cert is installed in all browsers these days, that it would be best to just use that highly trusted certificate to sign all of my client certs. However, THIS IS NOT TRUE!

LE certs are NOT CA's themselves, and you CANNOT sign a client certificate with the server certiciate generated by `certbot`. They way to prove this is to find the `fullchain.pem` file in `/etc/letsencrypt/archive/mycarium.morphatic.com/` (or your FQDN) and run the command:

```sh
sudo openssl x509 -text -noout -in fullchain.pem
```

Within the output look for the section headed "X509v3 extensions:" and then the "X509v3 Basic Constraints: critical" setting where it says "CA:FALSE" which essentially means that this certificate chain can NOT be used to sign any child certificates.

As it turns out, since our MQTT clients will NOT be connecting to the broker via a web browser, we are not going to be warned or cautioned about the fact that the broker is secured by a self-signed certificate. As such, it makes MUCH more sense to just create your own certs (as described above) and use them to sign all of your client certs.

## The ESP32

There were a number of hurdles to getting the ESP32 to be able to connect to the MQTT broker using TLS/SSL. Before we get into the details, here are some of the resources that were most helpful:

* [README from the SSLClient library](https://github.com/OPEnSLab-OSU/SSLClient?tab=readme-ov-file) and their [explanation of trust anchors](https://github.com/OPEnSLab-OSU/SSLClient/blob/master/TrustAnchors.md#generating-trust-anchors)
* [EthernetMQTT example from SSLClient](https://github.com/OPEnSLab-OSU/SSLClient/blob/712e593375b02627bbc4a3a321733ed059b78d23/examples/EthernetMQTT/EthernetMQTT.ino)
* [The `pycert_bearssl.py` script for creating trust anchors](https://github.com/OPEnSLab-OSU/SSLClient/blob/master/tools/pycert_bearssl/pycert_bearssl.py)
* [Issue #71 in the SSLClient's GitHub repo](https://github.com/OPEnSLab-OSU/SSLClient/issues/71)
* [The PubSubClient library's API docs](https://pubsubclient.knolleary.net/api)
* [The `ArduinoJSON` library](https://arduinojson.org/) and the [ArduinoJson Assistant](https://arduinojson.org/v7/assistant/#/step1)

### Timing is Everything

Perhaps the biggest headache I faced when setting up the ESP32 was related to getting accurate time setup. The ESP32 does not automatically sync with a time server, and so calls to the built-in function `millis()` will just let you know the number of milliseconds that have elapsed since the device most recently booted up. It turns out I needed an accurate time for two separate reasons:

1. I wanted to include a UTC timestamp along with every MQTT status message I sent to the broker
2. In order to correctly verify an SSL certificate, the `SSLClient` needs to know what time it is in order to be able to determine if the certificate is expired or not

#### Setting up NTP (Network Time Protocol) Sync

The `configTime()` and `configTzTime()` functions are [built into the ESP32 core](https://github.com/espressif/arduino-esp32/blob/master/cores/esp32/esp32-hal-time.c). To use them you need:

1. An internet connection, e.g. `EthernetClient` or `WiFiClient`
2. To select an [NTP server](https://en.wikipedia.org/wiki/Network_Time_Protocol)
3. A way to specify your timezone either as an offset in seconds (for `configTime()`) or as a [predefined constant](https://github.com/esp8266/Arduino/blob/master/cores/esp8266/TZ.h) (for `configTzTime()`)
4. A way to specify the daylight savings time offset in seconds, if applicable

After your ESP32 has connected to the internet, you can set this up as follows:

```cpp
// using configTime() for US Eastern time
configTime(-5 * 60 * 60, 60 * 60, "pool.ntp.org", "time.nist.gov");

// or using configTzTime()
configTzTime(TZ_America_New_York, "pool.ntp.org", "time.nist.gov");
```

However, if you want to make sure that the time sync is complete before you move on to the rest of your setup, you'll need to use the `esp_sntp.h` library to do the following:

```cpp
// includes, defines, and constants
#include <esp_nstp.h>
#define TZ_America_New_York PTSR("EST5EDT,m3.2.0,m11.1.0")
const char* ntpServer1 = "pool.ntp.org";
const char* ntpServer2 = "time.nist.gov";

// setup
void setup() {
    // ... connect to the internet ...
    // then
  sntp_sync_status_t syncStatus;
  Serial.print("Syncing time with NTP");
  configTzTime(TZ_America_New_York, ntpServer1, ntpServer2);
  while (syncStatus != SNTP_SYNC_STATUS_COMPLETED) {
    syncStatus = sntp_get_sync_status();
    Serial.print(".");
    delay(100);
  }
  // if you want a "pretty" format
  struct tm timeInfo;
  getLocalTime(&timeInfo);
  Serial.println("");
  Serial.println("Time successfully synced with NTP!");
  Serial.println(&timeInfo, "%A, %B %d %Y %H:%M:%S");
  // output (e.g.): Saturday, December 21 2024 17:14:29

  // now the following will get the correct time
  time_t now;
  time(&now);  // unix timestamp format
}
```

#### Configuring the `SSLClient`

By default, the `SSLClient` does NOT know what time it is, and defaults to starting at midnight on 1/1/0, i.e. AD 0!!! Once you've synced the time with NTP, you can do the following:

```cpp
// note: `espClientSSL` was the name of my SSLClient instance
// make sure to use the name of your own SSLClient instance here
time_t now;
time(&now); // gets current seconds since 1/1/1970, i.e. UNIX Epoch time
espClientSSL.setVerificationTime(
  (uint32_t)((now / (60 * 60 * 24)) + 719528UL), // days since 1/1/0
  (uint32_t)(now % (60 * 60 * 24))               // seconds since midnight last night
);
```

Before I figured out how to do this, I kept getting an error when trying to connect to MQTT that said "certificate expired or not yet valid." Even though my certificate was totally valid and had an expiration date 30 years in the future, from the ESP32's perspective, the cert was "not yet valid" because it thought we were living over 2000 years ago.

### A Multi-layered MQTT Client

So, to be able to use TLS/SSL to connect to MQTT over WiFi, you need the following:

1. A correctly configured trust anchor
2. A valid, signed certificate and private key for your client
3. The `WiFiClient` library
4. The `SSLClient` library
5. The `PubSubClient` library

#### Creating the Trust Anchor

A [trust anchor](https://github.com/OPEnSLab-OSU/SSLClient/blob/master/TrustAnchors.md#generating-trust-anchors) is essentially a way to verify that traffic coming FROM the MQTT server is authentic. It converts the modulus from the CA certificate (the `ca.crt` we created above) into a C++/Arduino format that can be used by the `SSLClient` to authenticate incoming messages from the server.

The easiest way that I found to generate the trust anchor code was to:

1. Clone the [`SSLClient` repo](https://github.com/OPEnSLab-OSU/SSLClient) locally
2. Open it up in VSCode and from the terminal navigate to the `tools/pycert_bearssl` directory
3. Make sure you have Python 3 installed on your system, setup a virtual environment in the `pycert_bearssl` directory and activate it
4. Install the `click`, `pyopenssl`, and `certifi` libraries with `pip`
5. Copy the `ca.crt` file into the directory
6. Run the `pycert_bearssl.py` utility to convert `ca.crt` into the format you need
7. Copy the contents of the `certificates.h` file that was generated by the tool and paste it into a file called `certificates.h` in your Arduino project

```sh
# clone the repo
~$ git clone https://github.com/OPEnSLab-OSU/SSLClient.git
# navigate to the pycert_bearssl tool
~$ cd SSLClient/tools/pycert_bearssl
# setup and activate your python environment (note: Mac/*nix uses `source ./venv/bin/activate`)
pycert_bearssl$ python -m venv venv && source ./venv/Scripts/activate
# install the dependencies
pycert_bearssl (venv)$ pip install click pyopenssl certifi
# copy your `ca.crt` file from wherever it happens to be
pycert_bearssl (venv)$ cp ~/.ssh/ca.crt .
# run the utility
pycert_bearssl (venv)$ python pycert_bearssl convert --no-search ca.crt
```

An example of what this looks like is the [MQTT example in the SSLClient library](https://github.com/OPEnSLab-OSU/SSLClient/tree/master/examples/EthernetMQTT).

#### Getting the Client's Private Key and Certificate

To get the client key and cert into your program:

1. Go to "Sketch > Show Sketch Folder" in the Arduino menu
2. In the folder window that pops up, right click and create a new file named "secrets.h"
3. Back in the Arduino editor, select "Add File..." from the Sketch menu and select the `secrets.h` file you just created
4. In the terminal, navigate to the folder where your `client.key` and `client.crt` files are located
5. Run `cat client.crt` and `cat client.key` and copy the output from both of those into the `secrets.h` file
6. Reformat the certificates you just pasted to enclose every line in `"[line content]\n"` and then export them as variables
7. At the top of your main sketch, import both the `certificates.h` and the `secrets.h` files into your project

When you are done, the `secrets.h` file should look like:

```cpp
// content of `client.crt`
extern const char my_cert[] =
"-----BEGIN CERTIFICATE-----\n" // 10-year cert
"MIIDRjCCAi4CCQDFeEHTJU7+cjANBgkqhkiG9w0BAQsFADBgMQswCQYDVQQGEwJV\n"
"UzELMAkGA1UECAwCUEExEDAOBgNVBAcMB0NyYWZ0b24xEjAQBgNVBAoMCU1vcnBo\n"
" ... the rest of the lines of your cert... \n"
"-----END CERTIFICATE-----\n";

// content of `client.key`
extern const char my_key[] =
"-----BEGIN RSA PRIVATE KEY-----\n" // 10-year cert
"MIIEowIBAAKCAQEAznqIm80zz2IayTDXm4M1ZNugeBOJ+F2dUfUyId7NPRsiDRoG\n"
"3FLaJCdoFjUbjZt2XVjRP/Z34fZW4le0WsYjAbrnHcQuKgpX0dW+FjRb2ggF+UUE\n"
" ... the rest of the lines of your cert... \n"
"-----END RSA PRIVATE KEY-----\n";

// it's also a good idea to put your WiFi SSID/Password here
#define SECRET_SSID "my_wifi_ssid"
#define SECRET_PASS "pa55w0rd!"

```

In your main `.ino` file:

```cpp
#include "certificates.h"
#include "secrets.h"
```

#### Setting Up Your Multi-Layered Client

Now you'll want to make sure that your code includes the following:

```cpp
// include the necessary libraries
#include <esp_sntp.h>
#include <PubSubClient.h>
#include <SSLClient.h>
#include <time.h>
#include <WiFi.h>
#include <Wire.h>

// include your certificates and secrets
#include "certificates.h"
#include "secrets.h"

// define your timezone
#define TZ_America_New_York PSTR("EST5EDT,M3.2.0,M11.1.0")

// set some constants
const char* mqtt_server = "mqtt.example.com"; // your MQTT FQDN
const int mqtt_port = 8883;
const char* ntp1 = "pool.ntp.org";
const char* ntp2 = "time.nist.gov";

// instantiate your clients
SSLClientParameters mTLS = SSLClientParameters::fromPEM(myc_cert, sizeof myc_cert, myc_key, sizeof myc_key);
WiFiClient wifiClient;
SSLClient wifiClientSSL(wifiClient, TAs, (size_t)TAs_NUM, A6);
PubSubClient client(wifiClientSSL);

// then in your setup()
void setup() {
  espClientSSL.setMutualAuthParams(mTLS);   // tell SSLClient to use TLS
  WiFi.begin(SECRET_SSID, SECRET_PASS);     // connect to WiFi
  while (WiFi.status() != WL_CONNECTED) {   // wait for Wifi to connect
    delay(500);
  }
  sntp_sync_status_t syncStatus;            // setup NTP sync for time
  configTzTime(TZ_America_New_York, ntp1, ntp2);
  while (syncStatus != SNTP_SYNC_STATUS_COMPLETED) {
    syncStatus = sntp_get_sync_status();
    delay(100);
  }
  time_t now;                               // set the SSL verification time
  time(&now);
  wifiClientSSL.setVerificationTime(
    (uint32_t)(now / (60 * 60 * 24) + 719528UL),
    (uint32_t)(now % (60 * 60 * 24))
  );
  client.setServer(mqtt_server, mqtt_port); // configure MQTT server
}
```

You're still going to need to implement a `reconnect()` method and an incoming message handling callback to use with your MQTT client, but that looks pretty much the same as it does in [examples like this one](https://github.com/knolleary/pubsubclient/blob/v2.8/examples/mqtt_basic/mqtt_basic.ino).

### Using JSON with MQTT

You're going to want to use JSON to send and receive messages via the MQTT protocol. The most straightforward way I found to do that was to use [the `ArduinoJSON` library](https://arduinojson.org/v7/). The [ArduinoJson Assistant](https://arduinojson.org/v7/assistant/#/step1) was really helpful in generating a good chunk of the code I needed. The main thing that was tricky was figuring out how to submit the serialized JSON to the MQTT client's `publish()` method.

```cpp
// Here's the basic flow to Serialize outbout messages being published
JsonDocument msgJson;
char msg[256];        // this holds the serialized JSON; max 256 chars

time_t now;
time(&now);
msgJson["ts"] = now; // `msgJson` can handle most any scalar type
JsonObject temp = msgJson["t"].to<JsonObject>(); // create a JSON object `t`
temp["c"] = sensor.temp; // `t.c` = sensor temperature as a float
temp["stat"] = "on";     // `t.stat` = heater status as a string

// after you're done adding values to `msgJson`
serializeJsonPretty(msgJson, Serial); // output pretty version to Serial

// then serialize it in its minimal form for publishing
size_t msgSize = serializeJson(msgJson, msg); // update `msg` and get size

// finally we can publish
client.publish("topic", msg, msgSize);
```

You can nest the `JsonObject`s as deeply as you want. The key names ended up being only one or two letters in order to minimize the size of the MQTT packets being sent across the network.

```cpp
// Here's the basic flow to Deserialize inbound messages being consumed
// This happens within a callback function registered on the client
void callback(char* topic, byte* message, unsigned int length) {
  char* msg; // a variable to hold the incoming message being read
  for (int i = 0; i < length; i++) { // convert byte* into char*
    msg += (char)message[i];
  }

  JsonDocument m;
  DeserializationError err = deserializeJson(m, msg); // convert to JSON object

  if (err) {
    // handle deserialization error
  }

  if (m["temp"].is<JsonObject>()) { // confirm type of incoming key
    float maxT = m["temp"]["max"].is<float>() // assign a var from JSON
      ? m["temp"]["max"]                      // if it exists
      : 100.0;                                // with fallback default
    // then do something with the value...
    if (maxT > 80.0) {
      // ...
    }
  }
}
```

That's it for now.
