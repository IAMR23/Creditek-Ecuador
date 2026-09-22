import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Clock3, Eye, History, Pause, Pencil, Play, Plus, RefreshCcw, X, Zap } from "lucide-react";
import api from "../../api/client";
import WorkflowProgramacionForm from "../../components/GHL/WorkflowProgramacionForm";

const messageOf = (error) => error.response?.data?.message || error.message || "No se pudo completar la operacion";
const localDate = (value) => value ? new Date(value).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "—";
const statusClass = (status) => ({
  completed: "bg-green-100 text-green-800", partial: "bg-amber-100 text-amber-800", failed: "bg-red-100 text-red-800",
  running: "bg-blue-100 text-blue-800", processing: "bg-blue-100 text-blue-800", interrupted: "bg-orange-100 text-orange-800", pending: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-800", skipped: "bg-gray-100 text-gray-700", failed_retryable: "bg-amber-100 text-amber-800", failed_final: "bg-red-100 text-red-800",
}[status] || "bg-gray-100 text-gray-700");
const STATUS_LABELS = {
  pending: "Pendiente", running: "En ejecucion", processing: "Procesando", completed: "Completada",
  partial: "Parcial", failed: "Fallida", interrupted: "Interrumpida", cancelled: "Cancelada",
  success: "Procesado", skipped: "Omitido", failed_retryable: "Fallido reintentable", failed_final: "Fallido definitivo",
};
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
const statusLabel = (status) => STATUS_LABELS[status] || status || "Sin estado";

export default function WorkflowsProgramados() {
  const [programaciones, setProgramaciones] = useState([]);
  const [ejecuciones, setEjecuciones] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scheduler, setScheduler] = useState(null);
  const [notice, setNotice] = useState("");
  const [executingId, setExecutingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [programResponse, executionResponse, pipelineResponse, workflowResponse, schedulerResponse] = await Promise.all([
        api.get("/api/ghl/workflows-programados/programaciones"),
        api.get("/api/ghl/workflows-programados/ejecuciones"),
        api.get("/api/ghl/workflows-programados/catalogos/pipelines"),
        api.get("/api/ghl/workflows-programados/catalogos/workflows"),
        api.get("/api/ghl/workflows-programados/scheduler/estado"),
      ]);
      setProgramaciones(programResponse.data.programaciones || []);
      setEjecuciones(executionResponse.data.ejecuciones || []);
      setPipelines(pipelineResponse.data.pipelines || []);
      setWorkflows(workflowResponse.data.workflows || []);
      setScheduler(schedulerResponse.data.scheduler || null);
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setBusy(true); setError("");
    try {
      if (editing) await api.put(`/api/ghl/workflows-programados/programaciones/${editing.id}`, form);
      else await api.post("/api/ghl/workflows-programados/programaciones", form);
      setShowForm(false); setEditing(null); setPreview(null); await load();
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(false); }
  };
  const runPreview = async (formOrRow) => {
    setBusy(true); setError("");
    try {
      const response = formOrRow.id
        ? await api.post(`/api/ghl/workflows-programados/programaciones/${formOrRow.id}/vista-previa`)
        : await api.post("/api/ghl/workflows-programados/vista-previa", formOrRow);
      setPreview({ name: formOrRow.nombre, ...response.data.preview });
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(false); }
  };
  const toggleState = async (row) => {
    setBusy(true); setError("");
    try { await api.patch(`/api/ghl/workflows-programados/programaciones/${row.id}/estado`, { activo: !row.activo }); await load(); }
    catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(false); }
  };
  const executeNow = async (row) => {
    if (!window.confirm(`Se inscribiran ahora los contactos elegibles de "${row.nombre}". ¿Desea continuar?`)) return;
    setExecutingId(row.id); setError(""); setNotice("");
    try {
      const response = await api.post(`/api/ghl/workflows-programados/programaciones/${row.id}/ejecutar-ahora`);
      const executionId = response.data.ejecucion?.id;
      setNotice(response.data.message || "Ejecucion manual iniciada.");
      if (executionId) {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
          const detailResponse = await api.get(`/api/ghl/workflows-programados/ejecuciones/${executionId}`);
          const current = detailResponse.data.ejecucion;
          setSelectedExecution(current);
          if (["completed", "partial", "failed", "cancelled", "interrupted"].includes(current.estado)) break;
        }
      }
      await load();
    } catch (requestError) { setError(messageOf(requestError)); }
    finally { setExecutingId(null); }
  };
  const openExecution = async (id) => {
    setBusy(true); setError("");
    try { const response = await api.get(`/api/ghl/workflows-programados/ejecuciones/${id}`); setSelectedExecution(response.data.ejecucion); }
    catch (requestError) { setError(messageOf(requestError)); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen space-y-4 bg-gray-50 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm font-semibold text-green-700">GoHighLevel</div><h1 className="text-2xl font-bold text-gray-900">Workflows programados</h1><p className="text-sm text-gray-500">Inscripcion automatica de contactos existentes segun pipeline y etapas.</p></div>
        <div className="flex gap-2"><button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm font-bold text-gray-700"><RefreshCcw size={17} className={loading ? "animate-spin" : ""} /> Actualizar</button><button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="inline-flex items-center gap-2 rounded bg-green-600 px-3 py-2 text-sm font-bold text-white"><Plus size={17} /> Nueva</button></div>
      </header>
      {error && <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle size={18} />{error}</div>}
      {notice && <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800"><Zap size={18} />{notice}</div>}
      {scheduler && <section className={`flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm ${scheduler.started && !scheduler.lastErrorCode ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><div className="flex items-center gap-2"><Activity size={18} /><strong>Scheduler: {scheduler.started ? "activo" : "no iniciado"}</strong><span>· Hora local {scheduler.localNow?.date} {scheduler.localNow?.time}</span><span>· Ultimo ciclo {localDate(scheduler.lastTickCompletedAt)}</span></div><div>{scheduler.lastErrorCode ? `Error: ${scheduler.lastErrorMessage || scheduler.lastErrorCode}` : `${scheduler.activeConfigurations || 0} programaciones activas revisadas`}</div></section>}
      {showForm && <WorkflowProgramacionForm initial={editing} pipelines={pipelines} workflows={workflows} busy={busy} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={save} onPreview={runPreview} />}
      {preview && <section className="rounded border border-blue-200 bg-blue-50 p-4"><div className="flex justify-between"><div><h2 className="font-bold text-blue-900">Vista previa: {preview.name}</h2><p className="text-sm text-blue-700">{preview.message}</p></div><button type="button" onClick={() => setPreview(null)}><X size={18} /></button></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Encontradas", preview.totalEncontrado], ["Elegibles", preview.totalElegible], ["Contactos unicos", preview.totalDeduplicado], ["Inscritos", preview.inscripcionesRealizadas]].map(([label, value]) => <div key={label} className="rounded bg-white p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-xl font-bold text-gray-900">{value ?? 0}</div></div>)}</div></section>}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="border-b p-4"><h2 className="font-bold text-gray-900">Programaciones</h2></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Origen</th><th className="px-4 py-3">Workflow</th><th className="px-4 py-3">Horario</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Resultados</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody className="divide-y">{programaciones.map((row) => <tr key={row.id} className="align-top"><td className="px-4 py-3 font-semibold text-gray-900">{row.nombre}<div className="mt-1 text-xs font-normal text-gray-500">Proxima: {localDate(row.proximaEjecucion)}</div></td><td className="px-4 py-3">{row.pipelineNombre}<div className="text-xs text-gray-500">{(row.stageNombres || []).map((stage) => stage.nombre).join(", ")}</div></td><td className="px-4 py-3">{row.workflowNombre}<div className="text-xs text-gray-500">Reingreso: {row.permitirReingreso ? "1 vez por dia" : "desactivado"}</div></td><td className="px-4 py-3"><Clock3 size={15} className="mr-1 inline" />{row.hora}<div className="text-xs text-gray-500">Dias: {(row.diasSemana || []).map((day) => DAY_LABELS[day]).filter(Boolean).join(", ")}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${row.activo ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{row.activo ? "Activa" : "Pausada"}</span></td><td className="px-4 py-3 text-xs">{row.ultimaEjecucion ? <><div>{row.ultimaEjecucion.totalProcesado} procesados</div><div>{row.ultimaEjecucion.totalOmitido} omitidos · {row.ultimaEjecucion.totalFallido} fallidos</div></> : "Sin ejecuciones"}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><button type="button" title="Ejecutar ahora" onClick={() => executeNow(row)} disabled={executingId !== null || !row.activo} className="inline-flex items-center gap-1 rounded border border-green-600 px-2 py-1.5 font-semibold text-green-700 disabled:opacity-40"><Zap size={15} />{executingId === row.id ? "Ejecutando..." : "Ejecutar ahora"}</button><button type="button" title="Editar" onClick={() => { setEditing(row); setShowForm(true); }} className="rounded border p-2"><Pencil size={15} /></button><button type="button" title="Vista previa" onClick={() => runPreview(row)} className="rounded border p-2"><Eye size={15} /></button><button type="button" title={row.activo ? "Pausar" : "Activar"} onClick={() => toggleState(row)} disabled={busy || executingId !== null} className="rounded border p-2">{row.activo ? <Pause size={15} /> : <Play size={15} />}</button></div></td></tr>)}{loading && <tr><td colSpan="7" className="p-8 text-center text-gray-500">Cargando programaciones...</td></tr>}{!loading && !programaciones.length && <tr><td colSpan="7" className="p-8 text-center text-gray-500">No hay programaciones creadas.</td></tr>}</tbody></table></div></section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="flex items-center gap-2 border-b p-4"><History size={18} /><h2 className="font-bold text-gray-900">Historial de ejecuciones</h2></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Programacion</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Encontrados</th><th className="px-4 py-3">Procesados</th><th className="px-4 py-3">Omitidos</th><th className="px-4 py-3">Fallidos</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y">{ejecuciones.map((row) => <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.configuracion?.nombre || `Programacion ${row.configuracionId}`}<div className="text-xs font-normal text-gray-500">{row.tipo === "manual" ? "Ejecucion manual" : "Ejecucion programada"}</div></td><td className="px-4 py-3">{localDate(row.scheduledFor)}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(row.estado)}`}>{statusLabel(row.estado)}</span></td><td className="px-4 py-3">{row.totalEncontrado}</td><td className="px-4 py-3">{row.totalProcesado}</td><td className="px-4 py-3">{row.totalOmitido}</td><td className="px-4 py-3">{row.totalFallido}</td><td className="px-4 py-3"><button type="button" onClick={() => openExecution(row.id)} className="text-sm font-bold text-green-700">Ver detalle</button></td></tr>)}{loading && <tr><td colSpan="8" className="p-8 text-center text-gray-500">Cargando historial...</td></tr>}{!loading && !ejecuciones.length && <tr><td colSpan="8" className="p-8 text-center text-gray-500">Todavia no hay ejecuciones.</td></tr>}</tbody></table></div></section>

      {selectedExecution && <section className="rounded-xl border bg-white p-4 shadow-sm"><div className="mb-3 flex justify-between"><div><h2 className="font-bold text-gray-900">Detalle de ejecucion #{selectedExecution.id}</h2><p className="text-sm text-gray-500">{selectedExecution.configuracion?.nombre} · {localDate(selectedExecution.scheduledFor)}</p>{(selectedExecution.mensajeGeneral || selectedExecution.codigoGeneral) && <p className="mt-1 text-sm text-amber-700">{selectedExecution.mensajeGeneral || selectedExecution.codigoGeneral}</p>}</div><button type="button" onClick={() => setSelectedExecution(null)}><X size={20} /></button></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Referencia</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Intentos</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Fecha</th></tr></thead><tbody className="divide-y">{(selectedExecution.detalles || []).map((detail) => <tr key={detail.id}><td className="px-3 py-2">Oportunidad {detail.opportunityId || "—"}</td><td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass(detail.estado)}`}>{statusLabel(detail.estado)}</span></td><td className="px-3 py-2">{detail.intentos}</td><td className="px-3 py-2">{detail.mensaje || detail.errorCode || "Correcto"}</td><td className="px-3 py-2">{localDate(detail.processedAt)}</td></tr>)}</tbody></table></div></section>}
    </div>
  );
}
