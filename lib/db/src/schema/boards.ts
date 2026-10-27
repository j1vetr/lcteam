import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const boards = pgTable("boards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  teamIds: integer("team_ids").array().notNull().default([]),
  memberIds: integer("member_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const columns = pgTable("board_columns", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  isDone: boolean("is_done").notNull().default(false),
}, (t) => [index("columns_board_idx").on(t.boardId)]);
export const insertBoardSchema = createInsertSchema(boards).omit({ id: true, createdAt: true });
export const insertColumnSchema = createInsertSchema(columns).omit({ id: true });
export type BoardRow = typeof boards.$inferSelect;
