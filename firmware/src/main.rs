use esp_idf_hal::gpio::PinDriver;
use esp_idf_hal::peripherals::Peripherals;
use std::thread;
use std::time::Duration;

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

    // Relay toggle test — each relay clicks on for 1s, then off
    log::info!("Relay test: heater ON");
    heater.set_high().unwrap();
    thread::sleep(Duration::from_secs(1));

    log::info!("Relay test: heater OFF");
    heater.set_low().unwrap();
    thread::sleep(Duration::from_millis(500));

    log::info!("Relay test: fogger ON");
    fogger.set_high().unwrap();
    thread::sleep(Duration::from_secs(1));

    log::info!("Relay test: fogger OFF");
    fogger.set_low().unwrap();

    log::info!("Relay test complete. Both relays OFF.");
}
