import { useState, useRef } from "react";
import html2canvas from "html2canvas";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { FaCopy } from "react-icons/fa";

const COLORS = {
  semana: "#4ADE80",
  viabilidad: "#dc2626",
};

const crearFechaLocal = (fechaStr) => {
  const [year, month, day] = fechaStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getRangoSemana = (semana, fechaInicio) => {
  const inicio = crearFechaLocal(fechaInicio);

  const start = new Date(inicio);
  start.setDate(start.getDate() + (semana - 1) * 7);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const opciones = {
    month: "long",
    day: "numeric",
  };

  const inicioStr = start.toLocaleDateString("es-EC", opciones);
  const finStr = end.toLocaleDateString("es-EC", opciones);

  return `${inicioStr} - ${finStr}`;
};

const toSemanaArray = (obj = {}, viabilidad = 100, fechaInicio = "2026-01-01") =>
  Object.entries(obj)
    .map(([name, value]) => {
      const semanaNumero = Number(String(name).replace(/\D/g, ""));

      return {
        name: getRangoSemana(semanaNumero, fechaInicio),
        ventas: value,
        viabilidad,
        semanaNumero,
      };
    })
    .sort((a, b) => a.semanaNumero - b.semanaNumero);

const tooltipStyle = {
  contentStyle: {
    borderRadius: "10px",
    border: "none",
    boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
  },
};

export default function DashboardGraficas2({ estadisticas }) {
  const [viabilidadSemana, setViabilidadSemana] = useState(12);
  const refSemana = useRef(null);

  if (!estadisticas) return null;

  const copiarGrafico = async () => {
    if (!refSemana.current) return;

    try {
      const canvas = await html2canvas(refSemana.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": blob,
          }),
        ]);

        alert("Gráfico copiado al portapapeles");
      });
    } catch (error) {
      console.error("Error copiando gráfico:", error);
      alert("No se pudo copiar el gráfico. Usa Chrome o Edge con HTTPS.");
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mt-6">
      {/* KPI */}
      <div className="bg-white p-6 rounded-2xl shadow xl:col-span-1">
        <h3 className="text-gray-500 text-sm">Total Ventas</h3>

        <p className="text-4xl font-bold text-blue-800">
          {estadisticas.totalVentas}
        </p>
      </div>

      {/* Ventas por Semana */}
      <div className="bg-white p-6 rounded-2xl shadow xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold">Ventas por Semana</h3>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="viabilidadSemana" className="font-bold">
                Viabilidad:
              </label>

              <input
                id="viabilidadSemana"
                type="number"
                value={viabilidadSemana}
                onChange={(e) => setViabilidadSemana(Number(e.target.value))}
                className="border rounded p-2 w-24"
              />
            </div>

            <button
              onClick={copiarGrafico}
              className="bg-green-600 text-white px-4 py-2 rounded-lg"
            >
              <FaCopy size={18}/>
            </button>
          </div>
        </div>

        <div ref={refSemana} className="bg-white p-4 rounded-xl">
          <h4 className="font-semibold mb-3">Ventas por Semana</h4>

          <ResponsiveContainer width="100%" height={700}>
            <LineChart
              data={toSemanaArray(
                estadisticas.porSemana,
                viabilidadSemana,
                "2026-01-01"
              )}
              margin={{ top: 20, right: 30, left: 70, bottom: 150 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis
                dataKey="name"
                angle={-50}
                textAnchor="end"
                interval={0}
              />

              <YAxis />

              <Tooltip {...tooltipStyle} />

              <Line
                type="linear"
                dataKey="ventas"
                stroke={COLORS.semana}
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 10 }}
              />

              <Line
                type="monotone"
                dataKey="viabilidad"
                stroke={COLORS.viabilidad}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}