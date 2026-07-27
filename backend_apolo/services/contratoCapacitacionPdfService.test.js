const assert = require("node:assert/strict");
const { test } = require("node:test");
const { PDFDocument } = require("pdf-lib");

const {
  construirComparecencia,
  generarContratoCapacitacionPdf,
  normalizarDatosContrato,
} = require("./contratoCapacitacionPdfService");

test("normaliza los datos variables del contrato", () => {
  const datos = normalizarDatosContrato({
    nombreCompleto: "  María   José Pérez  ",
    cedula: " 0102030405 ",
  });

  assert.deepEqual(datos, {
    nombre: "MARÍA JOSÉ PÉREZ",
    cedula: "0102030405",
  });
  assert.match(construirComparecencia(datos), /MARÍA JOSÉ PÉREZ/);
  assert.match(construirComparecencia(datos), /0102030405/);
});

test("genera un PDF de cuatro paginas desde la plantilla", async () => {
  const bytes = await generarContratoCapacitacionPdf({
    nombreCompleto: "María José Pérez Cárdenas",
    cedula: "0102030405",
  });
  const document = await PDFDocument.load(bytes);

  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  assert.equal(document.getPageCount(), 4);
  assert.match(document.getTitle(), /MARÍA JOSÉ PÉREZ CÁRDENAS/);
});

test("rechaza un contrato sin nombre o sin cedula", async () => {
  await assert.rejects(
    generarContratoCapacitacionPdf({
      nombreCompleto: "",
      cedula: "0102030405",
    }),
    (error) =>
      error.statusCode === 422 &&
      /nombre completo/i.test(error.message),
  );

  await assert.rejects(
    generarContratoCapacitacionPdf({
      nombreCompleto: "Postulante de Prueba",
      cedula: "",
    }),
    (error) =>
      error.statusCode === 422 &&
      /c[eé]dula/i.test(error.message),
  );
});

test("ajusta la tipografia para un nombre largo valido", async () => {
  const bytes = await generarContratoCapacitacionPdf({
    nombreCompleto:
      "María Fernanda de los Ángeles Rodríguez Villavicencio Cárdenas",
    cedula: "0102030405",
  });
  const document = await PDFDocument.load(bytes);

  assert.equal(document.getPageCount(), 4);
});
