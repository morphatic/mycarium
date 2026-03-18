import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import type { AppDb } from "../db/client.js";
import { healthRoutes } from "./routes/health.js";

export async function buildServer(db: AppDb) {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(sensible);

  // Decorate with db so routes can access it
  app.decorate("db", db);

  // Routes
  await app.register(healthRoutes);

  return app;
}

// Augment Fastify types
declare module "fastify" {
  interface FastifyInstance {
    db: AppDb;
  }
}
