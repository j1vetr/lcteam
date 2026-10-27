import { Router, type IRouter } from "express";
import argon2 from "argon2";
import { and, eq, sql } from "drizzle-orm";
import { db, users, teams, boards, columns, tasks, sessions } from "@workspace/db";
import { CreateUserBody, UpdateUserBody, CreateTeamBody, UpdateTeamBody, CreateBoardBody, UpdateBoardBody, CreateColumnBody, UpdateColumnBody, CreateUserResponse, UpdateUserResponse, CreateTeamResponse, CreateBoardResponse, CreateColumnResponse } from "@workspace/api-zod";
import { requireAdmin, publicUser } from "../lib/auth";
import { fail, parse, idParam } from "../lib/errors";
import { nonBlank, serialize, validateIds } from "../lib/workspace";

const router: IRouter = Router();
router.post("/users", async (req, res): Promise<void> => {
  requireAdmin(req);
  const data = parse(CreateUserBody, req.body);
  const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });
  const [user] = await db.insert(users).values({ name: nonBlank(data.name), username: data.username.toLowerCase(), passwordHash, role: data.role }).returning();
  res.status(201).json(CreateUserResponse.parse(publicUser(user)));
});
router.patch("/users/:id", async (req, res): Promise<void> => {
  requireAdmin(req);
  const id = idParam(req);
  const data = parse(UpdateUserBody, req.body);
  const updated = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(14560987)`);
    const [user] = await tx.select().from(users).where(eq(users.id, id));
    if (!user) fail(404, "Üye bulunamadı.");
    if (user.role === "admin" && user.active && (data.role === "member" || data.active === false)) {
      const admins = await tx.select().from(users).where(and(eq(users.role, "admin"), eq(users.active, true)));
      if (admins.length <= 1) fail(400, "Son aktif yönetici pasife alınamaz veya üye yapılamaz.");
    }
    const [result] = await tx.update(users).set({ ...data, ...(data.name !== undefined ? { name: nonBlank(data.name) } : {}) }).where(eq(users.id, id)).returning();
    if (data.active === false || data.role !== undefined) await tx.delete(sessions).where(eq(sessions.userId, id));
    return result;
  });
  res.json(UpdateUserResponse.parse(publicUser(updated)));
});
router.post("/teams", async (req, res): Promise<void> => {
  requireAdmin(req);
  const data = parse(CreateTeamBody, req.body);
  await validateIds(data.memberIds);
  const [team] = await db.insert(teams).values({ ...data, name: nonBlank(data.name), memberIds: [...new Set(data.memberIds)] }).returning();
  res.status(201).json(CreateTeamResponse.parse(team));
});
router.patch("/teams/:id", async (req, res): Promise<void> => {
  requireAdmin(req);
  const data = parse(UpdateTeamBody, req.body);
  await validateIds(data.memberIds);
  const [team] = await db.update(teams).set({ ...data, name: nonBlank(data.name), memberIds: [...new Set(data.memberIds)] }).where(eq(teams.id, idParam(req))).returning();
  if (!team) fail(404, "Ekip bulunamadı.");
  res.json(CreateTeamResponse.parse(team));
});
router.delete("/teams/:id", async (req, res): Promise<void> => {
  requireAdmin(req);
  const id = idParam(req);
  await db.transaction(async tx => {
    const [team] = await tx.delete(teams).where(eq(teams.id, id)).returning();
    if (!team) fail(404, "Ekip bulunamadı.");
    await tx.update(boards).set({ teamIds: sql`array_remove(${boards.teamIds}, ${id})` });
    await tx.update(tasks).set({ teamIds: sql`array_remove(${tasks.teamIds}, ${id})` });
  });
  res.json({ success: true });
});
router.post("/boards", async (req, res): Promise<void> => {
  requireAdmin(req);
  const data = parse(CreateBoardBody, req.body);
  await validateIds(data.memberIds, data.teamIds);
  const board = await db.transaction(async tx => {
    const [b] = await tx.insert(boards).values({ ...data, name: nonBlank(data.name) }).returning();
    await tx.insert(columns).values(["Yapılacak", "Devam ediyor", "Kontrolde", "Tamamlandı"].map((name, position) => ({ boardId: b.id, name, position, isDone: position === 3 })));
    return b;
  });
  res.status(201).json(CreateBoardResponse.parse(serialize(board)));
});
router.patch("/boards/:id", async (req, res): Promise<void> => {
  requireAdmin(req);
  const data = parse(UpdateBoardBody, req.body);
  await validateIds(data.memberIds, data.teamIds);
  const [board] = await db.update(boards).set({ ...data, name: nonBlank(data.name) }).where(eq(boards.id, idParam(req))).returning();
  if (!board) fail(404, "Pano bulunamadı.");
  res.json(CreateBoardResponse.parse(serialize(board)));
});
router.delete("/boards/:id", async (req, res): Promise<void> => {
  requireAdmin(req);
  const id = idParam(req);
  const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.boardId, id)).limit(1);
  if (task) fail(409, "Yalnızca boş panolar silinebilir.");
  const [board] = await db.delete(boards).where(eq(boards.id, id)).returning();
  if (!board) fail(404, "Pano bulunamadı.");
  res.json({ success: true });
});
router.post("/boards/:id/columns", async (req, res): Promise<void> => {
  requireAdmin(req);
  const boardId = idParam(req);
  const data = parse(CreateColumnBody, req.body);
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId));
  if (!board) fail(404, "Pano bulunamadı.");
  const [column] = await db.insert(columns).values({ ...data, name: nonBlank(data.name), boardId }).returning();
  res.status(201).json(CreateColumnResponse.parse(column));
});
router.patch("/columns/:id", async (req, res): Promise<void> => {
  requireAdmin(req);
  const data = parse(UpdateColumnBody, req.body);
  const column = await db.transaction(async tx => {
    const [c] = await tx.update(columns).set({ ...data, name: nonBlank(data.name) }).where(eq(columns.id, idParam(req))).returning();
    if (!c) fail(404, "Sütun bulunamadı.");
    // Keep summary counts consistent when a column's completion meaning changes.
    await tx.update(tasks).set({ status: c.isDone ? "done" : c.position === 0 ? "todo" : c.position === 1 ? "doing" : "review", updatedAt: new Date() }).where(eq(tasks.columnId, c.id));
    return c;
  });
  res.json(CreateColumnResponse.parse(column));
});
router.delete("/columns/:id", async (req, res): Promise<void> => {
  requireAdmin(req);
  const id = idParam(req);
  const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.columnId, id)).limit(1);
  if (task) fail(409, "Yalnızca boş sütunlar silinebilir.");
  const [column] = await db.delete(columns).where(eq(columns.id, id)).returning();
  if (!column) fail(404, "Sütun bulunamadı.");
  res.json({ success: true });
});
export default router;
