import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import * as schema from "../src/db/schema.js";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  db.run(sql`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    client_cert TEXT,
    client_key TEXT,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    temp_c REAL NOT NULL,
    humidity REAL NOT NULL,
    heater_on INTEGER NOT NULL,
    fogger_on INTEGER NOT NULL
  )`);

  db.run(sql`CREATE INDEX idx_readings_device_id ON readings(device_id)`);
  db.run(sql`CREATE INDEX idx_readings_ts ON readings(ts)`);
  db.run(sql`CREATE INDEX idx_readings_device_ts ON readings(device_id, ts)`);

  return db;
}

describe("database schema", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it("inserts and queries a user", () => {
    const now = new Date();
    db.insert(schema.users).values({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed",
      createdAt: now,
    }).run();

    const rows = db.select().from(schema.users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("test@example.com");
    expect(rows[0].id).toBe("user-1");
  });

  it("inserts and queries a reading", () => {
    const ts = Math.floor(Date.now() / 1000);
    db.insert(schema.readings).values({
      deviceId: "mycarium-1",
      ts,
      tempC: 25.3,
      humidity: 88.5,
      heaterOn: false,
      foggerOn: true,
    }).run();

    const rows = db.select().from(schema.readings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].deviceId).toBe("mycarium-1");
    expect(rows[0].tempC).toBeCloseTo(25.3);
    expect(rows[0].humidity).toBeCloseTo(88.5);
    expect(rows[0].heaterOn).toBe(false);
    expect(rows[0].foggerOn).toBe(true);
  });

  it("queries readings by device and time range", () => {
    const base = 1700000000;
    const values = [
      { deviceId: "mycarium-1", ts: base, tempC: 24.0, humidity: 85.0, heaterOn: true, foggerOn: false },
      { deviceId: "mycarium-1", ts: base + 30, tempC: 25.0, humidity: 87.0, heaterOn: false, foggerOn: false },
      { deviceId: "mycarium-1", ts: base + 60, tempC: 26.0, humidity: 90.0, heaterOn: false, foggerOn: true },
      { deviceId: "mycarium-2", ts: base + 30, tempC: 22.0, humidity: 80.0, heaterOn: true, foggerOn: false },
    ];

    for (const v of values) {
      db.insert(schema.readings).values(v).run();
    }

    const rows = db
      .select()
      .from(schema.readings)
      .where(
        and(
          eq(schema.readings.deviceId, "mycarium-1"),
          gte(schema.readings.ts, base),
          lte(schema.readings.ts, base + 30)
        )
      )
      .all();

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.deviceId === "mycarium-1")).toBe(true);
  });

  it("enforces unique email constraint", () => {
    const now = new Date();
    db.insert(schema.users).values({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed",
      createdAt: now,
    }).run();

    expect(() =>
      db.insert(schema.users).values({
        id: "user-2",
        email: "test@example.com",
        passwordHash: "hashed2",
        createdAt: now,
      }).run()
    ).toThrow();
  });

  it("enforces unique device_id constraint", () => {
    const now = new Date();
    db.insert(schema.users).values({
      id: "user-1",
      email: "owner@example.com",
      passwordHash: "hashed",
      createdAt: now,
    }).run();

    db.insert(schema.devices).values({
      deviceId: "mycarium-1",
      userId: "user-1",
      createdAt: now,
    }).run();

    expect(() =>
      db.insert(schema.devices).values({
        deviceId: "mycarium-1",
        userId: "user-1",
        createdAt: now,
      }).run()
    ).toThrow();
  });

  it("creates a device with pending status by default", () => {
    const now = new Date();
    db.insert(schema.users).values({
      id: "user-1",
      email: "owner@example.com",
      passwordHash: "hashed",
      createdAt: now,
    }).run();

    db.insert(schema.devices).values({
      deviceId: "mycarium-1",
      userId: "user-1",
      createdAt: now,
    }).run();

    const rows = db.select().from(schema.devices).all();
    expect(rows[0].status).toBe("pending");
  });

  it("cascades user deletion to sessions and devices", () => {
    const now = new Date();
    const future = new Date(Date.now() + 86400000);

    db.insert(schema.users).values({
      id: "user-1",
      email: "owner@example.com",
      passwordHash: "hashed",
      createdAt: now,
    }).run();

    db.insert(schema.sessions).values({
      id: "token-1",
      userId: "user-1",
      expiresAt: future,
      createdAt: now,
    }).run();

    db.insert(schema.devices).values({
      deviceId: "mycarium-1",
      userId: "user-1",
      createdAt: now,
    }).run();

    db.delete(schema.users).where(eq(schema.users.id, "user-1")).run();

    expect(db.select().from(schema.sessions).all()).toHaveLength(0);
    expect(db.select().from(schema.devices).all()).toHaveLength(0);
  });
});
