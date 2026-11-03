import { pgTable, serial, text, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./users";

export const personalColumns = pgTable("personal_columns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status", { enum: ["todo", "doing", "review", "done"] }).notNull(),
  position: integer("position").notNull(),
}, (t) => [index("personal_columns_user_idx").on(t.userId)]);

export const insertPersonalColumnSchema = createInsertSchema(personalColumns).omit({ id: true });
export type PersonalColumnRow = typeof personalColumns.$inferSelect;
