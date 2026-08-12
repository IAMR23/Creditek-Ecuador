const { Op } = require("sequelize");
const { sequelize } = require("../../config/db");
const ControlFinancieroCarga = require("../../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../../models/ControlFinancieroRegistro");
const Usuario = require("../../models/Usuario");
const {
  conciliarCarga,
  confirmarCoincidenciaManual,
  obtenerConciliacionCarga,
} = require("../../services/conciliacionEntradasService");
const {
  construirCoberturaReportes,
  obtenerFechaActualEcuadorIso,
} = require("../../services/controlFinancieroService");

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

const includeResponsablePagoEntrada = {
  model: Usuario,
  as: "responsablePagoEntrada",
  attributes: ["id", "nombre", "activo"],
  required: false,
};

const ESTADOS_CARGA = ["ACTIVA", "ANULADA", "REEMPLAZADA"];
const ESTADOS_FILTRO = [...ESTADOS_CARGA, "TODAS"];
const ESTADOS_PAGO_ENTRADA = ["PENDIENTE", "PAGADO"];

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const esFechaIso = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [, anioTexto, mesTexto, diaTexto] = match;
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
};

const responderErrorConciliacion = (error, res, fallback) => {
  console.error(fallback, error);
  return res.status(Number(error.status) || 500).json({
    ok: false,
    code: error.code || undefined,
    message:
      Number(error.status) && Number(error.status) < 500
        ? error.message
        : fallback,
  });
};

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

exports.obtenerCoberturaReportes = async (req, res) => {
  try {
    const hoy = obtenerFechaActualEcuadorIso();
    const fechaFin = req.query.fechaFin || hoy;
    const fechaInicio = req.query.fechaInicio || `${fechaFin.slice(0, 7)}-01`;

    if (
      !esFechaIso(fechaInicio) ||
      !esFechaIso(fechaFin) ||
      fechaInicio > fechaFin ||
      fechaFin > hoy
    ) {
      return res.status(400).json({
        ok: false,
        message: "El rango de cobertura debe ser valido y no puede superar hoy.",
      });
    }

    const cargas = await ControlFinancieroCarga.findAll({
      where: {
        estado: "ACTIVA",
        fechaReporte: { [Op.between]: [fechaInicio, fechaFin] },
      },
      attributes: [
        "id",
        "fechaReporte",
        "estado",
        "registrosVentasTv",
        "registrosVentasCelular",
      ],
      order: [["fechaReporte", "ASC"], ["id", "ASC"]],
    });
    const cobertura = construirCoberturaReportes({
      cargas,
      fechaInicio,
      fechaFin,
    });

    return res.json({ ok: true, cobertura });
  } catch (error) {
    console.error("Error obteniendo cobertura de reportes financieros:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo calcular la cobertura de reportes.",
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
          include: [includeResponsablePagoEntrada],
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
      include: [includeResponsablePagoEntrada],
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

exports.listarResponsablesPagoEntrada = async (_req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      where: { activo: true },
      attributes: ["id", "nombre"],
      order: [["nombre", "ASC"], ["id", "ASC"]],
    });

    return res.json({
      ok: true,
      usuarios: usuarios.map((usuario) =>
        usuario.get ? usuario.get({ plain: true }) : usuario,
      ),
    });
  } catch (error) {
    console.error("Error listando responsables de entradas:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron cargar los usuarios responsables.",
    });
  }
};

exports.actualizarPagoEntrada = async (req, res) => {
  try {
    const registroId = Number(req.params.registroId);
    const estadoPagoEntrada = String(req.body?.estado || "")
      .trim()
      .toUpperCase();
    const responsablePagoEntradaId = Number(req.body?.responsableUsuarioId);
    const observacionPagoEntrada = String(req.body?.observacion || "").trim();

    if (!Number.isInteger(registroId) || registroId < 1) {
      return res.status(400).json({
        ok: false,
        message: "El registro financiero no es valido.",
      });
    }
    if (!ESTADOS_PAGO_ENTRADA.includes(estadoPagoEntrada)) {
      return res.status(400).json({
        ok: false,
        message: "El estado debe ser PENDIENTE o PAGADO.",
      });
    }
    if (
      !Number.isInteger(responsablePagoEntradaId) ||
      responsablePagoEntradaId < 1
    ) {
      return res.status(400).json({
        ok: false,
        message: "Selecciona un usuario responsable del pago.",
      });
    }
    if (observacionPagoEntrada.length > 1000) {
      return res.status(400).json({
        ok: false,
        message: "La observacion no puede superar 1000 caracteres.",
      });
    }

    const resultado = await sequelize.transaction(async (transaction) => {
      const registro = await ControlFinancieroRegistro.findByPk(registroId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!registro) {
        return { error: true, status: 404, message: "Registro no encontrado." };
      }
      if (!["VENTA_TV", "VENTA_CELULAR"].includes(registro.tipoRegistro)) {
        return {
          error: true,
          status: 400,
          message: "La gestion de pagos solo aplica a registros de ventas.",
        };
      }
      if (Number(registro.entradas || 0) <= 0) {
        return {
          error: true,
          status: 400,
          message: "El registro no tiene un valor de entrada para gestionar.",
        };
      }

      const carga = await ControlFinancieroCarga.findByPk(registro.cargaId, {
        attributes: ["id", "estado"],
        transaction,
      });
      if (!carga || carga.estado !== "ACTIVA") {
        return {
          error: true,
          status: 409,
          message: "Solo se pueden actualizar registros de cargas activas.",
        };
      }

      const responsable = await Usuario.findOne({
        where: { id: responsablePagoEntradaId, activo: true },
        attributes: ["id", "nombre", "activo"],
        transaction,
      });
      if (!responsable) {
        return {
          error: true,
          status: 400,
          message: "El usuario responsable no existe o se encuentra inactivo.",
        };
      }

      await registro.update(
        {
          estadoPagoEntrada,
          responsablePagoEntradaId,
          observacionPagoEntrada: observacionPagoEntrada || null,
        },
        { transaction },
      );

      const registroPlano = registro.get
        ? registro.get({ plain: true })
        : registro;
      const responsablePlano = responsable.get
        ? responsable.get({ plain: true })
        : responsable;

      return {
        registro: serializarRegistro({
          ...registroPlano,
          responsablePagoEntrada: responsablePlano,
        }),
      };
    });

    if (resultado.error) {
      return res.status(resultado.status).json({
        ok: false,
        message: resultado.message,
      });
    }

    return res.json({
      ok: true,
      message: "La gestion del pago fue guardada.",
      registro: resultado.registro,
    });
  } catch (error) {
    console.error("Error actualizando gestion de pago de entrada:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo guardar la gestion del pago.",
    });
  }
};

exports.obtenerConciliacionEntradas = async (req, res) => {
  try {
    const resultado = await obtenerConciliacionCarga(req.params.cargaId);
    return res.json({
      ok: true,
      carga: resultado.carga,
      conciliacion: resultado.conciliacion,
      message: resultado.conciliacion
        ? undefined
        : "La carga aun no tiene una conciliacion de entradas.",
    });
  } catch (error) {
    return responderErrorConciliacion(
      error,
      res,
      "No se pudo cargar la conciliacion de entradas.",
    );
  }
};

exports.reconciliarEntradas = async (req, res) => {
  try {
    const conciliacion = await conciliarCarga({
      cargaId: req.params.cargaId,
      origen: "MANUAL",
      usuarioId: req.user?.id,
    });
    return res.json({
      ok: true,
      message: "La conciliacion de entradas fue ejecutada correctamente.",
      conciliacion,
    });
  } catch (error) {
    return responderErrorConciliacion(
      error,
      res,
      "No se pudo ejecutar la conciliacion de entradas.",
    );
  }
};

exports.confirmarConciliacionEntrada = async (req, res) => {
  try {
    const conciliacion = await confirmarCoincidenciaManual({
      cargaId: req.params.cargaId,
      resultadoId: req.params.resultadoId,
      clienteControlNormalizado: req.body?.clienteControlNormalizado,
      observacion: req.body?.observacion,
      usuarioId: req.user?.id,
    });
    return res.json({
      ok: true,
      message: "La coincidencia manual fue confirmada y conciliada.",
      conciliacion,
    });
  } catch (error) {
    return responderErrorConciliacion(
      error,
      res,
      "No se pudo confirmar la coincidencia manual.",
    );
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
