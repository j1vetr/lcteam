import { pgTable, serial, text, boolean, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  active: boolean("active").notNull().default(true),
  color: text("color").notNull().default("#243b64"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type UserRow = typeof users.$inferSelect;

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expiry_idx").on(t.expiresAt)]);
export const authAttempts = pgTable("auth_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
