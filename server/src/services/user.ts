import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import argon2 from "argon2";
import type { AppDb } from "../db/client.js";
import { users } from "../db/schema.js";

export async function createUser(db: AppDb, email: string, password: string) {
  const id = randomUUID();
  const passwordHash = await argon2.hash(password);

  db.insert(users)
    .values({ id, email, passwordHash, createdAt: new Date() })
    .run();

  return { id, email };
}

export async function authenticateUser(db: AppDb, email: string, password: string) {
  const user = db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!user) return null;

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) return null;

  return { id: user.id, email: user.email };
}

export function getUserById(db: AppDb, userId: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get() ?? null;
}

export function storeUserCert(db: AppDb, userId: string, cert: string, key: string) {
  db.update(users)
    .set({ clientCert: cert, clientKey: key })
    .where(eq(users.id, userId))
    .run();
}

export function getUserCert(db: AppDb, userId: string) {
  const user = db
    .select({ clientCert: users.clientCert, clientKey: users.clientKey })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user || !user.clientCert || !user.clientKey) return null;
  return { cert: user.clientCert, key: user.clientKey };
}
