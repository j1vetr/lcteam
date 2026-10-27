import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, RequestHandler } from "express";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db, users, sessions, authAttempts, type UserRow } from "@workspace/db";
import { fail } from "./errors";

declare global {
  namespace Express {
    interface Request { currentUser?: UserRow; sessionHash?: string; }
  }
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function publicUser(user: UserRow) {
  const { passwordHash: _password, createdAt: _created, ...safe } = user;
  return safe;
}
const cookieName = "lacivert_session";
function cookieOptions(req: Request) {
  return { httpOnly: true, secure: req.secure || req.get("x-forwarded-proto") === "https", sameSite: "lax" as const, path: "/" };
}
export async function startSession(req: Request, res: Response, userId: number) {
  const token = randomBytes(32).toString("hex");
  if (req.sessionHash) await db.delete(sessions).where(eq(sessions.tokenHash, req.sessionHash));
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + 7 * 86400000) });
  res.cookie(cookieName, token, { ...cookieOptions(req), maxAge: 7 * 86400000 });
}
export function clearSession(req: Request, res: Response) { res.clearCookie(cookieName, cookieOptions(req)); }
export const loadSession: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[cookieName];
  if (typeof token === "string" && /^[a-f0-9]{64}$/.test(token)) {
    req.sessionHash = hashToken(token);
    const [row] = await db.select({ user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, req.sessionHash), gt(sessions.expiresAt, new Date()), eq(users.active, true)));
    if (row) req.currentUser = row.user;
  }
  next();
};
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.currentUser) fail(401, "Devam etmek için giriş yapın.");
  next();
};
export function userOf(req: Request) {
  if (!req.currentUser) fail(401, "Devam etmek için giriş yapın.");
  return req.currentUser;
}
export function requireAdmin(req: Request) {
  const user = userOf(req);
  if (user.role !== "admin") fail(403, "Bu işlem için yönetici yetkisi gerekiyor.");
  return user;
}
export async function throttle(req: Request) {
  // A persistent per-client window also limits restarts and parallel requests.
  const key = hashToken(`auth:${req.ip || req.socket.remoteAddress}`);
  const [row] = await db.insert(authAttempts).values({ key, expiresAt: new Date(Date.now() + 15 * 60000) })
    .onConflictDoUpdate({ target: authAttempts.key, set: {
      attempts: sql`CASE WHEN ${authAttempts.expiresAt} < now() THEN 1 ELSE ${authAttempts.attempts} + 1 END`,
      expiresAt: sql`CASE WHEN ${authAttempts.expiresAt} < now() THEN now() + interval '15 minutes' ELSE ${authAttempts.expiresAt} END`,
    } }).returning();
  if (row.attempts > 20) fail(429, "Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin.");
}
