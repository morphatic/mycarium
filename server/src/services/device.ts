import { eq, and, gte, lte } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import { devices, readings } from "../db/schema.js";

export function listDevices(db: AppDb, userId: string) {
  return db
    .select()
    .from(devices)
    .where(eq(devices.userId, userId))
    .all();
}

export function getDeviceByDeviceId(db: AppDb, deviceId: string) {
  return db
    .select()
    .from(devices)
    .where(eq(devices.deviceId, deviceId))
    .get() ?? null;
}

export function getDeviceById(db: AppDb, id: number) {
  return db
    .select()
    .from(devices)
    .where(eq(devices.id, id))
    .get() ?? null;
}

export function claimDevice(db: AppDb, userId: string, deviceId: string) {
  return db
    .insert(devices)
    .values({ deviceId, userId, createdAt: new Date() })
    .returning()
    .get();
}

export function updateDeviceName(db: AppDb, id: number, name: string) {
  db.update(devices)
    .set({ name })
    .where(eq(devices.id, id))
    .run();
}

export function removeDevice(db: AppDb, id: number) {
  db.delete(devices)
    .where(eq(devices.id, id))
    .run();
}

export function getReadingsInRange(
  db: AppDb,
  deviceId: string,
  from: number,
  to: number
) {
  return db
    .select()
    .from(readings)
    .where(
      and(
        eq(readings.deviceId, deviceId),
        gte(readings.ts, from),
        lte(readings.ts, to)
      )
    )
    .orderBy(readings.ts)
    .all();
}
