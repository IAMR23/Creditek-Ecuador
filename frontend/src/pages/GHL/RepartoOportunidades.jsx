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
const empty = { nombre: "Reparto de oportunidades", pipelineId: "", stageId: "", hora: "09:00", intervaloMinutos: 1, maxPendientesPorAsesor: 10, zonaHoraria: "America/Guayaquil", diasSemana: [1, 2, 3, 4, 5], modo: "unassigned", usuariosGhl: [], activo: true };
const emptyRealtime = { pipelineId: "", pipelineNombre: "", stageIds: [], stageNombres: [], maxPendientesPorAsesor: 2, activo: false };
const messageOf = (error) => error.response?.data?.message || error.message || "Ocurrio un error";
const inputClass = "h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

export default function RepartoOportunidades() {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [realtimeConfig, setRealtimeConfig] = useState(emptyRealtime);
  const [savedRealtimeConfig, setSavedRealtimeConfig] = useState(emptyRealtime);
  const [realtimeStages, setRealtimeStages] = useState([]);
  const [realtimeStatus, setRealtimeStatus] = useState(null);
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
  const [success, setSuccess] = useState("");

  const loadHistory = useCallback(async () => {
    const response = await api.get("/api/ghl/repartos/ejecuciones", { params: { tipo: "reparto" } });
    setHistory(response.data.ejecuciones || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pipelineResponse, userResponse, configResponse, historyResponse, realtimeResponse] = await Promise.all([
        api.get("/api/ghl/repartos/catalogos/pipelines"),
        api.get("/api/ghl/repartos/catalogos/users"),
        api.get("/api/ghl/repartos/configuraciones", { params: { tipo: "reparto" } }),
        api.get("/api/ghl/repartos/ejecuciones", { params: { tipo: "reparto" } }),
        api.get("/api/ghl/repartos/configuracion-tiempo-real"),
      ]);
      setPipelines(pipelineResponse.data.pipelines || []);
      setUsers(userResponse.data.users || []);
      setConfigs(configResponse.data.configuraciones || []);
      setHistory(historyResponse.data.ejecuciones || []);
      const loadedRealtimeConfig = { ...emptyRealtime, ...(realtimeResponse.data.configuracion || {}) };
      setRealtimeConfig(loadedRealtimeConfig);
      setSavedRealtimeConfig(loadedRealtimeConfig);
      setRealtimeStatus(realtimeResponse.data.estado || null);
      if (!selectedId && configResponse.data.configuraciones?.[0]) {
        setSelectedId(configResponse.data.configuraciones[0].id);
        setForm({ ...configResponse.data.configuraciones[0], maxPendientesPorAsesor: configResponse.data.configuraciones[0].maxPendientesPorAsesor ?? 10 });
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
  useEffect(() => {
    if (!realtimeConfig.pipelineId) { setRealtimeStages([]); return; }
    api.get(`/api/ghl/repartos/catalogos/pipelines/${encodeURIComponent(realtimeConfig.pipelineId)}/stages`)
      .then((response) => setRealtimeStages(response.data.stages || []))
      .catch((requestError) => setError(messageOf(requestError)));
  }, [realtimeConfig.pipelineId]);

  const hasActiveExecution = executionWaiting || Boolean(controlBusy) || history.some((run) => ACTIVE_STATES.includes(run.estado));
  useEffect(() => {
    if (!hasActiveExecution) return undefined;
    const timer = window.setInterval(() => loadHistory().catch((requestError) => setError(messageOf(requestError))), 2500);
    return () => window.clearInterval(timer);
  }, [hasActiveExecution, loadHistory]);

  const set = (key, value) => { setForm((old) => ({ ...old, [key]: value })); setPreview(null); };
  const toggleUser = (user) => set("usuariosGhl", form.usuariosGhl.some((item) => item.id === user.id) ? form.usuariosGhl.filter((item) => item.id !== user.id) : [...form.usuariosGhl, user]);
  const toggleDay = (day) => set("diasSemana", form.diasSemana.includes(day) ? form.diasSemana.filter((item) => item !== day) : [...form.diasSemana, day]);
  const valid = useMemo(() => form.pipelineId && form.stageId && form.hora && form.diasSemana.length && form.usuariosGhl.length >= 2 && Number.isInteger(Number(form.maxPendientesPorAsesor)) && Number(form.maxPendientesPorAsesor) >= 1 && Number(form.maxPendientesPorAsesor) <= 1000, [form]);
  const realtimeValid = useMemo(() => realtimeConfig.pipelineId
    && (!realtimeConfig.activo || realtimeConfig.stageIds.length > 0)
    && Number.isInteger(Number(realtimeConfig.maxPendientesPorAsesor))
    && Number(realtimeConfig.maxPendientesPorAsesor) >= 1
    && Number(realtimeConfig.maxPendientesPorAsesor) <= 1000, [realtimeConfig]);

  const toggleRealtimeStage = (stageId) => {
    setRealtimeConfig((old) => ({
      ...old,
      stageIds: old.stageIds.includes(stageId)
        ? old.stageIds.filter((id) => id !== stageId)
        : [...old.stageIds, stageId],
    }));
    setSuccess("");
  };
  const saveRealtime = async () => {
    setBusy("realtime-save"); setError(""); setSuccess("");
    try {
      const response = await api.put("/api/ghl/repartos/configuracion-tiempo-real", realtimeConfig);
      const saved = { ...emptyRealtime, ...response.data.configuracion };
      setRealtimeConfig(saved);
      setSavedRealtimeConfig(saved);
      setRealtimeStatus(response.data.configuracion.activo ? null : {
        code: "GHL_REALTIME_CONFIGURATION_INACTIVE",
        warning: "El reparto en tiempo real esta inactivo. No se asignaran oportunidades.",
      });
      setSuccess(response.data.message || "Configuracion guardada correctamente");
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); }
  };
  const toggleRealtimeState = async () => {
    setBusy("realtime-state"); setError(""); setSuccess("");
    try {
      const response = await api.patch("/api/ghl/repartos/configuracion-tiempo-real/estado", {
        activo: !savedRealtimeConfig.activo,
      });
      setRealtimeConfig((old) => ({ ...old, ...response.data.configuracion }));
      setSavedRealtimeConfig((old) => ({ ...old, ...response.data.configuracion }));
      setRealtimeStatus(response.data.configuracion.activo ? null : {
        code: "GHL_REALTIME_CONFIGURATION_INACTIVE",
        warning: "El reparto en tiempo real esta inactivo. No se asignaran oportunidades.",
      });
      setSuccess(response.data.message);
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(""); }
  };

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
    setSelectedId(row.id); setForm({ ...row, maxPendientesPorAsesor: row.maxPendientesPorAsesor ?? 10 }); setPreview(null);
  };

  return <div className="min-h-screen space-y-4 bg-gray-50 p-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-sm font-semibold text-green-700">GoHighLevel</div><h1 className="text-2xl font-bold text-gray-900">Reparto de oportunidades</h1><p className="text-sm text-gray-500">Consulta periódica de oportunidades sin propietario · America/Guayaquil</p></div>
      <div className={`rounded-full px-3 py-1 text-xs font-bold ${error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{loading ? "Comprobando conexion..." : error ? "GHL no disponible" : "GHL conectado"}</div>
    </header>
    {error && <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={18}/><span className="flex-1">{error}</span><button onClick={() => setError("")}><X size={16}/></button></div>}
    {success && <div className="flex items-center justify-between rounded border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"><span>{success}</span><button onClick={() => setSuccess("")}><X size={16}/></button></div>}

    <section className="space-y-4 rounded border border-green-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Configuración del reparto en tiempo real</h2>
          <p className="text-sm text-gray-500">Las oportunidades abiertas de las etapas elegidas comparten un solo límite por asesor en Play.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${savedRealtimeConfig.activo ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>
          {savedRealtimeConfig.activo ? "Activo" : "Inactivo"}
        </span>
      </div>

      {realtimeStatus?.warning && <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800"><AlertTriangle size={17}/>{realtimeStatus.warning}</div>}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Pipeline de GHL">
          <select className={inputClass} value={realtimeConfig.pipelineId || ""} onChange={(event) => {
            setRealtimeConfig((old) => ({ ...old, pipelineId: event.target.value, pipelineNombre: "", stageIds: [], stageNombres: [] }));
            setSuccess("");
          }}>
            <option value="">Seleccione...</option>
            {pipelines.map((pipeline) => <option key={pipeline.id || pipeline._id} value={pipeline.id || pipeline._id}>{pipeline.name}</option>)}
          </select>
        </Field>
        <Field label="Máximo de pendientes por asesor">
          <input type="number" min="1" max="1000" step="1" className={inputClass} value={realtimeConfig.maxPendientesPorAsesor} onChange={(event) => setRealtimeConfig((old) => ({ ...old, maxPendientesPorAsesor: event.target.value === "" ? "" : Number(event.target.value) }))}/>
        </Field>
        <div className="rounded bg-gray-50 p-3 text-sm">
          <div className="text-xs font-semibold text-gray-500">Última actualización</div>
          <div className="mt-1 font-medium">{savedRealtimeConfig.updatedAt ? new Date(savedRealtimeConfig.updatedAt).toLocaleString("es-EC") : "Aún no guardada"}</div>
          {savedRealtimeConfig.actualizadoPorId && <div className="text-xs text-gray-500">Usuario #{savedRealtimeConfig.actualizadoPorId}</div>}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-gray-600">Etapas que participan ({realtimeConfig.stageIds.length} seleccionadas)</div>
        <div className="grid max-h-56 gap-2 overflow-auto rounded border p-2 md:grid-cols-2 lg:grid-cols-3">
          {!realtimeConfig.pipelineId && <div className="p-3 text-sm text-gray-500">Seleccione un pipeline para consultar sus etapas reales.</div>}
          {realtimeConfig.pipelineId && !realtimeStages.length && <div className="p-3 text-sm text-gray-500">Este pipeline no devolvió etapas.</div>}
          {realtimeStages.map((stage) => {
            const stageId = String(stage.id || stage._id || "");
            return <label key={stageId} className="flex items-center gap-2 rounded p-2 hover:bg-green-50">
              <input type="checkbox" className="h-4 w-4 accent-green-600" checked={realtimeConfig.stageIds.includes(stageId)} onChange={() => toggleRealtimeStage(stageId)}/>
              <span className="text-sm font-medium">{stage.name || stage.title || "Etapa sin nombre"}</span>
            </label>;
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-gray-600">Etapas activas actualmente</div>
        <div className="flex flex-wrap gap-2">
          {savedRealtimeConfig.stageNombres?.length
            ? savedRealtimeConfig.stageNombres.map((name, index) => <span key={`${savedRealtimeConfig.stageIds[index]}-${name}`} className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">{name}</span>)
            : <span className="text-sm text-gray-500">No hay etapas guardadas.</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button disabled={!realtimeValid || busy} onClick={saveRealtime} className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={16}/>{busy === "realtime-save" ? "Guardando..." : "Guardar configuración"}</button>
        <button disabled={!savedRealtimeConfig.id || busy || (!savedRealtimeConfig.activo && !savedRealtimeConfig.stageIds.length)} onClick={toggleRealtimeState} className={`flex items-center gap-2 rounded px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${savedRealtimeConfig.activo ? "bg-amber-600" : "bg-blue-600"}`}>
          {savedRealtimeConfig.activo ? <Pause size={16}/> : <Play size={16}/>}
          {busy === "realtime-state" ? "Actualizando..." : savedRealtimeConfig.activo ? "Desactivar reparto" : "Activar reparto"}
        </button>
      </div>
    </section>



    </div>;
}

function Field({ label, children }) { return <label><span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>{children}</label>; }
