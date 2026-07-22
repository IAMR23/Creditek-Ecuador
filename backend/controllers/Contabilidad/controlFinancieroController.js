const { Op } = require("sequelize");
const ControlFinancieroCarga = require("../../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../../models/ControlFinancieroRegistro");
const Usuario = require("../../models/Usuario");

const includeUsuario = {
  model: Usuario,
  as: "usuario",
  attributes: ["id", "nombre"],
};

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const esFechaIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const serializarCarga = (registro) => {
  const carga = registro.get ? registro.get({ plain: true }) : registro;
  return {
    ...carga,
    totalPagosCaja: Number(carga.totalPagosCaja || 0),
    totalVentasTv: Number(carga.totalVentasTv || 0),
    totalEntradasTv: Number(carga.totalEntradasTv || 0),
    totalVentasCelular: Number(carga.totalVentasCelular || 0),
    totalEntradasCelular: Number(carga.totalEntradasCelular || 0),
  };
};

const serializarRegistro = (registro) => {
  const item = registro.get ? registro.get({ plain: true }) : registro;
  return {
    ...item,
    pagosCuotas: Number(item.pagosCuotas || 0),
    ventas: Number(item.ventas || 0),
    entradas: Number(item.entradas || 0),
  };
};

exports.listarCargas = async (req, res) => {
  try {
    const pagina = parsePositiveInt(req.query.pagina, 1, 100000);
    const limite = parsePositiveInt(req.query.limite, 20, 100);
    const fechaInicio = req.query.fechaInicio;
    const fechaFin = req.query.fechaFin;

    if (
      (fechaInicio && !esFechaIso(fechaInicio)) ||
      (fechaFin && !esFechaIso(fechaFin)) ||
      (fechaInicio && fechaFin && fechaInicio > fechaFin)
    ) {
      return res.status(400).json({
        ok: false,
        message: "El rango de fechas no es valido.",
      });
    }

    const where = {};
    if (fechaInicio || fechaFin) {
      where.fechaReporte = {};
      if (fechaInicio) {
        where.fechaReporte[Op.gte] = fechaInicio;
      }
      if (fechaFin) {
        where.fechaReporte[Op.lte] = fechaFin;
      }
    }

    const { rows, count } = await ControlFinancieroCarga.findAndCountAll({
      where,
      include: [includeUsuario],
      distinct: true,
      limit: limite,
      offset: (pagina - 1) * limite,
      order: [["fechaReporte", "DESC"], ["createdAt", "DESC"], ["id", "DESC"]],
    });

    return res.json({
      ok: true,
      cargas: rows.map(serializarCarga),
      paginacion: {
        pagina,
        limite,
        total: count,
        totalPaginas: Math.max(1, Math.ceil(count / limite)),
      },
    });
  } catch (error) {
    console.error("Error listando cargas de control financiero:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron cargar los registros de control financiero.",
    });
  }
};

exports.obtenerCarga = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ ok: false, message: "Carga no valida." });
    }

    const carga = await ControlFinancieroCarga.findByPk(id, {
      include: [includeUsuario],
    });
    if (!carga) {
      return res.status(404).json({
        ok: false,
        message: "Carga de control financiero no encontrada.",
      });
    }

    const registros = await ControlFinancieroRegistro.findAll({
      where: { cargaId: id },
      order: [["id", "ASC"]],
    });
    const agrupados = {
      caja: [],
      ventasTv: [],
      ventasCelular: [],
    };

    registros.map(serializarRegistro).forEach((registro) => {
      if (registro.tipoRegistro === "CAJA") agrupados.caja.push(registro);
      if (registro.tipoRegistro === "VENTA_TV") agrupados.ventasTv.push(registro);
      if (registro.tipoRegistro === "VENTA_CELULAR") {
        agrupados.ventasCelular.push(registro);
      }
    });

    return res.json({
      ok: true,
      carga: serializarCarga(carga),
      registros: agrupados,
    });
  } catch (error) {
    console.error("Error obteniendo carga de control financiero:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo cargar el detalle de control financiero.",
    });
  }
};

exports.eliminarCarga = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ ok: false, message: "Carga no valida." });
    }

    const carga = await ControlFinancieroCarga.findByPk(id);
    if (!carga) {
      return res.status(404).json({
        ok: false,
        message: "Carga de control financiero no encontrada.",
      });
    }

    await carga.destroy();

    return res.json({
      ok: true,
      message: "La carga y sus registros fueron eliminados.",
      cargaId: id,
    });
  } catch (error) {
    console.error("Error eliminando carga de control financiero:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo eliminar la carga de control financiero.",
    });
  }
};

exports.serializarCarga = serializarCarga;
exports.serializarRegistro = serializarRegistro;
