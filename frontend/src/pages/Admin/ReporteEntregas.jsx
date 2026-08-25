import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { getHoyLocal } from "../../utils/dateUtils";
import api from "../../api/client";

export default function DashboardEntregas() {

  const COLORS = ["#F59E0B", "#3B82F6", "#22C55E", "#EF4444"];

  const [repartidores, setRepartidores] = useState([]);

  const [fechaInicio, setFechaInicio] = useState(getHoyLocal());
  const [fechaFin, setFechaFin] = useState(getHoyLocal());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};

      if (repartidorSeleccionado) params.userId = repartidorSeleccionado;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;

      const res = await api.get("/dashboard/entregas", {
        params,
      });

      setData(res.data);
    } catch (requestError) {
      console.error(requestError);
      setData(null);
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data?.error ||
          "No se pudo cargar el resumen de entregas.",
      );
    } finally {
      setLoading(false);
    }
  }, [fechaFin, fechaInicio, repartidorSeleccionado]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const estados = data?.porEstado || {};

  const chartData = [
    { name: "Pendiente", estados: estados.pendiente || 0 },
    { name: "Tránsito", estados: estados.transito || 0 },
    { name: "Entregado", estados: estados.entregado || 0 },
    { name: "No Entregado", estados: estados.noEntregado || 0 },
  ];

  useEffect(() => {
    const fetchRepartidores = async () => {
      try {
        const response = await api.get(
          "/api/usuario-permisos/usuarios-repartidores",
        );

        setRepartidores(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error(err);
        setRepartidores([]);
      }
    };

    fetchRepartidores();
  }, []);
  return (
    <div className="w-full p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Dashboard de Entregas
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Resumen ejecutivo — Rango seleccionado
          </p>
        </div>

        {/* FILTROS */}
        <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow border border-gray-100">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Repartidor
            </label>
            <select
              value={repartidorSeleccionado}
              onChange={(e) => setRepartidorSeleccionado(e.target.value)}
              className="w-full mt-1 rounded-xl border-gray-300"
            >
              <option value="">Todos</option>
              {repartidores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.usuario.nombre} — {r.agencia.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Desde</label>
            <input
              type="date"
              value={fechaInicio}
              max={fechaFin}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Hasta</label>
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              onChange={(e) => setFechaFin(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* CONTENIDO */}
      {!loading && data && (
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
              {data.total || 0}
            </p>

            <p className="mt-3 text-xs text-gray-400">
              Rango:{" "}
              {data?.rango?.desde
                ? new Date(data.rango.desde).toLocaleString()
                : "Sin fecha"}{" "}
              —{" "}
              {data?.rango?.hasta
                ? new Date(data.rango.hasta).toLocaleString()
                : "Sin fecha"}
            </p>
          </div>

          {/* CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-3 col-span-1 lg:col-span-3 gap-6">
            <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-amber-500">
              <p className="text-xs text-gray-500">
                Pendientes - Pedido creado
              </p>
              <p className="mt-3 text-2xl font-semibold text-amber-600">
                {estados.pendiente || 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-blue-500">
              <p className="text-xs text-gray-500">En Tránsito - En ruta</p>
              <p className="mt-3 text-2xl font-semibold text-blue-600">
                {estados.transito || 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-green-500">
              <p className="text-xs text-gray-500">Entregadas - Completadas</p>
              <p className="mt-3 text-2xl font-semibold text-green-600">
                {estados.entregado || 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-red-500 col-span-2 lg:col-span-1">
              <p className="text-xs text-gray-500">No Entregadas - Fallidas</p>
              <p className="mt-3 text-2xl font-semibold text-red-600">
                {estados.noEntregado || 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow p-5 border-l-4 border-violet-500 col-span-2 lg:col-span-1">
              <p className="text-xs text-gray-500">Procesos completos</p>
              <p className="mt-3 text-2xl font-semibold text-violet-600">
                {data.procesosCompletos || 0}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Indicador adicional al estado de entrega
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* CHART */}
      {!loading && data && (
        <div className="bg-white rounded-2xl shadow p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Distribución por Estado
          </h2>

          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
<Bar dataKey="estados" radius={[8, 8, 0, 0]}>
  {chartData.map((entry, index) => (
    <Cell key={`cell-${index}`} fill={COLORS[index]} />
  ))}
</Bar>              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="flex justify-end text-xs text-gray-400">
        Última actualización: {new Date().toLocaleString()}
      </div>
    </div>
  );
}
