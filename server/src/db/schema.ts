import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  clientCert: text("client_cert"), // PEM
  clientKey: text("client_key"), // PEM
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // opaque token
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: text("device_id").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name"),
  status: text("status", { enum: ["pending", "active"] })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const readings = sqliteTable(
  "readings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deviceId: text("device_id").notNull(),
    ts: integer("ts").notNull(), // Unix timestamp
    tempC: real("temp_c").notNull(),
    humidity: real("humidity").notNull(),
    heaterOn: integer("heater_on", { mode: "boolean" }).notNull(),
    foggerOn: integer("fogger_on", { mode: "boolean" }).notNull(),
  },
  (table) => [
    index("idx_readings_device_id").on(table.deviceId),
    index("idx_readings_ts").on(table.ts),
    index("idx_readings_device_ts").on(table.deviceId, table.ts),
  ]
);
