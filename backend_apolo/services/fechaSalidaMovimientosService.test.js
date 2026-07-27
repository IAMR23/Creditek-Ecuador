const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");

const Asistencia = require("../models/Asistencia");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const {
  sincronizarFechaSalidaEnMovimientos,
} = require("./fechaSalidaMovimientosService");

let actualizaciones;
let upserts;

beforeEach(() => {
  actualizaciones = [];
  upserts = [];

  UsuarioAgencia.findAll = async () => [
    { id: 10, activo: true, updatedAt: new Date() },
  ];
  Asistencia.findOne = async () => null;
  Asistencia.update = async (values, options) => {
    actualizaciones.push({ values, options });
    return [1];
  };
  Asistencia.upsert = async (values, options) => {
    upserts.push({ values, options });
    return [{ id: 30, ...values }, true];
  };
});

test("crea el movimiento salida al asignar fechaSalida desde Usuarios", async () => {
  const resultado = await sincronizarFechaSalidaEnMovimientos({
    usuarioId: 5,
    fechaAnterior: null,
    fechaNueva: "2026-07-27",
    transaction: { id: "transaction" },
  });

  assert.equal(resultado.sincronizado, true);
  assert.equal(upserts.length, 1);
  assert.deepEqual(upserts[0].values, {
    usuarioAgenciaId: 10,
    fecha: "2026-07-27",
    estado: "salida",
  });
});

test("mueve la salida sin borrar la asistencia anterior", async () => {
  await sincronizarFechaSalidaEnMovimientos({
    usuarioId: 5,
    fechaAnterior: "2026-07-20",
    fechaNueva: "2026-07-27",
  });

  assert.equal(actualizaciones.length, 1);
  assert.deepEqual(actualizaciones[0].values, { estado: null });
  assert.equal(actualizaciones[0].options.where.fecha, "2026-07-20");
  assert.equal(actualizaciones[0].options.where.estado, "salida");
  assert.equal(upserts[0].values.fecha, "2026-07-27");
});

test("al limpiar fechaSalida deja libre el movimiento sin eliminarlo", async () => {
  const resultado = await sincronizarFechaSalidaEnMovimientos({
    usuarioId: 5,
    fechaAnterior: "2026-07-27",
    fechaNueva: null,
  });

  assert.equal(resultado.fechaSalida, null);
  assert.equal(actualizaciones.length, 1);
  assert.equal(upserts.length, 0);
});
