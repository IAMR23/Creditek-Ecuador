import { CalendarDays, Search, Trash2 } from "lucide-react";
import { INTERVIEW_STATUS } from "../../utils/interviews";

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100";

export default function InterviewFilters({ filters, interviewers, onChange, onClear }) {
  const update = (key) => (event) => onChange({ ...filters, [key]: event.target.value });

  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-12">
      <label className="xl:col-span-4">
        <span className="sr-only">Buscar aspirante</span>
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={filters.q}
            onChange={update("q")}
            placeholder="Buscar por nombre, cédula o teléfono"
            className={`${inputClass} pl-10`}
          />
        </div>
      </label>

      <label className="xl:col-span-2">
        <span className="sr-only">Estado de entrevista</span>
        <select value={filters.estadoEntrevista} onChange={update("estadoEntrevista")} className={inputClass}>
          <option value="">Todos los estados</option>
          {Object.entries(INTERVIEW_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>
      </label>

      <label className="relative xl:col-span-2">
        <span className="sr-only">Fecha de entrevista</span>
        <select value={filters.periodo} onChange={update("periodo")} className={`${inputClass} pr-9`}>
          <option value="">Todas las fechas</option>
          <option value="hoy">Hoy</option>
          <option value="7">Próximos 7 días</option>
          <option value="30">Próximos 30 días</option>
        </select>
        <CalendarDays
          size={17}
          className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </label>

      <label className="xl:col-span-2">
        <span className="sr-only">Entrevistador</span>
        <select value={filters.entrevistadorId} onChange={update("entrevistadorId")} className={inputClass}>
          <option value="">Todos los entrevistadores</option>
          {interviewers.map((user) => (
            <option key={user.id} value={user.id}>{user.nombre || user.email}</option>
          ))}
        </select>
      </label>

      <label className="xl:col-span-1">
        <span className="sr-only">Ciudad</span>
        <input
          value={filters.ciudad}
          onChange={update("ciudad")}
          placeholder="Ciudad"
          className={inputClass}
        />
      </label>

      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 xl:col-span-1"
      >
        <Trash2 size={16} aria-hidden="true" />
        <span className="xl:sr-only 2xl:not-sr-only">Limpiar</span>
      </button>
    </div>
  );
}
