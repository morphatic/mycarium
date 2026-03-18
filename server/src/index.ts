import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { createSubscriber } from "./mqtt/subscriber.js";
import { startRetentionJob } from "./services/retention.js";

const config = loadConfig();
const db = createDb(config.DATABASE_PATH);

console.log("Starting mycarium server...");

// MQTT subscriber
const mqttClient = createSubscriber(config, db);

// Retention cleanup
const retentionTimer = startRetentionJob(db, config.RETENTION_DAYS);

// Graceful shutdown
function shutdown() {
  console.log("Shutting down...");
  clearInterval(retentionTimer);
  mqttClient.end(false, () => {
    console.log("MQTT client disconnected");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
