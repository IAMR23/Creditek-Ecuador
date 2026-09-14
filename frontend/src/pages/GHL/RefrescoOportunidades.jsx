/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pause, Play, RefreshCcw, RotateCcw, Save, Search, ShieldAlert, X } from "lucide-react";
import api from "../../api/client";

const DAYS = [[1, "Lunes"], [2, "Martes"], [3, "Miércoles"], [4, "Jueves"], [5, "Viernes"], [6, "Sábado"], [0, "Domingo"]];
const ACTIVE_STATES = ["running", "pause_requested", "cancel_requested"];
const STATUS_LABELS = {
  running: "En ejecución", pause_requested: "Pausando...", paused: "Pausada",
  cancel_requested: "Cancelando...", completed: "Completada", partial: "Parcial",
  failed: "Fallida", cancelled: "Cancelada", interrupted: "Interrumpida", skipped: "Omitida",
};
const empty = {
  nombre: "Refresco de oportunidades",
  pipelineId: "",
  stageId: "",
  hora: "09:00",
  intervaloMinutos: 1,
  zonaHoraria: "America/Guayaquil",
  diasSemana: [1, 2, 3, 4, 5],
  modo: "refresh_non_management",
  usuariosGhl: [],
  activo: true,
};
const inputClass = "h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";
const messageOf = (error) => error.response?.data?.message || error.message || "Ocurrió un error";

export default function RefrescoOportunidades() {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(empty);
  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    const response = await api.get("/api/ghl/repartos/ejecuciones", { params: { tipo: "refresco" } });
    setHistory(response.data.ejecuciones || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pipelineResponse, configResponse, historyResponse] = await Promise.all([
        api.get("/api/ghl/repartos/catalogos/pipelines"),
        api.get("/api/ghl/repartos/configuraciones", { params: { tipo: "refresco" } }),
        api.get("/api/ghl/repartos/ejecuciones", { params: { tipo: "refresco" } }),
      ]);
      setPipelines(pipelineResponse.data.pipelines || []);
      setConfigs(configResponse.data.configuraciones || []);
      setHistory(historyResponse.data.ejecuciones || []);
      if (!selectedId && configResponse.data.configuraciones?.[0]) {
        setSelectedId(configResponse.data.configuraciones[0].id);
        setForm(configResponse.data.configuraciones[0]);
      }
      setError("");
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

  const hasActiveExecution = history.some((run) => ACTIVE_STATES.includes(run.estado));
  useEffect(() => {
    if (!hasActiveExecution) return undefined;
    const timer = window.setInterval(() => loadHistory().catch((requestError) => setError(messageOf(requestError))), 2500);
    return () => window.clearInterval(timer);
  }, [hasActiveExecution, loadHistory]);

  const set = (key, value) => { setForm((old) => ({ ...old, [key]: value })); setPreview(null); };
  const toggleDay = (day) => set("diasSemana", form.diasSemana.includes(day) ? form.diasSemana.filter((item) => item !== day) : [...form.diasSemana, day]);
  const valid = useMemo(() => form.pipelineId && form.stageId && form.hora && form.diasSemana.length, [form]);

  const save = async () => {
    setBusy("save"); setError("");
    try {
      const payload = { ...form, modo: "refresh_non_management", usuariosGhl: [], intervaloMinutos: 1 };
      const response = selectedId
        ? await api.put(`/api/ghl/repartos/configuraciones/${selectedId}`, payload)
        : await api.post("/api/ghl/repartos/configuraciones", payload);
      setSelectedId(response.data.configuracion.id);
      setForm(response.data.configuracion);
      await load();
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); }
  };

  const doPreview = async () => {
    if (!valid) return setError("Complete pipeline, etapa excluida, hora y días de ejecución");
    setBusy("preview");
    try {
      const response = await api.post("/api/ghl/repartos/vista-previa", {
        ...form,
        modo: "refresh_non_management",
        usuariosGhl: [],
        intervaloMinutos: 1,
      });
      setPreview(response.data.preview);
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); }
  };

  const execute = async () => {
    if (!selectedId) return setError("Guarde la configuración antes de ejecutar");
    if (!window.confirm("¿Confirma que desea redistribuir todas las oportunidades fuera de la etapa excluida entre los asesores que están en Play ahora?")) return;
    setBusy("execute"); setError("");
    try { await api.post(`/api/ghl/repartos/configuraciones/${selectedId}/execute`, { confirm: true }); }
    catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); await loadHistory().catch(() => {}); }
  };

  const controlExecution = async (run, action) => {
    setBusy(`${action}:${run.id}`); setError("");
    try { await api.post(`/api/ghl/repartos/ejecuciones/${run.id}/${action}`); await loadHistory(); }
    catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); }
  };

  const showDetail = async (id) => {
    try { const response = await api.get(`/api/ghl/repartos/ejecuciones/${id}`); setDetail(response.data.ejecucion); }
    catch (requestError) { setError(messageOf(requestError)); }
  };

  const choose = (id) => {
    if (!id) { setSelectedId(null); setForm(empty); setPreview(null); return; }
    const row = configs.find((item) => String(item.id) === id);
    setSelectedId(row.id); setForm(row); setPreview(null);
  };

  return <div className="min-h-screen space-y-4 bg-gray-50 p-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-sm font-semibold text-green-700">GoHighLevel</div><h1 className="text-2xl font-bold text-gray-900">Refresco de oportunidades</h1><p className="text-sm text-gray-500">Redistribuye únicamente leads creados hoy y fuera de Gestión entre quienes estén en Play · America/Guayaquil</p></div>
      <div className={`rounded-full px-3 py-1 text-xs font-bold ${error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{loading ? "Comprobando conexión..." : error ? "GHL no disponible" : "GHL conectado"}</div>
    </header>
    {error && <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={18}/><span className="flex-1">{error}</span><button onClick={() => setError("")}><X size={16}/></button></div>}

    <section className="space-y-4 rounded border bg-white p-4 shadow-sm">
      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><b>Alcance diario:</b> solo se procesan leads creados el mismo día de la ejecución. Los destinatarios se toman automáticamente entre los asesores vinculados que estén en Play; quien esté en descanso no recibirá clientes.</div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Configuración"><select className={inputClass} value={selectedId || ""} onChange={(event) => choose(event.target.value)}><option value="">Nueva configuración</option>{configs.map((config) => <option key={config.id} value={config.id}>{config.nombre}</option>)}</select></Field>
        <Field label="Nombre"><input className={inputClass} value={form.nombre} onChange={(event) => set("nombre", event.target.value)}/></Field>
        <Field label="Pipeline"><select className={inputClass} value={form.pipelineId} onChange={(event) => { setForm((old) => ({ ...old, pipelineId: event.target.value, stageId: "" })); setPreview(null); }}><option value="">Seleccione...</option>{pipelines.map((pipeline) => <option key={pipeline.id || pipeline._id} value={pipeline.id || pipeline._id}>{pipeline.name}</option>)}</select></Field>
        <Field label="Etapa excluida (Gestión)"><select className={inputClass} value={form.stageId} onChange={(event) => set("stageId", event.target.value)} disabled={!form.pipelineId}><option value="">Seleccione la etapa Gestión...</option>{stages.map((stage) => <option key={stage.id || stage._id} value={stage.id || stage._id}>{stage.name}</option>)}</select></Field>
        <Field label="Hora de ejecución"><input type="time" className={inputClass} value={form.hora} onChange={(event) => set("hora", event.target.value)}/></Field>
        <Field label="Zona horaria"><input className={`${inputClass} bg-gray-100`} value="America/Guayaquil" disabled/></Field>
        <Field label="Estado"><label className="flex h-10 items-center gap-2"><input type="checkbox" checked={form.activo} onChange={(event) => set("activo", event.target.checked)} className="h-5 w-5 accent-green-600"/> {form.activo ? "Activo" : "Inactivo"}</label></Field>
      </div>
      <div><div className="mb-2 text-xs font-semibold text-gray-600">Días de ejecución</div><div className="flex flex-wrap gap-2">{DAYS.map(([day, name]) => <button type="button" key={day} onClick={() => toggleDay(day)} className={`rounded px-3 py-2 text-sm font-semibold ${form.diasSemana.includes(day) ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"}`}>{name}</button>)}</div></div>
      <div className="flex flex-wrap gap-2">
        <button disabled={!valid || busy} onClick={save} className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/>{busy === "save" ? "Guardando..." : "Guardar configuración"}</button>
        <button disabled={!valid || busy} onClick={doPreview} className="flex items-center gap-2 rounded border px-4 py-2 text-sm font-bold disabled:opacity-50"><Search size={16}/>{busy === "preview" ? "Consultando..." : "Vista previa"}</button>
        <button disabled={!selectedId || busy} onClick={execute} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Play size={16}/>{busy === "execute" ? "Ejecutando..." : "Ejecutar ahora"}</button>
        <button onClick={load} disabled={loading} className="rounded border p-2"><RefreshCcw size={17} className={loading ? "animate-spin" : ""}/></button>
      </div>
    </section>

    {preview && <section className="rounded border bg-white p-4 shadow-sm"><h2 className="font-bold">Vista previa segura</h2><p className="mb-3 text-xs text-gray-500">Incluye únicamente leads creados hoy ({preview.rangoFechas?.fechaInicio}), cualquiera que sea su estado, excepto los que estén en <b>{form.stageNombre || stages.find((stage) => String(stage.id || stage._id) === String(form.stageId))?.name || "la etapa seleccionada"}</b>.</p>{preview.advertencia && <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{preview.advertencia}</div>}<div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"><Metric label="Encontradas hoy" value={preview.totalEncontradas}/><Metric label="Elegibles" value={preview.totalElegibles}/><Metric label="En Play ahora" value={preview.usuariosActivos}/><Metric label="En descanso" value={preview.usuariosPausados}/><Metric label="Vínculos inválidos" value={preview.usuariosInvalidos}/><Metric label="Omitidas" value={preview.totalOmitidas}/></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{preview.usuarios.map((user) => <div key={user.id} className="rounded bg-green-50 p-3 text-sm"><b>{user.name}</b><div>{user.cantidad} oportunidades</div></div>)}</div></section>}

    <section className="overflow-hidden rounded border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b p-4"><b>Historial de refrescos</b>{hasActiveExecution && <span className="text-xs font-semibold text-blue-700">Actualizando automáticamente...</span>}</div>
      <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-gray-100 text-left"><tr>{["Fecha", "Pipeline / exclusión", "Resultado", "Estado", "Ejecutor", "Acciones"].map((header) => <th key={header} className="px-3 py-2">{header}</th>)}</tr></thead><tbody>
        {history.length ? history.map((run) => <tr key={run.id} className="border-t align-top"><td className="whitespace-nowrap px-3 py-2">{new Date(run.startedAt).toLocaleString("es-EC")}</td><td className="px-3 py-2">{run.pipelineNombre}<br/><span className="text-xs text-gray-500">Excepto: {run.stageNombre}</span></td><td className="px-3 py-2">{run.totalAsignadas || 0} reasignadas<br/><span className="text-xs text-gray-500">{run.totalOmitidas || 0} omitidas · {run.totalErrores || 0} errores</span></td><td className="px-3 py-2 font-semibold">{STATUS_LABELS[run.estado] || run.estado}{run.isStale && <span className="block text-xs text-red-700">Heartbeat vencido</span>}</td><td className="px-3 py-2">{run.ejecutadoPor?.nombre || (run.tipo === "scheduled" ? "Programador" : "-")}</td><td className="px-3 py-2"><div className="flex flex-wrap gap-1"><button className="rounded border px-2 py-1 text-green-700" onClick={() => showDetail(run.id)}>Detalle</button>{run.estado === "running" && <ActionButton disabled={busy} onClick={() => controlExecution(run, "pause")} icon={<Pause size={14}/>} label="Pausar"/>}{run.estado === "paused" && <ActionButton disabled={busy} onClick={() => controlExecution(run, "resume")} icon={<RotateCcw size={14}/>} label="Reanudar"/>}{run.isStale && <ActionButton disabled={busy} onClick={() => controlExecution(run, "force-finish-stale")} icon={<ShieldAlert size={14}/>} label="Finalizar atascada"/>}</div></td></tr>) : <tr><td colSpan="6" className="p-8 text-center text-gray-500">Sin refrescos registrados.</td></tr>}
      </tbody></table></div>
    </section>

    {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded bg-white p-4 shadow-xl"><div className="mb-3 flex justify-between"><h2 className="font-bold">Refresco #{detail.id}</h2><button onClick={() => setDetail(null)}><X/></button></div>{detail.errorGeneral && <p className="mb-3 rounded bg-red-50 p-2 text-red-700">{detail.errorGeneral}</p>}<table className="w-full text-sm"><thead><tr className="bg-gray-100"><th className="p-2 text-left">Oportunidad</th><th>Propietario anterior</th><th>Nuevo propietario</th><th>Estado</th><th>Error</th></tr></thead><tbody>{detail.detalles?.map((item) => <tr key={item.id} className="border-t"><td className="p-2">{item.opportunityId}</td><td>{item.previousAssignedTo || "-"}</td><td>{item.newAssignedTo || "-"}</td><td>{STATUS_LABELS[item.estado] || item.estado}</td><td>{item.errorMessage || "-"}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

function Field({ label, children }) { return <label><span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>{children}</label>; }
function Metric({ label, value }) { return <div className="rounded bg-gray-50 p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-xl font-bold">{value || 0}</div></div>; }
function ActionButton({ disabled, onClick, icon, label }) { return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-blue-700 disabled:opacity-50">{icon}{label}</button>; }
