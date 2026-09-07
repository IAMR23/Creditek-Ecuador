/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Pause, Play, RefreshCcw, RotateCcw, Save, Search, ShieldAlert, X } from "lucide-react";
import api from "../../api/client";

const DAYS = [[1, "Lunes"], [2, "Martes"], [3, "Miercoles"], [4, "Jueves"], [5, "Viernes"], [6, "Sabado"], [0, "Domingo"]];
const ACTIVE_STATES = ["running", "pause_requested", "cancel_requested"];
const STATUS_LABELS = {
  running: "En ejecucion", pause_requested: "Pausando...", paused: "Pausada",
  cancel_requested: "Cancelando...", completed: "Completada", partial: "Parcial",
  failed: "Fallida", cancelled: "Cancelada", interrupted: "Interrumpida", skipped: "Omitida",
};
const empty = { nombre: "Reparto de oportunidades", pipelineId: "", stageId: "", hora: "09:00", zonaHoraria: "America/Guayaquil", diasSemana: [1, 2, 3, 4, 5], modo: "unassigned", usuariosGhl: [], activo: true };
const messageOf = (error) => error.response?.data?.message || error.message || "Ocurrio un error";
const inputClass = "h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

export default function RepartoOportunidades() {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(empty);
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [controlBusy, setControlBusy] = useState("");
  const [executionWaiting, setExecutionWaiting] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    const response = await api.get("/api/ghl/repartos/ejecuciones");
    setHistory(response.data.ejecuciones || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pipelineResponse, userResponse, configResponse, historyResponse] = await Promise.all([
        api.get("/api/ghl/repartos/catalogos/pipelines"),
        api.get("/api/ghl/repartos/catalogos/users"),
        api.get("/api/ghl/repartos/configuraciones"),
        api.get("/api/ghl/repartos/ejecuciones"),
      ]);
      setPipelines(pipelineResponse.data.pipelines || []);
      setUsers(userResponse.data.users || []);
      setConfigs(configResponse.data.configuraciones || []);
      setHistory(historyResponse.data.ejecuciones || []);
      if (!selectedId && configResponse.data.configuraciones?.[0]) {
        setSelectedId(configResponse.data.configuraciones[0].id);
        setForm(configResponse.data.configuraciones[0]);
      }
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!form.pipelineId) { setStages([]); return; }
    api.get(`/api/ghl/repartos/catalogos/pipelines/${encodeURIComponent(form.pipelineId)}/stages`)
      .then((response) => setStages(response.data.stages || []))
      .catch((requestError) => setError(messageOf(requestError)));
  }, [form.pipelineId]);

  const hasActiveExecution = executionWaiting || Boolean(controlBusy) || history.some((run) => ACTIVE_STATES.includes(run.estado));
  useEffect(() => {
    if (!hasActiveExecution) return undefined;
    const timer = window.setInterval(() => loadHistory().catch((requestError) => setError(messageOf(requestError))), 2500);
    return () => window.clearInterval(timer);
  }, [hasActiveExecution, loadHistory]);

  const set = (key, value) => { setForm((old) => ({ ...old, [key]: value })); setPreview(null); };
  const toggleUser = (user) => set("usuariosGhl", form.usuariosGhl.some((item) => item.id === user.id) ? form.usuariosGhl.filter((item) => item.id !== user.id) : [...form.usuariosGhl, user]);
  const toggleDay = (day) => set("diasSemana", form.diasSemana.includes(day) ? form.diasSemana.filter((item) => item !== day) : [...form.diasSemana, day]);
  const valid = useMemo(() => form.pipelineId && form.stageId && form.hora && form.diasSemana.length && form.usuariosGhl.length >= 2, [form]);

  const save = async () => {
    setBusy("save"); setError("");
    try {
      const response = selectedId ? await api.put(`/api/ghl/repartos/configuraciones/${selectedId}`, form) : await api.post("/api/ghl/repartos/configuraciones", form);
      setSelectedId(response.data.configuracion.id); setForm(response.data.configuracion); await load();
    } catch (requestError) { setError(messageOf(requestError)); } finally { setBusy(""); }
  };
  const doPreview = async () => {
    if (!selectedId) return setError("Guarde la configuracion antes de la vista previa");
    setBusy("preview");
    try { const response = await api.post(`/api/ghl/repartos/configuraciones/${selectedId}/preview`); setPreview(response.data.preview); }
    catch (requestError) { setError(messageOf(requestError)); } finally { setBusy(""); }
  };
  const execute = async () => {
    if (!selectedId) return setError("Guarde la configuracion antes de ejecutar");
    if (!window.confirm("¿Confirma que desea actualizar los propietarios de las oportunidades elegibles en GHL?")) return;
    setBusy("execute"); setExecutionWaiting(true);
    try { await api.post(`/api/ghl/repartos/configuraciones/${selectedId}/execute`, { confirm: true }); }
    catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); setExecutionWaiting(false); await loadHistory().catch(() => {}); }
  };
  const controlExecution = async (run, action) => {
    if (action === "cancel" && !window.confirm("Se detendrá el reparto pendiente. Las oportunidades ya asignadas no serán revertidas.")) return;
    if (action === "force-finish-stale" && !window.confirm("¿Finalizar esta ejecución atascada? El historial y las asignaciones completadas se conservarán.")) return;
    setControlBusy(`${action}:${run.id}`); setError("");
    try { await api.post(`/api/ghl/repartos/ejecuciones/${run.id}/${action}`); await loadHistory(); }
    catch (requestError) { setError(messageOf(requestError)); }
    finally { setControlBusy(""); }
  };
  const showDetail = async (id) => {
    try { const response = await api.get(`/api/ghl/repartos/ejecuciones/${id}`); setDetail(response.data.ejecucion); }
    catch (requestError) { setError(messageOf(requestError)); }
  };
  const choose = (id) => {
    if (!id) { setSelectedId(null); setForm(empty); return; }
    const row = configs.find((item) => String(item.id) === id);
    setSelectedId(row.id); setForm(row); setPreview(null);
  };

  return <div className="min-h-screen space-y-4 bg-gray-50 p-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-sm font-semibold text-green-700">GoHighLevel</div><h1 className="text-2xl font-bold text-gray-900">Reparto de oportunidades</h1><p className="text-sm text-gray-500">Solo oportunidades de hoy y ayer · America/Guayaquil</p></div>
      <div className={`rounded-full px-3 py-1 text-xs font-bold ${error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{loading ? "Comprobando conexion..." : error ? "GHL no disponible" : "GHL conectado"}</div>
    </header>
    {error && <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={18}/><span className="flex-1">{error}</span><button onClick={() => setError("")}><X size={16}/></button></div>}

    <section className="space-y-4 rounded border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Configuracion"><select className={inputClass} value={selectedId || ""} onChange={(event) => choose(event.target.value)}><option value="">Nueva configuracion</option>{configs.map((config) => <option key={config.id} value={config.id}>{config.nombre}</option>)}</select></Field>
        <Field label="Nombre"><input className={inputClass} value={form.nombre} onChange={(event) => set("nombre", event.target.value)}/></Field>
        <Field label="Pipeline"><select className={inputClass} value={form.pipelineId} onChange={(event) => { setForm((old) => ({ ...old, pipelineId: event.target.value, stageId: "" })); setPreview(null); }}><option value="">Seleccione...</option>{pipelines.map((pipeline) => <option key={pipeline.id || pipeline._id} value={pipeline.id || pipeline._id}>{pipeline.name}</option>)}</select></Field>
        <Field label="Etapa"><select className={inputClass} value={form.stageId} onChange={(event) => set("stageId", event.target.value)} disabled={!form.pipelineId}><option value="">Seleccione...</option>{stages.map((stage) => <option key={stage.id || stage._id} value={stage.id || stage._id}>{stage.name}</option>)}</select></Field>
        <Field label="Hora"><input type="time" className={inputClass} value={form.hora} onChange={(event) => set("hora", event.target.value)}/></Field>
        <Field label="Zona horaria"><input className={`${inputClass} bg-gray-100`} value="America/Guayaquil" disabled/></Field>
        <Field label="Modo"><select className={inputClass} value={form.modo} onChange={(event) => set("modo", event.target.value)}><option value="unassigned">Solo sin propietario</option><option value="all">Redistribuir todas</option></select></Field>
        <Field label="Estado"><label className="flex h-10 items-center gap-2"><input type="checkbox" checked={form.activo} onChange={(event) => set("activo", event.target.checked)} className="h-5 w-5 accent-green-600"/> {form.activo ? "Activo" : "Inactivo"}</label></Field>
      </div>
      <div><div className="mb-2 text-xs font-semibold text-gray-600">Dias de ejecucion</div><div className="flex flex-wrap gap-2">{DAYS.map(([day, name]) => <button type="button" key={day} onClick={() => toggleDay(day)} className={`rounded px-3 py-2 text-sm font-semibold ${form.diasSemana.includes(day) ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}>{name}</button>)}</div></div>
      <div><div className="mb-2 text-xs font-semibold text-gray-600">Usuarios GHL ({form.usuariosGhl.length} seleccionados)</div><div className="grid max-h-52 gap-2 overflow-auto rounded border p-2 md:grid-cols-2 lg:grid-cols-3">{users.length ? users.map((user) => <label key={user.id} className="flex items-start gap-2 rounded p-2 hover:bg-green-50"><input type="checkbox" className="mt-1 accent-green-600" checked={form.usuariosGhl.some((item) => item.id === user.id)} onChange={() => toggleUser(user)}/><span><b className="block text-sm">{user.name || "Sin nombre"}</b><span className="text-xs text-gray-500">{user.email || "Sin correo"}</span></span></label>) : <div className="p-3 text-sm text-gray-500">No hay usuarios asignables.</div>}</div></div>
      <div className="flex flex-wrap gap-2">
        <button disabled={!valid || busy} onClick={save} className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/>{busy === "save" ? "Guardando..." : "Guardar configuracion"}</button>
        <button disabled={!selectedId || busy} onClick={doPreview} className="flex items-center gap-2 rounded border px-4 py-2 text-sm font-bold disabled:opacity-50"><Search size={16}/>Vista previa</button>
        <button disabled={!selectedId || busy} onClick={execute} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Play size={16}/>{busy === "execute" ? "Ejecutando..." : "Ejecutar ahora"}</button>
        <button onClick={load} disabled={loading} className="rounded border p-2"><RefreshCcw size={17} className={loading ? "animate-spin" : ""}/></button>
      </div>
    </section>

    {preview && <section className="rounded border bg-white p-4 shadow-sm"><h2 className="font-bold">Resumen de vista previa</h2><p className="mb-3 text-xs text-gray-500">Periodo: {preview.rangoFechas?.fechaInicio} al {preview.rangoFechas?.fechaFin}, America/Guayaquil</p><div className="grid gap-2 sm:grid-cols-3"><Metric label="Encontradas" value={preview.totalEncontradas}/><Metric label="Elegibles" value={preview.totalElegibles}/><Metric label="Omitidas" value={preview.totalOmitidas}/></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{preview.usuarios.map((user) => <div key={user.id} className="rounded bg-gray-50 p-3 text-sm"><b>{user.name}</b><div>{user.cantidad} oportunidades</div></div>)}</div></section>}

    <section className="overflow-hidden rounded border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b p-4"><b>Historial de ejecuciones</b>{hasActiveExecution && <span className="text-xs font-semibold text-blue-700">Actualizando automaticamente...</span>}</div>
      <div className="overflow-x-auto"><table className="min-w-[1250px] w-full text-sm"><thead className="bg-gray-100 text-left"><tr>{["Fecha", "Tipo", "Pipeline / etapa", "Progreso", "Resultado", "Estado", "Heartbeat", "Ejecutor", "Acciones"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead><tbody>
        {history.length ? history.map((run) => {
          const actionBusy = controlBusy.endsWith(`:${run.id}`);
          return <tr key={run.id} className="border-t align-top">
            <td className="whitespace-nowrap px-3 py-2">{new Date(run.startedAt).toLocaleString("es-EC")}</td>
            <td className="px-3 py-2">{run.tipo === "scheduled" ? "Programada" : "Manual"}</td>
            <td className="px-3 py-2">{run.pipelineNombre}<br/><span className="text-xs text-gray-500">{run.stageNombre}</span></td>
            <td className="px-3 py-2"><b>{run.processedCount || 0} de {run.totalElegibles || 0}</b><br/><span className="text-xs text-gray-500">procesadas</span></td>
            <td className="px-3 py-2">{run.totalAsignadas || 0} asignadas<br/>{run.totalOmitidas || 0} omitidas · {run.totalErrores || 0} errores</td>
            <td className="px-3 py-2 font-semibold">{STATUS_LABELS[run.estado] || run.estado}{run.isStale && <span className="mt-1 block text-xs text-red-700">Heartbeat vencido</span>}</td>
            <td className="whitespace-nowrap px-3 py-2">{run.heartbeatAt ? new Date(run.heartbeatAt).toLocaleString("es-EC") : "Sin heartbeat"}</td>
            <td className="px-3 py-2">{run.ejecutadoPor?.nombre || "-"}</td>
            <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
              <button className="rounded border px-2 py-1 text-green-700" onClick={() => showDetail(run.id)}>Detalle</button>
              {run.estado === "running" && <ActionButton disabled={actionBusy} onClick={() => controlExecution(run, "pause")} icon={<Pause size={14}/>} label="Pausar"/>}
              {run.estado === "paused" && <ActionButton disabled={actionBusy} onClick={() => controlExecution(run, "resume")} icon={<RotateCcw size={14}/>} label="Reanudar"/>}
              {["running", "pause_requested", "paused"].includes(run.estado) && <ActionButton disabled={actionBusy} onClick={() => controlExecution(run, "cancel")} icon={<Ban size={14}/>} label="Cancelar" danger/>}
              {run.isStale && <ActionButton disabled={actionBusy} onClick={() => controlExecution(run, "force-finish-stale")} icon={<ShieldAlert size={14}/>} label="Finalizar atascada" danger/>}
            </div></td>
          </tr>;
        }) : <tr><td colSpan="9" className="p-8 text-center text-gray-500">Sin ejecuciones registradas.</td></tr>}
      </tbody></table></div>
    </section>

    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded bg-white p-4 shadow-xl"><div className="mb-3 flex justify-between"><h2 className="font-bold">Ejecucion #{detail.id}</h2><button onClick={() => setDetail(null)}><X/></button></div>{detail.errorGeneral && <p className="mb-3 rounded bg-red-50 p-2 text-red-700">{detail.errorGeneral}</p>}<table className="w-full text-sm"><thead><tr className="bg-gray-100"><th className="p-2 text-left">Oportunidad</th><th>Anterior</th><th>Nuevo</th><th>Estado</th><th>Error</th></tr></thead><tbody>{detail.detalles?.map((item) => <tr key={item.id} className="border-t"><td className="p-2">{item.opportunityId}</td><td>{item.previousAssignedTo || "-"}</td><td>{item.newAssignedTo || "-"}</td><td>{STATUS_LABELS[item.estado] || item.estado}</td><td>{item.errorMessage || "-"}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

function Field({ label, children }) { return <label><span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>{children}</label>; }
function Metric({ label, value }) { return <div className="rounded bg-gray-50 p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-xl font-bold">{value || 0}</div></div>; }
function ActionButton({ disabled, onClick, icon, label, danger = false }) { return <button disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1 rounded border px-2 py-1 disabled:opacity-50 ${danger ? "border-red-200 text-red-700" : "text-blue-700"}`}>{icon}{label}</button>; }
