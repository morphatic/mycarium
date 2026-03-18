import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema.js";
import { buildServer } from "../src/api/server.js";
import type { FastifyInstance } from "fastify";
import type { Config } from "../src/config.js";

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

async function registerAndGetToken(app: FastifyInstance, email = "test@example.com") {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "password123" },
  });
  return res.json().token as string;
}

describe("device routes", () => {
  let app: FastifyInstance;
  let token: string;

  beforeEach(async () => {
    const db = createTestDb();
    app = await buildServer(db, testConfig);
    token = await registerAndGetToken(app);
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 without auth token", async () => {
    const res = await app.inject({ method: "GET", url: "/devices" });
    expect(res.statusCode).toBe(401);
  });

  it("lists devices (empty initially)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("claims a device", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.deviceId).toBe("mycarium-1");
    expect(body.status).toBe("pending");
  });

  it("returns 409 when claiming already-claimed device", async () => {
    await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("renames a device", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });
    const { id } = claimRes.json();

    const res = await app.inject({
      method: "PATCH",
      url: `/devices/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: "Kitchen Mycarium" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Kitchen Mycarium");
  });

  it("returns 403 when renaming another user's device", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });
    const { id } = claimRes.json();

    const otherToken = await registerAndGetToken(app, "other@example.com");

    const res = await app.inject({
      method: "PATCH",
      url: `/devices/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { name: "Stolen Device" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("deletes a device", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });
    const { id } = claimRes.json();

    const res = await app.inject({
      method: "DELETE",
      url: `/devices/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(204);

    const listRes = await app.inject({
      method: "GET",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listRes.json()).toEqual([]);
  });

  it("returns 403 when deleting another user's device", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });
    const { id } = claimRes.json();

    const otherToken = await registerAndGetToken(app, "other@example.com");

    const res = await app.inject({
      method: "DELETE",
      url: `/devices/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns history for a claimed device", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });
    const { id } = claimRes.json();

    // Insert readings directly
    const base = 1700000000;
    app.db.insert(schema.readings).values([
      { deviceId: "mycarium-1", ts: base, tempC: 25, humidity: 85, heaterOn: false, foggerOn: false },
      { deviceId: "mycarium-1", ts: base + 30, tempC: 26, humidity: 87, heaterOn: true, foggerOn: false },
      { deviceId: "mycarium-1", ts: base + 60, tempC: 27, humidity: 90, heaterOn: false, foggerOn: true },
    ]).run();

    const res = await app.inject({
      method: "GET",
      url: `/devices/${id}/history?from=${base}&to=${base + 30}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].ts).toBe(base);
    expect(body[1].ts).toBe(base + 30);
  });

  it("returns 403 when accessing another user's device history", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/devices",
      headers: { authorization: `Bearer ${token}` },
      payload: { device_id: "mycarium-1" },
    });
    const { id } = claimRes.json();

    const otherToken = await registerAndGetToken(app, "other@example.com");

    const res = await app.inject({
      method: "GET",
      url: `/devices/${id}/history?from=0&to=9999999999`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
