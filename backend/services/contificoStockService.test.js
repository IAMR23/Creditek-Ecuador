const {
  createContificoStockService,
  parseContificoDecimal,
} = require("./contificoStockService");

const product = (overrides = {}) => ({
  id: "PROD000000000001",
  codigo: "P-001",
  nombre: "Producto de prueba",
  tipo: "PRO",
  estado: "A",
  minimo: "1.50",
  cantidad_stock: "10.25",
  ...overrides,
});

const warehouse = (overrides = {}) => ({
  id: "BOD0000000000001",
  codigo: "B-01",
  nombre: "Bodega principal",
  venta: true,
  compra: true,
  produccion: false,
  ...overrides,
});

const createClient = (handler) => ({ get: jest.fn(handler) });

const createPersistentStore = () => {
  const entries = new Map();
  return {
    entries,
    read: jest.fn(async (cacheKey) => entries.get(cacheKey) || null),
    write: jest.fn(async ({ cacheKey, type, value, fetchedAtMs }) => {
      entries.set(cacheKey, {
        type,
        value: JSON.parse(JSON.stringify(value)),
        fetchedAtMs,
        consultedAt: new Date(fetchedAtMs).toISOString(),
      });
    }),
  };
};

describe("contificoStockService", () => {
  test.each([
    ["12.345600", 12.3456],
    ["0", 0],
    ["-2.75", -2.75],
    [3.125, 3.125],
    [null, null],
    [undefined, null],
    ["", null],
    ["no-es-numero", null],
  ])("convierte cantidades sin sustituir datos invalidos (%p)", (input, expected) => {
    expect(parseContificoDecimal(input)).toBe(expected);
  });

  test("rechaza la consulta cuando falta la credencial", async () => {
    const client = createClient();
    const service = createContificoStockService({
      client,
      getApiKey: () => "",
      maxRetries: 0,
    });

    await expect(service.getCatalog()).rejects.toMatchObject({
      code: "CONTIFICO_API_KEY_MISSING",
      httpStatus: 503,
    });
    expect(client.get).not.toHaveBeenCalled();
  });

  test("conserva cero y negativos y separa servicios de productos fisicos", async () => {
    const client = createClient(async (path) => {
      if (path === "/producto/") {
        return {
          data: [
            product({ cantidad_stock: "0" }),
            product({
              id: "PROD000000000002",
              codigo: "P-002",
              cantidad_stock: "-4.125",
            }),
            product({
              id: "SERV000000000001",
              codigo: "S-001",
              tipo: "SER",
              cantidad_stock: null,
            }),
          ],
        };
      }
      if (path === "/bodega/") return { data: [warehouse()] };
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      maxRetries: 0,
    });

    const result = await service.getCatalog();

    expect(result.productos.map((item) => item.cantidadStock)).toEqual([
      0,
      -4.125,
      null,
    ]);
    expect(result.meta.counts).toMatchObject({
      productosFisicos: 2,
      servicios: 1,
    });
  });

  test("sigue enlaces de paginacion devueltos por Contifico", async () => {
    const nextUrl = "https://api.contifico.com/sistema/api/v1/producto/?page=2";
    const client = createClient(async (path) => {
      if (path === "/producto/") {
        return { data: { results: [product()], next: nextUrl } };
      }
      if (path === nextUrl) {
        return {
          data: {
            results: [product({ id: "PROD000000000002", codigo: "P-002" })],
            next: null,
          },
        };
      }
      if (path === "/bodega/") return { data: [warehouse()] };
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      maxRetries: 0,
    });

    const result = await service.getCatalog();

    expect(result.productos).toHaveLength(2);
    expect(result.meta.pagination.productos).toEqual({ detected: true, pages: 2 });
    expect(client.get).toHaveBeenCalledWith(nextUrl);
  });

  test("una bodega ausente en el desglose no se convierte en stock cero", async () => {
    const secondWarehouse = warehouse({
      id: "BOD0000000000002",
      codigo: "B-02",
      nombre: "Bodega secundaria",
    });
    const client = createClient(async (path) => {
      if (path === "/producto/") return { data: [product()] };
      if (path === "/bodega/") return { data: [warehouse(), secondWarehouse] };
      if (path.includes("/stock/")) {
        return {
          data: [
            {
              bodega_id: warehouse().id,
              bodega_nombre: warehouse().nombre,
              cantidad: "-1.75",
            },
          ],
        };
      }
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      maxRetries: 0,
    });

    const detail = await service.getProductStock(product().id);
    const warehouseResult = await service.getWarehouseStock(secondWarehouse.id);

    expect(detail.existenciasPorBodega[0].cantidad).toBe(-1.75);
    expect(detail.comparacion).toMatchObject({
      cantidadStockProducto: 10.25,
      sumaDesgloseBodegas: -1.75,
      diferencia: -12,
      coincide: false,
    });
    expect(detail.cobertura.bodegasNoReportadas).toEqual([
      expect.objectContaining({ id: secondWarehouse.id }),
    ]);
    expect(detail.bodegasProducto).toEqual([
      expect.objectContaining({
        bodegaId: warehouse().id,
        cantidad: -1.75,
        reportadaEnStock: true,
        incluidaEnCatalogo: true,
        estadoCobertura: "CATALOGO_Y_STOCK",
      }),
      expect.objectContaining({
        bodegaId: secondWarehouse.id,
        cantidad: null,
        cantidadValida: false,
        reportadaEnStock: false,
        incluidaEnCatalogo: true,
        estadoCobertura: "SOLO_CATALOGO",
      }),
    ]);
    expect(warehouseResult.productos[0]).toMatchObject({
      cantidad: null,
      cantidadValida: false,
      reportado: false,
      estadoConsulta: "NO_REPORTADO",
    });
  });

  test("incluye bodegas reportadas por stock aunque no aparezcan en el catalogo", async () => {
    const stockOnlyWarehouse = {
      bodega_id: "BODSTOCKONLY001",
      bodega_nombre: "Bodega solo stock",
      cantidad: "2.50",
    };
    const client = createClient(async (path) => {
      if (path === "/producto/") return { data: [product()] };
      if (path === "/bodega/") return { data: [warehouse()] };
      if (path.includes("/stock/")) return { data: [stockOnlyWarehouse] };
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      maxRetries: 0,
    });

    const coverage = await service.getProductWarehouseCoverage();
    const detail = await service.getProductStock(product().id);
    const stockOnlySelection = await service.getWarehouseStock(
      stockOnlyWarehouse.bodega_id,
    );

    expect(detail.bodegasProducto).toEqual([
      expect.objectContaining({
        bodegaId: warehouse().id,
        reportadaEnStock: false,
        incluidaEnCatalogo: true,
        estadoCobertura: "SOLO_CATALOGO",
      }),
      expect.objectContaining({
        bodegaId: stockOnlyWarehouse.bodega_id,
        bodegaNombre: stockOnlyWarehouse.bodega_nombre,
        cantidad: 2.5,
        reportadaEnStock: true,
        incluidaEnCatalogo: false,
        estadoCobertura: "SOLO_STOCK",
      }),
    ]);
    expect(coverage.productos[0]).toMatchObject({
      productoId: product().id,
      estadoConsulta: "COMPLETA",
      bodegasReportadas: [
        expect.objectContaining({
          bodegaId: stockOnlyWarehouse.bodega_id,
          cantidad: 2.5,
          incluidaEnCatalogo: false,
        }),
      ],
    });
    expect(coverage.bodegasDescubiertas).toEqual([
      expect.objectContaining({
        id: stockOnlyWarehouse.bodega_id,
        incluidaEnCatalogo: false,
      }),
    ]);
    expect(stockOnlySelection).toMatchObject({
      bodega: {
        id: stockOnlyWarehouse.bodega_id,
        nombre: stockOnlyWarehouse.bodega_nombre,
        descubiertaEnStock: true,
      },
      productos: [
        expect.objectContaining({
          productoId: product().id,
          cantidad: 2.5,
          estadoConsulta: "REPORTADO",
        }),
      ],
    });
  });

  test("mantiene el ultimo catalogo valido cuando falla una actualizacion", async () => {
    let fail = false;
    let currentTime = 1_000;
    const client = createClient(async (path) => {
      if (fail) {
        const error = new Error("fallo remoto");
        error.response = { status: 500 };
        throw error;
      }
      if (path === "/producto/") return { data: [product()] };
      if (path === "/bodega/") return { data: [warehouse()] };
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      now: () => currentTime,
      sleep: async () => {},
      catalogTtlMs: 1,
      maxRetries: 0,
    });

    const first = await service.getCatalog();
    fail = true;
    currentTime += 10;
    const stale = await service.getCatalog({ forceRefresh: true });

    expect(first.productos[0].cantidadStock).toBe(10.25);
    expect(stale.productos[0].cantidadStock).toBe(10.25);
    expect(stale.meta).toMatchObject({ source: "cache", stale: true });
    expect(stale.meta.warning).toContain("No se pudo actualizar");
  });

  test("mantiene el ultimo desglose valido si falla su actualizacion", async () => {
    let failDetail = false;
    const client = createClient(async (path) => {
      if (path === "/producto/") return { data: [product()] };
      if (path === "/bodega/") return { data: [warehouse()] };
      if (path.includes("/stock/") && !failDetail) {
        return {
          data: [
            {
              bodega_id: warehouse().id,
              bodega_nombre: warehouse().nombre,
              cantidad: "-3.5",
            },
          ],
        };
      }
      const error = new Error("fallo remoto");
      error.response = { status: 500 };
      throw error;
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      sleep: async () => {},
      maxRetries: 0,
    });

    const first = await service.getProductStock(product().id);
    failDetail = true;
    const stale = await service.getProductStock(product().id, { forceRefresh: true });

    expect(first.existenciasPorBodega[0].cantidad).toBe(-3.5);
    expect(stale.existenciasPorBodega[0].cantidad).toBe(-3.5);
    expect(stale.meta).toMatchObject({ source: "cache", stale: true });
  });

  test("recupera catalogo y stock desde persistencia despues de reiniciar el servicio", async () => {
    const persistentCacheStore = createPersistentStore();
    const firstClient = createClient(async (path) => {
      if (path === "/producto/") return { data: [product()] };
      if (path === "/bodega/") return { data: [warehouse()] };
      if (path.includes("/stock/")) {
        return {
          data: [
            {
              bodega_id: warehouse().id,
              bodega_nombre: warehouse().nombre,
              cantidad: "7.5",
            },
          ],
        };
      }
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const commonOptions = {
      getApiKey: () => "clave-prueba",
      now: () => 1_000,
      maxRetries: 0,
      persistentCacheStore,
    };
    const firstService = createContificoStockService({
      ...commonOptions,
      client: firstClient,
    });

    await firstService.getCatalog();
    await firstService.getProductStock(product().id);

    expect(persistentCacheStore.entries.has("catalogo")).toBe(true);
    expect(persistentCacheStore.entries.has(`producto:${product().id}`)).toBe(true);

    const restartedClient = createClient(async () => {
      throw new Error("No debe consultar Contifico con una entrada persistida vigente");
    });
    const restartedService = createContificoStockService({
      ...commonOptions,
      client: restartedClient,
    });

    const catalog = await restartedService.getCatalog();
    const detail = await restartedService.getProductStock(product().id);

    expect(catalog.meta).toMatchObject({ source: "persistencia", stale: false });
    expect(detail.meta).toMatchObject({ source: "persistencia", stale: false });
    expect(detail.existenciasPorBodega[0].cantidad).toBe(7.5);
    expect(restartedClient.get).not.toHaveBeenCalled();
  });

  test("responde de inmediato con persistencia vencida mientras actualiza en segundo plano", async () => {
    const persistentCacheStore = createPersistentStore();
    persistentCacheStore.entries.set("catalogo", {
      type: "CATALOGO",
      value: {
        products: [
          {
            ...product(),
            cantidadStock: 10.25,
            cantidadStockValida: true,
            estadoDescripcion: "Activo",
            tipoDescripcion: "Producto",
          },
        ],
        warehouses: [warehouse()],
        pagination: {
          productos: { detected: false, pages: 1 },
          bodegas: { detected: false, pages: 1 },
        },
        counts: {
          total: 1,
          productosFisicos: 1,
          servicios: 0,
          tipoNoInformado: 0,
          bodegas: 1,
        },
      },
      fetchedAtMs: 1_000,
      consultedAt: new Date(1_000).toISOString(),
    });
    persistentCacheStore.entries.set(`producto:${product().id}`, {
      type: "STOCK_PRODUCTO",
      value: {
        stocks: [
          {
            bodegaId: warehouse().id,
            bodegaNombre: warehouse().nombre,
            cantidad: 4,
            cantidadValida: true,
          },
        ],
        pagination: { detected: false, pages: 1 },
      },
      fetchedAtMs: 1_000,
      consultedAt: new Date(1_000).toISOString(),
    });

    let releaseRemote;
    const remoteGate = new Promise((resolve) => {
      releaseRemote = resolve;
    });
    const client = createClient(async (path) => {
      await remoteGate;
      if (path === "/producto/") return { data: [product()] };
      if (path === "/bodega/") return { data: [warehouse()] };
      if (path.includes("/stock/")) return { data: [] };
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      now: () => 2_000,
      catalogTtlMs: 1,
      stockTtlMs: 1,
      maxRetries: 0,
      persistentCacheStore,
    });

    const first = await service.getProductStock(product().id);
    const secondResult = await Promise.race([
      service.getProductStock(product().id),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 100)),
    ]);

    expect(first.meta).toMatchObject({ source: "persistencia", stale: true });
    expect(secondResult).not.toBe("timeout");
    expect(secondResult.meta).toMatchObject({ source: "persistencia", stale: true });
    expect(client.get).toHaveBeenCalled();

    releaseRemote();
    await new Promise((resolve) => setImmediate(resolve));
  });

  test("limita la concurrencia de actualizaciones persistidas en segundo plano", async () => {
    const persistentCacheStore = createPersistentStore();
    const products = Array.from({ length: 5 }, (_, index) => ({
      ...product({
        id: `PROD${String(index + 1).padStart(12, "0")}`,
        codigo: `P-${index + 1}`,
      }),
      cantidadStock: 10.25,
      cantidadStockValida: true,
      estadoDescripcion: "Activo",
      tipoDescripcion: "Producto",
    }));
    persistentCacheStore.entries.set("catalogo", {
      type: "CATALOGO",
      value: {
        products,
        warehouses: [warehouse()],
        pagination: {
          productos: { detected: false, pages: 1 },
          bodegas: { detected: false, pages: 1 },
        },
        counts: {
          total: products.length,
          productosFisicos: products.length,
          servicios: 0,
          tipoNoInformado: 0,
          bodegas: 1,
        },
      },
      fetchedAtMs: 1_000,
      consultedAt: new Date(1_000).toISOString(),
    });
    for (const item of products) {
      persistentCacheStore.entries.set(`producto:${item.id}`, {
        type: "STOCK_PRODUCTO",
        value: {
          stocks: [],
          pagination: { detected: false, pages: 1 },
        },
        fetchedAtMs: 1_000,
        consultedAt: new Date(1_000).toISOString(),
      });
    }

    let releaseStockRequests;
    const stockGate = new Promise((resolve) => {
      releaseStockRequests = resolve;
    });
    let activeStockRequests = 0;
    let maxActiveStockRequests = 0;
    let completedStockRequests = 0;
    let resolveAllCompleted;
    const allCompleted = new Promise((resolve) => {
      resolveAllCompleted = resolve;
    });
    const client = createClient(async (path) => {
      if (path === "/producto/") return { data: products };
      if (path === "/bodega/") return { data: [warehouse()] };
      if (path.includes("/stock/")) {
        activeStockRequests += 1;
        maxActiveStockRequests = Math.max(
          maxActiveStockRequests,
          activeStockRequests,
        );
        await stockGate;
        activeStockRequests -= 1;
        completedStockRequests += 1;
        if (completedStockRequests === products.length) resolveAllCompleted();
        return { data: [] };
      }
      throw new Error(`Ruta inesperada: ${path}`);
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      now: () => 2_000,
      catalogTtlMs: 1,
      stockTtlMs: 1,
      concurrency: 2,
      maxRetries: 0,
      persistentCacheStore,
    });

    const coverage = await service.getProductWarehouseCoverage({ limit: 5 });
    expect(coverage.productos).toHaveLength(5);
    expect(coverage.productos.every((item) => item.stale)).toBe(true);

    releaseStockRequests();
    await allCompleted;
    expect(maxActiveStockRequests).toBe(2);
  });

  test("distingue los timeouts de una cantidad cero", async () => {
    const client = createClient(async () => {
      const error = new Error("timeout");
      error.code = "ECONNABORTED";
      throw error;
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-prueba",
      maxRetries: 0,
    });

    await expect(service.getCatalog()).rejects.toMatchObject({
      code: "CONTIFICO_TIMEOUT",
      httpStatus: 504,
    });
  });

  test("expone errores de autenticacion de Contifico sin reintentarlos", async () => {
    const client = createClient(async () => {
      const error = new Error("unauthorized");
      error.response = { status: 401 };
      throw error;
    });
    const service = createContificoStockService({
      client,
      getApiKey: () => "clave-invalida",
      sleep: async () => {},
      maxRetries: 2,
    });

    await expect(service.getCatalog()).rejects.toMatchObject({
      code: "CONTIFICO_AUTH_ERROR",
    });
    expect(client.get).toHaveBeenCalledTimes(2);
  });
});
