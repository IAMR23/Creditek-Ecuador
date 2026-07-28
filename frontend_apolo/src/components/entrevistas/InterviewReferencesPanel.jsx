const dash = "-";

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

export default function InterviewReferencesPanel({
  interview,
  savingReferenceKey,
  onCalledChange,
  onObservationChange,
  onObservationBlur,
  onGeneralObservationChange,
  onGeneralObservationBlur,
}) {
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
          Marca cada referencia después de realizar la llamada.
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
          <h4 className="mb-3 text-sm font-extrabold text-slate-900">
            Referencias familiares ({familyReferences.length})
          </h4>
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
          <h4 className="mb-3 text-sm font-extrabold text-slate-900">
            Referencias laborales ({workReferences.length})
          </h4>
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
