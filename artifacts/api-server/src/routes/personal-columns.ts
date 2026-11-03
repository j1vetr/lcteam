import { Router, type IRouter } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, personalColumns, tasks } from "@workspace/db";
import { CreatePersonalColumnBody, UpdatePersonalColumnBody } from "@workspace/api-zod";
import { userOf } from "../lib/auth";
import { fail, idParam, parse } from "../lib/errors";
import { nonBlank } from "../lib/workspace";
import { ensurePersonalColumns, lockPersonalBoard } from "../lib/personal-columns";

const router: IRouter = Router();

router.post("/personal-columns", async (req, res): Promise<void> => {
  const userId = userOf(req).id;
  const data = parse(CreatePersonalColumnBody, req.body);
  await ensurePersonalColumns(userId);
  const column = await db.transaction(async tx => {
    await lockPersonalBoard(tx, userId);
    const rows = await tx.select().from(personalColumns).where(eq(personalColumns.userId, userId));
    if (rows.length >= 30) fail(400, "Kişisel panoda en fazla 30 sütun olabilir.");
    const [created] = await tx.insert(personalColumns).values({
      userId, name: nonBlank(data.name), status: data.status, position: Math.max(-1, ...rows.map(c => c.position)) + 1,
    }).returning();
    return created;
  });
  res.status(201).json(column);
});

router.patch("/personal-columns/:id", async (req, res): Promise<void> => {
  const userId = userOf(req).id;
  const id = idParam(req);
  const data = parse(UpdatePersonalColumnBody, req.body);
  const column = await db.transaction(async tx => {
    await lockPersonalBoard(tx, userId);
    const rows = await tx.select().from(personalColumns).where(eq(personalColumns.userId, userId))
      .orderBy(asc(personalColumns.position), asc(personalColumns.id));
    const current = rows.find(c => c.id === id);
    if (!current) fail(404, "Kişisel pano sütunu bulunamadı.");
    const [updated] = await tx.update(personalColumns).set({
      name: data.name !== undefined ? nonBlank(data.name) : current.name,
      ...(data.status !== undefined ? { status: data.status } : {}),
    }).where(and(eq(personalColumns.id, id), eq(personalColumns.userId, userId))).returning();
    if (data.status !== undefined && data.status !== current.status) {
      await tx.update(tasks).set({ status: data.status, updatedAt: new Date() })
        .where(and(eq(tasks.personalColumnId, id), eq(tasks.creatorId, userId)));
      await tx.execute(sql`DELETE FROM notifications WHERE task_id IN
        (SELECT id FROM tasks WHERE personal_column_id = ${id} AND creator_id = ${userId})
        AND reminder_key IS NOT NULL`);
    }
    if (data.position !== undefined) {
      const ordered = rows.filter(c => c.id !== id);
      const index = Math.min(data.position, ordered.length);
      ordered.splice(index, 0, updated);
      for (const [position, row] of ordered.entries()) {
        await tx.update(personalColumns).set({ position }).where(eq(personalColumns.id, row.id));
      }
      updated.position = index;
    }
    return updated;
  });
  res.json(column);
});

router.delete("/personal-columns/:id", async (req, res): Promise<void> => {
  const userId = userOf(req).id;
  const id = idParam(req);
  await db.transaction(async tx => {
    await lockPersonalBoard(tx, userId);
    const rows = await tx.select().from(personalColumns).where(eq(personalColumns.userId, userId));
    if (!rows.some(c => c.id === id)) fail(404, "Kişisel pano sütunu bulunamadı.");
    if (rows.length === 1) fail(409, "Panoda en az bir sütun kalmalıdır.");
    const [task] = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.personalColumnId, id)).limit(1);
    if (task) fail(409, "Bu sütunda görev var. Önce görevleri başka bir sütuna taşıyın.");
    await tx.delete(personalColumns).where(and(eq(personalColumns.id, id), eq(personalColumns.userId, userId)));
  });
  res.json({ success: true });
});

export default router;
