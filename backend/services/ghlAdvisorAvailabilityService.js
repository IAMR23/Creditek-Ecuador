const { Op, fn, col } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const RolPago = require("../models/RolPago");
const Vinculo = require("../models/GhlAsesorVinculo");
const Historial = require("../models/GhlAsesorDisponibilidadHistorial");
const Detalle = require("../models/GhlRepartoEjecucionDetalle");
const TiempoRealAsignacion = require("../models/GhlRepartoTiempoRealAsignacion");
const RealtimeConfiguracion = require("../models/GhlRepartoTiempoRealConfiguracion");
const ghl = require("./ghlService");

const TIME_ZONE = "America/Guayaquil";
const DEFAULT_AUTO_PAUSE_TIME = "18:00";
const AUTO_PAUSE_CACHE_MS = 30000;
const ESTADOS = Object.freeze(["ACTIVO", "PAUSADO"]);
const ID_RE = /^[A-Za-z0-9_-]{2,100}$/;
const CARGO_VENDEDOR_CALL_CENTER = "VENDEDOR CALL CENTER";

const availabilityError = (code, message, statusCode = 409) =>
  Object.assign(new Error(message), { code, statusCode });

const sanitizeLogMessage = (value) => String(value || "Error no especificado")
  .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
  .replace(/(authorization|cookie|token|secret)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]")
  .replace(/((?:phone|telefono|cedula|email|firstName|lastName|contactName|customerName|clientName|nombreCliente|message|body)\s*[=:]\s*)[^,;\]}]+/gi, "$1[REDACTED]")
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REDACTED]")
  .replace(/(?:\+?\d[\s().-]*){7,}/g, "[NUMBER_REDACTED]")
  .slice(0, 500);

const normalizeCargo = (cargo) =>
  String(cargo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const isVendedorCallCenterCargo = (cargo) =>
  normalizeCargo(cargo) === CARGO_VENDEDOR_CALL_CENTER;

const normalizeTime = (value) => {
  const match = String(value || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    ? `${match[1]}:${match[2]}`
    : null;
};

const getAutoPauseTime = (environment = process.env) =>
  normalizeTime(environment.GHL_ADVISOR_AUTO_PAUSE_TIME) || DEFAULT_AUTO_PAUSE_TIME;

let autoPauseCache = {
  value: getAutoPauseTime(),
  expiresAt: 0,
  persistida: false,
  migracionPendiente: false,
  actualizadoPorId: null,
  updatedAt: null,
};

const setAutoPauseCache = (value, metadata = {}) => {
  autoPauseCache = {
    value: normalizeTime(value) || getAutoPauseTime(),
    expiresAt: Date.now() + AUTO_PAUSE_CACHE_MS,
    persistida: metadata.persistida === true,
    migracionPendiente: metadata.migracionPendiente === true,
    actualizadoPorId: metadata.actualizadoPorId || null,
    updatedAt: metadata.updatedAt || null,
  };
  return autoPauseCache.value;
};

const currentAutoPauseTime = () =>
  normalizeTime(autoPauseCache.value) || getAutoPauseTime();

const isMissingAutoPauseSchema = (error) => {
  const code = error?.original?.code || error?.parent?.code || error?.code;
  return code === "42703" || code === "42P01";
};

async function getAutoPauseConfiguration({ force = false } = {}) {
  if (!force && autoPauseCache.expiresAt > Date.now()) {
    return {
      horaPausaAutomatica: currentAutoPauseTime(),
      zonaHoraria: TIME_ZONE,
      persistida: autoPauseCache.persistida,
      migracionPendiente: autoPauseCache.migracionPendiente,
      actualizadoPorId: autoPauseCache.actualizadoPorId,
      updatedAt: autoPauseCache.updatedAt,
    };
  }

  try {
    const row = await RealtimeConfiguracion.findByPk(1, {
      attributes: ["id", "horaPausaAutomatica", "actualizadoPorId", "updatedAt"],
    });
    const plain = typeof row?.toJSON === "function" ? row.toJSON() : row;
    const persistida = Boolean(row && normalizeTime(plain?.horaPausaAutomatica));
    const horaPausaAutomatica = setAutoPauseCache(plain?.horaPausaAutomatica, {
      persistida,
      actualizadoPorId: plain?.actualizadoPorId,
      updatedAt: plain?.updatedAt,
    });
    return {
      horaPausaAutomatica,
      zonaHoraria: TIME_ZONE,
      persistida,
      actualizadoPorId: plain?.actualizadoPorId || null,
      updatedAt: plain?.updatedAt || null,
    };
  } catch (error) {
    if (!isMissingAutoPauseSchema(error)) throw error;
    const horaPausaAutomatica = setAutoPauseCache(getAutoPauseTime(), {
      persistida: false,
      migracionPendiente: true,
    });
    return {
      horaPausaAutomatica,
      zonaHoraria: TIME_ZONE,
      persistida: false,
      migracionPendiente: true,
      actualizadoPorId: null,
      updatedAt: null,
    };
  }
}

async function saveAutoPauseConfiguration({ horaPausaAutomatica }, actorId) {
  const normalizedTime = normalizeTime(horaPausaAutomatica);
  if (!normalizedTime) {
    throw availabilityError(
      "INVALID_AUTO_PAUSE_TIME",
      "La hora de pausa automatica debe tener formato HH:mm",
      400,
    );
  }

  try {
    const row = await sequelize.transaction(async (transaction) => {
      const existing = await RealtimeConfiguracion.findByPk(1, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing) {
        await existing.update({
          horaPausaAutomatica: normalizedTime,
          actualizadoPorId: actorId,
        }, { transaction });
        return existing;
      }
      return RealtimeConfiguracion.create({
        id: 1,
        horaPausaAutomatica: normalizedTime,
        actualizadoPorId: actorId,
      }, { transaction });
    });
    const plain = typeof row?.toJSON === "function" ? row.toJSON() : row;
    setAutoPauseCache(normalizedTime, {
      persistida: true,
      actualizadoPorId: plain?.actualizadoPorId || actorId,
      updatedAt: plain?.updatedAt,
    });
    return {
      horaPausaAutomatica: normalizedTime,
      zonaHoraria: TIME_ZONE,
      persistida: true,
      actualizadoPorId: plain?.actualizadoPorId || actorId || null,
      updatedAt: plain?.updatedAt || null,
    };
  } catch (error) {
    if (!isMissingAutoPauseSchema(error)) throw error;
    throw availabilityError(
      "GHL_AUTO_PAUSE_MIGRATION_REQUIRED",
      "Debe aplicar la migracion de configuracion GHL antes de guardar la hora",
      503,
    );
  }
}

const resetAutoPauseCache = () => {
  autoPauseCache = {
    value: getAutoPauseTime(),
    expiresAt: 0,
    persistida: false,
    migracionPendiente: false,
    actualizadoPorId: null,
    updatedAt: null,
  };
};

function localTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return `${values.hour}:${values.minute}`;
}

const isAtOrAfterAutoPauseTime = (
  now = new Date(),
  autoPauseTime = currentAutoPauseTime(),
) => localTime(now) >= autoPauseTime;

const hasVendedorCallCenterCargo = (usuario) => {
  const cargos = [
    usuario?.rolPago?.cargo,
    ...(usuario?.rolesPago || []).map((rolPago) => rolPago?.cargo),
  ];
  return cargos.some(isVendedorCallCenterCargo);
};

async function isVendedorCallCenter(usuarioId) {
  const usuario = await Usuario.findOne({
    where: { id: usuarioId, activo: true },
    attributes: ["id"],
    include: [
      {
        model: RolPago,
        as: "rolPago",
        attributes: ["cargo"],
        required: false,
      },
      {
        model: RolPago,
        as: "rolesPago",
        attributes: ["cargo"],
        through: { attributes: [] },
        required: false,
      },
    ],
  });
  return hasVendedorCallCenterCargo(usuario);
}

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
  String(row?.estadoFechaLocal || "") === localDate(now) &&
  !isAtOrAfterAutoPauseTime(now)
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
  return countByGhlUserBetween(ghlUserIds, start, end);
}

async function countByGhlUserBetween(ghlUserIds, start, end) {
  if (!ghlUserIds.length) return new Map();
  const [scheduledRows, realtimeRows] = await Promise.all([
    Detalle.findAll({
      where: {
        estado: "assigned",
        newAssignedTo: { [Op.in]: ghlUserIds },
        assignedAt: { [Op.between]: [start, end] },
      },
      attributes: ["newAssignedTo", [fn("COUNT", col("id")), "cantidad"]],
      group: ["newAssignedTo"],
      raw: true,
    }),
    TiempoRealAsignacion.findAll({
      where: {
        ghlUserId: { [Op.in]: ghlUserIds },
        assignedAt: { [Op.between]: [start, end] },
      },
      attributes: ["ghlUserId", [fn("COUNT", col("id")), "cantidad"]],
      group: ["ghlUserId"],
      raw: true,
    }),
  ]);
  const counts = new Map();
  scheduledRows.forEach((row) => {
    counts.set(String(row.newAssignedTo), Number(row.cantidad) || 0);
  });
  realtimeRows.forEach((row) => {
    const userId = String(row.ghlUserId);
    counts.set(userId, (counts.get(userId) || 0) + (Number(row.cantidad) || 0));
  });
  return counts;
}

function reportDayBounds(fecha) {
  const normalizedDate = String(fecha || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw availabilityError("INVALID_REPORT_DATE", "La fecha debe tener formato YYYY-MM-DD", 400);
  }
  const start = new Date(`${normalizedDate}T00:00:00-05:00`);
  const end = new Date(`${normalizedDate}T23:59:59.999-05:00`);
  if (Number.isNaN(start.getTime()) || localDate(start) !== normalizedDate) {
    throw availabilityError("INVALID_REPORT_DATE", "La fecha indicada no es valida", 400);
  }
  return { date: normalizedDate, start, end };
}

async function getAdvisorManagementReport({ fecha = localDate(), now = new Date() } = {}) {
  await getAutoPauseConfiguration();
  const { date, start, end } = reportDayBounds(fecha);
  const vinculos = await Vinculo.findAll({
    where: { activo: true },
    include: [{
      model: Usuario,
      as: "usuario",
      attributes: ["id", "nombre", "email", "activo"],
      where: { activo: true },
      required: true,
    }],
    order: [[{ model: Usuario, as: "usuario" }, "nombre", "ASC"]],
  });
  const usuarioIds = vinculos.map((row) => row.usuarioId);
  const ghlUserIds = vinculos.map((row) => String(row.ghlUserId));
  const [historial, counts] = await Promise.all([
    usuarioIds.length
      ? Historial.findAll({
        where: {
          usuarioId: { [Op.in]: usuarioIds },
          accion: "ESTADO",
          createdAt: { [Op.between]: [start, end] },
        },
        attributes: [
          "usuarioId",
          "estadoNuevo",
          "createdAt",
          "cambiadoPorId",
          "motivoCambio",
          "metadata",
        ],
        include: [{
          model: Usuario,
          as: "cambiadoPor",
          attributes: ["id", "nombre"],
          required: false,
        }],
        order: [["createdAt", "ASC"]],
      })
      : [],
    countByGhlUserBetween(ghlUserIds, start, end),
  ]);
  const eventsByUser = new Map();
  historial.forEach((eventRow) => {
    const event = typeof eventRow.toJSON === "function" ? eventRow.toJSON() : eventRow;
    const key = String(event.usuarioId);
    if (!eventsByUser.has(key)) eventsByUser.set(key, []);
    eventsByUser.get(key).push(event);
  });
  const isToday = date === localDate(now);

  return vinculos.map((row) => {
    const plain = typeof row.toJSON === "function" ? row.toJSON() : row;
    const events = eventsByUser.get(String(plain.usuarioId)) || [];
    const playEvents = events.filter((event) => event.estadoNuevo === "ACTIVO");
    const pauseEvents = events.filter((event) => event.estadoNuevo === "PAUSADO");
    return {
      usuarioId: plain.usuarioId,
      nombre: plain.usuario?.nombre || plain.ghlNombre || "Sin nombre",
      email: plain.usuario?.email || plain.ghlEmail || "",
      estado: isToday ? effectiveState(plain, now) : (events.at(-1)?.estadoNuevo || "SIN_REGISTRO"),
      momentoPlay: playEvents.at(-1)?.createdAt || null,
      momentoDescanso: pauseEvents.at(-1)?.createdAt || null,
      leadsGestionados: counts.get(String(plain.ghlUserId)) || 0,
      cambiosEstado: events.length,
      historial: events.map((event) => ({
        estado: event.estadoNuevo,
        momento: event.createdAt,
        cambiadoPorId: event.cambiadoPorId || null,
        cambiadoPor: event.cambiadoPor?.nombre || null,
        origen: event.metadata?.origen || event.motivoCambio,
      })),
    };
  });
}

function serializeAvailability(row, leadsHoy = 0, now = new Date()) {
  const horaPausaAutomatica = currentAutoPauseTime();
  const bloqueadoPorHorario = isAtOrAfterAutoPauseTime(now, horaPausaAutomatica);
  if (!row) {
    return {
      vinculado: false,
      estado: "PAUSADO",
      recibiendoLeads: false,
      leadsHoy: 0,
      horaPausaAutomatica,
      bloqueadoPorHorario,
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
    horaPausaAutomatica,
    bloqueadoPorHorario,
  };
}

async function getMyAvailability(usuarioId, now = new Date()) {
  await getAutoPauseConfiguration();
  const aplicaRepartoGhl = await isVendedorCallCenter(usuarioId);
  if (!aplicaRepartoGhl) {
    return { ...serializeAvailability(null, 0, now), aplicaRepartoGhl: false };
  }

  const row = await Vinculo.findOne({ where: { usuarioId } });
  if (!row) return { ...serializeAvailability(null, 0, now), aplicaRepartoGhl: true };
  const counts = await countTodayByGhlUser([row.ghlUserId], now);
  return {
    ...serializeAvailability(row, counts.get(String(row.ghlUserId)) || 0, now),
    aplicaRepartoGhl: true,
  };
}

async function listAdvisorAvailability(now = new Date()) {
  await getAutoPauseConfiguration();
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
  try {
  const normalizedState = String(estado || "").trim().toUpperCase();
  if (!ESTADOS.includes(normalizedState)) {
    throw availabilityError("INVALID_AVAILABILITY_STATE", "El estado debe ser ACTIVO o PAUSADO", 400);
  }

  if (normalizedState === "ACTIVO") {
    const { horaPausaAutomatica: autoPauseTime } = await getAutoPauseConfiguration();
    if (isAtOrAfterAutoPauseTime(now, autoPauseTime)) {
      throw availabilityError(
        "GHL_AVAILABILITY_CLOSED",
        `El reparto diario cerro a las ${autoPauseTime}. Podra volver a activar Play manana.`,
        409,
      );
    }
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
    const currentGhlUsers = await fetchCurrentGhlUsers();
    assignableGhlIds = new Set(currentGhlUsers.map(ghlUserIdOf));
  }

  const today = localDate(now);
  const disponibilidad = await sequelize.transaction(async (transaction) => {
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
  console.log("[GHL] DISPONIBILIDAD", {
    fechaHora: new Date().toISOString(),
    usuarioId,
    ghlUserId: disponibilidad.ghlUserId || null,
    estado: disponibilidad.estado,
  });
  return disponibilidad;
  } catch (error) {
    console.log("[GHL] DISPONIBILIDAD", {
      fechaHora: new Date().toISOString(),
      usuarioId,
      ghlUserId: null,
      estado: null,
      codigo: error.code || "GHL_AVAILABILITY_ERROR",
      mensaje: sanitizeLogMessage(error.message),
    });
    throw error;
  }
}

async function pauseAllActiveAdvisors({ now = new Date() } = {}) {
  const { horaPausaAutomatica: autoPauseTime } = await getAutoPauseConfiguration({ force: true });
  const fechaLocal = localDate(now);
  if (!isAtOrAfterAutoPauseTime(now, autoPauseTime)) {
    return {
      executed: false,
      paused: 0,
      autoPauseTime,
      fechaLocal,
    };
  }

  const paused = await sequelize.transaction(async (transaction) => {
    const rows = await Vinculo.findAll({
      where: {
        activo: true,
        estadoRecepcion: "ACTIVO",
        estadoFechaLocal: fechaLocal,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    for (const row of rows) {
      await row.update(
        {
          estadoRecepcion: "PAUSADO",
          estadoFechaLocal: null,
          estadoCambiadoAt: now,
          estadoCambiadoPorId: null,
          motivoUltimoCambio: "administrador",
        },
        { transaction },
      );
      await Historial.create(
        {
          vinculoId: row.id,
          usuarioId: row.usuarioId,
          ghlUserId: row.ghlUserId,
          accion: "ESTADO",
          estadoAnterior: "ACTIVO",
          estadoNuevo: "PAUSADO",
          cambiadoPorId: null,
          motivoCambio: "administrador",
          fechaLocal,
          metadata: {
            origen: "automatico",
            motivo: "CIERRE_HORARIO",
            horaPausaAutomatica: autoPauseTime,
          },
        },
        { transaction },
      );
    }

    return rows.length;
  });

  if (paused > 0) {
    console.log("[GHL] PAUSA_AUTOMATICA", {
      fechaHora: now.toISOString(),
      horaLocal: localTime(now),
      horaConfigurada: autoPauseTime,
      asesoresPausados: paused,
    });
  }

  return {
    executed: true,
    paused,
    autoPauseTime,
    fechaLocal,
  };
}

async function resolveConfiguredAdvisors(configuredUsers, currentGhlUsers, now = new Date()) {
  await getAutoPauseConfiguration();
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
  await getAutoPauseConfiguration();
  const row = await Vinculo.findOne({
    where: { ghlUserId, activo: true },
    include: [{ model: Usuario, as: "usuario", attributes: ["id", "activo"] }],
  });
  return Boolean(row?.usuario?.activo === true && effectiveState(row, now) === "ACTIVO");
}

async function resolveActiveAdvisors(currentGhlUsers, now = new Date()) {
  await getAutoPauseConfiguration();
  const rows = await Vinculo.findAll({
    where: { activo: true },
    include: [{
      model: Usuario,
      as: "usuario",
      attributes: ["id", "activo"],
      where: { activo: true },
      required: true,
    }],
  });
  const currentById = new Map(
    (currentGhlUsers || [])
      .filter((user) => user?.deleted !== true && user?.active !== false && user?.status !== "inactive")
      .map((user) => [ghlUserIdOf(user), user]),
  );
  const result = { active: [], paused: [], invalid: [] };

  rows.forEach((row) => {
    const ghlUser = currentById.get(String(row.ghlUserId));
    const user = {
      id: String(row.ghlUserId),
      name: ghlUser ? ghlUserNameOf(ghlUser) : row.ghlNombre,
      email: String(ghlUser?.email || row.ghlEmail || ""),
    };
    if (!ghlUser) {
      result.invalid.push({ ...user, reason: "El usuario vinculado ya no es asignable en GHL" });
    }
    else if (effectiveState(row, now) === "ACTIVO") result.active.push(user);
    else result.paused.push(user);
  });

  return result;
}

module.exports = {
  TIME_ZONE,
  DEFAULT_AUTO_PAUSE_TIME,
  ESTADOS,
  availabilityError,
  normalizeCargo,
  isVendedorCallCenterCargo,
  hasVendedorCallCenterCargo,
  isVendedorCallCenter,
  normalizeTime,
  getAutoPauseTime,
  currentAutoPauseTime,
  getAutoPauseConfiguration,
  saveAutoPauseConfiguration,
  resetAutoPauseCache,
  localTime,
  isAtOrAfterAutoPauseTime,
  localDate,
  localDayBounds,
  effectiveState,
  fetchCurrentGhlUsers,
  countTodayByGhlUser,
  countByGhlUserBetween,
  reportDayBounds,
  getAdvisorManagementReport,
  serializeAvailability,
  getMyAvailability,
  listAdvisorAvailability,
  saveAssociation,
  changeAvailability,
  pauseAllActiveAdvisors,
  resolveConfiguredAdvisors,
  resolveActiveAdvisors,
  isGhlUserActiveToday,
};
