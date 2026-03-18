# Mycarium Client App

The mycarium client app is a Progressive Web App (PWA) that allows
authenticated users to monitor and control their mycarium devices from a
browser or mobile home screen. It connects to the MQTT broker directly
over WebSockets (WSS) for real-time data, and to a server REST API for
historical data and account management.

The app is intended for home mushroom growers who want to check on their
mycarium from their phone, adjust climate settings, and receive alerts
when something goes wrong. It is also intended for coding agents tasked
with implementing the app from this specification.

---

- [1. Problem Statement](#1-problem-statement)
- [2. Design Principles](#2-design-principles)
- [3. Layering and Scope](#3-layering-and-scope)
- [4. Architecture Overview](#4-architecture-overview)
- [5. Authentication](#5-authentication)
- [6. Device Ownership](#6-device-ownership)
- [7. Real-Time Monitoring](#7-real-time-monitoring)
- [8. Historical Data](#8-historical-data)
- [9. Device Control](#9-device-control)
- [10. Notifications and Alerts](#10-notifications-and-alerts)
- [11. Out of Scope](#11-out-of-scope)
- [12. Design Decision Rationale](#12-design-decision-rationale)
- [13. Definition of Done](#13-definition-of-done)

---

## 1. Problem Statement

A mycarium device publishes sensor data and accepts control commands over
MQTT, but MQTT is a machine-to-machine protocol with no user interface.
Without a client app, a grower cannot check conditions, adjust
thresholds, or respond to problems without connecting to the broker
manually with a CLI tool.

The client app provides a human interface to the mycarium system: a live
dashboard, historical graphs, and controls that translate user intent
into MQTT control messages.

---

## 2. Design Principles

**Real-time by default.** The primary view is always live. The user
should see current conditions without pulling to refresh. Historical
data is a secondary view.

**Offline-tolerant, not offline-first.** The app requires a network
connection to function (it talks to a live MQTT broker and a server
API). But it should degrade gracefully: show the last known state with
a clear "offline" indicator rather than crashing or showing a blank
screen.

**Minimal friction to monitor.** Opening the app and seeing the current
state of all devices should require zero taps beyond launching it.
Control actions (changing thresholds, switching modes) are secondary
and may require deliberate interaction.

**Client-certificate authentication to the broker.** The app authenticates
to the MQTT broker using the same mTLS mechanism as the devices
themselves. The user's client certificate is delivered after login and
used to establish the WSS connection.

**Multi-device from day one.** Even though the first deployment has one
mycarium, the data model and UI support multiple devices per user from
the start. This avoids a disruptive refactor when a second device is
added.

---

## 3. Layering and Scope

This spec covers the client-side PWA. It includes:

- User authentication (register, login, session management)
- Device ownership (claiming, naming, removing devices)
- Real-time monitoring via MQTT over WSS
- Historical data display via server API
- Device control (thresholds, modes, standby)
- Notifications for device problems

This spec does **not** cover:

- The MQTT broker or its configuration (see `mycarium-server.nlspec.md`)
- The server-side REST API implementation (see `mycarium-server.nlspec.md`)
  — this spec defines the **client's expectations** of that API
- The sensor firmware (see `mycarium-firmware.nlspec.md`)
- Push notification infrastructure (APNs, FCM, web push)

Hard dependencies:

- **MQTT broker** accepting WSS connections on port 8083 with mTLS
- **Server API** providing: user registration/login, client certificate
  issuance, device ownership management, historical sensor data queries

---

## 4. Architecture Overview

### 4.1 Communication Paths

The app has two communication paths:

1. **MQTT over WSS (port 8083):** Real-time sensor data and control
   commands. The app connects directly to the broker, subscribes to
   status topics, and publishes to control topics.

2. **Server REST API (HTTPS):** Authentication, device ownership, and
   historical data. The app authenticates with a session token and
   makes standard HTTP requests.

### 4.2 Data Flow

FUNCTION app_lifecycle:
    -- Step 1: Authenticate
    session = login(email, password)
    -- session includes: token, client_cert, client_key

    -- Step 2: Load user's devices
    devices = api_get("/devices", token=session.token)

    -- Step 3: Connect to MQTT broker over WSS
    mqtt = connect_wss(broker_host, 8083, session.client_cert, session.client_key)

    -- Step 4: Subscribe to status topics for all devices
    FOR EACH device IN devices:
        mqtt.subscribe("mycarium/status/{device.id}")

    -- Step 5: Enter real-time loop
    ON mqtt_message(topic, payload):
        device_id = extract_device_id(topic)
        update_dashboard(device_id, parse(payload))

---

## 5. Authentication

### 5.1 Registration

A new user registers with an email address and password. On successful
registration, the server:

- Creates the user account
- Generates a client certificate with the user's ID as the CN, signed
  by the system CA
- Returns a session token, the client certificate, and the client key

### 5.2 Login

A returning user logs in with email and password. On successful login,
the server returns the same bundle: session token, client certificate,
and client key.

### 5.3 Session Management

RECORD Session:
    token       : String    -- bearer token for API requests
    client_cert : String    -- PEM-encoded client certificate
    client_key  : String    -- PEM-encoded client private key
    expires_at  : Integer   -- UTC Unix timestamp

- The session persists across browser restarts (stored in a secure,
  httpOnly-equivalent local mechanism) until explicitly logged out or
  the token expires.
- Unauthenticated users cannot access any app functionality beyond the
  login and registration screens.
- The client certificate and key are stored alongside the session token
  and used to establish WSS connections to the broker.

---

## 6. Device Ownership

### 6.1 Claiming a Device

A user claims a device by entering its device ID (e.g. `mycarium-1`).

FUNCTION claim_device(device_id, token):
    response = api_post("/devices", body={device_id}, token=token)
    IF response.status == 201:
        RETURN Device(id=device_id, status="pending", name=null)
    IF response.status == 409:
        show_error("This device is already claimed")

-- Behavior:
-- - A newly claimed device is in "pending" status until the server
--   confirms that a status message has been received from that device ID.
-- - Once confirmed, the device transitions to "active" status.

### 6.2 Device Properties

RECORD Device:
    id          : String    -- device ID (e.g. "mycarium-1")
    status      : String    -- "pending" or "active"
    name        : String?   -- user-assigned human-readable name

- Only the owning user can view or control a given device.
- A user can assign a human-readable name (e.g. "Basement Mycarium")
  that is displayed in the app in place of the device ID.
- A user can remove a device from their account. This removes only the
  ownership association; it does not affect the physical device or its
  MQTT activity.

---

## 7. Real-Time Monitoring

### 7.1 MQTT Connection

The app connects to the MQTT broker over WSS (port 8083) using the
user's client certificate for mTLS. It subscribes to
`mycarium/status/<device-id>` for each of the user's claimed devices.

On WSS disconnection, the app automatically reconnects using the same
credentials.

### 7.2 Dashboard Display

For each device, the dashboard displays:

| Data Point              | Source Field     | Update Trigger            |
|-------------------------|------------------|---------------------------|
| Current temperature     | `temp_c`, `temp_f` | Each MQTT status message |
| Current humidity        | `humidity`       | Each MQTT status message   |
| Heater state (on/off)   | `heater_on`      | Each MQTT status message  |
| Fogger state (on/off)   | `fogger_on`      | Each MQTT status message  |
| Heater mode (auto/manual) | `heater_mode`  | Each MQTT status message  |
| Fogger mode (auto/manual) | `fogger_mode`  | Each MQTT status message  |
| Configured thresholds   | `temp_min`, `temp_max`, `hum_min`, `hum_max` | Each MQTT status message |

### 7.3 Offline Detection

If a device has not published a status message within 2x the polling
interval (default: 60 seconds), the app displays it as "offline" or
"not responding."

FUNCTION check_device_liveness(device, last_message_time, now):
    IF now - last_message_time > 2 * POLL_INTERVAL_SEC:
        device.display_status = "offline"
    ELSE:
        device.display_status = "online"

---

## 8. Historical Data

### 8.1 Graph Display

Temperature and humidity over time are displayed as line graphs. The
user can select a time range:

| Range Label  | Duration |
|-------------|----------|
| Last hour   | 1 hour   |
| Last 24h    | 24 hours |
| Last 7d     | 7 days   |
| Last 30d    | 30 days  |

### 8.2 Data Source

Historical data is fetched from the server REST API, not from MQTT.

FUNCTION fetch_history(device_id, time_range, token):
    response = api_get(
        "/devices/{device_id}/history",
        params={from: time_range.start, to: time_range.end},
        token=token
    )
    RETURN response.data  -- array of {ts, temp_c, humidity, heater_on, fogger_on}

### 8.3 Actuator Event Overlay

Heater and fogger activation events are optionally overlaid on the
temperature and humidity graphs as shaded regions or markers, showing
when each actuator was on.

---

## 9. Device Control

### 9.1 Threshold Editing

The user can view and edit the min/max thresholds for temperature and
humidity. Changes are validated client-side before sending:

FUNCTION validate_thresholds(min_val, max_val):
    IF max_val <= min_val:
        show_error("Maximum must be greater than minimum")
        RETURN false
    RETURN true

### 9.2 Publishing Control Messages

Threshold updates and mode changes are published as MQTT control
messages to `mycarium/control/<device-id>`. The message follows the
control message schema defined in the sensor firmware spec.

FUNCTION send_control(device_id, changes, mqtt):
    -- changes is a partial ControlMessage with only the modified fields
    mqtt.publish(
        topic="mycarium/control/{device_id}",
        payload=json_encode(changes)
    )

### 9.3 Mode Switching

- The user can switch the heater and fogger independently between auto
  and manual mode.
- In manual mode, the user can turn the heater or fogger on or off
  directly via toggle controls.
- Mode switches and manual on/off commands are sent as control messages.

### 9.4 Standby Mode

The user can put a device into standby mode. Standby:

- Switches both heater and fogger to manual mode with both set to OFF
- Does not modify the configured thresholds
- Is visually distinct in the UI (e.g. grayed out, "Standby" badge)
- Can be exited by resuming auto mode, which restores threshold-based
  control immediately

FUNCTION enter_standby(device_id, mqtt):
    send_control(device_id, {
        heater_mode: "manual",
        fogger_mode: "manual",
        heater_on: false,
        fogger_on: false
    }, mqtt)

FUNCTION exit_standby(device_id, mqtt):
    send_control(device_id, {
        heater_mode: "auto",
        fogger_mode: "auto"
    }, mqtt)

### 9.5 Feedback Loop

All control actions give immediate visual feedback in the UI (e.g.
optimistic update, spinner, or pending state). The actual confirmed
state is reflected when the next status message is received from the
device via MQTT.

---

## 10. Notifications and Alerts

The app alerts the user when a device needs attention:

| Condition                      | Alert                                      |
|--------------------------------|--------------------------------------------|
| Device offline (no status for 2x poll interval) | "Device not responding" warning |
| Temperature outside thresholds | "Temperature out of range" alert           |
| Humidity outside thresholds    | "Humidity out of range" alert              |

Alerts are displayed in-app. Push notifications (web push, APNs, FCM)
are out of scope for this version but the alert conditions defined above
serve as the trigger points for a future notification system.

---

## 11. Out of Scope

**Push notifications.** Delivering alerts when the app is not open.
Excluded because it requires server-side push infrastructure (web push,
APNs/FCM). Extension point: the alert conditions in Section 10 define
when notifications should fire; a future spec adds the delivery
mechanism.

**Native mobile app.** Building platform-specific iOS/Android apps.
Excluded because a PWA provides cross-platform reach with a single
codebase. Extension point: the app is structured as a PWA that can be
wrapped with Capacitor or similar if native capabilities are needed
later.

**Multi-user device sharing.** Allowing multiple users to monitor or
control the same device. Excluded to keep the ownership model simple.
Extension point: the device ownership API can be extended with
invite/share flows and role-based permissions.

**Camera or media streaming.** Displaying a live camera feed from the
mycarium. Excluded from this development round. Extension point: a
future device type with a camera sensor can publish a stream URL in its
status message, and the app can embed a video player.

**Internationalization / localization.** The app is English-only.
Extension point: standard i18n tooling can be layered on top of the
existing string literals.

**Temperature unit preference.** The firmware publishes both Celsius and
Fahrenheit. A user preference for display units can be added later.
Extension point: a user settings API and a client-side display toggle.

---

## 12. Design Decision Rationale

**Why a PWA instead of a native app or Tauri hybrid?** A PWA is
installable on both mobile and desktop, requires no app store, and can
establish WSS connections for real-time MQTT data. The tradeoff is
limited access to native APIs (e.g. background execution for push
notifications), but the core monitoring and control flows do not require
native capabilities.

**Why connect to MQTT directly from the browser instead of proxying
through the server API?** Direct WSS connection gives true real-time
updates with no additional server load or latency. The broker already
supports WSS with mTLS. The tradeoff is that the client certificate must
be delivered to the browser, which is handled via the login flow.

**Why fetch historical data from the API instead of MQTT retained
messages?** MQTT retained messages only preserve the last message per
topic, not a time series. The server persistence service writes all
messages to a database that can be queried by device and time range,
which is what the graph views need.

**Why is standby implemented as manual-mode-off rather than a separate
device state?** The firmware already supports manual mode with explicit
on/off control. Standby is a UI concept that maps directly to "both
actuators in manual mode, both off." This avoids adding a new state to
the firmware protocol.

---

## 13. Definition of Done

### Authentication

- [x] Users can register with email and password
- [x] Users can log in and receive a session token, client cert, and client key
- [x] Unauthenticated users see only the login/register screen
- [x] Sessions persist across browser restarts until logout or token expiry

### Device Ownership

- [x] Users can claim a device by entering its device ID
- [x] Newly claimed devices appear in "pending" state
- [x] Devices transition to "active" when the server confirms status messages are being received
- [x] Only the owning user can view or control a device
- [x] Users can remove a device from their account
- [x] Users can assign a human-readable name to a device

### Real-Time Monitoring

- [x] App connects to MQTT broker over WSS with mTLS using the user's client certificate
- [x] App subscribes to status topics for all claimed devices
- [x] Dashboard displays current temperature, humidity, heater/fogger state, and mode
- [x] Dashboard updates in real time as MQTT messages arrive
- [x] Devices with no status message in 2x poll interval are shown as "offline"
- [x] WSS connection re-establishes automatically after disconnection

### Historical Data

- [x] Temperature and humidity displayed as line graphs
- [x] User can select time range: last hour, 24h, 7d, 30d
- [x] Graph data is fetched from server API
- [x] Heater/fogger events can be overlaid on graphs

### Device Control

- [x] User can view and edit temperature thresholds (max > min validated)
- [x] User can view and edit humidity thresholds (max > min validated)
- [x] Threshold changes are published as MQTT control messages
- [x] User can switch heater and fogger between auto and manual mode
- [x] In manual mode, user can toggle heater/fogger on/off
- [x] Standby mode sets both actuators to manual-off without changing thresholds
- [x] Exiting standby restores auto mode
- [x] All control actions give immediate visual feedback
- [x] Confirmed state reflects the next device status message

### Notifications

- [x] In-app alert when device is offline
- [x] In-app alert when temperature is out of configured range
- [x] In-app alert when humidity is out of configured range

### Integration

- [ ] End-to-end: user logs in, sees claimed device on dashboard, device publishes status, dashboard updates in real time, user changes a threshold, device receives control message and reflects new state in next status message
