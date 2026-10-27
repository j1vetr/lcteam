import { Router, type IRouter } from "express";
import { canDeleteTask } from "../lib/task-permissions";
import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, tasks, columns, activity, notifications, comments, teams, type TaskRow } from "@workspace/db";
import { CreateTaskBody, UpdateTaskBody, AddCommentBody, CreateTaskResponse, GetTaskResponse, AddCommentResponse } from "@workspace/api-zod";
import { fail, parse, idParam } from "../lib/errors";
import { userOf } from "../lib/auth";
import { visibleTask, workspace, validateIds, serialize, dateValue, validDates, isAssigned, nonBlank } from "../lib/workspace";

const router: IRouter = Router();
function statusForColumn(column: { isDone: boolean; position: number }): TaskRow["status"] {
  return column.isDone ? "done" : column.position === 0 ? "todo" : column.position === 1 ? "doing" : "review";
}
async function taskResponse(id: number) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
  const c = await db.select({ id: comments.id }).from(comments).where(eq(comments.taskId, id));
  return CreateTaskResponse.parse(serialize({ ...task, commentCount: c.length }));
}
async function recipients(task: Pick<TaskRow, "assigneeIds" | "teamIds" | "creatorId">) {
  const assignedTeams = task.teamIds.length ? await db.select().from(teams).where(inArray(teams.id, task.teamIds)) : [];
  return [...new Set([task.creatorId, ...task.assigneeIds, ...assignedTeams.flatMap(t => t.memberIds)])];
}
router.post("/tasks", async (req, res): Promise<void> => {
  const user = userOf(req);
  const data = parse(CreateTaskBody, req.body);
  const startDate = dateValue(req.body.startDate) ?? null;
  const dueDate = dateValue(req.body.dueDate) ?? null;
  validDates(startDate, dueDate);
  const assigneeIds = [...new Set(data.assigneeIds)];
  const teamIds = [...new Set(data.teamIds)];
  if (data.boardId === null) {
    if (teamIds.length || assigneeIds.some(id => id !== user.id)) fail(400, "Kişisel görev yalnızca kendinize atanabilir.");
    if (!assigneeIds.length) assigneeIds.push(user.id);
  } else if (user.role !== "admin") fail(403, "Üyeler yalnızca kendilerine kişisel görev oluşturabilir.");
  if (teamIds.length && !assigneeIds.length) fail(400, "Ekip görevi için en az bir sorumlu kişi seçin.");
  await validateIds(assigneeIds, teamIds);
  let columnId: number | null = null;
  let status = data.status ?? "todo";
  const w = await workspace(user);
  if (data.boardId !== null) {
    if (!w.boards.some(b => b.id === data.boardId)) fail(404, "Pano bulunamadı.");
    const boardColumns = w.columns.filter(c => c.boardId === data.boardId);
    const selected = data.columnId != null ? boardColumns.find(c => c.id === data.columnId) : boardColumns[0];
    if (!selected) fail(400, "Geçerli bir pano sütunu seçin.");
    columnId = selected.id;
    status = statusForColumn(selected);
  }
  const sameColumn = w.tasks.filter(t => t.boardId === data.boardId && t.columnId === columnId);
  const position = Math.max(-1, ...sameColumn.map(t => t.position)) + 1;
  const task = await db.transaction(async tx => {
    const [created] = await tx.insert(tasks).values({
      title: nonBlank(data.title), description: data.description ?? "", boardId: data.boardId, columnId, creatorId: user.id,
      assigneeIds, teamIds, priority: data.priority ?? "medium", status, startDate, dueDate,
      labels: data.labels ?? [], checklist: data.checklist ?? [], position,
    }).returning();
    await tx.insert(activity).values({ taskId: created.id, userId: user.id, message: "Görevi oluşturdu." });
    const ids = (await recipients(created)).filter(id => id !== user.id);
    if (ids.length) await tx.insert(notifications).values(ids.map(userId => ({ taskId: created.id, userId, message: `${user.name}, "${created.title}" görevini atadı.` })));
    return created;
  });
  res.status(201).json(CreateTaskResponse.parse(serialize({ ...task, commentCount: 0 })));
});
router.get("/tasks/:id", async (req, res): Promise<void> => {
  const { task } = await visibleTask(idParam(req), userOf(req));
  const [commentRows, logRows] = await Promise.all([
    db.select().from(comments).where(eq(comments.taskId, task.id)).orderBy(comments.createdAt, comments.id),
    db.select().from(activity).where(eq(activity.taskId, task.id)).orderBy(desc(activity.createdAt), desc(activity.id)),
  ]);
  res.json(GetTaskResponse.parse(serialize({ task, comments: commentRows, activity: logRows })));
});
router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const user = userOf(req);
  const { task, w } = await visibleTask(idParam(req), user);
  const data = parse(UpdateTaskBody, req.body);
  const allTeams = await db.select().from(teams);
  const personal = task.boardId === null && task.creatorId === user.id;
  const assigned = isAssigned(task, user, allTeams);
  if (!personal && user.role !== "admin" && !assigned) fail(403, "Yalnızca size veya ekibinize atanmış görevleri güncelleyebilirsiniz.");
  const startDate = dateValue(req.body.startDate);
  const dueDate = dateValue(req.body.dueDate);
  validDates(startDate === undefined ? task.startDate : startDate, dueDate === undefined ? task.dueDate : dueDate);
  const assigneeIds = data.assigneeIds === undefined ? task.assigneeIds : [...new Set(data.assigneeIds)];
  const teamIds = data.teamIds === undefined ? task.teamIds : [...new Set(data.teamIds)];
  if (personal && (teamIds.length || assigneeIds.length !== 1 || assigneeIds[0] !== user.id)) fail(400, "Kişisel görev yalnızca kendinize atanabilir.");
  if (teamIds.length && !assigneeIds.length) fail(400, "Ekip görevi için en az bir sorumlu kişi seçin.");
  if (!personal && user.role !== "admin") {
    const protectedFields = ["title", "description", "priority", "labels", "assigneeIds", "teamIds"] as const;
    for (const key of protectedFields) {
      if (data[key] !== undefined && JSON.stringify(data[key]) !== JSON.stringify(task[key])) fail(403, "Bu görevde yalnızca durum, sıralama ve kontrol listesini güncelleyebilirsiniz.");
    }
    if ((startDate !== undefined && startDate !== task.startDate) || (dueDate !== undefined && dueDate !== task.dueDate)) fail(403, "Görev tarihlerini yalnızca yönetici değiştirebilir.");
  }
  // Validate only changed assignments so deactivated historical assignees don't block status updates.
  if (data.assigneeIds !== undefined || data.teamIds !== undefined) await validateIds(assigneeIds, teamIds);
  let columnId = data.columnId === undefined ? task.columnId : data.columnId;
  let status = data.status ?? task.status;
  if (task.boardId === null) columnId = null;
  else {
    const boardColumns = w.columns.filter(c => c.boardId === task.boardId);
    if (data.columnId !== undefined) {
      const column = boardColumns.find(c => c.id === columnId);
      if (!column) fail(400, "Sütun bu panoya ait değil.");
      status = statusForColumn(column);
    } else if (data.status !== undefined) {
      const matchingColumn = boardColumns.find(c => statusForColumn(c) === data.status);
      if (!matchingColumn) fail(400, "Bu durum için uygun bir pano sütunu yok.");
      columnId = matchingColumn.id;
      status = statusForColumn(matchingColumn);
    }
  }
  if (data.position !== undefined && (!Number.isFinite(data.position) || Math.abs(data.position) > 1e12)) fail(400, "Geçersiz sıralama.");
  const changedAssignments = data.assigneeIds !== undefined || data.teamIds !== undefined;
  await db.transaction(async tx => {
    // Serialize moves within the board (or this user's private workspace).
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${task.boardId === null ? -user.id : task.boardId})`);
    const { startDate: _start, dueDate: _due, ...other } = data;
    const [updated] = await tx.update(tasks).set({
      ...other, ...(data.title !== undefined ? { title: nonBlank(data.title) } : {}),
      ...(startDate !== undefined ? { startDate } : {}), ...(dueDate !== undefined ? { dueDate } : {}),
      assigneeIds, teamIds, columnId, status, updatedAt: new Date(),
    }).where(eq(tasks.id, task.id)).returning();
    if (!updated) fail(404, "Görev artık mevcut değil.");
    if (data.position !== undefined || columnId !== task.columnId) {
      if (columnId !== null) {
        const destination = await tx.select({ id: tasks.id }).from(tasks)
          .where(and(eq(tasks.columnId, columnId), ne(tasks.id, task.id)))
          .orderBy(asc(tasks.position), asc(tasks.id));
        const index = Math.min(destination.length, Math.max(0, Math.trunc(data.position ?? destination.length)));
        destination.splice(index, 0, { id: task.id });
        for (const [position, row] of destination.entries()) await tx.update(tasks).set({ position }).where(eq(tasks.id, row.id));
      }
      if (task.columnId !== null && task.columnId !== columnId) {
        const source = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.columnId, task.columnId)).orderBy(asc(tasks.position), asc(tasks.id));
        for (const [position, row] of source.entries()) await tx.update(tasks).set({ position }).where(eq(tasks.id, row.id));
      }
    }
    const message = status !== task.status ? `Görevin durumunu güncelledi.` : columnId !== task.columnId ? "Görevi başka bir sütuna taşıdı." : "Görevi güncelledi.";
    await tx.insert(activity).values({ taskId: task.id, userId: user.id, message });
    if (dueDate !== undefined || status === "done") await tx.delete(notifications).where(and(eq(notifications.taskId, task.id), isNotNull(notifications.reminderKey)));
    if (changedAssignments) {
      const prior = new Set(await recipients(task));
      const ids = (await recipients(updated)).filter(id => !prior.has(id) && id !== user.id);
      if (ids.length) await tx.insert(notifications).values(ids.map(userId => ({ taskId: task.id, userId, message: `${user.name}, "${updated.title}" görevini size atadı.` })));
    }
  });
  res.json(await taskResponse(task.id));
});
router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const user = userOf(req);
  const { task } = await visibleTask(idParam(req), user);
  if (!canDeleteTask(user, task)) fail(403, "Bu görevi silme yetkiniz yok. Şirket görevlerini yalnızca yönetici silebilir.");
  await db.delete(tasks).where(eq(tasks.id, task.id));
  res.json({ success: true });
});
router.post("/tasks/:id/comments", async (req, res): Promise<void> => {
  const user = userOf(req);
  const { task } = await visibleTask(idParam(req), user);
  const data = parse(AddCommentBody, req.body);
  const comment = await db.transaction(async tx => {
    const [created] = await tx.insert(comments).values({ taskId: task.id, userId: user.id, text: nonBlank(data.text) }).returning();
    await tx.insert(activity).values({ taskId: task.id, userId: user.id, message: "Bir yorum ekledi." });
    const ids = (await recipients(task)).filter(id => id !== user.id);
    if (ids.length) await tx.insert(notifications).values(ids.map(userId => ({ userId, taskId: task.id, message: `${user.name}, "${task.title}" görevine yorum ekledi.` })));
    return created;
  });
  res.status(201).json(AddCommentResponse.parse(serialize(comment)));
});
export default router;
