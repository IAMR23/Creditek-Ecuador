const { sequelize } = require("../config/db");
const Periodo = require("../models/PagoComisionPeriodo");
const Observacion = require("../models/PagoComisionSancionObservacion");
const Usuario = require("../models/Usuario");
const { actualizarValoresMultas, obtenerReportePagosComisiones } = require("./pagosComisionesService");

describe("Observacion mensual de sanciones", () => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  let registro;
  beforeEach(() => {
    jest.spyOn(Periodo, "findOne").mockResolvedValue(null);
    jest.spyOn(Observacion, "upsert").mockResolvedValue([{}, true]);
    registro = { observacionesVendedores: { 3: "Conservar" }, reload: jest.fn().mockResolvedValue(), update: jest.fn().mockResolvedValue() };
    jest.spyOn(Observacion, "findOrCreate").mockResolvedValue([registro]);
    jest.spyOn(Usuario, "findAll").mockResolvedValue([{ id: 1 }, { id: 2 }]);
    jest.spyOn(sequelize, "transaction").mockImplementation((callback) => callback(transaction));
  });
  afterEach(() => jest.restoreAllMocks());

  test("guarda todas las notas y permite borrar una sin tocar otros vendedores", async () => {
    await actualizarValoresMultas({ year: 2026, month: 9, ajustes: [], actualizadoPorId: 7,
      observacionesVendedores: [{ usuarioId: 1, observacion: "Acuerdo" }, { usuarioId: 2, observacion: "" }],
    });
    expect(registro.reload).toHaveBeenCalledWith({ transaction, lock: "UPDATE" });
    expect(registro.update).toHaveBeenCalledWith({
      observacionesVendedores: { 1: "Acuerdo", 2: "", 3: "Conservar" }, actualizadoPorId: 7,
    }, { transaction });
  });

  test.each([
    [{ usuarioId: 1, observacion: "a" }, { usuarioId: 1, observacion: "b" }],
    [{ usuarioId: -1, observacion: "a" }],
    [{ usuarioId: 1, observacion: null }],
    [{ usuarioId: 1, observacion: "a".repeat(5001) }],
  ])("rechaza notas invalidas antes de escribir", async (...notas) => {
    await expect(actualizarValoresMultas({ year: 2026, month: 9, ajustes: [], observacionesVendedores: notas }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(registro.update).not.toHaveBeenCalled();
  });

  test("rechaza vendedores inexistentes", async () => {
    Usuario.findAll.mockResolvedValue([]);
    await expect(actualizarValoresMultas({ year: 2026, month: 9, ajustes: [], observacionesVendedores: [{ usuarioId: 1, observacion: "a" }] }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(registro.update).not.toHaveBeenCalled();
  });

  test("bloquea las observaciones individuales de un periodo pagado", async () => {
    Periodo.findOne.mockResolvedValue({ estado: "PAGADO" });
    await expect(actualizarValoresMultas({ year: 2026, month: 9, ajustes: [], observacionesVendedores: [{ usuarioId: 1, observacion: "a" }] }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(registro.update).not.toHaveBeenCalled();
  });

  test.each(["Acuerdo del mes", ""])("guarda o borra la nota sin modificar descuentos: %s", async (nota) => {
    await actualizarValoresMultas({ year: 2026, month: 9, ajustes: [], observacionSanciones: nota, actualizadoPorId: 7 });
    expect(Observacion.upsert).toHaveBeenCalledWith({
      anio: 2026, mes: 9, observacion: nota, actualizadoPorId: 7,
    }, { transaction, fields: ["anio", "mes", "observacion", "actualizadoPorId"] });
  });

  test.each([null, 123, {}, "a".repeat(5001)])("rechaza observaciones invalidas", async (nota) => {
    await expect(actualizarValoresMultas({ year: 2026, month: 9, ajustes: [], observacionSanciones: nota }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(Observacion.upsert).not.toHaveBeenCalled();
  });

  test("mantiene la validacion de solicitudes vacias anteriores", async () => {
    await expect(actualizarValoresMultas({ year: 2026, month: 9, ajustes: [] }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test("bloquea cambios de observacion en periodos pagados", async () => {
    Periodo.findOne.mockResolvedValue({ estado: "PAGADO" });
    await expect(actualizarValoresMultas({ year: 2026, month: 9, ajustes: [], observacionSanciones: "Cambio" }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(Observacion.upsert).not.toHaveBeenCalled();
  });

  test("propaga los errores de persistencia", async () => {
    Observacion.upsert.mockRejectedValue(new Error("Fallo de escritura"));
    await expect(actualizarValoresMultas({ year: 2026, month: 9, ajustes: [], observacionSanciones: "Nota" }))
      .rejects.toThrow("Fallo de escritura");
  });

  test("recupera la observacion congelada al consultar un periodo pagado", async () => {
    Periodo.findOne.mockResolvedValue({
      anio: 2026, mes: 9, activo: true, estado: "PAGADO",
      reporteSnapshot: { year: 2026, month: 9, observacionSanciones: "Nota guardada" },
    });
    const reporte = await obtenerReportePagosComisiones({ year: 2026, month: 9 });
    expect(reporte.observacionSanciones).toBe("Nota guardada");
    expect(reporte.estadoPago.pagado).toBe(true);
  });
});
