import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import type { AppDb } from "../db/client.js";
import type { Config } from "../config.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";

export async function buildServer(db: AppDb, config?: Config) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config?.CORS_ORIGIN ?? true,
  });
  await app.register(sensible);
  await app.register(rateLimit, {
    global: false, // Only apply to specific routes
  });

  // Decorate with db so routes can access it
  app.decorate("db", db);

  // Auth plugin (must register before protected routes)
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes);
  if (config) {
    await app.register(authRoutes(config));
  }
  await app.register(deviceRoutes);

  return app;
}

// Augment Fastify types
declare module "fastify" {
  interface FastifyInstance {
    db: AppDb;
  }
}
