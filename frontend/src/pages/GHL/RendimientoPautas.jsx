/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Filter,
  Megaphone,
  RefreshCcw,
  Search,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import api from "../../api/client";

const SIN_SOURCE_ID = "Sin Source ID";

const getTodayDate = () => new Date().toLocaleDateString("en-CA");

const getInitialFilters = () => {
  const today = getTodayDate();

  return {
    fechaInicio: today,
    fechaFin: today,
    sourceId: "",
    etapa: "",
  };
};

const inputClass =
  "h-9 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100";

const stageColorClasses = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-green-600",
  "bg-teal-500",
  "bg-orange-400",
  "bg-red-500",
  "bg-rose-600",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-lime-600",
  "bg-slate-500",
];

const getStageColorClass = (index) =>
  stageColorClasses[index % stageColorClasses.length];

const normalizeColumns = (columns = []) =>
  columns
    .map((column) => ({
      id: column.id || column.pipelineStageId || column.name,
      name: column.name || column.label || column.id || "Sin etapa",
    }))
    .filter((column) => column.id);

const getCellValue = (row, columnId) =>
  Number(row?.values?.[columnId] || 0);

const formatPercentage = (value) => `${Number(value || 0).toFixed(2)}%`;

const getErrorMessage = (error) => {
  if (error.response?.data?.code === "GHL_RATE_LIMITED") {
    return "HighLevel está temporalmente ocupado. Espera unos segundos; el sistema reutilizará la última información disponible.";
  }
  const responseMessage = error.response?.data?.message;
  if (responseMessage) return responseMessage;
  if (error.response?.status === 403) {
    return "No tienes permisos para consultar el rendimiento de pautas";
  }
  return "No se pudo cargar el rendimiento de pautas";
};

const getLeaders = (rows, field) => {
  if (!rows.length) return { labels: [], value: 0 };

  const maxValue = Math.max(...rows.map((row) => Number(row[field] || 0)));
  return {
    labels: rows
      .filter((row) => Number(row[field] || 0) === maxValue)
      .map((row) => row.label || row.sourceId || SIN_SOURCE_ID),
    value: maxValue,
  };
};

const formatLeaderNames = (labels) => {
  if (labels.length <= 2) return labels.join(" y ");
  return `${labels.slice(0, 2).join(", ")} y ${labels.length - 2} más`;
};

const getRowKey = (row) => row.sourceId || row.label || SIN_SOURCE_ID;

export default function RendimientoPautas() {
  const initialFilters = useMemo(() => getInitialFilters(), []);
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState(() => getInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const initialLoadStarted = useRef(false);

  const loadReport = useCallback(async (queryFilters) => {
    if (
      queryFilters.fechaInicio &&
      queryFilters.fechaFin &&
      queryFilters.fechaInicio > queryFilters.fechaFin
    ) {
      setError("La fecha de inicio no puede ser mayor que la fecha fin");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = Object.fromEntries(
        Object.entries(queryFilters).filter(([, value]) =>
          String(value || "").trim(),
        ),
      );
      const { data } = await api.get(
        "/api/ghl/dashboard/pautas/source-id",
        { params },
      );

      setReport(data || null);
      setAppliedFilters(queryFilters);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    loadReport(initialFilters);
  }, [initialFilters, loadReport]);

  const columns = useMemo(
    () => normalizeColumns(report?.columns),
    [report?.columns],
  );
  const rows = useMemo(() => report?.rows || [], [report?.rows]);
  const totals = report?.totals || {
    values: {},
    total: 0,
    aplicanTotal: 0,
    noAplicanTotal: 0,
    noContestaTotal: 0,
    tasaAplicacion: 0,
  };

  const leaders = useMemo(
    () => ({
      applications: getLeaders(rows, "aplicanTotal"),
      applicationRate: getLeaders(rows, "tasaAplicacion"),
      noAnswer: getLeaders(rows, "noContestaTotal"),
      volume: getLeaders(rows, "total"),
    }),
    [rows],
  );

  const bestRate = leaders.applicationRate.value;
  const maxNoAnswer = leaders.noAnswer.value;
  const tableMinWidth = Math.max(1180, columns.length * 120 + 760);
  const hasChangedFilters = Object.keys(initialFilters).some(
    (key) =>
      filters[key] !== initialFilters[key] ||
      appliedFilters[key] !== initialFilters[key],
  );
  const appliedDateLabel = `${appliedFilters.fechaInicio || "Inicio"} - ${
    appliedFilters.fechaFin || "Hoy"
  }`;

  const updateFilter = (field, value) => {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    const cleanFilters = getInitialFilters();
    setFilters(cleanFilters);
    loadReport(cleanFilters);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-green-700">
            <Megaphone size={17} />
            GHL
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Rendimiento de pautas
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Análisis de oportunidades por Source ID y etapa del pipeline
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-400">
            {report?.meta?.pipelineName || "Pipeline configurado"} |{" "}
            {appliedDateLabel}
          </p>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => loadReport(filters)}
          disabled={loading}
        >
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      <section className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric
          label="Total oportunidades"
          value={totals.total || 0}
          icon={<BarChart3 size={18} />}
          accentClass="text-blue-600"
        />
        <Metric
          label="Source ID detectados"
          value={report?.meta?.sourceIdCount || 0}
          icon={<Megaphone size={18} />}
          accentClass="text-violet-600"
        />
        <Metric
          label="Aplican"
          value={totals.aplicanTotal || 0}
          icon={<CheckCircle2 size={18} />}
          accentClass="text-emerald-600"
        />
        <Metric
          label="No aplican"
          value={totals.noAplicanTotal || 0}
          icon={<XCircle size={18} />}
          accentClass="text-red-600"
        />
        <Metric
          label="No contestan"
          value={totals.noContestaTotal || 0}
          icon={<AlertTriangle size={18} />}
          accentClass="text-orange-600"
        />
        <Metric
          label="Tasa de aplicación"
          value={formatPercentage(totals.tasaAplicacion)}
          icon={<Sparkles size={18} />}
          accentClass="text-green-600"
        />
      </section>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {report?.meta?.cache?.stale && (
        <div className="mb-4 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          <AlertTriangle size={18} />
          <span>
            HighLevel está temporalmente ocupado. Se muestra la última
            información disponible.
          </span>
        </div>
      )}

      <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Filter size={17} />
          Filtros
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="Fecha inicio">
            <input
              type="date"
              className={inputClass}
              value={filters.fechaInicio}
              onChange={(event) =>
                updateFilter("fechaInicio", event.target.value)
              }
            />
          </Field>

          <Field label="Fecha fin">
            <input
              type="date"
              className={inputClass}
              value={filters.fechaFin}
              onChange={(event) => updateFilter("fechaFin", event.target.value)}
            />
          </Field>

          <Field label="Buscar Source ID" className="xl:col-span-2">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                className={`${inputClass} pl-9`}
                value={filters.sourceId}
                onChange={(event) => updateFilter("sourceId", event.target.value)}
                placeholder="Source ID o Sin Source ID"
              />
            </div>
          </Field>

          <Field label="Etapa">
            <select
              className={inputClass}
              value={filters.etapa}
              onChange={(event) => updateFilter("etapa", event.target.value)}
            >
              <option value="">Todas</option>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end gap-2">
            <button
              type="button"
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded bg-green-600 px-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => loadReport(filters)}
              disabled={loading}
            >
              <Search size={16} />
              Consultar
            </button>
            <button
              type="button"
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded border border-gray-300 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={clearFilters}
              disabled={loading || !hasChangedFilters}
            >
              <X size={16} />
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Distribución por Source ID
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Todas las etapas reales del pipeline en una barra apilada
            </p>
          </div>
          <ChartLegend columns={columns} />
        </div>

        {loading && !report ? (
          <EmptyState message="Cargando oportunidades..." />
        ) : rows.length === 0 ? (
          <EmptyState message="No hay oportunidades con los filtros seleccionados" />
        ) : (
          <div className="max-h-[560px] space-y-4 overflow-y-auto pr-1">
            {rows.map((row) => (
              <StackedBarRow
                key={getRowKey(row)}
                row={row}
                columns={columns}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={18} className="text-green-600" />
          <h2 className="text-sm font-bold text-gray-900">Resumen clave</h2>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">
            Consulta un rango con resultados para generar el resumen.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SummaryItem
              label="Mayor cantidad de aplicaciones"
              text={`${formatLeaderNames(leaders.applications.labels)} registra${
                leaders.applications.labels.length > 1 ? "n" : ""
              } ${leaders.applications.value} aplicaciones.`}
            />
            <SummaryItem
              label="Mejor tasa de aplicación"
              text={`${formatLeaderNames(
                leaders.applicationRate.labels,
              )} alcanza${
                leaders.applicationRate.labels.length > 1 ? "n" : ""
              } ${formatPercentage(leaders.applicationRate.value)}.`}
            />
            <SummaryItem
              label="Mayor cantidad de No contesta"
              text={`${formatLeaderNames(leaders.noAnswer.labels)} registra${
                leaders.noAnswer.labels.length > 1 ? "n" : ""
              } ${leaders.noAnswer.value} oportunidades sin respuesta.`}
            />
            <SummaryItem
              label="Mayor volumen total"
              text={`${formatLeaderNames(leaders.volume.labels)} concentra${
                leaders.volume.labels.length > 1 ? "n" : ""
              } ${leaders.volume.value} oportunidades.`}
            />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">
              Detalle por etapa del pipeline
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Todas las etapas se mantienen visibles, incluso con valor cero.
            </p>
          </div>
          {report?.meta?.generatedAt && (
            <span className="text-xs font-semibold text-gray-500">
              Actualizado{" "}
              {new Date(report.meta.generatedAt).toLocaleString("es-EC")}
            </span>
          )}
        </div>

        <div className="max-h-[660px] max-w-full overflow-auto">
          <table
            className="w-full border-collapse text-sm"
            style={{ minWidth: `${tableMinWidth}px` }}
          >
            <thead className="sticky top-0 z-10 bg-gray-100 text-left text-xs uppercase text-gray-600 shadow-sm">
              <tr>
                <th className="border-b border-gray-200 px-3 py-3">
                  Source ID
                </th>
                <NumericHeader label="Total" />
                <NumericHeader label="Aplican" />
                <NumericHeader label="No aplican" />
                <NumericHeader label="No contesta" />
                <NumericHeader label="% aplica" />
                <NumericHeader label="% no contesta" />
                {columns.map((column) => (
                  <NumericHeader key={column.id} label={column.name} />
                ))}
              </tr>
            </thead>

            <tbody>
              {loading && !report ? (
                <tr>
                  <td
                    colSpan={columns.length + 7}
                    className="px-3 py-10 text-center text-gray-500"
                  >
                    Cargando oportunidades...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 7}
                    className="px-3 py-10 text-center text-gray-500"
                  >
                    No hay datos para mostrar
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isBestRate =
                    bestRate > 0 &&
                    Number(row.tasaAplicacion || 0) === bestRate;
                  const isMaxNoAnswer =
                    maxNoAnswer > 0 &&
                    Number(row.noContestaTotal || 0) === maxNoAnswer;
                  const highlightClass = isBestRate
                    ? "bg-emerald-50/80"
                    : isMaxNoAnswer
                      ? "bg-orange-50/80"
                      : "hover:bg-gray-50";

                  return (
                    <tr
                      key={getRowKey(row)}
                      className={`border-b border-gray-100 ${highlightClass}`}
                    >
                      <td className="px-3 py-3 font-semibold text-gray-900">
                        <div className="max-w-64 break-all">
                          {row.sourceId === SIN_SOURCE_ID ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                              Sin Source ID
                            </span>
                          ) : (
                            row.label || row.sourceId
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {isBestRate && (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                              Mejor tasa
                            </span>
                          )}
                          {isMaxNoAnswer && (
                            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700">
                              Más no contesta
                            </span>
                          )}
                        </div>
                      </td>
                      <NumericCell value={row.total} bold />
                      <NumericCell value={row.aplicanTotal} />
                      <NumericCell value={row.noAplicanTotal} />
                      <NumericCell value={row.noContestaTotal} />
                      <NumericCell value={formatPercentage(row.tasaAplicacion)} />
                      <NumericCell value={formatPercentage(row.tasaNoContesta)} />
                      {columns.map((column) => (
                        <NumericCell
                          key={column.id}
                          value={getCellValue(row, column.id)}
                        />
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>

            <tfoot className="sticky bottom-0 z-10 bg-gray-100 shadow-[0_-1px_3px_rgba(0,0,0,0.08)]">
              <tr>
                <td className="px-3 py-3 font-bold text-gray-900">Total</td>
                <NumericCell value={totals.total} bold />
                <NumericCell value={totals.aplicanTotal} bold />
                <NumericCell value={totals.noAplicanTotal} bold />
                <NumericCell value={totals.noContestaTotal} bold />
                <NumericCell
                  value={formatPercentage(totals.tasaAplicacion)}
                  bold
                />
                <NumericCell
                  value={formatPercentage(totals.tasaNoContesta)}
                  bold
                />
                {columns.map((column) => (
                  <NumericCell
                    key={column.id}
                    value={Number(totals.values?.[column.id] || 0)}
                    bold
                  />
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({ label, value, icon, accentClass }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase text-gray-500">
          {label}
        </span>
        <span className={accentClass}>{icon}</span>
      </div>
      <div className="mt-2 text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function ChartLegend({ columns }) {
  return (
    <div className="flex max-w-4xl flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-gray-600">
      {columns.map((column, index) => (
        <span key={column.id} className="inline-flex items-center gap-1.5">
          <span
            className={`h-2.5 w-2.5 rounded-sm ${getStageColorClass(index)}`}
          />
          {column.name}
        </span>
      ))}
    </div>
  );
}

function StackedBarRow({ row, columns }) {
  const total = Number(row.total || 0);
  const parts = columns.map((column, index) => ({
    key: column.id,
    label: column.name,
    value: getCellValue(row, column.id),
    colorClass: getStageColorClass(index),
  }));

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,240px)_1fr] md:items-center">
      <div className="min-w-0">
        <div className="break-all text-sm font-bold text-gray-800">
          {row.sourceId === SIN_SOURCE_ID ? (
            <span className="text-amber-700">Sin Source ID</span>
          ) : (
            row.label || row.sourceId
          )}
        </div>
        <div className="text-xs font-semibold text-gray-500">
          Total: {total}
        </div>
      </div>

      <div>
        <div className="flex h-8 w-full overflow-hidden rounded bg-gray-100">
          {parts.map((part) => {
            const percentage = total ? (part.value / total) * 100 : 0;

            return (
              <div
                key={part.key}
                className={`flex items-center justify-center overflow-hidden text-xs font-bold text-white transition-all ${part.colorClass}`}
                style={{ width: `${percentage}%` }}
                title={`${part.label}: ${part.value}`}
              >
                {percentage >= 8 ? part.value : ""}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-500">
          {parts.filter((part) => part.value > 0).map((part) => (
            <span key={part.key}>
              {part.label}: {part.value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, text }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-bold uppercase text-gray-500">{label}</div>
      <p className="mt-1 break-words text-sm font-semibold text-gray-800">
        {text}
      </p>
    </div>
  );
}

function NumericHeader({ label }) {
  return (
    <th className="whitespace-nowrap border-b border-gray-200 px-3 py-3 text-right">
      {label}
    </th>
  );
}

function NumericCell({ value, bold = false }) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-3 text-right tabular-nums text-gray-700 ${
        bold ? "font-bold text-gray-900" : ""
      }`}
    >
      {value ?? 0}
    </td>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm font-semibold text-gray-500">
      {message}
    </div>
  );
}
