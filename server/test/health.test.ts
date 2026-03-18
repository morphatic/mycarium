import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema.js";
import { buildServer } from "../src/api/server.js";
import type { FastifyInstance } from "fastify";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
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

describe("GET /health", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = createTestDb();
    app = await buildServer(db);
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns status ok and reading count 0", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.readingCount).toBe(0);
  });

  it("returns correct reading count after inserts", async () => {
    app.db.insert(schema.readings).values([
      { deviceId: "mycarium-1", ts: 1700000000, tempC: 25, humidity: 85, heaterOn: false, foggerOn: false },
      { deviceId: "mycarium-1", ts: 1700000030, tempC: 26, humidity: 87, heaterOn: true, foggerOn: false },
    ]).run();

    const res = await app.inject({ method: "GET", url: "/health" });
    const body = res.json();
    expect(body.readingCount).toBe(2);
  });
});
