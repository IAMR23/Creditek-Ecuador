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
