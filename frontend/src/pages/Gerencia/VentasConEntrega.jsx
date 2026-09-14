import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  Link2,
  RefreshCw,
  Search,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import SelectUsuarios from "../../components/common/SelectUsuarios";
import { getHoyLocal } from "../../utils/dateUtils";

const REGISTROS_POR_PAGINA = 25;

const COLUMNAS = [
  { key: "ventaId", label: "ID venta" },
  {
    key: "fechaRegistroVenta",
    label: "Fecha y hora venta",
    className: "min-w-[170px]",
  },
  { key: "entregaId", label: "ID entrega" },
  {
    key: "fechaRegistroEntrega",
    label: "Fecha y hora entrega",
    className: "min-w-[170px]",
  },
  { key: "estadoEntrega", label: "Estado entrega" },
  { key: "cliente", label: "Cliente", className: "min-w-[210px]" },
  { key: "cedula", label: "Cédula" },
  { key: "telefono", label: "Teléfono" },
  { key: "agencia", label: "Agencia", className: "min-w-[150px]" },
  { key: "vendedor", label: "Vendedor", className: "min-w-[180px]" },
  { key: "origen", label: "Origen" },
  { key: "dispositivo", label: "Dispositivo" },
  { key: "marca", label: "Marca" },
  { key: "modelo", label: "Modelo", className: "min-w-[170px]" },
  { key: "formaPago", label: "Forma de pago" },
  { key: "precioVenta", label: "Precio de venta" },
  { key: "relacion", label: "Relación", className: "min-w-[145px]" },
  { key: "cantidadEntregas", label: "Entregas" },
];

const formatoMoneda = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatoFechaHora = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  dateStyle: "short",
  timeStyle: "short",
});

const mostrarFechaHora = (valor) => {
  if (!valor) return "—";
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? String(valor) : formatoFechaHora.format(fecha);
};

const etiquetaRelacion = (fila) => {
  if (fila.relacionAmbigua) return "Ambigua";
  return fila.tipoRelacion === "DIRECTA" ? "Relación directa" : "Por cédula";
};

const clasesRelacion = (fila) => {
  if (fila.relacionAmbigua) return "bg-amber-100 text-amber-800";
  return fila.tipoRelacion === "DIRECTA"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-blue-100 text-blue-800";
};

export default function VentasConEntrega() {
  const hoy = getHoyLocal();
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const [ventas, setVentas] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [origenes, setOrigenes] = useState([]);
  const [fechaInicio, setFechaInicio] = useState(inicioMes);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [horaRegistroDesde, setHoraRegistroDesde] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [origenId, setOrigenId] = useState("");
  const [soloOrigenEntrega, setSoloOrigenEntrega] = useState(true);
  const [estadoEntrega, setEstadoEntrega] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    const cargarCatalogos = async () => {
      const [agenciasResult, origenesResult] = await Promise.allSettled([
        api.get("/agencias"),
        api.get("/origen"),
      ]);

      if (!activo) return;
      setAgencias(
        agenciasResult.status === "fulfilled"
          ? agenciasResult.value.data || []
          : [],
      );
      setOrigenes(
        origenesResult.status === "fulfilled"
          ? origenesResult.value.data || []
          : [],
      );
    };

    cargarCatalogos();
    return () => {
      activo = false;
    };
  }, []);

  const cargarInforme = useCallback(async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setVentas([]);
      setError("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = {
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        horaRegistroDesde: horaRegistroDesde || undefined,
        agenciaId: agenciaId || undefined,
        vendedorId: vendedorId || undefined,
        origenId: origenId || undefined,
        soloOrigenEntrega,
        estadoEntrega: estadoEntrega || undefined,
      };
      const { data } = await api.get(
        "/api/gerencia/informe-ventas-con-entrega",
        { params },
      );

      if (!data.ok) throw new Error("Respuesta inválida del informe.");
      setVentas(Array.isArray(data.ventas) ? data.ventas : []);
    } catch (requestError) {
      console.error(requestError);
      setVentas([]);
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "No se pudo cargar el informe.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    agenciaId,
    estadoEntrega,
    fechaFin,
    fechaInicio,
    horaRegistroDesde,
    origenId,
    soloOrigenEntrega,
    vendedorId,
  ]);

  useEffect(() => {
    cargarInforme();
  }, [cargarInforme]);

  const ventasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return ventas;

    return ventas.filter((venta) =>
      [venta.cliente, venta.cedula].some((valor) =>
        String(valor || "").toLowerCase().includes(termino),
      ),
    );
  }, [busqueda, ventas]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, ventas]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(ventasFiltradas.length / REGISTROS_POR_PAGINA),
  );
  const inicioPagina = (pagina - 1) * REGISTROS_POR_PAGINA;
  const ventasPagina = ventasFiltradas.slice(
    inicioPagina,
    inicioPagina + REGISTROS_POR_PAGINA,
  );

  const resumen = useMemo(
    () => ({
      directas: ventasFiltradas.filter(
        (venta) => venta.tipoRelacion === "DIRECTA",
      ).length,
      porCedula: ventasFiltradas.filter(
        (venta) =>
          venta.tipoRelacion === "POR_CEDULA" && !venta.relacionAmbigua,
      ).length,
      ambiguas: ventasFiltradas.filter((venta) => venta.relacionAmbigua).length,
    }),
    [ventasFiltradas],
  );

  const limpiarFiltros = () => {
    setFechaInicio(inicioMes);
    setFechaFin(hoy);
    setHoraRegistroDesde("");
    setAgenciaId("");
    setVendedorId("");
    setOrigenId("");
    setSoloOrigenEntrega(true);
    setEstadoEntrega("");
    setBusqueda("");
  };

  const exportarExcel = () => {
    if (!ventasFiltradas.length) {
      Swal.fire("Atención", "No hay datos para exportar.", "warning");
      return;
    }

    const filasExcel = ventasFiltradas.map((venta) => ({
      "ID venta": venta.ventaId,
      "Fecha y hora venta": mostrarFechaHora(venta.fechaRegistroVenta),
      "ID entrega relacionada": venta.entregaId,
      "Fecha y hora entrega": mostrarFechaHora(venta.fechaRegistroEntrega),
      "Estado entrega": venta.estadoEntrega,
      Cliente: venta.cliente,
      Cédula: venta.cedula,
      Teléfono: venta.telefono,
      Agencia: venta.agencia,
      Vendedor: venta.vendedor,
      Origen: venta.origen,
      Dispositivo: venta.dispositivo,
      Marca: venta.marca,
      Modelo: venta.modelo,
      "Forma de pago": venta.formaPago,
      "Precio de venta": Number(venta.precioVenta || 0),
      "Tipo de relación": etiquetaRelacion(venta),
      "Cantidad de entregas": venta.cantidadEntregas,
      "Relación ambigua": venta.relacionAmbigua ? "Sí" : "No",
    }));
    const hoja = XLSX.utils.json_to_sheet(filasExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Ventas con entrega");
    XLSX.writeFile(
      libro,
      `Ventas_con_entrega_${fechaInicio || "inicio"}_${fechaFin || "fin"}.xlsx`,
    );
  };

  const metricas = [
    {
      label: "Ventas relacionadas",
      valor: ventasFiltradas.length,
      detalle: "Ventas únicas visibles",
      icono: Link2,
      color: "bg-slate-100 text-slate-700",
    },
    {
      label: "Relación directa",
      valor: resumen.directas,
      detalle: "Vinculadas mediante ventaId",
      icono: Truck,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Por cédula",
      valor: resumen.porCedula,
      detalle: "Coincidencias históricas únicas",
      icono: FileSpreadsheet,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Ambiguas",
      valor: resumen.ambiguas,
      detalle: "Requieren revisión manual",
      icono: AlertTriangle,
      color: "bg-amber-100 text-amber-700",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 p-3 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1900px] space-y-5">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Gerencia
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Ventas relacionadas con entregas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Una fila por venta, con relaciones directas e históricas claramente
            identificadas.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricas.map((metrica) => {
            const Icono = metrica.icono;
            return (
              <article
                key={metrica.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {metrica.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-950">
                      {metrica.valor.toLocaleString("es-EC")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {metrica.detalle}
                    </p>
                  </div>
                  <span className={`rounded-xl p-2.5 ${metrica.color}`}>
                    <Icono size={20} />
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-emerald-700" />
              <div>
                <h2 className="font-bold text-slate-950">Filtros</h2>
                <p className="text-xs text-slate-500">
                  El informe se actualiza automáticamente.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X size={16} /> Limpiar
              </button>
              <button
                type="button"
                onClick={exportarExcel}
                disabled={loading || !ventasFiltradas.length}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Download size={17} /> Exportar Excel
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            <label>
              <span className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <CalendarDays size={14} /> Fecha inicial
              </span>
              <input
                type="date"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <label>
              <span className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <Clock3 size={14} /> Registrada desde
              </span>
              <input
                type="time"
                value={horaRegistroDesde}
                onChange={(event) => setHoraRegistroDesde(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <label>
              <span className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <CalendarDays size={14} /> Fecha final
              </span>
              <input
                type="date"
                value={fechaFin}
                onChange={(event) => setFechaFin(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <label>
              <span className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <Building2 size={14} /> Agencia
              </span>
              <select
                value={agenciaId}
                onChange={(event) => setAgenciaId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Todas</option>
                {agencias.map((agencia) => (
                  <option key={agencia.id} value={agencia.id}>
                    {agencia.nombre}
                  </option>
                ))}
              </select>
            </label>
            <div className="[&_label]:mb-2 [&_label]:flex [&_label]:text-xs [&_label]:font-bold [&_label]:uppercase [&_label]:text-slate-500 [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border-slate-200 [&_select]:text-sm [&_select]:focus:border-emerald-500 [&_select]:focus:ring-4 [&_select]:focus:ring-emerald-100">
              <SelectUsuarios
                label="Vendedor"
                value={vendedorId}
                onChange={setVendedorId}
                rol="Vendedor"
              />
            </div>
            <label>
              <span className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <UserRound size={14} /> Origen
              </span>
              <select
                value={origenId}
                onChange={(event) => setOrigenId(event.target.value)}
                disabled={soloOrigenEntrega}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Todos</option>
                {origenes.map((origen) => (
                  <option key={origen.id} value={origen.id}>
                    {origen.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-11 items-center gap-3 self-end rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800">
              <input
                type="checkbox"
                checked={soloOrigenEntrega}
                onChange={(event) => {
                  setSoloOrigenEntrega(event.target.checked);
                  if (event.target.checked) setOrigenId("");
                }}
                className="h-4 w-4 accent-emerald-600"
              />
              Solo origen Entrega
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Estado entrega
              </span>
              <select
                value={estadoEntrega}
                onChange={(event) => setEstadoEntrega(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Transito">En tránsito</option>
                <option value="Entregado">Entregado</option>
                <option value="No Entregado">No entregado</option>
              </select>
            </label>
          </div>
        </section>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={cargarInforme}
              className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-sm font-bold text-white"
            >
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">Resultados</h2>
              <p className="text-xs text-slate-500">
                {ventasFiltradas.length.toLocaleString("es-EC")} ventas únicas
              </p>
            </div>
            <label className="relative w-full sm:max-w-sm">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar cliente o cédula"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100"
              />
            </label>
          </div>

          {loading ? (
            <div className="space-y-3 p-5" aria-label="Cargando informe">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className="h-11 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : ventasPagina.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                        #
                      </th>
                      {COLUMNAS.map((columna) => (
                        <th
                          key={columna.key}
                          className={`whitespace-nowrap px-4 py-3 text-xs font-bold uppercase text-slate-500 ${columna.className || ""}`}
                        >
                          {columna.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ventasPagina.map((venta, index) => (
                      <tr
                        key={venta.ventaId}
                        className="align-top hover:bg-emerald-50/40"
                      >
                        <td className="px-4 py-3 text-xs font-semibold text-slate-400">
                          {inicioPagina + index + 1}
                        </td>
                        {COLUMNAS.map((columna) => (
                          <td
                            key={columna.key}
                            className={`px-4 py-3 text-slate-600 ${columna.className || ""}`}
                          >
                            {columna.key === "precioVenta" ? (
                              formatoMoneda.format(Number(venta.precioVenta || 0))
                            ) : columna.key === "fechaRegistroVenta" ||
                              columna.key === "fechaRegistroEntrega" ? (
                              mostrarFechaHora(venta[columna.key])
                            ) : columna.key === "relacion" ? (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${clasesRelacion(venta)}`}
                              >
                                {etiquetaRelacion(venta)}
                              </span>
                            ) : (
                              venta[columna.key] ?? "—"
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs text-slate-500">
                  Mostrando {inicioPagina + 1}–
                  {Math.min(
                    inicioPagina + REGISTROS_POR_PAGINA,
                    ventasFiltradas.length,
                  )} de {ventasFiltradas.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                    disabled={pagina === 1}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-xs font-semibold text-slate-600">
                    {pagina} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPagina((actual) => Math.min(totalPaginas, actual + 1))
                    }
                    disabled={pagina === totalPaginas}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <FileSpreadsheet size={32} className="text-slate-300" />
              <h3 className="mt-3 font-bold text-slate-900">Sin resultados</h3>
              <p className="mt-1 text-sm text-slate-500">
                No existen ventas relacionadas para los filtros seleccionados.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
