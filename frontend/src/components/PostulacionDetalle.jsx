function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h4 className="text-sm font-semibold  uppercase mb-4">
        {title}
      </h4>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
      </div>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium  capitalize">
        {label.replaceAll("_", " ")}
      </label>

      <div className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800">
        {value || "—"}
      </div>
    </div>
  );
}

function SubCard({ title, children }) {
  return (
    <div className="col-span-full border border-gray-200 rounded-lg p-4 bg-white">
      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

const ORDEN_DATOS_PERSONALES = [
  "nombre",
  "cedula",
  "genero",
  "edad",
  "telefono",
  "direccion",
  "estadoCivil",
  "vivienda",
  "estudios",
  "hijos",
];

const LABELS_DATOS_PERSONALES = {
  nombre: "Nombre completo",
  cedula: "Cédula",
  genero: "Género",
  edad: "Edad",
  telefono: "Teléfono",
  direccion: "Dirección",
  estadoCivil: "Estado civil",
  vivienda: "Tipo de vivienda",
  estudios: "Nivel de estudios",
  hijos: "Número de hijos",
};

export default function ModalDetalle({ postulacion, onClose }) {
  const { formulario } = postulacion;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl shadow-lg p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b pb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            Detalle de Postulación
          </h3>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-600 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* 👤 Datos personales */}
        <Section title="Datos personales">
          {ORDEN_DATOS_PERSONALES.map((key) => (
            <Item
              key={key}
              label={LABELS_DATOS_PERSONALES[key] || key}
              value={formulario.datos_personales?.[key]}
            />
          ))}
        </Section>

        {/* 💼 Experiencia laboral */}
        <Section title="Experiencia laboral">
          {Object.entries(formulario.experiencia_laboral || {}).map(
            ([trabajo, data]) => (
              <SubCard key={trabajo} title={trabajo.toUpperCase()}>
                {Object.entries(data).map(([k, v]) => (
                  <Item key={k} label={k} value={v} />
                ))}
              </SubCard>
            )
          )}
        </Section>

        {/* 🧠 Evaluación */}
        <Section title="Evaluación">
          {Object.entries(formulario.evaluacion || {}).map(([k, v]) => (
            <Item key={k} label={k} value={v} />
          ))}
        </Section>
      </div>
    </div>
  );
}
