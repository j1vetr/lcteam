import { and, count, eq, inArray } from "drizzle-orm";
import { db, users, teams, boards, columns, tasks, comments, type UserRow, type TaskRow, type BoardRow, type TeamRow } from "@workspace/db";
import { publicUser } from "./auth";
import { fail } from "./errors";

export const serialize = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const todayIstanbul = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const soonDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 3 * 86400000));
export const teamIdsFor = (user: UserRow, allTeams: TeamRow[]) => allTeams.filter(t => t.memberIds.includes(user.id)).map(t => t.id);
export function isAssigned(task: TaskRow, user: UserRow, allTeams: TeamRow[]) {
  return task.assigneeIds.includes(user.id) || task.teamIds.some(id => teamIdsFor(user, allTeams).includes(id));
}
export function boardVisible(board: BoardRow, user: UserRow, allTeams: TeamRow[], allTasks: TaskRow[]) {
  return user.role === "admin" || board.memberIds.includes(user.id) || board.teamIds.some(id => teamIdsFor(user, allTeams).includes(id)) ||
    allTasks.some(t => t.boardId === board.id && isAssigned(t, user, allTeams));
}
export async function workspace(user: UserRow) {
  const [allUsers, allTeams, allBoards, allColumns, allTasks] = await Promise.all([
    db.select().from(users), db.select().from(teams), db.select().from(boards),
    db.select().from(columns).orderBy(columns.position, columns.id), db.select().from(tasks).orderBy(tasks.position, tasks.id),
  ]);
  const visibleBoards = allBoards.filter(b => boardVisible(b, user, allTeams, allTasks));
  const boardIds = new Set(visibleBoards.map(b => b.id));
  const visibleTasks = allTasks.filter(t => t.boardId === null ? t.creatorId === user.id : boardIds.has(t.boardId));
  const taskIds = visibleTasks.map(t => t.id);
  const counts = taskIds.length ? await db.select({ taskId: comments.taskId, count: count() }).from(comments).where(inArray(comments.taskId, taskIds)).groupBy(comments.taskId) : [];
  const commentCounts = new Map(counts.map(c => [c.taskId, c.count]));
  return {
    users: allUsers.filter(u => user.role === "admin" || u.active || u.id === user.id).map(publicUser),
    teams: allTeams.filter(t => user.role === "admin" || t.memberIds.includes(user.id) || visibleBoards.some(b => b.teamIds.includes(t.id))),
    boards: visibleBoards,
    columns: allColumns.filter(c => boardIds.has(c.boardId)),
    tasks: visibleTasks.map(t => ({ ...t, commentCount: commentCounts.get(t.id) || 0 })),
  };
}
export async function visibleTask(id: number, user: UserRow) {
  const w = await workspace(user);
  const task = w.tasks.find(t => t.id === id);
  if (!task) fail(404, "Görev bulunamadı veya erişim yetkiniz yok.");
  return { task, w };
}
export async function validateIds(userIds: number[] = [], teamIds: number[] = []) {
  const uniqueUsers = [...new Set(userIds)];
  const uniqueTeams = [...new Set(teamIds)];
  if (uniqueUsers.length) {
    const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, uniqueUsers), eq(users.active, true)));
    if (rows.length !== uniqueUsers.length) fail(400, "Seçilen kullanıcılardan biri bulunamadı veya pasif.");
  }
  if (uniqueTeams.length) {
    const rows = await db.select({ id: teams.id }).from(teams).where(inArray(teams.id, uniqueTeams));
    if (rows.length !== uniqueTeams.length) fail(400, "Seçilen ekiplerden biri bulunamadı.");
  }
}
export function nonBlank(text: string) {
  const value = text.trim();
  if (!value) fail(400, "Başlık ve ad alanları boş bırakılamaz.");
  return value;
}
export function dateValue(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, "Tarih YYYY-AA-GG biçiminde olmalıdır.");
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) fail(400, "Geçersiz takvim tarihi.");
  return value;
}
export function validDates(start: string | null, due: string | null) {
  if (start && due && due < start) fail(400, "Bitiş tarihi başlangıç tarihinden önce olamaz.");
}
