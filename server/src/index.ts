import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { createSubscriber } from "./mqtt/subscriber.js";
import { startRetentionJob } from "./services/retention.js";
import { buildServer } from "./api/server.js";

const config = loadConfig();
const db = createDb(config.DATABASE_PATH);

console.log("Starting mycarium server...");

// MQTT subscriber
const mqttClient = createSubscriber(config, db);

// Retention cleanup
const retentionTimer = startRetentionJob(db, config.RETENTION_DAYS);

// HTTP API
const app = await buildServer(db);
await app.listen({ port: config.API_PORT, host: "127.0.0.1" });
console.log(`API listening on http://127.0.0.1:${config.API_PORT}`);

// Graceful shutdown
function shutdown() {
  console.log("Shutting down...");
  clearInterval(retentionTimer);
  app.close();
  mqttClient.end(false, () => {
    console.log("MQTT client disconnected");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
