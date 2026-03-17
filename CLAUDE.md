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

## Definition of Done

Each spec file has a Definition of Done checklist. These are the quality
gates for the project. Keep them in sync with progress — check items off
as they are completed. If a DoD item needs to be added, removed, or
altered (beyond marking it done), discuss with Morgan first. Do not
unilaterally relax constraints.

## Conventions

- **Rust**: follow `docs/rust-guidelines.md`
- **Markdown**: must pass markdownlint (config in `.markdownlint.json`)
- **Spelling**: all code and docs must pass cspell (`cspell "**/*.md"` for docs, `cspell "**/*.rs"` for Rust, etc.). Project-specific terms go in `cspell.json` under `words`. When introducing domain terms or acronyms that cspell flags, add them to that list.
- **No hard-wrapping** in markdown files (MD013 is disabled)
- **Package managers**: use cargo, pnpm, uv — never npm, yarn, or pip
- **No secrets in git**: certificates, keys, .env files are gitignored
- **Commit early and often**: commit logically related changes together as you go, rather than accumulating large diffs. Sessions can be interrupted — uncommitted work is lost work. Prefer several small, thematic commits over one big one.
- **Record decisions**: when a design decision or tradeoff is made during development, capture it in the relevant spec or in `docs/NOTES.md` so it doesn't need to be re-derived in a future session.
