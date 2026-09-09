/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Link2, Pause, Play, RefreshCcw } from "lucide-react";
import api from "../../api/client";

const messageOf = (error) => error.response?.data?.message || error.message || "No se pudo actualizar el asesor";
const formatDateTime = (value) => value ? new Date(value).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "-";

export default function AsesoresDisponibilidadPanel({ ghlUsers = [] }) {
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/ghl/repartos/asesores");
      const advisors = response.data.asesores || [];
      setRows(advisors);
      setDrafts(Object.fromEntries(advisors.map((row) => [row.usuario.id, row.disponibilidad.ghlUserId || ""])));
      setError("");
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveAssociation = async (usuarioId) => {
    if (!drafts[usuarioId] || busy) return;
    setBusy(`link:${usuarioId}`); setError("");
    try {
      await api.put(`/api/ghl/repartos/asesores/${usuarioId}/asociacion`, { ghlUserId: drafts[usuarioId] });
      await load();
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); }
  };

  const changeState = async (usuarioId, estado) => {
    if (busy) return;
    setBusy(`state:${usuarioId}`); setError("");
    try {
      await api.patch(`/api/ghl/repartos/asesores/${usuarioId}/disponibilidad`, { estado });
      await load();
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); }
  };

  return <section className="overflow-hidden rounded border bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-bold text-gray-900">Disponibilidad de asesores</h2><p className="text-xs text-gray-500">Play habilita nuevos leads solo durante el día actual en America/Guayaquil.</p></div><button type="button" onClick={load} disabled={loading} className="rounded border p-2"><RefreshCcw size={17} className={loading ? "animate-spin" : ""} /></button></div>
    {error && <div className="m-4 flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={17} /> {error}</div>}
    <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-gray-100 text-left"><tr>{["Asesor RVE", "Usuario GHL", "Asociación", "Estado", "Último cambio", "Leads hoy", "Acciones"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead><tbody>
      {rows.map((row) => {
        const userId = row.usuario.id;
        const linked = !row.asociacionIncompleta;
        const associated = row.disponibilidad.asociacionActiva === true;
        const active = row.disponibilidad.estado === "ACTIVO";
        const rowBusy = busy.endsWith(`:${userId}`);
        return <tr key={userId} className="border-t align-middle">
          <td className="px-3 py-3"><b className="block">{row.usuario.nombre}</b><span className="text-xs text-gray-500">{row.usuario.email}</span></td>
          <td className="px-3 py-3"><select value={drafts[userId] || ""} onChange={(event) => setDrafts((old) => ({ ...old, [userId]: event.target.value }))} className="h-9 min-w-64 rounded border border-gray-300 bg-white px-2"><option value="">Seleccione usuario GHL...</option>{ghlUsers.map((user) => <option key={user.id} value={user.id}>{user.name || "Sin nombre"} · {user.email || "Sin correo"}</option>)}</select></td>
          <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${linked ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>{linked ? "Completa" : associated ? "Inválida en GHL" : "Incompleta"}</span></td>
          <td className={`px-3 py-3 font-bold ${active ? "text-green-700" : "text-gray-600"}`}>{active ? "Play / Activo" : "Pausa / Inactivo"}</td>
          <td className="whitespace-nowrap px-3 py-3">{formatDateTime(row.disponibilidad.ultimoCambio)}</td>
          <td className="px-3 py-3 font-bold">{row.disponibilidad.leadsHoy || 0}</td>
          <td className="px-3 py-3"><div className="flex flex-wrap gap-1"><button type="button" disabled={!drafts[userId] || rowBusy} onClick={() => saveAssociation(userId)} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-blue-700 disabled:opacity-40"><Link2 size={14} /> Asociar</button><button type="button" disabled={!linked || active || rowBusy} onClick={() => changeState(userId, "ACTIVO")} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-green-700 disabled:opacity-40"><Play size={14} /> Play</button><button type="button" disabled={!associated || !active || rowBusy} onClick={() => changeState(userId, "PAUSADO")} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-gray-700 disabled:opacity-40"><Pause size={14} /> Pausa</button></div></td>
        </tr>;
      })}
      {!rows.length && !loading && <tr><td colSpan="7" className="p-8 text-center text-gray-500">Sin usuarios RVE activos.</td></tr>}
    </tbody></table></div>
  </section>;
}
