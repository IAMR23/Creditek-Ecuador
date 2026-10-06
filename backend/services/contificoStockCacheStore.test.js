jest.mock("../models/LogisticaContificoCache", () => ({
  findByPk: jest.fn(),
  upsert: jest.fn(),
}));

const LogisticaContificoCache = require("../models/LogisticaContificoCache");
const store = require("./contificoStockCacheStore");

describe("contificoStockCacheStore", () => {
  beforeEach(() => jest.clearAllMocks());

  test("lee una entrada persistida y normaliza su fecha", async () => {
    LogisticaContificoCache.findByPk.mockResolvedValue({
      cacheKey: "catalogo",
      tipo: "CATALOGO",
      contenido: { products: [], warehouses: [] },
      consultedAt: new Date("2026-10-06T15:00:00.000Z"),
    });

    await expect(store.read("catalogo")).resolves.toEqual({
      cacheKey: "catalogo",
      type: "CATALOGO",
      value: { products: [], warehouses: [] },
      fetchedAtMs: Date.parse("2026-10-06T15:00:00.000Z"),
      consultedAt: "2026-10-06T15:00:00.000Z",
    });
    expect(LogisticaContificoCache.findByPk).toHaveBeenCalledWith("catalogo", {
      raw: true,
    });
  });

  test("ignora filas ausentes o con fecha invalida", async () => {
    LogisticaContificoCache.findByPk
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ contenido: {}, consultedAt: "fecha-invalida" });

    await expect(store.read("ausente")).resolves.toBeNull();
    await expect(store.read("invalida")).resolves.toBeNull();
  });

  test("guarda el contenido con upsert", async () => {
    LogisticaContificoCache.upsert.mockResolvedValue([{}, true]);
    const value = { stocks: [], pagination: { detected: false, pages: 1 } };

    await store.write({
      cacheKey: "producto:ABC",
      type: "STOCK_PRODUCTO",
      value,
      fetchedAtMs: Date.parse("2026-10-06T16:00:00.000Z"),
    });

    expect(LogisticaContificoCache.upsert).toHaveBeenCalledWith({
      cacheKey: "producto:ABC",
      tipo: "STOCK_PRODUCTO",
      contenido: value,
      consultedAt: new Date("2026-10-06T16:00:00.000Z"),
    });
  });

  test("rechaza entradas incompletas antes de escribir", async () => {
    await expect(
      store.write({ cacheKey: "", type: "CATALOGO", value: {}, fetchedAtMs: 0 }),
    ).rejects.toThrow("Entrada de caché Contífico inválida");
    expect(LogisticaContificoCache.upsert).not.toHaveBeenCalled();
  });
});
