/* eslint-disable react/prop-types */
import { useMemo } from "react";
import { AlertTriangle, RefreshCw, Warehouse } from "lucide-react";

const numberFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

const formatQuantity = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? numberFormatter.format(value)
    : "No informado";

function AgenciasBodegasCards({ products, search, loading, progress, error }) {
  const agencies = useMemo(() => {
    const byWarehouse = new Map();
    for (const product of products) {
      if (product.estadoConsulta === "ERROR") continue;
      const stockCounts = new Map();
      for (const stock of product.bodegasReportadas || []) {
        stockCounts.set(stock.bodegaId, (stockCounts.get(stock.bodegaId) || 0) + 1);
      }
      for (const stock of product.bodegasReportadas || []) {
        if (stockCounts.get(stock.bodegaId) !== 1 || !stock.cantidadValida ||
            typeof stock.cantidad !== "number" || stock.cantidad <= 0) continue;
        if (!byWarehouse.has(stock.bodegaId)) {
          byWarehouse.set(stock.bodegaId, {
            id: stock.bodegaId,
            codigo: stock.bodegaCodigo,
            nombre: stock.bodegaNombre,
            products: [],
          });
        }
        byWarehouse.get(stock.bodegaId).products.push({
          id: product.productoId,
          codigo: product.codigo,
          nombre: product.nombre,
          cantidad: stock.cantidad,
        });
      }
    }
    return Array.from(byWarehouse.values()).sort((left, right) =>
      String(left.nombre || left.codigo || left.id).localeCompare(
        String(right.nombre || right.codigo || right.id), "es",
      ),
    );
  }, [products]);

  const visibleAgencies = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return agencies.map((agency) => ({
      ...agency,
      products: agency.products.filter((product) =>
        !query || [agency.nombre, agency.codigo, product.nombre, product.codigo]
          .some((value) => String(value || "").toLocaleLowerCase("es").includes(query)),
      ).sort((left, right) => String(left.nombre || left.codigo || left.id).localeCompare(
        String(right.nombre || right.codigo || right.id), "es",
      )),
    })).filter((agency) => agency.products.length > 0);
  }, [agencies, search]);

  return (
    <section className="space-y-3" aria-label="Existencias por agencias y bodegas">
      {loading && (
        <p className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Consultando productos: {progress.processed} / {progress.total || "..."}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </p>
      )}
      {!loading && !error && visibleAgencies.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          {search ? "No hay agencias ni productos que coincidan con la búsqueda." :
            "Contífico no reportó productos con cantidad positiva por bodega."}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visibleAgencies.map((agency) => (
          <article key={agency.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="rounded-lg bg-green-100 p-2 text-green-700">
                <Warehouse className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="break-words text-sm font-bold text-slate-900">
                  {agency.nombre || `Bodega ${agency.id}`}
                </h2>
                <p className="text-xs text-slate-500">
                  {agency.products.length} {agency.products.length === 1 ? "producto" : "productos"} con stock
                </p>
              </div>
            </div>
            <ul className="divide-y divide-slate-100">
              {agency.products.map((product) => (
                <li key={product.id} className="flex min-w-0 items-center justify-between gap-2 py-1.5 text-xs">
                  <span className="min-w-0 break-words text-slate-700">
                    {product.nombre || "Producto sin nombre"}
                  </span>
                  <strong className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-green-800">
                    <span className="sr-only">Cantidad: </span>
                    {formatQuantity(product.cantidad)}
                  </strong>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

export default AgenciasBodegasCards;
