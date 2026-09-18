import { ClipboardList, PlusCircle, TicketCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import TicketsTI from "../Sistemas/TicketsTI";
import TicketsSistemas from "./TicketsSistemas";

const PESTANAS = [
  { id: "ingresar", label: "Ingresar Tickets", icon: PlusCircle },
  { id: "seguimiento", label: "Seguimiento de Tickets", icon: ClipboardList },
];

export default function GestionTickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const pestanaSolicitada = searchParams.get("tab");
  const pestanaActiva = PESTANAS.some(({ id }) => id === pestanaSolicitada)
    ? pestanaSolicitada
    : "ingresar";

  const cambiarPestana = (pestana) => {
    setSearchParams({ tab: pestana });
  };

  return (
    <div className="min-h-full bg-slate-100 p-4 text-slate-900 sm:p-7">
      <div className="mx-auto max-w-[1700px]">
        <header className="mb-5 flex items-center gap-3">
          <span className="rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
            <TicketCheck size={27} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">Gestión Tickets</h1>
            <p className="text-sm text-slate-500">
              Ingresa solicitudes y consulta su seguimiento.
            </p>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200" aria-label="Secciones de Gestión Tickets">
          {PESTANAS.map(({ id, label, icon: Icon }) => {
            const activa = pestanaActiva === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => cambiarPestana(id)}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  activa
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
                aria-current={activa ? "page" : undefined}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </nav>

        {pestanaActiva === "seguimiento" ? (
          <TicketsTI soloSeguimiento integrado />
        ) : (
          <TicketsSistemas integrado />
        )}
      </div>
    </div>
  );
}
