import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatInterviewTime,
  getCandidateName,
  getInterviewStatus,
  toEcuadorDateInput,
} from "../../utils/interviews";
import InterviewStatusBadge from "./InterviewStatusBadge";

const createNoonDate = (value) => new Date(`${value}T12:00:00`);
const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const startOfWeek = (date) => {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  return next;
};

const getDays = (anchor, mode) => {
  if (mode === "dia") return [new Date(anchor)];
  if (mode === "semana") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12);
  return Array.from({ length: last.getDate() }, (_, index) => addDays(first, index));
};

export default function InterviewCalendar({ interviews, loading, onView }) {
  const [mode, setMode] = useState("semana");
  const [anchor, setAnchor] = useState(() => createNoonDate(toDateKey(new Date())));
  const days = useMemo(() => getDays(anchor, mode), [anchor, mode]);
  const grouped = useMemo(() => {
    const result = new Map();
    interviews.filter((item) => item.fechaEntrevista).forEach((item) => {
      const key = toEcuadorDateInput(item.fechaEntrevista);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(item);
    });
    return result;
  }, [interviews]);

  const move = (direction) => {
    setAnchor((current) => {
      if (mode === "dia") return addDays(current, direction);
      if (mode === "semana") return addDays(current, direction * 7);
      return new Date(current.getFullYear(), current.getMonth() + direction, 1, 12);
    });
  };

  const title =
    mode === "dia"
      ? anchor.toLocaleDateString("es-EC", { dateStyle: "full" })
      : mode === "mes"
        ? anchor.toLocaleDateString("es-EC", { month: "long", year: "numeric" })
        : `${days[0].toLocaleDateString("es-EC", { day: "2-digit", month: "short" })} – ${days[days.length - 1].toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}`;

  if (loading) {
    return <div className="flex min-h-80 items-center justify-center text-sm font-semibold text-slate-500">Cargando calendario...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Periodo anterior"><ChevronLeft size={17} /></button>
          <button type="button" onClick={() => setAnchor(createNoonDate(toDateKey(new Date())))} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Hoy</button>
          <button type="button" onClick={() => move(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Periodo siguiente"><ChevronRight size={17} /></button>
          <h3 className="ml-2 text-sm font-extrabold capitalize text-slate-900">{title}</h3>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {[{ key: "dia", label: "Día" }, { key: "semana", label: "Semana" }, { key: "mes", label: "Mes" }].map((option) => (
            <button key={option.key} type="button" onClick={() => setMode(option.key)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${mode === option.key ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{option.label}</button>
          ))}
        </div>
      </div>

      <div className={`grid gap-2 ${mode === "dia" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-7"}`}>
        {days.map((day) => {
          const key = toDateKey(day);
          const dayInterviews = grouped.get(key) || [];
          const today = key === toDateKey(new Date());

          return (
            <section key={key} className={`min-h-36 rounded-xl border p-2.5 ${today ? "border-orange-300 bg-orange-50/40" : "border-slate-200 bg-white"}`}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase text-slate-500">{day.toLocaleDateString("es-EC", { weekday: "short" })}</p>
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${today ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700"}`}>{day.getDate()}</span>
              </div>
              <div className="space-y-2">
                {dayInterviews.map((interview) => (
                  <button key={interview.id} type="button" onClick={() => onView(interview)} className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-orange-300 hover:shadow">
                    <p className="text-[11px] font-extrabold text-orange-600">{formatInterviewTime(interview.fechaEntrevista)}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-800">{getCandidateName(interview)}</p>
                    <p className="mt-1 truncate text-[10px] text-slate-500">{interview.entrevistador?.nombre || "Sin asignar"}</p>
                    <div className="mt-2 origin-left scale-90"><InterviewStatusBadge status={getInterviewStatus(interview)} /></div>
                  </button>
                ))}
                {!dayInterviews.length && <p className="py-4 text-center text-[11px] text-slate-400">Sin entrevistas</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
