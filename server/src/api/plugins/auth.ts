import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { validateSession } from "../../services/session.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: { userId: string };
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", undefined);

  app.addHook("onRequest", async (request, reply) => {
    // Skip auth for public routes
    const publicPaths = ["/health", "/auth/register", "/auth/login"];
    if (publicPaths.includes(request.url)) return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.unauthorized("Missing or invalid authorization header");
    }

    const token = authHeader.slice(7);
    const session = validateSession(app.db, token);
    if (!session) {
      return reply.unauthorized("Invalid or expired session token");
    }

    request.user = session;
  });
};

export default fp(authPlugin);
