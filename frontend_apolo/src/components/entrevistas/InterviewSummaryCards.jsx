import { CalendarCheck2, CalendarDays, Clock3, RefreshCcw } from "lucide-react";

const cards = [
  {
    key: "pendientesAgendar",
    title: "Pendientes de agendar",
    description: "Requieren programación",
    icon: CalendarDays,
    iconClass: "text-orange-600",
    iconBg: "bg-orange-50",
  },
  {
    key: "agendadasHoy",
    title: "Agendadas hoy",
    description: "Entrevistas para hoy",
    icon: CalendarCheck2,
    iconClass: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    key: "porConfirmar",
    title: "Por confirmar",
    description: "Esperando confirmación",
    icon: Clock3,
    iconClass: "text-amber-600",
    iconBg: "bg-amber-50",
  },
  {
    key: "reprogramaciones",
    title: "Reprogramaciones",
    description: "En los próximos 7 días",
    icon: RefreshCcw,
    iconClass: "text-violet-600",
    iconBg: "bg-violet-50",
  },
];

export default function InterviewSummaryCards({ summary, loading }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ key, title, description, icon: Icon, iconClass, iconBg }) => (
        <article
          key={key}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
              <Icon className={iconClass} size={23} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold leading-none text-slate-950">
                {loading ? "—" : summary?.[key] ?? 0}
              </p>
              <h3 className="mt-2 text-sm font-bold text-slate-800">{title}</h3>
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

