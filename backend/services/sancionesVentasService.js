const UsuarioAgencia = require("../models/UsuarioAgencia");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");
const NominaEmpleado = require("../models/NominaEmpleado");
const RolPago = require("../models/RolPago");
const SancionConfiguracion = require("../models/SancionConfiguracion");
const auditoriaVentasController = require("../controllers/Auditoria/auditoriaVentasController");
const { calcularEstadisticasVentas } = require("../utils/calcularEstadisticasVentas");

const normalizar = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
const ids = (value) => String(value || "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0);
const validarFecha = (value, nombre) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) || Number.isNaN(Date.parse(`${value}T00:00:00`))) {
    throw Object.assign(new Error(`${nombre} debe tener formato YYYY-MM-DD`), { statusCode: 400 });
  }
};

const obtenerReporteSancionesVentas = async ({ fechaInicio, fechaFin, agenciaId, vendedorId, cierreCaja } = {}) => {
  validarFecha(fechaInicio, "fechaInicio");
  validarFecha(fechaFin, "fechaFin");
  if (fechaInicio > fechaFin) throw Object.assign(new Error("fechaInicio no puede ser posterior a fechaFin"), { statusCode: 400 });

  const agenciaIds = ids(agenciaId);
  const vendedorIds = ids(vendedorId);
  const whereRelacion = { activo: true };
  if (agenciaIds.length) whereRelacion.agenciaId = agenciaIds;
  if (vendedorIds.length) whereRelacion.usuarioId = vendedorIds;

  const [ventas, relaciones, configuraciones] = await Promise.all([
    auditoriaVentasController.obtenerReporteGerencia({ fechaInicio, fechaFin, agenciaId, vendedorId, cierreCaja }),
    UsuarioAgencia.findAll({
      where: whereRelacion,
      include: [
        { model: Usuario, as: "usuario", attributes: ["id", "nombre", "activo", "rolPagoId"], where: { activo: true }, include: [{ model: RolPago, as: "rolPago", attributes: ["id", "cargo"], required: false }] },
        { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
        { model: NominaEmpleado, as: "nominaEmpleado", attributes: ["id", "rolPagoId", "cargo", "estado"], required: false, include: [{ model: RolPago, as: "rolPago", attributes: ["id", "cargo"], required: false }] },
      ],
    }),
    SancionConfiguracion.findAll({ where: { activo: true } }),
  ]);

  const reporteFormateado = auditoriaVentasController.formatearReporte(ventas);
  calcularEstadisticasVentas(reporteFormateado, fechaInicio);
  const unidadesPorRelacion = new Map();
  ventas.forEach((venta) => unidadesPorRelacion.set(Number(venta.usuarioAgencia?.id), (unidadesPorRelacion.get(Number(venta.usuarioAgencia?.id)) || 0) + (venta.detalleVenta?.length || 0)));

  const porRol = new Map();
  const porCargo = new Map();
  configuraciones.forEach((config) => {
    if (config.rolPagoId) porRol.set(Number(config.rolPagoId), config);
    if (!porCargo.has(normalizar(config.cargoReferencia))) porCargo.set(normalizar(config.cargoReferencia), config);
  });

  return relaciones.map((relacion) => {
    const nomina = relacion.nominaEmpleado;
    const rolPago = nomina?.rolPago || relacion.usuario?.rolPago || null;
    const rolPagoId = nomina?.rolPagoId || relacion.usuario?.rolPagoId || rolPago?.id || null;
    const cargo = rolPago?.cargo || "SIN ROL DE PAGO";
    const config = rolPagoId ? (porRol.get(Number(rolPagoId)) || porCargo.get(normalizar(cargo))) : null;
    const unidadesVendidas = unidadesPorRelacion.get(Number(relacion.id)) || 0;
    const minimoUnidades = config ? Number(config.minimoUnidades) : 0;
    const unidadesFaltantes = config ? Math.max(0, minimoUnidades - unidadesVendidas) : 0;
    const valorMultaUnidad = config ? Number(config.valorMultaUnidad) : 0;
    const multaTotal = Number((unidadesFaltantes * valorMultaUnidad).toFixed(2));
    return {
      usuarioId: relacion.usuario?.id,
      vendedor: relacion.usuario?.nombre || "Sin vendedor",
      agencia: relacion.agencia?.nombre || "Sin agencia",
      rolPagoId: rolPagoId || null,
      cargo,
      periodo: config?.periodo || null,
      minimoUnidades,
      unidadesVendidas,
      unidadesFaltantes,
      valorMultaUnidad,
      multaTotal,
      aplicaSancion: multaTotal > 0,
      observacion: !rolPagoId ? "No tiene rol de pago asignado" : !config ? "No existe una sancion activa configurada para este cargo" : "",
    };
  }).sort((a, b) => a.vendedor.localeCompare(b.vendedor, "es"));
};

module.exports = { obtenerReporteSancionesVentas };
