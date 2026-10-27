import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { db, activity, notifications } from "@workspace/db";
import { GetWorkspaceResponse, GetDashboardResponse, GetActivityResponse, GetNotificationsResponse } from "@workspace/api-zod";
import { userOf } from "../lib/auth";
import { workspace, serialize, todayIstanbul, soonDay } from "../lib/workspace";
const router: IRouter = Router();
router.get("/workspace", async (req, res): Promise<void> => {
  res.json(GetWorkspaceResponse.parse(serialize(await workspace(userOf(req)))));
});
router.get("/dashboard", async (req, res): Promise<void> => {
  const user = userOf(req);
  const w = await workspace(user);
  const today = todayIstanbul();
  const soon = soonDay();
  const open = w.tasks.filter(t => t.status !== "done");
  res.json(GetDashboardResponse.parse({
    total: w.tasks.length, open: open.length, completed: w.tasks.length - open.length,
    overdue: open.filter(t => t.dueDate && t.dueDate < today).length,
    dueSoon: open.filter(t => t.dueDate && t.dueDate >= today && t.dueDate <= soon).length,
    mine: w.tasks.filter(t => t.assigneeIds.includes(user.id)).length,
    teams: w.teams.map(team => {
      const tasks = w.tasks.filter(t => t.teamIds.includes(team.id));
      return { teamId: team.id, total: tasks.length, completed: tasks.filter(t => t.status === "done").length, overdue: tasks.filter(t => t.status !== "done" && t.dueDate && t.dueDate < today).length };
    }),
  }));
});
router.get("/activity", async (req, res): Promise<void> => {
  const w = await workspace(userOf(req));
  const ids = w.tasks.map(t => t.id);
  const rows = ids.length ? await db.select().from(activity).where(inArray(activity.taskId, ids)).orderBy(desc(activity.createdAt), desc(activity.id)).limit(50) : [];
  res.json(GetActivityResponse.parse(serialize(rows)));
});
router.get("/notifications", async (req, res): Promise<void> => {
  const user = userOf(req);
  const w = await workspace(user);
  const ids = new Set(w.tasks.map(t => t.id));
  const today = todayIstanbul();
  const soon = soonDay();
  const reminders = w.tasks.filter(t => t.status !== "done" && t.dueDate && t.dueDate <= soon && t.assigneeIds.includes(user.id))
    .map(t => ({ userId: user.id, taskId: t.id, reminderKey: `${user.id}:${t.id}:${t.dueDate}:${t.dueDate! < today ? "overdue" : "soon"}`, message: `${t.title}: ${t.dueDate! < today ? "son teslim tarihi geçti" : "son teslim tarihi yaklaşıyor"} (${t.dueDate}).` }));
  if (reminders.length) await db.insert(notifications).values(reminders).onConflictDoNothing({ target: notifications.reminderKey });
  const stored = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100);
  res.json(GetNotificationsResponse.parse(serialize(stored.filter(n => ids.has(n.taskId)))));
});
router.post("/notifications/read", async (req, res): Promise<void> => {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userOf(req).id));
  res.json({ success: true });
});
export default router;
