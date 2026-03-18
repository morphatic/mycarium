import type { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { readings } from "../../db/schema.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    const result = app.db
      .select({ count: sql<number>`count(*)` })
      .from(readings)
      .get();

    return {
      status: "ok",
      readingCount: result?.count ?? 0,
    };
  });
};
