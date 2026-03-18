# Notes on the Mycarium

## Windows Build Environment (ESP-RS)

Building the firmware on Windows (Git Bash in VSCode) requires several
workarounds discovered during initial setup (2026-03-17):

1. **Path length**: ESP-IDF builds generate deeply nested output paths that
   exceed Windows limits. Fix: set `target-dir = "C:/espbuild"` in
   `firmware/.cargo/config.toml` and `ESP_IDF_TOOLS_INSTALL_DIR = "global"`.

2. **Python**: The MSYS2 Python (`/c/msys64/mingw64/bin/python`) cannot
   create virtualenvs for ESP-IDF. The build must use a native Windows
   Python (e.g. `C:/Python313/python.exe`). Ensure native Python appears
   before MSYS2 in PATH (do not prepend `/c/msys64/mingw64/bin` in
   `~/.bash_profile`). Also set `PYTHON` and `IDF_PYTHON` in
   `.cargo/config.toml` as a safeguard.

3. **LIBCLANG_PATH**: `espup install` generates `export-esp.ps1`
   (PowerShell only). In Git Bash, `LIBCLANG_PATH` must be set separately
   — done via `.cargo/config.toml`. The clang and xtensa-esp-elf `bin`
   directories are added to PATH by `espup install` on Windows.

**Build command** (from `firmware/`):

```bash
cargo build
```

First build takes ~10 minutes (downloads and compiles ESP-IDF). Subsequent
builds are ~1 minute.

## Firmware Design Decisions (2026-03-17)

- **WPA2 over WPA3**: Forced `AuthMethod::WPA2Personal` because WPA3-SAE
  handshakes with the home router (TP-Link) intermittently timed out
  (0xcc00 4-way handshake failure). WPA2 connects reliably on first attempt.

- **Compile-time secrets via build.rs**: `firmware/build.rs` parses
  `secrets/cfg.toml` and emits `cargo:rustc-env` directives. TLS certs are
  embedded via `include_str!` with null-terminated PEM. The spec references
  `secrets.h` / `certificates.h` (C convention) — Rust equivalent is
  `secrets/cfg.toml` + `secrets/*.crt` / `secrets/*.key`.

- **BME280 I2C at 100 kHz**: Default baudrate (1 MHz) caused NoAcknowledge
  errors during the BME280 soft-reset + calibration sequence. 100 kHz is
  reliable.

- **QoS 0 for status, QoS 1 for control subscribe**: Status messages are
  ephemeral — missing one is acceptable, duplicates are worse. Control
  messages use AtLeastOnce to avoid missed commands.

- **Subscribe-on-reconnect**: MQTT subscribe happens in the polling loop
  whenever the `Connected` callback sets a flag, not just during initial
  startup. This handles late connects and reconnects after disconnection.

- **NTP guard**: If `SystemTime::now()` returns a timestamp before Jan 2025,
  NTP hasn't synced and MQTT publish is skipped (relay control still runs).

- **Mosquitto local debug listener**: Added `listener 1883 127.0.0.1` with
  `allow_anonymous true` on the server for easy debugging without client
  certs. Only binds to localhost — not exposed to the internet.

## Server Design Decisions (2026-03-18)

- **TypeScript + Fastify + SQLite**: Single-process server runs both the
  MQTT subscriber and REST API. better-sqlite3 is synchronous (microsecond
  inserts), avoiding concurrency issues in single-threaded Node.
  drizzle-orm for type-safe queries.

- **SQLite WAL mode**: Enabled on startup for better read concurrency
  between MQTT writes and API queries.

- **Opaque session tokens over JWTs**: Server already has a database, so
  session lookup is cheap. Opaque tokens allow instant revocation without
  token blacklists or signing key management.

- **Certificate issuance via `child_process.execFile('openssl')`**: The
  server already has OpenSSL 3.x installed and configured with the CA.
  node-forge has known security concerns. This approach won't work on
  Windows dev machines, but the cert service only runs on the Linux server
  (mocked in tests via vitest).

- **Caddy for HTTPS**: Auto Let's Encrypt for the REST API. Fastify
  listens on localhost:3000 (HTTP only). mTLS for MQTT stays on Mosquitto.

- **Device activation inline**: When a reading is persisted, the
  subscriber checks if a pending device record matches the device_id and
  activates it. No polling or separate job needed.

- **Retention as a daily interval**: `setInterval` in the Node process
  runs the cleanup once per day. Simple and avoids adding cron dependencies.

---

A mycological terrarium, what I'm calling a "mycarium," is a climate controlled container for growing mushrooms. In it's current incarnation, it is an acrylic box with a volume of about 10 cubic feet and a small hole in the bottom to allow carbon dioxide to escape. The mycarium's climate control system is as follows:

* Temperature: heating pad, like that found in a lizard's cage
* Humidity: humidifier, like those used for amphibian habitats
* A BME280 sensor connected to an ESP-WROOM-32 dev board used to turn the heating pad and humidifier on and off via relays

## Narrative Description of the System to be Built

The mycarium is designed to be used in a typical home. It connects to home wifi, and can be monitored and controlled from the user's phone via some sort of app, although it has not yet been decided whether this should be a web app, native mobile app, PWA, or some hybrid like with [Tauri](https://v2.tauri.app/). The mycarium's ESP32 board will communicate with a remote server (currently on an Ubuntu Server instance running on a DigitalOcean droplet), and this server will be the intermediary between the app and the mycarium. From the app, the user will want to be able to establish ownership of a mycarium, monitor its temperature and humidity, change the temperature and humidity thresholds, receive alerts or notifications if there's a problem, and also turn it "off" (i.e. some sort of standby mode). They will want to see graphs of the temperature and humidity over time.

At some point in the future, we may want to add additional mycariums to the network, so the app should be able to take ownership of and separately manage the different devices. We may also want to add additional sensors, e.g. a camera, to a mycarium, although that is a stretch goal and doesn't need to be considered during this round of development. All communications should be secure (i.e. TLS) and handled by MQTT.

## Sensor Node

The sensor node is an ESP32-WROOM-32 dev board connected to a BME280
temperature/humidity sensor and two relay modules. It connects to a
home WiFi network, syncs time via NTP, reads environmental data, and
publishes status messages to an MQTT broker. It subscribes to a
control topic and responds to incoming configuration and command
messages.

### Hardware Setup

The sensor node hardware is correctly wired when:

* The BME280 sensor is powered by the ESP32's 3V3 and GND pins
* The BME280 communicates over I2C with SDA on pin 21 and SCL on pin
  22 (or vice versa — the firmware detects which is which at boot and
  uses whichever produces a valid sensor reading)
* The heater relay is switched by GPIO pin 12
* The fogger/humidifier relay is switched by GPIO pin 13
* The device powers on and all components are detected successfully on
  boot, with any hardware fault reported to the serial console

### Network Connectivity

The device is connected and ready when:

* It connects to the configured home WiFi network on boot
* It retries the WiFi connection indefinitely on failure, with
  exponential backoff, until a connection is established
* It synchronizes the system clock with an NTP server (pool.ntp.org
  and time.nist.gov as fallback) before proceeding
* It does not proceed to read sensors or connect to MQTT until NTP
  sync is confirmed complete
* After a WiFi disconnection, it automatically reconnects without
  requiring a reboot

### MQTT Connectivity

The device maintains a reliable MQTT connection when:

* It connects to the MQTT broker over TLS 1.2 on port 8883 using
  mTLS (mutual TLS), presenting its client certificate and validating
  the broker's certificate against the CA trust anchor
* The SSL verification time is set from the NTP-synced clock before
  the TLS handshake is attempted, so certificate validity windows are
  evaluated correctly
* It uses its device ID (e.g. `mycarium-1`) as both the MQTT client
  ID and the CN in its client certificate, matching the broker's
  `use_identity_as_username` / `use_username_as_clientid` config
* It subscribes to its control topic (`mycarium/control/<device-id>`)
  on successful connection
* It reconnects to the broker automatically after disconnection,
  with a retry delay, without requiring a reboot
* Connection failures are logged to the serial console with a
  descriptive reason code

### Sensor Reading and Publishing

The sensor node publishes environmental data correctly when:

* It reads temperature (°C) and humidity (%) from the BME280 every
  30 seconds
* Each status message is published to `mycarium/status/<device-id>`
  as a compact JSON payload
* Every status message includes:
  * A UTC Unix timestamp (`ts`)
  * Current temperature in both Celsius and Fahrenheit
  * Current humidity as a percentage
  * Configured min/max thresholds for both temperature and humidity
  * Current on/off state of the heater and fogger
  * The action taken this cycle for each device (`"none"`,
    `"turned on"`, or `"turned off"`)
  * Current control mode for each device (`"auto"` or `"manual"`)
* A message expiry interval (MQTT v5) is set on each published
  message so that stale readings are not delivered to late-connecting
  subscribers
* If the BME280 fails to return a valid reading, the cycle is
  skipped, an error is logged to serial, and no MQTT message is
  published for that cycle

### Environmental Control — Auto Mode

The heater and fogger are controlled correctly in auto mode when:

* The heater turns ON when the temperature drops below the configured
  minimum threshold
* The heater turns OFF when the temperature rises above the configured
  maximum threshold
* The fogger turns ON when the humidity drops below the configured
  minimum threshold
* The fogger turns OFF when the humidity rises above the configured
  maximum threshold
* A hysteresis buffer is applied to both devices: once a device is
  turned on, it will not be turned off until the reading has moved
  past the opposite threshold (not just back across the threshold that
  triggered it), preventing rapid on/off cycling near a boundary
* Devices do not toggle state more than once per polling cycle
* The default thresholds on first boot are:
  * Temperature: 23.9°C min, 27.8°C max
  * Humidity: 85% min, 92% max

### Environmental Control — Manual Mode

The heater and fogger are controlled correctly in manual mode when:

* Each device can be independently switched to manual mode via an
  MQTT control message
* In manual mode, the device's on/off state is set explicitly by
  incoming MQTT control messages and is not overridden by sensor
  readings or thresholds
* Switching a device from manual back to auto mode hands control back
  to the threshold logic immediately
* Manual mode state persists across polling cycles until explicitly
  changed

### Remote Configuration via MQTT

The device handles incoming control messages correctly when:

* It subscribes to `mycarium/control/<device-id>` and processes
  inbound JSON messages
* A valid control message may contain any combination of:
  * New min/max temperature thresholds
  * New min/max humidity thresholds
  * A mode change (`"auto"` or `"manual"`) for the heater
  * A mode change (`"auto"` or `"manual"`) for the fogger
  * An explicit on/off command for the heater (only honoured in
    manual mode)
  * An explicit on/off command for the fogger (only honoured in
    manual mode)
* New threshold values are rejected (ignored) if max ≤ min
* Fields absent from an incoming message leave the current
  configuration unchanged
* Malformed or unparseable JSON messages are discarded with a serial
  error log and no state change

### Firmware Configuration

The firmware is correctly configurable when:

* WiFi SSID and password are stored in a `secrets.h` file excluded
  from version control
* The client certificate and private key are stored in `secrets.h`
* The CA trust anchor is stored in `certificates.h`, also excluded
  from version control
* Device ID, MQTT broker hostname and port, NTP servers, timezone,
  and polling frequency are defined as named constants at the top of
  the main source file and are easy to locate and change
* The firmware compiles and flashes successfully to a generic
  ESP32-WROOM-32 dev board using the ESP-IDF toolchain with Rust

---

## Server

The server is a DigitalOcean Droplet running Ubuntu Server. It hosts
the Mosquitto MQTT broker and a persistence service that writes
message history to a database for querying by the client app.

### MQTT Broker

The Mosquitto broker is correctly configured when:

* It is installed from the official Mosquitto PPA (not the outdated
  Ubuntu default repo) and runs as a systemd/service daemon that
  starts automatically on boot
* It accepts TLS 1.2 connections on port 8883 for ESP32 and native
  clients, requiring mutual TLS with a valid client certificate signed
  by the self-signed CA
* It accepts WSS (WebSockets over TLS) connections on port 8083 for
  browser-based clients, with the same mTLS requirement
* Anonymous connections are rejected on all listeners
* `use_identity_as_username` and `use_username_as_clientid` are
  enabled so that the CN from the client certificate serves as both
  username and client ID, with no password file required
* The CA certificate, server certificate, and server private key are
  stored in `/etc/mosquitto/certs/<fqdn>/` with restrictive file
  permissions
* TLS 1.1 is NOT used; the minimum TLS version is 1.2
* Broker logs are written to `/var/log/mosquitto/mosquitto.log` with
  `log_type all`
* The broker can be started, stopped, restarted, and status-checked
  via standard service commands

### Certificate Management

Certificates are correctly managed when:

* A self-signed CA has been created with the server FQDN as the CN,
  with a password protecting the CA private key
* The server certificate is an x509v3 cert (not v1) with a
  `subjectAltName` extension covering the server's FQDN and IP
  address, signed by the self-signed CA
* Each client (device or user) has its own certificate with its
  intended username/device-id as the CN, signed by the CA
* Client certificates do NOT have a password
* All certificates have been generated with OpenSSL 3.x or later
  (not the outdated version on older Ubuntu)
* There is a documented, repeatable process for issuing new client
  certificates for new devices or users using the existing CA

### Message Persistence

Message history is correctly persisted when:

* A service running on the server subscribes to
  `mycarium/status/#` using a service-account client certificate
* Each received status message is parsed and written to a database
  with at minimum: device ID, timestamp, temperature, humidity,
  heater state, fogger state
* The persistence service starts automatically on boot and
  reconnects to the broker on disconnection
* Historical data is queryable by the client app API with filters
  for device ID and time range
* The database does not grow unbounded; a retention policy drops
  records older than a configurable threshold (e.g. 90 days)

---

## Client App (PWA)

The client app is a Progressive Web App that allows authenticated
users to monitor and control their mycarium devices from a browser
or mobile device. It communicates with the MQTT broker directly over
WSS and retrieves historical data from the server API.

### Authentication

The app handles authentication correctly when:

* Users can register with an email address and password
* Users can log in and receive a session token
* Unauthenticated users cannot access any app functionality beyond
  the login/register screen
* Sessions persist across browser restarts until explicitly logged out
  or the token expires
* On login, the app receives the client certificate and key associated
  with the user's account so it can authenticate to the MQTT broker
  over WSS

### Device Ownership

A user can establish ownership of a device when:

* They can add a new device by entering its device ID
* The device appears in a claimed/pending state until the server
  confirms that a status message has been received from that device ID
* Only the owning user can view or control a given device
* A user can remove a device from their account (this does not
  affect the device itself, just the association)
* A user can give a device a human-readable name (e.g. "Basement
  Mycarium") that is displayed in the app in place of the device ID

### Real-Time Monitoring

The app displays real-time sensor data correctly when:

* It connects to the MQTT broker over WSS using the user's client
  certificate for mTLS
* It subscribes to `mycarium/status/<device-id>` for each of the
  user's claimed devices
* Current temperature and humidity are displayed and updated in
  real time as new MQTT messages arrive
* The current state (on/off) and mode (auto/manual) of the heater
  and fogger are displayed and updated in real time
* If the device has not published a status message within the last
  2× the polling interval, it is shown as "offline" or "not
  responding"
* The connection to the broker is re-established automatically on
  disconnection

### Historical Data

The app displays historical data correctly when:

* Temperature and humidity over time are displayed as line graphs
* The user can select a time range (last hour, last 24h, last 7d,
  last 30d)
* Graph data is fetched from the server API (not MQTT)
* Heater and fogger activation events are optionally overlaid on
  the graphs as markers or shaded regions

### Device Control

The user can control a device when:

* They can view and edit the min/max temperature thresholds
* They can view and edit the min/max humidity thresholds
* Changes to thresholds are validated (max > min) before being sent
* Threshold updates are published as MQTT control messages to
  `mycarium/control/<device-id>`
* They can switch the heater and fogger independently between auto
  mode and manual mode
* In manual mode, they can turn the heater or fogger on or off
  directly
* They can put the device into a standby mode that disables
  automated control without modifying the configured thresholds, and
  resume auto mode from standby
* All control actions give immediate visual feedback and reflect the
  new state when the next status message is received from the device
