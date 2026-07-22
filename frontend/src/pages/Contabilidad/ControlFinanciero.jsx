/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  DollarSign,
  FileSpreadsheet,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
} from "lucide-react";
import { saveAs } from "file-saver";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import {
  crearLibroControlFinanciero,
  crearNombreExcelControlFinanciero,
} from "../../utils/controlFinancieroExcel";
import { FaFileExcel } from "react-icons/fa";

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const filtrosIniciales = {
  fechaInicio: "",
  fechaFin: "",
  estado: "ACTIVA",
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

const ETIQUETAS_EXPORTACION = {
  caja: "Caja",
  ventasTv: "Ventas TV",
  ventasCelular: "Ventas celular",
};

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

function StatCard({ label, value, icon, tone = "green" }) {
  const tones = {
    green: "bg-green-50 text-green-700",
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
        <div className={`rounded-lg p-2.5 ${tones[tone] || tones.green}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }) {
  const estadoNormalizado = String(estado || "ACTIVA").toUpperCase();
  const estilos = {
    ACTIVA: "border-green-200 bg-green-50 text-green-700",
    ANULADA: "border-red-200 bg-red-50 text-red-700",
    REEMPLAZADA: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        estilos[estadoNormalizado] || estilos.ACTIVA
      }`}
    >
      {estadoNormalizado}
    </span>
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
      <div className="flex flex-col gap-1 bg-green-600 px-4 py-2 text-white sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-bold uppercase">Resumen general</span>
        <span className="text-xs text-green-50">
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
                  className={`cursor-pointer border-t transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-400 ${
                    seleccionada
                      ? "border-green-200 bg-green-100"
                      : "border-slate-100 hover:bg-green-50"
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
            <tr className="border-t-2 border-slate-300 bg-green-50 font-bold text-slate-900">
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
      <div className="bg-green-600 px-4 py-2 text-sm font-bold uppercase text-white">
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
        <div className="mx-4 flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-green-800">
            Mostrando cuotas de: {agenciaSeleccionada}
          </p>
          <button
            type="button"
            onClick={() => setAgenciaSeleccionada(null)}
            className="text-left text-sm font-semibold text-green-700 hover:text-green-900 sm:text-right"
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
        No existen registros para la sección seleccionada.
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
  const [anulandoCarga, setAnulandoCarga] = useState(false);
  const [consolidadoVentas, setConsolidadoVentas] = useState(null);
  const [exportandoExcel, setExportandoExcel] = useState(false);

  const cargarDetalle = useCallback(async (id) => {
    if (!id) {
      setConsolidadoVentas(null);
      setCargaSeleccionada(null);
      setRegistros(registrosIniciales);
      return;
    }

    try {
      setLoadingDetalle(true);
      const { data } = await api.get(
        `/api/contabilidad/control-financiero/cargas/${id}`,
      );
      setConsolidadoVentas(null);
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

  const cargarConsolidadoVentas = async () => {
    if (filtrosAplicados.estado !== "ACTIVA" || loadingDetalle) return;

    try {
      setLoadingDetalle(true);
      const params = Object.fromEntries(
        Object.entries({
          fechaInicio: filtrosAplicados.fechaInicio,
          fechaFin: filtrosAplicados.fechaFin,
        }).filter(([, value]) => value),
      );
      const { data } = await api.get(
        "/api/contabilidad/control-financiero/cargas/consolidado-ventas",
        { params },
      );

      setConsolidadoVentas(data.resumen || null);
      setCargaSeleccionada(null);
      setRegistros({
        caja: [],
        ventasTv: data.registros?.ventasTv || [],
        ventasCelular: data.registros?.ventasCelular || [],
      });
      setTabActivo("ventasTv");
      setBusqueda("");
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo consolidar las cargas activas."),
        "error",
      );
    } finally {
      setLoadingDetalle(false);
    }
  };

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
      setConsolidadoVentas(null);
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

  const anularCarga = async () => {
    if (
      !cargaSeleccionada ||
      cargaSeleccionada.estado !== "ACTIVA" ||
      anulandoCarga
    ) {
      return;
    }

    const confirmacion = await Swal.fire({
      title: `¿Anular carga #${cargaSeleccionada.id}?`,
      text: "Esta carga dejará de considerarse en los totales activos, pero sus registros se conservarán como historial.",
      icon: "warning",
      input: "textarea",
      inputLabel: "Motivo de anulación",
      inputPlaceholder: "Escribe el motivo de la anulación...",
      inputAttributes: {
        maxlength: "1000",
        "aria-label": "Motivo de anulación",
      },
      inputValidator: (value) =>
        String(value || "").trim()
          ? undefined
          : "El motivo de anulación es obligatorio.",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d97706",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setAnulandoCarga(true);
      await api.patch(
        `/api/contabilidad/control-financiero/cargas/${cargaSeleccionada.id}/anular`,
        { motivo: String(confirmacion.value || "").trim() },
      );

      await Swal.fire(
        "Carga anulada",
        "La carga fue anulada y todos sus registros se conservaron como historial.",
        "success",
      );

      if (
        filtrosAplicados.estado === "ACTIVA" &&
        cargas.length === 1 &&
        pagina > 1
      ) {
        setPagina((actual) => Math.max(1, actual - 1));
      } else {
        await cargarCargas();
      }
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo anular la carga."),
        "error",
      );
    } finally {
      setAnulandoCarga(false);
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
  const modoConsolidado = Boolean(consolidadoVentas);
  const tabsVisibles = modoConsolidado
    ? tabs.filter(({ id }) => id !== "caja")
    : tabs;

  const exportarSeccionExcel = async () => {
    const registrosExportar = registros[tabActivo] || [];
    if (!registrosExportar.length || exportandoExcel) {
      if (!registrosExportar.length) {
        Swal.fire(
          "Sin datos",
          "No existen registros en esta sección para exportar.",
          "info",
        );
      }
      return;
    }

    try {
      setExportandoExcel(true);
      const contexto = modoConsolidado
        ? `Consolidado de ${consolidadoVentas.cargas} cargas activas`
        : `Carga #${cargaSeleccionada.id} - ${formatFechaReporte(
            cargaSeleccionada.fechaReporte,
          )}`;
      const workbook = crearLibroControlFinanciero({
        tipo: tabActivo,
        registros: registrosExportar,
        resumenCaja,
        contexto,
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const nombreArchivo = crearNombreExcelControlFinanciero({
        tipo: tabActivo,
        carga: cargaSeleccionada,
        consolidado: modoConsolidado,
        filtros: filtrosAplicados,
      });
      saveAs(blob, nombreArchivo);
    } catch (error) {
      console.error("Error exportando control financiero:", error);
      Swal.fire("Error", "No se pudo generar el archivo Excel.", "error");
    } finally {
      setExportandoExcel(false);
    }
  };

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
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-green-700">
                <BarChart3 size={18} /> Contabilidad
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Control financiero</h1>
              <p className="mt-1 text-sm text-slate-600">
                Historial persistente de los reportes de caja y ventas procesados.
              </p>
            </div>

            <form
              onSubmit={aplicarFiltros}
              className="grid gap-3 sm:grid-cols-[150px_150px_160px_auto] sm:items-end"
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
              <label className="grid gap-1 text-xs font-semibold text-slate-600">
                Estado
                <select
                  value={filtros.estado}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      estado: event.target.value,
                    }))
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="ACTIVA">Activas</option>
                  <option value="ANULADA">Anuladas</option>
                  <option value="TODAS">Todas</option>
                </select>
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              {filtrosAplicados.estado === "ACTIVA" && paginacion.total > 0 && (
                <button
                  type="button"
                  onClick={cargarConsolidadoVentas}
                  disabled={loadingCargas || loadingDetalle}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                    modoConsolidado
                      ? "border-green-500 bg-green-600 text-white"
                      : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  }`}
                >
                  <FileSpreadsheet size={17} />
                  {modoConsolidado ? "Todas seleccionadas" : "Seleccionar todas"}
                </button>
              )}
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
                        ? "border-green-400 bg-green-50 ring-2 ring-green-100"
                        : "border-slate-200 hover:border-green-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className="truncate font-semibold text-slate-900">
                      Carga #{carga.id}
                    </p>
                    <div className="mt-2">
                      <EstadoBadge estado={carga.estado} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-green-700">
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

        {(cargaSeleccionada || consolidadoVentas) && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {modoConsolidado ? (
                <StatCard
                  label="Cargas activas"
                  value={consolidadoVentas.cargas}
                  icon={<FileSpreadsheet size={20} />}
                />
              ) : (
                <StatCard
                  label="Pagos de caja"
                  value={money.format(cargaSeleccionada.totalPagosCaja)}
                  icon={<DollarSign size={20} />}
                />
              )}
              <StatCard
                label="Ventas TV"
                value={money.format(
                  modoConsolidado
                    ? consolidadoVentas.totalVentasTv
                    : cargaSeleccionada.totalVentasTv,
                )}
                icon={<Monitor size={20} />}
                tone="blue"
              />
              <StatCard
                label="Entradas TV"
                value={money.format(
                  modoConsolidado
                    ? consolidadoVentas.totalEntradasTv
                    : cargaSeleccionada.totalEntradasTv,
                )}
                icon={<DollarSign size={20} />}
                tone="amber"
              />
              <StatCard
                label="Ventas celular"
                value={money.format(
                  modoConsolidado
                    ? consolidadoVentas.totalVentasCelular
                    : cargaSeleccionada.totalVentasCelular,
                )}
                icon={<Smartphone size={20} />}
                tone="violet"
              />
              <StatCard
                label="Entradas celular"
                value={money.format(
                  modoConsolidado
                    ? consolidadoVentas.totalEntradasCelular
                    : cargaSeleccionada.totalEntradasCelular,
                )}
                icon={<DollarSign size={20} />}
                tone="cyan"
              />
            </section>

            {cargaSeleccionada?.estado === "ANULADA" && (
              <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Ban size={18} />
                      <h2 className="font-bold">Carga anulada</h2>
                    </div>
                    <p className="mt-2 text-sm">
                      Esta carga se conserva como historial y no forma parte de
                      los totales activos.
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="font-semibold">Motivo:</span>{" "}
                      {cargaSeleccionada.motivoAnulacion || "No disponible"}
                    </p>
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="font-semibold">
                      {cargaSeleccionada.usuarioAnulador?.nombre ||
                        "Usuario no disponible"}
                    </p>
                    <p>{formatFechaHora(cargaSeleccionada.anuladoEn)}</p>
                  </div>
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet size={19} className="text-green-600" />
                    <h2 className="truncate font-semibold text-slate-900">
                      {modoConsolidado
                        ? "Consolidado de todas las cargas activas"
                        : cargaSeleccionada.archivoGenerado}
                    </h2>
                    {!modoConsolidado && (
                      <EstadoBadge estado={cargaSeleccionada.estado} />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {modoConsolidado
                      ? `${consolidadoVentas.cargas} cargas incluidas. Las cuotas no forman parte de este consolidado.`
                      : `Generado por ${
                          cargaSeleccionada.usuario?.nombre ||
                          "usuario no disponible"
                        }`}
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
                      className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-green-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={exportarSeccionExcel}
                    disabled={
                      exportandoExcel || !(registros[tabActivo]?.length > 0)
                    }
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FaFileExcel size={17} />
                    {exportandoExcel
                      ? "Generando..."
                      : `Exportar`}
                  </button>
                  {cargaSeleccionada?.estado === "ACTIVA" && (
                    <button
                      type="button"
                      onClick={anularCarga}
                      disabled={anulandoCarga}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Ban size={17} />
                      {anulandoCarga ? "Anulando..." : "Anular carga"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex overflow-x-auto border-b border-slate-200 px-4">
                {tabsVisibles.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTabActivo(id);
                      setBusqueda("");
                    }}
                    className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${
                      tabActivo === id
                        ? "border-green-500 text-green-700"
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
                    key={cargaSeleccionada?.id}
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
