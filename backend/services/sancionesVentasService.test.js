jest.mock("../models/UsuarioAgencia", () => ({ findAll: jest.fn() }));
jest.mock("../models/SancionConfiguracion", () => ({ findAll: jest.fn() }));
jest.mock("../controllers/Auditoria/auditoriaVentasController", () => ({ obtenerReporteGerencia: jest.fn(), formatearReporte: jest.fn() }));
jest.mock("../utils/calcularEstadisticasVentas", () => ({ calcularEstadisticasVentas: jest.fn(() => ({})) }));
const UsuarioAgencia = require("../models/UsuarioAgencia");
const SancionConfiguracion = require("../models/SancionConfiguracion");
const auditoria = require("../controllers/Auditoria/auditoriaVentasController");
const { obtenerReporteSancionesVentas } = require("./sancionesVentasService");

test("calcula la multa solo por unidades faltantes", async () => {
  UsuarioAgencia.findAll.mockResolvedValue([{ id: 10, usuario: { id: 2, nombre: "Ana", rolPagoId: 5, rolPago: { id: 5, cargo: "VENDEDOR CALL CENTER" } }, agencia: { nombre: "Matriz" }, nominaEmpleado: null }]);
  SancionConfiguracion.findAll.mockResolvedValue([{ rolPagoId: null, cargoReferencia: "VENDEDOR CALL CENTER", periodo: "SEMANAL", minimoUnidades: 9, valorMultaUnidad: 7 }]);
  auditoria.obtenerReporteGerencia.mockResolvedValue([{ usuarioAgencia: { id: 10 }, detalleVenta: [{}, {}, {}, {}, {}, {}, {}] }]);
  auditoria.formatearReporte.mockReturnValue(new Array(7).fill({}));
  const [row] = await obtenerReporteSancionesVentas({ fechaInicio: "2026-07-01", fechaFin: "2026-07-07" });
  expect(row).toMatchObject({ unidadesVendidas: 7, unidadesFaltantes: 2, multaTotal: 14, aplicaSancion: true });
});
