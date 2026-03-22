use bme280::i2c::BME280;
use esp_idf_hal::delay::Delay;
use esp_idf_hal::gpio::PinDriver;
use esp_idf_hal::i2c::I2cDriver;
use esp_idf_hal::i2c::config::Config as I2cConfig;
use esp_idf_hal::units::FromValueType;
use esp_idf_hal::peripherals::Peripherals;
use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::mqtt::client::{EspMqttClient, EventPayload, MqttClientConfiguration, QoS};
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::sntp::{EspSntp, SyncStatus};
use esp_idf_svc::tls::X509;
use esp_idf_svc::wifi::{AuthMethod, BlockingWifi, ClientConfiguration, Configuration, EspWifi};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

// Section 10.2: Named Constants
const DEVICE_ID: &str = env!("MYCARIUM_DEVICE_ID");
const MQTT_BROKER_HOST: &str = env!("MYCARIUM_MQTT_BROKER_HOST");
const MQTT_BROKER_PORT: &str = env!("MYCARIUM_MQTT_BROKER_PORT");
const BME280_ADDR: u8 = 0x76;
const POLL_INTERVAL_SEC: u64 = 30;
const _STATUS_EXPIRY: u32 = 90; // for MQTT v5 message expiry (future use)

// WiFi backoff
const WIFI_INITIAL_BACKOFF_MS: u64 = 1_000;
const WIFI_MAX_BACKOFF_MS: u64 = 60_000;

// Section 11.1: Threshold range and gap validation
const TEMP_RANGE_MIN: f32 = 0.0;
const TEMP_RANGE_MAX: f32 = 50.0;
const HUM_RANGE_MIN: f32 = 0.0;
const HUM_RANGE_MAX: f32 = 100.0;
const MIN_TEMP_GAP: f32 = 2.0;
const MIN_HUM_GAP: f32 = 6.0;

// Section 11.2: Control message rate limiting
const CONTROL_RATE_LIMIT_MS: u64 = 1_000;

// Section 10.1: Compile-time TLS certificates (null-terminated PEM for X509)
const CA_CERT: X509<'static> =
    X509::pem_until_nul(concat!(include_str!("../secrets/ca.crt"), "\0").as_bytes());
const CLIENT_CERT: X509<'static> =
    X509::pem_until_nul(concat!(include_str!("../secrets/client.crt"), "\0").as_bytes());
const CLIENT_KEY: X509<'static> =
    X509::pem_until_nul(concat!(include_str!("../secrets/client.key"), "\0").as_bytes());

// Section 8.2: Default thresholds
const DEFAULT_TEMP_MIN: f32 = 23.9;
const DEFAULT_TEMP_MAX: f32 = 27.8;
const DEFAULT_HUM_MIN: f32 = 85.0;
const DEFAULT_HUM_MAX: f32 = 92.0;

// Section 7.2: Status message schema
#[derive(Serialize)]
struct StatusMessage {
    ts: i64,
    temp_c: f32,
    temp_f: f32,
    humidity: f32,
    temp_min: f32,
    temp_max: f32,
    hum_min: f32,
    hum_max: f32,
    heater_on: bool,
    fogger_on: bool,
    heater_action: &'static str,
    fogger_action: &'static str,
    heater_mode: &'static str,
    fogger_mode: &'static str,
}

// Section 9.1: Control message schema
#[derive(Deserialize, Default)]
struct ControlMessage {
    temp_min: Option<f32>,
    temp_max: Option<f32>,
    hum_min: Option<f32>,
    hum_max: Option<f32>,
    heater_mode: Option<String>,
    fogger_mode: Option<String>,
    heater_on: Option<bool>,
    fogger_on: Option<bool>,
}

#[derive(Clone, Copy, PartialEq)]
enum ActuatorMode {
    Auto,
    Manual,
}

impl ActuatorMode {
    fn as_str(self) -> &'static str {
        match self {
            ActuatorMode::Auto => "auto",
            ActuatorMode::Manual => "manual",
        }
    }

    fn from_str(s: &str) -> Option<Self> {
        match s {
            "auto" => Some(ActuatorMode::Auto),
            "manual" => Some(ActuatorMode::Manual),
            _ => None,
        }
    }
}

struct DeviceState {
    temp_min: f32,
    temp_max: f32,
    hum_min: f32,
    hum_max: f32,
    heater_on: bool,
    fogger_on: bool,
    heater_mode: ActuatorMode,
    fogger_mode: ActuatorMode,
    last_control_time: Option<Instant>,
}

impl DeviceState {
    fn new() -> Self {
        Self {
            temp_min: DEFAULT_TEMP_MIN,
            temp_max: DEFAULT_TEMP_MAX,
            hum_min: DEFAULT_HUM_MIN,
            hum_max: DEFAULT_HUM_MAX,
            heater_on: false,
            fogger_on: false,
            heater_mode: ActuatorMode::Auto,
            fogger_mode: ActuatorMode::Auto,
            last_control_time: None,
        }
    }

    // Section 9.2: Apply control message with validation
    fn apply_control(&mut self, msg: &ControlMessage) {
        // Step 1: threshold updates with range and gap validation
        if msg.temp_min.is_some() || msg.temp_max.is_some() {
            let proposed_min = msg.temp_min.unwrap_or(self.temp_min);
            let proposed_max = msg.temp_max.unwrap_or(self.temp_max);

            if proposed_min < TEMP_RANGE_MIN || proposed_min > TEMP_RANGE_MAX
                || proposed_max < TEMP_RANGE_MIN || proposed_max > TEMP_RANGE_MAX
            {
                log::warn!("Temp thresholds out of range (0-50°C), ignoring");
            } else if proposed_max <= proposed_min {
                log::warn!("Invalid temp thresholds (max <= min), ignoring");
            } else if (proposed_max - proposed_min) < MIN_TEMP_GAP {
                log::warn!("Temp threshold gap < {MIN_TEMP_GAP}°C, ignoring");
            } else {
                self.temp_min = proposed_min;
                self.temp_max = proposed_max;
            }
        }

        if msg.hum_min.is_some() || msg.hum_max.is_some() {
            let proposed_min = msg.hum_min.unwrap_or(self.hum_min);
            let proposed_max = msg.hum_max.unwrap_or(self.hum_max);

            if proposed_min < HUM_RANGE_MIN || proposed_min > HUM_RANGE_MAX
                || proposed_max < HUM_RANGE_MIN || proposed_max > HUM_RANGE_MAX
            {
                log::warn!("Humidity thresholds out of range (0-100%), ignoring");
            } else if proposed_max <= proposed_min {
                log::warn!("Invalid humidity thresholds (max <= min), ignoring");
            } else if (proposed_max - proposed_min) < MIN_HUM_GAP {
                log::warn!("Humidity threshold gap < {MIN_HUM_GAP}%, ignoring");
            } else {
                self.hum_min = proposed_min;
                self.hum_max = proposed_max;
            }
        }

        // Step 2: mode changes
        if let Some(ref mode) = msg.heater_mode {
            if let Some(m) = ActuatorMode::from_str(mode) {
                self.heater_mode = m;
            } else {
                log::warn!("Invalid heater_mode: {mode}");
            }
        }
        if let Some(ref mode) = msg.fogger_mode {
            if let Some(m) = ActuatorMode::from_str(mode) {
                self.fogger_mode = m;
            } else {
                log::warn!("Invalid fogger_mode: {mode}");
            }
        }

        // Step 3: manual on/off (only honoured in manual mode)
        if self.heater_mode == ActuatorMode::Manual {
            if let Some(on) = msg.heater_on {
                self.heater_on = on;
            }
        }
        if self.fogger_mode == ActuatorMode::Manual {
            if let Some(on) = msg.fogger_on {
                self.fogger_on = on;
            }
        }
    }
}

// Section 8.1: Auto-mode evaluation with hysteresis
fn evaluate_auto(device_on: bool, value: f32, min: f32, max: f32) -> (bool, &'static str) {
    if device_on {
        if value > max {
            (false, "turned off")
        } else {
            (true, "none")
        }
    } else {
        if value < min {
            (true, "turned on")
        } else {
            (false, "none")
        }
    }
}

fn connect_wifi(wifi: &mut BlockingWifi<EspWifi<'static>>) {
    let mut delay_ms = WIFI_INITIAL_BACKOFF_MS;

    loop {
        log::info!("Attempting WiFi connection...");
        match wifi.connect() {
            Ok(()) => match wifi.wait_netif_up() {
                Ok(()) => {
                    let ip_info = wifi.wifi().sta_netif().get_ip_info().unwrap();
                    log::info!("WiFi connected — IP: {}", ip_info.ip);
                    return;
                }
                Err(e) => {
                    log::warn!("WiFi netif failed: {e:?}, retrying in {delay_ms}ms");
                }
            },
            Err(e) => {
                log::warn!("WiFi connect failed: {e:?}, retrying in {delay_ms}ms");
            }
        }

        thread::sleep(Duration::from_millis(delay_ms));
        delay_ms = (delay_ms * 2).min(WIFI_MAX_BACKOFF_MS);
    }
}

fn sync_ntp() -> EspSntp<'static> {
    log::info!("Starting NTP sync (server: pool.ntp.org)...");

    let sntp = EspSntp::new_default().expect("Failed to create SNTP client");

    for i in 0..120 {
        if sntp.get_sync_status() == SyncStatus::Completed {
            log::info!("NTP sync complete");
            return sntp;
        }
        if i % 20 == 0 && i > 0 {
            log::info!("NTP sync waiting... ({}s/60s)", i / 2);
        }
        thread::sleep(Duration::from_millis(500));
    }

    log::warn!("NTP sync timed out after 60s — proceeding anyway");
    sntp
}

fn main() {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    log::info!("Mycarium firmware starting (device: {DEVICE_ID})");

    let peripherals = Peripherals::take().unwrap();

    // Initialize relay GPIOs as outputs, both OFF on boot (Section 4.3)
    let mut heater = PinDriver::output(peripherals.pins.gpio12).unwrap();
    let mut fogger = PinDriver::output(peripherals.pins.gpio13).unwrap();
    heater.set_low().unwrap();
    fogger.set_low().unwrap();
    log::info!("Relays initialized: heater=OFF, fogger=OFF");

    // I2C auto-detection (Section 4.2): try (SDA=21, SCL=22) then swapped
    let i2c_config = I2cConfig::new().baudrate(100.kHz().into());
    let mut delay = Delay::new_default();

    log::info!("Trying I2C: SDA=GPIO21, SCL=GPIO22");
    let i2c = I2cDriver::new(
        peripherals.i2c0,
        peripherals.pins.gpio21,
        peripherals.pins.gpio22,
        &i2c_config,
    )
    .expect("Failed to initialize I2C");

    thread::sleep(Duration::from_millis(100));

    let mut bme280 = BME280::new(i2c, BME280_ADDR);
    let mut pin_label = "SDA=21, SCL=22";

    if let Err(e) = bme280.init(&mut delay) {
        log::warn!("BME280 init failed ({pin_label}): {e:?}, trying swapped pins");
        drop(bme280);

        let p = unsafe { Peripherals::steal() };

        pin_label = "SDA=22, SCL=21";
        log::info!("Trying I2C: {pin_label}");
        let i2c = I2cDriver::new(p.i2c0, p.pins.gpio22, p.pins.gpio21, &i2c_config)
            .expect("Failed to initialize I2C with swapped pins");

        thread::sleep(Duration::from_millis(100));

        bme280 = BME280::new(i2c, BME280_ADDR);
        bme280
            .init(&mut delay)
            .expect("HardwareFault: BME280 not detected on any I2C pin combination");
    }

    log::info!("BME280 detected: {pin_label}");

    // WiFi connection (Section 5.1)
    let sysloop = EspSystemEventLoop::take().unwrap();
    let nvs = EspDefaultNvsPartition::take().unwrap();

    let p = unsafe { Peripherals::steal() };
    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(p.modem, sysloop.clone(), Some(nvs)).expect("Failed to create WiFi driver"),
        sysloop,
    )
    .expect("Failed to create BlockingWifi");

    wifi.set_configuration(&Configuration::Client(ClientConfiguration {
        ssid: env!("MYCARIUM_WIFI_SSID").try_into().unwrap(),
        password: env!("MYCARIUM_WIFI_PASSWORD").try_into().unwrap(),
        auth_method: AuthMethod::WPA2Personal,
        ..Default::default()
    }))
    .expect("Failed to set WiFi configuration");

    wifi.start().expect("Failed to start WiFi");
    connect_wifi(&mut wifi);

    // NTP synchronization (Section 5.2)
    let _sntp = sync_ntp();

    // MQTT connection (Section 6)
    let publish_topic = format!("mycarium/status/{DEVICE_ID}");
    let subscribe_topic = format!("mycarium/control/{DEVICE_ID}");
    let broker_url = format!("mqtts://{MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}");

    let state = Arc::new(Mutex::new(DeviceState::new()));
    let state_for_cb = Arc::clone(&state);
    let sub_topic = subscribe_topic.clone();
    let mqtt_connected = Arc::new(AtomicBool::new(false));
    let mqtt_connected_cb = Arc::clone(&mqtt_connected);
    let mqtt_subscribed = Arc::new(AtomicBool::new(false));
    let mqtt_subscribed_cb = Arc::clone(&mqtt_subscribed);
    let mqtt_needs_subscribe = Arc::new(AtomicBool::new(false));
    let mqtt_needs_subscribe_cb = Arc::clone(&mqtt_needs_subscribe);
    let publish_now = Arc::new(AtomicBool::new(false));
    let publish_now_cb = Arc::clone(&publish_now);

    log::info!("Connecting MQTT to {broker_url}...");
    let mut mqtt_client = EspMqttClient::new_cb(
        &broker_url,
        &MqttClientConfiguration {
            client_id: Some(DEVICE_ID),
            server_certificate: Some(CA_CERT),
            client_certificate: Some(CLIENT_CERT),
            private_key: Some(CLIENT_KEY),
            ..Default::default()
        },
        move |event| {
            match event.payload() {
                EventPayload::Connected(_) => {
                    log::info!("MQTT connected");
                    mqtt_connected_cb.store(true, Ordering::Release);
                    mqtt_needs_subscribe_cb.store(true, Ordering::Release);
                }
                EventPayload::Disconnected => {
                    log::warn!("MQTT disconnected — will auto-reconnect");
                    mqtt_connected_cb.store(false, Ordering::Release);
                    mqtt_subscribed_cb.store(false, Ordering::Release);
                }
                EventPayload::Received { topic, data, .. } => {
                    if let Some(topic) = topic {
                        if topic == sub_topic {
                            match serde_json::from_slice::<ControlMessage>(data) {
                                Ok(msg) => {
                                    log::info!("Control message received on {topic}");
                                    if let Ok(mut s) = state_for_cb.lock() {
                                        // Section 11.2: Rate-limit control messages
                                        let now = Instant::now();
                                        if let Some(last) = s.last_control_time {
                                            if now.duration_since(last)
                                                < Duration::from_millis(CONTROL_RATE_LIMIT_MS)
                                            {
                                                log::warn!(
                                                    "Control message rate-limited, ignoring"
                                                );
                                                return;
                                            }
                                        }
                                        s.last_control_time = Some(now);
                                        s.apply_control(&msg);
                                        // Section 11.3: Signal immediate status publish
                                        publish_now_cb.store(true, Ordering::Release);
                                    }
                                }
                                Err(e) => {
                                    log::warn!("Malformed control message, discarding: {e}");
                                }
                            }
                        }
                    }
                }
                EventPayload::Error(e) => {
                    log::error!("MQTT error: {e:?}");
                }
                _ => {}
            }
        },
    )
    .expect("Failed to create MQTT client");

    // Wait for TLS handshake and MQTT connection (up to 30s)
    log::info!("Waiting for MQTT connection...");
    for i in 0..60 {
        if mqtt_connected.load(Ordering::Acquire) {
            break;
        }
        if i % 10 == 0 && i > 0 {
            log::info!("MQTT still connecting... ({i}/60)");
        }
        thread::sleep(Duration::from_millis(500));
    }

    if !mqtt_connected.load(Ordering::Acquire) {
        log::warn!("MQTT not yet connected after 30s — will subscribe when connected");
    }

    // Discard first BME280 reading (often stale after init)
    let _ = bme280.measure(&mut delay);
    thread::sleep(Duration::from_millis(100));

    // Section 7.1: Polling loop
    log::info!("Entering polling loop (interval: {POLL_INTERVAL_SEC}s)");
    loop {
        // Subscribe (or re-subscribe) when MQTT connects/reconnects
        if mqtt_needs_subscribe.load(Ordering::Acquire) && !mqtt_subscribed.load(Ordering::Acquire)
        {
            match mqtt_client.subscribe(&subscribe_topic, QoS::AtLeastOnce) {
                Ok(_) => {
                    log::info!("MQTT subscribed to {subscribe_topic}");
                    mqtt_subscribed.store(true, Ordering::Release);
                    mqtt_needs_subscribe.store(false, Ordering::Release);
                }
                Err(e) => {
                    log::error!("MQTT subscribe failed: {e:?}");
                }
            }
        }

        match bme280.measure(&mut delay) {
            Ok(m) => {
                let mut s = state.lock().unwrap();

                // Section 8: Evaluate control logic
                let (heater_action_str, fogger_action_str);

                if s.heater_mode == ActuatorMode::Auto {
                    let (on, action) = evaluate_auto(s.heater_on, m.temperature, s.temp_min, s.temp_max);
                    s.heater_on = on;
                    heater_action_str = action;
                } else {
                    heater_action_str = "none";
                }

                if s.fogger_mode == ActuatorMode::Auto {
                    let (on, action) = evaluate_auto(s.fogger_on, m.humidity, s.hum_min, s.hum_max);
                    s.fogger_on = on;
                    fogger_action_str = action;
                } else {
                    fogger_action_str = "none";
                }

                // Drive relays
                if s.heater_on {
                    heater.set_high().unwrap();
                } else {
                    heater.set_low().unwrap();
                }
                if s.fogger_on {
                    fogger.set_high().unwrap();
                } else {
                    fogger.set_low().unwrap();
                }

                let temp_f = m.temperature * 9.0 / 5.0 + 32.0;

                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                // Don't publish if NTP hasn't synced (ts < Jan 2025 = pre-epoch uptime)
                if ts < 1_735_689_600 {
                    log::warn!("Clock not synced (ts={ts}), skipping MQTT publish");
                    drop(s);
                    thread::sleep(Duration::from_secs(POLL_INTERVAL_SEC));
                    continue;
                }

                let status = StatusMessage {
                    ts,
                    temp_c: m.temperature,
                    temp_f,
                    humidity: m.humidity,
                    temp_min: s.temp_min,
                    temp_max: s.temp_max,
                    hum_min: s.hum_min,
                    hum_max: s.hum_max,
                    heater_on: s.heater_on,
                    fogger_on: s.fogger_on,
                    heater_action: heater_action_str,
                    fogger_action: fogger_action_str,
                    heater_mode: s.heater_mode.as_str(),
                    fogger_mode: s.fogger_mode.as_str(),
                };

                drop(s); // release lock before MQTT publish

                match serde_json::to_string(&status) {
                    Ok(json) => {
                        log::info!("temp={:.1}C ({:.1}F) hum={:.1}% heater={} fogger={}",
                            status.temp_c, status.temp_f, status.humidity,
                            if status.heater_on { "ON" } else { "OFF" },
                            if status.fogger_on { "ON" } else { "OFF" },
                        );
                        if let Err(e) = mqtt_client.publish(
                            &publish_topic,
                            QoS::AtMostOnce,
                            false,
                            json.as_bytes(),
                        ) {
                            log::error!("MQTT publish failed: {e:?}");
                        }
                    }
                    Err(e) => {
                        log::error!("JSON serialization failed: {e}");
                    }
                }
            }
            Err(e) => {
                log::error!("Sensor read failed: {e:?} — skipping cycle");
            }
        }
        // Interruptible sleep: wake early if a control message triggers immediate publish
        for _ in 0..(POLL_INTERVAL_SEC * 10) {
            if publish_now.load(Ordering::Acquire) {
                publish_now.store(false, Ordering::Release);
                log::info!("Immediate publish triggered by control message");
                break;
            }
            thread::sleep(Duration::from_millis(100));
        }
    }
}
