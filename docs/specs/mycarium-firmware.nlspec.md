# Mycarium Sensor Firmware

The mycarium sensor firmware is embedded software for an ESP32-WROOM-32
microcontroller that monitors temperature and humidity inside a mycological
terrarium ("mycarium") and actuates a heater and fogger to maintain
configurable environmental thresholds. It communicates with a remote MQTT
broker over mutual TLS to publish sensor readings and receive control
commands.

The firmware is intended for developers building or extending a mycarium
device, and for coding agents tasked with implementing the firmware from
this specification.

---

- [Mycarium Sensor Firmware](#mycarium-sensor-firmware)
  - [1. Problem Statement](#1-problem-statement)
  - [2. Design Principles](#2-design-principles)
  - [3. Layering and Scope](#3-layering-and-scope)
  - [4. Hardware Interface](#4-hardware-interface)
    - [4.1 Component Wiring](#41-component-wiring)
    - [4.2 Boot-Time Hardware Detection](#42-boot-time-hardware-detection)
    - [4.3 Relay Initialization](#43-relay-initialization)
  - [5. Network Connectivity](#5-network-connectivity)
    - [5.1 WiFi Connection](#51-wifi-connection)
    - [5.2 NTP Synchronization](#52-ntp-synchronization)
  - [6. MQTT Connectivity](#6-mqtt-connectivity)
    - [6.1 Connection Parameters](#61-connection-parameters)
    - [6.2 Connection Lifecycle](#62-connection-lifecycle)
  - [7. Sensor Reading and Publishing](#7-sensor-reading-and-publishing)
    - [7.1 Polling Loop](#71-polling-loop)
    - [7.2 Status Message Schema](#72-status-message-schema)
  - [8. Environmental Control](#8-environmental-control)
    - [8.1 Auto Mode](#81-auto-mode)
    - [8.2 Default Thresholds](#82-default-thresholds)
    - [8.3 Manual Mode](#83-manual-mode)
  - [9. Remote Configuration via MQTT](#9-remote-configuration-via-mqtt)
    - [9.1 Control Message Schema](#91-control-message-schema)
    - [9.2 Validation Rules](#92-validation-rules)
  - [10. Firmware Configuration](#10-firmware-configuration)
    - [10.1 Compile-Time Secrets](#101-compile-time-secrets)
    - [10.2 Named Constants](#102-named-constants)
    - [10.3 Build Toolchain](#103-build-toolchain)
  - [11. Out of Scope](#11-out-of-scope)
  - [12. Design Decision Rationale](#12-design-decision-rationale)
  - [13. Definition of Done](#13-definition-of-done)

---

## 1. Problem Statement

Growing mushrooms at home requires stable temperature and humidity within
narrow ranges. Without automation, a grower must manually check conditions
and toggle heating and humidification equipment multiple times per day.
Deviations — even brief ones — can stall or kill a grow.

The sensor firmware closes this loop: it reads the environment, actuates
hardware to keep conditions within target ranges, and reports state to a
remote broker so that a companion app can monitor and override behavior
remotely.

## 2. Design Principles

**Fail safe, not fail silent.** When the sensor cannot be read or the
network is unreachable, the firmware must log the failure and refrain from
publishing stale data or toggling actuators based on unknown state.

**Reconnect autonomously.** WiFi and MQTT connections will drop. The
firmware must recover from any transient network failure without requiring
a physical reboot.

**Minimal attack surface.** All communication with the broker uses mutual
TLS. No plaintext listeners, no anonymous connections. Secrets are
compiled into the firmware and excluded from version control.

**Hysteresis over responsiveness.** Rapid on/off cycling damages
equipment and stresses the grow environment. The control logic uses
threshold bands (min/max) so that actuators toggle only when readings
cross a definitive boundary, not when they hover near a single setpoint.

**Single source of truth for state.** The firmware is authoritative for
the current state of the heater, fogger, sensor readings, and control
mode. The status message it publishes is the canonical representation of
device state.

## 3. Layering and Scope

This spec covers the firmware running on the ESP32, from boot through
steady-state operation. It includes:

- Hardware initialization and sensor communication
- WiFi and NTP connectivity
- MQTT connection, publishing, and subscription
- Environmental control logic (auto and manual modes)
- Inbound control message handling
- Build-time configuration

This spec does **not** cover:

- The MQTT broker, its configuration, or certificate authority management
  (see `mycarium-server.nlspec.md`)
- The client app or server API (see `mycarium-app.nlspec.md`)
- Over-the-air (OTA) firmware updates
- Provisioning or onboarding flows for new devices

The firmware depends on an MQTT broker that:

- Accepts mTLS connections on port 8883
- Has `use_identity_as_username` and `use_username_as_clientid` enabled
- Routes messages on topics `mycarium/status/<device-id>` and
  `mycarium/control/<device-id>`

## 4. Hardware Interface

### 4.1 Component Wiring

The sensor node hardware is correctly wired when:

- The BME280 sensor is powered by the ESP32's 3V3 and GND pins
- The BME280 communicates over I2C with SDA on GPIO 21 and SCL on GPIO
  22, or vice versa — the firmware detects the correct pin assignment at
  boot (see Section 4.2)
- The heater relay is switched by GPIO 12
- The fogger/humidifier relay is switched by GPIO 13

### 4.2 Boot-Time Hardware Detection

```pseudo
FUNCTION detect_i2c_pins:
    FOR EACH (sda, scl) IN [(21, 22), (22, 21)]:
        initialize I2C bus with (sda, scl)
        reading = attempt BME280 read
        IF reading is valid:
            RETURN (sda, scl)
    RAISE HardwareFault("BME280 not detected on any I2C pin combination")

-- Behavior:
-- - Tries both pin orderings and uses whichever produces a valid read.
-- - If neither works, the device halts and logs the fault to serial.
```

### 4.3 Relay Initialization

On boot, both relay GPIOs are configured as outputs and set to OFF
(heater off, fogger off). No actuator is energized until the first
successful sensor reading and control evaluation.

## 5. Network Connectivity

### 5.1 WiFi Connection

The device connects to the configured home WiFi network on boot. If the
connection fails, it retries indefinitely with exponential backoff. The
SSID and password are compiled from `secrets.h` (see Section 10).

```pseudo
FUNCTION connect_wifi(ssid, password):
    delay = INITIAL_BACKOFF  -- e.g. 1 second
    LOOP:
        attempt WiFi connection to (ssid, password)
        IF connected:
            log "WiFi connected"
            RETURN
        log "WiFi connection failed, retrying in {delay}s"
        wait(delay)
        delay = min(delay * 2, MAX_BACKOFF)  -- e.g. cap at 60 seconds

After a WiFi disconnection during steady-state operation, the firmware
automatically reconnects using the same backoff strategy without
requiring a reboot.
```

### 5.2 NTP Synchronization

After WiFi is established, the firmware synchronizes the system clock
before proceeding to any TLS handshake or sensor operation.

- Primary NTP server: `pool.ntp.org`
- Fallback NTP server: `time.nist.gov`

The firmware does not proceed to read sensors or connect to MQTT until
NTP sync is confirmed complete. The synced time is used to set the SSL
verification time so that certificate validity windows are evaluated
correctly.

## 6. MQTT Connectivity

### 6.1 Connection Parameters

| Parameter             | Value                                  |
|-----------------------|----------------------------------------|
| Broker port           | 8883 (TLS)                             |
| TLS version           | 1.2 (minimum)                          |
| Authentication        | Mutual TLS (mTLS)                      |
| Client certificate CN | Device ID (e.g. `mycarium-1`)          |
| MQTT client ID        | Device ID                              |
| Publish topic         | `mycarium/status/<device-id>`          |
| Subscribe topic       | `mycarium/control/<device-id>`         |

The client certificate, private key, and CA trust anchor are compiled
into the firmware from `secrets.h` and `certificates.h` respectively
(see Section 10).

### 6.2 Connection Lifecycle

```pseudo
FUNCTION connect_mqtt(broker_host, broker_port, device_id):
    set SSL verification time from NTP-synced clock
    configure TLS with client cert, client key, CA trust anchor
    set MQTT client ID to device_id
    attempt connection to (broker_host, broker_port)
    IF connected:
        subscribe to "mycarium/control/{device_id}"
        log "MQTT connected, subscribed to control topic"
        RETURN
    ELSE:
        log "MQTT connection failed: {reason_code}"
        schedule retry after MQTT_RETRY_DELAY

-- Behavior:
-- - SSL verification time must be set before the TLS handshake.
-- - On disconnection during steady-state, the firmware reconnects
--   automatically with a retry delay, without requiring a reboot.
-- - Connection failures are logged with a descriptive reason code.
```

## 7. Sensor Reading and Publishing

### 7.1 Polling Loop

The firmware reads the BME280 sensor every 30 seconds (configurable; see
Section 10). Each cycle:

```pseudo
FUNCTION poll_cycle(state):
    reading = read_bme280()
    IF reading is invalid:
        log "BME280 read failed, skipping cycle"
        RETURN state  -- no publish, no actuation

    state = evaluate_control(state, reading)  -- see Section 8
    message = build_status_message(state, reading)
    publish(message, topic="mycarium/status/{device_id}", expiry=STATUS_EXPIRY)
    RETURN state

-- Behavior:
-- - A failed sensor read skips the entire cycle: no MQTT message is
--   published and no actuator state changes.
-- - The message expiry interval (MQTT v5) prevents stale readings from
--   being delivered to late-connecting subscribers.
```

### 7.2 Status Message Schema

Every status message is a compact JSON payload with the following fields:

```pseudo
RECORD StatusMessage:
    ts          : Integer    -- UTC Unix timestamp
    temp_c      : Float      -- current temperature in Celsius
    temp_f      : Float      -- current temperature in Fahrenheit
    humidity    : Float      -- current relative humidity (%)
    temp_min    : Float      -- configured min temperature threshold (C)
    temp_max    : Float      -- configured max temperature threshold (C)
    hum_min     : Float      -- configured min humidity threshold (%)
    hum_max     : Float      -- configured max humidity threshold (%)
    heater_on   : Boolean    -- current heater state
    fogger_on   : Boolean    -- current fogger state
    heater_action : String   -- "none", "turned on", or "turned off"
    fogger_action : String   -- "none", "turned on", or "turned off"
    heater_mode : String     -- "auto" or "manual"
    fogger_mode : String     -- "auto" or "manual"
```

## 8. Environmental Control

### 8.1 Auto Mode

In auto mode, actuators are governed by the configured min/max
thresholds with hysteresis:

```pseudo
FUNCTION evaluate_auto(device_on, reading_value, threshold_min, threshold_max):
    IF device_on:
        -- Device is on; only turn off when reading exceeds the max threshold
        IF reading_value > threshold_max:
            RETURN (false, "turned off")
        RETURN (true, "none")
    ELSE:
        -- Device is off; only turn on when reading drops below the min threshold
        IF reading_value < threshold_min:
            RETURN (true, "turned on")
        RETURN (false, "none")

-- Behavior:
-- - The hysteresis buffer is the gap between min and max. A device
--   turned on at min will not turn off until the reading exceeds max,
--   preventing rapid cycling near a single boundary.
-- - Devices do not toggle state more than once per polling cycle.
```

### 8.2 Default Thresholds

| Parameter     | Default Value |
|---------------|---------------|
| temp_min      | 23.9 C        |
| temp_max      | 27.8 C        |
| hum_min       | 85 %          |
| hum_max       | 92 %          |

These defaults are used on first boot. They are overridden by incoming
control messages (see Section 9).

### 8.3 Manual Mode

In manual mode:

- The actuator's on/off state is set explicitly by incoming MQTT control
  messages and is not overridden by sensor readings or thresholds.
- Manual mode state persists across polling cycles until explicitly
  changed by a control message.
- Switching a device from manual back to auto mode hands control back to
  the threshold logic immediately on the next polling cycle.

## 9. Remote Configuration via MQTT

### 9.1 Control Message Schema

The device subscribes to `mycarium/control/<device-id>` and processes
inbound JSON messages. A valid control message may contain any
combination of the following fields; absent fields leave the current
configuration unchanged.

```pseudo
RECORD ControlMessage:
    temp_min     : Float?     -- new min temperature threshold (C)
    temp_max     : Float?     -- new max temperature threshold (C)
    hum_min      : Float?     -- new min humidity threshold (%)
    hum_max      : Float?     -- new max humidity threshold (%)
    heater_mode  : String?    -- "auto" or "manual"
    fogger_mode  : String?    -- "auto" or "manual"
    heater_on    : Boolean?   -- explicit on/off (honoured only in manual mode)
    fogger_on    : Boolean?   -- explicit on/off (honoured only in manual mode)
```

### 9.2 Validation Rules

```pseudo
FUNCTION apply_control_message(state, message):
    IF message is not valid JSON:
        log "Malformed control message, discarding"
        RETURN state  -- no state change

    -- Step 1: Apply threshold updates with validation
    IF message has temp_min AND message has temp_max:
        IF message.temp_max <= message.temp_min:
            log "Invalid temp thresholds (max <= min), ignoring"
        ELSE:
            state.temp_min = message.temp_min
            state.temp_max = message.temp_max
    ELSE IF message has temp_min:
        IF message.temp_min < state.temp_max:
            state.temp_min = message.temp_min
    ELSE IF message has temp_max:
        IF message.temp_max > state.temp_min:
            state.temp_max = message.temp_max

    -- (same logic for hum_min / hum_max)

    -- Step 2: Apply mode changes
    IF message has heater_mode:
        state.heater_mode = message.heater_mode
    IF message has fogger_mode:
        state.fogger_mode = message.fogger_mode

    -- Step 3: Apply manual on/off commands (only honoured in manual mode)
    IF state.heater_mode == "manual" AND message has heater_on:
        state.heater_on = message.heater_on
    IF state.fogger_mode == "manual" AND message has fogger_on:
        state.fogger_on = message.fogger_on

    RETURN state
```

## 10. Firmware Configuration

### 10.1 Compile-Time Secrets

| File              | Contents                                          | Version Control       |
|-------------------|---------------------------------------------------|-----------------------|
| `secrets.h`       | WiFi SSID, WiFi password, client cert, client key | Excluded (.gitignore) |
| `certificates.h`  | CA trust anchor                                   | Excluded (.gitignore) |

### 10.2 Named Constants

The following are defined as named constants at the top of the main
source file:

| Constant            | Description                        | Example Value       |
|---------------------|------------------------------------|---------------------|
| `DEVICE_ID`         | Unique device identifier           | `"mycarium-1"`      |
| `MQTT_BROKER_HOST`  | Broker hostname or IP              | `"mqtt.example.com"`|
| `MQTT_BROKER_PORT`  | Broker port                        | `8883`              |
| `NTP_PRIMARY`       | Primary NTP server                 | `"pool.ntp.org"`    |
| `NTP_FALLBACK`      | Fallback NTP server                | `"time.nist.gov"`   |
| `POLL_INTERVAL_SEC` | Sensor polling frequency           | `30`                |
| `STATUS_EXPIRY`     | MQTT message expiry (seconds)      | `90`                |

### 10.3 Build Toolchain

The firmware compiles and flashes to a generic ESP32-WROOM-32 dev board
using the ESP-IDF toolchain with Rust (via `esp-idf-hal` / `esp-idf-svc`
or equivalent Rust ESP32 crate ecosystem).

## 11. Out of Scope

**Over-the-air (OTA) updates.** Updating firmware without physical
access. Excluded because the initial deployment uses a single device with
direct USB access. Extension point: the ESP-IDF OTA partition scheme and
MQTT control topic can deliver update URLs in a future spec revision.

**Device provisioning / onboarding.** A guided flow for configuring WiFi
credentials and registering with the broker on first boot. Excluded
because the current approach compiles credentials at build time. Extension
point: a captive-portal provisioning mode triggered by a GPIO button or
a BLE-based setup flow.

**Camera or additional sensors.** Stretch-goal hardware like a camera
module. Excluded from this development round. Extension point: the status
message schema and control message schema can be extended with new fields
for additional sensor types.

**Persistent on-device configuration storage.** Saving thresholds or
mode to NVS so they survive a reboot. Currently, the device boots with
compiled defaults and receives configuration from the broker. Extension
point: ESP-IDF NVS API to persist last-known-good configuration.

## 12. Design Decision Rationale

**Why mutual TLS instead of username/password authentication?** mTLS
provides strong device identity without transmitting credentials over
the wire. Each device's certificate CN doubles as its MQTT client ID
and username, eliminating a separate credential store. The tradeoff is
more complex certificate management, which is handled by the server
infrastructure.

**Why ESP-IDF with Rust instead of the Arduino framework?** MQTT v5
is required for features like message expiry intervals. There are no
Arduino libraries with reliable MQTT v5 support on ESP32. The ESP-IDF
toolchain, accessed via the Rust `esp-idf-svc` ecosystem, provides
full MQTT v5 support through the underlying ESP-MQTT library. Rust
adds memory safety without a runtime cost, which matters on a
constrained device.

**Why compile secrets into firmware instead of runtime provisioning?**
For a single-device prototype, compile-time secrets are simpler and
avoid the complexity of a provisioning flow. This decision should be
revisited when multiple devices need to be onboarded.

**Why min/max thresholds instead of a single setpoint with deadband?**
Min/max thresholds map directly to the user's mental model ("keep
temperature between X and Y") and make the hysteresis behavior explicit
in the status message, so the companion app can display meaningful
threshold bands on graphs.

**Why skip the cycle on a failed sensor read instead of using the last
known value?** Actuating based on stale data risks overshooting
thresholds. A skipped cycle (30 seconds) is a small gap; sustained
sensor failure is a hardware problem that should be diagnosed, not
masked.

## 13. Definition of Done

- [x] BME280 is detected at boot on either I2C pin ordering (21/22 or 22/21)
- [x] Boot halts with a serial error if BME280 is not detected on any pin combination
- [x] Both relays are initialized to OFF on boot
- [x] WiFi connects on boot with exponential backoff on failure
- [x] WiFi automatically reconnects after disconnection without reboot
- [x] NTP syncs before any TLS handshake or sensor read
- [x] MQTT connects over mTLS on port 8883 with device ID as client ID
- [x] MQTT subscribes to `mycarium/control/<device-id>` on connection
- [x] MQTT reconnects automatically after disconnection with retry delay
- [x] Connection failures are logged with descriptive reason codes
- [x] Sensor is polled every 30 seconds (configurable)
- [x] Status message is published as compact JSON with all fields from Section 7.2
- [ ] Status message includes MQTT v5 message expiry interval
- [x] Failed sensor reads skip the cycle with no publish and no actuation
- [x] Heater turns ON when temperature < temp_min (auto mode)
- [x] Heater turns OFF when temperature > temp_max (auto mode)
- [x] Fogger turns ON when humidity < hum_min (auto mode)
- [x] Fogger turns OFF when humidity > hum_max (auto mode)
- [x] Hysteresis: device turned on at min does not turn off until reading > max
- [x] No actuator toggles more than once per cycle
- [x] Default thresholds: temp 23.9-27.8 C, humidity 85-92%
- [x] Manual mode: actuator state set by control message, not overridden by thresholds
- [x] Manual-to-auto transition hands control to threshold logic immediately
- [x] Control messages with max <= min thresholds are rejected
- [x] Absent fields in control messages leave current config unchanged
- [x] Malformed JSON control messages are discarded with serial log
- [x] Secrets are in `secrets.h` / `certificates.h`, excluded from version control
- [x] Named constants are defined at the top of the main source file
- [x] Firmware compiles and flashes to ESP32-WROOM-32 via ESP-IDF with Rust
- [x] Integration: device boots, connects WiFi, syncs NTP, connects MQTT, publishes status, receives and applies a control message, and reflects the new state in the next published status message
