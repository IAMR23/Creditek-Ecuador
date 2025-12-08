import { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { API_URL } from "../../../config";

export default function DashboardEntregas() {
  const hoy = new Date().toISOString().split("T")[0];

  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_URL}/dashboard/entregas`, {
        params: { fechaInicio, fechaFin },
      });

      setData(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fechaInicio, fechaFin]);

  const chartData = data
    ? [
        {
          name: "Pendiente",
          estados: data.porEstado.pendientes,
          fill: "#F59E0B",
        },
        {
          name: "Tránsito",
          estados: data.porEstado.transito,
          fill: "#3B82F6",
        },
        {
          name: "Revisar",
          estados: data.porEstado.revisar,
          fill: "#EC4899",
        },
        {
          name: "Entregado",
          estados: data.porEstado.entregado,
          fill: "#10B981",
        },
        {
          name: "No Entregado",
          estados: data.porEstado.noEntregado,
          fill: "#EF4444",
        },
      ]
    : [];

  return (
    <div className="w-full p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Dashboard de Entregas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Resumen ejecutivo — Rango seleccionado
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow border border-gray-100">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Desde</label>
            <input
              type="date"
              estados={fechaInicio}
              max={fechaFin}
              onChange={(e) => setFechaInicio(e.target.estados)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Hasta</label>
            <input
              type="date"
              estados={fechaFin}
              min={fechaInicio}
              onChange={(e) => setFechaFin(e.target.estados)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-6"
          >
            {/* TOTAL */}
            <div className="col-span-1 bg-white rounded-2xl shadow p-6 border border-gray-100">
              <p className="text-sm text-gray-500">Total del periodo</p>
              <p className="mt-2 text-4xl font-bold text-gray-900">
                {data.total}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                Rango: {new Date(data.rango.desde).toLocaleString()} —{" "}
                {new Date(data.rango.hasta).toLocaleString()}
              </p>
            </div>

            {/* Cards de estados */}
            <div className="grid grid-cols-2 lg:grid-cols-3 col-span-1 lg:col-span-3 gap-6">
              <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-amber-500">
                <p className="text-xs text-gray-500">Pendientes</p>
                <p className="mt-3 text-2xl font-semibold text-amber-600">
                  {data.porEstado.pendientes}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500">En Tránsito</p>
                <p className="mt-3 text-2xl font-semibold text-blue-600">
                  {data.porEstado.transito}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-pink-500">
                <p className="text-xs text-gray-500">Revisar</p>
                <p className="mt-3 text-2xl font-semibold text-pink-600">
                  {data.porEstado.revisar}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-green-500">
                <p className="text-xs text-gray-500">Entregadas</p>
                <p className="mt-3 text-2xl font-semibold text-green-600">
                  {data.porEstado.entregado}
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-red-500 col-span-2 lg:col-span-1">
                <p className="text-xs text-gray-500">No Entregadas</p>
                <p className="mt-3 text-2xl font-semibold text-red-600">
                  {data.porEstado.noEntregado}
                </p>
              </div>
            </div>
          </motion.div>
        )
      )}

      {/* CHART */}
      {!loading && data && (
        <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Distribución por Estado
            </h2>
            <p className="text-sm text-gray-500">
              Visualización para reportes ejecutivos
            </p>
          </div>

          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />

                <Bar dataKey="estados" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end text-xs text-gray-400 mt-2">
        Última actualización: {new Date().toLocaleString()}
      </div>
    </div>
  );
}
