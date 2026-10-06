import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronUp,
  PackageSearch,
  RefreshCw,
  Search,
  Warehouse,
} from "lucide-react";
import { api } from "../../api/client";
import AgenciasBodegasCards from "../../components/StockContifico/AgenciasBodegasCards";

const STOCK_FILTERS = [
  { value: "todos", label: "Todos los stocks" },
  { value: "positivo", label: "Stock positivo" },
  { value: "cero", label: "Stock cero" },
  { value: "negativo", label: "Stock negativo" },
  { value: "sin-dato", label: "Sin dato verificable" },
];

const TYPE_FILTERS = [
  { value: "PRO", label: "Productos fisicos" },
  { value: "SER", label: "Servicios" },
  { value: "todos", label: "Productos y servicios" },
];

const TABLE_PAGE_SIZE = 50;

const numberFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "America/Guayaquil",
});

const formatQuantity = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? numberFormatter.format(value)
    : "No informado";

const formatDateTime = (value) => {
  if (!value) return "Aun no disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : dateFormatter.format(date);
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const stockMatches = (value, filter) => {
  if (filter === "positivo") return typeof value === "number" && value > 0;
  if (filter === "cero") return value === 0;
  if (filter === "negativo") return typeof value === "number" && value < 0;
  if (filter === "sin-dato") return typeof value !== "number";
  return true;
};

function StockContifico() {
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [activeTab, setActiveTab] = useState("productos");
  const [agencySearch, setAgencySearch] = useState("");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("positivo");
  const [typeFilter, setTypeFilter] = useState("PRO");
  const [tablePage, setTablePage] = useState(1);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouseStocks, setWarehouseStocks] = useState({});
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [warehouseProgress, setWarehouseProgress] = useState({ processed: 0, total: 0 });
  const [warehouseError, setWarehouseError] = useState("");
  const [warehouseUpdatedAt, setWarehouseUpdatedAt] = useState(null);
  const [positiveWarehouses, setPositiveWarehouses] = useState([]);
  const [agencyProducts, setAgencyProducts] = useState([]);
  const [positiveWarehousesLoading, setPositiveWarehousesLoading] = useState(false);
  const [positiveWarehousesProgress, setPositiveWarehousesProgress] = useState({
    processed: 0,
    total: 0,
  });
  const [positiveWarehousesError, setPositiveWarehousesError] = useState("");
  const [details, setDetails] = useState({});

  const warehouseRequestRef = useRef(0);
  const warehouseSnapshotsRef = useRef({});
  const positiveWarehousesRequestRef = useRef(0);
  const positiveWarehousesSnapshotRef = useRef(null);
  const positiveWarehousesAutoStartedRef = useRef(false);

  const loadCatalog = useCallback(async (forceRefresh = false) => {
    setCatalogError("");
    forceRefresh ? setRefreshing(true) : setCatalogLoading(true);
    try {
      const response = await api.get("/api/logistica/stock-contifico/catalogo", {
        params: forceRefresh ? { actualizar: true } : undefined,
      });
      setCatalog(response.data);
      if (response.data.meta?.warning) setCatalogError(response.data.meta.warning);
      return response.data;
    } catch (error) {
      setCatalogError(
        getErrorMessage(error, "No fue posible consultar el inventario de Contífico."),
      );
      return null;
    } finally {
      setCatalogLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog(false);
    return () => {
      warehouseRequestRef.current += 1;
      positiveWarehousesRequestRef.current += 1;
    };
  }, [loadCatalog]);

  const loadWarehouseStock = useCallback(async (selectedId, forceRefresh = false) => {
    const requestId = warehouseRequestRef.current + 1;
    warehouseRequestRef.current = requestId;
    const previous = warehouseSnapshotsRef.current[selectedId];

    setWarehouseLoading(true);
    setWarehouseError("");
    setWarehouseProgress({ processed: 0, total: 0 });
    setWarehouseStocks(previous?.items || {});
    setWarehouseUpdatedAt(previous?.consultedAt || null);

    const collected = {};
    let offset = 0;
    let total = 0;
    let failedUpdates = 0;
    let lastSuccessfulTime = null;

    try {
      do {
        const response = await api.get(
          `/api/logistica/stock-contifico/bodegas/${encodeURIComponent(selectedId)}/stock`,
          {
            params: {
              offset,
              limit: 20,
              ...(forceRefresh ? { actualizar: true } : {}),
            },
          },
        );
        if (warehouseRequestRef.current !== requestId) return;

        for (const item of response.data.productos || []) {
          collected[item.productoId] = item;
        }
        failedUpdates += response.data.meta?.failedUpdates || 0;
        lastSuccessfulTime = response.data.meta?.consultedAt || lastSuccessfulTime;
        total = response.data.progreso?.total || 0;
        offset = response.data.progreso?.siguienteOffset;
        setWarehouseProgress({
          processed: Object.keys(collected).length,
          total,
        });
      } while (offset !== null && offset !== undefined);

      if (warehouseRequestRef.current !== requestId) return;

      if (failedUpdates > 0 && previous) {
        setWarehouseStocks(previous.items);
        setWarehouseUpdatedAt(previous.consultedAt);
        setWarehouseError(
          `No se pudieron actualizar ${failedUpdates} productos. Se conservan los ultimos datos completos de esta bodega.`,
        );
      } else {
        setWarehouseStocks(collected);
        if (failedUpdates === 0) {
          const snapshot = {
            items: collected,
            consultedAt: lastSuccessfulTime || new Date().toISOString(),
          };
          warehouseSnapshotsRef.current[selectedId] = snapshot;
          setWarehouseUpdatedAt(snapshot.consultedAt);
        } else {
          setWarehouseUpdatedAt(null);
          setWarehouseError(
            `La consulta quedo incompleta: ${failedUpdates} productos no pudieron actualizarse. Sus cantidades no se muestran como cero.`,
          );
        }
      }
    } catch (error) {
      if (warehouseRequestRef.current !== requestId) return;
      if (previous) {
        setWarehouseStocks(previous.items);
        setWarehouseUpdatedAt(previous.consultedAt);
      } else {
        setWarehouseStocks(collected);
      }
      setWarehouseError(
        `${getErrorMessage(error, "No fue posible consultar la bodega.")}${
          previous ? " Se conservan los ultimos datos validos." : ""
        }`,
      );
    } finally {
      if (warehouseRequestRef.current === requestId) setWarehouseLoading(false);
    }
  }, []);

  const loadPositiveWarehouses = useCallback(async (forceRefresh = false) => {
    const requestId = positiveWarehousesRequestRef.current + 1;
    positiveWarehousesRequestRef.current = requestId;
    const previous = positiveWarehousesSnapshotRef.current;
    const warehousesById = new Map();
    const collectedProducts = [];
    let offset = 0;
    let total = 0;
    let failedUpdates = 0;

    setPositiveWarehousesLoading(true);
    setPositiveWarehousesError("");
    setPositiveWarehousesProgress({ processed: 0, total: 0 });
    setPositiveWarehouses(previous?.warehouses || []);
    setAgencyProducts(previous?.products || []);

    try {
      do {
        const response = await api.get(
          "/api/logistica/stock-contifico/cobertura-bodegas",
          {
            params: {
              offset,
              limit: 20,
              ...(forceRefresh ? { actualizar: true } : {}),
            },
          },
        );
        if (positiveWarehousesRequestRef.current !== requestId) return null;

        for (const product of response.data.productos || []) {
          collectedProducts.push(product);
          for (const stock of product.bodegasReportadas || []) {
            if (!stock.cantidadValida || typeof stock.cantidad !== "number" || stock.cantidad <= 0) {
              continue;
            }
            warehousesById.set(stock.bodegaId, {
              id: stock.bodegaId,
              codigo: stock.bodegaCodigo,
              nombre: stock.bodegaNombre,
              incluidaEnCatalogo: stock.incluidaEnCatalogo,
            });
          }
        }

        failedUpdates += response.data.meta?.failedUpdates || 0;
        total = response.data.progreso?.total || 0;
        offset = response.data.progreso?.siguienteOffset;
        setPositiveWarehousesProgress({
          processed: response.data.progreso?.offset + response.data.progreso?.procesados || 0,
          total,
        });
      } while (offset !== null && offset !== undefined);

      if (positiveWarehousesRequestRef.current !== requestId) return null;

      const warehouses = Array.from(warehousesById.values()).sort((left, right) =>
        String(left.nombre || left.codigo || left.id).localeCompare(
          String(right.nombre || right.codigo || right.id),
          "es",
        ),
      );

      if (failedUpdates > 0 && previous) {
        setPositiveWarehouses(previous.warehouses);
        setAgencyProducts(previous.products);
        setPositiveWarehousesError(
          `No se pudieron verificar ${failedUpdates} productos. Se conserva el último listado completo de bodegas con stock positivo.`,
        );
        return previous.warehouses;
      }

      setPositiveWarehouses(warehouses);
      setAgencyProducts(collectedProducts);
      if (failedUpdates === 0) {
        positiveWarehousesSnapshotRef.current = { warehouses, products: collectedProducts };
      } else {
        setPositiveWarehousesError(
          `El listado puede estar incompleto: ${failedUpdates} productos no pudieron consultarse. Solo se muestran bodegas con stock positivo confirmado.`,
        );
      }
      return warehouses;
    } catch (error) {
      if (positiveWarehousesRequestRef.current !== requestId) return null;
      setPositiveWarehouses(previous?.warehouses || []);
      setAgencyProducts(previous?.products || []);
      setPositiveWarehousesError(
        `${getErrorMessage(error, "No fue posible identificar las bodegas con stock positivo.")}${
          previous ? " Se conserva el último listado válido." : ""
        }`,
      );
      return previous?.warehouses || null;
    } finally {
      if (positiveWarehousesRequestRef.current === requestId) {
        setPositiveWarehousesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!catalog || positiveWarehousesAutoStartedRef.current) return;
    positiveWarehousesAutoStartedRef.current = true;
    loadPositiveWarehouses(false);
  }, [catalog, loadPositiveWarehouses]);

  const handleWarehouseChange = (event) => {
    const selectedId = event.target.value;
    setWarehouseId(selectedId);
    setWarehouseError("");
    setDetails({});
    if (!selectedId) {
      warehouseRequestRef.current += 1;
      setWarehouseStocks({});
      setWarehouseProgress({ processed: 0, total: 0 });
      setWarehouseUpdatedAt(null);
      setWarehouseLoading(false);
      return;
    }
    loadWarehouseStock(selectedId, false);
  };

  const handleRefresh = async () => {
    setDetails({});
    const refreshed = await loadCatalog(true);
    if (!refreshed) return;

    const availableWarehouses = await loadPositiveWarehouses(true);
    if (!warehouseId) return;

    if (availableWarehouses?.some((warehouse) => warehouse.id === warehouseId)) {
      await loadWarehouseStock(warehouseId, false);
    } else {
      setWarehouseId("");
      setWarehouseStocks({});
      setWarehouseUpdatedAt(null);
    }
  };

  const toggleProductDetail = async (productId) => {
    const current = details[productId];
    if (current?.open) {
      setDetails((previous) => ({
        ...previous,
        [productId]: { ...previous[productId], open: false },
      }));
      return;
    }
    if (current?.data) {
      setDetails((previous) => ({
        ...previous,
        [productId]: { ...previous[productId], open: true },
      }));
      return;
    }

    setDetails((previous) => ({
      ...previous,
      [productId]: { open: true, loading: true, error: "", data: null },
    }));
    try {
      const response = await api.get(
        `/api/logistica/stock-contifico/productos/${encodeURIComponent(productId)}/stock`,
      );
      setDetails((previous) => ({
        ...previous,
        [productId]: { open: true, loading: false, error: "", data: response.data },
      }));
    } catch (error) {
      setDetails((previous) => ({
        ...previous,
        [productId]: {
          open: true,
          loading: false,
          error: getErrorMessage(error, "No fue posible obtener el desglose."),
          data: null,
        },
      }));
    }
  };

  const selectedWarehouse = positiveWarehouses.find((item) => item.id === warehouseId);
  const products = useMemo(() => catalog?.productos || [], [catalog?.productos]);
  const physicalProducts = useMemo(
    () => products.filter((product) => product.tipo === "PRO"),
    [products],
  );
  const getVisibleStock = useCallback(
    (product) => {
      if (product.tipo === "SER") return null;
      if (!warehouseId) return product.cantidadStockValida ? product.cantidadStock : null;
      const warehouseStock = warehouseStocks[product.id];
      return warehouseStock?.cantidadValida ? warehouseStock.cantidad : null;
    },
    [warehouseId, warehouseStocks],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    return products.filter((product) => {
      const matchesType = typeFilter === "todos" || product.tipo === typeFilter;
      const matchesSearch =
        !normalizedSearch ||
        String(product.nombre || "").toLocaleLowerCase("es").includes(normalizedSearch) ||
        String(product.codigo || "").toLocaleLowerCase("es").includes(normalizedSearch);
      return matchesType && matchesSearch && stockMatches(getVisibleStock(product), stockFilter);
    });
  }, [getVisibleStock, products, search, stockFilter, typeFilter]);

  const tablePageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / TABLE_PAGE_SIZE),
  );
  const visibleProducts = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredProducts.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredProducts, tablePage]);

  useEffect(() => {
    setTablePage(1);
  }, [search, stockFilter, typeFilter, warehouseId]);

  useEffect(() => {
    if (tablePage > tablePageCount) setTablePage(tablePageCount);
  }, [tablePage, tablePageCount]);

  const summary = useMemo(() => {
    const values = physicalProducts.map(getVisibleStock);
    return {
      total: physicalProducts.length,
      positive: values.filter((value) => typeof value === "number" && value > 0).length,
      zero: values.filter((value) => value === 0).length,
      negative: values.filter((value) => typeof value === "number" && value < 0).length,
      unknown: values.filter((value) => typeof value !== "number").length,
    };
  }, [getVisibleStock, physicalProducts]);

  if (catalogLoading && !catalog) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-slate-600">
        <RefreshCw className="mr-3 h-5 w-5 animate-spin text-green-600" />
        Consultando productos y bodegas en Contífico...
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <h1 className="text-xl font-bold">Stock Contífico no disponible</h1>
              <p className="mt-2">{catalogError}</p>
              <button
                type="button"
                onClick={() => loadCatalog(false)}
                className="mt-4 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-green-100 p-3 text-green-700">
                  <Boxes className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
                    Logistica
                  </p>
                  <h1 className="text-3xl font-bold text-slate-900">Stock Contífico</h1>
                </div>
              </div>

            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || warehouseLoading || positiveWarehousesLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-5 w-5 ${refreshing || positiveWarehousesLoading ? "animate-spin" : ""}`}
              />
              {refreshing || positiveWarehousesLoading ? "Actualizando..." : "Actualizar datos"}
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span>
                Ultima consulta exitosa del catalogo: {formatDateTime(catalog.meta?.consultedAt)}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-green-700">
                Fuente: {catalog.meta?.source === "contifico"
                  ? "Contífico"
                  : catalog.meta?.source === "persistencia"
                    ? "base persistente"
                    : "memoria del servidor"}
              </span>
            </div>
            <span className="font-medium text-slate-500">
              {catalog.meta?.pagination?.productos?.detected
                ? `${catalog.meta.pagination.productos.pages} paginas recibidas`
                : "Respuesta completa sin paginacion reportada"}
            </span>
          </div>
        </header>

        {(catalogError || catalog.meta?.stale) && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{catalogError || "Se estan mostrando los ultimos datos validos guardados."}</p>
          </div>
        )}

        <nav aria-label="Vistas de stock" className="flex flex-col gap-3 border-b border-slate-200 md:flex-row md:items-end md:justify-between">
          <div className="flex gap-2">
            {[
              ["productos", "Por productos"],
              ["agencias", "Por agencias / bodegas"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                aria-current={activeTab === value ? "page" : undefined}
                className={`rounded-t-xl px-5 py-3 text-sm font-semibold transition ${
                  activeTab === value
                    ? "border border-b-white border-slate-200 bg-white text-green-700"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {activeTab === "agencias" && (
            <label className="relative mb-2 block w-full md:max-w-xs">
              <span className="sr-only">Buscar agencia o producto</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={agencySearch}
                onChange={(event) => setAgencySearch(event.target.value)}
                placeholder="Buscar agencia o producto"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </label>
          )}
        </nav>

        {activeTab === "productos" && (
          <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Productos fisicos", summary.total, "text-slate-900"],
            ["Distintos con stock", summary.positive, "text-green-700"],
            ["Con stock cero", summary.zero, "text-slate-700"],
            ["Con stock negativo", summary.negative, "text-red-700"],
            ["Sin dato verificable", summary.unknown, "text-amber-700"],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="lg:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Buscar producto
              </span>
              <span className="relative block">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nombre o codigo"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </span>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Tipo</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                {TYPE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-semibold text-slate-700">Existencia</span>
              <select
                value={stockFilter}
                onChange={(event) => setStockFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                {STOCK_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <span className="flex min-w-56 items-center gap-2 text-sm font-semibold text-slate-700">
                <Warehouse className="h-5 w-5 text-green-700" />
                Existencias a consultar
              </span>
              <select
                value={warehouseId}
                onChange={handleWarehouseChange}
                disabled={positiveWarehousesLoading}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="">
                  {positiveWarehousesLoading
                    ? "Identificando bodegas con stock positivo..."
                    : "Cantidad general reportada por Contífico"}
                </option>
                {positiveWarehouses.map((warehouseItem) => (
                  <option key={warehouseItem.id} value={warehouseItem.id}>
                    {warehouseItem.codigo ? `${warehouseItem.codigo} - ` : ""}
                    {warehouseItem.nombre || "Bodega sin nombre"}
                  </option>
                ))}
              </select>
            </label>

            {positiveWarehousesLoading && (
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-sm text-slate-600">
                  <span>Verificando bodegas con existencias mayores a cero...</span>
                  <span>
                    {positiveWarehousesProgress.processed} / {positiveWarehousesProgress.total || "..."}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all"
                    style={{
                      width: positiveWarehousesProgress.total
                        ? `${Math.min(100, (positiveWarehousesProgress.processed / positiveWarehousesProgress.total) * 100)}%`
                        : "8%",
                    }}
                  />
                </div>
              </div>
            )}
            {!positiveWarehousesLoading && positiveWarehouses.length === 0 && !positiveWarehousesError && (
              <p className="mt-3 text-sm text-slate-600">
                Contífico no reportó bodegas con existencias mayores a cero.
              </p>
            )}
            {positiveWarehousesError && (
              <div className="mt-3 flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{positiveWarehousesError}</span>
              </div>
            )}

            {warehouseLoading && (
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-sm text-slate-600">
                  <span>Consultando productos con concurrencia limitada...</span>
                  <span>{warehouseProgress.processed} / {warehouseProgress.total || "..."}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all"
                    style={{
                      width: warehouseProgress.total
                        ? `${Math.min(100, (warehouseProgress.processed / warehouseProgress.total) * 100)}%`
                        : "8%",
                    }}
                  />
                </div>
              </div>
            )}
            {warehouseId && !warehouseLoading && (
              <p className="mt-3 text-sm text-slate-600">
                Ultima consulta completa de {selectedWarehouse?.nombre || "la bodega"}: {" "}
                {formatDateTime(warehouseUpdatedAt)}
              </p>
            )}
            {warehouseError && (
              <div className="mt-3 flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{warehouseError}</span>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {warehouseId
                  ? `Existencias en ${selectedWarehouse?.nombre || "bodega"}`
                  : "Cantidad general reportada"}
              </h2>
              <p className="text-sm text-slate-500">
                {filteredProducts.length} resultados visibles de {products.length} registros
              </p>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center text-slate-500">
              <PackageSearch className="mb-3 h-10 w-10 text-slate-400" />
              <p className="font-semibold text-slate-700">No hay resultados para estos filtros.</p>
              <p className="mt-1 text-sm">Prueba otro nombre, codigo, tipo o estado de stock.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-5 py-3">Codigo</th>
                    <th className="px-5 py-3">Producto</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3 text-right">Stock reportado</th>
                    <th className="px-5 py-3 text-right">Bodegas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleProducts.map((product) => {
                    const stockValue = getVisibleStock(product);
                    const warehouseStock = warehouseStocks[product.id];
                    const detail = details[product.id];
                    const positiveDetailWarehouses = (
                      detail?.data?.existenciasPorBodega || []
                    ).filter(
                      (item) => item.cantidadValida && typeof item.cantidad === "number" && item.cantidad > 0,
                    );
                    const stockClass =
                      typeof stockValue !== "number"
                        ? "text-slate-500"
                        : stockValue < 0
                          ? "text-red-700"
                          : stockValue === 0
                            ? "text-slate-700"
                            : "text-green-700";

                    return (
                      <tr key={product.id} className="align-top hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-4 font-mono text-sm text-slate-700">
                          {product.codigo || "Sin codigo"}
                        </td>
                        <td className="min-w-64 px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {product.nombre || "Producto sin nombre"}
                          </p>
                          {detail?.open && (
                            <div className="mt-3 max-w-2xl rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                              {detail.loading ? (
                                <p className="flex items-center gap-2 text-slate-600">
                                  <RefreshCw className="h-4 w-4 animate-spin" /> Cargando desglose...
                                </p>
                              ) : detail.error ? (
                                <p className="text-red-700">{detail.error}</p>
                              ) : (
                                <div className="space-y-3">
                                  {detail.data?.meta?.warning && (
                                    <p className="rounded-lg bg-amber-100 p-2 text-amber-900">
                                      {detail.data.meta.warning}
                                    </p>
                                  )}
                                  {positiveDetailWarehouses.length === 0 ? (
                                    <p className="text-slate-600">
                                      Contífico no reportó bodegas con stock mayor a cero para este
                                      producto.
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {positiveDetailWarehouses.map((item) => (
                                        <div key={item.bodegaId} className="flex justify-between gap-4">
                                          <span>{item.bodegaNombre || item.bodegaId}</span>
                                          <strong className="text-green-700">
                                            {formatQuantity(item.cantidad)}
                                          </strong>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {(detail.data?.cobertura?.bodegasNoReportadas?.length > 0 ||
                                    detail.data?.cobertura?.bodegasFueraCatalogo?.length > 0 ||
                                    detail.data?.cobertura?.bodegasConRegistrosDuplicados?.length > 0) && (
                                    <p className="text-xs leading-5 text-slate-500">
                                      {detail.data?.cobertura?.bodegasNoReportadas?.length > 0 && (
                                        <>No aparecen {detail.data.cobertura.bodegasNoReportadas.length} de {detail.data.cobertura.bodegasCatalogo} bodegas del catalogo. </>
                                      )}
                                      {detail.data?.cobertura?.bodegasFueraCatalogo?.length > 0 && (
                                        <>El desglose tambien contiene {detail.data.cobertura.bodegasFueraCatalogo.length} bodegas que no aparecen en el listado general de bodegas. </>
                                      )}
                                      {detail.data?.cobertura?.bodegasConRegistrosDuplicados?.length > 0 && (
                                        <>Hay identificadores de bodega repetidos; por seguridad no se calcula una suma del desglose.</>
                                      )}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                          {product.tipoDescripcion}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            product.estado === "A"
                              ? "bg-green-100 text-green-800"
                              : product.estado === "I"
                                ? "bg-slate-200 text-slate-700"
                                : "bg-amber-100 text-amber-800"
                          }`}>
                            {product.estadoDescripcion}
                          </span>
                        </td>
                        <td className={`whitespace-nowrap px-5 py-4 text-right font-bold ${stockClass}`}>
                          {product.tipo === "SER"
                            ? "Servicio"
                            : warehouseId && !warehouseStock && warehouseLoading
                              ? "Pendiente"
                              : warehouseId && warehouseStock?.estadoConsulta === "ERROR"
                                ? "Error de consulta"
                                : warehouseId && warehouseStock?.estadoConsulta === "CANTIDAD_INVALIDA"
                                  ? "Cantidad invalida"
                                  : warehouseId && warehouseStock?.estadoConsulta === "BODEGA_DUPLICADA"
                                    ? "Dato ambiguo"
                              : warehouseId && warehouseStock?.estadoConsulta === "NO_REPORTADO"
                                ? "No reportado"
                                : formatQuantity(stockValue)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-right">
                          {product.tipo === "PRO" ? (
                            <button
                              type="button"
                              onClick={() => toggleProductDetail(product.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-green-200 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-50"
                            >
                              {detail?.open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              Ver desglose
                            </button>
                          ) : (
                            <span className="text-sm text-slate-400">No aplica</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filteredProducts.length > TABLE_PAGE_SIZE && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
              <p className="text-sm text-slate-600">
                Pagina {tablePage} de {tablePageCount} · hasta {TABLE_PAGE_SIZE} productos por pagina
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTablePage((current) => Math.max(1, current - 1))}
                  disabled={tablePage === 1}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setTablePage((current) => Math.min(tablePageCount, current + 1))}
                  disabled={tablePage === tablePageCount}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
          </>
        )}

        {activeTab === "agencias" && (
          <AgenciasBodegasCards
            products={agencyProducts}
            search={agencySearch}
            loading={positiveWarehousesLoading}
            progress={positiveWarehousesProgress}
            error={positiveWarehousesError}
          />
        )}
      </div>
    </div>
  );
}

export default StockContifico;
