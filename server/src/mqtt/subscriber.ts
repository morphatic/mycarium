import mqtt from "mqtt";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { Config } from "../config.js";
import type { AppDb } from "../db/client.js";
import { readings, devices } from "../db/schema.js";
import { statusMessageSchema } from "../types/index.js";

export function createSubscriber(config: Config, db: AppDb) {
  const ca = readFileSync(config.MQTT_CA_PATH);
  const cert = readFileSync(config.MQTT_CERT_PATH);
  const key = readFileSync(config.MQTT_KEY_PATH);

  const client = mqtt.connect(config.MQTT_BROKER_URL, {
    ca,
    cert,
    key,
    rejectUnauthorized: true,
    clientId: "persistence-service",
    protocolVersion: 5,
  });

  client.on("connect", () => {
    console.log("MQTT: connected to broker");
    client.subscribe("mycarium/status/#", { qos: 0 }, (err) => {
      if (err) {
        console.error("MQTT: subscribe error:", err.message);
      } else {
        console.log("MQTT: subscribed to mycarium/status/#");
      }
    });
  });

  client.on("message", (topic, payload) => {
    try {
      const deviceId = extractDeviceId(topic);
      if (!deviceId) {
        console.warn("MQTT: could not extract device ID from topic:", topic);
        return;
      }

      const parsed = JSON.parse(payload.toString());
      const message = statusMessageSchema.parse(parsed);

      persistReading(db, deviceId, message);
      activatePendingDevice(db, deviceId);
    } catch (err) {
      console.warn("MQTT: malformed message on", topic, "—", (err as Error).message);
    }
  });

  client.on("error", (err) => {
    console.error("MQTT: client error:", err.message);
  });

  client.on("reconnect", () => {
    console.log("MQTT: reconnecting...");
  });

  client.on("close", () => {
    console.log("MQTT: connection closed");
  });

  return client;
}

export function extractDeviceId(topic: string): string | null {
  const match = topic.match(/^mycarium\/status\/(.+)$/);
  return match ? match[1] : null;
}

export function persistReading(
  db: AppDb,
  deviceId: string,
  message: { ts: number; temp_c: number; humidity: number; heater_on: boolean; fogger_on: boolean }
) {
  db.insert(readings)
    .values({
      deviceId,
      ts: message.ts,
      tempC: message.temp_c,
      humidity: message.humidity,
      heaterOn: message.heater_on,
      foggerOn: message.fogger_on,
    })
    .run();
}

export function activatePendingDevice(db: AppDb, deviceId: string) {
  db.update(devices)
    .set({ status: "active" })
    .where(eq(devices.deviceId, deviceId))
    .run();
}
