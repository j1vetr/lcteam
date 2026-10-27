import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  memberIds: integer("member_ids").array().notNull().default([]),
});
export const insertTeamSchema = createInsertSchema(teams).omit({ id: true });
export type TeamRow = typeof teams.$inferSelect;
