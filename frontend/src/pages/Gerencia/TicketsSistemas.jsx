/* eslint-disable react/prop-types */
import { useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Send,
  TicketCheck,
} from "lucide-react";
import { api } from "../../api/client";

const TIPOS = ["Error", "Mejora", "Nuevo desarrollo", "Soporte", "Reporte"];
const hoyLocal = () => new Date().toLocaleDateString("en-CA");
const crearFormularioInicial = () => ({
  titulo: "",
  descripcion: "",
  tipo: "Soporte",
  fechaInicio: hoyLocal(),
  fechaEstimada: hoyLocal(),
  urgente: false,
});

export default function TicketsSistemas({ integrado = false }) {
  const [form, setForm] = useState(crearFormularioInicial);
  const [guardando, setGuardando] = useState(false);
  const [ticketCreado, setTicketCreado] = useState(null);

  const actualizar = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((actual) => {
      const siguiente = {
        ...actual,
        [name]: type === "checkbox" ? checked : value,
      };
      if (name === "fechaInicio" && siguiente.fechaEstimada < value) {
        siguiente.fechaEstimada = value;
      }
      return siguiente;
    });
  };

  const guardar = async (event) => {
    event.preventDefault();
    setGuardando(true);
    try {
      const { data } = await api.post("/api/sistemas/tickets", {
        titulo: form.titulo,
        descripcion: form.descripcion,
        tipo: form.tipo,
        proyecto: "RVE",
        areaSolicitante: "Gerencia",
        prioridad: form.urgente ? "Urgente" : "Media",
        fechaInicio: form.fechaInicio,
        fechaEstimada: form.fechaEstimada,
      });
      setTicketCreado(data.ticket);
      setForm(crearFormularioInicial());
      await Swal.fire(
        "Ticket registrado",
        `${data.ticket.codigo} fue enviado a Sistemas.`,
        "success",
      );
    } catch (error) {
      Swal.fire(
        "No se pudo registrar",
        error.response?.data?.message || "No se pudo registrar el ticket.",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={integrado ? "" : "min-h-full bg-slate-100 p-4 sm:p-7"}>
      <div className="w-full">
        {!integrado && (
          <header className="mb-6 flex items-center gap-3">
            <span className="rounded-2xl bg-emerald-600 p-3 text-white shadow-sm">
              <TicketCheck size={27} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Ingresar Tickets</h1>
              <p className="text-sm text-slate-500">
                Registra rápidamente una solicitud para el equipo de TI.
              </p>
            </div>
          </header>
        )}

        {ticketCreado && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} />
              <span>Último ticket creado: <strong>{ticketCreado.codigo}</strong></span>
            </div>
            <Link
              to="/gestion-tickets?tab=seguimiento"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Ver mis tickets
            </Link>
          </div>
        )}

        <form onSubmit={guardar} className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:p-8">
          <header className="mb-7 flex items-center gap-4">
            <span className="inline-flex shrink-0 rounded-xl bg-emerald-600 p-3 text-white shadow-sm">
              <TicketCheck size={24} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Datos de la solicitud</h2>
              <p className="mt-0.5 text-sm text-slate-500">Los campos marcados con * son obligatorios.</p>
            </div>
          </header>

          <div className="grid gap-x-7 gap-y-5 lg:grid-cols-2">
                <label className="lg:col-span-2">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Título *</span>
                  <input
                    required
                    maxLength={180}
                    name="titulo"
                    value={form.titulo}
                    onChange={actualizar}
                    placeholder="Resumen corto de la solicitud"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="lg:col-span-2">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Descripción *</span>
                  <textarea
                    required
                    rows={4}
                    name="descripcion"
                    value={form.descripcion}
                    onChange={actualizar}
                    placeholder="Describe lo que necesitas, el problema y el resultado esperado."
                    className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Tipo</span>
                  <select name="tipo" value={form.tipo} onChange={actualizar} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
                    {TIPOS.map((tipo) => <option key={tipo}>{tipo}</option>)}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Estado</span>
                  <input value="Solicitado" disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-600" />
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Fecha de ingreso *</span>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-3 text-slate-400" size={17} />
                    <input
                      required
                      type="date"
                      name="fechaInicio"
                      value={form.fechaInicio}
                      onChange={actualizar}
                      className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                </label>

                <label>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Cierre tentativo *</span>
                  <input
                    required
                    type="date"
                    name="fechaEstimada"
                    min={form.fechaInicio}
                    value={form.fechaEstimada}
                    onChange={actualizar}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
          </div>

          <footer className="mt-7 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition sm:max-w-md ${form.urgente ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
              <input type="checkbox" name="urgente" checked={form.urgente} onChange={actualizar} className="h-4 w-4 shrink-0 accent-red-600" />
              <AlertTriangle size={18} className={form.urgente ? "shrink-0 text-red-600" : "shrink-0 text-slate-400"} />
              <span className="min-w-0">
                <strong className="block text-sm text-slate-800">Marcar como urgente</strong>
                <span className="block text-xs text-slate-500">Solo si afecta una operación crítica.</span>
              </span>
            </label>

            <button disabled={guardando} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
              {guardando ? <LoaderCircle className="animate-spin" size={19} /> : <Send size={19} />}
              Enviar ticket a Sistemas
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
