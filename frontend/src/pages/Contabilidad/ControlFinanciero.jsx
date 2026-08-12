/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DollarSign,
  Eye,
  FileSpreadsheet,
  Monitor,
  RefreshCw,
  Save,
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

const PERIODOS_RAPIDOS = [
  { id: "HOY", label: "Hoy" },
  { id: "SEMANA", label: "Esta semana" },
  { id: "MES", label: "Este mes" },
  { id: "SIETE_DIAS", label: "Ultimos 7 dias" },
  { id: "ANIO", label: "Este año" },
];

const fechaLocalIso = (fecha) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const obtenerRangoPeriodo = (periodo, ahora = new Date()) => {
  const fin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicio = new Date(fin);

  if (periodo === "SEMANA") {
    const diasDesdeLunes = (fin.getDay() + 6) % 7;
    inicio.setDate(fin.getDate() - diasDesdeLunes);
  } else if (periodo === "MES") {
    inicio.setDate(1);
  } else if (periodo === "SIETE_DIAS") {
    inicio.setDate(fin.getDate() - 6);
  } else if (periodo === "ANIO") {
    inicio.setMonth(0, 1);
  }

  return {
    fechaInicio: fechaLocalIso(inicio),
    fechaFin: fechaLocalIso(fin),
  };
};

const registrosIniciales = {
  caja: [],
  ventasTv: [],
  ventasCelular: [],
};

const resumenConciliacionInicial = {
  totalDeclarado: 0,
  totalReal: 0,
  diferenciaTotal: 0,
  cuadrados: 0,
  diferencias: 0,
  soloCaja: 0,
  soloControl: 0,
  coincidenciasAmbiguas: 0,
  pendientesRevision: 0,
  totalResultados: 0,
};

const AGENCIAS_CAJA = ["NUEVA AURORA", "CAUPICHO", "SANGOLQUI", "OTROS"];
const PRODUCTOS_CAJA = ["CREDITV", "UPHONE"];

const tabs = [
  { id: "caja", label: "Caja", icon: DollarSign },
  { id: "ventasTv", label: "Ventas TV", icon: Monitor },
  { id: "ventasCelular", label: "Ventas celular", icon: Smartphone },
  {
    id: "conciliacionEntradas",
    label: "Conciliación de entradas",
    icon: ClipboardCheck,
  },
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

function StatCard({ label, value, icon, tone = "green" }) {
  const tones = {
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    cyan: "bg-cyan-50 text-cyan-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold ">{value}</p>
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

function EstadoConciliacionBadge({ estado }) {
  const estilos = {
    CUADRADO: "border-green-200 bg-green-50 text-green-700",
    DIFERENCIA: "border-red-200 bg-red-50 text-red-700",
    SOLO_EN_CAJA: "border-blue-200 bg-blue-50 text-blue-700",
    SOLO_EN_CONTROL: "border-violet-200 bg-violet-50 text-violet-700",
    COINCIDENCIA_AMBIGUA:
      "border-amber-200 bg-amber-50 text-amber-800",
    PENDIENTE_REVISION:
      "border-orange-200 bg-orange-50 text-orange-800",
  };
  const estadoNormalizado = String(estado || "PENDIENTE_REVISION").toUpperCase();

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${
        estilos[estadoNormalizado] ||
        "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {estadoNormalizado.replaceAll("_", " ")}
    </span>
  );
}

function VistaConciliacionEntradas({
  conciliacion,
  error,
  resultados,
  onRevisar,
  onReconciliar,
  reconciliando,
  revisandoId,
}) {
  if (!conciliacion) {
    return (
      <div className="p-10 text-center">
        <ClipboardCheck className="mx-auto text-slate-400" size={36} />
        <h3 className="mt-3 font-semibold ">
          Conciliación aún no ejecutada
        </h3>
        <p className="mx-auto mt-1 max-w-xl text-sm text-slate-500">
          {error ||
            "Ejecuta la conciliación para comparar las entradas declaradas con los registros reales de esta carga."}
        </p>
        <button
          type="button"
          onClick={onReconciliar}
          disabled={reconciliando}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={reconciliando ? "animate-spin" : ""}
          />
          {reconciliando ? "Conciliando..." : "Ejecutar conciliación"}
        </button>
      </div>
    );
  }

  const resumen = {
    ...resumenConciliacionInicial,
    ...(conciliacion.resumen || {}),
  };

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold ">
            Última ejecución: {formatFechaHora(conciliacion.createdAt)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Origen: {conciliacion.origen || "MANUAL"} · Se conserva cada
            ejecución como evidencia histórica.
          </p>
        </div>
        <button
          type="button"
          onClick={onReconciliar}
          disabled={reconciliando}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={reconciliando ? "animate-spin" : ""}
          />
          {reconciliando ? "Conciliando..." : "Volver a conciliar"}
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard
          label="Total declarado"
          value={money.format(resumen.totalDeclarado)}
          icon={<DollarSign size={19} />}
        />
        <StatCard
          label="Total real"
          value={money.format(resumen.totalReal)}
          icon={<DollarSign size={19} />}
          tone="blue"
        />
        <StatCard
          label="Diferencia total"
          value={money.format(resumen.diferenciaTotal)}
          icon={<AlertTriangle size={19} />}
          tone={Math.abs(Number(resumen.diferenciaTotal)) <= 0.01 ? "green" : "red"}
        />
        <StatCard
          label="Cuadrados"
          value={resumen.cuadrados}
          icon={<CheckCircle2 size={19} />}
        />
        <StatCard
          label="Diferencias"
          value={resumen.diferencias}
          icon={<AlertTriangle size={19} />}
          tone="red"
        />
        <StatCard
          label="Solo caja"
          value={resumen.soloCaja}
          icon={<DollarSign size={19} />}
          tone="slate"
        />
        <StatCard
          label="Solo control"
          value={resumen.soloControl}
          icon={<DollarSign size={19} />}
          tone="violet"
        />
      </section>

      {(resumen.pendientesRevision > 0 ||
        resumen.coincidenciasAmbiguas > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Hay {resumen.pendientesRevision} coincidencia(s) pendiente(s) y{" "}
          {resumen.coincidenciasAmbiguas} ambigua(s). Ninguna coincidencia
          parcial se confirma automáticamente.
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide ">
            <tr>
              <th className="min-w-52 px-3 py-3 font-semibold">
                Cliente de caja
              </th>
              <th className="min-w-64 px-3 py-3 font-semibold">
                Cliente de Control Financiero
              </th>
              <th className="min-w-40 px-3 py-3 font-semibold">Contratos</th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                Entrada declarada
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                Entrada real
              </th>
              <th className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                Diferencia
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">
                Estado
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold">
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {resultados.length ? (
              resultados.map((resultado) => {
                const clientesCandidatos = (
                  resultado.candidatosControl || []
                )
                  .map((candidato) => candidato.clienteControl)
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <tr
                    key={resultado.id}
                    className="border-t border-slate-100 align-top hover:bg-slate-50"
                  >
                    <td className="px-3 py-3 font-medium ">
                      {resultado.clienteCaja || "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {resultado.clienteControl ||
                        clientesCandidatos ||
                        "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {(resultado.contratos || []).join(", ") || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium ">
                      {money.format(Number(resultado.entradaCaja || 0))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-medium ">
                      {money.format(Number(resultado.entradaReal || 0))}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-3 text-right font-bold ${
                        Math.abs(Number(resultado.diferencia || 0)) <= 0.01
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {money.format(Number(resultado.diferencia || 0))}
                    </td>
                    <td className="px-3 py-3">
                      <EstadoConciliacionBadge estado={resultado.estado} />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onRevisar(resultado)}
                        disabled={revisandoId === resultado.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-green-300 hover:text-green-700 disabled:opacity-50"
                      >
                        <Eye size={15} />
                        {revisandoId === resultado.id
                          ? "Guardando..."
                          : "Revisar"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  No existen entradas de caja ni de Control Financiero para
                  esta fecha.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
      <div className="flex flex-col gap-1 bg-green-600 px-4 py-2 text-white sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-bold uppercase">Resumen general</span>
        <span className="text-xs text-green-50">
          Selecciona una agencia para filtrar sus cuotas
        </span>
      </div>
      <div className="w-full">
        <table className="w-full table-fixed text-xs sm:text-sm">
          <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide ">
            <tr>
              <th className="w-[34%] px-2 py-2 font-semibold sm:px-3">Agencia</th>
              <th className="w-[22%] px-1 py-2 text-right font-semibold sm:px-3">
                Uphone
              </th>
              <th className="w-[22%] px-1 py-2 text-right font-semibold sm:px-3">
                CrediTV
              </th>
              <th className="w-[22%] px-1 py-2 text-right font-semibold sm:px-3">
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
                  <td className="break-words px-2 py-2 font-medium  sm:px-3">
                    {fila.agencia}
                  </td>
                  <td className="break-all px-1 py-2 text-right text-slate-700 sm:px-3">
                    {money.format(fila.uphone)}
                  </td>
                  <td className="break-all px-1 py-2 text-right text-slate-700 sm:px-3">
                    {money.format(fila.creditv)}
                  </td>
                  <td className="break-all px-1 py-2 text-right font-semibold  sm:px-3">
                    {money.format(fila.total)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-slate-300 bg-green-50 font-bold ">
              <td className="px-2 py-2 sm:px-3">{total.agencia}</td>
              <td className="break-all px-1 py-2 text-right sm:px-3">
                {money.format(total.uphone)}
              </td>
              <td className="break-all px-1 py-2 text-right sm:px-3">
                {money.format(total.creditv)}
              </td>
              <td className="break-all px-1 py-2 text-right sm:px-3">
                {money.format(total.total)}
              </td>
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
      <div className="divide-y divide-slate-100">
        <div className="hidden bg-slate-700 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.15fr)] xl:gap-3">
          <span>Operacion</span>
          <span>Cliente y vendedor</span>
          <span>Cobro</span>
          <span className="text-right">Valor y archivo</span>
        </div>
        {registros.length ? (
          registros.map((registro) => (
            <article
              key={registro.id}
              className="grid min-w-0 gap-3 px-3 py-3 text-xs hover:bg-slate-50 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1.15fr)]"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
                  Operacion
                </p>
                <p className="break-words font-semibold ">
                  {registro.contrato || "-"}
                </p>
                <p className="mt-1 break-words ">
                  {registro.fecha || "-"} · {registro.agencia || "-"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
                  Cliente y vendedor
                </p>
                <p className="break-words font-medium text-slate-800">
                  {registro.cliente || "-"}
                </p>
                <p className="mt-1 break-words ">
                  {registro.vendedor || "-"}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
                  Cobro
                </p>
                <p className="break-words text-slate-700">
                  {registro.usuarioCobrador || "-"}
                </p>
                <p className="mt-1 break-words text-slate-500">
                  Cuotas: {registro.numeroCuotas || "-"}
                </p>
              </div>
              <div className="min-w-0 sm:text-right">
                <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
                  Valor y archivo
                </p>
                <p className="font-semibold ">
                  {money.format(Number(registro.pagosCuotas || 0))}
                </p>
                <p className="mt-1 break-all text-[11px] text-slate-500">
                  {registro.archivoOrigen || "-"}
                </p>
              </div>
            </article>
          ))
        ) : (
          <p className="px-3 py-6 text-center text-sm text-slate-500">
            No existen cuotas de {producto} para esta carga.
          </p>
        )}
        <div className="flex items-center justify-end gap-3 border-t-2 border-slate-300 bg-slate-50 px-3 py-3 text-sm font-bold ">
          <span>TOTAL</span>
          <span>{money.format(total)}</span>
        </div>
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

function FilaRegistroVenta({
  editable,
  guardando,
  onGuardar,
  registro,
  tipo,
  usuariosResponsables,
}) {
  const [estado, setEstado] = useState(
    registro.estadoPagoEntrada || "PENDIENTE",
  );
  const [responsableId, setResponsableId] = useState(
    registro.responsablePagoEntradaId
      ? String(registro.responsablePagoEntradaId)
      : "",
  );
  const [observacion, setObservacion] = useState(
    registro.observacionPagoEntrada || "",
  );
  const [guardado, setGuardado] = useState(false);
  const tieneEntrada = Number(registro.entradas || 0) > 0;
  const esCelular = tipo === "ventasCelular";
  const responsableActual = registro.responsablePagoEntrada;
  const responsables =
    responsableActual &&
    !usuariosResponsables.some(
      (usuario) => Number(usuario.id) === Number(responsableActual.id),
    )
      ? [responsableActual, ...usuariosResponsables]
      : usuariosResponsables;
  const cambioPendiente =
    estado !== (registro.estadoPagoEntrada || "PENDIENTE") ||
    responsableId !==
      (registro.responsablePagoEntradaId
        ? String(registro.responsablePagoEntradaId)
        : "") ||
    observacion !== (registro.observacionPagoEntrada || "");

  useEffect(() => {
    setEstado(registro.estadoPagoEntrada || "PENDIENTE");
    setResponsableId(
      registro.responsablePagoEntradaId
        ? String(registro.responsablePagoEntradaId)
        : "",
    );
    setObservacion(registro.observacionPagoEntrada || "");
  }, [registro]);

  const guardar = async () => {
    if (!responsableId || !cambioPendiente || guardando) return;
    setGuardado(false);
    try {
      await onGuardar(registro.id, {
        estado,
        responsableUsuarioId: Number(responsableId),
        observacion,
      });
      setGuardado(true);
    } catch {
      setGuardado(false);
    }
  };

  return (
    <article className="grid min-w-0 gap-3 px-3 py-3 text-xs hover:bg-slate-50 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_2.25rem] xl:items-start xl:gap-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
          Operacion
        </p>
        <p className="break-words font-semibold ">
          {registro.contrato || "-"}
        </p>
        <p className="mt-1 break-words text-slate-500">
          {registro.fecha || "-"}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
          Cliente y vendedor
        </p>
        <p className="break-words font-medium text-slate-800">
          {registro.cliente || "-"}
        </p>
        <p className="mt-1 break-words text-slate-500">
          {registro.vendedor || "-"}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
          Equipo
        </p>
        <p className="break-words text-slate-700">{registro.modelo || "-"}</p>
        {esCelular && (
          <p className="mt-1 break-all font-medium text-slate-500">
            IMEI: {registro.imei || "-"}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
          Valores
        </p>
        <p className="font-semibold ">
          {money.format(Number(registro.ventas || 0))}
        </p>
        <p className="mt-1 font-medium text-green-700">
          Entrada: {money.format(Number(registro.entradas || 0))}
        </p>
      </div>
      {tieneEntrada ? (
        <>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
              Estado
            </p>
            <select
              value={estado}
              onChange={(event) => {
                setEstado(event.target.value);
                setGuardado(false);
              }}
              disabled={!editable || guardando}
              className={`w-full min-w-0 rounded-md border px-2 py-1.5 text-[11px] font-semibold outline-none focus:border-green-400 disabled:cursor-not-allowed disabled:opacity-70 ${
                estado === "PAGADO"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
              aria-label={`Estado del pago del contrato ${registro.contrato || registro.id}`}
            >
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="PAGADO">PAGADO</option>
            </select>
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
              Responsable
            </p>
            <select
              value={responsableId}
              onChange={(event) => {
                setResponsableId(event.target.value);
                setGuardado(false);
              }}
              disabled={!editable || guardando}
              className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-green-400 disabled:cursor-not-allowed disabled:bg-slate-50"
              aria-label={`Responsable del pago del contrato ${registro.contrato || registro.id}`}
            >
              <option value="">Seleccionar usuario</option>
              {responsables.map((usuario) => (
                <option
                  key={usuario.id}
                  value={usuario.id}
                  disabled={usuario.activo === false}
                >
                  {usuario.nombre}
                  {usuario.activo === false ? " (inactivo)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 sm:col-span-2 xl:col-span-1">
            <p className="mb-1 text-[10px] font-semibold uppercase text-slate-400 xl:hidden">
              Observacion
            </p>
            <input
              type="text"
              value={observacion}
              onChange={(event) => {
                setObservacion(event.target.value);
                setGuardado(false);
              }}
              disabled={!editable || guardando}
              maxLength={1000}
              placeholder="Observacion del pago"
              className="w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-green-400 disabled:cursor-not-allowed disabled:bg-slate-50"
              aria-label={`Observacion del pago del contrato ${registro.contrato || registro.id}`}
            />
          </div>
          <div className="flex min-w-0 items-end justify-end sm:col-span-2 xl:col-span-1">
            <button
              type="button"
              onClick={guardar}
              disabled={
                !editable || guardando || !responsableId || !cambioPendiente
              }
              title={
                !editable
                  ? "La carga no esta activa"
                  : !responsableId
                    ? "Selecciona un responsable"
                    : "Guardar gestion del pago"
              }
              aria-label="Guardar gestion del pago"
              className={`inline-flex size-8 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                guardado && !cambioPendiente
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-slate-200 bg-white  hover:border-green-300 hover:text-green-700"
              }`}
            >
              {guardando ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : guardado && !cambioPendiente ? (
                <CheckCircle2 size={16} />
              ) : (
                <Save size={15} />
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="flex min-h-8 items-center text-slate-400 sm:col-span-2 xl:col-span-4">
          Sin valor de entrada
        </div>
      )}
    </article>
  );
}

function TablaRegistros({
  tipo,
  registros,
  usuariosResponsables,
  onGuardarPago,
  guardandoPagoId,
  editable,
}) {
  if (!registros.length) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        No existen registros para la sección seleccionada.
      </div>
    );
  }

  return (
    <div className="min-w-0 divide-y divide-slate-100">
      <div className="hidden bg-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide  xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_2.25rem] xl:gap-2">
        <span>Operacion</span>
        <span>Cliente y vendedor</span>
        <span>Equipo</span>
        <span>Valores</span>
        <span>Estado</span>
        <span>Responsable</span>
        <span>Observacion</span>
        <span />
      </div>
      {registros.map((registro) => (
        <FilaRegistroVenta
          key={registro.id}
          editable={editable}
          guardando={guardandoPagoId === registro.id}
          onGuardar={onGuardarPago}
          registro={registro}
          tipo={tipo}
          usuariosResponsables={usuariosResponsables}
        />
      ))}
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
  const [usuariosResponsables, setUsuariosResponsables] = useState([]);
  const [guardandoPagoId, setGuardandoPagoId] = useState(null);
  const [conciliacionEntradas, setConciliacionEntradas] = useState(null);
  const [errorConciliacion, setErrorConciliacion] = useState("");
  const [reconciliandoEntradas, setReconciliandoEntradas] = useState(false);
  const [revisandoConciliacionId, setRevisandoConciliacionId] =
    useState(null);

  const cargarConciliacionEntradas = useCallback(async (cargaId) => {
    if (!cargaId) {
      setConciliacionEntradas(null);
      setErrorConciliacion("");
      return;
    }

    try {
      const { data } = await api.get(
        `/api/contabilidad/control-financiero/cargas/${cargaId}/conciliacion-entradas`,
      );
      setConciliacionEntradas(data.conciliacion || null);
      setErrorConciliacion(data.conciliacion ? "" : data.message || "");
    } catch (error) {
      setConciliacionEntradas(null);
      setErrorConciliacion(
        getErrorMessage(
          error,
          "No se pudo consultar la conciliación de entradas.",
        ),
      );
    }
  }, []);

  const cargarDetalle = useCallback(async (id) => {
    if (!id) {
      setConsolidadoVentas(null);
      setCargaSeleccionada(null);
      setRegistros(registrosIniciales);
      setConciliacionEntradas(null);
      setErrorConciliacion("");
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
      await cargarConciliacionEntradas(id);
    } catch (error) {
      setCargaSeleccionada(null);
      setRegistros(registrosIniciales);
      setConciliacionEntradas(null);
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo cargar el detalle financiero."),
        "error",
      );
    } finally {
      setLoadingDetalle(false);
    }
  }, [cargarConciliacionEntradas]);

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
      setConciliacionEntradas(null);
      setErrorConciliacion("");
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
      setConciliacionEntradas(null);
      setErrorConciliacion("");
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

  useEffect(() => {
    const cargarResponsables = async () => {
      try {
        const { data } = await api.get(
          "/api/contabilidad/control-financiero/responsables-pago",
        );
        setUsuariosResponsables(data.usuarios || []);
      } catch (error) {
        console.error("Error cargando responsables de pago:", error);
        setUsuariosResponsables([]);
      }
    };

    cargarResponsables();
  }, []);

  const guardarPagoEntrada = async (registroId, payload) => {
    try {
      setGuardandoPagoId(registroId);
      const { data } = await api.patch(
        `/api/contabilidad/control-financiero/registros/${registroId}/pago-entrada`,
        payload,
      );
      const registroActualizado = data.registro;
      setRegistros((actuales) => ({
        ...actuales,
        ventasTv: actuales.ventasTv.map((registro) =>
          registro.id === registroId ? registroActualizado : registro,
        ),
        ventasCelular: actuales.ventasCelular.map((registro) =>
          registro.id === registroId ? registroActualizado : registro,
        ),
      }));
      return registroActualizado;
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo guardar la gestion del pago."),
        "error",
      );
      throw error;
    } finally {
      setGuardandoPagoId(null);
    }
  };

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

  const reconciliarEntradas = async () => {
    if (!cargaSeleccionada?.id || reconciliandoEntradas) return;

    try {
      setReconciliandoEntradas(true);
      const { data } = await api.post(
        `/api/contabilidad/control-financiero/cargas/${cargaSeleccionada.id}/conciliacion-entradas/reconciliar`,
      );
      setConciliacionEntradas(data.conciliacion || null);
      setErrorConciliacion("");
      await Swal.fire(
        "Conciliación completada",
        "Se generó una nueva ejecución histórica sin modificar los valores declarados.",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo ejecutar la conciliación."),
        "error",
      );
    } finally {
      setReconciliandoEntradas(false);
    }
  };

  const revisarResultadoConciliacion = async (resultado) => {
    const candidatos = resultado.candidatosControl || [];
    const requiereConfirmacion = [
      "PENDIENTE_REVISION",
      "COINCIDENCIA_AMBIGUA",
    ].includes(resultado.estado);

    if (!requiereConfirmacion || !candidatos.length) {
      const contratos = (resultado.contratos || []).join(", ") || "Ninguno";
      await Swal.fire({
        title: "Evidencia de conciliación",
        icon: resultado.estado === "CUADRADO" ? "success" : "info",
        text: [
          `Caja: ${resultado.clienteCaja || "Sin registro"}`,
          `Control Financiero: ${
            resultado.clienteControl || "Sin coincidencia confirmada"
          }`,
          `Contratos: ${contratos}`,
          `Declarado: ${money.format(Number(resultado.entradaCaja || 0))}`,
          `Real: ${money.format(Number(resultado.entradaReal || 0))}`,
          `Diferencia: ${money.format(Number(resultado.diferencia || 0))}`,
        ].join("\n"),
        confirmButtonText: "Cerrar",
        confirmButtonColor: "#16a34a",
      });
      return;
    }

    const opciones = Object.fromEntries(
      candidatos.map((candidato) => [
        candidato.clienteControlNormalizado,
        `${candidato.clienteControl || "Cliente sin nombre"} · ${
          (candidato.contratos || []).join(", ") || "sin contrato"
        } · ${money.format(Number(candidato.entradaReal || 0))}`,
      ]),
    );
    const seleccion = await Swal.fire({
      title: "Revisar coincidencia",
      text: `Cliente declarado: ${resultado.clienteCaja || "-"}`,
      icon: "warning",
      input: "select",
      inputOptions: opciones,
      inputPlaceholder: "Selecciona el cliente verificado",
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      inputValidator: (value) =>
        value ? undefined : "Selecciona una coincidencia.",
    });
    if (!seleccion.isConfirmed) return;

    const candidato = candidatos.find(
      (item) =>
        item.clienteControlNormalizado === seleccion.value,
    );
    const confirmacion = await Swal.fire({
      title: "Confirmar coincidencia manual",
      text: `${resultado.clienteCaja || "-"} ↔ ${
        candidato?.clienteControl || "-"
      }. Esta decisión quedará como evidencia histórica.`,
      icon: "question",
      input: "textarea",
      inputLabel: "Observación de revisión (opcional)",
      inputAttributes: { maxlength: "1000" },
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    });
    if (!confirmacion.isConfirmed) return;

    try {
      setRevisandoConciliacionId(resultado.id);
      const { data } = await api.post(
        `/api/contabilidad/control-financiero/cargas/${cargaSeleccionada.id}/conciliacion-entradas/${resultado.id}/confirmar`,
        {
          clienteControlNormalizado: seleccion.value,
          observacion: String(confirmacion.value || "").trim(),
        },
      );
      setConciliacionEntradas(data.conciliacion || null);
      setErrorConciliacion("");
      await Swal.fire(
        "Coincidencia confirmada",
        "Se creó una nueva ejecución de conciliación con la revisión manual.",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo confirmar la coincidencia."),
        "error",
      );
    } finally {
      setRevisandoConciliacionId(null);
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

  const aplicarPeriodoRapido = (periodo) => {
    const rango = obtenerRangoPeriodo(periodo);
    const nuevosFiltros = { ...filtros, ...rango };
    setFiltros(nuevosFiltros);
    setPagina(1);
    setFiltrosAplicados(nuevosFiltros);
  };

  const periodoRapidoActivo = PERIODOS_RAPIDOS.find(({ id }) => {
    const rango = obtenerRangoPeriodo(id);
    return (
      rango.fechaInicio === filtros.fechaInicio &&
      rango.fechaFin === filtros.fechaFin
    );
  })?.id;

  const resumenCaja = useMemo(
    () => crearResumenCaja(registros.caja || []),
    [registros.caja],
  );
  const modoConsolidado = Boolean(consolidadoVentas);
  const tabsVisibles = modoConsolidado
    ? tabs.filter(({ id }) =>
        ["ventasTv", "ventasCelular"].includes(id),
      )
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
        registro.estadoPagoEntrada,
        registro.responsablePagoEntrada?.nombre,
        registro.observacionPagoEntrada,
      ].some((value) =>
        String(value || "")
          .toLocaleLowerCase("es")
          .includes(termino),
      ),
    );
  }, [busqueda, registros, tabActivo]);

  const resultadosConciliacionVisibles = useMemo(() => {
    const resultados = conciliacionEntradas?.resultados || [];
    const termino = busqueda.trim().toLocaleLowerCase("es");
    if (!termino) return resultados;

    return resultados.filter((resultado) =>
      [
        resultado.clienteCaja,
        resultado.clienteControl,
        resultado.estado,
        resultado.tipoCoincidencia,
        ...(resultado.contratos || []),
        ...(resultado.candidatosControl || []).flatMap((candidato) => [
          candidato.clienteControl,
          ...(candidato.contratos || []),
        ]),
      ].some((value) =>
        String(value || "")
          .toLocaleLowerCase("es")
          .includes(termino),
      ),
    );
  }, [busqueda, conciliacionEntradas]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-green-700">
                <BarChart3 size={18} /> Contabilidad
              </p>
              <h1 className="mt-1 text-2xl font-bold ">Control financiero</h1>
              <p className="mt-1 text-sm ">
                Historial persistente de los reportes de caja y ventas procesados.
              </p>
            </div>

            <form
              onSubmit={aplicarFiltros}
              className="grid w-full gap-2 lg:w-auto"
            >
              <div
                className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
                aria-label="Periodos rapidos"
              >
                {PERIODOS_RAPIDOS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => aplicarPeriodoRapido(id)}
                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition sm:flex-none ${
                      periodoRapidoActivo === id
                        ? "bg-green-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-900"
                    }`}
                    aria-pressed={periodoRapidoActivo === id}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-[150px_150px_160px_auto] sm:items-end">
                <label className="grid gap-1 text-xs font-semibold ">
                  Reporte desde
                  <input
                    type="date"
                    max={fechaLocalIso(new Date())}
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
                <label className="grid gap-1 text-xs font-semibold ">
                  Reporte hasta
                  <input
                    type="date"
                    max={fechaLocalIso(new Date())}
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
                <label className="grid gap-1 text-xs font-semibold ">
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
              </div>
            </form>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <h2 className="font-semibold ">Cargas generadas</h2>
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
                className="rounded-lg border border-slate-200 p-2  disabled:opacity-40"
                aria-label="Página anterior"
              >
                <ChevronLeft size={17} />
              </button>
              <span className="text-sm ">
                {pagina} / {paginacion.totalPaginas}
              </span>
              <button
                type="button"
                disabled={pagina >= paginacion.totalPaginas || loadingCargas}
                onClick={() => setPagina((actual) => actual + 1)}
                className="rounded-lg border border-slate-200 p-2  disabled:opacity-40"
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
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cargas.map((carga) => {
                const activa = carga.id === cargaSeleccionada?.id;
                return (
                  <button
                    key={carga.id}
                    type="button"
                    onClick={() => cargarDetalle(carga.id)}
                    className={`min-w-0 rounded-lg border p-4 text-left transition ${
                      activa
                        ? "border-green-400 bg-green-50 ring-2 ring-green-100"
                        : "border-slate-200 hover:border-green-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className="truncate font-semibold ">
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
                    <p className="mt-2 text-sm ">
                      {carga.usuario?.nombre || "Usuario no disponible"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {carga.registrosCaja +
                        carga.registrosVentasTv +
                        carga.registrosVentasCelular}{" "}
                      registros
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          Number(carga.registrosVentasTv || 0) > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        TV: {Number(carga.registrosVentasTv || 0) > 0
                          ? `cargado (${carga.registrosVentasTv})`
                          : "faltante"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          Number(carga.registrosVentasCelular || 0) > 0
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        Celular: {Number(carga.registrosVentasCelular || 0) > 0
                          ? `cargado (${carga.registrosVentasCelular})`
                          : "faltante"}
                      </span>
                    </div>
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
                    <h2 className="truncate font-semibold ">
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
                  {tabActivo !== "conciliacionEntradas" && (
                    <button
                      type="button"
                      onClick={exportarSeccionExcel}
                      disabled={
                        exportandoExcel || !(registros[tabActivo]?.length > 0)
                      }
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaFileExcel size={17} />
                      {exportandoExcel ? "Generando..." : "Exportar"}
                    </button>
                  )}
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

              <div className="flex flex-wrap border-b border-slate-200 px-2 sm:px-4">
                {tabsVisibles.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTabActivo(id);
                      setBusqueda("");
                    }}
                    className={`inline-flex max-w-full items-center gap-2 border-b-2 px-3 py-3 text-left text-sm font-semibold ${
                      tabActivo === id
                        ? "border-green-500 text-green-700"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Icon size={17} />
                    {label} (
                    {id === "conciliacionEntradas"
                      ? conciliacionEntradas?.resultados?.length || 0
                      : registros[id]?.length || 0}
                    )
                  </button>
                ))}
              </div>

              {loadingDetalle ? (
                <p className="p-10 text-center text-sm text-slate-500">
                  Cargando detalle...
                </p>
              ) : (
                tabActivo === "conciliacionEntradas" ? (
                  <VistaConciliacionEntradas
                    conciliacion={conciliacionEntradas}
                    error={errorConciliacion}
                    resultados={resultadosConciliacionVisibles}
                    onRevisar={revisarResultadoConciliacion}
                    onReconciliar={reconciliarEntradas}
                    reconciliando={reconciliandoEntradas}
                    revisandoId={revisandoConciliacionId}
                  />
                ) : tabActivo === "caja" ? (
                  <VistaCaja
                    key={cargaSeleccionada?.id}
                    resumen={resumenCaja}
                    registros={registrosVisibles}
                  />
                ) : (
                  <TablaRegistros
                    tipo={tabActivo}
                    registros={registrosVisibles}
                    usuariosResponsables={usuariosResponsables}
                    onGuardarPago={guardarPagoEntrada}
                    guardandoPagoId={guardandoPagoId}
                    editable={
                      modoConsolidado || cargaSeleccionada?.estado === "ACTIVA"
                    }
                  />
                )
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
