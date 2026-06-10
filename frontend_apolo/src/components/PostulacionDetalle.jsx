import { X } from "lucide-react";

const dash = "-";

const labels = {
  nombreCompleto: "Nombre completo",
  cedula: "Cedula",
  edadCumplida: "Edad cumplida",
  ciudadNacimiento: "Ciudad de nacimiento",
  otraCiudadNacimiento: "Otra ciudad",
  tiempoResidenciaQuito: "Tiempo de residencia en Quito",
  motivoSalidaCiudadNatal: "Motivo de salida de ciudad natal",
  tipoVivienda: "Tipo de vivienda",
  viviendaFamiliarQuien: "Vivienda familiar de",
  viviendaPrestadaQuien: "Vivienda prestada por",
  viviendaOtraEspecifique: "Otra vivienda",
  nombre: "Nombre",
  telefono: "Telefono",
  pariente: "Pariente",
  edad: "Edad",
  ocupacion: "Ocupacion",
  tituloProfesion: "Titulo o profesion",
  empresaLugarTrabajo: "Empresa / lugar",
  cargoActividadRealizada: "Cargo / actividad",
  tiempoTrabajado: "Tiempo trabajado",
  motivoSalida: "Motivo de salida",
  jefeEncargado: "Jefe o encargado",
  telefonoReferencia: "Telefono de referencia",
  observacionesAdicionales: "Observaciones adicionales",
  sinExperienciaLaboral: "Sin experiencia laboral",
  fecha_envio: "Fecha de envio",
  origen: "Origen",
  version_formulario: "Version del formulario",
};

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-orange-600">
        {title}
      </h4>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        {children}
      </div>
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="min-h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
        {value || dash}
      </div>
    </div>
  );
}

function FieldGrid({ data = {}, order = [] }) {
  const keys = order.length ? order : Object.keys(data);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {keys.map((key) => (
        <Field key={key} label={labels[key] || key} value={data?.[key]} />
      ))}
    </div>
  );
}

function RecordList({ records = [], titlePrefix, emptyText, order }) {
  if (!records.length) {
    return <p className="text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {records.map((record, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-900">
            {titlePrefix} {index + 1}
          </p>
          <FieldGrid data={record} order={order} />
        </div>
      ))}
    </div>
  );
}

export default function ModalDetalle({ postulacion, onClose }) {
  const formulario = postulacion?.formulario || {};
  const datos = formulario.datos_personales || {};
  const residencia = formulario.residencia_quito || {};
  const vivienda = formulario.vivienda_actual || {};
  const personas = formulario.personas_con_quien_vive || [];
  const trabajos = formulario.historial_laboral || [];
  const observaciones = formulario.observaciones || {};
  const metadata = formulario.metadata || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
              Detalle de postulacion
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              {datos.nombreCompleto || postulacion?.nombre || "Aspirante"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Cedula: {datos.cedula || postulacion?.cedula || dash}
            </p>
          </div>

          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Cerrar detalle"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <Section title="Datos personales">
            <FieldGrid
              data={datos}
              order={["nombreCompleto", "cedula", "edadCumplida", "ciudadNacimiento", "otraCiudadNacimiento"]}
            />
          </Section>

          <Section title="Residencia en Quito">
            <FieldGrid data={residencia} order={["tiempoResidenciaQuito", "motivoSalidaCiudadNatal"]} />
          </Section>

          <Section title="Vivienda actual">
            <FieldGrid
              data={vivienda}
              order={["tipoVivienda", "viviendaFamiliarQuien", "viviendaPrestadaQuien", "viviendaOtraEspecifique"]}
            />
          </Section>

          <Section title="Grupo familiar / personas con quienes vive">
            <RecordList
              records={personas}
              titlePrefix="Persona"
              emptyText="No se registraron personas con quienes vive."
              order={["nombre", "telefono", "pariente", "edad", "ocupacion", "tituloProfesion"]}
            />
          </Section>

          <Section title="Experiencia laboral">
            <RecordList
              records={trabajos}
              titlePrefix="Trabajo"
              emptyText="No se registro experiencia laboral."
              order={["empresaLugarTrabajo", "cargoActividadRealizada", "tiempoTrabajado", "motivoSalida", "jefeEncargado", "telefonoReferencia"]}
            />
          </Section>

          <Section title="Observaciones e informacion adicional">
            <FieldGrid data={observaciones} order={["observacionesAdicionales", "sinExperienciaLaboral"]} />
          </Section>

          <Section title="Metadata">
            <FieldGrid data={metadata} order={["fecha_envio", "origen", "version_formulario"]} />
          </Section>
        </div>
      </div>
    </div>
  );
}
