const ExcelJS = require("exceljs");

jest.mock("../models/UphoneSolicitud", () => ({}));

const { parsearExcel } = require("./uphoneSolicitudesService");

const HEADERS = [
  "DISTRIBUIDOR",
  "MATRIZ",
  "VENDEDOR",
  "NUMERO DE SOLICTUD",
  "USUARIO",
  "CÉDULA",
  "CLIENTE",
  "TELÉFONO SOLICITUD",
  "TELÉFONO CONTRATO",
  "FECHA SOLICITUD",
  "FECHA CONTRATO",
  "GRUPO ARRENDAMIENTO",
  "ESTADO",
  "ESTADO CONTRATO",
];

const crearExcel = async (headers = HEADERS) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("ReportUphone1");
  sheet.addRow(["REPORTE SOLICITUDES"]);
  sheet.addRow(headers);
  sheet.addRow([
    "CREDI-TECK CHILLOGALLO",
    "CREDI-TECK MATRIZ",
    "VENDEDOR PRUEBA",
    4795152,
    "USER2026",
    "0123456789",
    "CLIENTE PRUEBA",
    "0999999999",
    "S/N",
    new Date("2026-09-28T09:17:01.000Z"),
    "NO APLICA",
    "D-PREMIUM DPR",
    "PENDIENTE",
    "SOLICITUD_APROBADA_AUTOMATICO",
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
};

describe("uphoneSolicitudesService.parsearExcel", () => {
  test("lee el formato real y normaliza el numero de solicitud", async () => {
    const parsed = await parsearExcel(await crearExcel());

    expect(parsed.sheetName).toBe("ReportUphone1");
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      numeroSolicitud: "4795152",
      vendedor: "VENDEDOR PRUEBA",
      cedula: "0123456789",
      estado: "PENDIENTE",
    });
    expect(parsed.records[0].fechaSolicitud.toISOString()).toBe("2026-09-28T14:17:01.000Z");
  });

  test("acepta el encabezado SOLICITUD escrito correctamente", async () => {
    const headers = HEADERS.map((header) =>
      header === "NUMERO DE SOLICTUD" ? "NÚMERO DE SOLICITUD" : header,
    );
    const parsed = await parsearExcel(await crearExcel(headers));
    expect(parsed.records[0].numeroSolicitud).toBe("4795152");
  });

  test("rechaza archivos que no contienen todas las columnas requeridas", async () => {
    await expect(parsearExcel(await crearExcel(HEADERS.slice(0, -1)))).rejects.toMatchObject({
      code: "COLUMNAS_FALTANTES",
      statusCode: 400,
    });
  });
});
