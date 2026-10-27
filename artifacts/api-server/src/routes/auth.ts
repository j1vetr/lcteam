import { Router, type IRouter } from "express";
import argon2 from "argon2";
import { eq, sql } from "drizzle-orm";
import { db, users, sessions, boards, columns, tasks, activity } from "@workspace/db";
import { SetupAdminBody, LoginBody, ChangePasswordBody, GetSessionResponse, SetupAdminResponse, LoginResponse } from "@workspace/api-zod";
import { parse, fail } from "../lib/errors";
import { publicUser, startSession, clearSession, throttle, userOf } from "../lib/auth";
import { nonBlank } from "../lib/workspace";

const router: IRouter = Router();
router.get("/auth/session", async (req, res): Promise<void> => {
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  res.json(GetSessionResponse.parse({ user: req.currentUser ? publicUser(req.currentUser) : null, needsSetup: !anyUser }));
});
router.post("/auth/setup", async (req, res): Promise<void> => {
  await throttle(req);
  const data = parse(SetupAdminBody, req.body);
  const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });
  const admin = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(14560987)`);
    const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
    if (existing) fail(409, "Kurulum tamamlanmış. Kullanıcı adınız ve şifrenizle giriş yapın.");
    const [user] = await tx.insert(users).values({ name: nonBlank(data.name), username: data.username.toLowerCase(), passwordHash, role: "admin" }).returning();
    const [board] = await tx.insert(boards).values({ name: "Lacivert çalışma alanı", description: "Ekibimizin işlerini birlikte takip ettiğimiz çalışma panosu.", memberIds: [user.id] }).returning();
    const cols = await tx.insert(columns).values(["Yapılacak", "Devam ediyor", "Kontrolde", "Tamamlandı"].map((name, position) => ({ boardId: board.id, name, position, isDone: position === 3 }))).returning();
    const starters = [
      { title: "İlk çalışma arkadaşınızı ekleyin", description: "Ekipler sayfasındaki Üyeler bölümünden çalışma arkadaşınız için bir hesap oluşturun.", labels: ["Başlangıç"] },
      { title: "Ekibinizi oluşturun", description: "Ekipler sayfasından bir ekip oluşturun ve üyelerini seçin. Ardından panonuza ekleyin.", labels: ["Başlangıç"] },
      { title: "Panonuzu düzenleyin", description: "Pano ayarlarından ekip ve üyeleri seçin. İhtiyacınıza göre sütun adlarını düzenleyin.", labels: ["Başlangıç"] },
    ];
    const inserted = await tx.insert(tasks).values(starters.map((t, position) => ({ ...t, boardId: board.id, columnId: cols[0].id, creatorId: user.id, assigneeIds: [user.id], position }))).returning();
    await tx.insert(activity).values(inserted.map(t => ({ taskId: t.id, userId: user.id, message: "Başlangıç görevi oluşturuldu." })));
    return user;
  });
  await startSession(req, res, admin.id);
  res.status(201).json(SetupAdminResponse.parse(publicUser(admin)));
});
router.post("/auth/login", async (req, res): Promise<void> => {
  await throttle(req);
  const data = parse(LoginBody, req.body);
  const [user] = await db.select().from(users).where(eq(users.username, data.username.toLowerCase()));
  // Spend comparable password work even when an account does not exist.
  if (!user) { await argon2.hash(data.password, { type: argon2.argon2id }); fail(401, "Kullanıcı adı veya şifre hatalı."); }
  const valid = await argon2.verify(user.passwordHash, data.password);
  if (!valid || !user.active) fail(401, "Kullanıcı adı veya şifre hatalı.");
  await startSession(req, res, user.id);
  res.json(LoginResponse.parse(publicUser(user)));
});
router.post("/auth/logout", async (req, res): Promise<void> => {
  if (req.sessionHash) await db.delete(sessions).where(eq(sessions.tokenHash, req.sessionHash));
  clearSession(req, res);
  res.json({ success: true });
});
router.post("/auth/password", async (req, res): Promise<void> => {
  const user = userOf(req);
  await throttle(req);
  const data = parse(ChangePasswordBody, req.body);
  if (!await argon2.verify(user.passwordHash, data.currentPassword)) fail(400, "Mevcut şifreniz hatalı.");
  const passwordHash = await argon2.hash(data.newPassword, { type: argon2.argon2id });
  await db.transaction(async tx => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  await startSession(req, res, user.id);
  res.json({ success: true });
});
export default router;
