import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema.js";
import { deleteOldReadings } from "../src/services/retention.js";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });

  db.run(sql`CREATE TABLE readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, device_id TEXT NOT NULL,
    ts INTEGER NOT NULL, temp_c REAL NOT NULL, humidity REAL NOT NULL,
    heater_on INTEGER NOT NULL, fogger_on INTEGER NOT NULL
  )`);

  return db;
}

describe("retention", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
  });

  it("deletes readings older than retention period", () => {
    const now = Math.floor(Date.now() / 1000);
    const oldTs = now - 91 * 86400; // 91 days ago
    const recentTs = now - 1 * 86400; // 1 day ago

    db.insert(schema.readings).values([
      { deviceId: "mycarium-1", ts: oldTs, tempC: 25, humidity: 85, heaterOn: false, foggerOn: false },
      { deviceId: "mycarium-1", ts: recentTs, tempC: 26, humidity: 88, heaterOn: true, foggerOn: false },
    ]).run();

    const deleted = deleteOldReadings(db, 90);
    expect(deleted).toBe(1);

    const remaining = db.select().from(schema.readings).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].ts).toBe(recentTs);
  });

  it("returns 0 when nothing to delete", () => {
    const deleted = deleteOldReadings(db, 90);
    expect(deleted).toBe(0);
  });
});
