import { pgTable, serial, text, integer, jsonb, timestamp, date, doublePrecision, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { users } from "./users";
import { boards, columns } from "./boards";
export type ChecklistEntry = { id: string; title: string; checked: boolean };
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  boardId: integer("board_id").references(() => boards.id, { onDelete: "restrict" }),
  columnId: integer("column_id").references(() => columns.id, { onDelete: "restrict" }),
  creatorId: integer("creator_id").notNull().references(() => users.id),
  assigneeIds: integer("assignee_ids").array().notNull().default([]),
  teamIds: integer("team_ids").array().notNull().default([]),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] }).notNull().default("medium"),
  status: text("status", { enum: ["todo", "doing", "review", "done"] }).notNull().default("todo"),
  startDate: date("start_date", { mode: "string" }),
  dueDate: date("due_date", { mode: "string" }),
  labels: text("labels").array().notNull().default([]),
  checklist: jsonb("checklist").$type<ChecklistEntry[]>().notNull().default([]),
  position: doublePrecision("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("tasks_board_idx").on(t.boardId), index("tasks_creator_idx").on(t.creatorId)]);
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export type TaskRow = typeof tasks.$inferSelect;
