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

## Dev Environment Setup

The following tools must be installed globally before working on this project:

| Tool | Purpose | Install |
|------|---------|---------|
| [Git](https://git-scm.com/) | Version control | [git-scm.com](https://git-scm.com/downloads) |
| [GitHub CLI (`gh`)](https://cli.github.com/) | GitHub operations (PRs, issues, repo management) | [cli.github.com](https://cli.github.com/) |
| [Rust (`rustup`, `cargo`)](https://www.rust-lang.org/) | Firmware development | [rustup.rs](https://rustup.rs/) |
| [pnpm](https://pnpm.io/) | Node package manager | [pnpm.io/installation](https://pnpm.io/installation) |
| [cspell](https://cspell.org/) | Spell checking for code and docs | `pnpm add -g cspell` |
| [markdownlint-cli](https://github.com/igorshubovych/markdownlint-cli) | Markdown linting | `pnpm add -g markdownlint-cli` |

## License

[MIT](LICENSE)
