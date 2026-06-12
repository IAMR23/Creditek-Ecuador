const { sequelize } = require("../../config/db");

const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const Denominacion = require("../../models/CierreCaja/Denominacion");
const RetiroCaja = require("../../models/CierreCaja/RetiroCaja");
const ReaperturaCierreCaja = require("../../models/CierreCaja/ReaperturaCierreCaja");
const { Op } = require("sequelize");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Usuario = require("../../models/Usuario");
const Agencia = require("../../models/Agencia");

const ESTADOS_CIERRE_ACTIVOS = ["CERRADO", "REABIERTO"];

const obtenerFechaEcuador = (fecha = new Date()) =>
  fecha.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });

const resolverRelacionUsuarioAgencia = async (req, transaction = null) => {
  const usuarioAgenciaId = req.user?.usuarioAgenciaId || null;
  const agenciaId = req.user?.agenciaId || null;

  if (usuarioAgenciaId) {
    const relacion = await UsuarioAgencia.findOne({
      where: {
        id: usuarioAgenciaId,
        activo: true,
        ...(req.user?.id && { usuarioId: req.user.id }),
        ...(agenciaId && { agenciaId }),
      },
      attributes: ["id", "agenciaId"],
      transaction,
    });

    return {
      usuarioAgenciaId: relacion?.id || null,
      agenciaId: relacion?.agenciaId || null,
    };
  }

  if (!req.user?.id || !agenciaId) {
    return { usuarioAgenciaId: null, agenciaId: null };
  }

  const relacion = await UsuarioAgencia.findOne({
    where: {
      usuarioId: req.user.id,
      agenciaId,
      activo: true,
    },
    attributes: ["id", "agenciaId"],
    transaction,
  });

  return {
    usuarioAgenciaId: relacion?.id || null,
    agenciaId: relacion?.agenciaId || agenciaId || null,
  };
};

const normalizarTexto = (valor) => String(valor || "").trim();

const esMovimientoValido = (m) =>
  m &&
  typeof m.detalle === "string" &&
  m.detalle.trim() !== "" &&
  Number(m.valor) > 0 &&
  typeof m.formaPago === "string" &&
  m.formaPago.trim() !== "";

const normalizarMovimiento = (m = {}) => ({
  responsable: normalizarTexto(m.responsable),
  detalle: normalizarTexto(m.detalle),
  entidad: m.entidad ? normalizarTexto(m.entidad) : null,
  valor: Number(m.valor) || 0,
  formaPago: m.formaPago ? normalizarTexto(m.formaPago).toUpperCase() : null,
  recibo:
    m.recibo !== null && m.recibo !== undefined && m.recibo !== ""
      ? String(m.recibo)
      : null,
  observacion: normalizarTexto(m.observacion),
});

const crearKeyMovimiento = (m) =>
  [
    m.responsable || "",
    m.detalle || "",
    m.entidad || "",
    Number(m.valor) || 0,
    m.formaPago || "",
    m.recibo ?? "",
    m.observacion || "",
  ].join("|");

const normalizarDenominaciones = (denominaciones = []) =>
  denominaciones
    .map((d) => ({
      valor: Number(d.valor ?? d.denominacion) || 0,
      cantidad: Number(d.cantidad) || 0,
    }))
    .filter((d) => d.valor > 0 && d.cantidad > 0);

const normalizarRetiros = (retiros = []) =>
  retiros
    .map((r) => ({
      monto: Number(r.monto) || 0,
      motivo: normalizarTexto(r.motivo),
      autorizadoPor: normalizarTexto(r.autorizadoPor),
    }))
    .filter((r) => r.monto > 0 || r.motivo || r.autorizadoPor);

const calcularTotales = ({ movimientos, denominaciones }) => {
  let totalEfectivo = 0;
  let totalTransferencia = 0;
  let totalPendiente = 0;

  movimientos.forEach((m) => {
    const valor = Number(m.valor) || 0;

    if (m.formaPago === "EFECTIVO") totalEfectivo += valor;
    if (m.formaPago === "TRANSFERENCIA") totalTransferencia += valor;
    if (m.formaPago === "PENDIENTE") totalPendiente += valor;
  });

  const totalSistema = totalEfectivo + totalTransferencia + totalPendiente;
  const totalFisico = denominaciones.reduce(
    (total, d) => total + (Number(d.valor) || 0) * (Number(d.cantidad) || 0),
    0,
  );
  const diferencia = totalFisico - totalEfectivo;

  return {
    totalFisico,
    totalEfectivo,
    totalTransferencia,
    totalPendiente,
    totalSistema,
    diferencia,
    estado: diferencia === 0 ? "CUADRADO" : "DESCUADRADO",
  };
};

const calcularResumenPorTipo = (movimientos = []) => {
  const resumenPorTipo = {
    cuotaEfectivo: 0,
    cuotaTransferencia: 0,
    contadoEfectivo: 0,
    contadoTransferencia: 0,
    entradaEfectivo: 0,
    entradaTransferencia: 0,
    entradaPendiente: 0,
    alcanceEfectivo: 0,
    alcanceTransferencia: 0,
  };

  movimientos.forEach((m) => {
    const detalle = (m.detalle || "").trim().toUpperCase();
    const formaPago = (m.formaPago || "").trim().toUpperCase();
    const valor = Number(m.valor) || 0;

    if (detalle === "CUOTA") {
      if (formaPago === "EFECTIVO") resumenPorTipo.cuotaEfectivo += valor;
      if (formaPago === "TRANSFERENCIA") resumenPorTipo.cuotaTransferencia += valor;
    }

    if (detalle === "CONTADO") {
      if (formaPago === "EFECTIVO") resumenPorTipo.contadoEfectivo += valor;
      if (formaPago === "TRANSFERENCIA") resumenPorTipo.contadoTransferencia += valor;
    }

    if (detalle === "ENTRADA") {
      if (formaPago === "EFECTIVO") resumenPorTipo.entradaEfectivo += valor;
      if (formaPago === "TRANSFERENCIA") resumenPorTipo.entradaTransferencia += valor;
      if (formaPago === "PENDIENTE") resumenPorTipo.entradaPendiente += valor;
    }

    if (detalle === "ALCANCE") {
      if (formaPago === "EFECTIVO") resumenPorTipo.alcanceEfectivo += valor;
      if (formaPago === "TRANSFERENCIA") resumenPorTipo.alcanceTransferencia += valor;
    }
  });

  return resumenPorTipo;
};

const agruparPorCierre = (registros = []) =>
  registros.reduce((acc, registro) => {
    const cierreId = registro.cierreId;
    if (!acc[cierreId]) acc[cierreId] = [];
    acc[cierreId].push(registro);
    return acc;
  }, {});

const includeUsuarioAgencia = ({ agenciaId } = {}) => ({
  model: UsuarioAgencia,
  as: "usuarioAgencia",
  attributes: ["id", "usuarioId", "agenciaId"],
  required: !!(agenciaId && agenciaId !== "todas"),
  include: [
    {
      model: Usuario,
      as: "usuario",
      attributes: ["id", "nombre", "email"],
    },
    {
      model: Agencia,
      as: "agencia",
      attributes: ["id", "nombre", "ciudad"],
      required: !!(agenciaId && agenciaId !== "todas"),
      ...(agenciaId &&
        agenciaId !== "todas" && {
          where: { id: Number(agenciaId) },
        }),
    },
  ],
});

const includeReaperturaUsuarios = [
  {
    model: Usuario,
    as: "reabiertoPor",
    attributes: ["id", "nombre", "email"],
  },
  {
    model: Usuario,
    as: "recerradoPor",
    attributes: ["id", "nombre", "email"],
  },
];

const armarDataCierres = async (cierres) => {
  if (!cierres.length) return [];

  const cierreIds = cierres.map((c) => c.id);

  const [denominaciones, retiros, movimientos, reaperturas] = await Promise.all([
    Denominacion.findAll({
      where: { cierreId: { [Op.in]: cierreIds } },
      order: [["valor", "DESC"]],
    }),
    RetiroCaja.findAll({
      where: { cierreId: { [Op.in]: cierreIds } },
      order: [["id", "ASC"]],
    }),
    MovimientoCaja.findAll({
      where: { cierreId: { [Op.in]: cierreIds } },
      order: [["id", "ASC"]],
    }),
    ReaperturaCierreCaja.findAll({
      where: { cierreId: { [Op.in]: cierreIds } },
      include: includeReaperturaUsuarios,
      order: [["id", "DESC"]],
    }),
  ]);

  const denominacionesPorCierre = agruparPorCierre(denominaciones);
  const retirosPorCierre = agruparPorCierre(retiros);
  const movimientosPorCierre = agruparPorCierre(movimientos);
  const reaperturasPorCierre = agruparPorCierre(reaperturas);

  return cierres.map((cierre) => {
    const movimientosCierre = movimientosPorCierre[cierre.id] || [];

    return {
      cierre,
      denominaciones: denominacionesPorCierre[cierre.id] || [],
      retiros: retirosPorCierre[cierre.id] || [],
      movimientos: movimientosCierre,
      reaperturas: reaperturasPorCierre[cierre.id] || [],
      resumenPorTipo: calcularResumenPorTipo(movimientosCierre),
    };
  });
};

const obtenerDetalleCierre = async (id, transaction = null) => {
  const cierre = await CierreCaja.findByPk(id, {
    include: [includeUsuarioAgencia()],
    transaction,
  });

  if (!cierre) return null;

  const data = await armarDataCierres([cierre]);
  return data[0];
};

const crearSnapshotCierre = (detalle) => ({
  cierre: detalle.cierre.toJSON(),
  denominaciones: detalle.denominaciones.map((d) => d.toJSON()),
  retiros: detalle.retiros.map((r) => r.toJSON()),
  movimientos: detalle.movimientos.map((m) => m.toJSON()),
});

const obtenerMovimientosParaCierre = async ({
  usuarioAgenciaId,
  movimientosPendientes,
  transaction,
}) => {
  const movimientosTemp = await MovimientoCajaTemp.findAll({
    where: { usuarioAgenciaId, estado: "ACTIVO" },
    transaction,
  });

  const movimientosTempPlain = movimientosTemp
    .map((m) =>
      normalizarMovimiento({
        responsable: m.responsable,
        detalle: m.detalle,
        entidad: m.entidad,
        valor: m.valor,
        formaPago: m.formaPago,
        recibo: m.recibo,
        observacion: m.observacion,
      }),
    )
    .filter(esMovimientoValido);

  const movimientosFrontend = (movimientosPendientes || [])
    .map(normalizarMovimiento)
    .filter(esMovimientoValido);

  const keysTemp = new Set(movimientosTempPlain.map(crearKeyMovimiento));
  const movimientosFrontendUnicos = movimientosFrontend.filter(
    (m) => !keysTemp.has(crearKeyMovimiento(m)),
  );

  return [...movimientosTempPlain, ...movimientosFrontendUnicos];
};

const manejarErrorCierreUnico = (error, res) => {
  if (error?.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      message: "Ya existe un cierre de caja activo para este usuario en esta fecha",
    });
  }

  return null;
};

const cerrarCaja = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { usuarioAgenciaId, agenciaId } = await resolverRelacionUsuarioAgencia(req, t);
    const usuarioId = req.user.id;
    const fechaCierre = obtenerFechaEcuador();
    const ahora = new Date();
    const { cierre = {}, denominaciones = [], retiros = [], movimientosPendientes = [] } = req.body;

    if (!usuarioAgenciaId || !agenciaId) {
      await t.rollback();
      return res.status(400).json({
        message: "Usuario sin relacion activa usuario-agencia/agencia para cerrar caja",
      });
    }

    const cierreExistente = await CierreCaja.findOne({
      where: {
        usuarioId,
        fecha: fechaCierre,
        estadoCierre: { [Op.in]: ESTADOS_CIERRE_ACTIVOS },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (cierreExistente) {
      await t.rollback();
      return res.status(409).json({
        message: "Ya existe un cierre de caja para este usuario en la fecha actual",
        cierre: cierreExistente,
      });
    }

    const movimientosUnificados = await obtenerMovimientosParaCierre({
      usuarioAgenciaId,
      movimientosPendientes,
      transaction: t,
    });

    if (!movimientosUnificados.length) {
      await t.rollback();
      return res.status(400).json({
        message: "No existen movimientos validos para cerrar caja",
      });
    }

    const denominacionesLimpias = normalizarDenominaciones(denominaciones);
    const retirosLimpios = normalizarRetiros(retiros);
    const totales = calcularTotales({
      movimientos: movimientosUnificados,
      denominaciones: denominacionesLimpias,
    });

    const cierreCreado = await CierreCaja.create(
      {
        fecha: fechaCierre,
        usuarioAgenciaId,
        agenciaId,
        usuarioId,
        usuarioCreacion: String(usuarioId),
        usuarioModificacion: String(usuarioId),
        fechaCreacion: ahora,
        fechaModificacion: ahora,
        observacion: cierre.observacion || "",
        estadoCierre: "CERRADO",
        ...totales,
      },
      { transaction: t },
    );

    const cierreId = cierreCreado.id;

    if (denominacionesLimpias.length) {
      await Denominacion.bulkCreate(
        denominacionesLimpias.map((d) => ({
          cierreId,
          valor: d.valor,
          cantidad: d.cantidad,
        })),
        { transaction: t },
      );
    }

    if (retirosLimpios.length) {
      await RetiroCaja.bulkCreate(
        retirosLimpios.map((r) => ({
          cierreId,
          monto: r.monto,
          motivo: r.motivo,
          autorizadoPor: r.autorizadoPor,
        })),
        { transaction: t },
      );
    }

    await MovimientoCaja.bulkCreate(
      movimientosUnificados.map((m) => ({
        cierreId,
        responsable: m.responsable,
        detalle: m.detalle,
        entidad: m.entidad,
        valor: m.valor,
        formaPago: m.formaPago,
        recibo: m.recibo,
        observacion: m.observacion,
      })),
      { transaction: t },
    );

    await MovimientoCajaTemp.destroy({
      where: { usuarioAgenciaId, estado: "ACTIVO" },
      transaction: t,
    });

    await t.commit();

    return res.status(200).json({
      message: "Caja cerrada correctamente",
      cierre: cierreCreado,
      totalMovimientos: movimientosUnificados.length,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);

    const handled = manejarErrorCierreUnico(error, res);
    if (handled) return handled;

    return res.status(500).json({
      message: "Error al cerrar caja",
      error: error.message,
    });
  }
};

const obtenerCierreCajaPorId = async (req, res) => {
  try {
    const detalle = await obtenerDetalleCierre(req.params.id);

    if (!detalle) {
      return res.status(404).json({
        message: "Cierre de caja no encontrado",
      });
    }

    return res.status(200).json({
      message: "Cierre obtenido correctamente",
      data: detalle,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al obtener el cierre de caja",
      error: error.message,
    });
  }
};

const obtenerTodosLosCierresCaja = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId, usuarioId, estadoCierre } = req.query;
    const where = {};

    if (fechaInicio && fechaFin) {
      where.fecha = { [Op.between]: [fechaInicio, fechaFin] };
    } else if (fechaInicio) {
      where.fecha = { [Op.gte]: fechaInicio };
    } else if (fechaFin) {
      where.fecha = { [Op.lte]: fechaFin };
    }

    if (usuarioId && usuarioId !== "todos") {
      where.usuarioId = Number(usuarioId);
    }

    if (estadoCierre && estadoCierre !== "todos") {
      where.estadoCierre = estadoCierre;
    }

    const cierres = await CierreCaja.findAll({
      where,
      include: [includeUsuarioAgencia({ agenciaId })],
      order: [
        ["fecha", "DESC"],
        ["id", "DESC"],
      ],
    });

    const data = await armarDataCierres(cierres);

    return res.status(200).json({
      message: data.length ? "Cierres obtenidos correctamente" : "No existen cierres de caja",
      total: data.length,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al obtener los cierres de caja",
      error: error.message,
    });
  }
};

const obtenerCierresCajaLegacy = async (req, res) => {
  try {
    const { data } = await new Promise((resolve, reject) => {
      const response = {
        status: () => response,
        json: (body) => resolve(body),
      };

      obtenerTodosLosCierresCaja(req, response).catch(reject);
    });

    return res.json(
      (data || []).map((item) => ({
        ...item.cierre.toJSON(),
        denominaciones: item.denominaciones,
        retiros: item.retiros,
        movimientos: item.movimientos,
        reaperturas: item.reaperturas,
      })),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al obtener cierres de caja",
      error: error.message,
    });
  }
};

const obtenerEstadoCierreUsuario = async (req, res) => {
  try {
    const fecha = req.query.fecha || obtenerFechaEcuador();
    const cierre = await CierreCaja.findOne({
      where: {
        usuarioId: req.user.id,
        fecha,
        estadoCierre: { [Op.in]: ESTADOS_CIERRE_ACTIVOS },
      },
      include: [includeUsuarioAgencia()],
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      cerrado: !!cierre,
      bloqueado: !!cierre,
      fecha,
      cierre,
      message: cierre
        ? "Ya existe un cierre de caja para esta fecha"
        : "No existe cierre de caja para esta fecha",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al validar estado de cierre de caja",
      error: error.message,
    });
  }
};

const obtenerFiltrosCierresCaja = async (_req, res) => {
  try {
    const relaciones = await UsuarioAgencia.findAll({
      where: { activo: true },
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: ["id", "nombre", "email"],
          where: { activo: true },
          required: true,
        },
        {
          model: Agencia,
          as: "agencia",
          attributes: ["id", "nombre", "ciudad"],
          required: true,
        },
      ],
      order: [
        [{ model: Agencia, as: "agencia" }, "nombre", "ASC"],
        [{ model: Usuario, as: "usuario" }, "nombre", "ASC"],
      ],
    });

    const agenciasMap = new Map();
    const usuariosMap = new Map();

    relaciones.forEach((relacion) => {
      if (relacion.agencia) {
        agenciasMap.set(relacion.agencia.id, relacion.agencia);
      }
      if (relacion.usuario) {
        usuariosMap.set(relacion.usuario.id, relacion.usuario);
      }
    });

    return res.status(200).json({
      agencias: [...agenciasMap.values()],
      usuarios: [...usuariosMap.values()],
      relaciones,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al obtener filtros de cierres de caja",
      error: error.message,
    });
  }
};

const reabrirCierreCaja = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const motivo = normalizarTexto(req.body.motivo);

    if (!motivo) {
      await t.rollback();
      return res.status(400).json({ message: "Debe indicar el motivo de reapertura" });
    }

    const cierre = await CierreCaja.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!cierre) {
      await t.rollback();
      return res.status(404).json({ message: "Cierre de caja no encontrado" });
    }

    if (cierre.estadoCierre === "REABIERTO") {
      await t.rollback();
      return res.status(409).json({ message: "El cierre ya se encuentra reabierto" });
    }

    if (cierre.estadoCierre === "ANULADO") {
      await t.rollback();
      return res.status(409).json({ message: "No se puede reabrir un cierre anulado" });
    }

    const detalle = await obtenerDetalleCierre(id, t);
    const fechaReapertura = new Date();

    const reapertura = await ReaperturaCierreCaja.create(
      {
        cierreId: cierre.id,
        reabiertoPorUsuarioId: req.user.id,
        motivo,
        fechaReapertura,
        snapshotPrevio: crearSnapshotCierre(detalle),
      },
      { transaction: t },
    );

    await cierre.update(
      {
        estadoCierre: "REABIERTO",
        reabiertoPorUsuarioId: req.user.id,
        fechaReapertura,
        motivoReapertura: motivo,
        recerradoPorUsuarioId: null,
        fechaRecierre: null,
        usuarioModificacion: String(req.user.id),
        fechaModificacion: fechaReapertura,
      },
      { transaction: t },
    );

    await t.commit();

    return res.status(200).json({
      message: "Cierre de caja reabierto correctamente",
      cierre,
      reapertura,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);
    return res.status(500).json({
      message: "Error al reabrir el cierre de caja",
      error: error.message,
    });
  }
};

const actualizarCierreCajaReabierto = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const cierrePayload = req.body.cierre || {};
    const movimientosPayload = req.body.movimientos || req.body.movimientosPendientes || [];
    const movimientos = movimientosPayload.map(normalizarMovimiento).filter(esMovimientoValido);

    if (!movimientos.length) {
      await t.rollback();
      return res.status(400).json({ message: "Debe registrar al menos un movimiento valido" });
    }

    const cierre = await CierreCaja.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!cierre) {
      await t.rollback();
      return res.status(404).json({ message: "Cierre de caja no encontrado" });
    }

    if (cierre.estadoCierre !== "REABIERTO") {
      await t.rollback();
      return res.status(409).json({
        message: "Solo se puede editar un cierre que este reabierto",
      });
    }

    const denominaciones = normalizarDenominaciones(req.body.denominaciones || []);
    const retiros = normalizarRetiros(req.body.retiros || []);
    const totales = calcularTotales({ movimientos, denominaciones });
    const fechaRecierre = new Date();

    await Promise.all([
      Denominacion.destroy({ where: { cierreId: cierre.id }, transaction: t }),
      RetiroCaja.destroy({ where: { cierreId: cierre.id }, transaction: t }),
      MovimientoCaja.destroy({ where: { cierreId: cierre.id }, transaction: t }),
    ]);

    if (denominaciones.length) {
      await Denominacion.bulkCreate(
        denominaciones.map((d) => ({
          cierreId: cierre.id,
          valor: d.valor,
          cantidad: d.cantidad,
        })),
        { transaction: t },
      );
    }

    if (retiros.length) {
      await RetiroCaja.bulkCreate(
        retiros.map((r) => ({
          cierreId: cierre.id,
          monto: r.monto,
          motivo: r.motivo,
          autorizadoPor: r.autorizadoPor,
        })),
        { transaction: t },
      );
    }

    await MovimientoCaja.bulkCreate(
      movimientos.map((m) => ({
        cierreId: cierre.id,
        responsable: m.responsable,
        detalle: m.detalle,
        entidad: m.entidad,
        valor: m.valor,
        formaPago: m.formaPago,
        recibo: m.recibo,
        observacion: m.observacion,
      })),
      { transaction: t },
    );

    await cierre.update(
      {
        observacion: cierrePayload.observacion ?? cierre.observacion,
        estadoCierre: "CERRADO",
        recerradoPorUsuarioId: req.user.id,
        fechaRecierre,
        usuarioModificacion: String(req.user.id),
        fechaModificacion: fechaRecierre,
        ...totales,
      },
      { transaction: t },
    );

    const ultimaReapertura = await ReaperturaCierreCaja.findOne({
      where: {
        cierreId: cierre.id,
        recerradoPorUsuarioId: null,
      },
      order: [["id", "DESC"]],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (ultimaReapertura) {
      await ultimaReapertura.update(
        {
          recerradoPorUsuarioId: req.user.id,
          fechaRecierre,
        },
        { transaction: t },
      );
    }

    await t.commit();

    const detalleActualizado = await obtenerDetalleCierre(id);

    return res.status(200).json({
      message: "Cierre de caja actualizado y cerrado correctamente",
      data: detalleActualizado,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);

    const handled = manejarErrorCierreUnico(error, res);
    if (handled) return handled;

    return res.status(500).json({
      message: "Error al actualizar el cierre de caja",
      error: error.message,
    });
  }
};

module.exports = {
  cerrarCaja,
  obtenerCierreCajaPorId,
  obtenerTodosLosCierresCaja,
  obtenerCierresCajaLegacy,
  obtenerEstadoCierreUsuario,
  obtenerFiltrosCierresCaja,
  reabrirCierreCaja,
  actualizarCierreCajaReabierto,
};
