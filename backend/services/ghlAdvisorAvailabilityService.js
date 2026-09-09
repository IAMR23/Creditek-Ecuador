const { Op, fn, col } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const Vinculo = require("../models/GhlAsesorVinculo");
const Historial = require("../models/GhlAsesorDisponibilidadHistorial");
const Detalle = require("../models/GhlRepartoEjecucionDetalle");
const ghl = require("./ghlService");

const TIME_ZONE = "America/Guayaquil";
const ESTADOS = Object.freeze(["ACTIVO", "PAUSADO"]);
const ID_RE = /^[A-Za-z0-9_-]{2,100}$/;

const availabilityError = (code, message, statusCode = 409) =>
  Object.assign(new Error(message), { code, statusCode });

function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function localDayBounds(now = new Date()) {
  const date = localDate(now);
  return {
    date,
    start: new Date(`${date}T00:00:00-05:00`),
    end: new Date(`${date}T23:59:59.999-05:00`),
  };
}

const effectiveState = (row, now = new Date()) =>
  row?.activo === true &&
  row?.estadoRecepcion === "ACTIVO" &&
  String(row?.estadoFechaLocal || "") === localDate(now)
    ? "ACTIVO"
    : "PAUSADO";

async function fetchCurrentGhlUsers() {
  const config = ghl.getGhlConfig({ requirePipelineId: false });
  const client = ghl.createGhlClient(config);
  const users = await ghl.fetchAllAssignableUsers(client, config);
  return users.filter(
    (user) => user?.deleted !== true && user?.active !== false && user?.status !== "inactive",
  );
}

const ghlUserIdOf = (user) => ghl.toId(user?.id || user?._id);
const ghlUserNameOf = (user) =>
  String(user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Sin nombre");

async function countTodayByGhlUser(ghlUserIds, now = new Date()) {
  if (!ghlUserIds.length) return new Map();
  const { start, end } = localDayBounds(now);
  const rows = await Detalle.findAll({
    where: {
      estado: "assigned",
      newAssignedTo: { [Op.in]: ghlUserIds },
      assignedAt: { [Op.between]: [start, end] },
    },
    attributes: ["newAssignedTo", [fn("COUNT", col("id")), "cantidad"]],
    group: ["newAssignedTo"],
    raw: true,
  });
  return new Map(rows.map((row) => [String(row.newAssignedTo), Number(row.cantidad) || 0]));
}

function serializeAvailability(row, leadsHoy = 0, now = new Date()) {
  if (!row) {
    return {
      vinculado: false,
      estado: "PAUSADO",
      recibiendoLeads: false,
      leadsHoy: 0,
    };
  }
  const plain = typeof row.toJSON === "function" ? row.toJSON() : row;
  const estado = effectiveState(plain, now);
  return {
    vinculado: plain.activo === true,
    vinculoId: plain.id,
    usuarioId: plain.usuarioId,
    ghlUserId: plain.ghlUserId,
    ghlNombre: plain.ghlNombre,
    ghlEmail: plain.ghlEmail || "",
    asociacionActiva: plain.activo === true,
    estado,
    recibiendoLeads: estado === "ACTIVO",
    ultimoCambio: plain.estadoCambiadoAt || null,
    fechaActivacion: plain.estadoFechaLocal || null,
    motivoUltimoCambio: plain.motivoUltimoCambio || null,
    leadsHoy,
  };
}

async function getMyAvailability(usuarioId, now = new Date()) {
  const row = await Vinculo.findOne({ where: { usuarioId } });
  if (!row) return serializeAvailability(null, 0, now);
  const counts = await countTodayByGhlUser([row.ghlUserId], now);
  return serializeAvailability(row, counts.get(String(row.ghlUserId)) || 0, now);
}

async function listAdvisorAvailability(now = new Date()) {
  const [usuarios, vinculos, currentGhlUsers] = await Promise.all([
    Usuario.findAll({
      where: { activo: true },
      attributes: ["id", "nombre", "email", "activo"],
      order: [["nombre", "ASC"]],
    }),
    Vinculo.findAll(),
    fetchCurrentGhlUsers(),
  ]);
  const currentGhlIds = new Set(currentGhlUsers.map(ghlUserIdOf));
  const byUser = new Map(vinculos.map((row) => [String(row.usuarioId), row]));
  const counts = await countTodayByGhlUser(
    vinculos.filter((row) => row.activo).map((row) => String(row.ghlUserId)),
    now,
  );
  return usuarios.map((usuario) => {
    const plain = typeof usuario.toJSON === "function" ? usuario.toJSON() : usuario;
    const row = byUser.get(String(plain.id));
    return {
      usuario: plain,
      disponibilidad: serializeAvailability(
        row,
        row ? counts.get(String(row.ghlUserId)) || 0 : 0,
        now,
      ),
      asociacionIncompleta:
        !row || !row.activo || !row.ghlUserId || !currentGhlIds.has(String(row.ghlUserId)),
    };
  });
}

async function saveAssociation({ usuarioId, ghlUserId, actorId, now = new Date() }) {
  const normalizedGhlUserId = String(ghlUserId || "").trim();
  if (!ID_RE.test(normalizedGhlUserId)) {
    throw availabilityError("INVALID_GHL_USER", "Seleccione un usuario GHL valido", 400);
  }
  const usuario = await Usuario.findOne({ where: { id: usuarioId, activo: true } });
  if (!usuario) throw availabilityError("RVE_USER_NOT_FOUND", "Asesor RVE activo no encontrado", 404);

  const ghlUsers = await fetchCurrentGhlUsers();
  const ghlUser = ghlUsers.find((item) => ghlUserIdOf(item) === normalizedGhlUserId);
  if (!ghlUser) {
    throw availabilityError(
      "GHL_USER_NOT_ASSIGNABLE",
      "El usuario GHL no existe o ya no es asignable",
      400,
    );
  }

  try {
    return await sequelize.transaction(async (transaction) => {
      const duplicate = await Vinculo.findOne({
        where: {
          ghlUserId: normalizedGhlUserId,
          usuarioId: { [Op.ne]: usuarioId },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (duplicate) {
        throw availabilityError(
          "GHL_USER_ALREADY_LINKED",
          "Ese usuario GHL ya esta asociado con otro asesor RVE",
        );
      }
      let row = await Vinculo.findOne({
        where: { usuarioId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const wasExisting = Boolean(row);
      const previousGhlUserId = row?.ghlUserId || null;
      const previousState = row ? effectiveState(row, now) : null;
      const values = {
        ghlUserId: normalizedGhlUserId,
        ghlNombre: ghlUserNameOf(ghlUser),
        ghlEmail: String(ghlUser.email || ""),
        activo: true,
        estadoRecepcion: "PAUSADO",
        estadoFechaLocal: null,
        estadoCambiadoAt: now,
        estadoCambiadoPorId: actorId,
        motivoUltimoCambio: "administrador",
      };
      if (row) await row.update(values, { transaction });
      else row = await Vinculo.create({ usuarioId, ...values }, { transaction });

      await Historial.create(
        {
          vinculoId: row.id,
          usuarioId,
          ghlUserId: normalizedGhlUserId,
          accion: "ASOCIACION",
          estadoAnterior: wasExisting ? previousState : null,
          estadoNuevo: "PAUSADO",
          cambiadoPorId: actorId,
          motivoCambio: "administrador",
          fechaLocal: localDate(now),
          metadata: { previousGhlUserId, newGhlUserId: normalizedGhlUserId },
        },
        { transaction },
      );
      return serializeAvailability(row, 0, now);
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      throw availabilityError(
        "GHL_ASSOCIATION_CONFLICT",
        "El asesor RVE o el usuario GHL ya tiene una asociacion",
      );
    }
    throw error;
  }
}

async function changeAvailability({
  usuarioId,
  estado,
  actorId,
  motivoCambio,
  now = new Date(),
}) {
  const normalizedState = String(estado || "").trim().toUpperCase();
  if (!ESTADOS.includes(normalizedState)) {
    throw availabilityError("INVALID_AVAILABILITY_STATE", "El estado debe ser ACTIVO o PAUSADO", 400);
  }

  if (normalizedState === "ACTIVO") {
    const usuario = await Usuario.findOne({ where: { id: usuarioId, activo: true } });
    if (!usuario) throw availabilityError("RVE_USER_INACTIVE", "El asesor RVE no esta activo", 409);
  }

  let assignableGhlIds = null;
  if (normalizedState === "ACTIVO") {
    const preliminaryLink = await Vinculo.findOne({ where: { usuarioId, activo: true } });
    if (!preliminaryLink) {
      throw availabilityError(
        "GHL_ASSOCIATION_REQUIRED",
        "El asesor no tiene una asociacion activa con GHL",
        409,
      );
    }
    assignableGhlIds = new Set((await fetchCurrentGhlUsers()).map(ghlUserIdOf));
  }

  const today = localDate(now);
  return sequelize.transaction(async (transaction) => {
    const row = await Vinculo.findOne({
      where: { usuarioId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row || !row.activo) {
      throw availabilityError(
        "GHL_ASSOCIATION_REQUIRED",
        "El asesor no tiene una asociacion activa con GHL",
        409,
      );
    }

    if (normalizedState === "ACTIVO") {
      if (!assignableGhlIds.has(String(row.ghlUserId))) {
        throw availabilityError(
          "GHL_USER_NOT_ASSIGNABLE",
          "El usuario asociado ya no es asignable en GHL",
          409,
        );
      }
    }

    const previousState = effectiveState(row, now);
    if (previousState === normalizedState) {
      const counts = await countTodayByGhlUser([row.ghlUserId], now);
      return serializeAvailability(row, counts.get(String(row.ghlUserId)) || 0, now);
    }

    await row.update(
      {
        estadoRecepcion: normalizedState,
        estadoFechaLocal: normalizedState === "ACTIVO" ? today : null,
        estadoCambiadoAt: now,
        estadoCambiadoPorId: actorId,
        motivoUltimoCambio: motivoCambio,
      },
      { transaction },
    );
    await Historial.create(
      {
        vinculoId: row.id,
        usuarioId,
        ghlUserId: row.ghlUserId,
        accion: "ESTADO",
        estadoAnterior: previousState,
        estadoNuevo: normalizedState,
        cambiadoPorId: actorId,
        motivoCambio,
        fechaLocal: today,
      },
      { transaction },
    );
    const counts = await countTodayByGhlUser([row.ghlUserId], now);
    return serializeAvailability(row, counts.get(String(row.ghlUserId)) || 0, now);
  });
}

async function resolveConfiguredAdvisors(configuredUsers, currentGhlUsers, now = new Date()) {
  const configured = (configuredUsers || []).map((user) => ({
    ...user,
    id: String(user.id || ""),
  }));
  const ids = configured.map((user) => user.id).filter(Boolean);
  if (!ids.length) return { active: [], paused: [], invalid: [] };

  const rows = await Vinculo.findAll({
    where: { ghlUserId: { [Op.in]: ids }, activo: true },
    include: [{ model: Usuario, as: "usuario", attributes: ["id", "activo"] }],
  });
  const byGhl = new Map(rows.map((row) => [String(row.ghlUserId), row]));
  const currentIds = new Set(
    (currentGhlUsers || [])
      .filter((user) => user?.deleted !== true && user?.active !== false && user?.status !== "inactive")
      .map(ghlUserIdOf)
      .filter(Boolean),
  );
  const result = { active: [], paused: [], invalid: [] };

  configured.forEach((user) => {
    const row = byGhl.get(user.id);
    if (!row || row.usuario?.activo !== true || !currentIds.has(user.id)) {
      result.invalid.push({ ...user, reason: "Asociacion RVE-GHL incompleta o usuario inactivo" });
    } else if (effectiveState(row, now) !== "ACTIVO") {
      result.paused.push(user);
    } else {
      result.active.push(user);
    }
  });
  return result;
}

async function isGhlUserActiveToday(ghlUserId, now = new Date()) {
  const row = await Vinculo.findOne({
    where: { ghlUserId, activo: true },
    include: [{ model: Usuario, as: "usuario", attributes: ["id", "activo"] }],
  });
  return Boolean(row?.usuario?.activo === true && effectiveState(row, now) === "ACTIVO");
}

module.exports = {
  TIME_ZONE,
  ESTADOS,
  availabilityError,
  localDate,
  localDayBounds,
  effectiveState,
  fetchCurrentGhlUsers,
  countTodayByGhlUser,
  serializeAvailability,
  getMyAvailability,
  listAdvisorAvailability,
  saveAssociation,
  changeAvailability,
  resolveConfiguredAdvisors,
  isGhlUserActiveToday,
};
