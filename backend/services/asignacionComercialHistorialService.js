const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const AsignacionComercialHistorial = require("../models/AsignacionComercialHistorial");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const RolPago = require("../models/RolPago");
const PagoComisionPeriodo = require("../models/PagoComisionPeriodo");

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const normalizarFecha = (value, nombre = "fecha") => {
  const fecha = String(value || "").slice(0, 10);
  if (!DATE_ONLY.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) {
    const error = new Error(`${nombre} no es valida`);
    error.statusCode = 400;
    throw error;
  }
  return fecha;
};

const sumarDias = (fecha, dias) => {
  const value = new Date(`${normalizarFecha(fecha)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + dias);
  return value.toISOString().slice(0, 10);
};

const inferirEquipo = (cargo) => {
  const value = String(cargo || "").toUpperCase();
  if (value.includes("CALL CENTER")) return "CALL CENTER";
  if (value.includes("PISO")) return "PISO";
  return value || null;
};

const buscarResponsablePredeterminado = async ({ tipo, transaction }) => {
  const esJefe = tipo === "JEFE_PISO";
  const responsable = await Usuario.findOne({
    where: {
      activo: true,
      [Op.or]: esJefe
        ? [
            { nombre: { [Op.iLike]: "%Nicolas%Llerena%" } },
            { nombre: { [Op.iLike]: "%Nicolás%Llerena%" } },
          ]
        : [
            { nombre: { [Op.iLike]: "%Damian%Caiza%" } },
            { nombre: { [Op.iLike]: "%Damián%Caiza%" } },
          ],
    },
    order: [["id", "ASC"]],
    transaction,
  });
  if (!responsable) {
    const error = new Error(
      esJefe
        ? "No se encontro al jefe comercial Nicolas Llerena"
        : "No se encontro al supervisor Damian Caiza",
    );
    error.statusCode = 409;
    throw error;
  }
  return responsable;
};

const validarPeriodoAbierto = async (fecha, transaction) => {
  const [anio, mes] = normalizarFecha(fecha).split("-").map(Number);
  const periodo = await PagoComisionPeriodo.findOne({
    where: { anio, mes, activo: true, estado: "PAGADO" },
    transaction,
  });
  if (periodo) {
    const error = new Error(
      "El periodo de comisiones esta pagado; debe reabrirse antes de cambiar su historial comercial",
    );
    error.statusCode = 409;
    throw error;
  }
};

const obtenerContextoActual = async ({ usuarioId, usuarioAgenciaId, transaction }) => {
  const usuario = await Usuario.findByPk(usuarioId, {
    include: [{ model: RolPago, as: "rolPago", attributes: ["cargo"] }],
    transaction,
  });
  if (!usuario) {
    const error = new Error("Vendedor no encontrado");
    error.statusCode = 404;
    throw error;
  }
  const usuarioAgencia = usuarioAgenciaId
    ? await UsuarioAgencia.findOne({
        where: { id: usuarioAgenciaId, usuarioId },
        transaction,
      })
    : await UsuarioAgencia.findOne({
        where: { usuarioId, activo: true },
        order: [["updatedAt", "DESC"], ["id", "DESC"]],
        transaction,
      });
  if (!usuarioAgencia) {
    const error = new Error("El vendedor no tiene una agencia vinculada para abrir el tramo");
    error.statusCode = 400;
    throw error;
  }
  return { usuario, usuarioAgencia };
};

const registrarCambioAsignacion = async ({
  usuarioId,
  usuarioAgenciaId,
  agenciaId,
  jefeComercialId,
  supervisorComercialId,
  equipo,
  fechaEfectiva,
  registradoPorId,
  fuente = "EDICION_PERSONAL",
  transaction: externalTransaction,
}) => {
  const ejecutar = async (transaction) => {
    const desde = normalizarFecha(fechaEfectiva, "fechaEfectiva");
    await validarPeriodoAbierto(desde, transaction);
    const { usuario, usuarioAgencia } = await obtenerContextoActual({
      usuarioId,
      usuarioAgenciaId,
      transaction,
    });
    const responsableJefe = jefeComercialId === undefined
      ? usuario.jefeComercialId
      : jefeComercialId;
    const responsableSupervisor = supervisorComercialId === undefined
      ? usuario.supervisorComercialId
      : supervisorComercialId;
    const historial = await AsignacionComercialHistorial.findAll({
      where: { usuarioId },
      order: [["vigenciaDesde", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const futuro = historial.find((row) => row.vigenciaDesde > desde);
    if (futuro) {
      const error = new Error(
        `Existe un tramo posterior desde ${futuro.vigenciaDesde}; reviselo antes de registrar el cambio`,
      );
      error.statusCode = 409;
      throw error;
    }
    const mismoDia = historial.find((row) => row.vigenciaDesde === desde);
    if (mismoDia) {
      await mismoDia.update({
        usuarioAgenciaId: usuarioAgencia.id,
        agenciaId: agenciaId || usuarioAgencia.agenciaId,
        jefeComercialId: responsableJefe || null,
        supervisorComercialId: responsableSupervisor || null,
        equipo: equipo || inferirEquipo(usuario.rolPago?.cargo),
        requiereRevision: false,
        fuente,
        registradoPorId: registradoPorId || null,
        observacion: null,
      }, { transaction });
      return mismoDia;
    }
    const vigente = [...historial].reverse().find((row) =>
      row.vigenciaDesde < desde
      && (!row.vigenciaHasta || row.vigenciaHasta >= desde));
    if (vigente) {
      await vigente.update(
        { vigenciaHasta: sumarDias(desde, -1) },
        { transaction },
      );
    }
    return AsignacionComercialHistorial.create({
      usuarioId,
      usuarioAgenciaId: usuarioAgencia.id,
      agenciaId: agenciaId || usuarioAgencia.agenciaId,
      equipo: equipo || inferirEquipo(usuario.rolPago?.cargo),
      jefeComercialId: responsableJefe || null,
      supervisorComercialId: responsableSupervisor || null,
      vigenciaDesde: desde,
      vigenciaHasta: usuario.fechaSalida && usuario.fechaSalida >= desde
        ? usuario.fechaSalida
        : null,
      requiereRevision: false,
      fuente,
      registradoPorId: registradoPorId || null,
    }, { transaction });
  };
  return externalTransaction
    ? ejecutar(externalTransaction)
    : sequelize.transaction(ejecutar);
};

const cerrarAsignacionPorBaja = async ({
  usuarioId,
  fechaSalida,
  registradoPorId,
  transaction: externalTransaction,
}) => {
  const ejecutar = async (transaction) => {
    const hasta = normalizarFecha(fechaSalida, "fechaSalida");
    await validarPeriodoAbierto(hasta, transaction);
    const rows = await AsignacionComercialHistorial.findAll({
      where: {
        usuarioId,
        vigenciaDesde: { [Op.lte]: hasta },
        [Op.or]: [
          { vigenciaHasta: null },
          { vigenciaHasta: { [Op.gt]: hasta } },
        ],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    await Promise.all(rows.map((row) => row.update({
      vigenciaHasta: hasta,
      registradoPorId: registradoPorId || row.registradoPorId || null,
      fuente: "BAJA_PERSONAL",
    }, { transaction })));
    return rows.length;
  };
  return externalTransaction
    ? ejecutar(externalTransaction)
    : sequelize.transaction(ejecutar);
};

const registrarCambioAsignacionPorRol = async ({
  usuarioId,
  cargo,
  fechaEfectiva,
  registradoPorId,
  transaction,
}) => {
  const equipo = inferirEquipo(cargo);
  const esVendedor = String(cargo || "").toUpperCase().includes("VENDEDOR");
  if (!esVendedor || !["PISO", "CALL CENTER"].includes(equipo)) {
    const desde = normalizarFecha(fechaEfectiva, "fechaEfectivaComercial");
    await validarPeriodoAbierto(desde, transaction);
    const rows = await AsignacionComercialHistorial.findAll({
      where: {
        usuarioId,
        vigenciaDesde: { [Op.lte]: desde },
        [Op.or]: [{ vigenciaHasta: null }, { vigenciaHasta: { [Op.gte]: desde } }],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    await Promise.all(rows.map((row) =>
      row.vigenciaDesde === desde
        ? row.destroy({ transaction })
        : row.update({
            vigenciaHasta: sumarDias(desde, -1),
            fuente: "CAMBIO_ROL",
            registradoPorId: registradoPorId || null,
          }, { transaction })));
    await Usuario.update({
      jefeComercialId: null,
      supervisorComercialId: null,
    }, { where: { id: usuarioId }, transaction });
    return null;
  }

  const responsable = await buscarResponsablePredeterminado({
    tipo: equipo === "PISO" ? "JEFE_PISO" : "SUPERVISOR_CALL_CENTER",
    transaction,
  });
  const payload = equipo === "PISO"
    ? { jefeComercialId: responsable.id, supervisorComercialId: null }
    : { jefeComercialId: null, supervisorComercialId: responsable.id };
  const tramo = await registrarCambioAsignacion({
    usuarioId,
    ...payload,
    equipo,
    fechaEfectiva,
    registradoPorId,
    fuente: "CAMBIO_ROL",
    transaction,
  });
  await Usuario.update(payload, { where: { id: usuarioId }, transaction });
  return tramo;
};

module.exports = {
  normalizarFecha,
  sumarDias,
  inferirEquipo,
  registrarCambioAsignacion,
  cerrarAsignacionPorBaja,
  registrarCambioAsignacionPorRol,
};
