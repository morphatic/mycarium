# Mycarium

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An IoT mushroom terrarium system. An ESP32-based sensor/actuator device
maintains optimal growing conditions (temperature and humidity) inside a
terrarium, communicates over MQTT with a cloud server, and is monitored and
controlled through a Progressive Web App.

## Repository Layout

| Directory    | Description                                           |
|------------- |-------------------------------------------------------|
| `firmware/`  | ESP32 sensor firmware (Rust, ESP-IDF)                 |
| `server/`    | MQTT broker, persistence service, and REST API        |
| `app/`       | Progressive Web App for monitoring and control        |
| `docs/`      | Specs, design notes, and coding guidelines            |

## License

[MIT](LICENSE)
