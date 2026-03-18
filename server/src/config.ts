import { z } from "zod/v4";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  DATABASE_PATH: z.string().default("./data/mycarium.db"),
  MQTT_BROKER_URL: z.string().default("mqtts://localhost:8883"),
  MQTT_CA_PATH: z.string(),
  MQTT_CERT_PATH: z.string(),
  MQTT_KEY_PATH: z.string(),
  CA_CERT_PATH: z.string(),
  CA_KEY_PATH: z.string(),
  CA_KEY_PASSWORD: z.string(),
  API_PORT: z.coerce.number().default(3000),
  SESSION_DURATION_DAYS: z.coerce.number().default(30),
  RETENTION_DAYS: z.coerce.number().default(90),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse(process.env);
}
