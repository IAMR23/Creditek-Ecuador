const assert = require("node:assert/strict");
const { test } = require("node:test");
const { requireAdmin } = require("./VacacionesRoutes");

const run = (role) => {
  const result = { status: null, body: null, next: false };
  const req = { user: { id: 1, rol: { nombre: role } } };
  const res = { status(value) { result.status = value; return this; }, json(value) { result.body = value; return this; } };
  requireAdmin(req, res, () => { result.next = true; });
  return result;
};

test("Vacaciones permite exclusivamente ADMIN", () => {
  assert.equal(run(" admin ").next, true);
  assert.equal(run("USUARIO").status, 403);
  assert.equal(run("SUPERVISOR").body.code, "ADMIN_REQUIRED");
});
