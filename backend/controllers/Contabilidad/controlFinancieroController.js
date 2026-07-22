const { Op } = require("sequelize");
const { sequelize } = require("../../config/db");
const ControlFinancieroCarga = require("../../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../../models/ControlFinancieroRegistro");
const Usuario = require("../../models/Usuario");

const includeUsuario = {
  model: Usuario,
  as: "usuario",
  attributes: ["id", "nombre"],
};

const includeUsuarioAnulador = {
  model: Usuario,
  as: "usuarioAnulador",
  attributes: ["id", "nombre"],
};

const ESTADOS_CARGA = ["ACTIVA", "ANULADA", "REEMPLAZADA"];
const ESTADOS_FILTRO = [...ESTADOS_CARGA, "TODAS"];

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
    const estado = String(req.query.estado || "ACTIVA").trim().toUpperCase();

    if (!ESTADOS_FILTRO.includes(estado)) {
      return res.status(400).json({
        ok: false,
        message: "El estado solicitado no es valido.",
      });
    }

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
    if (estado !== "TODAS") where.estado = estado;
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
      include: [includeUsuario, includeUsuarioAnulador],
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

exports.consolidarVentas = async (req, res) => {
  try {
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

    const where = { estado: "ACTIVA" };
    if (fechaInicio || fechaFin) {
      where.fechaReporte = {};
      if (fechaInicio) where.fechaReporte[Op.gte] = fechaInicio;
      if (fechaFin) where.fechaReporte[Op.lte] = fechaFin;
    }

    const cargas = await ControlFinancieroCarga.findAll({
      where,
      attributes: [
        "id",
        "registrosVentasTv",
        "registrosVentasCelular",
        "totalVentasTv",
        "totalEntradasTv",
        "totalVentasCelular",
        "totalEntradasCelular",
      ],
      order: [["fechaReporte", "DESC"], ["id", "DESC"]],
    });
    const cargaIds = cargas.map((carga) => carga.id);
    const registros = cargaIds.length
      ? await ControlFinancieroRegistro.findAll({
          where: {
            cargaId: { [Op.in]: cargaIds },
            tipoRegistro: { [Op.in]: ["VENTA_TV", "VENTA_CELULAR"] },
          },
          order: [["cargaId", "DESC"], ["id", "ASC"]],
        })
      : [];
    const agrupados = { ventasTv: [], ventasCelular: [] };

    registros.map(serializarRegistro).forEach((registro) => {
      if (registro.tipoRegistro === "VENTA_TV") {
        agrupados.ventasTv.push(registro);
      }
      if (registro.tipoRegistro === "VENTA_CELULAR") {
        agrupados.ventasCelular.push(registro);
      }
    });

    const sumar = (campo) =>
      cargas.reduce((total, carga) => total + Number(carga[campo] || 0), 0);
    const sumarMoneda = (campo) => Number(sumar(campo).toFixed(2));

    return res.json({
      ok: true,
      resumen: {
        cargas: cargas.length,
        registrosVentasTv: sumar("registrosVentasTv"),
        registrosVentasCelular: sumar("registrosVentasCelular"),
        totalVentasTv: sumarMoneda("totalVentasTv"),
        totalEntradasTv: sumarMoneda("totalEntradasTv"),
        totalVentasCelular: sumarMoneda("totalVentasCelular"),
        totalEntradasCelular: sumarMoneda("totalEntradasCelular"),
      },
      registros: agrupados,
    });
  } catch (error) {
    console.error("Error consolidando ventas de control financiero:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo generar el consolidado de ventas.",
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
      include: [includeUsuario, includeUsuarioAnulador],
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

exports.anularCarga = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ ok: false, message: "Carga no valida." });
    }

    const motivoAnulacion = String(req.body?.motivo || "").trim();
    if (!motivoAnulacion) {
      return res.status(400).json({
        ok: false,
        message: "El motivo de anulacion es obligatorio.",
      });
    }
    if (motivoAnulacion.length > 1000) {
      return res.status(400).json({
        ok: false,
        message: "El motivo de anulacion no puede superar 1000 caracteres.",
      });
    }

    const anuladoPor = Number(req.user?.id);
    if (!Number.isInteger(anuladoPor) || anuladoPor < 1) {
      return res.status(401).json({
        ok: false,
        message: "No se pudo identificar al usuario que anula la carga.",
      });
    }

    const resultado = await sequelize.transaction(async (transaction) => {
      const carga = await ControlFinancieroCarga.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!carga) return { estado: "NO_ENCONTRADA" };
      if (carga.estado !== "ACTIVA") {
        return { estado: "NO_ACTIVA", estadoActual: carga.estado };
      }

      await carga.update(
        {
          estado: "ANULADA",
          motivoAnulacion,
          anuladoPor,
          anuladoEn: new Date(),
        },
        { transaction },
      );

      return { estado: "ANULADA", carga };
    });

    if (resultado.estado === "NO_ENCONTRADA") {
      return res.status(404).json({
        ok: false,
        message: "Carga de control financiero no encontrada.",
      });
    }

    if (resultado.estado === "NO_ACTIVA") {
      return res.status(409).json({
        ok: false,
        message: `La carga ya se encuentra en estado ${resultado.estadoActual}.`,
      });
    }

    return res.json({
      ok: true,
      message: "La carga fue anulada y sus registros se conservaron.",
      carga: serializarCarga(resultado.carga),
    });
  } catch (error) {
    console.error("Error anulando carga de control financiero:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo anular la carga de control financiero.",
    });
  }
};

exports.serializarCarga = serializarCarga;
exports.serializarRegistro = serializarRegistro;
