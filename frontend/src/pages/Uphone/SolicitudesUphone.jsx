/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleX,
  ClipboardList,
  Download,
  FileSpreadsheet,
  List,
  PhoneOff,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  UploadCloud,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Select from "react-select";
import Swal from "sweetalert2";

import api from "../../api/client";

const EMPTY_FILTERS = {
  q: "",
  estado: "",
  fechaDesde: "",
  fechaHasta: "",
  usuariosUphone: [],
  agencia: "",
  preset: "all",
};

const EMPTY_DASHBOARD = {
  totalSolicitudes: 0,
  totalAprobadas: 0,
  totalConcretadas: 0,
  totalDenegadas: 0,
  totalInvalidadas: 0,
  totalOtros: 0,
  estados: [],
  agencias: [],
  agenciaLider: null,
  vendedores: [],
  telefonos099999: {
    patron: "099999*",
    cantidad: 0,
    total: 0,
    porcentaje: 0,
    agencias: [],
    vendedores: [],
  },
  usuarios: [],
  agenciasDisponibles: [],
  periodo: null,
};

const normalizarClaveUphone = (valor) => String(valor || "").trim().toUpperCase();

const normalizarVendedoresSolicitudes = (solicitudes = [], usuarios = []) => {
  const nombresPorClave = new Map(
    usuarios
      .map((usuario) => [
        normalizarClaveUphone(usuario.usuarioUphone),
        String(usuario.nombre || "").trim(),
      ])
      .filter(([clave, nombre]) => clave && nombre),
  );

  return solicitudes.map((solicitud) => ({
    ...solicitud,
    vendedor:
      nombresPorClave.get(normalizarClaveUphone(solicitud.usuario))
      || solicitud.vendedor,
  }));
};

const DASHBOARD_PRESETS = [
  { value: "today", label: "Hoy" },
  { value: "last7", label: "Últimos 7 días" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "year", label: "Este año" },
];

const SOLICITUD_PRESETS = [
  { value: "all", label: "Todos" },
  ...DASHBOARD_PRESETS,
];

const numberFormatter = new Intl.NumberFormat("es-EC");

const getTodayInEcuador = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valueByType = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
};

const shiftIsoDate = (isoDate, days) => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const createDashboardFilters = (preset = "today", usuariosUphone = [], agencia = "") => {
  const today = getTodayInEcuador();
  let fechaDesde = today;
  if (preset === "last7") fechaDesde = shiftIsoDate(today, -6);
  if (preset === "week") {
    const day = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    fechaDesde = shiftIsoDate(today, -(day === 0 ? 6 : day - 1));
  }
  if (preset === "month") fechaDesde = `${today.slice(0, 7)}-01`;
  if (preset === "year") fechaDesde = `${today.slice(0, 4)}-01-01`;
  return { preset, fechaDesde, fechaHasta: today, usuariosUphone, agencia };
};

const createSolicitudFilters = (preset = "all", usuariosUphone = [], agencia = "") => {
  if (preset === "all") {
    return { ...EMPTY_FILTERS, preset, usuariosUphone, agencia };
  }
  return {
    ...EMPTY_FILTERS,
    ...createDashboardFilters(preset, usuariosUphone, agencia),
  };
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  }).format(date);
};

const formatStatus = (value) => String(value || "").replaceAll("_", " ");

const StatusBadge = ({ children, tone = "slate" }) => {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20",
    slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  };
  return (
    <span className={`inline-flex max-w-full justify-center break-words rounded-full px-2 py-1 text-center text-[10px] font-semibold leading-4 ring-1 ring-inset ${tones[tone]}`}>
      {children || "Sin estado"}
    </span>
  );
};

const estadoTone = (value) => {
  const normalized = String(value || "").toUpperCase();
  if (normalized.includes("APROBAD")) return "green";
  if (normalized.includes("RECHAZ") || normalized.includes("ANUL") || normalized.includes("INVALID")) return "red";
  if (normalized.includes("PEND")) return "amber";
  return "slate";
};

const statusBarClass = (value) => {
  const tone = estadoTone(value);
  if (tone === "green") return "bg-emerald-500";
  if (tone === "red") return "bg-rose-500";
  if (tone === "amber") return "bg-amber-500";
  return "bg-slate-500";
};

const MULTI_SELECT_STYLES = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    borderColor: state.isFocused ? "#14b8a6" : "#cbd5e1",
    boxShadow: state.isFocused ? "0 0 0 2px #ccfbf1" : "none",
    fontSize: 14,
    ":hover": { borderColor: state.isFocused ? "#14b8a6" : "#94a3b8" },
  }),
  multiValue: (base) => ({ ...base, borderRadius: 6, backgroundColor: "#ccfbf1" }),
  multiValueLabel: (base) => ({ ...base, color: "#0f766e" }),
  multiValueRemove: (base) => ({
    ...base,
    color: "#0f766e",
    ":hover": { backgroundColor: "#99f6e4", color: "#115e59" },
  }),
  menu: (base) => ({ ...base, zIndex: 30 }),
};

const UserMultiSelect = ({ users, selected, onChange, inputId }) => {
  const options = users.map((user) => ({
    value: user.usuarioUphone,
    label: `${user.nombre} · ${user.usuarioUphone}`,
  }));
  return (
    <Select
      inputId={inputId}
      isMulti
      isClearable
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      options={options}
      value={options.filter((option) => selected.includes(option.value))}
      onChange={(selection) => onChange((selection || []).map((option) => option.value))}
      placeholder="Todos los usuarios"
      noOptionsMessage={() => "Sin usuarios disponibles"}
      styles={MULTI_SELECT_STYLES}
    />
  );
};

const DashboardDateFilters = ({
  filters,
  onChange,
  onSubmit,
  onPreset,
  today,
  users,
  agencies,
}) => (
  <form
    onSubmit={onSubmit}
    className="space-y-4 rounded-xl border border-teal-200 bg-white p-4 shadow-sm"
  >
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-teal-50 p-2.5 text-teal-600"><CalendarDays size={21} /></span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Filtros del dashboard</h2>
          <p className="mt-0.5 text-xs text-slate-500">El periodo, las agencias y los usuarios se aplican a todos los indicadores y gráficas.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {DASHBOARD_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onPreset(preset.value)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
              filters.preset === preset.value
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(190px,0.8fr)_minmax(280px,1.2fr)_160px_160px_auto] xl:items-end">
      <label className="text-xs font-semibold text-slate-600">
        Agencia
        <select
          value={filters.agencia}
          onChange={(event) => onChange((current) => ({ ...current, agencia: event.target.value }))}
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        >
          <option value="">Todas las agencias</option>
          {agencies.map((agency) => <option key={agency} value={agency}>{agency}</option>)}
        </select>
      </label>
      <div className="text-xs font-semibold text-slate-600">
        <label htmlFor="dashboard-usuarios">Usuarios</label>
        <div className="mt-1">
          <UserMultiSelect
            inputId="dashboard-usuarios"
            users={users}
            selected={filters.usuariosUphone}
            onChange={(usuariosUphone) => onChange((current) => ({ ...current, usuariosUphone }))}
          />
        </div>
      </div>
      <label className="text-xs font-semibold text-slate-600">
        Desde
        <input
          type="date"
          required
          max={today}
          value={filters.fechaDesde}
          onChange={(event) => onChange((current) => ({ ...current, preset: "custom", fechaDesde: event.target.value }))}
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
      </label>
      <label className="text-xs font-semibold text-slate-600">
        Hasta
        <input
          type="date"
          required
          max={today}
          value={filters.fechaHasta}
          onChange={(event) => onChange((current) => ({ ...current, preset: "custom", fechaHasta: event.target.value }))}
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
      </label>
      <button
        type="submit"
        className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-700"
      >
        Aplicar filtros
      </button>
    </div>
  </form>
);

const DashboardPanel = ({ dashboard, loading }) => {
  const topAgencias = dashboard.agencias.slice(0, 8);
  const vendedores = dashboard.vendedores || [];
  const telefonos099999 = dashboard.telefonos099999 || EMPTY_DASHBOARD.telefonos099999;
  const total = dashboard.totalSolicitudes || 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500 shadow-sm">
        Cargando indicadores...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Solicitudes ingresadas</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{numberFormatter.format(total)}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {numberFormatter.format(Math.max(0, total - dashboard.totalInvalidadas))} válidas
              </p>
            </div>
            <span className="rounded-xl bg-teal-50 p-2.5 text-teal-600"><ClipboardList size={22} /></span>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Aprobadas</p>
              <p className="mt-2 text-3xl font-bold text-emerald-800">{numberFormatter.format(dashboard.totalAprobadas)}</p>
            </div>
            <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><CheckCircle2 size={22} /></span>
          </div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Denegadas</p>
              <p className="mt-2 text-3xl font-bold text-rose-800">{numberFormatter.format(dashboard.totalDenegadas)}</p>
            </div>
            <span className="rounded-xl bg-rose-100 p-2.5 text-rose-700"><CircleX size={22} /></span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Agencia con más solicitudes</p>
              <p className="mt-2 truncate text-lg font-bold text-slate-900" title={dashboard.agenciaLider?.agencia}>
                {dashboard.agenciaLider?.agencia || "Sin datos"}
              </p>
              <p className="text-sm font-semibold text-amber-700">
                {numberFormatter.format(dashboard.agenciaLider?.total || 0)} solicitudes
              </p>
            </div>
            <span className="shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700"><Trophy size={22} /></span>
          </div>
        </div>
        <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700">Teléfonos 099999…</p>
              <p className="mt-2 text-3xl font-bold text-fuchsia-900">
                {Number(telefonos099999.porcentaje || 0).toFixed(1)}%
              </p>
              <p className="mt-1 text-xs font-medium text-fuchsia-700">
                {numberFormatter.format(telefonos099999.cantidad || 0)} de {numberFormatter.format(telefonos099999.total || 0)}
              </p>
            </div>
            <span className="rounded-xl bg-fuchsia-100 p-2.5 text-fuchsia-700"><PhoneOff size={22} /></span>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-fuchsia-200 bg-white shadow-sm">
        <div className="border-b border-fuchsia-100 bg-fuchsia-50/50 px-4 py-4">
          <div className="flex items-center gap-2">
            <PhoneOff size={18} className="text-fuchsia-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Solicitudes con teléfono 099999…</h2>
              <p className="text-xs text-slate-600">
                Porcentaje de solicitudes cuyo teléfono, sin espacios ni símbolos, comienza con 099999.
              </p>
            </div>
          </div>
        </div>
        <div className="grid divide-y divide-slate-200 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
          {[
            { titulo: "Por agencia", filas: telefonos099999.agencias || [], vendedor: false },
            { titulo: "Por vendedor", filas: telefonos099999.vendedores || [], vendedor: true },
          ].map(({ titulo, filas, vendedor }) => (
            <div key={titulo} className="min-w-0">
              <h3 className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                {titulo}
              </h3>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[520px] divide-y divide-slate-200 text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">{vendedor ? "Vendedor" : "Agencia"}</th>
                      <th className="px-3 py-2.5 text-right">099999…</th>
                      <th className="px-3 py-2.5 text-right">Solicitudes</th>
                      <th className="px-4 py-2.5 text-right">Porcentaje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filas.length ? filas.map((item) => (
                      <tr key={`${titulo}-${item.usuarioId || item.usuarioUphone || item.nombre}`} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {item.nombre}
                          {vendedor && item.usuarioUphone && (
                            <p className="text-[11px] font-normal text-slate-500">
                              {item.usuarioUphone}{!item.vinculado ? " · Sin vínculo en RVE" : ""}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-fuchsia-700">
                          {numberFormatter.format(item.cantidad)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">
                          {numberFormatter.format(item.total)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="ml-auto w-28">
                            <div className="mb-1 text-right font-bold text-slate-800">
                              {Number(item.porcentaje || 0).toFixed(1)}%
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-fuchsia-500"
                                style={{ width: `${Math.min(100, Math.max(0, item.porcentaje || 0))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No hay datos para el periodo.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-teal-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Estado de las solicitudes</h2>
              <p className="text-xs text-slate-500">Distribución global según el estado reportado.</p>
            </div>
          </div>
          <div className="mt-5 max-h-[330px] space-y-4 overflow-y-auto pr-1">
            {dashboard.estados.length ? dashboard.estados.map((item) => {
              const percentage = total ? (item.cantidad / total) * 100 : 0;
              return (
                <div key={item.estado}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold text-slate-700" title={formatStatus(item.estado)}>{formatStatus(item.estado)}</span>
                    <span className="shrink-0 font-bold text-slate-900">
                      {numberFormatter.format(item.cantidad)} · {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${statusBarClass(item.estado)}`}
                      style={{ width: `${Math.max(percentage, percentage > 0 ? 1 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            }) : (
              <p className="py-12 text-center text-sm text-slate-500">Todavía no hay solicitudes para resumir.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-teal-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Aprobadas y denegadas por agencia</h2>
              <p className="text-xs text-slate-500">Comparativo de las ocho agencias con mayor volumen.</p>
            </div>
          </div>
          {topAgencias.length ? (
            <div className="mt-4 h-[330px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAgencias} margin={{ top: 10, right: 10, left: -15, bottom: 55 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="agencia"
                    angle={-25}
                    height={75}
                    interval={0}
                    textAnchor="end"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    tickFormatter={(value) => value.length > 18 ? `${value.slice(0, 18)}…` : value}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1", fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="aprobadas" name="Aprobadas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="denegadas" name="Denegadas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">Todavía no hay agencias para comparar.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-teal-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Clientes por vendedor</h2>
            <p className="text-xs text-slate-500">
              Solicitudes aprobadas y denegadas de clientes únicos, vinculadas con el usuario registrado en RVE.
            </p>
          </div>
        </div>
        {vendedores.length ? (
          <div className="mt-4 max-h-[560px] overflow-y-auto">
            <div style={{ height: `${Math.max(320, vendedores.length * 56)}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={vendedores}
                  layout="vertical"
                  margin={{ top: 5, right: 35, left: 15, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="vendedor"
                    width={145}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    tickFormatter={(value) => value.length > 22 ? `${value.slice(0, 22)}…` : value}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-lg">
                          <p className="font-bold text-slate-900">{item.vendedor}</p>
                          <p className="text-slate-500">Usuario Uphone: {item.usuarioUphone || "Sin asignar"}</p>
                          <p className="mt-1 font-semibold text-slate-700">{numberFormatter.format(item.clientes)} clientes únicos</p>
                          <p className="font-semibold text-emerald-700">{numberFormatter.format(item.aprobadas)} aprobadas</p>
                          <p className="font-semibold text-sky-700">{numberFormatter.format(item.concretadas)} concretadas</p>
                          <p className="font-semibold text-rose-700">{numberFormatter.format(item.denegadas)} denegadas</p>
                          {item.otros > 0 && (
                            <p className="font-semibold text-slate-500">{numberFormatter.format(item.otros)} en otros estados</p>
                          )}
                          {!item.vinculado && <p className="mt-1 text-amber-700">Usuario Uphone no vinculado en RVE</p>}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="aprobadas" name="Aprobadas" fill="#10b981" radius={[0, 5, 5, 0]} />
                  <Bar dataKey="denegadas" name="Denegadas" fill="#f43f5e" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-slate-500">No hay clientes por vendedor en el periodo seleccionado.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="text-sm font-bold text-slate-900">Cierre de ventas por vendedor</h2>
          <p className="text-xs text-slate-500">
            Una venta concretada conserva también su conteo como aprobada. El cierre se calcula sobre las aprobadas.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Usuario Uphone</th>
                <th className="px-4 py-3 text-right">Clientes</th>
                <th className="px-4 py-3 text-right">Aprobadas</th>
                <th className="px-4 py-3 text-right">Concretadas</th>
                <th className="px-4 py-3 text-right">% cierre</th>
                <th className="px-4 py-3 text-right">Denegadas</th>
                <th className="px-4 py-3 text-right">Otros estados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendedores.length ? vendedores.map((item) => (
                <tr key={item.usuarioId || item.usuarioUphone || item.vendedor} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {item.vendedor}
                    {!item.vinculado && <p className="text-[11px] font-medium text-amber-700">Sin vínculo en RVE</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.usuarioUphone || "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{numberFormatter.format(item.clientes)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{numberFormatter.format(item.aprobadas)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-sky-700">{numberFormatter.format(item.concretadas)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {item.aprobadas ? `${((item.concretadas / item.aprobadas) * 100).toFixed(1)}%` : "0.0%"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-700">{numberFormatter.format(item.denegadas)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{numberFormatter.format(item.otros)}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No hay datos por vendedor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4">
          <h2 className="text-sm font-bold text-slate-900">Detalle por agencia</h2>
          <p className="text-xs text-slate-500">
            Totales y cierre de cada agencia. Las concretadas continúan incluidas en aprobadas.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Agencia</th>
                <th className="px-4 py-3 text-right">Solicitudes</th>
                <th className="px-4 py-3 text-right">Aprobadas</th>
                <th className="px-4 py-3 text-right">Concretadas</th>
                <th className="px-4 py-3 text-right">% cierre</th>
                <th className="px-4 py-3 text-right">Denegadas</th>
                <th className="px-4 py-3 text-right">Invalidadas</th>
                <th className="px-4 py-3 text-right">Otros estados</th>
                <th className="px-4 py-3 text-right">% aprobación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dashboard.agencias.length ? dashboard.agencias.map((item) => (
                <tr key={item.agencia} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-800">{item.agencia}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{numberFormatter.format(item.total)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{numberFormatter.format(item.aprobadas)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-sky-700">{numberFormatter.format(item.concretadas)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {item.aprobadas ? `${((item.concretadas / item.aprobadas) * 100).toFixed(1)}%` : "0.0%"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-700">{numberFormatter.format(item.denegadas)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-700">{numberFormatter.format(item.invalidadas)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{numberFormatter.format(item.otros)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">
                    {item.total ? `${((item.aprobadas / item.total) * 100).toFixed(1)}%` : "0.0%"}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No hay datos por agencia.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default function SolicitudesUphone() {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("solicitudes");
  const [dashboardFilters, setDashboardFilters] = useState(createDashboardFilters);
  const [appliedDashboardFilters, setAppliedDashboardFilters] = useState(createDashboardFilters);
  const [filters, setFilters] = useState(createSolicitudFilters);
  const [appliedFilters, setAppliedFilters] = useState(createSolicitudFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    solicitudes: [],
    resumen: { totalRegistradas: 0, totalFiltradas: 0 },
    dashboard: EMPTY_DASHBOARD,
    paginacion: { page: 1, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [lastImport, setLastImport] = useState(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/api/uphone/solicitudes", {
        params: {
          q: appliedFilters.q,
          estado: appliedFilters.estado,
          fechaDesde: appliedFilters.fechaDesde,
          fechaHasta: appliedFilters.fechaHasta,
          usuariosUphone: appliedFilters.usuariosUphone.join(","),
          agencia: appliedFilters.agencia,
          dashboardFechaDesde: appliedDashboardFilters.fechaDesde,
          dashboardFechaHasta: appliedDashboardFilters.fechaHasta,
          dashboardUsuariosUphone: appliedDashboardFilters.usuariosUphone.join(","),
          dashboardAgencia: appliedDashboardFilters.agencia,
          page,
          pageSize: 25,
        },
      });
      const dashboard = response.data.dashboard || EMPTY_DASHBOARD;
      setData({
        ...response.data,
        solicitudes: normalizarVendedoresSolicitudes(
          response.data.solicitudes,
          dashboard.usuarios,
        ),
        dashboard,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo cargar",
        getErrorMessage(error, "No se pudieron consultar las solicitudes Uphone."),
        "error",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [appliedDashboardFilters, appliedFilters, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyFilters = (event) => {
    event.preventDefault();
    if (
      filters.fechaDesde
      && filters.fechaHasta
      && filters.fechaDesde > filters.fechaHasta
    ) {
      Swal.fire(
        "Rango de fechas inválido",
        "La fecha inicial no puede ser posterior a la fecha final.",
        "warning",
      );
      return;
    }
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    const nextFilters = createSolicitudFilters();
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  const applySolicitudPreset = (preset) => {
    const presetFilters = createSolicitudFilters(
      preset,
      filters.usuariosUphone,
      filters.agencia,
    );
    const nextFilters = {
      ...filters,
      fechaDesde: presetFilters.fechaDesde,
      fechaHasta: presetFilters.fechaHasta,
      preset,
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const response = await api.get("/api/uphone/solicitudes/exportar", {
        params: {
          q: appliedFilters.q,
          estado: appliedFilters.estado,
          fechaDesde: appliedFilters.fechaDesde,
          fechaHasta: appliedFilters.fechaHasta,
          usuariosUphone: appliedFilters.usuariosUphone.join(","),
          agencia: appliedFilters.agencia,
        },
        responseType: "blob",
      });
      const disposition = response.headers["content-disposition"] || "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        || `solicitudes-uphone-${getTodayInEcuador()}.xlsx`;
      const downloadUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      Swal.fire(
        "No se pudo exportar",
        getErrorMessage(error, "No se pudo generar el archivo Excel."),
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

  const deleteSolicitud = async (solicitud) => {
    const confirmation = await Swal.fire({
      icon: "warning",
      title: `Eliminar solicitud #${solicitud.numeroSolicitud}`,
      html: `Se eliminará definitivamente la solicitud de <b>${solicitud.cliente || "este cliente"}</b>.`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;

    setDeletingId(solicitud.id);
    try {
      const response = await api.delete(`/api/uphone/solicitudes/${solicitud.id}`);
      if (data.solicitudes.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await loadData({ silent: true });
      }
      await Swal.fire({
        icon: "success",
        title: "Solicitud eliminada",
        text: response.data.message,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo eliminar",
        getErrorMessage(error, "No se pudo eliminar la solicitud Uphone."),
        "error",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const applyDashboardFilters = (event) => {
    event.preventDefault();
    if (dashboardFilters.fechaDesde > dashboardFilters.fechaHasta) {
      Swal.fire(
        "Rango de fechas inválido",
        "La fecha inicial no puede ser posterior a la fecha final.",
        "warning",
      );
      return;
    }
    setAppliedDashboardFilters(dashboardFilters);
  };

  const applyDashboardPreset = (preset) => {
    const nextFilters = createDashboardFilters(
      preset,
      dashboardFilters.usuariosUphone,
      dashboardFilters.agencia,
    );
    setDashboardFilters(nextFilters);
    setAppliedDashboardFilters(nextFilters);
  };

  const uploadFile = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      return Swal.fire(
        "Archivo requerido",
        "Selecciona un reporte .xlsx de Uphone.",
        "warning",
      );
    }

    const formData = new FormData();
    formData.append("archivo", selectedFile);
    setUploading(true);
    try {
      const response = await api.post(
        "/api/uphone/solicitudes/importar-manual",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const result = response.data.resultado;
      setLastImport(result);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPage(1);
      await loadData({ silent: true });
      await Swal.fire({
        icon: result.insertadas > 0 ? "success" : "info",
        title: response.data.message,
        html: `<b>${result.insertadas}</b> nuevas · <b>${result.omitidasDuplicadas}</b> duplicadas por cédula o solicitud · <b>${result.omitidasInvalidas}</b> inválidas`,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo importar",
        getErrorMessage(error, "Verifica que el archivo tenga el formato de Uphone."),
        "error",
      );
    } finally {
      setUploading(false);
    }
  };

  const pageLabel = useMemo(() => {
    const total = data.paginacion?.total || 0;
    if (!total) return "0 resultados";
    const from = (page - 1) * 25 + 1;
    const to = Math.min(page * 25, total);
    return `${from}-${to} de ${total}`;
  }, [data.paginacion?.total, page]);

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-none space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Uphone</p>
            <h1 className="text-2xl font-bold text-slate-900">Solicitudes importadas</h1>

          </div>
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <div className="inline-flex w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto" role="tablist" aria-label="Secciones de solicitudes Uphone">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "solicitudes"}
            onClick={() => setActiveTab("solicitudes")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
              activeTab === "solicitudes"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <List size={17} /> Solicitudes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition sm:flex-none ${
              activeTab === "dashboard"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <BarChart3 size={17} /> Dashboard
          </button>
        </div>

        {activeTab === "solicitudes" ? (
          <>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form onSubmit={applyFilters} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Search size={17} className="text-teal-600" /> Consultar solicitudes
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Periodos de solicitudes">
                {SOLICITUD_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => applySolicitudPreset(preset.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      filters.preset === preset.value
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                Buscar
                <input
                  value={filters.q}
                  onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                  placeholder="Solicitud, vendedor, usuario o cliente"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Estado
                <input
                  value={filters.estado}
                  onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}
                  placeholder="PENDIENTE"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Agencia
                <select
                  value={filters.agencia}
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    agencia: event.target.value,
                  }))}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  <option value="">Todas las agencias</option>
                  {(data.dashboard?.agenciasDisponibles || []).map((agencia) => (
                    <option key={agencia} value={agencia}>{agencia}</option>
                  ))}
                </select>
              </label>
              <div className="text-xs font-semibold text-slate-600 xl:col-span-2">
                <label htmlFor="solicitudes-usuarios">Usuarios</label>
                <div className="mt-1">
                  <UserMultiSelect
                    inputId="solicitudes-usuarios"
                    users={data.dashboard?.usuarios || []}
                    selected={filters.usuariosUphone}
                    onChange={(usuariosUphone) => setFilters((current) => ({
                      ...current,
                      usuariosUphone,
                    }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 xl:col-span-2">
                <label className="text-xs font-semibold text-slate-600">
                  Desde
                  <input
                    type="date"
                    value={filters.fechaDesde}
                    onChange={(event) => setFilters((current) => ({
                      ...current,
                      preset: "custom",
                      fechaDesde: event.target.value,
                    }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Hasta
                  <input
                    type="date"
                    value={filters.fechaHasta}
                    onChange={(event) => setFilters((current) => ({
                      ...current,
                      preset: "custom",
                      fechaHasta: event.target.value,
                    }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={clearFilters} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Limpiar
              </button>
              <button
                type="button"
                onClick={exportExcel}
                disabled={exporting || !data.resumen?.totalFiltradas}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} />
                {exporting ? "Exportando..." : "Exportar Excel"}
              </button>
              <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                <FileSpreadsheet size={16} />
                Aplicar filtros
              </button>
            </div>
          </form>
          <form onSubmit={uploadFile} className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <UploadCloud size={18} className="text-teal-600" /> Carga manual
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Para contingencias. No se importan cédulas ni números de solicitud ya registrados. Archivo .xlsx, máximo 10 MB y 25.000 filas.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="mt-3 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-teal-700 hover:file:bg-teal-100"
            />
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet size={17} />
              {uploading ? "Importando..." : "Importar manualmente"}
            </button>
          </form>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total único</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{data.resumen?.totalRegistradas || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado del filtro</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{data.resumen?.totalFiltradas || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última carga manual</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {lastImport
                ? `${lastImport.insertadas} nuevas · ${lastImport.omitidasDuplicadas} duplicadas`
                : "Sin carga en esta sesión"}
            </p>
            {lastImport && (
              <p className="mt-1 truncate text-xs text-slate-500">{lastImport.archivo}</p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1200px] table-fixed divide-y divide-slate-200 text-sm">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[9%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[14%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Solicitud</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Distribuidor / matriz</th>
                  <th className="px-3 py-3">Vendedor</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Grupo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Contrato</th>
                  <th className="px-3 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Cargando solicitudes...</td></tr>
                ) : data.solicitudes?.length ? (
                  data.solicitudes.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-slate-50/80">
                      <td className="break-words px-3 py-3">
                        <p className="font-bold text-slate-900">#{item.numeroSolicitud}</p>
                        <p className="break-words text-xs text-slate-500">{item.usuario || "Sin usuario"}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDateTime(item.fechaSolicitud)}</td>
                      <td className="break-words px-3 py-3">
                        <p className="font-medium text-slate-800">{item.distribuidor || "—"}</p>
                        <p className="break-words text-xs text-slate-500">{item.matriz || "—"}</p>
                      </td>
                      <td className="break-words px-3 py-3 text-slate-700">{item.vendedor || "—"}</td>
                      <td className="break-words px-3 py-3">
                        <p className="font-medium text-slate-800">{item.cliente || "Sin nombre"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">CI {item.cedula || "—"}</p>
                        <p className="text-xs text-slate-500">Tel. {item.telefonoSolicitud || "—"}</p>
                      </td>
                      <td className="break-words px-3 py-3 text-slate-700">{item.grupoArrendamiento || "—"}</td>
                      <td className="px-3 py-3"><StatusBadge tone={estadoTone(item.estado)}>{formatStatus(item.estado)}</StatusBadge></td>
                      <td className="px-3 py-3"><StatusBadge tone={estadoTone(item.estadoContrato)}>{formatStatus(item.estadoContrato)}</StatusBadge></td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => deleteSolicitud(item)}
                          disabled={deletingId === item.id}
                          aria-label={`Eliminar solicitud ${item.numeroSolicitud}`}
                          title="Eliminar solicitud"
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                       
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No hay solicitudes para los filtros seleccionados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">{pageLabel}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= (data.paginacion?.totalPages || 1) || loading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
          </>
        ) : (
          <div className="space-y-5">
            <DashboardDateFilters
              filters={dashboardFilters}
              onChange={setDashboardFilters}
              onSubmit={applyDashboardFilters}
              onPreset={applyDashboardPreset}
              today={getTodayInEcuador()}
              users={data.dashboard?.usuarios || []}
              agencies={data.dashboard?.agenciasDisponibles || []}
            />
            <DashboardPanel dashboard={data.dashboard || EMPTY_DASHBOARD} loading={loading} />
          </div>
        )}
      </div>
    </div>
  );
}
