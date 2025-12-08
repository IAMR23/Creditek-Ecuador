import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { API_URL } from "../../../config";

export default function Dashboard() {
    const hoy = new Date().toLocaleDateString("en-CA");

  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState({
    ventasDesdeEntregas: 0,
    ventasDesdeVentas: 0,
    totalVentas: 0,
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await axios.get(
        `${API_URL}/dashboard/total-ventas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      );

      setData(res.data);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Datos para grafico
  const chartData = [
    {
      name: "Entregas",
      value: data.ventasDesdeEntregas,
    },
    {
      name: "Ventas",
      value: data.ventasDesdeVentas,
    },
    {
      name: "Total",
      value: data.totalVentas,
    },
  ];

  return (
    <div className="w-full px-6 py-8">
      <h1 className="text-3xl font-bold mb-4 text-gray-900">
        📊 Dashboard de Ventas
      </h1>

      {/* FILTRO */}
      <div className="bg-white shadow-md rounded-xl p-5 mb-6 flex items-center gap-4">
        <div>
          <label className="text-gray-600 font-medium">Fecha Inicio</label>
          <input
            type="date"
            className="border rounded-lg w-full p-2 mt-1"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        <div>
          <label className="text-gray-600 font-medium">Fecha Fin</label>
          <input
            type="date"
            className="border rounded-lg w-full p-2 mt-1"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        <button
          onClick={fetchData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          Filtrar
        </button>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <motion.div
          className="rounded-xl p-5 shadow-lg bg-gradient-to-r from-green-500 to-green-600 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-lg font-semibold">Ventas desde Entregas</p>
          <p className="text-4xl font-bold mt-2">
            {loading ? "..." : data.ventasDesdeEntregas}
          </p>
        </motion.div>

        <motion.div
          className="rounded-xl p-5 shadow-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-lg font-semibold">Ventas Validadas</p>
          <p className="text-4xl font-bold mt-2">
            {loading ? "..." : data.ventasDesdeVentas}
          </p>
        </motion.div>

        <motion.div
          className="rounded-xl p-5 shadow-lg bg-gradient-to-r from-yellow-500 to-yellow-600 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-lg font-semibold">Total Ventas</p>
          <p className="text-4xl font-bold mt-2">
            {loading ? "..." : data.totalVentas}
          </p>
        </motion.div>
      </div>


<div className="bg-white shadow-xl rounded-2xl p-6 h-96 border border-gray-100">
  <h2 className="text-2xl font-bold mb-5 text-gray-800">
    📈 Gráfico de Ventas
  </h2>

  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={chartData} barSize={40}>
      <XAxis dataKey="name" tick={{ fill: "#555" }} />
      <YAxis tick={{ fill: "#555" }} />
      <Tooltip
        contentStyle={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          color: "#111",
        }}
      />

      <Bar
        dataKey="value"
        radius={[12, 12, 0, 0]}
        fill="url(#colorBar)"
      />

      {/* Definir gradientes de color PRO */}
      <defs>
        <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </BarChart>
  </ResponsiveContainer>
</div>

    </div>
  );
}
