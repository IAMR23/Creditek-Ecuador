/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Eye, Save, X } from "lucide-react";
import api from "../../api/client";
import { isWorkflowProgramacionValid, toggleSelection } from "../../utils/workflowProgramacion";

const DAYS = [
  [1, "Lun"], [2, "Mar"], [3, "Mie"], [4, "Jue"], [5, "Vie"], [6, "Sab"], [0, "Dom"],
];

const emptyForm = {
  nombre: "",
  pipelineId: "",
  stageIds: [],
  workflowId: "",
  hora: "10:00",
  diasSemana: [1, 2, 3, 4, 5, 6],
  zonaHoraria: "America/Guayaquil",
  permitirReingreso: false,
  activo: true,
};

export default function WorkflowProgramacionForm({ initial, pipelines, workflows, busy, onCancel, onSave, onPreview }) {
  const [form, setForm] = useState(emptyForm);
  const [stages, setStages] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);

  useEffect(() => {
    setForm(initial ? {
      ...emptyForm,
      ...initial,
      stageIds: initial.stageIds || [],
      diasSemana: initial.diasSemana || [],
    } : emptyForm);
  }, [initial]);

  useEffect(() => {
    let active = true;
    if (!form.pipelineId) { setStages([]); return undefined; }
    setLoadingStages(true);
    api.get(`/api/ghl/workflows-programados/catalogos/pipelines/${form.pipelineId}/stages`)
      .then((response) => { if (active) setStages(response.data.stages || []); })
      .catch(() => { if (active) setStages([]); })
      .finally(() => { if (active) setLoadingStages(false); });
    return () => { active = false; };
  }, [form.pipelineId]);

  const toggleDay = (day) => setForm((current) => ({
    ...current,
    diasSemana: toggleSelection(current.diasSemana, day),
  }));
  const toggleStage = (id) => setForm((current) => ({
    ...current,
    stageIds: toggleSelection(current.stageIds, id),
  }));
  const valid = isWorkflowProgramacionValid(form);

  return (
    <section className="rounded-xl border border-green-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{initial ? "Editar programacion" : "Nueva programacion"}</h2>
          <p className="text-sm text-gray-500">Los contactos se consultan en GHL al comenzar cada ejecucion.</p>
        </div>
        <button type="button" onClick={onCancel} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar formulario"><X size={20} /></button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-semibold text-gray-700">Nombre
          <input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} maxLength={160} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal outline-none focus:border-green-500" placeholder="Seguimiento diario WhatsApp" />
        </label>
        <label className="text-sm font-semibold text-gray-700">Pipeline
          <select value={form.pipelineId} onChange={(event) => setForm({ ...form, pipelineId: event.target.value, stageIds: [] })} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 font-normal outline-none focus:border-green-500">
            <option value="">Seleccione...</option>
            {pipelines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <fieldset className="rounded border border-gray-200 p-3 lg:col-span-2">
          <legend className="px-1 text-sm font-semibold text-gray-700">Etapas de origen</legend>
          {loadingStages && <p className="text-sm text-gray-500">Cargando etapas...</p>}
          {!loadingStages && !form.pipelineId && <p className="text-sm text-gray-500">Seleccione primero un pipeline.</p>}
          {!loadingStages && form.pipelineId && !stages.length && <p className="text-sm text-amber-700">El pipeline no tiene etapas disponibles.</p>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stages.map((stage) => (
              <label key={stage.id} className="flex items-center gap-2 rounded border border-gray-200 p-2 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={form.stageIds.includes(stage.id)} onChange={() => toggleStage(stage.id)} className="accent-green-600" />
                <span>{stage.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="text-sm font-semibold text-gray-700">Workflow activo de GHL
          <select value={form.workflowId} onChange={(event) => setForm({ ...form, workflowId: event.target.value })} className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 font-normal outline-none focus:border-green-500">
            <option value="">Seleccione...</option>
            {workflows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-gray-700">Hora de ejecucion
          <input type="time" value={form.hora} onChange={(event) => setForm({ ...form, hora: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 font-normal outline-none focus:border-green-500" />
          <span className="mt-1 block text-xs font-normal text-gray-500">Zona horaria: America/Guayaquil</span>
        </label>

        <fieldset className="lg:col-span-2">
          <legend className="mb-2 text-sm font-semibold text-gray-700">Dias de la semana</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(([day, label]) => <button key={day} type="button" onClick={() => toggleDay(day)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${form.diasSemana.includes(day) ? "border-green-600 bg-green-600 text-white" : "border-gray-300 bg-white text-gray-600"}`}>{label}</button>)}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 rounded border border-gray-200 p-3 text-sm">
          <input type="checkbox" checked={form.activo} onChange={(event) => setForm({ ...form, activo: event.target.checked })} className="mt-1 accent-green-600" />
          <span><strong className="block text-gray-800">Programacion activa</strong><span className="text-gray-500">Las programaciones pausadas no se ejecutan.</span></span>
        </label>
        <label className="flex items-start gap-3 rounded border border-gray-200 p-3 text-sm">
          <input type="checkbox" checked={form.permitirReingreso} onChange={(event) => setForm({ ...form, permitirReingreso: event.target.checked })} className="mt-1 accent-green-600" />
          <span><strong className="block text-gray-800">Permitir reingreso al workflow</strong><span className="text-gray-500">Activado: maximo una inscripcion por contacto y workflow en cada dia local. Desactivado por defecto.</span></span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => onPreview(form)} disabled={!valid || busy} className="inline-flex items-center gap-2 rounded border border-green-600 px-4 py-2 text-sm font-bold text-green-700 disabled:opacity-50"><Eye size={17} /> Vista previa</button>
        <button type="button" onClick={() => onSave(form)} disabled={!valid || busy} className="inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"><Save size={17} /> {busy ? "Guardando..." : "Guardar"}</button>
      </div>
    </section>
  );
}
