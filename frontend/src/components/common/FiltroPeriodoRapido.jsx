/* eslint-disable react/prop-types */
import {
  obtenerPeriodoActivo,
  obtenerRangoPeriodo,
  PERIODOS_RAPIDOS,
} from "../../utils/dateUtils";

export default function FiltroPeriodoRapido({
  fechaInicio,
  fechaFin,
  onChange,
  periodos = PERIODOS_RAPIDOS,
  activeClassName = "bg-blue-600 text-white shadow-sm",
  inactiveClassName = "text-slate-600 hover:bg-white hover:text-slate-900",
  ariaLabel = "Períodos rápidos",
}) {
  const periodoActivo = obtenerPeriodoActivo(
    fechaInicio,
    fechaFin,
    periodos,
  );

  return (
    <div
      className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
      aria-label={ariaLabel}
    >
      {periodos.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(obtenerRangoPeriodo(id), id)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition sm:flex-none ${
            periodoActivo === id ? activeClassName : inactiveClassName
          }`}
          aria-pressed={periodoActivo === id}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
