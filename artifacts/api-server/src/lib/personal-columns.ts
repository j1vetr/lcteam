import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, personalColumns, tasks } from "@workspace/db";

export type PersonalTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockPersonalBoard(tx: PersonalTransaction, userId: number) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(73823, ${userId})`);
}

export async function ensurePersonalColumns(userId: number) {
  return db.transaction(async tx => {
    await lockPersonalBoard(tx, userId);
    let rows = await tx.select().from(personalColumns).where(eq(personalColumns.userId, userId))
      .orderBy(asc(personalColumns.position), asc(personalColumns.id));
    if (!rows.length) {
      rows = await tx.insert(personalColumns).values([
        { userId, name: "Yapılacak", status: "todo" as const, position: 0 },
        { userId, name: "Devam Ediyor", status: "doing" as const, position: 1 },
        { userId, name: "İncelemede", status: "review" as const, position: 2 },
        { userId, name: "Tamamlandı", status: "done" as const, position: 3 },
      ]).returning();
    }
    // Upgrade existing private tasks without deleting or exposing them.
    const [unassigned] = await tx.select({ id: tasks.id }).from(tasks)
      .where(and(isNull(tasks.boardId), eq(tasks.creatorId, userId), isNull(tasks.personalColumnId))).limit(1);
    if (unassigned) {
      for (const status of ["todo", "doing", "review", "done"] as const) {
        const target = rows.find(c => c.status === status) ?? rows[0];
        await tx.update(tasks).set({ personalColumnId: target.id, status: target.status })
          .where(and(isNull(tasks.boardId), eq(tasks.creatorId, userId), isNull(tasks.personalColumnId), eq(tasks.status, status)));
      }
    }
    return rows;
  });
}
