# Mycarium Build Guide

Build your own climate-controlled mushroom terrarium with real-time monitoring and remote control. This guide walks through every step, from assembling the physical enclosure to deploying the cloud software. If you already know how to do something, skip ahead — each section is self-contained.

## Table of Contents

1. [Overview](#1-overview)
2. [Parts List](#2-parts-list)
3. [Enclosure Assembly](#3-enclosure-assembly)
4. [Electronics](#4-electronics)
5. [Server Setup](#5-server-setup)
6. [Firmware](#6-firmware)
7. [Web App (PWA)](#7-web-app-pwa)
8. [First Run](#8-first-run)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

Mycarium is an IoT system with three components:

- **Firmware** — An ESP32 microcontroller reads temperature and humidity from a BME280 sensor, controls a heater and fogger via relays, and publishes data over MQTT every 30 seconds.
- **Server** — A cloud server runs a Mosquitto MQTT broker, a persistence service that stores readings in SQLite, and a REST API for authentication and device management.
- **PWA** — A Progressive Web App provides a real-time dashboard, historical charts, threshold controls, and works as an installable app on your phone.

### How it works

```text
┌─────────────────┐      MQTT (TLS)      ┌──────────────────────┐
│   ESP32 Device   │ ──────────────────▸  │   Cloud Server       │
│  BME280 sensor   │                      │  Mosquitto broker    │
│  heater relay    │  ◂────────────────── │  Persistence service │
│  fogger relay    │    control messages  │  REST API            │
└─────────────────┘                      └──────────┬───────────┘
                                                    │ HTTPS + WSS
                                              ┌─────┴─────┐
                                              │  Browser   │
                                              │  PWA       │
                                              └───────────┘
```

The ESP32 publishes sensor readings and actuator state to the MQTT broker. The persistence service subscribes and writes each reading to SQLite. The browser connects via WebSocket to receive live updates and sends control messages (threshold changes, mode switches) back through MQTT to the device.

### What you'll need

- Basic comfort with a command line (terminal)
- A computer for development (Windows, macOS, or Linux)
- A cloud server or Raspberry Pi for hosting (this guide uses a DigitalOcean droplet running Ubuntu)
- A domain name pointed at your server (for HTTPS and MQTT TLS)
- Soldering is not required — all connections use jumper wires and breadboards

---

## 2. Parts List

### Enclosure

| Item | Purpose | Notes |
|------|---------|-------|
| Glass terrarium | Growing chamber | Any terrarium with a lid works. Larger = more stable humidity. Look for one with a front door for easy access. |
| Perlite or LECA | Humidity reservoir | Spread on the bottom, keeps moisture available for the fogger |
| Spray bottle | Initial moistening | For wetting the perlite before first use |

### Climate Control

| Item | Purpose | Notes |
|------|---------|-------|
| Ultrasonic fogger/mister | Humidity control | Small USB-powered disc foggers work well. Must fit inside the terrarium. |
| Seedling heat mat | Temperature control | Sized for your terrarium. Most are 10W-20W. Place under or behind the terrarium. |
| USB power supply | Powers the fogger | Match the fogger's requirements (usually 5V USB) |

**Alternatives:**

- Instead of a fogger, you could use a small humidifier with tubing routed into the terrarium
- Instead of a heat mat, you could use a ceramic heat emitter or an incandescent bulb (with appropriate safety precautions)
- For cooler climates, a small space heater on a smart plug can work, though it's less precise

### Electronics

| Item | Purpose | Approx. Cost |
|------|---------|-------------|
| ESP32-WROOM-32 dev board | Microcontroller | $5-10 |
| BME280 sensor breakout | Temperature + humidity sensing | $3-8 |
| 2-channel relay module (3.3V or 5V logic) | Switches heater and fogger on/off | $3-5 |
| Breadboard | Prototyping connections | $2-5 |
| Jumper wires (male-to-female) | Connecting components | $2-5 |
| Micro-USB cable | Powers the ESP32 and connects for flashing | $2-5 |
| USB power adapter (5V, 1A+) | Powers the ESP32 | $3-5 |

**Notes on component selection:**

- **ESP32-WROOM-32**: This is the classic ESP32. ESP32-S3 or ESP32-C3 would also work with minor firmware changes, but this guide assumes the WROOM-32. Do NOT use an ESP8266 — it lacks the processing power for TLS.
- **BME280**: Make sure you get a BME280, not a BMP280. The BMP280 measures only temperature and pressure — it cannot measure humidity. The BME280 does all three. They look identical, so check the listing carefully.
- **Relay module**: Get one rated for the voltage and current of your heater and fogger. Most relay modules have optoisolation (a good thing). Both 3.3V and 5V logic-level relays work with the ESP32.

### Server Infrastructure

| Item | Purpose | Notes |
|------|---------|-------|
| Cloud server (VPS) | Hosts MQTT broker, API, and web app | DigitalOcean, Linode, Hetzner, AWS Lightsail, etc. Minimum 1 GB RAM. |
| Domain name | HTTPS and MQTT TLS | Any registrar. You'll create an A record pointing to your server. |

**Alternatives:**

- A **Raspberry Pi** on your home network can replace the cloud server. You'll need to set up port forwarding or use a service like Tailscale/Cloudflare Tunnel for remote access.
- **Home Assistant** users could adapt the MQTT integration instead of running the custom server, though you'd lose the historical charts and PWA.

---

## 3. Enclosure Assembly

### 3.1 Prepare the terrarium

1. Clean the terrarium thoroughly and let it dry.
2. Spread a 2-3 cm (1 inch) layer of perlite or LECA on the bottom. This acts as a moisture reservoir.
3. Spray the perlite with water until it's damp but not pooling.

### 3.2 Place the heat mat

Position the heat mat under or behind the terrarium (not inside it). Heat mats are designed for indirect heating — placing them inside risks moisture damage and uneven temperatures.

- **Under**: Works well for smaller terrariums. The glass distributes heat evenly.
- **Behind**: Better for larger terrariums. Tape or prop the mat against the back glass.

### 3.3 Install the fogger

Place the ultrasonic fogger disc inside the terrarium, resting on the damp perlite. Route the USB power cable out through the lid or a gap in the door. The fogger needs to sit in or on moisture to produce fog — dry perlite won't work.

**Tip:** If your terrarium has a tight-fitting lid, you may need to drill or file a small notch for cables to pass through. A rubber grommet keeps things tidy.

### 3.4 Ventilation

Mushrooms need fresh air exchange (FAE). A fully sealed terrarium will build up CO2 and stall growth. Options:

- Leave the lid slightly cracked
- Drill small ventilation holes near the top
- Use a small computer fan on a timer for periodic air exchange

The current firmware does not control ventilation automatically, but the relay module has room for expansion.

### 3.5 Place your mushroom substrate

This guide doesn't cover mushroom cultivation in detail — there are excellent resources for that elsewhere. In brief:

- Fruiting blocks (pre-colonized substrate bags) are the easiest starting point
- Place them on a small rack or shelf above the perlite, not directly on it
- Different species have different temperature and humidity preferences — adjust the thresholds in the app accordingly

---

## 4. Electronics

### 4.1 Wiring diagram

```text
                    ESP32-WROOM-32
                   ┌──────────────┐
                   │              │
        BME280 ◂───┤ GPIO21 (SDA) │
        (I2C)  ◂───┤ GPIO22 (SCL) │
                   │              │
  Heater relay ◂───┤ GPIO12       │
  Fogger relay ◂───┤ GPIO13       │
                   │              │
        BME280 ◂───┤ 3V3          │
        + relay    │              │
           GND ◂───┤ GND          │
                   └──────────────┘
```

### 4.2 Connect the BME280 sensor

The BME280 communicates over I2C (a two-wire protocol). Connect it to the ESP32:

| BME280 Pin | ESP32 Pin | Wire Color (suggested) |
|-----------|----------|----------------------|
| VIN (or VCC) | 3V3 | Red |
| GND | GND | Black |
| SDA | GPIO 21 | Blue |
| SCL | GPIO 22 | Yellow |

**Notes:**

- Some BME280 boards label the pins differently (SDI instead of SDA, SCK instead of SCL). SDI = SDA, SCK = SCL.
- The firmware auto-detects if SDA and SCL are swapped, so don't worry if you mix them up — it will try both configurations.
- The BME280's default I2C address is 0x76. If your board uses 0x77 (check the listing), you'll need to change `BME280_ADDR` in the firmware source.

### 4.3 Connect the relay module

The relay module switches the heater and fogger on and off. Connect it to the ESP32:

| Relay Pin | ESP32 Pin | Purpose |
|----------|----------|---------|
| VCC | 3V3 (or 5V — check your relay module) | Power |
| GND | GND | Ground |
| IN1 | GPIO 12 | Heater control |
| IN2 | GPIO 13 | Fogger control |

Then wire the heater and fogger through the relay's switching contacts:

- **Heater**: Run the heat mat's power cable through Relay 1 (the COM and NO terminals). When the relay activates, it completes the circuit and the heat mat turns on.
- **Fogger**: Run the fogger's USB power cable through Relay 2 in the same way.

**Safety notes:**

- If your heater or fogger runs on mains voltage (120V/240V AC), use appropriate caution. The relay module must be rated for the voltage and current. Consider using a commercially-available smart plug instead, controlled by a separate relay or the ESP32's GPIO through an optoisolator.
- Most seedling heat mats and USB foggers run on low voltage (5V-12V DC), which is safe to switch with a standard relay module.
- Both relays start in the OFF position when the ESP32 boots.

### 4.4 Power the ESP32

Connect the ESP32 to a USB power adapter via a micro-USB cable. The ESP32 needs about 500mA at 5V. Any standard USB phone charger works.

### 4.5 Position the sensor

Place the BME280 sensor inside the terrarium where it can measure the air your mushrooms are experiencing. Avoid placing it:

- Directly above the fogger (condensation will affect readings)
- Touching the glass (reads wall temperature, not air temperature)
- Near the heat mat (reads radiant heat, not ambient air)

A good spot is at mushroom-height, in the center of the terrarium, attached to a small stake or clip.

**Tip:** The ESP32 board itself should stay outside or at the edge of the terrarium. High humidity can corrode electronics over time. Route the BME280's wires through the cable notch in the lid.

---

## 5. Server Setup

This section sets up the cloud infrastructure: a Linux server running Mosquitto (MQTT broker), the Mycarium persistence service and API, and Nginx as a reverse proxy with HTTPS.

> **Already have a server with Nginx and a domain?** Skip to [5.3 Install Mosquitto](#53-install-mosquitto).
>
> **Want to use a Raspberry Pi instead?** The steps are the same — just substitute your Pi's local IP for the domain name, and use Tailscale or Cloudflare Tunnel if you want remote access.

### 5.1 Provision a server

Create a VPS (Virtual Private Server) with any cloud provider. Recommended specs:

- **OS**: Ubuntu 22.04 or 24.04 LTS
- **RAM**: 1 GB minimum
- **Storage**: 10 GB minimum (SQLite database grows slowly)
- **CPU**: 1 vCPU is sufficient

Providers and approximate monthly cost:

| Provider | Plan | Cost |
|----------|------|------|
| DigitalOcean | Basic Droplet | ~$6/mo |
| Linode (Akamai) | Nanode | ~$5/mo |
| Hetzner | CX22 | ~$4/mo |
| AWS Lightsail | 1 GB | ~$5/mo |

After provisioning, note your server's public IP address.

### 5.2 Domain and DNS

Point a domain (or subdomain) at your server by creating an A record:

```text
Type: A
Name: mycarium (or whatever subdomain you want)
Value: <your-server-IP>
TTL: 300
```

For this guide, we'll use `mycarium.example.com` as the domain. Replace it with yours throughout.

**Verify DNS propagation** before continuing:

```bash
dig mycarium.example.com +short
# Should return your server's IP
```

### 5.3 Initial server setup

SSH into your server:

```bash
ssh root@mycarium.example.com
```

Create a non-root user (if you don't have one):

```bash
adduser mycarium
usermod -aG sudo mycarium
```

Install system dependencies:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx mosquitto mosquitto-clients \
  git curl build-essential
```

Install Node.js (v20 or later) via [nvm](https://github.com/nvm-sh/nvm) or [NodeSource](https://github.com/nodesource/distributions):

```bash
# Option A: nvm (recommended — lets you switch Node versions)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Option B: NodeSource (simpler, system-wide install)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Install pnpm:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### 5.4 HTTPS with Let's Encrypt

Set up Nginx and get a free TLS certificate:

```bash
# Create a basic Nginx site config
sudo tee /etc/nginx/sites-available/mycarium > /dev/null <<'NGINX'
server {
    listen 80;
    server_name mycarium.example.com;

    location / {
        root /var/www/mycarium;
        try_files $uri $uri/ /index.html;
    }
}
NGINX

sudo ln -s /etc/nginx/sites-available/mycarium /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/mycarium
echo "<h1>Mycarium</h1>" | sudo tee /var/www/mycarium/index.html

sudo nginx -t && sudo systemctl reload nginx
```

Now get the TLS certificate:

```bash
sudo certbot --nginx -d mycarium.example.com
```

Certbot will modify your Nginx config to add the `listen 443 ssl` block and redirect HTTP to HTTPS. It also sets up automatic renewal.

**Verify:** Open `https://mycarium.example.com` in your browser — you should see "Mycarium" with a valid certificate.

### 5.5 Install Mosquitto

Mosquitto is the MQTT broker that relays messages between the ESP32, the server, and the browser.

#### Create a Certificate Authority (CA)

MQTT connections use mutual TLS (mTLS) — both the broker and every client present certificates signed by your CA. This ensures only your devices and services can connect.

```bash
# Create a directory for certs
CERT_DIR="/etc/mosquitto/certs/mycarium.example.com"
sudo mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

# Generate the CA key (you'll set a password — remember it!)
sudo openssl genrsa -aes256 -out ca.key 4096

# Generate the CA certificate (valid for 10 years)
sudo openssl req -new -x509 -days 3650 -key ca.key -out ca.crt \
  -subj "/CN=Mycarium CA"
```

#### Create the broker's server certificate

```bash
# Generate the broker key
sudo openssl genrsa -out server.key 2048

# Create a config file for the SAN (Subject Alternative Name)
sudo tee server.cnf > /dev/null <<EOF
[req]
distinguished_name = req_dn
req_extensions = v3_req
prompt = no

[req_dn]
CN = mycarium.example.com

[v3_req]
subjectAltName = DNS:mycarium.example.com
EOF

# Generate a CSR (Certificate Signing Request)
sudo openssl req -new -key server.key -out server.csr -config server.cnf

# Sign it with the CA
sudo openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 365 \
  -extensions v3_req -extfile server.cnf

# Clean up
sudo rm server.csr server.cnf
```

#### Create client certificates

You need a client certificate for each entity that connects to the broker:

1. **The ESP32 device** (`mycarium-1`)
2. **The persistence service** (`persistence-service`)
3. **The app proxy** (`app-proxy`) — used by Nginx to proxy browser WebSocket connections

Create a helper script to make this easier:

```bash
sudo tee /usr/local/bin/mycarium-cert <<'SCRIPT'
#!/bin/bash
set -euo pipefail
CN="$1"
DIR="/etc/mosquitto/certs/mycarium.example.com"
cd "$DIR"
sudo openssl genrsa -out "$CN.key" 2048
sudo openssl req -new -key "$CN.key" -out "$CN.csr" -subj "/CN=$CN"
sudo openssl x509 -req -in "$CN.csr" -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out "$CN.crt" -days 365 \
  -CAserial "$DIR/data/ca.srl"
sudo chmod 600 "$CN.key"
sudo rm "$CN.csr"
echo "Created $DIR/$CN.crt and $DIR/$CN.key"
SCRIPT
sudo chmod +x /usr/local/bin/mycarium-cert

# Create the data directory for the serial file
sudo mkdir -p "$CERT_DIR/data"

# Generate the three client certs
mycarium-cert mycarium-1
mycarium-cert persistence-service
mycarium-cert app-proxy
```

#### Configure Mosquitto

```bash
sudo tee /etc/mosquitto/conf.d/mycarium.conf > /dev/null <<'CONF'
# Disable anonymous access
allow_anonymous false

# Use client certificate CN as the username
use_identity_as_username true

# TLS listener (for ESP32 and server services)
listener 8883
cafile /etc/mosquitto/certs/mycarium.example.com/ca.crt
certfile /etc/mosquitto/certs/mycarium.example.com/server.crt
keyfile /etc/mosquitto/certs/mycarium.example.com/server.key
require_certificate true

# WebSocket TLS listener (for browser clients via Nginx proxy)
listener 8083
protocol websockets
cafile /etc/mosquitto/certs/mycarium.example.com/ca.crt
certfile /etc/mosquitto/certs/mycarium.example.com/server.crt
keyfile /etc/mosquitto/certs/mycarium.example.com/server.key
require_certificate true
CONF

sudo systemctl restart mosquitto
```

**Verify Mosquitto is running:**

```bash
sudo systemctl status mosquitto
# Should show "active (running)"

# Test with a client cert
mosquitto_sub -h mycarium.example.com -p 8883 \
  --cafile "$CERT_DIR/ca.crt" \
  --cert "$CERT_DIR/persistence-service.crt" \
  --key "$CERT_DIR/persistence-service.key" \
  -t "test" -C 1 &

mosquitto_pub -h mycarium.example.com -p 8883 \
  --cafile "$CERT_DIR/ca.crt" \
  --cert "$CERT_DIR/persistence-service.crt" \
  --key "$CERT_DIR/persistence-service.key" \
  -t "test" -m "hello"
# Should print "hello" and exit
```

### 5.6 Deploy the Mycarium server

Clone the repository:

```bash
cd ~
git clone https://github.com/morphatic/mycarium.git
cd mycarium/server
```

Create the environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
nano .env
```

```ini
# Database
DATABASE_PATH=./data/mycarium.db

# MQTT broker (mTLS)
MQTT_BROKER_URL=mqtts://mycarium.example.com:8883
MQTT_CA_PATH=/etc/mosquitto/certs/mycarium.example.com/ca.crt
MQTT_CERT_PATH=/etc/mosquitto/certs/mycarium.example.com/persistence-service.crt
MQTT_KEY_PATH=/etc/mosquitto/certs/mycarium.example.com/persistence-service.key

# Certificate authority (for issuing user certs at registration)
CA_CERT_PATH=/etc/mosquitto/certs/mycarium.example.com/ca.crt
CA_KEY_PATH=/etc/mosquitto/certs/mycarium.example.com/ca.key
CA_KEY_PASSWORD=<the password you set when creating the CA key>

# API
API_PORT=3000
CORS_ORIGIN=https://mycarium.example.com

# Sessions
SESSION_DURATION_DAYS=30

# Retention
RETENTION_DAYS=90
```

Build and install:

```bash
mkdir -p data
pnpm install
pnpm build
```

#### Create a systemd service

```bash
sudo tee /etc/systemd/system/mycarium-server.service > /dev/null <<SERVICE
[Unit]
Description=Mycarium persistence service and API
After=network.target mosquitto.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/mycarium/server
ExecStart=$(which node) dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable mycarium-server
sudo systemctl start mycarium-server
```

**Verify:**

```bash
sudo systemctl status mycarium-server
# Should show "active (running)"

curl http://localhost:3000/health
# Should return a health check response
```

### 5.7 Configure Nginx as reverse proxy

Add the API, MQTT proxy, and security headers to your Nginx config:

```bash
sudo nano /etc/nginx/sites-available/mycarium
```

Add these blocks inside the `server { }` block that Certbot created (before the existing `location /` block):

```nginx
# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://mycarium.example.com; img-src 'self' data:; font-src 'self';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;

# MQTT WebSocket proxy
location /mqtt {
    proxy_pass https://127.0.0.1:8083;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;

    proxy_ssl_certificate     /etc/mosquitto/certs/mycarium.example.com/app-proxy.crt;
    proxy_ssl_certificate_key /etc/mosquitto/certs/mycarium.example.com/app-proxy.key;
    proxy_ssl_trusted_certificate /etc/mosquitto/certs/mycarium.example.com/ca.crt;
    proxy_ssl_verify on;
    proxy_ssl_name mycarium.example.com;
    proxy_ssl_server_name on;

    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}

# API proxy
location /health {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /auth/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /devices {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Make sure the existing `location /` block serves the PWA:

```nginx
location / {
    root /var/www/mycarium;
    try_files $uri $uri/ /index.html;
}
```

Test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. Firmware

The firmware runs on the ESP32 and is written in Rust using the ESP-IDF framework. This section covers setting up the build environment, configuring secrets, building, and flashing.

> **Not familiar with Rust?** That's okay — you don't need to write any Rust code. You just need to install the toolchain, fill in a config file, and run the build command.

### 6.1 Install the Rust toolchain

#### All platforms

Install Rust via [rustup](https://rustup.rs/):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

On Windows, download and run [rustup-init.exe](https://rustup.rs/) instead.

#### Install the ESP32 toolchain

The ESP32 uses the Xtensa architecture, which requires a custom Rust toolchain.

Install [espup](https://github.com/esp-rs/espup):

```bash
cargo install espup
espup install
```

This installs the Xtensa Rust toolchain and the ESP-IDF build tools. It takes several minutes.

Install the flash tool:

```bash
cargo install espflash
```

#### Additional requirements

- **Python 3**: Required by ESP-IDF's build system.
  - **macOS/Linux**: Usually pre-installed. Verify with `python3 --version`.
  - **Windows**: Install [Python 3.13](https://www.python.org/downloads/) using the standard Windows installer (NOT the MSYS2 version). The MSYS2 Python cannot create virtualenvs, which ESP-IDF requires.

- **LLVM/Clang**: Installed by espup, but you may need to set `LIBCLANG_PATH`. On macOS/Linux, the `export-esp.sh` script handles this. On Windows, see [6.2 Windows-specific setup](#62-windows-specific-setup).

#### macOS / Linux: source the environment

After espup completes, it creates a shell script to set environment variables:

```bash
# Add to your .bashrc / .zshrc:
source $HOME/export-esp.sh
```

### 6.2 Windows-specific setup

Building ESP32 firmware on Windows requires a few extra configuration steps. The project includes a `.cargo/config.toml` that handles most of this, but you'll need to verify:

1. **Python path**: The config assumes Python is at `C:/Python313/python.exe`. If yours is elsewhere, update `IDF_PYTHON` and `PYTHON` in `firmware/.cargo/config.toml`.

2. **LIBCLANG_PATH**: The config sets this to the espup-installed clang. Verify the path matches your system:
   ```toml
   LIBCLANG_PATH = "C:/Users/<you>/.rustup/toolchains/esp/xtensa-esp32-elf-clang/esp-clang/bin"
   ```

3. **Target directory**: To avoid Windows path-length limits, the build output goes to `C:/espbuild` instead of the default `target/` directory:
   ```toml
   target-dir = "C:/espbuild"
   ```

### 6.3 Configure secrets

The firmware embeds WiFi credentials and TLS certificates at compile time. These are stored in a `secrets/` directory that is excluded from version control.

```bash
cd firmware

# Copy the example config
cp -r secrets.example secrets

# Edit the config
nano secrets/cfg.toml   # or use your preferred editor
```

Fill in your values:

```toml
[env]
MYCARIUM_DEVICE_ID = "mycarium-1"
MYCARIUM_WIFI_SSID = "your-wifi-network-name"
MYCARIUM_WIFI_PASSWORD = "your-wifi-password"
MYCARIUM_MQTT_BROKER_HOST = "mycarium.example.com"
MYCARIUM_MQTT_BROKER_PORT = "8883"
```

Copy the TLS certificates from your server:

```bash
# From the server, copy these files to firmware/secrets/
scp user@mycarium.example.com:/etc/mosquitto/certs/mycarium.example.com/ca.crt secrets/ca.crt
scp user@mycarium.example.com:/etc/mosquitto/certs/mycarium.example.com/mycarium-1.crt secrets/client.crt
scp user@mycarium.example.com:/etc/mosquitto/certs/mycarium.example.com/mycarium-1.key secrets/client.key
```

### 6.4 Build the firmware

```bash
cd firmware
cargo build
```

The first build takes about 10 minutes — it downloads and compiles the entire ESP-IDF framework. Subsequent builds take about 1 minute.

**If the build fails**, check:

- Python is accessible and is the native (not MSYS2) version
- `LIBCLANG_PATH` points to the right directory
- The `secrets/` directory exists and contains `cfg.toml`, `ca.crt`, `client.crt`, and `client.key`

### 6.5 Flash the ESP32

Connect the ESP32 to your computer via USB, then:

```bash
cargo run
```

This builds (if needed), flashes the firmware, and opens a serial monitor so you can see log output. You should see:

```text
I mycarium: WiFi connected, IP: 192.168.x.x
I mycarium: SNTP time synchronized
I mycarium: MQTT connected to mycarium.example.com:8883
I mycarium: BME280 initialized (SDA=GPIO21, SCL=GPIO22)
I mycarium: Published status to mycarium/status/mycarium-1
```

Press `Ctrl+C` to exit the monitor. The ESP32 will continue running — it doesn't need the USB connection to your computer after flashing (just USB power).

**Troubleshooting flash issues:**

- **Permission denied on serial port**: On Linux, add your user to the `dialout` group: `sudo usermod -aG dialout $USER`, then log out and back in.
- **ESP32 not detected**: Try a different USB cable — some cables are charge-only and don't carry data.
- **Port busy**: Close any other serial monitors (Arduino IDE, PuTTY, etc.) that might be using the port.

### 6.6 Adding more devices

To add a second ESP32 device:

1. Generate a new client certificate on the server: `mycarium-cert mycarium-2`
2. Copy the new cert, key, and CA cert to `firmware/secrets/`
3. Change `MYCARIUM_DEVICE_ID` to `"mycarium-2"` in `secrets/cfg.toml`
4. Build and flash: `cargo run`

Each device needs a unique device ID and its own client certificate.

---

## 7. Web App (PWA)

The Progressive Web App is built with React, Vite, and Tailwind CSS. It's deployed as static files served by Nginx.

> **Just want to deploy?** Skip to [7.3 Build and deploy](#73-build-and-deploy).

### 7.1 Development setup

```bash
cd app
pnpm install
```

Create a `.env` file for local development:

```bash
echo 'VITE_API_URL=https://mycarium.example.com' > .env
```

Start the dev server:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`. It connects to your production server's API and MQTT broker, so you can develop locally against real data.

### 7.2 Run tests

```bash
pnpm test
```

This runs the Vitest test suite, which covers auth, devices, MQTT, and component logic.

### 7.3 Build and deploy

On the server:

```bash
cd ~/mycarium
./deploy.sh app
```

This pulls the latest code, installs dependencies, builds the app, and copies the output to `/var/www/mycarium/`.

The app is now available at `https://mycarium.example.com`.

### 7.4 Install as PWA

On your phone:

1. Open `https://mycarium.example.com` in your browser
2. Tap the browser's share/menu button
3. Select "Add to Home Screen" (iOS Safari) or "Install app" (Android Chrome)

The app works offline for viewing cached data, and reconnects automatically when you're back online.

---

## 8. First Run

Once everything is deployed:

### 8.1 Create an account

1. Open `https://mycarium.example.com`
2. Click "Register"
3. Enter your email and a strong password
4. You'll be logged in automatically

### 8.2 Claim your device

1. From the dashboard, click "Add Device"
2. Enter the device ID exactly as configured in the firmware (e.g., `mycarium-1`)
3. The device will appear as "pending" until the next status message arrives (up to 30 seconds)
4. Once a status message arrives, the device transitions to "active" and you'll see live sensor data

### 8.3 Verify the system

Check each layer:

- **Sensor data**: Temperature and humidity should update every 30 seconds on the dashboard
- **Actuator control**: The heater/fogger icons show current state (on/off) and mode (auto/manual)
- **Threshold adjustment**: Change a threshold in the app — the device should reflect the new threshold in its next status message
- **Historical charts**: Select a time range to see historical data plotted over time
- **Standby mode**: Use the standby button to turn everything off (sets both actuators to manual-off)

### 8.4 Tune your thresholds

Default thresholds are:

| Parameter | Min | Max |
|-----------|-----|-----|
| Temperature | 23.9°C (75°F) | 27.8°C (82°F) |
| Humidity | 85% | 92% |

These are good starting points for many mushroom species. Adjust based on your species' requirements:

| Species | Temp Range | Humidity Range |
|---------|-----------|---------------|
| Oyster (Pleurotus) | 18-24°C (64-75°F) | 85-95% |
| Shiitake | 15-21°C (59-70°F) | 80-90% |
| Lion's Mane | 18-24°C (64-75°F) | 85-95% |
| Reishi | 24-30°C (75-86°F) | 85-95% |

**Important:** The BME280 sensor has an accuracy of ±1.0°C for temperature and ±3% for humidity. The app enforces minimum ranges of 2°C and 6% respectively to prevent rapid actuator cycling from sensor noise.

---

## 9. Troubleshooting

### ESP32 won't connect to WiFi

- Verify SSID and password in `secrets/cfg.toml` (they're case-sensitive)
- The firmware uses WPA2-Personal. If your router is set to WPA3-only, switch it to WPA2/WPA3 mixed mode
- Some routers have separate 2.4 GHz and 5 GHz networks — the ESP32 only supports 2.4 GHz
- Check the serial monitor output (`cargo run`) for error codes

### ESP32 connects to WiFi but not MQTT

- Verify the broker hostname and port in `secrets/cfg.toml`
- Ensure the client certificate was signed by the same CA as the broker's server cert
- Check that Mosquitto is running on the server: `sudo systemctl status mosquitto`
- Check Mosquitto's log: `sudo tail -f /var/log/mosquitto/mosquitto.log`
- Try connecting manually from the server with `mosquitto_sub` to verify the broker is working

### Dashboard shows no data

- Check that the device shows as "active" (not "pending")
- Verify the device ID in the app matches the one in the firmware config exactly
- Open the browser console (F12) — look for WebSocket connection errors
- Check the server logs: `sudo journalctl -u mycarium-server -f`

### Humidity won't stay in range

- Make sure the perlite is damp — the fogger needs moisture to work
- Check that the fogger is actually producing fog when the relay clicks on
- If humidity drops too fast, improve the seal on your terrarium (reduce ventilation slightly)
- If humidity overshoots significantly, the fogger may be too powerful — consider using a timer to pulse it

### Temperature changes very slowly

This is normal. Heat mats are low-power and heat by radiation/conduction through glass, which is slow. Typical behavior:

- Heating: ~1°F every 30-40 minutes
- Cooling (after heater turns off): depends on ambient temperature

If heating is too slow, consider a larger heat mat or supplementing with a small ceramic heater. If it's too fast (overshooting), add thermal mass (a container of water inside the terrarium absorbs and releases heat slowly).

### Certificate expired

Client certificates are valid for 365 days. To renew:

```bash
# On the server
mycarium-cert mycarium-1  # Overwrites the old cert
```

Then copy the new cert and key to the ESP32's `firmware/secrets/` directory and reflash. For the persistence service and app proxy, restart the relevant services:

```bash
sudo systemctl restart mycarium-server
sudo systemctl reload nginx
```

---

## License

Mycarium is open-source software. See the [LICENSE](../../LICENSE) file in the repository root for details.
