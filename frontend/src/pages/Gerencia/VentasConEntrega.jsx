import { useEffect, useMemo, useState } from "react";
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
import Select from "react-select";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../api/client";
import { getHoyLocal } from "../../utils/dateUtils";
import { nombreCortoUsuario } from "../../utils/nombres";

const REGISTROS_POR_PAGINA = 25;

const ESTILOS_SELECTOR_MULTIPLE = {
  control: (base, estado) => ({
    ...base,
    minHeight: 44,
    borderRadius: 12,
    borderColor: estado.isFocused ? "#10b981" : "#e2e8f0",
    boxShadow: estado.isFocused ? "0 0 0 4px #d1fae5" : "none",
    ":hover": { borderColor: estado.isFocused ? "#10b981" : "#cbd5e1" },
  }),
  multiValue: (base) => ({
    ...base,
    borderRadius: 8,
    backgroundColor: "#d1fae5",
  }),
  multiValueLabel: (base) => ({ ...base, color: "#065f46" }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#047857",
    ":hover": { backgroundColor: "#a7f3d0", color: "#064e3b" },
  }),
  menuPortal: (base) => ({ ...base, zIndex: 50 }),
};

const COLUMNAS = [
  { key: "ventaId", label: "ID venta" },
  {
    key: "fechaControlFinanciero",
    label: "Fecha y hora",
    className: "min-w-[170px]",
  },
  { key: "entregaId", label: "ID entrega" },
  {
    key: "fechaRegistroEntrega",
    label: "Fecha y hora entrega",
    className: "min-w-[170px]",
  },
  { key: "estadoEntrega", label: "Estado entrega" },
  { key: "tipoEntrega", label: "Tipo de entrega" },
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

const formatoMes = new Intl.DateTimeFormat("es-EC", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const etiquetaMes = (mes) => {
  const [anio, numeroMes] = String(mes || "").split("-").map(Number);
  if (!anio || !numeroMes) return mes;
  return formatoMes.format(new Date(Date.UTC(anio, numeroMes - 1, 1)));
};

const mesesDelPeriodo = (fechaInicio, fechaFin) => {
  if (!fechaInicio || !fechaFin || fechaInicio > fechaFin) return [];

  const [anioInicio, mesInicio] = fechaInicio.split("-").map(Number);
  const [anioFin, mesFin] = fechaFin.split("-").map(Number);
  const actual = new Date(Date.UTC(anioInicio, mesInicio - 1, 1));
  const fin = new Date(Date.UTC(anioFin, mesFin - 1, 1));
  const meses = [];

  while (actual <= fin && meses.length < 240) {
    meses.push(
      `${actual.getUTCFullYear()}-${String(actual.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    actual.setUTCMonth(actual.getUTCMonth() + 1);
  }

  return meses;
};

export default function VentasConEntrega() {
  const hoy = getHoyLocal();
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const [ventas, setVentas] = useState([]);
  const [dashboard, setDashboard] = useState({
    entregasPorMes: [],
    ventasDesdeHoraPorMes: [],
  });
  const [agencias, setAgencias] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [origenes, setOrigenes] = useState([]);
  const [fechaInicio, setFechaInicio] = useState(inicioMes);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [horaRegistroDesde, setHoraRegistroDesde] = useState("");
  const [agenciaIds, setAgenciaIds] = useState([]);
  const [vendedorIds, setVendedorIds] = useState([]);
  const [origenId, setOrigenId] = useState("");
  const [estadoEntrega, setEstadoEntrega] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [filtrosAplicados, setFiltrosAplicados] = useState(() => ({
    fechaInicio: inicioMes,
    fechaFin: hoy,
    horaRegistroDesde: "",
    agenciaIds: [],
    vendedorIds: [],
    origenId: "",
    estadoEntrega: "",
    tipoEntrega: "",
  }));
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [resumen, setResumen] = useState({
    directas: 0,
    porCedula: 0,
    ambiguas: 0,
  });
  const [loadingListado, setLoadingListado] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    const cargarCatalogos = async () => {
      const [agenciasResult, vendedoresResult, origenesResult] =
        await Promise.allSettled([
          api.get("/agencias"),
          api.get("/usuarios", { params: { rol: "Vendedor" } }),
          api.get("/origen"),
        ]);

      if (!activo) return;
      setAgencias(
        agenciasResult.status === "fulfilled"
          ? agenciasResult.value.data || []
          : [],
      );
      setVendedores(
        vendedoresResult.status === "fulfilled"
          ? vendedoresResult.value.data || []
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

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      setPagina(1);
      setBusquedaAplicada(busqueda.trim());
    }, 350);
    return () => window.clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    const controller = new AbortController();
    const cargarListado = async () => {
      setLoadingListado(true);
      setError("");
      try {
        const { data } = await api.get(
          "/api/gerencia/informe-ventas-con-entrega",
          {
            signal: controller.signal,
            params: {
              ...filtrosAplicados,
              agenciaIds: filtrosAplicados.agenciaIds.length
                ? filtrosAplicados.agenciaIds.join(",")
                : undefined,
              vendedorIds: filtrosAplicados.vendedorIds.length
                ? filtrosAplicados.vendedorIds.join(",")
                : undefined,
              busqueda: busquedaAplicada || undefined,
              seccion: "listado",
              page: pagina,
              limit: REGISTROS_POR_PAGINA,
            },
          },
        );

        if (!data.ok) throw new Error("Respuesta inválida del informe.");
        setVentas(Array.isArray(data.ventas) ? data.ventas : []);
        setTotal(Number(data.total || 0));
        setTotalPaginas(Math.max(1, Number(data.totalPages || 1)));
        setResumen({
          directas: Number(data.resumen?.directas || 0),
          porCedula: Number(data.resumen?.porCedula || 0),
          ambiguas: Number(data.resumen?.ambiguas || 0),
        });
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        console.error(requestError);
        setVentas([]);
        setTotal(0);
        setTotalPaginas(1);
        setResumen({ directas: 0, porCedula: 0, ambiguas: 0 });
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "No se pudo cargar el informe.",
        );
      } finally {
        if (!controller.signal.aborted) setLoadingListado(false);
      }
    };

    cargarListado();
    return () => controller.abort();
  }, [busquedaAplicada, filtrosAplicados, pagina]);

  useEffect(() => {
    const controller = new AbortController();
    const temporizador = window.setTimeout(async () => {
      setLoadingDashboard(true);
      try {
        const { data } = await api.get(
          "/api/gerencia/informe-ventas-con-entrega",
          {
            signal: controller.signal,
            params: {
              ...filtrosAplicados,
              agenciaIds: filtrosAplicados.agenciaIds.length
                ? filtrosAplicados.agenciaIds.join(",")
                : undefined,
              vendedorIds: filtrosAplicados.vendedorIds.length
                ? filtrosAplicados.vendedorIds.join(",")
                : undefined,
              seccion: "dashboard",
            },
          },
        );
        if (!data.ok) throw new Error("Respuesta inválida del dashboard.");
        setDashboard({
          entregasPorMes: Array.isArray(data.dashboard?.entregasPorMes)
            ? data.dashboard.entregasPorMes
            : [],
          ventasDesdeHoraPorMes: Array.isArray(
            data.dashboard?.ventasDesdeHoraPorMes,
          )
            ? data.dashboard.ventasDesdeHoraPorMes
            : [],
        });
      } catch (requestError) {
        if (requestError.code !== "ERR_CANCELED") {
          console.error(requestError);
          setDashboard({ entregasPorMes: [], ventasDesdeHoraPorMes: [] });
        }
      } finally {
        if (!controller.signal.aborted) setLoadingDashboard(false);
      }
    }, 150);

    return () => {
      window.clearTimeout(temporizador);
      controller.abort();
    };
  }, [filtrosAplicados]);

  const inicioPagina = (pagina - 1) * REGISTROS_POR_PAGINA;
  const ventasPagina = ventas;

  const opcionesAgencias = useMemo(
    () =>
      agencias.map((agencia) => ({
        value: String(agencia.id),
        label: agencia.nombre,
      })),
    [agencias],
  );
  const opcionesVendedores = useMemo(
    () =>
      vendedores.map((vendedor) => ({
        value: String(vendedor.id),
        label: nombreCortoUsuario(vendedor),
      })),
    [vendedores],
  );

  const datosDashboard = useMemo(() => {
    const entregas = new Map(
      dashboard.entregasPorMes.map((registro) => [
        registro.mes,
        Number(registro.cantidad || 0),
      ]),
    );
    const ventasDesdeHora = new Map(
      dashboard.ventasDesdeHoraPorMes.map((registro) => [
        registro.mes,
        Number(registro.cantidad || 0),
      ]),
    );
    const mesesConDatos = new Set([
      ...entregas.keys(),
      ...ventasDesdeHora.keys(),
    ]);
    const meses = mesesDelPeriodo(
      filtrosAplicados.fechaInicio,
      filtrosAplicados.fechaFin,
    );

    return (meses.length ? meses : [...mesesConDatos].sort()).map((mes) => ({
      mes,
      etiqueta: etiquetaMes(mes),
      entregas: entregas.get(mes) || 0,
      ventasDesdeHora: ventasDesdeHora.get(mes) || 0,
    }));
  }, [dashboard, filtrosAplicados]);

  const totalEntregasDashboard = datosDashboard.reduce(
    (total, registro) => total + registro.entregas,
    0,
  );
  const totalVentasDesdeHora = datosDashboard.reduce(
    (total, registro) => total + registro.ventasDesdeHora,
    0,
  );

  const aplicarFiltros = () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha inicial no puede ser mayor que la fecha final.");
      return;
    }

    setPagina(1);
    setFiltrosAplicados({
      fechaInicio,
      fechaFin,
      horaRegistroDesde,
      agenciaIds: [...agenciaIds],
      vendedorIds: [...vendedorIds],
      origenId,
      estadoEntrega,
      tipoEntrega,
    });
  };

  const limpiarFiltros = () => {
    setFechaInicio(inicioMes);
    setFechaFin(hoy);
    setHoraRegistroDesde("");
    setAgenciaIds([]);
    setVendedorIds([]);
    setOrigenId("");
    setEstadoEntrega("");
    setTipoEntrega("");
    setBusqueda("");
    setBusquedaAplicada("");
    setPagina(1);
    setFiltrosAplicados({
      fechaInicio: inicioMes,
      fechaFin: hoy,
      horaRegistroDesde: "",
      agenciaIds: [],
      vendedorIds: [],
      origenId: "",
      estadoEntrega: "",
      tipoEntrega: "",
    });
  };

  const exportarExcel = async () => {
    if (!total) {
      Swal.fire("Atención", "No hay datos para exportar.", "warning");
      return;
    }

    setExportando(true);
    try {
      const { data } = await api.get(
        "/api/gerencia/informe-ventas-con-entrega",
        {
          params: {
            ...filtrosAplicados,
            agenciaIds: filtrosAplicados.agenciaIds.length
              ? filtrosAplicados.agenciaIds.join(",")
              : undefined,
            vendedorIds: filtrosAplicados.vendedorIds.length
              ? filtrosAplicados.vendedorIds.join(",")
              : undefined,
            busqueda: busquedaAplicada || undefined,
            seccion: "listado",
            exportar: true,
          },
        },
      );
      const ventasExportar = Array.isArray(data.ventas) ? data.ventas : [];
      const filasExcel = ventasExportar.map((venta) => ({
      "ID venta": venta.ventaId,
      "Fecha y hora": mostrarFechaHora(
        venta.fechaControlFinanciero,
      ),
      "ID entrega relacionada": venta.entregaId,
      "Fecha y hora entrega": mostrarFechaHora(venta.fechaRegistroEntrega),
      "Estado entrega": venta.estadoEntrega,
      "Tipo de entrega": venta.tipoEntrega,
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
        `Ventas_con_entrega_${filtrosAplicados.fechaInicio || "inicio"}_${
          filtrosAplicados.fechaFin || "fin"
        }.xlsx`,
      );
    } catch (requestError) {
      console.error(requestError);
      Swal.fire(
        "No se pudo exportar",
        requestError.response?.data?.message || "Intenta nuevamente.",
        "error",
      );
    } finally {
      setExportando(false);
    }
  };

  const metricas = [
    {
      label: "Ventas ",
      valor: total,
      detalle: "Ventas",
      icono: Link2,
      color: "bg-slate-100 text-slate-700",
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
            Una fila por venta. La fecha y la hora provienen del registro de
            Control Financiero relacionado por contrato o IMEI.
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
                  Los cambios se consultan al aplicar los filtros.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X size={16} /> Limpiar
              </button>
              <button
                type="button"
                onClick={aplicarFiltros}
                disabled={loadingListado}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Filter size={16} /> Aplicar filtros
              </button>
              <button
                type="button"
                onClick={exportarExcel}
                disabled={exportando || !total}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                <Download size={17} /> {exportando ? "Exportando…" : "Exportar Excel"}
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
                <Clock3 size={14} /> Hora
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
            <div>
              <span className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <Building2 size={14} /> Agencia
              </span>
              <Select
                isMulti
                isClearable
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                options={opcionesAgencias}
                value={opcionesAgencias.filter((opcion) =>
                  agenciaIds.includes(opcion.value),
                )}
                onChange={(seleccion) =>
                  setAgenciaIds(
                    (seleccion || []).map((opcion) => opcion.value),
                  )
                }
                placeholder="Todas"
                noOptionsMessage={() => "Sin agencias"}
                styles={ESTILOS_SELECTOR_MULTIPLE}
                aria-label="Agencias"
              />
            </div>
            <div>
              <span className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Vendedor
              </span>
              <Select
                isMulti
                isClearable
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                options={opcionesVendedores}
                value={opcionesVendedores.filter((opcion) =>
                  vendedorIds.includes(opcion.value),
                )}
                onChange={(seleccion) =>
                  setVendedorIds(
                    (seleccion || []).map((opcion) => opcion.value),
                  )
                }
                placeholder="Todos"
                noOptionsMessage={() => "Sin vendedores"}
                styles={ESTILOS_SELECTOR_MULTIPLE}
                aria-label="Vendedores"
              />
            </div>
            <label>
              <span className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-slate-500">
                <UserRound size={14} /> Origen
              </span>
              <select
                value={origenId}
                onChange={(event) => setOrigenId(event.target.value)}
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
            <label>
              <span className="mb-2 block text-xs font-bold uppercase text-slate-500">
                Tipo de entrega
              </span>
              <select
                value={tipoEntrega}
                onChange={(event) => setTipoEntrega(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Todos</option>
                <option value="Entrega">Entrega</option>
                <option value="Envio">Envío</option>
              </select>
            </label>
          </div>
        </section>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setFiltrosAplicados((actual) => ({ ...actual }))}
              className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-sm font-bold text-white"
            >
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">
                  Entregas registradas por mes
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Fecha de registro de la entrega en horario de Ecuador.
                </p>
              </div>
              <span className="rounded-xl bg-emerald-100 px-3 py-2 text-lg font-bold text-emerald-700">
                {totalEntregasDashboard.toLocaleString("es-EC")}
              </span>
            </div>
            <div className="h-72">
              {loadingDashboard ? (
                <div className="h-full animate-pulse rounded-xl bg-slate-100" />
              ) : datosDashboard.some((registro) => registro.entregas > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={datosDashboard}
                    margin={{ top: 10, right: 18, left: -14, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(valor) => [
                        Number(valor).toLocaleString("es-EC"),
                        "Entregas",
                      ]}
                      labelFormatter={(_, elementos) =>
                        elementos?.[0]?.payload?.mes || ""
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="entregas"
                      stroke="#059669"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  No existen entregas en el período seleccionado.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">
                  Ventas
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filtrosAplicados.horaRegistroDesde
                    ? `Registradas en el reporte desde las ${filtrosAplicados.horaRegistroDesde} (hora Ecuador).`
                    : "Todas las horas; selecciona una hora diaria para aplicar el corte."}
                </p>
              </div>
              <span className="rounded-xl bg-blue-100 px-3 py-2 text-lg font-bold text-blue-700">
                {totalVentasDesdeHora.toLocaleString("es-EC")}
              </span>
            </div>
            <div className="h-72">
              {loadingDashboard ? (
                <div className="h-full animate-pulse rounded-xl bg-slate-100" />
              ) : datosDashboard.some(
                  (registro) => registro.ventasDesdeHora > 0,
                ) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={datosDashboard}
                    margin={{ top: 10, right: 18, left: -14, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(valor) => [
                        Number(valor).toLocaleString("es-EC"),
                        "Ventas",
                      ]}
                      labelFormatter={(_, elementos) =>
                        elementos?.[0]?.payload?.mes || ""
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="ventasDesdeHora"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
                  No existen ventas desde la hora indicada en el período.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">Resultados</h2>
              <p className="text-xs text-slate-500">
                {total.toLocaleString("es-EC")} ventas únicas
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

          {loadingListado ? (
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
                            ) : columna.key === "fechaControlFinanciero" ||
                              columna.key === "fechaRegistroEntrega" ? (
                              mostrarFechaHora(venta[columna.key])
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
                    total,
                  )} de {total}
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
