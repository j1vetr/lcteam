import assert from "node:assert/strict";
import test from "node:test";
import { canDeleteTask } from "../src/lib/task-permissions.ts";

test("a member cannot delete a board task, including one they created", () => {
  const member = { id: 10, role: "member" };
  assert.equal(canDeleteTask(member, { boardId: 1, creatorId: 20 }), false);
  assert.equal(canDeleteTask(member, { boardId: 1, creatorId: 10 }), false);
});

test("only the admin role can delete board tasks", () => {
  assert.equal(canDeleteTask({ id: 10, role: "admin" }, { boardId: 1, creatorId: 20 }), true);
  assert.equal(canDeleteTask({ id: 10, role: "owner" }, { boardId: 1, creatorId: 10 }), false);
});

test("personal tasks can only be deleted by their own creator", () => {
  for (const role of ["member", "admin"]) {
    assert.equal(canDeleteTask({ id: 10, role }, { boardId: null, creatorId: 10 }), true);
    assert.equal(canDeleteTask({ id: 10, role }, { boardId: null, creatorId: 20 }), false);
  }
});
