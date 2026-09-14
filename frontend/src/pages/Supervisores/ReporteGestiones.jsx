/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Pause, Play, RefreshCcw, UsersRound } from "lucide-react";
import api from "../../api/client";

const TIME_ZONE = "America/Guayaquil";
const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const messageOf = (error) => error.response?.data?.message || error.message || "No se pudo cargar el reporte";
const formatTime = (value) => value
  ? new Date(value).toLocaleTimeString("es-EC", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit" })
  : "-";

export default function ReporteGestiones() {
  const [fecha, setFecha] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/ghl/repartos/reporte-gestiones", { params: { fecha } });
      setRows(response.data.gestores || []);
      setError("");
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => { load(); }, [load]);

  const changeState = async (usuarioId, estado) => {
    if (busy || fecha !== today()) return;
    setBusy(`${estado}:${usuarioId}`);
    setError("");
    try {
      await api.patch(`/api/ghl/repartos/reporte-gestiones/${usuarioId}/disponibilidad`, { estado });
      await load();
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setBusy("");
    }
  };

  const totalLeads = rows.reduce((sum, row) => sum + Number(row.leadsGestionados || 0), 0);
  const activos = rows.filter((row) => row.estado === "ACTIVO").length;
  const historical = fecha !== today();

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-green-700">Supervisores</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Reporte de gestiones</h1>
            <p className="mt-1 text-sm text-slate-500">Historial diario de cada Play, descanso y leads recibidos por gestor.</p>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs font-bold text-slate-600">Fecha<input type="date" value={fecha} max={today()} onChange={(event) => setFecha(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
            <button type="button" onClick={load} disabled={loading} className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-700 shadow-sm disabled:opacity-50" title="Actualizar"><RefreshCcw size={18} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Gestores vinculados" value={rows.length} icon={<UsersRound size={20} />} />
          <Metric label="En Play" value={historical ? "-" : activos} icon={<Play size={20} />} />
          <Metric label="Leads gestionados" value={totalLeads} icon={<UsersRound size={20} />} />
        </section>

        {historical && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">La fecha seleccionada es histórica. Los controles Play y Descanso solo están disponibles para hoy.</div>}
        {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={18} />{error}</div>}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600"><tr>{["Nombre del gestor", "Estado", "Histórico Play / descanso", "Leads gestionados", "Acciones"].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead>
              <tbody>
                {rows.map((row) => {
                  const active = row.estado === "ACTIVO";
                  const rowBusy = busy.endsWith(`:${row.usuarioId}`);
                  return <tr key={row.usuarioId} className="border-t border-slate-100">
                    <td className="px-4 py-3"><b className="block text-slate-900">{row.nombre}</b><span className="text-xs text-slate-500">{row.email}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-700"}`}>{active ? "Play" : row.estado === "SIN_REGISTRO" ? "Sin registro" : "Descanso"}</span></td>
                    <td className="min-w-[320px] px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {(row.historial || []).map((event, index) => {
                          const isPlay = event.estado === "ACTIVO";
                          return <div key={`${event.momento}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                            <span className={`inline-flex min-w-20 items-center gap-1 text-xs font-bold ${isPlay ? "text-green-700" : "text-slate-700"}`}>{isPlay ? <Play size={13} /> : <Pause size={13} />}{isPlay ? "Play" : "Descanso"}</span>
                            <span className="font-mono text-xs font-bold text-slate-900">{formatTime(event.momento)}</span>
                            <span className="text-[11px] text-slate-500">{event.origen === "asesor" ? "por el gestor" : event.cambiadoPor ? `por ${event.cambiadoPor}` : "por supervisión"}</span>
                          </div>;
                        })}
                        {!row.historial?.length && <span className="text-xs text-slate-400">Sin movimientos en esta fecha</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-lg font-black text-slate-900">{row.leadsGestionados || 0}</td>
                    <td className="px-4 py-3"><div className="flex gap-2"><button type="button" disabled={historical || active || rowBusy} onClick={() => changeState(row.usuarioId, "ACTIVO")} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Play size={14} /> Play</button><button type="button" disabled={historical || !active || rowBusy} onClick={() => changeState(row.usuarioId, "PAUSADO")} className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Pause size={14} /> Descanso</button></div></td>
                  </tr>;
                })}
                {!rows.length && !loading && <tr><td colSpan="5" className="p-10 text-center text-slate-500">No hay gestores vinculados para mostrar.</td></tr>}
                {loading && <tr><td colSpan="5" className="p-10 text-center text-slate-500">Cargando reporte...</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, icon }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-green-700">{icon}<span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span></div><p className="mt-2 text-3xl font-black text-slate-900">{value}</p></div>;
}
