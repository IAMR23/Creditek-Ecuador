const {
  CONTIFICO_API_URL,
  contificoAPI,
  getContificoApiKey,
} = require("../config/contifico");

const STOCK_COVERAGE_NOTE =
  "Contifico documenta que el desglose solo devuelve bodegas asociadas a un punto de venta. Una bodega ausente no se interpreta como stock cero.";

const DEFAULT_CATALOG_TTL_MS = 5 * 60 * 1000;
const DEFAULT_STOCK_TTL_MS = 2 * 60 * 1000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_CONCURRENCY = 4;
const MAX_PAGES = 100;
const MAX_BATCH_SIZE = 50;

class ContificoStockError extends Error {
  constructor(code, message, httpStatus = 502) {
    super(message);
    this.name = "ContificoStockError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

const parsePositiveInteger = (value, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
};

const parseContificoDecimal = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeString = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const requireIdentifier = (value, resourceName) => {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new ContificoStockError(
      "CONTIFICO_FORMAT_ERROR",
      `Contifico devolvio ${resourceName} sin identificador.`,
    );
  }
  return normalized;
};

const normalizeProduct = (product) => {
  const cantidadStock = parseContificoDecimal(product?.cantidad_stock);
  const minimo = parseContificoDecimal(product?.minimo);
  const tipo = normalizeString(product?.tipo);
  const estado = normalizeString(product?.estado);

  return {
    id: requireIdentifier(product?.id, "un producto"),
    codigo: normalizeString(product?.codigo),
    nombre: normalizeString(product?.nombre),
    tipo,
    tipoDescripcion:
      tipo === "PRO" ? "Producto fisico" : tipo === "SER" ? "Servicio" : "No informado",
    esServicio: tipo === "SER",
    estado,
    estadoDescripcion:
      estado === "A" ? "Activo" : estado === "I" ? "Inactivo" : "No informado",
    minimo,
    minimoValido: minimo !== null,
    cantidadStock,
    cantidadStockValida: cantidadStock !== null,
  };
};

const normalizeWarehouse = (warehouse) => ({
  id: requireIdentifier(warehouse?.id, "una bodega"),
  codigo: normalizeString(warehouse?.codigo),
  nombre: normalizeString(warehouse?.nombre),
  venta: typeof warehouse?.venta === "boolean" ? warehouse.venta : null,
  compra: typeof warehouse?.compra === "boolean" ? warehouse.compra : null,
  produccion:
    typeof warehouse?.produccion === "boolean" ? warehouse.produccion : null,
});

const normalizeWarehouseStock = (stock) => {
  const cantidad = parseContificoDecimal(stock?.cantidad);
  return {
    bodegaId: requireIdentifier(stock?.bodega_id, "un registro de stock"),
    bodegaNombre: normalizeString(stock?.bodega_nombre),
    cantidad,
    cantidadValida: cantidad !== null,
  };
};

const isRetryableError = (error) => {
  const status = error?.response?.status;
  if (status === 429 || status >= 500) return true;
  return (
    !status &&
    ["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND"].includes(
      error?.code,
    )
  );
};

const integrationErrorFrom = (error) => {
  if (error instanceof ContificoStockError) return error;

  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    return new ContificoStockError(
      "CONTIFICO_AUTH_ERROR",
      "Contifico rechazo las credenciales configuradas.",
      502,
    );
  }
  if (status === 429) {
    return new ContificoStockError(
      "CONTIFICO_RATE_LIMIT",
      "Contifico limito temporalmente las consultas. Intenta nuevamente en unos minutos.",
      503,
    );
  }
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return new ContificoStockError(
      "CONTIFICO_TIMEOUT",
      "Contifico no respondio dentro del tiempo esperado.",
      504,
    );
  }
  return new ContificoStockError(
    "CONTIFICO_UNAVAILABLE",
    "No fue posible consultar Contifico en este momento.",
    502,
  );
};

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isFresh = (entry, ttlMs, now) =>
  Boolean(entry && now() - entry.fetchedAtMs < ttlMs);

const validateProductId = (productId) => {
  const normalized = normalizeString(productId);
  if (!normalized || !/^[A-Za-z0-9_-]{1,64}$/.test(normalized)) {
    throw new ContificoStockError(
      "CONTIFICO_PRODUCT_ID_INVALID",
      "El identificador del producto no es valido.",
      400,
    );
  }
  return normalized;
};

const validateNextPage = (nextPage, baseUrl) => {
  try {
    const base = new URL(baseUrl);
    const next = new URL(nextPage, `${baseUrl.replace(/\/+$/, "")}/`);
    const basePath = base.pathname.replace(/\/+$/, "");
    const pathAllowed =
      next.pathname === basePath || next.pathname.startsWith(`${basePath}/`);
    if (next.origin !== base.origin || !pathAllowed) {
      throw new Error("Origen no permitido");
    }
    return next.toString();
  } catch {
    throw new ContificoStockError(
      "CONTIFICO_PAGINATION_INVALID",
      "Contifico devolvio un enlace de paginacion no valido.",
    );
  }
};

const extractCollectionPage = (body) => {
  if (Array.isArray(body)) {
    return { rows: body, next: null, paginated: false };
  }

  if (!body || typeof body !== "object") {
    throw new ContificoStockError(
      "CONTIFICO_FORMAT_ERROR",
      "Contifico devolvio una respuesta con formato inesperado.",
    );
  }

  const rows = Array.isArray(body.results)
    ? body.results
    : Array.isArray(body.data)
      ? body.data
      : null;
  if (!rows) {
    throw new ContificoStockError(
      "CONTIFICO_FORMAT_ERROR",
      "Contifico devolvio una coleccion con formato inesperado.",
    );
  }

  const next = body.next ?? body.links?.next ?? body.pagination?.next ?? null;
  if (next !== null && next !== "" && typeof next !== "string") {
    throw new ContificoStockError(
      "CONTIFICO_PAGINATION_INVALID",
      "Contifico devolvio paginacion con formato inesperado.",
    );
  }

  return { rows, next: next || null, paginated: true };
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
};

const createContificoStockService = ({
  client = contificoAPI,
  getApiKey = getContificoApiKey,
  baseUrl = CONTIFICO_API_URL,
  now = Date.now,
  sleep = wait,
  catalogTtlMs = parsePositiveInteger(
    process.env.CONTIFICO_CATALOG_CACHE_TTL_MS,
    DEFAULT_CATALOG_TTL_MS,
  ),
  stockTtlMs = parsePositiveInteger(
    process.env.CONTIFICO_STOCK_CACHE_TTL_MS,
    DEFAULT_STOCK_TTL_MS,
  ),
  maxRetries = Number.isInteger(Number(process.env.CONTIFICO_MAX_RETRIES))
    ? Math.min(3, Math.max(0, Number(process.env.CONTIFICO_MAX_RETRIES)))
    : DEFAULT_MAX_RETRIES,
  concurrency = parsePositiveInteger(
    process.env.CONTIFICO_STOCK_CONCURRENCY,
    DEFAULT_CONCURRENCY,
    8,
  ),
} = {}) => {
  let catalogCache = null;
  let catalogInFlight = null;
  const stockCache = new Map();
  const stockInFlight = new Map();

  const ensureCredentials = () => {
    if (!normalizeString(getApiKey())) {
      throw new ContificoStockError(
        "CONTIFICO_API_KEY_MISSING",
        "Falta configurar CONTIFICO_API_KEY en el backend.",
        503,
      );
    }
  };

  const requestGet = async (path) => {
    ensureCredentials();
    let attempt = 0;

    while (true) {
      try {
        return await client.get(path);
      } catch (error) {
        if (!isRetryableError(error) || attempt >= maxRetries) {
          throw integrationErrorFrom(error);
        }

        const retryAfterSeconds = Number(error?.response?.headers?.["retry-after"]);
        const retryDelay = Number.isFinite(retryAfterSeconds)
          ? Math.min(retryAfterSeconds * 1000, 2000)
          : Math.min(250 * 2 ** attempt, 2000);
        attempt += 1;
        await sleep(retryDelay);
      }
    }
  };

  const readCollection = async (initialPath) => {
    const rows = [];
    const visited = new Set();
    let nextPath = initialPath;
    let pages = 0;
    let paginationDetected = false;

    while (nextPath) {
      if (visited.has(nextPath) || pages >= MAX_PAGES) {
        throw new ContificoStockError(
          "CONTIFICO_PAGINATION_LIMIT",
          "La paginacion de Contifico no pudo completarse de forma segura.",
        );
      }
      visited.add(nextPath);

      const response = await requestGet(nextPath);
      const page = extractCollectionPage(response.data);
      rows.push(...page.rows);
      pages += 1;
      paginationDetected ||= page.paginated || Boolean(page.next);
      nextPath = page.next ? validateNextPage(page.next, baseUrl) : null;
    }

    return { rows, paginationDetected, pages };
  };

  const buildCatalogResponse = (entry, { source, stale = false, warning = null }) => ({
    productos: entry.products,
    bodegas: entry.warehouses,
    meta: {
      consultedAt: entry.consultedAt,
      servedAt: new Date(now()).toISOString(),
      source,
      stale,
      warning,
      pagination: entry.pagination,
      counts: entry.counts,
      stockCoverageNote: STOCK_COVERAGE_NOTE,
    },
  });

  const refreshCatalog = async () => {
    const [productCollection, warehouseCollection] = await Promise.all([
      readCollection("/producto/"),
      readCollection("/bodega/"),
    ]);

    const products = productCollection.rows.map(normalizeProduct);
    const warehouses = warehouseCollection.rows.map(normalizeWarehouse);
    const fetchedAtMs = now();
    const entry = {
      products,
      warehouses,
      fetchedAtMs,
      consultedAt: new Date(fetchedAtMs).toISOString(),
      pagination: {
        productos: {
          detected: productCollection.paginationDetected,
          pages: productCollection.pages,
        },
        bodegas: {
          detected: warehouseCollection.paginationDetected,
          pages: warehouseCollection.pages,
        },
      },
      counts: {
        total: products.length,
        productosFisicos: products.filter((product) => product.tipo === "PRO").length,
        servicios: products.filter((product) => product.tipo === "SER").length,
        tipoNoInformado: products.filter(
          (product) => !["PRO", "SER"].includes(product.tipo),
        ).length,
        bodegas: warehouses.length,
      },
    };
    catalogCache = entry;
    return buildCatalogResponse(entry, { source: "contifico" });
  };

  const getCatalog = async ({ forceRefresh = false } = {}) => {
    if (!forceRefresh && isFresh(catalogCache, catalogTtlMs, now)) {
      return buildCatalogResponse(catalogCache, { source: "cache" });
    }

    if (catalogInFlight) return catalogInFlight;

    catalogInFlight = (async () => {
      try {
        return await refreshCatalog();
      } catch (error) {
        const normalizedError = integrationErrorFrom(error);
        if (catalogCache) {
          return buildCatalogResponse(catalogCache, {
            source: "cache",
            stale: true,
            warning: `No se pudo actualizar el catalogo. ${normalizedError.message}`,
          });
        }
        throw normalizedError;
      } finally {
        catalogInFlight = null;
      }
    })();

    return catalogInFlight;
  };

  const buildProductStockResponse = ({
    entry,
    product,
    catalog,
    source,
    stale = false,
    warning = null,
  }) => {
    const warehouseCatalogIds = new Set(catalog.bodegas.map((warehouse) => warehouse.id));
    const stockRowsByWarehouse = entry.stocks.reduce((rowsByWarehouse, stock) => {
      const rows = rowsByWarehouse.get(stock.bodegaId) || [];
      rows.push(stock);
      rowsByWarehouse.set(stock.bodegaId, rows);
      return rowsByWarehouse;
    }, new Map());
    const warehouseIdCounts = entry.stocks.reduce((counts, stock) => {
      counts.set(stock.bodegaId, (counts.get(stock.bodegaId) || 0) + 1);
      return counts;
    }, new Map());
    const reportedWarehouseIds = new Set(warehouseIdCounts.keys());
    const missingWarehouses = catalog.bodegas
      .filter((warehouse) => !reportedWarehouseIds.has(warehouse.id))
      .map(({ id, codigo, nombre }) => ({ id, codigo, nombre }));
    const warehousesOutsideCatalog = Array.from(
      new Map(
        entry.stocks
          .filter((stock) => !warehouseCatalogIds.has(stock.bodegaId))
          .map(({ bodegaId, bodegaNombre }) => [
            bodegaId,
            { id: bodegaId, nombre: bodegaNombre },
          ]),
      ).values(),
    );
    const duplicateWarehouseIds = Array.from(warehouseIdCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, registros: count }));
    const allQuantitiesValid = entry.stocks.every((stock) => stock.cantidadValida);
    const warehouseSum = allQuantitiesValid && duplicateWarehouseIds.length === 0
      ? entry.stocks.reduce((total, stock) => total + stock.cantidad, 0)
      : null;
    const comparable = warehouseSum !== null && product.cantidadStockValida;
    const difference = comparable
      ? Number((warehouseSum - product.cantidadStock).toFixed(6))
      : null;
    const buildCombinedWarehouse = ({ warehouse, stockRows, inCatalog }) => {
      const uniqueStock = stockRows.length === 1 ? stockRows[0] : null;
      const duplicated = stockRows.length > 1;
      const reportedByStock = stockRows.length > 0;

      return {
        bodegaId: warehouse?.id || uniqueStock?.bodegaId || stockRows[0]?.bodegaId,
        bodegaCodigo: warehouse?.codigo || null,
        bodegaNombre:
          warehouse?.nombre || uniqueStock?.bodegaNombre || stockRows[0]?.bodegaNombre || null,
        cantidad: duplicated ? null : uniqueStock?.cantidad ?? null,
        cantidadValida: duplicated ? false : uniqueStock?.cantidadValida ?? false,
        reportadaEnStock: reportedByStock,
        incluidaEnCatalogo: inCatalog,
        registrosStock: stockRows.length,
        estadoCobertura: duplicated
          ? "REGISTROS_DUPLICADOS"
          : inCatalog && reportedByStock
            ? "CATALOGO_Y_STOCK"
            : inCatalog
              ? "SOLO_CATALOGO"
              : "SOLO_STOCK",
      };
    };
    const warehousesForProduct = [
      ...catalog.bodegas.map((warehouse) =>
        buildCombinedWarehouse({
          warehouse,
          stockRows: stockRowsByWarehouse.get(warehouse.id) || [],
          inCatalog: true,
        }),
      ),
      ...Array.from(stockRowsByWarehouse.entries())
        .filter(([warehouseId]) => !warehouseCatalogIds.has(warehouseId))
        .map(([, stockRows]) =>
          buildCombinedWarehouse({ warehouse: null, stockRows, inCatalog: false }),
        ),
    ];

    return {
      producto: product,
      existenciasPorBodega: entry.stocks,
      bodegasProducto: warehousesForProduct,
      comparacion: {
        cantidadStockProducto: product.cantidadStock,
        cantidadStockProductoValida: product.cantidadStockValida,
        sumaDesgloseBodegas: warehouseSum,
        sumaDesgloseValida: warehouseSum !== null,
        diferencia: difference,
        coincide: comparable ? Math.abs(difference) < 0.000001 : null,
      },
      cobertura: {
        bodegasCatalogo: catalog.bodegas.length,
        registrosReportados: entry.stocks.length,
        bodegasReportadas: reportedWarehouseIds.size,
        bodegasNoReportadas: missingWarehouses,
        bodegasFueraCatalogo: warehousesOutsideCatalog,
        bodegasConRegistrosDuplicados: duplicateWarehouseIds,
        note: STOCK_COVERAGE_NOTE,
      },
      meta: {
        consultedAt: entry.consultedAt,
        servedAt: new Date(now()).toISOString(),
        source,
        stale,
        warning,
        pagination: entry.pagination,
      },
    };
  };

  const getProductStock = async (productId, { forceRefresh = false } = {}) => {
    const normalizedId = validateProductId(productId);
    const catalog = await getCatalog();
    const product = catalog.productos.find((item) => item.id === normalizedId);
    if (!product) {
      throw new ContificoStockError(
        "CONTIFICO_PRODUCT_NOT_FOUND",
        "El producto no existe en el catalogo consultado.",
        404,
      );
    }

    const cached = stockCache.get(normalizedId);
    if (!forceRefresh && isFresh(cached, stockTtlMs, now)) {
      return buildProductStockResponse({
        entry: cached,
        product,
        catalog,
        source: "cache",
      });
    }

    if (stockInFlight.has(normalizedId)) return stockInFlight.get(normalizedId);

    const request = (async () => {
      try {
        const collection = await readCollection(
          `/producto/${encodeURIComponent(normalizedId)}/stock/`,
        );
        const fetchedAtMs = now();
        const entry = {
          stocks: collection.rows.map(normalizeWarehouseStock),
          fetchedAtMs,
          consultedAt: new Date(fetchedAtMs).toISOString(),
          pagination: {
            detected: collection.paginationDetected,
            pages: collection.pages,
          },
        };
        stockCache.set(normalizedId, entry);
        return buildProductStockResponse({
          entry,
          product,
          catalog,
          source: "contifico",
        });
      } catch (error) {
        const normalizedError = integrationErrorFrom(error);
        if (cached) {
          return buildProductStockResponse({
            entry: cached,
            product,
            catalog,
            source: "cache",
            stale: true,
            warning: `No se pudo actualizar el desglose. ${normalizedError.message}`,
          });
        }
        throw normalizedError;
      } finally {
        stockInFlight.delete(normalizedId);
      }
    })();

    stockInFlight.set(normalizedId, request);
    return request;
  };

  const getWarehouseStock = async (
    warehouseId,
    { offset = 0, limit = 20, forceRefresh = false } = {},
  ) => {
    const normalizedWarehouseId = normalizeString(warehouseId);
    if (!normalizedWarehouseId) {
      throw new ContificoStockError(
        "CONTIFICO_WAREHOUSE_ID_INVALID",
        "El identificador de la bodega no es valido.",
        400,
      );
    }

    const catalog = await getCatalog();
    let warehouse = catalog.bodegas.find((item) => item.id === normalizedWarehouseId);
    if (!warehouse) {
      for (const cachedStock of stockCache.values()) {
        const discovered = cachedStock.stocks.find(
          (item) => item.bodegaId === normalizedWarehouseId,
        );
        if (discovered) {
          warehouse = {
            id: discovered.bodegaId,
            codigo: null,
            nombre: discovered.bodegaNombre,
            venta: null,
            compra: null,
            produccion: null,
            descubiertaEnStock: true,
          };
          break;
        }
      }
    }
    if (!warehouse) {
      throw new ContificoStockError(
        "CONTIFICO_WAREHOUSE_NOT_FOUND",
        "La bodega no existe en el catalogo consultado.",
        404,
      );
    }

    const physicalProducts = catalog.productos.filter((product) => product.tipo === "PRO");
    const safeOffset = Math.max(0, Number.isInteger(offset) ? offset : 0);
    const safeLimit = Math.min(
      MAX_BATCH_SIZE,
      Math.max(1, Number.isInteger(limit) ? limit : 20),
    );
    const batch = physicalProducts.slice(safeOffset, safeOffset + safeLimit);

    const items = await mapWithConcurrency(batch, concurrency, async (product) => {
      try {
        const detail = await getProductStock(product.id, { forceRefresh });
        const warehouseRows = detail.existenciasPorBodega.filter(
          (item) => item.bodegaId === normalizedWarehouseId,
        );
        const warehouseStock = warehouseRows.length === 1 ? warehouseRows[0] : null;
        const stale = Boolean(detail.meta.stale);

        return {
          productoId: product.id,
          codigo: product.codigo,
          nombre: product.nombre,
          cantidad: warehouseStock?.cantidad ?? null,
          cantidadValida: warehouseStock?.cantidadValida ?? false,
          reportado: warehouseRows.length > 0,
          estadoConsulta: stale
            ? "CACHE_DESACTUALIZADA"
            : warehouseRows.length > 1
              ? "BODEGA_DUPLICADA"
            : warehouseStock
              ? warehouseStock.cantidadValida
                ? "REPORTADO"
                : "CANTIDAD_INVALIDA"
              : "NO_REPORTADO",
          stale,
          warning: detail.meta.warning,
          consultedAt: detail.meta.consultedAt,
        };
      } catch (error) {
        const normalizedError = integrationErrorFrom(error);
        return {
          productoId: product.id,
          codigo: product.codigo,
          nombre: product.nombre,
          cantidad: null,
          cantidadValida: false,
          reportado: false,
          estadoConsulta: "ERROR",
          stale: false,
          warning: normalizedError.message,
          consultedAt: null,
        };
      }
    });

    const failedUpdates = items.filter(
      (item) => item.estadoConsulta === "ERROR" || item.stale,
    ).length;
    const nextOffset = safeOffset + batch.length;

    return {
      bodega: warehouse,
      productos: items,
      progreso: {
        offset: safeOffset,
        procesados: batch.length,
        total: physicalProducts.length,
        siguienteOffset: nextOffset < physicalProducts.length ? nextOffset : null,
      },
      meta: {
        consultedAt:
          failedUpdates === 0 && batch.length > 0
            ? new Date(now()).toISOString()
            : null,
        failedUpdates,
        concurrency,
        batchLimit: safeLimit,
        stockCoverageNote: STOCK_COVERAGE_NOTE,
        omittedServices: catalog.meta.counts.servicios,
        omittedUnknownType: catalog.meta.counts.tipoNoInformado,
      },
    };
  };

  const getProductWarehouseCoverage = async ({
    offset = 0,
    limit = 20,
    forceRefresh = false,
  } = {}) => {
    const catalog = await getCatalog();
    const physicalProducts = catalog.productos.filter((product) => product.tipo === "PRO");
    const warehouseCatalog = new Map(
      catalog.bodegas.map((warehouse) => [warehouse.id, warehouse]),
    );
    const safeOffset = Math.max(0, Number.isInteger(offset) ? offset : 0);
    const safeLimit = Math.min(
      MAX_BATCH_SIZE,
      Math.max(1, Number.isInteger(limit) ? limit : 20),
    );
    const batch = physicalProducts.slice(safeOffset, safeOffset + safeLimit);

    const products = await mapWithConcurrency(batch, concurrency, async (product) => {
      try {
        const detail = await getProductStock(product.id, { forceRefresh });
        return {
          productoId: product.id,
          codigo: product.codigo,
          nombre: product.nombre,
          bodegasReportadas: detail.existenciasPorBodega.map((stock) => ({
            ...stock,
            bodegaCodigo: warehouseCatalog.get(stock.bodegaId)?.codigo || null,
            incluidaEnCatalogo: warehouseCatalog.has(stock.bodegaId),
          })),
          estadoConsulta: detail.meta.stale ? "CACHE_DESACTUALIZADA" : "COMPLETA",
          stale: Boolean(detail.meta.stale),
          warning: detail.meta.warning,
          consultedAt: detail.meta.consultedAt,
        };
      } catch (error) {
        const normalizedError = integrationErrorFrom(error);
        return {
          productoId: product.id,
          codigo: product.codigo,
          nombre: product.nombre,
          bodegasReportadas: [],
          estadoConsulta: "ERROR",
          stale: false,
          warning: normalizedError.message,
          consultedAt: null,
        };
      }
    });

    const discoveredWarehouses = Array.from(
      new Map(
        products.flatMap((product) =>
          product.bodegasReportadas.map((stock) => [
            stock.bodegaId,
            {
              id: stock.bodegaId,
              codigo: stock.bodegaCodigo,
              nombre: stock.bodegaNombre,
              incluidaEnCatalogo: stock.incluidaEnCatalogo,
            },
          ]),
        ),
      ).values(),
    );
    const failedUpdates = products.filter(
      (product) => product.estadoConsulta === "ERROR" || product.stale,
    ).length;
    const nextOffset = safeOffset + batch.length;

    return {
      productos: products,
      bodegasDescubiertas: discoveredWarehouses,
      progreso: {
        offset: safeOffset,
        procesados: batch.length,
        total: physicalProducts.length,
        siguienteOffset: nextOffset < physicalProducts.length ? nextOffset : null,
      },
      meta: {
        consultedAt:
          failedUpdates === 0 && batch.length > 0
            ? new Date(now()).toISOString()
            : null,
        failedUpdates,
        concurrency,
        batchLimit: safeLimit,
        stockCoverageNote: STOCK_COVERAGE_NOTE,
      },
    };
  };

  return {
    getCatalog,
    getProductStock,
    getProductWarehouseCoverage,
    getWarehouseStock,
  };
};

const contificoStockService = createContificoStockService();

module.exports = {
  MAX_BATCH_SIZE,
  STOCK_COVERAGE_NOTE,
  ContificoStockError,
  createContificoStockService,
  normalizeProduct,
  normalizeWarehouseStock,
  parseContificoDecimal,
  ...contificoStockService,
};
