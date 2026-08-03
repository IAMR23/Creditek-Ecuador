import { useEffect, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { api } from "../../api/client";

const EMPTY_FILTERS = {
  fechaDesde: "",
  fechaHasta: "",
};
const DASHBOARD_FILTERS_STORAGE_KEY = "abs:dashboard:date-filter:v1";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const EMPTY_METRICS = {
  postulaciones: 0,
  entrevistas: 0,
  descartados: 0,
  conTitulo: 0,
  estudiando: 0,
  totalPeriodo: 0,
};

const PERIOD_OPTIONS = [
  { key: "todo", label: "Todo" },
  { key: "hoy", label: "Hoy" },
  { key: "7-dias", label: "Últimos 7 días" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "rango", label: "Rango personalizado" },
];

const cards = [
  {
    key: "postulaciones",
    title: "En postulaciones",
    description: "Postulantes en revisión inicial",
    icon: FileText,
    iconClass: "text-orange-600",
    iconBg: "bg-orange-50",
    accent: "border-t-orange-500",
  },
  {
    key: "entrevistas",
    title: "En entrevistas",
    description: "Postulantes en fase de entrevista",
    icon: UserCheck,
    iconClass: "text-emerald-600",
    iconBg: "bg-emerald-50",
    accent: "border-t-emerald-500",
  },
  {
    key: "descartados",
    title: "Descartados",
    description: "Postulantes descartados",
    icon: Archive,
    iconClass: "text-slate-600",
    iconBg: "bg-slate-100",
    accent: "border-t-slate-500",
  },
  {
    key: "conTitulo",
    title: "Con título",
    description: "Personas con título de tercer nivel",
    icon: GraduationCap,
    iconClass: "text-blue-600",
    iconBg: "bg-blue-50",
    accent: "border-t-blue-500",
  },
  {
    key: "estudiando",
    title: "Estudiando",
    description: "Personas que estudian actualmente",
    icon: BookOpen,
    iconClass: "text-violet-600",
    iconBg: "bg-violet-50",
    accent: "border-t-violet-500",
  },
];

const numberFormatter = new Intl.NumberFormat("es-EC");

const getGuayaquilToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
};

const addDays = (value, days) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const getPresetRange = (period) => {
  const today = getGuayaquilToday();

  if (period === "hoy") return { fechaDesde: today, fechaHasta: today };
  if (period === "7-dias") {
    return { fechaDesde: addDays(today, -6), fechaHasta: today };
  }
  if (period === "semana") {
    const [year, month, day] = today.split("-").map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    return { fechaDesde: addDays(today, -daysSinceMonday), fechaHasta: today };
  }
  if (period === "mes") {
    return { fechaDesde: `${today.slice(0, 7)}-01`, fechaHasta: today };
  }

  return EMPTY_FILTERS;
};

const getStoredSelection = () => {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(DASHBOARD_FILTERS_STORAGE_KEY) || "null",
    );
    const validPeriods = new Set(PERIOD_OPTIONS.map(({ key }) => key));
    const period = validPeriods.has(stored?.period) ? stored.period : "todo";

    if (period === "rango") {
      return {
        period,
        filters: {
          fechaDesde: DATE_ONLY_PATTERN.test(stored?.fechaDesde)
            ? stored.fechaDesde
            : "",
          fechaHasta: DATE_ONLY_PATTERN.test(stored?.fechaHasta)
            ? stored.fechaHasta
            : "",
        },
      };
    }

    return {
      period,
      filters: getPresetRange(period),
    };
  } catch {
    return { period: "todo", filters: EMPTY_FILTERS };
  }
};

const formatDate = (value) => {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(
    new Date(year, month - 1, day),
  );
};

const getPeriodLabel = ({ fechaDesde, fechaHasta }) => {
  if (fechaDesde && fechaHasta) {
    return `Postulaciones registradas del ${formatDate(fechaDesde)} al ${formatDate(fechaHasta)}`;
  }
  if (fechaDesde) return `Postulaciones registradas desde el ${formatDate(fechaDesde)}`;
  if (fechaHasta) return `Postulaciones registradas hasta el ${formatDate(fechaHasta)}`;
  return "Histórico completo de postulaciones";
};

function StageDonut({ metrics, loading }) {
  const items = [
    { key: "postulaciones", label: "Postulaciones", strokeClass: "stroke-orange-500", dotClass: "bg-orange-500" },
    { key: "entrevistas", label: "Entrevistas", strokeClass: "stroke-emerald-500", dotClass: "bg-emerald-500" },
    { key: "descartados", label: "Descartados", strokeClass: "stroke-slate-500", dotClass: "bg-slate-500" },
  ];
  const total = loading
    ? 0
    : items.reduce((sum, { key }) => sum + (metrics[key] || 0), 0);
  let accumulated = 0;
  const segments = items.map((item) => {
    const percentage = total ? ((metrics[item.key] || 0) / total) * 100 : 0;
    const segment = { ...item, percentage, offset: accumulated };
    accumulated += percentage;
    return segment;
  });

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-extrabold text-slate-900">Distribución por etapa</h2>
        <p className="mt-1 text-xs text-slate-500">
          Participación de postulaciones, entrevistas y descartados
        </p>
      </div>

      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[minmax(0,240px)_1fr]">
        <svg
          viewBox="0 0 120 120"
          className="mx-auto h-56 w-56 max-w-full"
          role="img"
          aria-label={`Distribución por etapa, ${numberFormatter.format(total)} personas`}
        >
          <title>Distribución circular por etapa</title>
          <desc>Postulaciones, entrevistas y descartados del período seleccionado.</desc>
          <circle cx="60" cy="60" r="45" fill="none" strokeWidth="15" className="stroke-slate-100" />
          {segments.map(({ key, percentage, offset, strokeClass }) => (
            <circle
              key={key}
              cx="60"
              cy="60"
              r="45"
              fill="none"
              pathLength="100"
              strokeWidth="15"
              strokeDasharray={`${percentage} ${100 - percentage}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
              className={strokeClass}
            />
          ))}
          <text x="60" y="58" textAnchor="middle" className="fill-slate-950 text-[15px] font-extrabold">
            {loading ? "—" : numberFormatter.format(total)}
          </text>
          <text x="60" y="72" textAnchor="middle" className="fill-slate-500 text-[6px] font-semibold">
            PERSONAS
          </text>
        </svg>

        <div className="space-y-3">
          {items.map(({ key, label, dotClass }) => {
            const value = metrics[key] || 0;
            const percentage = total ? Math.round((value / total) * 100) : 0;

            return (
              <div key={key} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className={`h-3 w-3 rounded-full ${dotClass}`} aria-hidden="true" />
                  {label}
                </span>
                <span className="text-right text-sm font-extrabold tabular-nums text-slate-950">
                  {loading ? "—" : numberFormatter.format(value)}
                  <span className="ml-1 text-xs font-semibold text-slate-500">({percentage}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function AcademicDonut({ label, value, total, strokeClass, loading }) {
  const percentage = !loading && total ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div className="text-center">
      <svg
        viewBox="0 0 120 120"
        className="mx-auto h-48 w-48 max-w-full"
        role="img"
        aria-label={`${label}: ${numberFormatter.format(value)} de ${numberFormatter.format(total)} personas`}
      >
        <title>{label}</title>
        <circle cx="60" cy="60" r="43" fill="none" strokeWidth="13" className="stroke-slate-100" />
        <circle
          cx="60"
          cy="60"
          r="43"
          fill="none"
          pathLength="100"
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${percentage} ${100 - percentage}`}
          transform="rotate(-90 60 60)"
          className={strokeClass}
        />
        <text x="60" y="57" textAnchor="middle" className="fill-slate-950 text-[14px] font-extrabold">
          {loading ? "—" : numberFormatter.format(value)}
        </text>
        <text x="60" y="71" textAnchor="middle" className="fill-slate-500 text-[7px] font-bold">
          {loading ? "" : `${Math.round(percentage)}%`}
        </text>
      </svg>
      <h3 className="mt-2 text-sm font-extrabold text-slate-800">{label}</h3>
      <p className="mt-1 text-xs text-slate-500">
        de {loading ? "—" : numberFormatter.format(total)} postulaciones del período
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [initialSelection] = useState(getStoredSelection);
  const [filters, setFilters] = useState(initialSelection.filters);
  const [period, setPeriod] = useState(initialSelection.period);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const requestIdRef = useRef(0);
  const dateFromRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        DASHBOARD_FILTERS_STORAGE_KEY,
        JSON.stringify({ period, ...filters }),
      );
    } catch {
      // El dashboard sigue funcionando si el navegador bloquea localStorage.
    }
  }, [filters, period]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/api/postulaciones/dashboard", {
          params: {
            fechaDesde: filters.fechaDesde || undefined,
            fechaHasta: filters.fechaHasta || undefined,
          },
        });

        if (requestId !== requestIdRef.current) return;
        setMetrics({ ...EMPTY_METRICS, ...(response.data?.data || {}) });
      } catch (requestError) {
        if (requestId !== requestIdRef.current) return;
        setMetrics(EMPTY_METRICS);
        setError(
          requestError.response?.data?.message ||
            "No se pudieron cargar los indicadores del dashboard.",
        );
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [filters, refreshToken]);

  const updateFilter = (key) => (event) => {
    setPeriod("rango");
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  };

  const selectPeriod = (nextPeriod) => {
    setPeriod(nextPeriod);

    if (nextPeriod === "rango") {
      dateFromRef.current?.focus();
      return;
    }

    setFilters(getPresetRange(nextPeriod));
  };

  const clearFilters = () => {
    setPeriod("todo");
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600">
          Desarrollo Organizacional
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
          Dashboard de postulaciones
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Consulta el estado general y el perfil académico de los postulantes.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <CalendarDays size={18} className="text-orange-500" aria-hidden="true" />
              Filtrar por fecha de postulación
            </div>
            <p className="mt-1 text-xs text-slate-500">{getPeriodLabel(filters)}</p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Períodos rápidos">
            {PERIOD_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={period === key}
                onClick={() => selectPeriod(key)}
                className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-extrabold transition ${
                  period === key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-[680px] lg:grid-cols-[1fr_1fr_auto]">
            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Desde</span>
              <input
                ref={dateFromRef}
                type="date"
                value={filters.fechaDesde}
                max={filters.fechaHasta || undefined}
                onChange={updateFilter("fechaDesde")}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Hasta</span>
              <input
                type="date"
                value={filters.fechaHasta}
                min={filters.fechaDesde || undefined}
                onChange={updateFilter("fechaHasta")}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <button
              type="button"
              onClick={clearFilters}
              disabled={loading || (!filters.fechaDesde && !filters.fechaHasta)}
              className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 lg:col-span-1"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Limpiar
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-5 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshToken((current) => current + 1)}
            className="text-left font-extrabold underline sm:text-right"
          >
            Reintentar
          </button>
        </div>
      )}

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-live="polite">
        {cards.map(({ key, title, description, icon: Icon, iconClass, iconBg, accent }) => (
          <article
            key={key}
            className={`rounded-2xl border border-t-4 border-slate-200 ${accent} bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
              <Icon size={23} className={iconClass} aria-hidden="true" />
            </div>
            <p className="mt-5 text-3xl font-extrabold leading-none text-slate-950">
              {loading ? "—" : numberFormatter.format(metrics[key] ?? 0)}
            </p>
            <h2 className="mt-3 text-sm font-extrabold text-slate-800">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2" aria-label="Diagramas circulares del dashboard">
        <StageDonut metrics={metrics} loading={loading} />
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Perfil académico</h2>
            <p className="mt-1 text-xs text-slate-500">
              Porcentaje respecto al total registrado en el período
            </p>
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <AcademicDonut
              label="Con título"
              value={metrics.conTitulo}
              total={metrics.totalPeriodo}
              strokeClass="stroke-blue-500"
              loading={loading}
            />
            <AcademicDonut
              label="Estudiando actualmente"
              value={metrics.estudiando}
              total={metrics.totalPeriodo}
              strokeClass="stroke-violet-500"
              loading={loading}
            />
          </div>
        </article>
      </section>

      <p className="mt-4 text-xs text-slate-500">
        Los indicadores se calculan con la fecha en que se registró cada postulación.
      </p>
    </div>
  );
}
