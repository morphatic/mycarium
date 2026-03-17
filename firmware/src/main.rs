use bme280::i2c::BME280;
use esp_idf_hal::delay::Delay;
use esp_idf_hal::gpio::PinDriver;
use esp_idf_hal::i2c::I2cDriver;
use esp_idf_hal::i2c::config::Config as I2cConfig;
use esp_idf_hal::units::FromValueType;
use esp_idf_hal::peripherals::Peripherals;
use esp_idf_svc::eventloop::EspSystemEventLoop;
use esp_idf_svc::nvs::EspDefaultNvsPartition;
use esp_idf_svc::sntp::{EspSntp, SyncStatus};
use esp_idf_svc::wifi::{BlockingWifi, ClientConfiguration, Configuration, EspWifi};
use std::thread;
use std::time::Duration;

const BME280_ADDR: u8 = 0x76;
const WIFI_INITIAL_BACKOFF_MS: u64 = 1_000;
const WIFI_MAX_BACKOFF_MS: u64 = 60_000;

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

    // Wait for sync (timeout after 30s)
    for i in 0..60 {
        let status = sntp.get_sync_status();
        if status == SyncStatus::Completed {
            log::info!("NTP sync complete");
            return sntp;
        }
        if i % 10 == 0 && i > 0 {
            log::info!("NTP sync waiting... ({i}/60)");
        }
        thread::sleep(Duration::from_millis(500));
    }

    log::warn!("NTP sync timed out after 30s — proceeding anyway");
    sntp
}

fn main() {
    esp_idf_svc::sys::link_patches();
    esp_idf_svc::log::EspLogger::initialize_default();

    log::info!("Mycarium firmware starting");

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

    // Attempt 1: SDA=21, SCL=22
    log::info!("Trying I2C: SDA=GPIO21, SCL=GPIO22");
    let i2c = I2cDriver::new(
        peripherals.i2c0,
        peripherals.pins.gpio21,
        peripherals.pins.gpio22,
        &i2c_config,
    )
    .expect("Failed to initialize I2C");

    // Give the BME280 time to power up before init
    thread::sleep(Duration::from_millis(100));

    let mut bme280 = BME280::new(i2c, BME280_ADDR);
    let mut pin_label = "SDA=21, SCL=22";

    if let Err(e) = bme280.init(&mut delay) {
        log::warn!("BME280 init failed ({pin_label}): {e:?}, trying swapped pins");
        drop(bme280);

        // SAFETY: previous I2cDriver dropped, releasing the hardware
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

    // SAFETY: WiFi needs modem peripheral; original Peripherals already consumed
    let p = unsafe { Peripherals::steal() };
    let mut wifi = BlockingWifi::wrap(
        EspWifi::new(p.modem, sysloop.clone(), Some(nvs)).expect("Failed to create WiFi driver"),
        sysloop,
    )
    .expect("Failed to create BlockingWifi");

    wifi.set_configuration(&Configuration::Client(ClientConfiguration {
        ssid: env!("MYCARIUM_WIFI_SSID").try_into().unwrap(),
        password: env!("MYCARIUM_WIFI_PASSWORD").try_into().unwrap(),
        ..Default::default()
    }))
    .expect("Failed to set WiFi configuration");

    wifi.start().expect("Failed to start WiFi");
    connect_wifi(&mut wifi);

    // NTP synchronization (Section 5.2) — must complete before sensor reads / MQTT
    // Keep _sntp alive so background sync continues running
    let _sntp = sync_ntp();

    // Read sensor in a loop
    loop {
        match bme280.measure(&mut delay) {
            Ok(m) => {
                let temp_f = m.temperature * 9.0 / 5.0 + 32.0;
                log::info!(
                    "{pin_label} | temp={:.1}C ({:.1}F) humidity={:.1}% pressure={:.1}hPa",
                    m.temperature,
                    temp_f,
                    m.humidity,
                    m.pressure / 100.0,
                );
            }
            Err(e) => {
                log::error!("Sensor read failed: {e:?}");
            }
        }
        thread::sleep(Duration::from_secs(2));
    }
}
