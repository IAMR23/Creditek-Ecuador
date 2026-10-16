const { Op, Transaction, UniqueConstraintError } = require("sequelize");
const { sequelize } = require("../config/db");
const DetalleVenta = require("../models/DetalleVenta");
const DispositivoMarca = require("../models/DispositivoMarca");
const LogisticaMastherPhoneAjuste = require("../models/LogisticaMastherPhoneAjuste");
const LogisticaMastherPhoneCierre = require("../models/LogisticaMastherPhoneCierre");
const LogisticaMastherPhoneCierreDetalle = require("../models/LogisticaMastherPhoneCierreDetalle");
const LogisticaMastherPhoneIngreso = require("../models/LogisticaMastherPhoneIngreso");
const Marca = require("../models/Marca");
const Modelo = require("../models/Modelo");
const Venta = require("../models/Venta");

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
const ORIGINS = ["CREDITEK", "PROVEEDOR"];
const ORIGIN_SET = new Set(ORIGINS);

const createError = (message, httpStatus = 400, code = "VALIDATION_ERROR") => {
  const error = new Error(message);
  error.httpStatus = httpStatus;
  error.code = code;
  return error;
};

const parsePositiveInteger = (value, name) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw createError(`${name} debe ser un número entero positivo.`);
  }
  return number;
};

const parseSignedInteger = (value, name) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number === 0) {
    throw createError(`${name} debe ser un entero distinto de cero.`);
  }
  return number;
};

const calculateEntryAmounts = (unitPriceValue, quantityValue) => {
  const unitPriceText = String(unitPriceValue ?? "").trim();
  if (!unitPriceText) {
    parsePositiveInteger(quantityValue, "La cantidad");
    return { precioUnitario: null, subtotal: null, iva: null, total: null };
  }
  if (!/^\d+(?:\.\d{1,6})?$/.test(unitPriceText)) {
    throw createError(
      "El precio unitario debe usar punto, ser mayor a cero y tener máximo seis decimales.",
    );
  }
  const unitPrice = Number(unitPriceText);
  const quantity = parsePositiveInteger(quantityValue, "La cantidad");
  const unitPriceUnits = Math.round(unitPrice * 1000000);
  if (
    !Number.isFinite(unitPrice) ||
    unitPriceUnits < 1 ||
    Math.abs(unitPrice * 1000000 - unitPriceUnits) > 0.000001
  ) {
    throw createError("El precio unitario debe ser mayor a cero y tener máximo seis decimales.");
  }
  const subtotalUnits = unitPriceUnits * quantity;
  const ivaUnits = Math.round(subtotalUnits * 0.15);
  const totalUnits = subtotalUnits + ivaUnits;
  if (!Number.isSafeInteger(totalUnits)) {
    throw createError("El valor total supera el máximo permitido.");
  }
  return {
    precioUnitario: (unitPriceUnits / 1000000).toFixed(6),
    subtotal: (subtotalUnits / 1000000).toFixed(6),
    iva: (ivaUnits / 1000000).toFixed(6),
    total: (totalUnits / 1000000).toFixed(6),
  };
};

const parseDateOnly = (value, name = "La fecha") => {
  const text = String(value || "").trim();
  if (!DATE_ONLY_PATTERN.test(text)) {
    throw createError(`${name} debe tener formato YYYY-MM-DD.`);
  }
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw createError(`${name} no es válida.`);
  }
  return text;
};

const addDays = (dateOnly, days) => {
  const [year, month, day] = parseDateOnly(dateOnly).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

// El periodo operativo siempre comienza el jueves y termina el jueves siguiente.
const getWeekStart = (dateOnly) => {
  const validDate = parseDateOnly(dateOnly);
  const [year, month, day] = validDate.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(validDate, -((dayOfWeek - 4 + 7) % 7));
};

const validateWeekStart = (value) => {
  const date = parseDateOnly(value, "La semana");
  if (getWeekStart(date) !== date) {
    throw createError("La semana debe iniciar un jueves.");
  }
  return date;
};

const parseLocalDateTime = (value, label) => {
  const text = String(value || "").trim();
  const match = text.match(LOCAL_DATE_TIME_PATTERN);
  if (!match) {
    throw createError(`${label} debe tener formato YYYY-MM-DDTHH:mm.`);
  }
  const [, dateOnly, hourText, minuteText, secondText = "00"] = match;
  parseDateOnly(dateOnly, label);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (hour > 23 || minute > 59 || second > 59) {
    throw createError(`${label} no es válida.`);
  }
  return new Date(
    `${dateOnly}T${hourText}:${minuteText}:${secondText.padStart(2, "0")}-05:00`,
  );
};

const parseEntryDateTime = (value) =>
  parseLocalDateTime(value, "La fecha y hora de ingreso");
const parseAdjustmentDateTime = (value) =>
  parseLocalDateTime(value, "La fecha y hora del ajuste");

const ecuadorDayStart = (dateOnly) =>
  new Date(`${parseDateOnly(dateOnly)}T00:00:00-05:00`);
const ecuadorDayEndExclusive = (dateOnly) =>
  new Date(`${addDays(parseDateOnly(dateOnly), 1)}T00:00:00-05:00`);

const toEcuadorDateOnly = (value) => {
  if (DATE_ONLY_PATTERN.test(String(value || ""))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const timestampValue = (value) => new Date(value).getTime();
const serializeDateTime = (value) => {
  const timestamp = timestampValue(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
};

const normalizeOrigin = (value) => {
  const origin = String(value || "").trim().toUpperCase();
  if (!ORIGIN_SET.has(origin)) throw createError("Selecciona un origen válido.");
  return origin;
};

const catalogInclude = (activeOnly = false) => ({
  model: DispositivoMarca,
  as: "dispositivoMarca",
  ...(activeOnly ? { where: { activo: true }, required: true } : { required: true }),
  attributes: ["id", "marcaId"],
  include: [
    {
      model: Marca,
      as: "marca",
      ...(activeOnly ? { where: { activo: true }, required: true } : { required: true }),
      attributes: ["id", "nombre"],
    },
  ],
});

const modelInclude = (activeOnly = false) => ({
  model: Modelo,
  as: "modelo",
  ...(activeOnly ? { where: { activo: true }, required: true } : { required: true }),
  attributes: ["id", "nombre", "dispositivoMarcaId"],
  include: [catalogInclude(activeOnly)],
});

const modelMetadata = (model) => {
  const brand = model?.dispositivoMarca?.marca;
  return {
    modeloId: Number(model?.id),
    marcaId: Number(brand?.id),
    marca: brand?.nombre || "",
    modelo: model?.nombre || "",
    producto: `${brand?.nombre || ""} ${model?.nombre || ""}`.trim(),
  };
};

const getCatalog = async () => {
  const models = await Modelo.findAll({
    where: { activo: true },
    attributes: ["id", "nombre", "dispositivoMarcaId"],
    include: [catalogInclude(true)],
    order: [["nombre", "ASC"]],
  });
  const brands = new Map();
  const serializedModels = models.map((instance) => {
    const item = instance.get({ plain: true });
    const metadata = modelMetadata(item);
    brands.set(metadata.marcaId, { id: metadata.marcaId, nombre: metadata.marca });
    return {
      id: metadata.modeloId,
      nombre: metadata.modelo,
      marcaId: metadata.marcaId,
      marca: metadata.marca,
    };
  });
  return {
    marcas: Array.from(brands.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    ),
    modelos: serializedModels,
  };
};

const getActiveModel = (modelId, transaction) =>
  Modelo.findOne({
    where: { id: modelId, activo: true },
    attributes: ["id", "nombre", "dispositivoMarcaId"],
    include: [catalogInclude(true)],
    transaction,
  });

const serializeEntry = (entry) => {
  const item = entry.get ? entry.get({ plain: true }) : entry;
  return {
    id: item.id,
    modeloId: item.modeloId,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario == null ? null : Number(item.precioUnitario),
    subtotal: item.subtotal == null ? null : Number(item.subtotal),
    iva: item.iva == null ? null : Number(item.iva),
    total: item.total == null ? null : Number(item.total),
    fechaIngreso: serializeDateTime(item.fechaIngreso),
    bodega: item.bodega,
    registradoPorId: item.registradoPorId,
    actualizadoPorId: item.actualizadoPorId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const serializeAdjustment = (adjustment) => {
  const item = adjustment.get ? adjustment.get({ plain: true }) : adjustment;
  return {
    id: item.id,
    modeloId: item.modeloId,
    origen: item.origen,
    cantidad: Number(item.cantidad),
    motivo: item.motivo,
    tipo: item.tipo,
    cierreCorregidoId: item.cierreCorregidoId,
    fechaAjuste: serializeDateTime(item.fechaAjuste),
    registradoPorId: item.registradoPorId,
    createdAt: item.createdAt,
  };
};

const assertOpenDate = async (date, transaction) => {
  const periodStart = getWeekStart(toEcuadorDateOnly(date));
  const closure = await LogisticaMastherPhoneCierre.findOne({
    where: { periodoInicio: periodStart },
    attributes: ["id"],
    transaction,
  });
  if (closure) {
    throw createError(
      "El período está cerrado. Registra una corrección trazable en una semana abierta.",
      409,
      "PERIOD_CLOSED",
    );
  }
};

const registerEntry = async (payload, userId) => {
  const modelId = parsePositiveInteger(payload.modeloId, "modeloId");
  const quantity = parsePositiveInteger(payload.cantidad, "La cantidad");
  const amounts = calculateEntryAmounts(payload.precioUnitario, quantity);
  const entryDate = parseEntryDateTime(payload.fechaIngreso);
  const warehouse = normalizeOrigin(payload.bodega);
  const requestKey = String(payload.requestKey || "").trim();
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    throw createError("La clave de la solicitud no es válida.");
  }
  const matchesRequest = (item) =>
    item &&
    Number(item.modeloId) === modelId &&
    Number(item.cantidad) === quantity &&
    timestampValue(item.fechaIngreso) === entryDate.getTime() &&
    item.bodega === warehouse &&
    (item.precioUnitario == null ? null : Number(item.precioUnitario)) ===
      (amounts.precioUnitario == null ? null : Number(amounts.precioUnitario));
  const existing = await LogisticaMastherPhoneIngreso.findOne({ where: { requestKey } });
  if (existing) {
    if (!matchesRequest(existing)) {
      throw createError(
        "La clave de la solicitud ya fue utilizada con otros datos.",
        409,
        "REQUEST_KEY_CONFLICT",
      );
    }
    return { ingreso: serializeEntry(existing), duplicado: true };
  }

  const model = await getActiveModel(modelId);
  if (!model) throw createError("El modelo no existe o está inactivo.");
  await assertOpenDate(entryDate);

  try {
    const created = await LogisticaMastherPhoneIngreso.create({
      modeloId: modelId,
      cantidad: quantity,
      ...amounts,
      fechaIngreso: entryDate,
      bodega: warehouse,
      registradoPorId: userId || null,
      requestKey,
    });
    return { ingreso: serializeEntry(created), duplicado: false };
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    const concurrent = await LogisticaMastherPhoneIngreso.findOne({ where: { requestKey } });
    if (matchesRequest(concurrent)) {
      return { ingreso: serializeEntry(concurrent), duplicado: true };
    }
    throw createError(
      "La clave de la solicitud ya fue utilizada con otros datos.",
      409,
      "REQUEST_KEY_CONFLICT",
    );
  }
};

const listEntries = async ({ dateFrom, dateTo, brandId, modelId }) => {
  const start = parseDateOnly(dateFrom, "La fecha inicial");
  const end = parseDateOnly(dateTo, "La fecha final");
  if (start > end) throw createError("La fecha inicial no puede ser posterior a la fecha final.");
  const parsedBrandId = brandId ? parsePositiveInteger(brandId, "marcaId") : null;
  const parsedModelId = modelId ? parsePositiveInteger(modelId, "modeloId") : null;
  const entries = await LogisticaMastherPhoneIngreso.findAll({
    where: {
      fechaIngreso: { [Op.gte]: ecuadorDayStart(start), [Op.lt]: ecuadorDayEndExclusive(end) },
      ...(parsedModelId ? { modeloId: parsedModelId } : {}),
    },
    include: [modelInclude(false)],
    order: [["fechaIngreso", "DESC"], ["id", "DESC"]],
  });
  return entries
    .map((entry) => entry.get({ plain: true }))
    .map((entry) => ({ ...serializeEntry(entry), ...modelMetadata(entry.modelo) }))
    .filter((entry) => !parsedBrandId || entry.marcaId === parsedBrandId);
};

const updateEntry = async (entryId, payload, userId) => {
  const parsedEntryId = parsePositiveInteger(entryId, "ingresoId");
  const modelId = parsePositiveInteger(payload.modeloId, "modeloId");
  const quantity = parsePositiveInteger(payload.cantidad, "La cantidad");
  const amounts = calculateEntryAmounts(payload.precioUnitario, quantity);
  const entryDate = parseEntryDateTime(payload.fechaIngreso);
  const warehouse = normalizeOrigin(payload.bodega);
  const [entry, model] = await Promise.all([
    LogisticaMastherPhoneIngreso.findByPk(parsedEntryId),
    getActiveModel(modelId),
  ]);
  if (!entry) throw createError("El ingreso no existe.", 404, "ENTRY_NOT_FOUND");
  if (!model) throw createError("El modelo no existe o está inactivo.");
  await assertOpenDate(entry.fechaIngreso);
  await assertOpenDate(entryDate);
  await entry.update({
    modeloId: modelId,
    cantidad: quantity,
    ...amounts,
    fechaIngreso: entryDate,
    bodega: warehouse,
    actualizadoPorId: userId || null,
  });
  return serializeEntry(entry);
};

const deleteEntry = async (entryId) => {
  const parsedEntryId = parsePositiveInteger(entryId, "ingresoId");
  const entry = await LogisticaMastherPhoneIngreso.findByPk(parsedEntryId);
  if (!entry) throw createError("El ingreso no existe.", 404, "ENTRY_NOT_FOUND");
  await assertOpenDate(entry.fechaIngreso);
  await entry.destroy();
  return { id: parsedEntryId };
};

const registerAdjustment = async (payload, userId) => {
  const modelId = parsePositiveInteger(payload.modeloId, "modeloId");
  const quantity = parseSignedInteger(payload.cantidad, "La cantidad del ajuste");
  const origin = normalizeOrigin(payload.origen);
  const reason = String(payload.motivo || "").trim();
  if (reason.length < 5 || reason.length > 500) {
    throw createError("El motivo debe tener entre 5 y 500 caracteres.");
  }
  const adjustmentDate = parseAdjustmentDateTime(payload.fechaAjuste);
  const requestKey = String(payload.requestKey || "").trim();
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    throw createError("La clave de la solicitud no es válida.");
  }
  const closureId = payload.cierreCorregidoId
    ? parsePositiveInteger(payload.cierreCorregidoId, "cierreCorregidoId")
    : null;
  const type = closureId ? "CORRECCION_CIERRE" : "AJUSTE";
  const matchesRequest = (item) =>
    item &&
    Number(item.modeloId) === modelId &&
    Number(item.cantidad) === quantity &&
    item.origen === origin &&
    item.motivo === reason &&
    timestampValue(item.fechaAjuste) === adjustmentDate.getTime() &&
    Number(item.cierreCorregidoId || 0) === Number(closureId || 0);
  const existing = await LogisticaMastherPhoneAjuste.findOne({ where: { requestKey } });
  if (existing) {
    if (!matchesRequest(existing)) {
      throw createError(
        "La clave de la solicitud ya fue utilizada con otros datos.",
        409,
        "REQUEST_KEY_CONFLICT",
      );
    }
    return { ajuste: serializeAdjustment(existing), duplicado: true };
  }
  const [model, correctedClosure] = await Promise.all([
    getActiveModel(modelId),
    closureId ? LogisticaMastherPhoneCierre.findByPk(closureId) : null,
  ]);
  if (!model) throw createError("El modelo no existe o está inactivo.");
  if (closureId && !correctedClosure) {
    throw createError("El cierre que se desea corregir no existe.", 404, "CLOSURE_NOT_FOUND");
  }
  if (
    correctedClosure &&
    correctedClosure.periodoInicio >= getWeekStart(toEcuadorDateOnly(adjustmentDate))
  ) {
    throw createError("La corrección debe aplicarse en una semana posterior al cierre referido.");
  }
  await assertOpenDate(adjustmentDate);

  try {
    const created = await LogisticaMastherPhoneAjuste.create({
      modeloId: modelId,
      origen,
      cantidad: quantity,
      motivo: reason,
      tipo: type,
      cierreCorregidoId: closureId,
      fechaAjuste: adjustmentDate,
      registradoPorId: userId || null,
      requestKey,
    });
    return { ajuste: serializeAdjustment(created), duplicado: false };
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    const concurrent = await LogisticaMastherPhoneAjuste.findOne({ where: { requestKey } });
    if (matchesRequest(concurrent)) {
      return { ajuste: serializeAdjustment(concurrent), duplicado: true };
    }
    throw createError(
      "La clave de la solicitud ya fue utilizada con otros datos.",
      409,
      "REQUEST_KEY_CONFLICT",
    );
  }
};

const listAdjustments = async ({ dateFrom, dateTo, brandId, modelId }) => {
  const start = parseDateOnly(dateFrom, "La fecha inicial");
  const end = parseDateOnly(dateTo, "La fecha final");
  if (start > end) throw createError("La fecha inicial no puede ser posterior a la fecha final.");
  const parsedBrandId = brandId ? parsePositiveInteger(brandId, "marcaId") : null;
  const parsedModelId = modelId ? parsePositiveInteger(modelId, "modeloId") : null;
  const adjustments = await LogisticaMastherPhoneAjuste.findAll({
    where: {
      fechaAjuste: { [Op.gte]: ecuadorDayStart(start), [Op.lt]: ecuadorDayEndExclusive(end) },
      ...(parsedModelId ? { modeloId: parsedModelId } : {}),
    },
    include: [modelInclude(false)],
    order: [["fechaAjuste", "DESC"], ["id", "DESC"]],
  });
  return adjustments
    .map((item) => item.get({ plain: true }))
    .map((item) => ({ ...serializeAdjustment(item), ...modelMetadata(item.modelo) }))
    .filter((item) => !parsedBrandId || item.marcaId === parsedBrandId);
};

const collectSalesOperations = async ({ modelIds, dateFrom, dateToExclusive, transaction }) => {
  if (!modelIds.length) return [];
  const activeSales = await Venta.findAll({
    where: {
      activo: true,
      fecha: { [Op.gte]: dateFrom, [Op.lt]: dateToExclusive },
    },
    attributes: ["id", "fecha"],
    include: [
      {
        model: DetalleVenta,
        as: "detalleVenta",
        where: { modeloId: { [Op.in]: modelIds } },
        required: true,
        attributes: ["modeloId", "cantidad"],
      },
    ],
    order: [["fecha", "ASC"], ["id", "ASC"]],
    transaction,
  });
  const operations = [];
  for (const sale of activeSales) {
    for (const detail of sale.detalleVenta || []) {
      const quantity = Number(detail.cantidad);
      if (Number.isSafeInteger(quantity) && quantity > 0) {
        operations.push({
          ventaId: Number(sale.id),
          modeloId: Number(detail.modeloId),
          fecha: sale.fecha,
          cantidad: quantity,
        });
      }
    }
  }
  return operations;
};

const emptyBalance = () => ({ CREDITEK: 0, PROVEEDOR: 0 });
const cloneBalances = (balances) =>
  new Map(Array.from(balances, ([modelId, balance]) => [modelId, { ...balance }]));

const sortEvents = (events) =>
  [...events].sort((a, b) => {
    const time = a.timestamp - b.timestamp;
    if (time !== 0) return time;
    // Venta.fecha sólo tiene día. Los ingresos/ajustes exactamente a las 00:00
    // son existencias de apertura de ese día; cualquier movimiento con una hora
    // posterior continúa procesándose después de la venta fechada ese día.
    const priority = { AJUSTE: 0, INGRESO: 1, VENTA: 2 };
    return priority[a.tipo] - priority[b.tipo] || (a.id || 0) - (b.id || 0);
  });

const simulateInventory = ({
  initialBalances = new Map(),
  events = [],
  periodStart,
  periodEndExclusive,
  metadata = new Map(),
}) => {
  const startTime = ecuadorDayStart(periodStart).getTime();
  const endTime = ecuadorDayStart(periodEndExclusive).getTime();
  const balances = cloneBalances(initialBalances);
  const ensureBalance = (modelId) => {
    if (!balances.has(modelId)) balances.set(modelId, emptyBalance());
    return balances.get(modelId);
  };

  const apply = (event, row, incidents) => {
    const balance = ensureBalance(event.modeloId);
    if (event.tipo === "INGRESO") {
      balance[event.origen] += event.cantidad;
      if (row) row.ingresos[event.origen] += event.cantidad;
      return;
    }
    if (event.tipo === "AJUSTE") {
      balance[event.origen] += event.cantidad;
      if (row) row.ajustes[event.origen] += event.cantidad;
      if (balance[event.origen] < 0) {
        incidents.push({
          tipo: "AJUSTE_SIN_EXISTENCIA",
          modeloId: event.modeloId,
          fecha: event.fecha,
          origen: event.origen,
          cantidadSolicitada: Math.abs(event.cantidad),
          faltante: Math.abs(balance[event.origen]),
          referenciaId: event.id,
          mensaje: "El ajuste deja un saldo negativo en su origen.",
        });
      }
      return;
    }

    let pending = event.cantidad;
    const fromCreditek = Math.min(Math.max(balance.CREDITEK, 0), pending);
    balance.CREDITEK -= fromCreditek;
    pending -= fromCreditek;
    const fromProvider = Math.min(Math.max(balance.PROVEEDOR, 0), pending);
    balance.PROVEEDOR -= fromProvider;
    pending -= fromProvider;
    if (row) {
      row.ventasTotales += event.cantidad;
      row.salidas.CREDITEK += fromCreditek;
      row.salidas.PROVEEDOR += fromProvider;
      row.salidasSinStock += pending;
    }
    if (pending > 0) {
      incidents.push({
        tipo: "VENTA_SIN_EXISTENCIA",
        modeloId: event.modeloId,
        fecha: event.fecha,
        cantidadSolicitada: event.cantidad,
        disponibleCreditek: fromCreditek,
        disponibleProveedor: fromProvider,
        faltante: pending,
        referenciaId: event.id,
        mensaje: "La venta no tiene existencias suficientes en Creditek ni proveedor.",
      });
    }
  };

  const sortedEvents = sortEvents(events);
  for (const event of sortedEvents) {
    if (event.timestamp >= startTime) break;
    apply(event, null, []);
  }
  const openings = cloneBalances(balances);
  const rows = new Map();
  const incidents = [];
  const ensureRow = (modelId) => {
    if (!rows.has(modelId)) {
      rows.set(modelId, {
        modeloId: modelId,
        ingresos: emptyBalance(),
        ajustes: emptyBalance(),
        salidas: emptyBalance(),
        ventasTotales: 0,
        salidasSinStock: 0,
      });
    }
    return rows.get(modelId);
  };

  for (const modelId of new Set([...balances.keys(), ...metadata.keys()])) ensureRow(modelId);
  for (const event of sortedEvents) {
    if (event.timestamp < startTime || event.timestamp >= endTime) continue;
    apply(event, ensureRow(event.modeloId), incidents);
  }

  return Array.from(rows.values())
    .map((row) => {
      const opening = openings.get(row.modeloId) || emptyBalance();
      const final = balances.get(row.modeloId) || emptyBalance();
      const info = metadata.get(row.modeloId) || { modeloId: row.modeloId };
      return {
        ...info,
        stockInicialCreditek: opening.CREDITEK,
        stockInicialProveedor: opening.PROVEEDOR,
        ingresosCreditek: row.ingresos.CREDITEK,
        ingresosProveedor: row.ingresos.PROVEEDOR,
        ventasTotales: row.ventasTotales,
        ventasCreditek: row.salidas.CREDITEK,
        ventasProveedor: row.salidas.PROVEEDOR,
        salidasSinStock: row.salidasSinStock,
        ajustesCreditek: row.ajustes.CREDITEK,
        ajustesProveedor: row.ajustes.PROVEEDOR,
        saldoFinalCreditek: final.CREDITEK,
        saldoFinalProveedor: final.PROVEEDOR,
        incidencias: incidents.filter((item) => item.modeloId === row.modeloId),
      };
    })
    .filter(
      (row) =>
        row.stockInicialCreditek !== 0 ||
        row.stockInicialProveedor !== 0 ||
        row.ingresosCreditek !== 0 ||
        row.ingresosProveedor !== 0 ||
        row.ventasTotales !== 0 ||
        row.ajustesCreditek !== 0 ||
        row.ajustesProveedor !== 0 ||
        row.saldoFinalCreditek !== 0 ||
        row.saldoFinalProveedor !== 0 ||
        row.incidencias.length !== 0,
    );
};

const loadClosureSnapshot = async (closureInstance, transaction) => {
  if (!closureInstance) return null;
  const closure = closureInstance.get
    ? closureInstance.get({ plain: true })
    : { ...closureInstance };
  const details = await LogisticaMastherPhoneCierreDetalle.findAll({
    where: { cierreId: closure.id },
    include: [modelInclude(false)],
    order: [["modeloId", "ASC"], ["origen", "ASC"]],
    transaction,
  });
  return {
    ...closure,
    detalles: details.map((detail) =>
      detail.get ? detail.get({ plain: true }) : detail,
    ),
  };
};

const rowsFromClosure = (closure) => {
  const grouped = new Map();
  for (const detail of closure.detalles || []) {
    const info = modelMetadata(detail.modelo);
    const row = grouped.get(Number(detail.modeloId)) || {
      ...info,
      stockInicialCreditek: 0,
      stockInicialProveedor: 0,
      ingresosCreditek: 0,
      ingresosProveedor: 0,
      ventasTotales: 0,
      ventasCreditek: 0,
      ventasProveedor: 0,
      salidasSinStock: 0,
      ajustesCreditek: 0,
      ajustesProveedor: 0,
      saldoFinalCreditek: 0,
      saldoFinalProveedor: 0,
      incidencias: [],
    };
    const suffix = detail.origen === "CREDITEK" ? "Creditek" : "Proveedor";
    row[`stockInicial${suffix}`] = Number(detail.saldoInicial);
    row[`ingresos${suffix}`] = Number(detail.ingresos);
    row[`ventas${suffix}`] = Number(detail.salidas);
    row[`ajustes${suffix}`] = Number(detail.ajustes);
    row[`saldoFinal${suffix}`] = Number(detail.saldoFinal);
    grouped.set(Number(detail.modeloId), row);
  }
  for (const row of grouped.values()) row.ventasTotales = row.ventasCreditek + row.ventasProveedor;
  return Array.from(grouped.values());
};

const totalsForRows = (rows) => {
  const fields = [
    "stockInicialCreditek",
    "stockInicialProveedor",
    "ingresosCreditek",
    "ingresosProveedor",
    "ventasTotales",
    "ventasCreditek",
    "ventasProveedor",
    "salidasSinStock",
    "ajustesCreditek",
    "ajustesProveedor",
    "saldoFinalCreditek",
    "saldoFinalProveedor",
  ];
  return Object.fromEntries(
    fields.map((field) => [field, rows.reduce((sum, row) => sum + Number(row[field] || 0), 0)]),
  );
};

const periodHasEnded = (periodEndExclusive, now = new Date()) =>
  now.getTime() >= ecuadorDayStart(periodEndExclusive).getTime();

const findEarliestTrackedPeriod = async (transaction) => {
  const [entry, adjustment] = await Promise.all([
    LogisticaMastherPhoneIngreso.findOne({
      attributes: ["fechaIngreso"],
      order: [["fechaIngreso", "ASC"], ["id", "ASC"]],
      transaction,
    }),
    LogisticaMastherPhoneAjuste.findOne({
      attributes: ["fechaAjuste"],
      order: [["fechaAjuste", "ASC"], ["id", "ASC"]],
      transaction,
    }),
  ]);
  const dates = [entry?.fechaIngreso, adjustment?.fechaAjuste]
    .filter(Boolean)
    .map((value) => timestampValue(value));
  if (!dates.length) return null;
  return getWeekStart(toEcuadorDateOnly(new Date(Math.min(...dates))));
};

const getReport = async (
  { weekStart, dateFrom, brandId, modelId },
  { transaction, now = new Date() } = {},
) => {
  const selectedStart = validateWeekStart(weekStart || getWeekStart(dateFrom));
  const periodEndExclusive = addDays(selectedStart, 7);
  const periodEnd = addDays(selectedStart, 6);
  const parsedBrandId = brandId ? parsePositiveInteger(brandId, "marcaId") : null;
  const parsedModelId = modelId ? parsePositiveInteger(modelId, "modeloId") : null;
  const exactClosureInstance = await LogisticaMastherPhoneCierre.findOne({
    where: { periodoInicio: selectedStart },
    transaction,
  });

  if (exactClosureInstance) {
    const closure = await loadClosureSnapshot(exactClosureInstance, transaction);
    const allRows = rowsFromClosure(closure).sort((a, b) =>
      a.producto.localeCompare(b.producto, "es"),
    );
    const rows = allRows.filter(
      (row) =>
        (!parsedModelId || row.modeloId === parsedModelId) &&
        (!parsedBrandId || row.marcaId === parsedBrandId),
    );
    return {
      semanaInicio: selectedStart,
      semanaFin: periodEnd,
      periodoFinExclusivo: periodEndExclusive,
      estado: "CERRADA",
      cierre: { id: closure.id, cerradoPorId: closure.cerradoPorId, cerradoEn: closure.cerradoEn },
      periodoTerminado: true,
      puedeCerrar: false,
      motivoNoCierre: "La semana ya fue cerrada.",
      filas: rows,
      incidencias: [],
      totales: totalsForRows(rows),
    };
  }

  const latestClosureInstance = await LogisticaMastherPhoneCierre.findOne({
    where: { periodoInicio: { [Op.lt]: selectedStart } },
    order: [["periodoInicio", "DESC"]],
    transaction,
  });
  const latestClosure = await loadClosureSnapshot(latestClosureInstance, transaction);
  const initialBalances = new Map();
  const metadata = new Map();
  if (latestClosure) {
    for (const row of rowsFromClosure(latestClosure)) {
      initialBalances.set(row.modeloId, {
        CREDITEK: row.saldoFinalCreditek,
        PROVEEDOR: row.saldoFinalProveedor,
      });
      metadata.set(row.modeloId, row);
    }
  }

  const replayStart = latestClosure?.periodoFinExclusivo || null;
  const entries = await LogisticaMastherPhoneIngreso.findAll({
    where: {
      fechaIngreso: {
        ...(replayStart ? { [Op.gte]: ecuadorDayStart(replayStart) } : {}),
        [Op.lt]: ecuadorDayStart(periodEndExclusive),
      },
    },
    include: [modelInclude(false)],
    order: [["fechaIngreso", "ASC"], ["id", "ASC"]],
    transaction,
  });
  const adjustments = await LogisticaMastherPhoneAjuste.findAll({
    where: {
      fechaAjuste: {
        ...(replayStart ? { [Op.gte]: ecuadorDayStart(replayStart) } : {}),
        [Op.lt]: ecuadorDayStart(periodEndExclusive),
      },
    },
    include: [modelInclude(false)],
    order: [["fechaAjuste", "ASC"], ["id", "ASC"]],
    transaction,
  });

  const events = [];
  const trackedStart = new Map();
  for (const instance of entries) {
    const item = instance.get({ plain: true });
    metadata.set(Number(item.modeloId), modelMetadata(item.modelo));
    const timestamp = timestampValue(item.fechaIngreso);
    const trackedDayStart = ecuadorDayStart(toEcuadorDateOnly(item.fechaIngreso)).getTime();
    trackedStart.set(
      Number(item.modeloId),
      Math.min(
        trackedStart.get(Number(item.modeloId)) ?? trackedDayStart,
        trackedDayStart,
      ),
    );
    events.push({
      tipo: "INGRESO",
      id: Number(item.id),
      modeloId: Number(item.modeloId),
      origen: item.bodega,
      cantidad: Number(item.cantidad),
      fecha: toEcuadorDateOnly(item.fechaIngreso),
      timestamp,
    });
  }
  for (const instance of adjustments) {
    const item = instance.get({ plain: true });
    metadata.set(Number(item.modeloId), modelMetadata(item.modelo));
    const timestamp = timestampValue(item.fechaAjuste);
    const trackedDayStart = ecuadorDayStart(toEcuadorDateOnly(item.fechaAjuste)).getTime();
    trackedStart.set(
      Number(item.modeloId),
      Math.min(
        trackedStart.get(Number(item.modeloId)) ?? trackedDayStart,
        trackedDayStart,
      ),
    );
    events.push({
      tipo: "AJUSTE",
      id: Number(item.id),
      modeloId: Number(item.modeloId),
      origen: item.origen,
      cantidad: Number(item.cantidad),
      fecha: toEcuadorDateOnly(item.fechaAjuste),
      timestamp,
    });
  }
  for (const modelIdKey of initialBalances.keys()) {
    trackedStart.set(modelIdKey, ecuadorDayStart(replayStart).getTime());
  }

  const modelIds = Array.from(trackedStart.keys());
  if (modelIds.length) {
    const earliestTimestamp = Math.min(...trackedStart.values());
    const sales = await collectSalesOperations({
      modelIds,
      dateFrom: toEcuadorDateOnly(new Date(earliestTimestamp)),
      dateToExclusive: periodEndExclusive,
      transaction,
    });
    for (const sale of sales) {
      const timestamp = ecuadorDayStart(sale.fecha).getTime();
      if (timestamp < trackedStart.get(sale.modeloId)) continue;
      events.push({
        tipo: "VENTA",
        id: sale.ventaId,
        modeloId: sale.modeloId,
        cantidad: sale.cantidad,
        fecha: sale.fecha,
        timestamp,
      });
    }
  }

  const allRows = simulateInventory({
    initialBalances,
    events,
    periodStart: selectedStart,
    periodEndExclusive,
    metadata,
  }).sort((a, b) => (a.producto || "").localeCompare(b.producto || "", "es"));
  const rows = allRows.filter(
    (row) =>
      (!parsedModelId || row.modeloId === parsedModelId) &&
      (!parsedBrandId || row.marcaId === parsedBrandId),
  );
  const incidents = allRows.flatMap((row) =>
    row.incidencias.map((incident) => ({ ...incident, producto: row.producto })),
  );
  const ended = periodHasEnded(periodEndExclusive, now);
  const earliestPeriod = await findEarliestTrackedPeriod(transaction);
  let reason = null;
  if (!ended) reason = "La semana todavía no ha terminado.";
  else if (incidents.length) reason = "Existen incidencias de inventario pendientes.";
  else if (!allRows.length) reason = "No existen movimientos ni saldos para cerrar.";
  else if (latestClosure && latestClosure.periodoFinExclusivo !== selectedStart) {
    reason = `Primero debe cerrarse la semana que inicia ${latestClosure.periodoFinExclusivo}.`;
  } else if (!latestClosure && earliestPeriod && earliestPeriod !== selectedStart) {
    reason = `La inicialización debe comenzar cerrando la semana que inicia ${earliestPeriod}.`;
  }

  return {
    semanaInicio: selectedStart,
    semanaFin: periodEnd,
    periodoFinExclusivo: periodEndExclusive,
    estado: "ABIERTA",
    cierre: null,
    periodoTerminado: ended,
    puedeCerrar: !reason,
    motivoNoCierre: reason,
    filas: rows,
    incidencias: incidents,
    totales: totalsForRows(rows),
  };
};

const closeWeek = async ({ weekStart }, userId, { now = new Date() } = {}) => {
  const selectedStart = validateWeekStart(weekStart);
  const periodEndExclusive = addDays(selectedStart, 7);
  if (!periodHasEnded(periodEndExclusive, now)) {
    throw createError("Sólo se pueden cerrar períodos terminados.", 409, "PERIOD_NOT_FINISHED");
  }

  try {
    await sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
      async (transaction) => {
        const existing = await LogisticaMastherPhoneCierre.findOne({
          where: { periodoInicio: selectedStart },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (existing) {
          throw createError("La semana ya fue cerrada.", 409, "PERIOD_ALREADY_CLOSED");
        }
        const lastClosure = await LogisticaMastherPhoneCierre.findOne({
          order: [["periodoInicio", "DESC"]],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (lastClosure && lastClosure.periodoFinExclusivo !== selectedStart) {
          throw createError(
            `Los cierres deben ser consecutivos. Primero cierre ${lastClosure.periodoFinExclusivo}.`,
            409,
            "PREVIOUS_PERIOD_OPEN",
          );
        }
        if (!lastClosure) {
          const firstPeriod = await findEarliestTrackedPeriod(transaction);
          if (!firstPeriod) {
            throw createError("No existen movimientos para inicializar el control.", 409, "NO_INVENTORY_DATA");
          }
          if (firstPeriod !== selectedStart) {
            throw createError(
              `La inicialización debe comenzar por la semana ${firstPeriod}.`,
              409,
              "INITIAL_PERIOD_REQUIRED",
            );
          }
        }

        const report = await getReport({ weekStart: selectedStart }, { transaction, now });
        if (report.incidencias.length) {
          throw createError(
            "No se puede cerrar la semana mientras existan incidencias pendientes.",
            409,
            "PENDING_INCIDENTS",
          );
        }
        if (!report.filas.length) {
          throw createError("No existen saldos ni movimientos para cerrar.", 409, "NO_INVENTORY_DATA");
        }

        const closure = await LogisticaMastherPhoneCierre.create(
          {
            periodoInicio: selectedStart,
            periodoFinExclusivo: periodEndExclusive,
            cerradoPorId: userId || null,
            cerradoEn: now,
          },
          { transaction },
        );
        const details = [];
        for (const row of report.filas) {
          details.push(
            {
              cierreId: closure.id,
              modeloId: row.modeloId,
              origen: "CREDITEK",
              saldoInicial: row.stockInicialCreditek,
              ingresos: row.ingresosCreditek,
              salidas: row.ventasCreditek,
              ajustes: row.ajustesCreditek,
              saldoFinal: row.saldoFinalCreditek,
            },
            {
              cierreId: closure.id,
              modeloId: row.modeloId,
              origen: "PROVEEDOR",
              saldoInicial: row.stockInicialProveedor,
              ingresos: row.ingresosProveedor,
              salidas: row.ventasProveedor,
              ajustes: row.ajustesProveedor,
              saldoFinal: row.saldoFinalProveedor,
            },
          );
        }
        await LogisticaMastherPhoneCierreDetalle.bulkCreate(details, { transaction });
      },
    );
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw createError("La semana ya fue cerrada.", 409, "PERIOD_ALREADY_CLOSED");
    }
    throw error;
  }
  return getReport({ weekStart: selectedStart });
};

const saveReconciliation = async () => {
  throw createError(
    "La conciliación manual anterior fue reemplazada por ajustes auditados y cierres semanales.",
    410,
    "RECONCILIATION_RETIRED",
  );
};

module.exports = {
  addDays,
  calculateEntryAmounts,
  closeWeek,
  collectSalesOperations,
  deleteEntry,
  getCatalog,
  getReport,
  getWeekStart,
  listAdjustments,
  listEntries,
  parseAdjustmentDateTime,
  parseEntryDateTime,
  registerAdjustment,
  registerEntry,
  saveReconciliation,
  simulateInventory,
  updateEntry,
  validateWeekStart,
};
