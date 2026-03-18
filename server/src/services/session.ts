import { randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { sessions } from "../db/schema.js";

export function createSession(db: AppDb, userId: string, durationDays: number): string {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

  db.insert(sessions)
    .values({ id, userId, expiresAt, createdAt: new Date() })
    .run();

  return id;
}

export function validateSession(db: AppDb, token: string) {
  const session = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, token))
    .get();

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Expired — clean it up
    db.delete(sessions).where(eq(sessions.id, token)).run();
    return null;
  }

  return { userId: session.userId };
}

export function deleteExpiredSessions(db: AppDb): number {
  const result = db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .run();
  return result.changes;
}
