import { lt } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { readings } from "../db/schema.js";

export function deleteOldReadings(db: AppDb, retentionDays: number): number {
  const cutoff = Math.floor(Date.now() / 1000) - retentionDays * 86400;
  const result = db.delete(readings).where(lt(readings.ts, cutoff)).run();
  return result.changes;
}

export function startRetentionJob(db: AppDb, retentionDays: number): NodeJS.Timeout {
  const runCleanup = () => {
    const deleted = deleteOldReadings(db, retentionDays);
    if (deleted > 0) {
      console.log(`Retention: deleted ${deleted} readings older than ${retentionDays} days`);
    }
  };

  // Run once on start, then daily
  runCleanup();
  return setInterval(runCleanup, 24 * 60 * 60 * 1000);
}
