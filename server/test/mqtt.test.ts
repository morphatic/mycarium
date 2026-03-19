import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql, eq } from "drizzle-orm";
import * as schema from "../src/db/schema.js";
import { extractDeviceId, persistReading, activatePendingDevice } from "../src/mqtt/subscriber.js";
import { statusMessageSchema } from "../src/types/index.js";

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

describe("extractDeviceId", () => {
  it("extracts device ID from valid topic", () => {
    expect(extractDeviceId("mycarium/status/mycarium-1")).toBe("mycarium-1");
  });

  it("handles multi-segment device IDs", () => {
    expect(extractDeviceId("mycarium/status/my-device-42")).toBe("my-device-42");
  });

  it("returns null for non-matching topics", () => {
    expect(extractDeviceId("other/topic")).toBeNull();
    expect(extractDeviceId("mycarium/control/mycarium-1")).toBeNull();
  });
});

describe("statusMessageSchema", () => {
  it("parses a valid status message", () => {
    const msg = {
      ts: 1700000000,
      temp_c: 25.3,
      temp_f: 77.5,
      humidity: 88.5,
      heater_on: false,
      fogger_on: true,
      heater_action: "none",
      fogger_action: "turned on",
      heater_mode: "auto",
      fogger_mode: "auto",
      temp_min: 23.9,
      temp_max: 27.8,
      hum_min: 85.0,
      hum_max: 92.0,
    };

    const result = statusMessageSchema.parse(msg);
    expect(result.temp_c).toBe(25.3);
    expect(result.heater_on).toBe(false);
  });

  it("parses a minimal status message", () => {
    const msg = {
      ts: 1700000000,
      temp_c: 25.3,
      humidity: 88.5,
      temp_min: 23.9,
      temp_max: 27.8,
      hum_min: 85.0,
      hum_max: 92.0,
      heater_on: false,
      fogger_on: true,
    };

    const result = statusMessageSchema.parse(msg);
    expect(result.ts).toBe(1700000000);
  });

  it("rejects messages missing required fields", () => {
    expect(() => statusMessageSchema.parse({ ts: 1700000000 })).toThrow();
    expect(() => statusMessageSchema.parse({})).toThrow();
  });
});

describe("persistReading", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it("inserts a reading into the database", () => {
    persistReading(db, "mycarium-1", {
      ts: 1700000000,
      temp_c: 25.3,
      humidity: 88.5,
      heater_on: false,
      fogger_on: true,
    });

    const rows = db.select().from(schema.readings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].deviceId).toBe("mycarium-1");
    expect(rows[0].tempC).toBeCloseTo(25.3);
  });
});

describe("activatePendingDevice", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
    const now = new Date();
    db.insert(schema.users).values({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed",
      createdAt: now,
    }).run();
  });

  it("activates a pending device when reading is persisted", () => {
    db.insert(schema.devices).values({
      deviceId: "mycarium-1",
      userId: "user-1",
      status: "pending",
      createdAt: new Date(),
    }).run();

    activatePendingDevice(db, "mycarium-1");

    const rows = db.select().from(schema.devices).where(eq(schema.devices.deviceId, "mycarium-1")).all();
    expect(rows[0].status).toBe("active");
  });

  it("does nothing for unclaimed device IDs", () => {
    // Should not throw when no matching device exists
    expect(() => activatePendingDevice(db, "unknown-device")).not.toThrow();
  });
});
