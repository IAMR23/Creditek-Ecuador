const assert = require("node:assert/strict");
const { test } = require("node:test");
const jwt = require("jsonwebtoken");
const auth = require("./auth");

const runAuth = (role, originalUrl) => {
  const token = jwt.sign(
    { usuario: { id: 1, rol: { nombre: role } } },
    process.env.JWT_SECRET || "apolo_secret",
  );
  const req = { headers: { authorization: `Bearer ${token}` }, originalUrl };
  const result = { status: null, body: null, next: false };
  const res = {
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; return this; },
  };
  auth(req, res, () => { result.next = true; });
  return result;
};

test("restringe USUARIO a /api/pruebas también en backend", () => {
  const denied = runAuth(" usuario ", "/usuarios");
  assert.equal(denied.status, 403);
  assert.equal(denied.next, false);

  const allowed = runAuth("USUARIO", "/api/pruebas/mis-intentos");
  assert.equal(allowed.next, true);
});

test("no restringe por id y permite otros roles por su nombre", () => {
  assert.equal(runAuth("ADMIN", "/usuarios").next, true);
  assert.equal(runAuth("SUPERVISOR", "/api/postulaciones/resumen").next, true);
});
