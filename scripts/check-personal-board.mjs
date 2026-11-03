// Development-only integration check. All fixtures are removed unless --keep is requested.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

if (process.env.NODE_ENV === "production") throw new Error("Development only");
const requireApi = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const requireDb = createRequire(new URL("../lib/db/package.json", import.meta.url));
const argon2 = requireApi("argon2");
const { Pool } = requireDb("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const base = "http://127.0.0.1:8080";
const ids = [];
const fixtures = [];
let keep = false;

async function request(path, { cookie, method = "GET", data, status = 200 } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { "Content-Type": "application/json", Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(body)}`);
  return { body, cookie: response.headers.getSetCookie().map(s => s.split(";")[0]).join("; ") };
}

try {
  for (let i = 0; i < 2; i++) {
    const username = `pano_test_${randomBytes(5).toString("hex")}`;
    const password = randomBytes(18).toString("hex");
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const { rows: [user] } = await pool.query(
      "INSERT INTO users(name,username,password_hash,role) VALUES($1,$2,$3,'member') RETURNING id",
      ["Pano Test", username, hash],
    );
    ids.push(user.id);
    const login = await request("/auth/login", { method: "POST", data: { username, password } });
    fixtures.push({ id: user.id, username, password, cookie: login.cookie });
  }
  const [a, b] = fixtures;
  const { rows: [legacy] } = await pool.query(
    "INSERT INTO tasks(title,creator_id,assignee_ids,status) VALUES('Legacy private fixture',$1,$2,'doing') RETURNING id",
    [a.id, [a.id]],
  );
  let ws = (await request("/workspace", { cookie: a.cookie })).body;
  assert.equal(ws.personalColumns.length, 4);
  assert.equal(ws.tasks.find(t => t.id === legacy.id).status, "doing");
  assert.ok(ws.tasks.find(t => t.id === legacy.id).personalColumnId);
  const col = (await request("/personal-columns", {
    cookie: a.cookie, method: "POST", status: 201, data: { name: "Test Sütunu", status: "todo" },
  })).body;
  const t1 = (await request("/tasks", {
    cookie: a.cookie, method: "POST", status: 201,
    data: { title: "Hızlı Görev Testi", boardId: null, personalColumnId: col.id, status: "done", assigneeIds: [a.id], teamIds: [] },
  })).body;
  assert.equal(t1.personalColumnId, col.id);
  assert.equal(t1.status, "todo", "Column status must override client status");
  await request(`/personal-columns/${col.id}`, { cookie: b.cookie, method: "PATCH", data: { name: "Unauthorized" }, status: 404 });
  await request(`/personal-columns/${col.id}`, { cookie: b.cookie, method: "DELETE", status: 404 });
  await request(`/tasks/${t1.id}`, { cookie: b.cookie, status: 404 });
  await request("/tasks", {
    cookie: b.cookie, method: "POST", status: 400,
    data: { title: "Forbidden", boardId: null, personalColumnId: col.id, assigneeIds: [b.id], teamIds: [] },
  });
  await request(`/personal-columns/${col.id}`, { cookie: a.cookie, method: "DELETE", status: 409 });
  await request(`/personal-columns/${col.id}`, { cookie: a.cookie, method: "PATCH", data: { name: "Düzenlenen Sütun", position: 0, status: "done" } });
  ws = (await request("/workspace", { cookie: a.cookie })).body;
  assert.equal(ws.personalColumns[0].id, col.id);
  assert.equal(ws.personalColumns[0].name, "Düzenlenen Sütun");
  assert.equal(ws.tasks.find(t => t.id === t1.id).status, "done");
  await request(`/personal-columns/${col.id}`, { cookie: a.cookie, method: "PATCH", data: { position: 2 } });
  ws = (await request("/workspace", { cookie: a.cookie })).body;
  assert.equal(ws.personalColumns[2].id, col.id, "Position-only requests must persist order");
  const todo = ws.personalColumns.find(c => c.id !== col.id && c.status === "todo");
  const t2 = (await request("/tasks", {
    cookie: a.cookie, method: "POST", status: 201,
    data: { title: "Sıralama Testi", boardId: null, personalColumnId: todo.id, assigneeIds: [a.id], teamIds: [] },
  })).body;
  await request(`/tasks/${t1.id}`, { cookie: a.cookie, method: "PATCH", data: { personalColumnId: todo.id, position: 0 } });
  ws = (await request("/workspace", { cookie: a.cookie })).body;
  const ordered = ws.tasks.filter(t => t.personalColumnId === todo.id).sort((x, y) => x.position - y.position);
  assert.deepEqual(ordered.map(t => t.id), [t1.id, t2.id]);
  assert.equal(ordered[0].status, "todo");
  await request(`/personal-columns/${col.id}`, { cookie: a.cookie, method: "DELETE" });
  const bw = (await request("/workspace", { cookie: b.cookie })).body;
  assert.ok(!bw.tasks.some(t => [t1.id, legacy.id].includes(t.id)));
  assert.ok(!bw.personalColumns.some(c => ws.personalColumns.some(other => other.id === c.id)));
  for (const c of bw.personalColumns.slice(1)) await request(`/personal-columns/${c.id}`, { cookie: b.cookie, method: "DELETE" });
  await request(`/personal-columns/${bw.personalColumns[0].id}`, { cookie: b.cookie, method: "DELETE", status: 409 });
  console.log("Personal board API checks passed: upgrade, create, move, order, rename, status, delete guards and cross-user privacy.");
  if (process.argv.includes("--keep")) {
    await writeFile("/tmp/lcteam-personal-test.json", JSON.stringify(fixtures), { mode: 0o600 });
    console.log("Temporary UI test fixtures saved. Remove after browser verification.");
    keep = true;
  }
} finally {
  if (!keep) {
    await pool.query("DELETE FROM tasks WHERE creator_id = ANY($1::int[])", [ids]);
    await pool.query("DELETE FROM personal_columns WHERE user_id = ANY($1::int[])", [ids]);
    await pool.query("DELETE FROM users WHERE id = ANY($1::int[])", [ids]);
  }
  await pool.end();
}
