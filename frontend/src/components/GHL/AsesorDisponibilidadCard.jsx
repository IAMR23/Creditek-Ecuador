import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Pause, Play, RefreshCcw } from "lucide-react";
import api from "../../api/client";

const messageOf = (error) =>
  error.response?.data?.message || error.message || "No se pudo actualizar el reparto";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
    : "Sin cambios registrados";

export default function AsesorDisponibilidadCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/ghl/repartos/mi-disponibilidad");
      setData(response.data.disponibilidad);
      setError("");
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeState = async (estado) => {
    if (busy || data?.estado === estado) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.patch("/api/ghl/repartos/mi-disponibilidad", { estado });
      setData(response.data.disponibilidad);
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm text-gray-500"><RefreshCcw className="animate-spin" size={17} /> Cargando estado de reparto...</div></section>;
  }

  if (!data?.vinculado) {
    return <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3 text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={20} /><div><h2 className="font-bold">Reparto GHL no configurado</h2><p className="mt-1 text-sm">Un administrador debe asociar tu usuario RVE con tu usuario de GHL.</p>{error && <p className="mt-2 text-sm font-semibold">{error}</p>}</div></div></section>;
  }

  const active = data.estado === "ACTIVO";
  return <section className={`mb-8 rounded-2xl border p-5 shadow-sm ${active ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Reparto de oportunidades GHL</p>
        <h2 className={`mt-1 text-xl font-bold ${active ? "text-green-800" : "text-gray-800"}`}>{active ? "Recibiendo leads" : "Reparto pausado"}</h2>
        <p className="mt-1 text-sm text-gray-600">Último cambio: {formatDateTime(data.ultimoCambio)}</p>
        <p className="mt-1 text-sm font-semibold text-gray-700">Leads recibidos hoy: {data.leadsHoy || 0}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={busy || active} onClick={() => changeState("ACTIVO")} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"><Play size={18} /> Play</button>
        <button type="button" disabled={busy || !active} onClick={() => changeState("PAUSADO")} className="inline-flex items-center gap-2 rounded-xl bg-gray-700 px-5 py-3 font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"><Pause size={18} /> Pausa</button>
      </div>
    </div>
    {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
  </section>;
}
