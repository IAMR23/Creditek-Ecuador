const { Op } = require("sequelize");
const PresupuestoMarketing = require("../../models/Marketing/PresupuestoMarketing");
const GastoMarketing = require("../../models/Marketing/GastoMarketing");
const auditoriaVentasController = require("../Auditoria/auditoriaVentasController");
const {
  calcularEstadisticasVentas,
} = require("../../utils/calcularEstadisticasVentas");

const CATEGORIAS_GASTO = ["REDES", "VOLANTES", "CAMISETAS", "GLOBOS", "OTROS"];
const DIA_INICIO_SEMANA = 4; // Jueves. La semana operativa cierra miercoles.

const redondear = (valor) => Number((Number(valor) || 0).toFixed(2));

const fechaToLocalDate = (fecha) => {
  const [year, month, day] = String(fecha).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const dateToISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const sumarDias = (date, dias) => {
  const copia = new Date(date);
  copia.setDate(copia.getDate() + dias);
  return copia;
};

const obtenerInicioSemanaJueves = (date) => {
  const diferencia = (date.getDay() - DIA_INICIO_SEMANA + 7) % 7;
  return sumarDias(date, -diferencia);
};

const parseEntero = (valor, campo, { min, max } = {}) => {
  if (valor === null || valor === undefined || valor === "") {
    return { error: `${campo} es obligatorio` };
  }

  const numero = Number(valor);
  if (!Number.isInteger(numero)) {
    return { error: `${campo} debe ser un numero entero` };
  }

  if (min !== undefined && numero < min) {
    return { error: `${campo} debe ser mayor o igual a ${min}` };
  }

  if (max !== undefined && numero > max) {
    return { error: `${campo} debe ser menor o igual a ${max}` };
  }

  return { value: numero };
};

const parseDecimalNoNegativo = (valor, campo) => {
  if (valor === null || valor === undefined || valor === "") {
    return { error: `${campo} es obligatorio` };
  }

  const normalizado = typeof valor === "string" ? valor.replace(",", ".") : valor;
  const numero = Number(normalizado);

  if (!Number.isFinite(numero)) {
    return { error: `${campo} invalido` };
  }

  if (numero < 0) {
    return { error: `${campo} no puede ser negativo` };
  }

  const decimales = String(normalizado).split(".")[1];
  if (decimales && decimales.length > 2) {
    return { error: `${campo} solo puede tener hasta 2 decimales` };
  }

  return { value: Number(numero.toFixed(2)) };
};

const validarFecha = (fecha, campo = "fecha") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha || ""))) {
    return { error: `${campo} debe tener formato YYYY-MM-DD` };
  }

  const date = fechaToLocalDate(fecha);
  if (Number.isNaN(date.getTime())) {
    return { error: `${campo} invalida` };
  }

  return { value: fecha, date };
};

const resolverSemanaOperativa = ({ fechaInicio }) => {
  const fecha = validarFecha(fechaInicio, "fechaInicio");
  if (fecha.error) return fecha;

  const inicio = obtenerInicioSemanaJueves(fecha.date);
  const fin = sumarDias(inicio, 6);

  return {
    fechaInicio: dateToISO(inicio),
    fechaFin: dateToISO(fin),
    mes: inicio.getMonth() + 1,
    anio: inicio.getFullYear(),
  };
};

const resolverSemanaDesdeQuery = (query) => {
  if (query.fechaInicio) {
    return resolverSemanaOperativa(query);
  }

  if (query.mes && query.anio) {
    const mes = parseEntero(query.mes, "mes", { min: 1, max: 12 });
    if (mes.error) return mes;

    const anio = parseEntero(query.anio, "anio", { min: 2000, max: 2100 });
    if (anio.error) return anio;

    return resolverSemanaOperativa({
      fechaInicio: `${anio.value}-${String(mes.value).padStart(2, "0")}-01`,
    });
  }

  return { error: "fechaInicio es obligatorio" };
};

const obtenerWherePresupuesto = (query) => {
  const where = {};

  if (query.activo !== undefined) where.activo = String(query.activo) === "true";

  const semana = resolverSemanaDesdeQuery(query);
  if (!semana.error) {
    where.fechaInicio = semana.fechaInicio;
    where.fechaFin = semana.fechaFin;
  }

  return where;
};

const obtenerWhereGastos = (query) => {
  const where = {};

  if (query.categoria && query.categoria !== "TODAS") {
    where.categoria = String(query.categoria).toUpperCase();
  }

  const semana = resolverSemanaDesdeQuery(query);
  if (!semana.error) {
    where.fecha = { [Op.between]: [semana.fechaInicio, semana.fechaFin] };
  }

  return where;
};

const validarPresupuestoPayload = async (body) => {
  const semana = resolverSemanaOperativa(body);
  if (semana.error) return semana;

  const presupuesto = parseDecimalNoNegativo(
    body.presupuestoAsignado,
    "presupuestoAsignado",
  );
  if (presupuesto.error) return presupuesto;

  const metaVentas = parseEntero(body.metaVentas, "metaVentas", { min: 0 });
  if (metaVentas.error) return metaVentas;

  return {
    data: {
      fechaInicio: semana.fechaInicio,
      fechaFin: semana.fechaFin,
      mes: semana.mes,
      anio: semana.anio,
      presupuestoAsignado: presupuesto.value,
      metaVentas: metaVentas.value,
      descripcion: body.descripcion?.trim() || null,
      activo: body.activo ?? true,
    },
  };
};

const validarGastoPayload = async (body) => {
  const fecha = validarFecha(body.fecha);
  if (fecha.error) return fecha;

  const categoria = String(body.categoria || "").trim().toUpperCase();
  if (!CATEGORIAS_GASTO.includes(categoria)) {
    return { error: "categoria invalida" };
  }

  const monto = parseDecimalNoNegativo(body.monto, "monto");
  if (monto.error) return monto;

  return {
    data: {
      fecha: fecha.value,
      categoria,
      descripcion: body.descripcion?.trim() || null,
      monto: monto.value,
    },
  };
};

const validarDuplicadoPresupuesto = async (
  { fechaInicio, fechaFin },
  excludeId,
) => {
  const where = {
    fechaInicio,
    fechaFin,
    activo: true,
  };

  if (excludeId) where.id = { [Op.ne]: excludeId };

  const existe = await PresupuestoMarketing.findOne({ where });
  return Boolean(existe);
};

const contarVentasRealizadasGerencia = async ({
  fechaInicio,
  fechaFin,
}) => {
  const ventas = await auditoriaVentasController.obtenerReporteGerencia({
    fechaInicio,
    fechaFin,
  });

  const reporte = auditoriaVentasController.formatearReporte(ventas);
  const estadisticas = calcularEstadisticasVentas(reporte, fechaInicio);

  return Number(estadisticas.totalVentas || 0);
};

exports.CATEGORIAS_GASTO = CATEGORIAS_GASTO;
exports.resolverSemanaOperativa = resolverSemanaOperativa;

exports.listarPresupuestos = async (req, res) => {
  try {
    const presupuestos = await PresupuestoMarketing.findAll({
      where: obtenerWherePresupuesto(req.query),
      order: [
        ["fechaInicio", "DESC"],
        ["id", "DESC"],
      ],
    });

    res.json(presupuestos);
  } catch (error) {
    console.error("Error listando presupuestos marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.obtenerPresupuesto = async (req, res) => {
  try {
    const presupuesto = await PresupuestoMarketing.findByPk(req.params.id);

    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }

    res.json(presupuesto);
  } catch (error) {
    console.error("Error obteniendo presupuesto marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.crearPresupuesto = async (req, res) => {
  try {
    const validacion = await validarPresupuestoPayload(req.body);
    if (validacion.error) {
      return res.status(validacion.status || 400).json({ message: validacion.error });
    }

    const duplicado = await validarDuplicadoPresupuesto(validacion.data);
    if (duplicado) {
      return res.status(409).json({
        message: "Ya existe un presupuesto activo para esta semana",
      });
    }

    const presupuesto = await PresupuestoMarketing.create(validacion.data);
    res.status(201).json(presupuesto);
  } catch (error) {
    console.error("Error creando presupuesto marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.actualizarPresupuesto = async (req, res) => {
  try {
    const presupuesto = await PresupuestoMarketing.findByPk(req.params.id);
    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }

    const validacion = await validarPresupuestoPayload(req.body);
    if (validacion.error) {
      return res.status(validacion.status || 400).json({ message: validacion.error });
    }

    const duplicado = await validarDuplicadoPresupuesto(
      validacion.data,
      presupuesto.id,
    );
    if (duplicado) {
      return res.status(409).json({
        message: "Ya existe un presupuesto activo para esta semana",
      });
    }

    await presupuesto.update(validacion.data);
    res.json(presupuesto);
  } catch (error) {
    console.error("Error actualizando presupuesto marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.eliminarPresupuesto = async (req, res) => {
  try {
    const presupuesto = await PresupuestoMarketing.findByPk(req.params.id);
    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }

    await presupuesto.update({ activo: false });
    res.json({ message: "Presupuesto desactivado correctamente" });
  } catch (error) {
    console.error("Error eliminando presupuesto marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.listarGastos = async (req, res) => {
  try {
    const gastos = await GastoMarketing.findAll({
      where: obtenerWhereGastos(req.query),
      order: [
        ["fecha", "DESC"],
        ["id", "DESC"],
      ],
    });

    res.json(gastos);
  } catch (error) {
    console.error("Error listando gastos marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.obtenerGasto = async (req, res) => {
  try {
    const gasto = await GastoMarketing.findByPk(req.params.id);

    if (!gasto) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    res.json(gasto);
  } catch (error) {
    console.error("Error obteniendo gasto marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.crearGasto = async (req, res) => {
  try {
    const validacion = await validarGastoPayload(req.body);
    if (validacion.error) {
      return res.status(validacion.status || 400).json({ message: validacion.error });
    }

    const gasto = await GastoMarketing.create(validacion.data);
    res.status(201).json(gasto);
  } catch (error) {
    console.error("Error creando gasto marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.actualizarGasto = async (req, res) => {
  try {
    const gasto = await GastoMarketing.findByPk(req.params.id);
    if (!gasto) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    const validacion = await validarGastoPayload(req.body);
    if (validacion.error) {
      return res.status(validacion.status || 400).json({ message: validacion.error });
    }

    await gasto.update(validacion.data);
    res.json(gasto);
  } catch (error) {
    console.error("Error actualizando gasto marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.eliminarGasto = async (req, res) => {
  try {
    const gasto = await GastoMarketing.findByPk(req.params.id);
    if (!gasto) {
      return res.status(404).json({ message: "Gasto no encontrado" });
    }

    await gasto.destroy();
    res.json({ message: "Gasto eliminado correctamente" });
  } catch (error) {
    console.error("Error eliminando gasto marketing:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.obtenerReporteCostoVenta = async (req, res) => {
  try {
    const semana = resolverSemanaDesdeQuery(req.query);
    if (semana.error) {
      return res.status(400).json({ message: semana.error });
    }

    const presupuesto = await PresupuestoMarketing.findOne({
      where: {
        fechaInicio: semana.fechaInicio,
        fechaFin: semana.fechaFin,
        activo: true,
      },
      order: [["id", "DESC"]],
    });

    const gastoReal = redondear(
      (await GastoMarketing.sum("monto", {
        where: {
          fecha: { [Op.between]: [semana.fechaInicio, semana.fechaFin] },
        },
      })) || 0,
    );

    const presupuestoAsignado = redondear(presupuesto?.presupuestoAsignado || 0);
    const metaVentas = Number(presupuesto?.metaVentas || 0);
    const diferencia = redondear(presupuestoAsignado - gastoReal);
    const porcentajeEjecucion =
      presupuestoAsignado === 0
        ? 0
        : redondear((gastoReal / presupuestoAsignado) * 100);
    const ventasRealizadas = await contarVentasRealizadasGerencia({
      fechaInicio: semana.fechaInicio,
      fechaFin: semana.fechaFin,
    });
    const costoPorVentaReal =
      ventasRealizadas === 0 ? 0 : redondear(gastoReal / ventasRealizadas);
    const costoPorVentaObjetivo =
      metaVentas === 0 ? 0 : redondear(presupuestoAsignado / metaVentas);
    const diferenciaPorVenta = redondear(
      costoPorVentaReal - costoPorVentaObjetivo,
    );
    const estado = !presupuesto
      ? "SIN_DATOS"
      : gastoReal > presupuestoAsignado
        ? "EXCEDIDO"
        : "DENTRO_PRESUPUESTO";

    res.json({
      fechaInicio: semana.fechaInicio,
      fechaFin: semana.fechaFin,
      presupuestoAsignado,
      gastoReal,
      diferencia,
      porcentajeEjecucion,
      ventasRealizadas,
      costoPorVentaReal,
      costoPorVentaObjetivo,
      diferenciaPorVenta,
      estado,
    });
  } catch (error) {
    console.error("Error generando reporte costo venta:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
