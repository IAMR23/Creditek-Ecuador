/* eslint-disable react/prop-types */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TOTAL_SEMANAS = 13;
const COLORES_ORIGEN = [
  "#16a34a",
  "#2563eb",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#4f46e5",
  "#ea580c",
  "#0f766e",
  "#9333ea",
  "#65a30d",
];

const crearFechaLocal = (fecha) => {
  const [year, month, day] = String(fecha || "").split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const formatearRangoSemana = (fechaInicio, indiceSemana) => {
  const inicioBase = crearFechaLocal(fechaInicio);
  if (!inicioBase) return `Semana ${indiceSemana + 1}`;

  const inicio = new Date(inicioBase);
  inicio.setDate(inicio.getDate() + indiceSemana * 7);

  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);

  const formato = new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
  });

  return `${formato.format(inicio)} - ${formato.format(fin)}`;
};

const normalizarClave = (valor) =>
  String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

const construirOrigenes = (origenes, series) => {
  const items = new Map();

  origenes.forEach((origen) => {
    const nombre = String(origen?.nombre || "").trim();
    if (nombre) items.set(normalizarClave(nombre), nombre);
  });

  Object.keys(series).forEach((nombre) => {
    const nombreLimpio = String(nombre || "").trim();
    if (nombreLimpio) {
      items.set(normalizarClave(nombreLimpio), nombreLimpio);
    }
  });

  return Array.from(items.values()).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
};

const obtenerSerieOrigen = (series, nombreOrigen) => {
  const claveBuscada = normalizarClave(nombreOrigen);
  const entrada = Object.entries(series).find(
    ([nombre]) => normalizarClave(nombre) === claveBuscada,
  );

  return entrada?.[1] || {};
};

export default function PowerBiMetricasOrigen({
  estadisticas,
  origenes = [],
  fechaInicio,
  origenesError = "",
}) {
  const series = estadisticas?.porOrigenPorSemana || {};
  const nombresOrigen = construirOrigenes(origenes, series);

  if (!estadisticas) return null;

  if (!nombresOrigen.length) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center text-sm font-medium text-gray-500">
        No hay orígenes configurados para mostrar.
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Métricas por origen</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ventas semanales para cada origen durante el período seleccionado.
        </p>
        {origenesError && (
          <p className="mt-2 text-sm font-medium text-amber-700">
            {origenesError} Se muestran los orígenes encontrados en las ventas.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {nombresOrigen.map((nombreOrigen, indiceOrigen) => {
          const colorOrigen = COLORES_ORIGEN[indiceOrigen % COLORES_ORIGEN.length];
          const valores = obtenerSerieOrigen(series, nombreOrigen);
          const data = Array.from({ length: TOTAL_SEMANAS }, (_, index) => ({
            name: formatearRangoSemana(fechaInicio, index),
            semana: `Semana ${index + 1}`,
            ventas: Number(valores[`Semana ${index + 1}`]) || 0,
          }));
          const total = data.reduce((acumulado, item) => acumulado + item.ventas, 0);

          return (
            <article
              key={nombreOrigen}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{nombreOrigen}</h3>
                  <p className="mt-1 text-xs text-gray-500">Ventas por semana</p>
                </div>
                <div
                  className="rounded-xl px-3 py-2 text-right"
                  style={{ backgroundColor: `${colorOrigen}14` }}
                >
                  <p
                    className="text-xs font-medium"
                    style={{ color: colorOrigen }}
                  >
                    Total
                  </p>
                  <p
                    className="text-xl font-bold"
                    style={{ color: colorOrigen }}
                  >
                    {total}
                  </p>
                </div>
              </div>

              <div className="h-[320px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data}
                    margin={{ top: 10, right: 18, left: -10, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      angle={-42}
                      interval={0}
                      textAnchor="end"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.semana || ""
                      }
                      formatter={(value) => [value, "Ventas"]}
                      contentStyle={{
                        border: "none",
                        borderRadius: "10px",
                        boxShadow: "0 6px 16px rgba(15,23,42,0.15)",
                      }}
                    />
                    <Line
                      type="linear"
                      dataKey="ventas"
                      name="Ventas"
                      stroke={colorOrigen}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
