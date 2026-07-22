/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileSpreadsheet,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const filtrosIniciales = {
  fechaInicio: "",
  fechaFin: "",
};

const registrosIniciales = {
  caja: [],
  ventasTv: [],
  ventasCelular: [],
};

const AGENCIAS_CAJA = ["NUEVA AURORA", "CAUPICHO", "SANGOLQUI", "OTROS"];
const PRODUCTOS_CAJA = ["CREDITV", "UPHONE"];

const tabs = [
  { id: "caja", label: "Caja", icon: DollarSign },
  { id: "ventasTv", label: "Ventas TV", icon: Monitor },
  { id: "ventasCelular", label: "Ventas celular", icon: Smartphone },
];

const formatFechaHora = (value) => {
  if (!value) return "-";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return String(value);
  return fecha.toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatFechaReporte = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "Fecha del PDF no disponible";
  const [, anio, mes, dia] = match;
  return new Date(Number(anio), Number(mes) - 1, Number(dia)).toLocaleDateString(
    "es-EC",
    { dateStyle: "long" },
  );
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

const redondearMoneda = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const crearResumenCaja = (registros) => {
  const acumulados = Object.fromEntries(
    AGENCIAS_CAJA.map((agencia) => [agencia, { uphone: 0, creditv: 0 }]),
  );

  registros.forEach((registro) => {
    const agencia = AGENCIAS_CAJA.includes(registro.agencia)
      ? registro.agencia
      : "OTROS";
    const producto = String(registro.producto || "").toUpperCase();
    const valor = Number(registro.pagosCuotas || 0);

    if (!Number.isFinite(valor)) return;
    if (producto === "UPHONE") acumulados[agencia].uphone += valor;
    if (producto === "CREDITV") acumulados[agencia].creditv += valor;
  });

  const filas = AGENCIAS_CAJA.map((agencia) => {
    const uphone = redondearMoneda(acumulados[agencia].uphone);
    const creditv = redondearMoneda(acumulados[agencia].creditv);
    return {
      agencia,
      uphone,
      creditv,
      total: redondearMoneda(uphone + creditv),
    };
  });

  const totalUphone = redondearMoneda(
    filas.reduce((total, fila) => total + fila.uphone, 0),
  );
  const totalCreditv = redondearMoneda(
    filas.reduce((total, fila) => total + fila.creditv, 0),
  );

  return {
    filas,
    total: {
      agencia: "TOTAL",
      uphone: totalUphone,
      creditv: totalCreditv,
      total: redondearMoneda(totalUphone + totalCreditv),
    },
  };
};

function StatCard({ label, value, icon, tone = "emerald" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    cyan: "bg-cyan-50 text-cyan-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${tones[tone] || tones.emerald}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TablaResumenCaja({
  filas,
  total,
  agenciaSeleccionada,
  onSeleccionarAgencia,
}) {
  return (
    <div>
      <div className="flex flex-col gap-1 bg-emerald-600 px-4 py-2 text-white sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-bold uppercase">Resumen general</span>
        <span className="text-xs text-emerald-50">
          Selecciona una agencia para filtrar sus cuotas
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-semibold">Agencia</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                Uphone
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                CrediTV
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const seleccionada = agenciaSeleccionada === fila.agencia;
              const seleccionar = () => onSeleccionarAgencia(fila.agencia);

              return (
                <tr
                  key={fila.agencia}
                  role="button"
                  tabIndex={0}
                  aria-pressed={seleccionada}
                  onClick={seleccionar}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      seleccionar();
                    }
                  }}
                  className={`cursor-pointer border-t transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400 ${
                    seleccionada
                      ? "border-emerald-200 bg-emerald-100"
                      : "border-slate-100 hover:bg-emerald-50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {fila.agencia}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {money.format(fila.uphone)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {money.format(fila.creditv)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {money.format(fila.total)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-300 bg-emerald-50 font-bold text-slate-900">
              <td className="px-4 py-3">{total.agencia}</td>
              <td className="px-4 py-3 text-right">{money.format(total.uphone)}</td>
              <td className="px-4 py-3 text-right">{money.format(total.creditv)}</td>
              <td className="px-4 py-3 text-right">{money.format(total.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TablaCuotasCaja({ producto, registros }) {
  const total = redondearMoneda(
    registros.reduce(
      (acumulado, registro) => acumulado + Number(registro.pagosCuotas || 0),
      0,
    ),
  );

  return (
    <section>
      <div className="bg-emerald-600 px-4 py-2 text-sm font-bold uppercase text-white">
        {producto}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-700 text-left text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">Contrato</th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">Fecha</th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">Vendedor</th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">
                Usuario cobrador
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">Cliente</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                Pagos cuotas
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">
                Nro. cuotas
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">Agencia</th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">Archivo</th>
            </tr>
          </thead>
          <tbody>
            {registros.length ? (
              registros.map((registro) => (
                <tr
                  key={registro.id}
                  className="border-t border-slate-100 hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">
                    {registro.contrato || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {registro.fecha || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {registro.vendedor || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {registro.usuarioCobrador || "-"}
                  </td>
                  <td className="min-w-64 px-3 py-3 text-slate-700">
                    {registro.cliente || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-slate-900">
                    {money.format(Number(registro.pagosCuotas || 0))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {registro.numeroCuotas || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                    {registro.agencia || "-"}
                  </td>
                  <td className="min-w-72 px-3 py-3 text-slate-600">
                    {registro.archivoOrigen || "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                  No existen cuotas de {producto} para esta carga.
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
              <td colSpan={5} className="px-3 py-3 text-right">
                TOTAL
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right">
                {money.format(total)}
              </td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VistaCaja({ resumen, registros }) {
  const [agenciaSeleccionada, setAgenciaSeleccionada] = useState(null);
  const registrosFiltrados = agenciaSeleccionada
    ? registros.filter(
        (registro) =>
          String(registro.agencia || "").toUpperCase() === agenciaSeleccionada,
      )
    : registros;

  const seleccionarAgencia = (agencia) => {
    setAgenciaSeleccionada((actual) => (actual === agencia ? null : agencia));
  };

  return (
    <div className="space-y-8 pb-6">
      <TablaResumenCaja
        filas={resumen.filas}
        total={resumen.total}
        agenciaSeleccionada={agenciaSeleccionada}
        onSeleccionarAgencia={seleccionarAgencia}
      />
      {agenciaSeleccionada && (
        <div className="mx-4 flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-emerald-800">
            Mostrando cuotas de: {agenciaSeleccionada}
          </p>
          <button
            type="button"
            onClick={() => setAgenciaSeleccionada(null)}
            className="text-left text-sm font-semibold text-emerald-700 hover:text-emerald-900 sm:text-right"
          >
            Quitar filtro
          </button>
        </div>
      )}
      {PRODUCTOS_CAJA.map((producto) => (
        <TablaCuotasCaja
          key={producto}
          producto={producto}
          registros={registrosFiltrados.filter(
            (registro) =>
              String(registro.producto || "").toUpperCase() === producto,
          )}
        />
      ))}
    </div>
  );
}

function TablaRegistros({ tipo, registros }) {
  const configuracion = {
    ventasTv: {
      columnas: [
        ["Contrato", "contrato"],
        ["Fecha", "fecha"],
        ["Vendedor", "vendedor"],
        ["Cliente", "cliente"],
        ["Modelo", "modelo"],
        ["Ventas", "ventas", true],
        ["Entradas", "entradas", true],
      ],
    },
    ventasCelular: {
      columnas: [
        ["Contrato", "contrato"],
        ["Fecha", "fecha"],
        ["Vendedor", "vendedor"],
        ["Cliente", "cliente"],
        ["Modelo", "modelo"],
        ["IMEI", "imei"],
        ["Ventas", "ventas", true],
        ["Entradas", "entradas", true],
      ],
    },
  }[tipo];

  if (!registros.length) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Esta carga no contiene registros para la sección seleccionada.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {configuracion.columnas.map(([label]) => (
              <th key={label} className="whitespace-nowrap px-3 py-3 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id} className="border-t border-slate-100 hover:bg-slate-50">
              {configuracion.columnas.map(([label, campo, monetario]) => (
                <td
                  key={label}
                  className={`px-3 py-3 ${
                    campo === "contrato" || campo === "imei"
                      ? "whitespace-nowrap font-medium text-slate-900"
                      : "text-slate-700"
                  }`}
                >
                  {monetario
                    ? money.format(Number(registro[campo] || 0))
                    : registro[campo] || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ControlFinanciero() {
  const [cargas, setCargas] = useState([]);
  const [cargaSeleccionada, setCargaSeleccionada] = useState(null);
  const [registros, setRegistros] = useState(registrosIniciales);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciales);
  const [pagina, setPagina] = useState(1);
  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    total: 0,
    totalPaginas: 1,
  });
  const [tabActivo, setTabActivo] = useState("caja");
  const [busqueda, setBusqueda] = useState("");
  const [loadingCargas, setLoadingCargas] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [eliminandoCarga, setEliminandoCarga] = useState(false);

  const cargarDetalle = useCallback(async (id) => {
    if (!id) {
      setCargaSeleccionada(null);
      setRegistros(registrosIniciales);
      return;
    }

    try {
      setLoadingDetalle(true);
      const { data } = await api.get(
        `/api/contabilidad/control-financiero/cargas/${id}`,
      );
      setCargaSeleccionada(data.carga || null);
      setRegistros(data.registros || registrosIniciales);
    } catch (error) {
      setCargaSeleccionada(null);
      setRegistros(registrosIniciales);
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo cargar el detalle financiero."),
        "error",
      );
    } finally {
      setLoadingDetalle(false);
    }
  }, []);

  const cargarCargas = useCallback(async () => {
    try {
      setLoadingCargas(true);
      const params = {
        pagina,
        limite: 20,
        ...Object.fromEntries(
          Object.entries(filtrosAplicados).filter(([, value]) => value),
        ),
      };
      const { data } = await api.get(
        "/api/contabilidad/control-financiero/cargas",
        { params },
      );
      const nuevasCargas = data.cargas || [];
      setCargas(nuevasCargas);
      setPaginacion(
        data.paginacion || { pagina, total: 0, totalPaginas: 1 },
      );

      await cargarDetalle(nuevasCargas[0]?.id || null);
    } catch (error) {
      setCargas([]);
      setCargaSeleccionada(null);
      setRegistros(registrosIniciales);
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo cargar el control financiero."),
        "error",
      );
    } finally {
      setLoadingCargas(false);
    }
  }, [cargarDetalle, filtrosAplicados, pagina]);

  useEffect(() => {
    cargarCargas();
  }, [cargarCargas]);

  const eliminarCarga = async () => {
    if (!cargaSeleccionada || eliminandoCarga) return;

    const confirmacion = await Swal.fire({
      title: `¿Eliminar carga #${cargaSeleccionada.id}?`,
      text: "Una vez aceptado, esto no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setEliminandoCarga(true);
      await api.delete(
        `/api/contabilidad/control-financiero/cargas/${cargaSeleccionada.id}`,
      );

      await Swal.fire(
        "Carga eliminada",
        "La carga y todos sus registros fueron eliminados.",
        "success",
      );

      if (cargas.length === 1 && pagina > 1) {
        setPagina((actual) => Math.max(1, actual - 1));
      } else {
        await cargarCargas();
      }
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo eliminar la carga."),
        "error",
      );
    } finally {
      setEliminandoCarga(false);
    }
  };

  const aplicarFiltros = (event) => {
    event.preventDefault();
    if (
      filtros.fechaInicio &&
      filtros.fechaFin &&
      filtros.fechaInicio > filtros.fechaFin
    ) {
      Swal.fire("Fechas no válidas", "La fecha inicial no puede ser mayor.", "warning");
      return;
    }
    setPagina(1);
    setFiltrosAplicados(filtros);
  };

  const resumenCaja = useMemo(
    () => crearResumenCaja(registros.caja || []),
    [registros.caja],
  );

  const registrosVisibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase("es");
    const actuales = registros[tabActivo] || [];
    if (!termino) return actuales;

    return actuales.filter((registro) =>
      [
        registro.contrato,
        registro.fecha,
        registro.vendedor,
        registro.usuarioCobrador,
        registro.cliente,
        registro.modelo,
        registro.imei,
        registro.producto,
        registro.agencia,
      ].some((value) =>
        String(value || "")
          .toLocaleLowerCase("es")
          .includes(termino),
      ),
    );
  }, [busqueda, registros, tabActivo]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <BarChart3 size={18} /> Contabilidad
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Control financiero</h1>
              <p className="mt-1 text-sm text-slate-600">
                Historial persistente de los reportes de caja y ventas procesados.
              </p>
            </div>

            <form
              onSubmit={aplicarFiltros}
              className="grid gap-3 sm:grid-cols-[150px_150px_auto] sm:items-end"
            >
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Reporte desde
                <input
                  type="date"
                  value={filtros.fechaInicio}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      fechaInicio: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Reporte hasta
                <input
                  type="date"
                  value={filtros.fechaFin}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      fechaFin: event.target.value,
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700"
              >
                <RefreshCw size={16} /> Consultar
              </button>
            </form>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <h2 className="font-semibold text-slate-900">Cargas generadas</h2>
              <p className="text-sm text-slate-500">{paginacion.total} cargas guardadas</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagina <= 1 || loadingCargas}
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                aria-label="Página anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <span className="text-sm text-slate-600">
                {pagina} / {paginacion.totalPaginas}
              </span>
              <button
                type="button"
                disabled={pagina >= paginacion.totalPaginas || loadingCargas}
                onClick={() => setPagina((actual) => actual + 1)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
                aria-label="Página siguiente"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          {loadingCargas ? (
            <p className="p-8 text-center text-sm text-slate-500">Cargando historial...</p>
          ) : cargas.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Aún no existen cargas de control financiero para estos filtros.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto p-4">
              {cargas.map((carga) => {
                const activa = carga.id === cargaSeleccionada?.id;
                return (
                  <button
                    key={carga.id}
                    type="button"
                    onClick={() => cargarDetalle(carga.id)}
                    className={`min-w-64 rounded-lg border p-4 text-left transition ${
                      activa
                        ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100"
                        : "border-slate-200 hover:border-emerald-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className="truncate font-semibold text-slate-900">
                      Carga #{carga.id}
                    </p>
                    <p className="mt-1 text-sm font-medium text-emerald-700">
                      {formatFechaReporte(carga.fechaReporte)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Cargado: {formatFechaHora(carga.createdAt)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {carga.usuario?.nombre || "Usuario no disponible"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {carga.registrosCaja +
                        carga.registrosVentasTv +
                        carga.registrosVentasCelular}{" "}
                      registros
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {cargaSeleccionada && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard
                label="Pagos de caja"
                value={money.format(cargaSeleccionada.totalPagosCaja)}
                icon={<DollarSign size={20} />}
              />
              <StatCard
                label="Ventas TV"
                value={money.format(cargaSeleccionada.totalVentasTv)}
                icon={<Monitor size={20} />}
                tone="blue"
              />
              <StatCard
                label="Entradas TV"
                value={money.format(cargaSeleccionada.totalEntradasTv)}
                icon={<DollarSign size={20} />}
                tone="amber"
              />
              <StatCard
                label="Ventas celular"
                value={money.format(cargaSeleccionada.totalVentasCelular)}
                icon={<Smartphone size={20} />}
                tone="violet"
              />
              <StatCard
                label="Entradas celular"
                value={money.format(cargaSeleccionada.totalEntradasCelular)}
                icon={<DollarSign size={20} />}
                tone="cyan"
              />
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={19} className="text-emerald-600" />
                    <h2 className="truncate font-semibold text-slate-900">
                      {cargaSeleccionada.archivoGenerado}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Generado por {cargaSeleccionada.usuario?.nombre || "usuario no disponible"}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                  <label className="relative block w-full lg:w-80">
                    <Search
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="search"
                      value={busqueda}
                      onChange={(event) => setBusqueda(event.target.value)}
                      placeholder="Buscar en la tabla..."
                      className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={eliminarCarga}
                    disabled={eliminandoCarga}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={17} />
                    {eliminandoCarga ? "Eliminando..." : "Eliminar carga"}
                  </button>
                </div>
              </div>

              <div className="flex overflow-x-auto border-b border-slate-200 px-4">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTabActivo(id);
                      setBusqueda("");
                    }}
                    className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
                      tabActivo === id
                        ? "border-emerald-500 text-emerald-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon size={17} />
                    {label} ({registros[id]?.length || 0})
                  </button>
                ))}
              </div>

              {loadingDetalle ? (
                <p className="p-10 text-center text-sm text-slate-500">
                  Cargando detalle...
                </p>
              ) : (
                tabActivo === "caja" ? (
                  <VistaCaja
                    key={cargaSeleccionada.id}
                    resumen={resumenCaja}
                    registros={registrosVisibles}
                  />
                ) : (
                  <TablaRegistros tipo={tabActivo} registros={registrosVisibles} />
                )
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
