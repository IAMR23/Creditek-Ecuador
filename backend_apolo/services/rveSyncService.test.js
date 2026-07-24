const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");

const {
  construirUrlSalidaRve,
  sincronizarSalidaUsuarioRve,
} = require("./rveSyncService");

const entornoOriginal = {
  RVE_SYNC_URL: process.env.RVE_SYNC_URL,
  RVE_SYNC_TOKEN: process.env.RVE_SYNC_TOKEN,
};

afterEach(() => {
  if (entornoOriginal.RVE_SYNC_URL === undefined) {
    delete process.env.RVE_SYNC_URL;
  } else {
    process.env.RVE_SYNC_URL = entornoOriginal.RVE_SYNC_URL;
  }

  if (entornoOriginal.RVE_SYNC_TOKEN === undefined) {
    delete process.env.RVE_SYNC_TOKEN;
  } else {
    process.env.RVE_SYNC_TOKEN = entornoOriginal.RVE_SYNC_TOKEN;
  }
});

test("construye la URL desde una base o acepta el endpoint completo", () => {
  assert.equal(
    construirUrlSalidaRve("http://localhost:5020/"),
    "http://localhost:5020/api/integraciones/abs/usuarios/salida",
  );
  assert.equal(
    construirUrlSalidaRve(
      "https://rve.example/api/integraciones/abs/usuarios/salida",
    ),
    "https://rve.example/api/integraciones/abs/usuarios/salida",
  );
});

test("envia cedula, fecha y token con fetch nativo", async (t) => {
  process.env.RVE_SYNC_URL = "http://rve-interno:5020";
  process.env.RVE_SYNC_TOKEN = "secreto-compartido";
  let peticion;

  t.mock.method(global, "fetch", async (url, options) => {
    peticion = { url, options };
    return new Response(
      JSON.stringify({ ok: true, sincronizado: true }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  });

  const resultado = await sincronizarSalidaUsuarioRve({
    cedula: " 0102030405 ",
    fechaSalida: "2026-07-24",
  });

  assert.equal(
    peticion.url,
    "http://rve-interno:5020/api/integraciones/abs/usuarios/salida",
  );
  assert.equal(peticion.options.method, "PATCH");
  assert.equal(
    peticion.options.headers["x-internal-token"],
    "secreto-compartido",
  );
  assert.deepEqual(JSON.parse(peticion.options.body), {
    cedula: "0102030405",
    fechaSalida: "2026-07-24",
    desactivar: false,
    origen: "ABS_MOVIMIENTOS_TERMINALES",
  });
  assert.deepEqual(resultado, { ok: true, sincronizado: true });
});

test("omite la sincronizacion con cedula vacia sin impedir el flujo local", async (t) => {
  let fetchInvocado = false;
  t.mock.method(global, "fetch", async () => {
    fetchInvocado = true;
  });
  t.mock.method(console, "warn", () => {});

  const resultado = await sincronizarSalidaUsuarioRve({
    cedula: " ",
    fechaSalida: "2026-07-24",
  });

  assert.equal(fetchInvocado, false);
  assert.equal(resultado.omitido, true);
  assert.equal(resultado.motivo, "CEDULA_VACIA");
});
