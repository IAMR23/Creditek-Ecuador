import { useState } from "react";
import { Plus, X } from "lucide-react";

const dash = "-";
const EMPTY_FAMILY_REFERENCE = {
  nombre: "",
  pariente: "",
  telefono: "",
  ocupacion: "",
  tituloProfesion: "",
  observacion: "",
};
const EMPTY_WORK_REFERENCE = {
  empresaLugarTrabajo: "",
  cargoActividadRealizada: "",
  tiempoTrabajado: "",
  motivoSalida: "",
  jefeEncargado: "",
  telefonoReferencia: "",
  observacion: "",
};
const FAMILY_FIELDS = [
  { key: "nombre", label: "Nombre completo", maxLength: 150, required: true },
  { key: "pariente", label: "Parentesco", maxLength: 80, required: true },
  { key: "telefono", label: "Teléfono", maxLength: 30, required: true },
  { key: "ocupacion", label: "Ocupación", maxLength: 120 },
  { key: "tituloProfesion", label: "Profesión", maxLength: 120 },
  {
    key: "observacion",
    label: "Observación",
    maxLength: 1000,
    fullWidth: true,
    multiline: true,
  },
];
const WORK_FIELDS = [
  {
    key: "empresaLugarTrabajo",
    label: "Empresa o lugar de trabajo",
    maxLength: 150,
    required: true,
  },
  { key: "cargoActividadRealizada", label: "Cargo", maxLength: 120 },
  { key: "tiempoTrabajado", label: "Tiempo trabajado", maxLength: 80 },
  {
    key: "jefeEncargado",
    label: "Jefe o encargado",
    maxLength: 150,
    required: true,
  },
  {
    key: "telefonoReferencia",
    label: "Teléfono de referencia",
    maxLength: 30,
    required: true,
  },
  {
    key: "motivoSalida",
    label: "Motivo de salida",
    maxLength: 300,
    fullWidth: true,
  },
  {
    key: "observacion",
    label: "Observación",
    maxLength: 1000,
    fullWidth: true,
    multiline: true,
  },
];

const getFamilyReferences = (interview) =>
  Array.isArray(interview?.formulario?.personas_con_quien_vive)
    ? interview.formulario.personas_con_quien_vive
    : [];

const getWorkReferences = (interview) =>
  Array.isArray(interview?.formulario?.historial_laboral)
    ? interview.formulario.historial_laboral
    : [];

function ReferenceField({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-xs font-semibold text-slate-700">
        {value || dash}
      </dd>
    </div>
  );
}

function CalledCheck({
  interview,
  type,
  index,
  reference,
  savingReferenceKey,
  onCalledChange,
}) {
  const key = `${interview.id}-${type}-${index}`;
  const saving = savingReferenceKey === key;
  const called = Boolean(reference.llamado);

  return (
    <label
      className={`mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs font-bold transition ${
        called
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-600"
      } ${saving ? "cursor-wait opacity-60" : ""}`}
    >
      <span className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={called}
          disabled={saving}
          onChange={(event) =>
            onCalledChange(interview, type, index, event.target.checked)
          }
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        {called ? "Llamado" : "No llamado"}
      </span>
      {saving && <span className="text-[10px]">Guardando...</span>}
    </label>
  );
}

function ReferenceObservation({
  interview,
  type,
  index,
  reference,
  savingReferenceKey,
  onObservationChange,
  onObservationBlur,
}) {
  const key = `${interview.id}-${type}-${index}`;
  const saving = savingReferenceKey === key;

  return (
    <label className="mt-3 block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Observaciones
      </span>
      <textarea
        value={reference.observacion || ""}
        maxLength={1000}
        rows={3}
        disabled={saving}
        onChange={(event) =>
          onObservationChange(
            interview.id,
            type,
            index,
            event.target.value,
          )
        }
        onBlur={(event) =>
          onObservationBlur(
            interview,
            type,
            index,
            event.target.value,
          )
        }
        placeholder="Añade una observación sobre la llamada o la referencia"
        className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-wait disabled:opacity-60"
      />
    </label>
  );
}

function FamilyReferenceCard(props) {
  const { reference, index } = props;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">
        Referencia familiar #{index + 1}
      </p>
      <p className="mt-1 text-sm font-extrabold text-slate-900">
        {reference.nombre || `Familiar ${index + 1}`}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <ReferenceField label="Parentesco" value={reference.pariente || reference.relacion} />
        <ReferenceField label="Teléfono" value={reference.telefono} />
        <ReferenceField label="Ocupación" value={reference.ocupacion} />
        <ReferenceField label="Profesión" value={reference.tituloProfesion} />
      </dl>
      <CalledCheck {...props} type="familiar" />
      <ReferenceObservation {...props} type="familiar" />
    </article>
  );
}

function WorkReferenceCard(props) {
  const { reference, index } = props;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
        Referencia laboral #{index + 1}
      </p>
      <p className="mt-1 text-sm font-extrabold text-slate-900">
        {reference.empresaLugarTrabajo || `Trabajo ${index + 1}`}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <ReferenceField label="Cargo" value={reference.cargoActividadRealizada} />
        <ReferenceField label="Tiempo trabajado" value={reference.tiempoTrabajado} />
        <ReferenceField label="Jefe o encargado" value={reference.jefeEncargado} />
        <ReferenceField label="Teléfono" value={reference.telefonoReferencia} />
        <div className="col-span-2">
          <ReferenceField label="Motivo de salida" value={reference.motivoSalida} />
        </div>
      </dl>
      <CalledCheck {...props} type="laboral" />
      <ReferenceObservation {...props} type="laboral" />
    </article>
  );
}

function EmptyReferences({ text }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-xs font-semibold text-slate-500">
      {text}
    </p>
  );
}

function AddReferenceForm({ type, saving, onCancel, onSubmit, onSaved }) {
  const familyType = type === "familiar";
  const fields = familyType ? FAMILY_FIELDS : WORK_FIELDS;
  const emptyReference = familyType
    ? EMPTY_FAMILY_REFERENCE
    : EMPTY_WORK_REFERENCE;
  const [form, setForm] = useState({ ...emptyReference });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const saved = await onSubmit(form);

    if (saved) {
      setForm({ ...emptyReference });
      onSaved();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/60 p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold text-slate-900">
          Nueva referencia {familyType ? "familiar" : "laboral"}
        </p>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:opacity-50"
          aria-label="Cancelar nueva referencia"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.key}
            className={field.fullWidth ? "sm:col-span-2" : ""}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {field.label}{field.required ? " *" : ""}
            </span>
            {field.multiline ? (
              <textarea
                value={form[field.key]}
                required={field.required}
                maxLength={field.maxLength}
                rows={3}
                disabled={saving}
                placeholder="Añade una observación sobre esta referencia"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-wait disabled:opacity-60"
              />
            ) : (
              <input
                type="text"
                value={form[field.key]}
                required={field.required}
                maxLength={field.maxLength}
                disabled={saving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-wait disabled:opacity-60"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-white disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar referencia"}
        </button>
      </div>
    </form>
  );
}

export default function InterviewReferencesPanel({
  interview,
  savingReferenceKey,
  onCalledChange,
  onObservationChange,
  onObservationBlur,
  onGeneralObservationChange,
  onGeneralObservationBlur,
  onAddReference,
}) {
  const [addingType, setAddingType] = useState(null);
  const familyReferences = getFamilyReferences(interview);
  const workReferences = getWorkReferences(interview);
  const generalObservation =
    interview?.formulario?.metadata?.observacion_referencias || "";
  const savingGeneralObservation =
    savingReferenceKey === `${interview.id}-general`;

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
      <div className="mb-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-orange-600">
          Verificación de referencias
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Agrega referencias y marca cada una después de realizar la llamada.
        </p>
      </div>

      <label className="mb-5 block rounded-xl border border-orange-200 bg-white p-3 shadow-sm">
        <span className="text-xs font-extrabold text-slate-900">
          Observaciones generales
        </span>
        <textarea
          value={generalObservation}
          maxLength={1000}
          rows={3}
          disabled={savingGeneralObservation}
          onChange={(event) =>
            onGeneralObservationChange(interview.id, event.target.value)
          }
          onBlur={(event) =>
            onGeneralObservationBlur(interview, event.target.value)
          }
          placeholder="Añade una observación aunque no existan referencias registradas"
          className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-wait disabled:opacity-60"
        />
        {savingGeneralObservation && (
          <span className="mt-1 block text-right text-[10px] font-bold text-orange-600">
            Guardando...
          </span>
        )}
      </label>

      <div className="grid gap-5 xl:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-extrabold text-slate-900">
              Referencias familiares ({familyReferences.length})
            </h4>
            <button
              type="button"
              onClick={() =>
                setAddingType((current) =>
                  current === "familiar" ? null : "familiar",
                )
              }
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-orange-700 transition hover:bg-orange-50"
              aria-expanded={addingType === "familiar"}
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
          {addingType === "familiar" && (
            <AddReferenceForm
              type="familiar"
              saving={savingReferenceKey === `${interview.id}-familiar-new`}
              onCancel={() => setAddingType(null)}
              onSubmit={(reference) =>
                onAddReference(interview, "familiar", reference)
              }
              onSaved={() => setAddingType(null)}
            />
          )}
          <div className="grid gap-3">
            {familyReferences.length ? (
              familyReferences.map((reference, index) => (
                <FamilyReferenceCard
                  key={`familiar-${index}`}
                  interview={interview}
                  reference={reference}
                  index={index}
                  savingReferenceKey={savingReferenceKey}
                  onCalledChange={onCalledChange}
                  onObservationChange={onObservationChange}
                  onObservationBlur={onObservationBlur}
                />
              ))
            ) : (
              <EmptyReferences text="No se registraron referencias familiares." />
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-extrabold text-slate-900">
              Referencias laborales ({workReferences.length})
            </h4>
            <button
              type="button"
              onClick={() =>
                setAddingType((current) =>
                  current === "laboral" ? null : "laboral",
                )
              }
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-orange-200 bg-white px-2.5 py-1.5 text-xs font-extrabold text-orange-700 transition hover:bg-orange-50"
              aria-expanded={addingType === "laboral"}
            >
              <Plus size={14} /> Agregar
            </button>
          </div>
          {addingType === "laboral" && (
            <AddReferenceForm
              type="laboral"
              saving={savingReferenceKey === `${interview.id}-laboral-new`}
              onCancel={() => setAddingType(null)}
              onSubmit={(reference) =>
                onAddReference(interview, "laboral", reference)
              }
              onSaved={() => setAddingType(null)}
            />
          )}
          <div className="grid gap-3">
            {workReferences.length ? (
              workReferences.map((reference, index) => (
                <WorkReferenceCard
                  key={`laboral-${index}`}
                  interview={interview}
                  reference={reference}
                  index={index}
                  savingReferenceKey={savingReferenceKey}
                  onCalledChange={onCalledChange}
                  onObservationChange={onObservationChange}
                  onObservationBlur={onObservationBlur}
                />
              ))
            ) : (
              <EmptyReferences text="No se registraron referencias laborales." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
