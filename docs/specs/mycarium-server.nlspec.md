# Mycarium Server Infrastructure

The mycarium server is the central hub that brokers communication between
mycarium sensor devices and the client app. It runs on a DigitalOcean
Droplet with Ubuntu Server and hosts three services: an MQTT broker
(Mosquitto), a message persistence service, and a REST API for
authentication, device ownership, and historical data queries.

This spec is intended for developers or coding agents deploying and
maintaining the server infrastructure, and for authors of the companion
specs (`mycarium-firmware.nlspec.md`, `mycarium-app.nlspec.md`) who need
to understand the contracts the server provides.

---

- [1. Problem Statement](#1-problem-statement)
- [2. Design Principles](#2-design-principles)
- [3. Layering and Scope](#3-layering-and-scope)
- [4. MQTT Broker](#4-mqtt-broker)
- [5. Certificate Management](#5-certificate-management)
- [6. Message Persistence Service](#6-message-persistence-service)
- [7. REST API](#7-rest-api)
- [8. Deployment and Operations](#8-deployment-and-operations)
- [9. Out of Scope](#9-out-of-scope)
- [10. Design Decision Rationale](#10-design-decision-rationale)
- [11. Definition of Done](#11-definition-of-done)

---

## 1. Problem Statement

Mycarium devices and the client app need a way to exchange messages in
real time. Devices publish sensor data; the app subscribes to it. The
app publishes control commands; devices subscribe to them. Neither party
can reach the other directly — the device is behind a home NAT, and the
app runs in a browser.

The server solves this by hosting an MQTT broker that both parties
connect to, a persistence layer that stores message history for the
app's graph views, and an API that manages user accounts, device
ownership, and certificate issuance.

---

## 2. Design Principles

**mTLS everywhere.** Every connection to the broker — device, app, or
internal service — authenticates with a client certificate signed by
the system CA. No anonymous access, no password files, no plaintext
listeners.

**Certificate identity is the identity.** The CN in a client certificate
is the MQTT username and client ID. There is no separate identity layer
for MQTT. This keeps the broker configuration stateless with respect to
user accounts.

**Minimal moving parts.** Mosquitto is a single binary with a flat config
file. The persistence service is a single long-running process. The API
is a single service. No container orchestration, no message queues
beyond MQTT itself.

**Retention by default.** Sensor data is written to a database
automatically. A configurable retention policy prevents unbounded growth.
Historical data is a first-class feature, not an afterthought.

**Secure defaults.** TLS 1.2 minimum. Restrictive file permissions on
keys and certificates. No debug listeners left open. Logs are written
but do not contain secrets.

---

## 3. Layering and Scope

This spec covers the server-side infrastructure. It includes:

- Mosquitto MQTT broker configuration (TLS, WSS, mTLS, ACLs)
- Self-signed CA and certificate lifecycle
- Message persistence service (MQTT subscriber to database writer)
- REST API for authentication, device ownership, and historical data
- Deployment and operational concerns (systemd, logs, retention)

This spec does **not** cover:

- The sensor firmware (see `mycarium-firmware.nlspec.md`)
- The client app (see `mycarium-app.nlspec.md`)
- DNS, domain registration, or CDN configuration
- Firewall rules beyond what is needed for the services defined here

The server provides contracts consumed by:

- **Sensor firmware:** MQTT broker on port 8883, mTLS, topics
  `mycarium/status/<device-id>` and `mycarium/control/<device-id>`
- **Client app:** MQTT broker on port 8083 (WSS, mTLS), REST API over
  HTTPS for auth, device management, and historical data

---

## 4. MQTT Broker

### 4.1 Installation

Mosquitto is installed from the official Mosquitto PPA, not the default
Ubuntu repository (which ships an outdated version lacking full MQTT v5
and WSS support). It runs as a systemd service that starts automatically
on boot.

### 4.2 Listeners

The broker exposes two listeners:

| Listener | Port | Protocol   | Purpose                          |
|----------|------|------------|----------------------------------|
| TLS      | 8883 | MQTT + TLS | ESP32 devices, native clients    |
| WSS      | 8083 | WebSocket + TLS | Browser-based client app    |

Both listeners require mutual TLS. Anonymous connections are rejected on
all listeners.

### 4.3 TLS Configuration

| Parameter                 | Value                                        |
|---------------------------|----------------------------------------------|
| Minimum TLS version       | 1.2                                          |
| CA certificate            | Self-signed CA (see Section 5)               |
| Server certificate        | x509v3, SAN covers FQDN and IP              |
| Server private key        | RSA or ECDSA, stored with restrictive perms  |
| `require_certificate`     | `true`                                       |
| `use_identity_as_username`| `true`                                       |
| `use_username_as_clientid`| `true`                                       |

Certificate files are stored in `/etc/mosquitto/certs/<fqdn>/` with
permissions restricting read access to the mosquitto user.

TLS 1.1 is explicitly not used; 1.2 is the minimum.

### 4.4 Authentication Model

There is no password file. The CN from the client certificate serves as
both MQTT username and client ID via the `use_identity_as_username` and
`use_username_as_clientid` directives. This means:

- A device with CN `mycarium-1` connects as client ID `mycarium-1`
- A user with CN `user-42` connects as client ID `user-42`
- The persistence service with CN `persistence-service` connects as
  client ID `persistence-service`

### 4.5 Logging

Broker logs are written to `/var/log/mosquitto/mosquitto.log` with
`log_type all`. The broker can be started, stopped, restarted, and
status-checked via standard systemd commands (`systemctl start|stop|restart|status mosquitto`).

### 4.6 Topic Structure

| Topic Pattern                      | Publisher            | Subscriber(s)                |
|------------------------------------|----------------------|------------------------------|
| `mycarium/status/<device-id>`      | Sensor device        | Client app, persistence svc  |
| `mycarium/control/<device-id>`     | Client app           | Sensor device                |

---

## 5. Certificate Management

### 5.1 Certificate Authority

A self-signed CA has been created with the following properties:

| Property       | Value                                          |
|----------------|------------------------------------------------|
| CN             | Server FQDN                                    |
| Key type       | RSA 4096 or ECDSA P-256                        |
| CA key password| Protected (not stored in version control)      |
| Generated with | OpenSSL 3.x or later                           |

### 5.2 Server Certificate

The server certificate is an x509v3 certificate (not v1) with:

- A `subjectAltName` (SAN) extension covering the server's FQDN and IP
  address
- Signed by the self-signed CA
- Generated with OpenSSL 3.x or later

### 5.3 Client Certificates

Each client (device or user) has its own certificate with:

- The intended username/device-id as the CN
- Signed by the CA
- No password on the client private key
- Generated with OpenSSL 3.x or later

### 5.4 Certificate Issuance Process

There is a documented, repeatable process for issuing new client
certificates:

FUNCTION issue_client_certificate(client_id, ca_cert, ca_key):
    -- Step 1: Generate client private key (no password)
    client_key = generate_rsa_key(bits=2048)

    -- Step 2: Create CSR with client_id as CN
    csr = create_csr(key=client_key, cn=client_id)

    -- Step 3: Sign CSR with CA
    client_cert = sign_csr(csr, ca_cert, ca_key, days=365)

    RETURN (client_cert, client_key)

-- Behavior:
-- - The CA key password is required to sign.
-- - The output is a PEM-encoded certificate and key pair.
-- - For devices, these are compiled into firmware (see firmware spec).
-- - For users, these are stored server-side and delivered via the API
--   on login (see Section 7.2).

---

## 6. Message Persistence Service

### 6.1 Overview

A long-running service on the server subscribes to `mycarium/status/#`
using a service-account client certificate (CN: `persistence-service`).
It parses each incoming status message and writes it to a database.

### 6.2 MQTT Subscription

The service connects to the broker using the same mTLS mechanism as any
other client. It subscribes to the wildcard topic `mycarium/status/#` to
capture status messages from all devices.

### 6.3 Data Written Per Message

Each received status message is parsed and written with at minimum:

RECORD PersistedReading:
    device_id   : String    -- extracted from topic
    ts          : Integer   -- UTC Unix timestamp from message payload
    temp_c      : Float     -- temperature in Celsius
    humidity    : Float     -- relative humidity (%)
    heater_on   : Boolean   -- heater state
    fogger_on   : Boolean   -- fogger state

### 6.4 Lifecycle

- The persistence service starts automatically on boot (systemd service)
- It reconnects to the broker automatically on disconnection
- Malformed messages are logged and skipped; they do not crash the service

### 6.5 Retention Policy

The database does not grow unbounded. A retention policy drops records
older than a configurable threshold.

| Parameter             | Default Value |
|-----------------------|---------------|
| `RETENTION_DAYS`      | 90            |

The retention job runs on a regular schedule (e.g. daily) and deletes
records where `ts` is older than `now - RETENTION_DAYS`.

---

## 7. REST API

### 7.1 Overview

The REST API serves the client app over HTTPS. It handles:

- User registration and login
- Client certificate issuance (bundled with login response)
- Device ownership management
- Historical sensor data queries

### 7.2 Authentication Endpoints

FUNCTION POST /auth/register(email, password):
    -- Step 1: Create user account
    user = create_user(email, hash(password))

    -- Step 2: Issue client certificate for the user
    (cert, key) = issue_client_certificate(user.id, ca_cert, ca_key)
    store_cert(user.id, cert, key)

    -- Step 3: Create session
    token = create_session(user.id)

    RETURN {token, client_cert: cert, client_key: key}

FUNCTION POST /auth/login(email, password):
    user = authenticate(email, password)
    IF user is null:
        RETURN 401 Unauthorized

    token = create_session(user.id)
    (cert, key) = get_stored_cert(user.id)

    RETURN {token, client_cert: cert, client_key: key}

-- Behavior:
-- - The client certificate and key are returned on both register and
--   login so the app can connect to the MQTT broker over WSS.
-- - Sessions expire after a configurable duration.

### 7.3 Device Ownership Endpoints

FUNCTION GET /devices(token):
    user = authenticate_token(token)
    RETURN list of devices owned by user

FUNCTION POST /devices(token, body={device_id}):
    user = authenticate_token(token)
    IF device_id is already claimed:
        RETURN 409 Conflict
    device = create_ownership(user.id, device_id, status="pending")
    RETURN 201 Created, device

FUNCTION PATCH /devices/{device_id}(token, body={name}):
    user = authenticate_token(token)
    IF user does not own device_id:
        RETURN 403 Forbidden
    update_device(device_id, name=body.name)
    RETURN 200 OK

FUNCTION DELETE /devices/{device_id}(token):
    user = authenticate_token(token)
    IF user does not own device_id:
        RETURN 403 Forbidden
    remove_ownership(user.id, device_id)
    RETURN 204 No Content

-- Behavior:
-- - A newly claimed device starts in "pending" status.
-- - The device transitions to "active" when the persistence service
--   has recorded at least one status message from that device ID.
-- - Removing a device only deletes the ownership record; it does not
--   affect the physical device or its MQTT activity.

### 7.4 Device Status Transition

FUNCTION check_device_activation:
    -- Runs periodically or is triggered on new persisted messages
    FOR EACH device IN devices WHERE status == "pending":
        IF persistence_has_readings(device.device_id):
            device.status = "active"

### 7.5 Historical Data Endpoint

FUNCTION GET /devices/{device_id}/history(token, from, to):
    user = authenticate_token(token)
    IF user does not own device_id:
        RETURN 403 Forbidden
    readings = query_readings(device_id, from_ts=from, to_ts=to)
    RETURN readings  -- array of PersistedReading

-- Behavior:
-- - `from` and `to` are UTC Unix timestamps.
-- - Returns readings ordered by timestamp ascending.
-- - If the range exceeds available data, returns whatever is available.

---

## 8. Deployment and Operations

### 8.1 Host Environment

| Property         | Value                              |
|------------------|------------------------------------|
| Provider         | DigitalOcean                       |
| OS               | Ubuntu Server (LTS)                |
| Services         | Mosquitto, persistence svc, API    |
| Init system      | systemd                            |

### 8.2 Service Management

All three services (Mosquitto, persistence, API) are managed by systemd
and start automatically on boot. Each can be independently started,
stopped, restarted, and status-checked.

### 8.3 Firewall Ports

| Port  | Protocol | Service                    |
|-------|----------|----------------------------|
| 8883  | TCP      | MQTT over TLS              |
| 8083  | TCP      | MQTT over WSS              |
| 443   | TCP      | REST API (HTTPS)           |
| 22    | TCP      | SSH (admin access)         |

### 8.4 Log Locations

| Service             | Log Location                           |
|---------------------|----------------------------------------|
| Mosquitto           | `/var/log/mosquitto/mosquitto.log`     |
| Persistence service | systemd journal / application log      |
| REST API            | systemd journal / application log      |

---

## 9. Out of Scope

**High availability / clustering.** Running multiple broker or API
instances behind a load balancer. Excluded because the system serves a
single household with low throughput. Extension point: Mosquitto
supports bridging; the API can be placed behind a reverse proxy.

**Automated certificate renewal.** Certificates are issued manually via
the process in Section 5.4. Excluded because the number of devices and
users is small. Extension point: an admin endpoint or cron job that
re-signs certificates approaching expiry.

**ACL / topic-level authorization.** Restricting which clients can
publish or subscribe to which topics. Currently, any authenticated
client can access any topic. Excluded to keep the broker config simple
for a single-household deployment. Extension point: Mosquitto supports
ACL files and dynamic security plugins that can enforce per-user topic
restrictions.

**Push notifications.** Server-initiated notifications to mobile devices
when alerts trigger. Excluded because it requires FCM/APNs integration.
Extension point: the persistence service already processes every status
message and could evaluate alert conditions and dispatch notifications.

**Admin dashboard.** A web interface for managing users, devices, and
certificates. Excluded because these operations are infrequent and can
be done via CLI. Extension point: the REST API already provides the data
endpoints; an admin UI would be a thin frontend layer.

**Database choice.** This spec does not prescribe a specific database.
PostgreSQL, SQLite, or TimescaleDB are all reasonable choices. The
persistence service and API need a store that supports insert, query by
device and time range, and delete by age.

---

## 10. Design Decision Rationale

**Why Mosquitto instead of a cloud-managed MQTT broker?** Mosquitto is
lightweight, well-documented, and runs on a single small VPS. A
cloud-managed broker (AWS IoT Core, HiveMQ Cloud) adds cost and vendor
lock-in for a system that serves one household. The tradeoff is that
the operator manages TLS certificates and uptime.

**Why a self-signed CA instead of Let's Encrypt?** Let's Encrypt
certificates are for server identity, not client identity. The mycarium
system needs mutual TLS where both the broker and every client
(device, app, service) present certificates. A self-signed CA allows
issuing both server and client certificates from a single trust root.

**Why `use_identity_as_username` instead of a password file?** The
client certificate already proves identity. Adding a password file
creates a second source of truth that must be kept in sync with
certificate issuance. Using the certificate CN as the username
eliminates this duplication.

**Why a separate persistence service instead of Mosquitto's built-in
persistence?** Mosquitto's persistence stores retained messages and
session state, not a queryable time series. The companion app needs to
display historical graphs with time-range filters, which requires a
proper database with indexed queries.

**Why bundle the client certificate with the login response?** The
browser needs the certificate to establish a WSS+mTLS connection to the
broker. Delivering it on login avoids a separate provisioning step and
ties the certificate lifecycle to the user account. The tradeoff is
that the certificate transits over HTTPS, but the login response is
already a sensitive payload (it contains a session token).

---

## 11. Definition of Done

### MQTT Broker

- [ ] Mosquitto installed from official PPA (not default Ubuntu repo)
- [ ] Runs as systemd service, starts on boot
- [ ] TLS listener on port 8883 with mTLS required
- [ ] WSS listener on port 8083 with mTLS required
- [ ] Anonymous connections rejected on all listeners
- [ ] `use_identity_as_username` and `use_username_as_clientid` enabled
- [ ] Minimum TLS version is 1.2 (TLS 1.1 not accepted)
- [ ] Certificates stored in `/etc/mosquitto/certs/<fqdn>/` with restrictive permissions
- [ ] Logs written to `/var/log/mosquitto/mosquitto.log` with `log_type all`
- [ ] Broker starts, stops, restarts, and reports status via systemctl

### Certificate Management

- [ ] Self-signed CA created with server FQDN as CN, key password-protected
- [ ] Server certificate is x509v3 with SAN covering FQDN and IP, signed by CA
- [ ] Client certificates have client-id/username as CN, signed by CA, no password
- [ ] All certificates generated with OpenSSL 3.x or later
- [ ] Documented, repeatable process for issuing new client certificates

### Message Persistence

- [ ] Service subscribes to `mycarium/status/#` with service-account certificate
- [ ] Each status message parsed and written to database (device ID, ts, temp, humidity, heater, fogger)
- [ ] Service starts on boot (systemd) and reconnects to broker on disconnection
- [ ] Malformed messages logged and skipped without crashing
- [ ] Retention policy drops records older than configurable threshold (default 90 days)

### REST API

- [ ] User registration with email and password
- [ ] Login returns session token, client certificate, and client key
- [ ] Unauthenticated requests to protected endpoints return 401
- [ ] GET /devices returns user's devices
- [ ] POST /devices claims a device (pending status)
- [ ] PATCH /devices/{id} updates device name
- [ ] DELETE /devices/{id} removes ownership
- [ ] Pending devices transition to active when status messages are received
- [ ] GET /devices/{id}/history returns readings filtered by time range
- [ ] Only the owning user can access a device's data or controls (403 otherwise)

### Deployment

- [ ] All services run on DigitalOcean Droplet with Ubuntu Server
- [ ] Ports 8883, 8083, 443, 22 are open; all others closed
- [ ] All three services start on boot and can be managed independently

### Integration

- [ ] End-to-end: a device connects with its client certificate, publishes a status message, the persistence service writes it to the database, a user logs in via the API, claims the device, the device transitions to active, and the user queries historical data and receives the persisted reading
