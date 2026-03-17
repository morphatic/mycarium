use std::fs;
use std::path::Path;

fn main() {
    embuild::espidf::sysenv::output();

    // Load compile-time secrets from secrets/cfg.toml
    let secrets_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("secrets/cfg.toml");
    if secrets_path.exists() {
        println!("cargo:rerun-if-changed=secrets/cfg.toml");
        let contents = fs::read_to_string(&secrets_path)
            .expect("Failed to read secrets/cfg.toml");
        for line in contents.lines() {
            let line = line.trim();
            // Skip comments, blank lines, and section headers
            if line.is_empty() || line.starts_with('#') || line.starts_with('[') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"');
                println!("cargo:rustc-env={key}={value}");
            }
        }
    } else {
        println!(
            "cargo:warning=secrets/cfg.toml not found — WiFi/MQTT credentials will be unavailable. \
             Copy secrets.example/cfg.toml to secrets/cfg.toml and fill in real values."
        );
    }
}
