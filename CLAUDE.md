# Mycarium

IoT mushroom terrarium system. An ESP32 device monitors temperature and
humidity inside a terrarium, controls a heater and fogger to maintain
optimal growing conditions, and publishes sensor data over MQTT. A cloud
server brokers MQTT messages and persists readings. A PWA lets the grower
monitor conditions, view historical graphs, and adjust settings.

## Repository Layout

```text
mycarium/
├── firmware/   ESP32 sensor firmware (Rust, ESP-IDF)
├── server/     MQTT broker, persistence service, REST API (TBD stack)
├── app/        Progressive Web App (TBD stack)
└── docs/       Specs, design notes, coding guidelines
```

## Specs

- `docs/specs/mycarium-firmware.nlspec.md` — firmware behavior, MQTT message schemas, sensor/actuator control
- `docs/specs/mycarium-server.nlspec.md` — MQTT broker, persistence, REST API, certificate management
- `docs/specs/mycarium-app.nlspec.md` — PWA: auth, real-time dashboard, historical data, device control
- `docs/NOTES.md` — design notes and open questions

## MQTT Contract

The cross-component API. All three components depend on these topics:

- `mycarium/status/<device-id>` — device → server/app (sensor readings, actuator state)
- `mycarium/control/<device-id>` — app → device (threshold changes, mode switches)

## Tech Stack

| Component  | Stack                  | Package Manager |
|------------|------------------------|-----------------|
| Firmware   | Rust, ESP-IDF (esp-rs) | cargo           |
| Server     | TBD                    | TBD             |
| App        | TBD                    | pnpm            |

## Conventions

- **Rust**: follow `docs/rust-guidelines.md`
- **Markdown**: must pass markdownlint (config in `.markdownlint.json`)
- **No hard-wrapping** in markdown files (MD013 is disabled)
- **Package managers**: use cargo, pnpm, uv — never npm, yarn, or pip
- **No secrets in git**: certificates, keys, .env files are gitignored
