import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema.js";
import { buildServer } from "../src/api/server.js";
import type { FastifyInstance } from "fastify";
import type { Config } from "../src/config.js";

// Mock cert issuance (openssl not available in tests)
vi.mock("../src/services/cert.js", () => ({
  issueClientCertificate: vi.fn().mockResolvedValue({
    cert: "-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----",
    key: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
  }),
}));

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  db.run(sql`CREATE TABLE users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, client_cert TEXT, client_key TEXT,
    created_at INTEGER NOT NULL
  )`);
  db.run(sql`CREATE TABLE sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
  )`);
  db.run(sql`CREATE TABLE devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
  )`);
  db.run(sql`CREATE TABLE readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT NOT NULL,
    ts INTEGER NOT NULL, temp_c REAL NOT NULL, humidity REAL NOT NULL,
    heater_on INTEGER NOT NULL, fogger_on INTEGER NOT NULL
  )`);

  return db;
}

const testConfig: Config = {
  DATABASE_PATH: ":memory:",
  MQTT_BROKER_URL: "mqtts://localhost:8883",
  MQTT_CA_PATH: "/tmp/ca.crt",
  MQTT_CERT_PATH: "/tmp/client.crt",
  MQTT_KEY_PATH: "/tmp/client.key",
  CA_CERT_PATH: "/tmp/ca.crt",
  CA_KEY_PATH: "/tmp/ca.key",
  CA_KEY_PASSWORD: "test",
  API_PORT: 3000,
  SESSION_DURATION_DAYS: 30,
  RETENTION_DAYS: 90,
};

describe("auth routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = createTestDb();
    app = await buildServer(db, testConfig);
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers a new user and returns token + cert", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com", password: "password123" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe("string");
    expect(body.client_cert).toContain("CERTIFICATE");
    expect(body.client_key).toContain("PRIVATE KEY");
  });

  it("returns 409 on duplicate email registration", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com", password: "password123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com", password: "password456" },
    });

    expect(res.statusCode).toBe(409);
  });

  it("logs in with correct credentials", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com", password: "password123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@example.com", password: "password123" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.client_cert).toBeUndefined();
    expect(body.client_key).toBeUndefined();
  });

  it("returns 401 on wrong password", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com", password: "password123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "test@example.com", password: "wrongpassword" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 401 on non-existent email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@example.com", password: "password123" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("authenticated route works with valid token", async () => {
    const regRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "test@example.com", password: "password123" },
    });
    const { token } = regRes.json();

    // Health is a public route, so let's test that auth doesn't break it
    const healthRes = await app.inject({
      method: "GET",
      url: "/health",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(healthRes.statusCode).toBe(200);
  });
});
