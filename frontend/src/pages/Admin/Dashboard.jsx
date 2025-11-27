import { useEffect, useState } from "react";
import axios from "axios";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL;

// =======================================
// CARD
// =======================================
function Card({ title, value, color }) {
  return (
    <div className={`bg-white shadow-md p-5 rounded-xl border-l-4 border-${color}-500`}>
      <p className="text-gray-500 text-sm">{title}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
    </div>
  );
}

// =======================================
// CHART WRAPPER
// =======================================
function ChartBox({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-5">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

// =======================================
// DASHBOARD
// =======================================
export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  const [rango, setRango] = useState("7dias");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [datos, setDatos] = useState({
    ventas: { hoy: 0, mes: 0, rango: [] },
    entregas: { hoy: 0, mes: 0, rango: [] },
  });

  // =============================
  // Cargar datos según rango
  // =============================
  const cargarDashboard = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/dashboard/resumen?rango=${rango}`;

      if (rango === "custom" && desde && hasta) {
        url += `&desde=${desde}&hasta=${hasta}`;
      }

      const res = await axios.get(url);
      setDatos(res.data);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, [rango, desde, hasta]);

  if (loading) return <p className="p-5 text-lg">Cargando Dashboard...</p>;

  return (
    <div className="p-6">
      {/* Titulo */}
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard General</h1>

      {/* Filtros */}
      <div className="bg-white p-4 shadow rounded-xl mb-6 flex flex-col md:flex-row gap-4">

        <div>
          <label className="text-sm font-semibold">Rango:</label>
          <select
            className="ml-2 border p-2 rounded"
            value={rango}
            onChange={(e) => setRango(e.target.value)}
          >
            <option value="hoy">Hoy</option>
            <option value="7dias">Últimos 7 días</option>
            <option value="mes">Este mes</option>
            <option value="custom">Rango personalizado</option>
          </select>
        </div>

        {rango === "custom" && (
          <div className="flex gap-3">
            <div>
              <label className="text-sm">Desde:</label>
              <input
                type="date"
                className="border p-2 rounded"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm">Hasta:</label>
              <input
                type="date"
                className="border p-2 rounded"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
          </div>
        )}

      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card title="Ventas Hoy" value={datos.ventas.hoy} color="blue" />
        <Card title="Entregas Hoy" value={datos.entregas.hoy} color="green" />
        <Card title="Ventas del Mes" value={datos.ventas.mes} color="purple" />
        <Card title="Entregas del Mes" value={datos.entregas.mes} color="yellow" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">

        <ChartBox title="Ventas (Rango)">
          <LineChart width={500} height={250} data={datos.ventas.rango}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={3} />
          </LineChart>
        </ChartBox>

        <ChartBox title="Entregas (Rango)">
          <BarChart width={500} height={250} data={datos.entregas.rango}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total" fill="#10b981" />
          </BarChart>
        </ChartBox>

      </div>
    </div>
  );
}
