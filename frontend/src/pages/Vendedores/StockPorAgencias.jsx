import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Search, Warehouse } from "lucide-react";
import { api } from "../../api/client";
import AgenciasBodegasCards from "../../components/StockContifico/AgenciasBodegasCards";

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "No fue posible consultar el stock.";

function StockPorAgencias() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const lastCompleteRef = useRef(null);

  const loadStock = useCallback(async () => {
    const requestId = ++requestRef.current;
    const previous = lastCompleteRef.current;
    const collected = [];
    let offset = 0;
    let failedUpdates = 0;
    setLoading(true);
    setError("");
    setProgress({ processed: 0, total: 0 });
    setProducts(previous || []);

    try {
      do {
        const response = await api.get("/api/logistica/stock-contifico/cobertura-bodegas", {
          params: { offset, limit: 20 },
        });
        if (requestRef.current !== requestId) return;
        collected.push(...(response.data.productos || []));
        failedUpdates += response.data.meta?.failedUpdates || 0;
        setProgress({
          processed: response.data.progreso?.offset + response.data.progreso?.procesados || 0,
          total: response.data.progreso?.total || 0,
        });
        offset = response.data.progreso?.siguienteOffset;
      } while (offset !== null && offset !== undefined);

      if (failedUpdates > 0 && previous) {
        setError(`No se pudieron verificar ${failedUpdates} productos. Se conserva la última consulta completa.`);
        return;
      }
      setProducts(collected);
      if (failedUpdates === 0) lastCompleteRef.current = collected;
      else setError(`La consulta está incompleta: ${failedUpdates} productos no pudieron verificarse.`);
    } catch (loadError) {
      if (requestRef.current !== requestId) return;
      setProducts(previous || collected);
      setError(`${getErrorMessage(loadError)}${previous ? " Se conserva la última consulta completa." : ""}`);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStock();
    return () => { requestRef.current += 1; };
  }, [loadStock]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <Link to="/vendedor-panel" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-800">
          <ArrowLeft className="h-4 w-4" /> Volver al panel de vendedores
        </Link>
        <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-green-100 p-2.5 text-green-700">
              <Warehouse className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Stock por agencias / bodegas</h1>
              <p className="text-sm text-slate-600">Productos con cantidad positiva reportada por Contífico.</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Buscar agencia o producto</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar agencia o producto"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />
            </label>
            <button
              type="button"
              onClick={loadStock}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-green-200 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </button>
          </div>
        </header>
        <AgenciasBodegasCards
          products={products}
          search={search}
          loading={loading}
          progress={progress}
          error={error}
        />
      </div>
    </div>
  );
}

export default StockPorAgencias;
