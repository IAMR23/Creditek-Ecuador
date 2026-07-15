import { useCallback, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import {
  Building2,
  CalendarDays,
  Database,
  Download,
  Filter,
  RefreshCw,
  Search,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import SelectUsuarios from "../../components/common/SelectUsuarios";
import { getHoyLocal } from "../../utils/dateUtils";

const COLUMNAS = [
  { key: "Fecha", label: "Fecha", className: "min-w-[120px]" },
  { key: "Agencia", label: "Agencia", className: "min-w-[150px]" },
  { key: "Cliente", label: "Cliente", className: "min-w-[210px]" },
  { key: "Cedula", label: "Cédula", className: "min-w-[125px]" },
  { key: "Telefono", label: "Teléfono", className: "min-w-[130px]" },
  {
    key: "Direccion",
    label: "Dirección",
    className: "min-w-[240px] max-w-[320px] whitespace-normal",
  },
  { key: "Origen", label: "Origen", className: "min-w-[150px]" },
  {
    key: "Observaciones de Origen",
    label: "Observaciones de origen",
    className: "min-w-[240px] max-w-[320px] whitespace-normal",
  },
  { key: "Vendedor", label: "Vendedor", className: "min-w-[180px]" },
  { key: "Dispositivo", label: "Dispositivo", className: "min-w-[210px]" },
  { key: "Forma Pago", label: "Forma de pago", className: "min-w-[150px]" },
  {
    key: "Precio de Venta",
    label: "Precio de venta",
    className: "min-w-[145px] text-right font-semibold text-slate-900",
  },
];

const REGISTROS_POR_PAGINA = 25;

const formatoMoneda = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const normalizarTexto = (valor) => String(valor ?? "").trim().toUpperCase();

export default function BDDVentas() {
  const hoy = getHoyLocal();
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [origenes, setOrigenes] = useState([]);
  const [origenId, setOrigenId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let activo = true;

    const cargarCatalogos = async () => {
      const [agenciasResult, origenesResult] = await Promise.allSettled([
        api.get("/agencias"),
        api.get("/origen"),
      ]);

      if (!activo) return;

      if (agenciasResult.status === "fulfilled") {
        setAgencias(agenciasResult.value.data || []);
      } else {
        setAgencias([]);
      }

      if (origenesResult.status === "fulfilled") {
        setOrigenes(origenesResult.value.data || []);
      } else {
        setOrigenes([]);
      }

      if (
        agenciasResult.status === "rejected" ||
        origenesResult.status === "rejected"
      ) {
        Swal.fire({
          icon: "warning",
          title: "Filtros parcialmente disponibles",
          text: "No se pudieron cargar todos los catálogos de filtros.",
        });
      }
    };

    cargarCatalogos();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      setUsuarioInfo(decoded.usuario);
    } catch (decodeError) {
      console.error("Error decodificando token:", decodeError);
      setError("No se pudo validar la sesión actual.");
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin.");
      setFilas([]);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const params = { fechaInicio, fechaFin };

      if (agenciaId) params.agenciaId = agenciaId;
      if (vendedorId) params.vendedorId = vendedorId;
      if (origenId) params.origenId = origenId;

      const { data } = await api.get("/api/gerencia/informe", { params });

      if (!data.ok) {
        setFilas([]);
        setError("No se pudo obtener el reporte de ventas.");
        return;
      }

      const resultado = (data.ventas || []).map((venta) => {
        const precio = Number.parseFloat(venta.precioVendedor);
        const costoProducto = Number.parseFloat(venta.costoProducto);
        const margenPorcentual = Number.parseFloat(venta.margenPorcentual);

        return {
          Fecha: normalizarTexto(venta.fecha),
          Agencia: normalizarTexto(venta.local),
          Cliente: normalizarTexto(venta.nombre),
          Cedula: normalizarTexto(venta.cedula),
          Telefono: normalizarTexto(venta.telefono),
          Direccion: normalizarTexto(venta.direccion),
          Origen: normalizarTexto(venta.origen),
          "Observaciones de Origen": normalizarTexto(venta.observaciones),
          Vendedor: normalizarTexto(venta.vendedor),
          Dispositivo: normalizarTexto(
            `${venta.tipo ?? ""} ${venta.marca ?? ""} ${venta.modelo ?? ""}`,
          ),
          "Forma Pago": normalizarTexto(venta.formaPago),
          "Precio de Venta": Number.isFinite(precio) ? precio : 0,
          "Costo del Producto": Number.isFinite(costoProducto)
            ? costoProducto
            : "",
          "Margen Porcentual (%)": Number.isFinite(margenPorcentual)
            ? margenPorcentual
            : "",
        };
      });

      setFilas(resultado);
    } catch (requestError) {
      console.error(requestError);
      setFilas([]);
      setError(
        requestError.response?.data?.message ||
          "No se pudo cargar la base de datos de ventas.",
      );
    } finally {
      setLoading(false);
    }
  }, [agenciaId, fechaFin, fechaInicio, origenId, vendedorId]);

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchData();
    }
  }, [fechaFin, fechaInicio, fetchData, usuarioInfo?.id]);

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filas;

    return filas.filter((fila) =>
      Object.values(fila).some((valor) =>
        String(valor ?? "").toLowerCase().includes(termino),
      ),
    );
  }, [busqueda, filas]);

  useEffect(() => {
    setPagina(1);
  }, [busqueda, filas]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(filasFiltradas.length / REGISTROS_POR_PAGINA),
  );
  const inicioPagina = (pagina - 1) * REGISTROS_POR_PAGINA;
  const filasPagina = filasFiltradas.slice(
    inicioPagina,
    inicioPagina + REGISTROS_POR_PAGINA,
  );

  const resumen = useMemo(() => {
    const montoTotal = filasFiltradas.reduce(
      (total, fila) => total + Number(fila["Precio de Venta"] || 0),
      0,
    );
    const agenciasUnicas = new Set(
      filasFiltradas.map((fila) => fila.Agencia).filter(Boolean),
    ).size;
    const vendedoresUnicos = new Set(
      filasFiltradas.map((fila) => fila.Vendedor).filter(Boolean),
    ).size;

    return { montoTotal, agenciasUnicas, vendedoresUnicos };
  }, [filasFiltradas]);

  const filtrosAdicionales = [agenciaId, vendedorId, origenId, busqueda].filter(
    Boolean,
  ).length;

  const metricasResumen = [
    {
      icono: TrendingUp,
      label: "Ventas encontradas",
      valor: filasFiltradas.length.toLocaleString("es-EC"),
      detalle: "Registros según los filtros activos",
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      icono: Database,
      label: "Monto consolidado",
      valor: formatoMoneda.format(resumen.montoTotal),
      detalle: "Suma del precio de venta",
      color: "bg-blue-50 text-blue-700",
    },
    {
      icono: Building2,
      label: "Agencias",
      valor: resumen.agenciasUnicas.toLocaleString("es-EC"),
      detalle: "Agencias con resultados",
      color: "bg-violet-50 text-violet-700",
    },
    {
      icono: UsersRound,
      label: "Vendedores",
      valor: resumen.vendedoresUnicos.toLocaleString("es-EC"),
      detalle: "Equipo comercial en la consulta",
      color: "bg-amber-50 text-amber-700",
    },
  ];

  const limpiarFiltros = () => {
    setFechaInicio(hoy);
    setFechaFin(hoy);
    setAgenciaId("");
    setVendedorId("");
    setOrigenId("");
    setBusqueda("");
  };

  const descargarExcel = () => {
    if (!filasFiltradas.length) {
      Swal.fire("Atención", "No hay datos para exportar", "warning");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(filasFiltradas);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BDD Ventas");
    XLSX.writeFile(
      workbook,
      `BDD_Ventas_${fechaInicio}_a_${fechaFin}.xlsx`,
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-3 sm:p-4 lg:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">


        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricasResumen.map((metrica) => {
            const Icono = metrica.icono;

            return (
              <article
                key={metrica.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {metrica.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                      {metrica.valor}
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
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-slate-100 p-2 text-slate-700">
                <Filter size={18} />
              </span>
              <div>
                <h2 className="font-bold text-slate-950">Filtros del reporte</h2>
                <p className="text-xs text-slate-500">
                  La información se actualiza automáticamente al cambiar un filtro.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={limpiarFiltros}
                disabled={!filtrosAdicionales && fechaInicio === hoy && fechaFin === hoy}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X size={16} />
                Limpiar filtros
                {filtrosAdicionales > 0 && (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">
                    {filtrosAdicionales}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={descargarExcel}
                disabled={loading || !filasFiltradas.length}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={18} />
                Exportar Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <CalendarDays size={14} /> Fecha inicial
              </span>
              <input
                type="date"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <CalendarDays size={14} /> Fecha final
              </span>
              <input
                type="date"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                value={fechaFin}
                onChange={(event) => setFechaFin(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Building2 size={14} /> Agencia
              </span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                value={agenciaId}
                onChange={(event) => setAgenciaId(event.target.value)}
              >
                <option value="">Todas las agencias</option>
                {agencias.map((agencia) => (
                  <option key={agencia.id} value={agencia.id}>
                    {agencia.nombre}
                  </option>
                ))}
              </select>
            </label>

            <div className="[&_label]:mb-2 [&_label]:flex [&_label]:items-center [&_label]:gap-1.5 [&_label]:text-xs [&_label]:font-bold [&_label]:uppercase [&_label]:tracking-wide [&_label]:text-slate-500 [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border-slate-200 [&_select]:bg-white [&_select]:px-3 [&_select]:text-sm [&_select]:text-slate-800 [&_select]:outline-none [&_select]:transition [&_select]:focus:border-emerald-500 [&_select]:focus:ring-4 [&_select]:focus:ring-emerald-100">
              <SelectUsuarios
                label="Vendedor"
                value={vendedorId}
                onChange={setVendedorId}
                rol="Vendedor"
              />
            </div>

            <label className="block">
              <span className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                <UserRound size={14} /> Origen
              </span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                value={origenId}
                onChange={(event) => setOrigenId(event.target.value)}
              >
                <option value="">Todos los orígenes</option>
                {origenes.map((origen) => (
                  <option key={origen.id} value={origen.id}>
                    {origen.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error && (
          <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-red-800">No pudimos cargar los datos</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
            >
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">Resultados</h2>
              <p className="text-xs text-slate-500">
                {filasFiltradas.length.toLocaleString("es-EC")} de {filas.length.toLocaleString("es-EC")} registros visibles
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <label className="relative block w-full sm:min-w-[320px]">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar cliente, cédula, vendedor..."
                  aria-label="Buscar en los resultados"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5" aria-label="Cargando ventas">
              {Array.from({ length: 7 }).map((_, index) => (
                <div
                  key={index}
                  className="h-11 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : filasPagina.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
                    <tr>
                      <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        #
                      </th>
                      {COLUMNAS.map((columna) => (
                        <th
                          key={columna.key}
                          className={`border-b border-slate-200 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 ${columna.className}`}
                        >
                          {columna.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filasPagina.map((fila, index) => (
                      <tr
                        key={`${fila.Cedula}-${fila.Fecha}-${inicioPagina + index}`}
                        className="group transition hover:bg-emerald-50/50"
                      >
                        <td className="sticky left-0 z-[5] border-r border-slate-100 bg-white px-4 py-3 text-xs font-semibold text-slate-400 group-hover:bg-emerald-50">
                          {inicioPagina + index + 1}
                        </td>
                        {COLUMNAS.map((columna) => (
                          <td
                            key={columna.key}
                            className={`border-b border-slate-100 px-4 py-3 align-top text-slate-600 ${columna.className}`}
                          >
                            {columna.key === "Precio de Venta"
                              ? formatoMoneda.format(Number(fila[columna.key] || 0))
                              : fila[columna.key] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  Mostrando {inicioPagina + 1}–{Math.min(inicioPagina + REGISTROS_POR_PAGINA, filasFiltradas.length)} de {filasFiltradas.length.toLocaleString("es-EC")}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                    disabled={pagina === 1}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="min-w-20 text-center text-xs font-semibold text-slate-600">
                    {pagina} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPagina((actual) => Math.min(totalPaginas, actual + 1))
                    }
                    disabled={pagina === totalPaginas}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
              <span className="rounded-2xl bg-slate-100 p-4 text-slate-400">
                <Database size={30} />
              </span>
              <h3 className="mt-4 font-bold text-slate-900">Sin resultados</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                No encontramos ventas para el período y los filtros seleccionados.
              </p>
              {(filtrosAdicionales > 0 || fechaInicio !== hoy || fechaFin !== hoy) && (
                <button
                  type="button"
                  onClick={limpiarFiltros}
                  className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
