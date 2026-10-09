const { Op, UniqueConstraintError } = require("sequelize");
const DetalleEntrega = require("../models/DetalleEntrega");
const DetalleVenta = require("../models/DetalleVenta");
const DispositivoMarca = require("../models/DispositivoMarca");
const Entrega = require("../models/Entrega");
const LogisticaMastherPhoneConciliacion = require("../models/LogisticaMastherPhoneConciliacion");
const LogisticaMastherPhoneIngreso = require("../models/LogisticaMastherPhoneIngreso");
const Marca = require("../models/Marca");
const Modelo = require("../models/Modelo");
const Venta = require("../models/Venta");

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
const WAREHOUSES = new Set(["CREDITEK", "PROVEEDOR"]);

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

const parseNonNegativeInteger = (value, name) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw createError(`${name} debe ser un número entero mayor o igual a cero.`);
  }
  return number;
};

const calculateEntryAmounts = (unitPriceValue, quantityValue) => {
  const unitPriceText = String(unitPriceValue ?? "").trim();
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
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

const getWeekStart = (dateOnly) => {
  const validDate = parseDateOnly(dateOnly);
  const [year, month, day] = validDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  return addDays(validDate, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));
};

const validateWeekStart = (value) => {
  const date = parseDateOnly(value, "La semana");
  if (getWeekStart(date) !== date) {
    throw createError("La semana debe iniciar un lunes.");
  }
  return date;
};

const eachWeek = (start, end) => {
  const weeks = [];
  for (let current = start; current <= end; current = addDays(current, 7)) {
    weeks.push(current);
  }
  return weeks;
};

const addQuantity = (map, key, quantity) => {
  map.set(key, (map.get(key) || 0) + Number(quantity || 0));
};

const operationKey = (modelId, weekStart) => `${modelId}:${weekStart}`;

const calculateControlRow = ({
  modelId,
  brand,
  model,
  accumulatedEntries,
  controlStartDate,
  selectedWeek,
  selectedStartWeek = selectedWeek,
  selectedEndWeek = selectedWeek,
  weeklySales,
  reconciliations,
  preControlSales,
  selectedSalesOverride,
  selectedPeriodIsWeekAligned = true,
  accumulationEndIsPartial = false,
  accumulatedByWarehouse = { CREDITEK: 0, PROVEEDOR: 0 },
}) => {
  const controlWeek = getWeekStart(controlStartDate);
  const weeks = eachWeek(controlWeek, selectedEndWeek);
  const pendingWeeks = [];
  let accumulatedMastherSales = 0;
  let selectedSales = 0;
  let selectedOwnStock = 0;
  let selectedPeriodPending = false;

  for (const week of weeks) {
    const totalSales = weeklySales.get(operationKey(modelId, week)) || 0;
    const isSelected = week >= selectedStartWeek && week <= selectedEndWeek;
    if (isSelected) selectedSales += totalSales;
    if (totalSales === 0) continue;

    const reconciliation = reconciliations.get(operationKey(modelId, week));
    const ownStock = reconciliation?.stockCreditek;
    const minimumOwnStock = week === controlWeek ? preControlSales : 0;
    const valid =
      Number.isInteger(ownStock) &&
      ownStock >= minimumOwnStock &&
      ownStock <= totalSales &&
      !(accumulationEndIsPartial && week === selectedEndWeek && ownStock > 0);

    if (!valid) {
      pendingWeeks.push(week);
      if (isSelected) selectedPeriodPending = true;
      continue;
    }
    accumulatedMastherSales += totalSales - ownStock;
    if (isSelected) selectedOwnStock += ownStock;
  }

  if (!selectedPeriodIsWeekAligned && selectedOwnStock > 0) {
    selectedPeriodPending = true;
  }
  if (selectedSalesOverride !== undefined && selectedOwnStock > selectedSalesOverride) {
    selectedPeriodPending = true;
  }

  const isSingleWeek = selectedStartWeek === selectedEndWeek;
  const selectedReconciliation = isSingleWeek
    ? reconciliations.get(operationKey(modelId, selectedStartWeek))
    : null;
  const selectedReconciliationValid = !selectedPeriodPending;

  return {
    modeloId: modelId,
    marca: brand,
    modelo: model,
    producto: `${brand} ${model}`.trim(),
    cantidad: accumulatedEntries,
    cantidadBodegaCreditek: accumulatedByWarehouse.CREDITEK || 0,
    cantidadBodegaProveedor: accumulatedByWarehouse.PROVEEDOR || 0,
    stockCreditek: isSingleWeek
      ? selectedReconciliation?.stockCreditek ?? null
      : selectedReconciliationValid
        ? selectedOwnStock
        : null,
    ventasTotalesSemana: selectedSalesOverride ?? selectedSales,
    mastherPhone: selectedReconciliationValid
      ? (selectedSalesOverride ?? selectedSales) - selectedOwnStock
      : null,
    totalBodega:
      pendingWeeks.length === 0
        ? accumulatedEntries - accumulatedMastherSales
        : null,
    pendienteConciliacion:
      !selectedReconciliationValid || pendingWeeks.length > 0,
    pendienteSemanaSeleccionada: !selectedReconciliationValid,
    semanasPendientes: pendingWeeks,
    fechaInicioControl: controlStartDate,
    ventasPreviasInicioControl:
      isSingleWeek && selectedStartWeek === controlWeek ? preControlSales : 0,
    conciliacionActualizadaAt: selectedReconciliation?.updatedAt || null,
  };
};

const catalogInclude = {
  model: DispositivoMarca,
  as: "dispositivoMarca",
  where: { activo: true },
  required: true,
  attributes: ["id", "marcaId"],
  include: [
    {
      model: Marca,
      as: "marca",
      where: { activo: true },
      required: true,
      attributes: ["id", "nombre"],
    },
  ],
};

const reportCatalogInclude = {
  model: DispositivoMarca,
  as: "dispositivoMarca",
  required: true,
  attributes: ["id", "marcaId"],
  include: [
    {
      model: Marca,
      as: "marca",
      required: true,
      attributes: ["id", "nombre"],
    },
  ],
};

const getCatalog = async () => {
  const models = await Modelo.findAll({
    where: { activo: true },
    attributes: ["id", "nombre", "dispositivoMarcaId"],
    include: [catalogInclude],
    order: [["nombre", "ASC"]],
  });

  const brands = new Map();
  const serializedModels = models.map((model) => {
    const item = model.get({ plain: true });
    const brand = item.dispositivoMarca.marca;
    brands.set(brand.id, brand);
    return {
      id: item.id,
      nombre: item.nombre,
      marcaId: brand.id,
      marca: brand.nombre,
    };
  });

  return {
    marcas: Array.from(brands.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    ),
    modelos: serializedModels,
  };
};

const getActiveModel = (modelId) =>
  Modelo.findOne({
    where: { id: modelId, activo: true },
    attributes: ["id", "nombre", "dispositivoMarcaId"],
    include: [catalogInclude],
  });

const serializeEntry = (entry) => {
  const item = entry.get ? entry.get({ plain: true }) : entry;
  return {
    id: item.id,
    modeloId: item.modeloId,
    cantidad: item.cantidad,
    precioUnitario:
      item.precioUnitario === null || item.precioUnitario === undefined
        ? null
        : Number(item.precioUnitario),
    subtotal:
      item.subtotal === null || item.subtotal === undefined
        ? null
        : Number(item.subtotal),
    iva: item.iva === null || item.iva === undefined ? null : Number(item.iva),
    total:
      item.total === null || item.total === undefined ? null : Number(item.total),
    fechaIngreso: item.fechaIngreso,
    bodega: item.bodega,
    registradoPorId: item.registradoPorId,
    actualizadoPorId: item.actualizadoPorId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const registerEntry = async (payload, userId) => {
  const modelId = parsePositiveInteger(payload.modeloId, "modeloId");
  const quantity = parsePositiveInteger(payload.cantidad, "La cantidad");
  const amounts = calculateEntryAmounts(payload.precioUnitario, quantity);
  const entryDate = parseDateOnly(payload.fechaIngreso, "La fecha de ingreso");
  const warehouse = String(payload.bodega || "").trim().toUpperCase();
  if (!WAREHOUSES.has(warehouse)) {
    throw createError("Selecciona una bodega válida.");
  }
  const requestKey = String(payload.requestKey || "").trim();
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    throw createError("La clave de la solicitud no es válida.");
  }

  const model = await getActiveModel(modelId);
  if (!model) {
    throw createError("El modelo no existe o está inactivo.");
  }

  const existing = await LogisticaMastherPhoneIngreso.findOne({
    where: { requestKey },
  });
  if (existing) {
    if (
      existing.modeloId !== modelId ||
      existing.cantidad !== quantity ||
      existing.fechaIngreso !== entryDate ||
      existing.bodega !== warehouse ||
      Number(existing.precioUnitario) !== Number(amounts.precioUnitario)
    ) {
      throw createError(
        "La clave de la solicitud ya fue utilizada con otros datos.",
        409,
        "REQUEST_KEY_CONFLICT",
      );
    }
    return { ingreso: serializeEntry(existing), duplicado: true };
  }

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
    const concurrent = await LogisticaMastherPhoneIngreso.findOne({
      where: { requestKey },
    });
    if (
      concurrent &&
      concurrent.modeloId === modelId &&
      concurrent.cantidad === quantity &&
      concurrent.fechaIngreso === entryDate &&
      concurrent.bodega === warehouse &&
      Number(concurrent.precioUnitario) === Number(amounts.precioUnitario)
    ) {
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
  if (start > end) {
    throw createError("La fecha inicial no puede ser posterior a la fecha final.");
  }
  const parsedBrandId = brandId ? parsePositiveInteger(brandId, "marcaId") : null;
  const parsedModelId = modelId ? parsePositiveInteger(modelId, "modeloId") : null;
  const entries = await LogisticaMastherPhoneIngreso.findAll({
    where: {
      fechaIngreso: { [Op.between]: [start, end] },
      ...(parsedModelId ? { modeloId: parsedModelId } : {}),
    },
    attributes: [
      "id",
      "modeloId",
      "cantidad",
      "precioUnitario",
      "subtotal",
      "iva",
      "total",
      "fechaIngreso",
      "bodega",
      "registradoPorId",
      "actualizadoPorId",
      "createdAt",
      "updatedAt",
    ],
    include: [
      {
        model: Modelo,
        as: "modelo",
        required: true,
        attributes: ["id", "nombre", "dispositivoMarcaId"],
        include: [reportCatalogInclude],
      },
    ],
    order: [["fechaIngreso", "DESC"], ["id", "DESC"]],
  });

  return entries
    .map((instance) => instance.get({ plain: true }))
    .filter(
      (entry) =>
        !parsedBrandId ||
        Number(entry.modelo.dispositivoMarca.marca.id) === parsedBrandId,
    )
    .map((entry) => ({
      ...serializeEntry(entry),
      marcaId: Number(entry.modelo.dispositivoMarca.marca.id),
      marca: entry.modelo.dispositivoMarca.marca.nombre,
      modelo: entry.modelo.nombre,
      producto: `${entry.modelo.dispositivoMarca.marca.nombre} ${entry.modelo.nombre}`.trim(),
    }));
};

const updateEntry = async (entryId, payload, userId) => {
  const parsedEntryId = parsePositiveInteger(entryId, "ingresoId");
  const modelId = parsePositiveInteger(payload.modeloId, "modeloId");
  const quantity = parsePositiveInteger(payload.cantidad, "La cantidad");
  const amounts = calculateEntryAmounts(payload.precioUnitario, quantity);
  const entryDate = parseDateOnly(payload.fechaIngreso, "La fecha de ingreso");
  const warehouse = String(payload.bodega || "").trim().toUpperCase();
  if (!WAREHOUSES.has(warehouse)) {
    throw createError("Selecciona una bodega válida.");
  }

  const [entry, model] = await Promise.all([
    LogisticaMastherPhoneIngreso.findByPk(parsedEntryId),
    getActiveModel(modelId),
  ]);
  if (!entry) {
    throw createError("El ingreso no existe.", 404, "ENTRY_NOT_FOUND");
  }
  if (!model) {
    throw createError("El modelo no existe o está inactivo.");
  }

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

const collectSalesOperations = async ({ modelIds, dateFrom, dateTo }) => {
  if (!modelIds.length) return [];

  const completedDeliveries = await Entrega.findAll({
    where: {
      activo: true,
      estado: "Entregado",
      fecha: { [Op.between]: [dateFrom, dateTo] },
    },
    attributes: ["id", "ventaId", "fecha", "clienteId", "usuarioAgenciaId"],
    include: [
      {
        model: DetalleEntrega,
        as: "detalleEntregas",
        where: { modeloId: { [Op.in]: modelIds } },
        required: true,
        attributes: ["modeloId", "cantidad"],
      },
    ],
  });

  const saleWhere = {
    activo: true,
    fecha: { [Op.between]: [dateFrom, dateTo] },
  };

  const activeSales = await Venta.findAll({
    where: saleWhere,
    attributes: ["id", "fecha", "clienteId", "usuarioAgenciaId"],
    include: [
      {
        model: DetalleVenta,
        as: "detalleVenta",
        where: { modeloId: { [Op.in]: modelIds } },
        required: true,
        attributes: ["modeloId", "cantidad"],
      },
    ],
  });

  const operations = [];
  const activeSaleIds = new Set(activeSales.map((sale) => Number(sale.id)));
  const legacySaleMatches = new Map();
  for (const sale of activeSales) {
    for (const detail of sale.detalleVenta || []) {
      const key = `${sale.clienteId}:${sale.usuarioAgenciaId}:${detail.modeloId}`;
      const dates = legacySaleMatches.get(key) || [];
      dates.push(sale.fecha);
      legacySaleMatches.set(key, dates);
    }
  }
  const daysBetween = (first, second) => {
    const firstTime = Date.parse(`${first}T00:00:00Z`);
    const secondTime = Date.parse(`${second}T00:00:00Z`);
    return Math.abs(firstTime - secondTime) / 86400000;
  };
  for (const delivery of completedDeliveries) {
    const linkedSaleId = Number(delivery.ventaId);
    if (Number.isSafeInteger(linkedSaleId) && activeSaleIds.has(linkedSaleId)) {
      continue;
    }
    for (const detail of delivery.detalleEntregas || []) {
      const legacyKey = `${delivery.clienteId}:${delivery.usuarioAgenciaId}:${detail.modeloId}`;
      const isLegacyDuplicate =
        !delivery.ventaId &&
        (legacySaleMatches.get(legacyKey) || []).some(
          (saleDate) => daysBetween(delivery.fecha, saleDate) <= 1,
        );
      if (isLegacyDuplicate) continue;
      operations.push({
        modeloId: Number(detail.modeloId),
        fecha: delivery.fecha,
        cantidad: Number(detail.cantidad),
      });
    }
  }
  for (const sale of activeSales) {
    for (const detail of sale.detalleVenta || []) {
      operations.push({
        modeloId: Number(detail.modeloId),
        fecha: sale.fecha,
        cantidad: Number(detail.cantidad),
      });
    }
  }
  return operations;
};

const getReport = async ({ weekStart, dateFrom, dateTo, brandId, modelId }) => {
  let requestedStart;
  let requestedEnd;
  if (dateFrom || dateTo) {
    requestedStart = parseDateOnly(dateFrom, "La fecha inicial");
    requestedEnd = parseDateOnly(dateTo, "La fecha final");
    if (requestedStart > requestedEnd) {
      throw createError("La fecha inicial no puede ser posterior a la fecha final.");
    }
  } else {
    requestedStart = validateWeekStart(weekStart);
    requestedEnd = addDays(requestedStart, 6);
  }
  const selectedStartWeek = getWeekStart(requestedStart);
  const selectedEndWeek = getWeekStart(requestedEnd);
  const periodEnd = addDays(selectedEndWeek, 6);
  const reportMetadata = {
    fechaInicioSolicitada: requestedStart,
    fechaFinSolicitada: requestedEnd,
    semanaInicio: selectedStartWeek,
    semanaFin: periodEnd,
    esSemanaUnica:
      selectedStartWeek === selectedEndWeek &&
      requestedStart === selectedStartWeek &&
      requestedEnd === periodEnd,
  };
  const parsedBrandId = brandId ? parsePositiveInteger(brandId, "marcaId") : null;
  const parsedModelId = modelId ? parsePositiveInteger(modelId, "modeloId") : null;

  const entries = await LogisticaMastherPhoneIngreso.findAll({
    where: {
      fechaIngreso: { [Op.lte]: requestedEnd },
      ...(parsedModelId ? { modeloId: parsedModelId } : {}),
    },
    attributes: ["modeloId", "cantidad", "fechaIngreso", "bodega"],
    include: [
      {
        model: Modelo,
        as: "modelo",
        attributes: ["id", "nombre", "dispositivoMarcaId"],
        required: true,
        include: [reportCatalogInclude],
      },
    ],
    order: [["fechaIngreso", "ASC"], ["id", "ASC"]],
  });

  const controlled = new Map();
  for (const entryInstance of entries) {
    const entry = entryInstance.get({ plain: true });
    const brand = entry.modelo.dispositivoMarca.marca;
    if (parsedBrandId && Number(brand.id) !== parsedBrandId) continue;
    const current = controlled.get(entry.modeloId) || {
      modelId: Number(entry.modeloId),
      brand: brand.nombre,
      model: entry.modelo.nombre,
      brandId: Number(brand.id),
      accumulatedEntries: 0,
      accumulatedByWarehouse: { CREDITEK: 0, PROVEEDOR: 0 },
      controlStartDate: entry.fechaIngreso,
    };
    current.accumulatedByWarehouse[entry.bodega] += Number(entry.cantidad);
    current.accumulatedEntries = current.accumulatedByWarehouse.PROVEEDOR;
    if (entry.fechaIngreso < current.controlStartDate) {
      current.controlStartDate = entry.fechaIngreso;
    }
    controlled.set(entry.modeloId, current);
  }

  const controlledItems = Array.from(controlled.values());
  if (!controlledItems.length) {
    return {
      ...reportMetadata,
      filas: [],
      totales: {
        cantidad: 0,
        stockCreditek: 0,
        ventasTotalesSemana: 0,
        mastherPhone: 0,
        totalBodega: 0,
        pendienteConciliacion: false,
      },
    };
  }

  const modelIds = controlledItems.map((item) => item.modelId);
  const operations = await collectSalesOperations({
    modelIds,
    dateFrom: requestedStart,
    dateTo: requestedEnd,
  });
  const selectedPeriodSales = new Map();
  for (const operation of operations) {
    addQuantity(selectedPeriodSales, operation.modeloId, operation.cantidad);
  }

  const rows = controlledItems
    .map((item) => {
      const totalSales = selectedPeriodSales.get(item.modelId) || 0;
      const ownStock = item.accumulatedByWarehouse.CREDITEK || 0;
      const mastherSales = Math.max(totalSales - ownStock, 0);
      return {
        modeloId: item.modelId,
        marca: item.brand,
        modelo: item.model,
        producto: `${item.brand} ${item.model}`.trim(),
        cantidad: item.accumulatedByWarehouse.PROVEEDOR || 0,
        cantidadBodegaCreditek: ownStock,
        cantidadBodegaProveedor:
          item.accumulatedByWarehouse.PROVEEDOR || 0,
        stockCreditek: ownStock,
        ventasTotalesSemana: totalSales,
        mastherPhone: mastherSales,
        totalBodega:
          (item.accumulatedByWarehouse.PROVEEDOR || 0) - mastherSales,
        pendienteConciliacion: false,
        pendienteSemanaSeleccionada: false,
        semanasPendientes: [],
        fechaInicioControl: item.controlStartDate,
        ventasPreviasInicioControl: 0,
        conciliacionActualizadaAt: null,
      };
    })
    .sort((a, b) => a.producto.localeCompare(b.producto, "es"));

  return {
    ...reportMetadata,
    filas: rows,
    totales: {
      cantidad: rows.reduce((sum, row) => sum + row.cantidad, 0),
      stockCreditek: rows.reduce(
        (sum, row) => sum + (row.stockCreditek || 0),
        0,
      ),
      ventasTotalesSemana: rows.reduce(
        (sum, row) => sum + row.ventasTotalesSemana,
        0,
      ),
      mastherPhone: rows.reduce((sum, row) => sum + row.mastherPhone, 0),
      totalBodega: rows.reduce((sum, row) => sum + row.totalBodega, 0),
      pendienteConciliacion: false,
    },
  };
};

const saveReconciliation = async ({ modelId, weekStart, stockCreditek }, userId) => {
  const parsedModelId = parsePositiveInteger(modelId, "modeloId");
  const selectedWeek = validateWeekStart(weekStart);
  const parsedOwnStock = parseNonNegativeInteger(
    stockCreditek,
    "STOCK CREDITEK",
  );
  const report = await getReport({
    weekStart: selectedWeek,
    modelId: parsedModelId,
  });
  const row = report.filas[0];
  if (!row) {
    throw createError(
      "El modelo no tiene ingresos de Masther Phone hasta esa semana.",
      404,
      "CONTROL_NOT_FOUND",
    );
  }
  if (parsedOwnStock > row.ventasTotalesSemana) {
    throw createError(
      "STOCK CREDITEK no puede superar las ventas totales de la semana.",
    );
  }
  if (parsedOwnStock < row.ventasPreviasInicioControl) {
    throw createError(
      `STOCK CREDITEK debe cubrir al menos ${row.ventasPreviasInicioControl} venta(s) anterior(es) al inicio del control.`,
    );
  }

  const [reconciliation, created] =
    await LogisticaMastherPhoneConciliacion.findOrCreate({
      where: { modeloId: parsedModelId, semanaInicio: selectedWeek },
      defaults: {
        stockCreditek: parsedOwnStock,
        actualizadoPorId: userId || null,
      },
    });
  if (!created) {
    await reconciliation.update({
      stockCreditek: parsedOwnStock,
      actualizadoPorId: userId || null,
    });
  }

  return getReport({ weekStart: selectedWeek, modelId: parsedModelId });
};

module.exports = {
  addDays,
  calculateEntryAmounts,
  calculateControlRow,
  collectSalesOperations,
  getCatalog,
  getReport,
  getWeekStart,
  listEntries,
  registerEntry,
  saveReconciliation,
  updateEntry,
  validateWeekStart,
};
