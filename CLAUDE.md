# Mycarium

IoT mushroom terrarium system. An ESP32 device monitors temperature and
humidity inside a terrarium, controls a heater and fogger to maintain
optimal growing conditions, and publishes sensor data over MQTT. A cloud
server brokers MQTT messages and persists readings. A PWA lets the grower
monitor conditions, view historical graphs, and adjust settings.

## Project Status

All three components are deployed and operational at
`mycarium.morphatic.com`. The system is in active use with one device
(`mycarium-1`).

| Component | Status | Notes |
|-----------|--------|-------|
| Firmware  | Complete | 29/30 DoD items (MQTT v5 message expiry pending) |
| Server    | Complete + hardened | Rate limiting, CORS restriction, security headers |
| App (PWA) | Complete + hardened | All 6 phases done, security review complete |

### Remaining Work

**Firmware (deferred to future session):**

- Publish immediate status message after applying a control message
  (instead of waiting for next 30s poll cycle)
- Reject threshold values outside reasonable physical ranges (0–50°C,
  0–100% humidity)
- Enforce minimum threshold gap (2°C temp, 6% humidity) to prevent
  rapid cycling from sensor noise
- Rate-limit control messages (ignore commands within 1s of previous)
- MQTT v5 message expiry interval

**Server/Infrastructure:**

- Deploy HSTS and CSP headers via Nginx (config updated, not yet applied)
- Decide whether to stop sending client cert/key in login response
  (browser doesn't use them)
- MQTT ACL for topic-level authorization (deferred until multi-user)

**Integration:**

- End-to-end integration tests (app and server specs both have unchecked
  E2E DoD items)

## Repository Layout

```text
mycarium/
├── firmware/   ESP32 sensor firmware (Rust, ESP-IDF)
├── server/     MQTT persistence service + REST API (TypeScript/Fastify/SQLite)
├── app/        Progressive Web App (React 19, Vite, Tailwind v4, Zustand)
├── docs/       Specs, design notes, coding guidelines
└── deploy.sh   One-command deploy script (app, server, or both)
```

## Specs

- `docs/specs/mycarium-firmware.nlspec.md` — firmware behavior, MQTT
  message schemas, sensor/actuator control, security
- `docs/specs/mycarium-server.nlspec.md` — MQTT broker, persistence,
  REST API, certificate management, security hardening
- `docs/specs/mycarium-app.nlspec.md` — PWA: auth, real-time dashboard,
  historical data, device control, security
- `docs/NOTES.md` — design notes, build environment, deployment strategy

## MQTT Contract

The cross-component API. All three components depend on these topics and
field names:

- `mycarium/status/<device-id>` — device → server/app (sensor readings,
  actuator state). Fields: `ts`, `temp_c`, `temp_f`, `humidity`,
  `temp_min`, `temp_max`, `hum_min`, `hum_max`, `heater_on`,
  `fogger_on`, `heater_action`, `fogger_action`, `heater_mode`,
  `fogger_mode`
- `mycarium/control/<device-id>` — app → device (threshold changes, mode
  switches). Fields: `temp_min`, `temp_max`, `hum_min`, `hum_max`,
  `heater_mode`, `fogger_mode`, `heater_on`, `fogger_on`

**Important:** Field names must match exactly across firmware, server,
and app. A previous mismatch (`temp_min_c` vs `temp_min`) caused silent
control message failures.

## Tech Stack

| Component  | Stack                                          | Package Manager |
|------------|------------------------------------------------|-----------------|
| Firmware   | Rust, ESP-IDF (esp-rs), BME280 sensor          | cargo           |
| Server     | TypeScript, Fastify, SQLite (drizzle-orm), Zod | pnpm            |
| App        | React 19, Vite, Tailwind v4, Zustand, Chart.js | pnpm            |

## Deployment

Deployment uses `git pull` on the server, build there, copy to serving
directory. See `docs/NOTES.md` for full details.

```bash
ssh morphatic@mycarium.morphatic.com
cd ~/mycarium
./deploy.sh          # deploy both app and server
./deploy.sh app      # deploy only the PWA
./deploy.sh server   # deploy only the server (restarts mycarium-server service)
```

The server service is managed via systemd:
`sudo systemctl restart mycarium-server`

## Definition of Done

Each spec file has a Definition of Done checklist. These are the quality
gates for the project. Keep them in sync with progress — check items off
as they are completed. If a DoD item needs to be added, removed, or
altered (beyond marking it done), discuss with Morgan first. Do not
unilaterally relax constraints.

## Conventions

- **Rust**: follow `docs/rust-guidelines.md`
- **Markdown**: must pass markdownlint (config in `.markdownlint.json`)
- **Spelling**: all code and docs must pass cspell (`cspell "**/*.md"`
  for docs, `cspell "**/*.rs"` for Rust, etc.). Project-specific terms
  go in `cspell.json` under `words`. When introducing domain terms or
  acronyms that cspell flags, add them to that list.
- **No hard-wrapping** in markdown files (MD013 is disabled)
- **Package managers**: use cargo, pnpm, uv — never npm, yarn, or pip
- **No secrets in git**: certificates, keys, .env files are gitignored
- **Commit early and often**: commit logically related changes together
  as you go, rather than accumulating large diffs. Sessions can be
  interrupted — uncommitted work is lost work. Prefer several small,
  thematic commits over one big one.
- **Record decisions**: when a design decision or tradeoff is made
  during development, capture it in the relevant spec or in
  `docs/NOTES.md` so it doesn't need to be re-derived in a future
  session.
- **Deploy after changes**: after committing and pushing, remind Morgan
  to deploy with the appropriate `deploy.sh` command.
