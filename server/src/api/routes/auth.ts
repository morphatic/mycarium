import type { FastifyPluginAsync } from "fastify";
import { z } from "zod/v4";
import { createUser, authenticateUser } from "../../services/user.js";
import { storeUserCert, getUserCert } from "../../services/user.js";
import { createSession } from "../../services/session.js";
import { issueClientCertificate } from "../../services/cert.js";
import type { Config } from "../../config.js";

const authBodySchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export function authRoutes(config: Config): FastifyPluginAsync {
  return async (app) => {
    app.post("/auth/register", async (request, reply) => {
      const body = authBodySchema.parse(request.body);

      let user;
      try {
        user = await createUser(app.db, body.email, body.password);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("UNIQUE constraint failed")) {
          return reply.conflict("Email already registered");
        }
        throw err;
      }

      // Issue client certificate
      const { cert, key } = await issueClientCertificate(
        user.id,
        config.CA_CERT_PATH,
        config.CA_KEY_PATH,
        config.CA_KEY_PASSWORD
      );
      storeUserCert(app.db, user.id, cert, key);

      // Create session
      const token = createSession(app.db, user.id, config.SESSION_DURATION_DAYS);

      return reply.status(201).send({
        token,
        client_cert: cert,
        client_key: key,
      });
    });

    app.post("/auth/login", async (request, reply) => {
      const body = authBodySchema.parse(request.body);

      const user = await authenticateUser(app.db, body.email, body.password);
      if (!user) {
        return reply.unauthorized("Invalid email or password");
      }

      const token = createSession(app.db, user.id, config.SESSION_DURATION_DAYS);
      const certs = getUserCert(app.db, user.id);

      return {
        token,
        client_cert: certs?.cert ?? null,
        client_key: certs?.key ?? null,
      };
    });
  };
}
