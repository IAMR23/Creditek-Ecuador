import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { useNavigate } from "react-router-dom";
import { Calendar, Filter, RefreshCw, Eye } from "lucide-react";

import Swal from "sweetalert2";

export default function EntregasPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const navigate = useNavigate();

  const [entregas, setEntregas] = useState([]);

  const [filtros, setFiltros] = useState({
    fechaInicio: today,
    fechaFin: today,
  });

  useEffect(() => {
    fetchEntregas();
  }, []);

  const fetchEntregas = async () => {
    // Validación fechas
    if (filtros.fechaInicio > filtros.fechaFin) {
      Swal.fire({
        icon: "warning",
        title: "Fechas inválidas",
        text: "La fecha de inicio no puede ser mayor a la fecha de fin",
      });
      return;
    }

    try {
      const params = {};
      Object.keys(filtros).forEach((key) => {
        if (filtros[key] !== "") params[key] = filtros[key];
      });

      const response = await axios.get(`${API_URL}/entregas/filter`, {
        params,
      });

      setEntregas(response.data);
    } catch (error) {
      console.error("Error cargando entregas:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las entregas",
      });
    }
  };

  const handleChange = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaInicio: today,
      fechaFin: today,
      estado: "",
    });
    setEntregas([]);
  };

  return (
    <div className="p-6 bg-gray-50 rounded-xl shadow-sm">
      {/* TÍTULO */}
      <h1 className="text-3xl font-bold mb-6 text-green-600 flex items-center gap-3">
        <Filter size={28} />
        Filtrar Entregas
      </h1>

      {/* CARD DE FILTROS */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-8">
        {/* GRID FILTROS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
          {/* Fecha Inicio */}
          <div className="flex flex-col">
            <label className="font-semibold text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <div className="flex items-center gap-2 border border-gray-300 bg-gray-100 px-3 py-2 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-green-500 transition-all">
              <Calendar size={18} className="text-gray-600" />
              <input
                type="date"
                name="fechaInicio"
                value={filtros.fechaInicio}
                max={filtros.fechaFin}
                onChange={handleChange}
                className="bg-transparent text-gray-700 w-full outline-none"
              />
            </div>
          </div>

          {/* Fecha Fin */}
          <div className="flex flex-col">
            <label className="font-semibold text-gray-700 mb-1">
              Fecha Fin
            </label>
            <div className="flex items-center gap-2 border border-gray-300 bg-gray-100 px-3 py-2 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-green-500 transition-all">
              <Calendar size={18} className="text-gray-600" />
              <input
                type="date"
                name="fechaFin"
                value={filtros.fechaFin}
                min={filtros.fechaInicio}
                onChange={handleChange}
                className="bg-transparent text-gray-700 w-full outline-none"
              />
            </div>
          </div>

          {/* Estado */}
          <div className="flex flex-col">
            <label className="font-semibold text-gray-700 mb-1">Estado</label>
            <select
              name="estado"
              value={filtros.estado}
              onChange={handleChange}
              className="border border-gray-300 bg-gray-100 px-3 py-2 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
            >
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
        </div>

        {/* BOTONES */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={fetchEntregas}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-2.5 rounded-lg shadow-md transition-all active:scale-95"
          >
            <Filter size={18} />
            Buscar
          </button>

          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-2 bg-gray-400 hover:bg-gray-500 text-white font-semibold px-6 py-2.5 rounded-lg shadow-md transition-all active:scale-95"
          >
            <RefreshCw size={18} />
            Limpiar
          </button>
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-hidden rounded-2xl shadow-lg border border-gray-200 bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-green-500 text-white">
              <th className="p-4">Cliente</th>
              <th className="p-4">Cédula</th>
              <th className="p-4">Producto</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Creado</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {entregas.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  className="text-center p-6 text-gray-500 font-medium"
                >
                  No hay entregas registradas
                </td>
              </tr>
            ) : (
              entregas.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-green-50 transition-colors border-t"
                >
                  <td className="p-4">{e.cliente?.cliente}</td>
                  <td className="p-4">{e.cliente?.cedula}</td>
                  <td className="p-4">{e.producto?.nombre}</td>
                  <td className="p-4 capitalize">{e.estado}</td>
                  <td className="p-4">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>

                  {/* ACCIONES */}
                  <td className="p-4 text-center">
                    <button
                      onClick={() => navigate(`/entregas/${e.id}`)}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg shadow transition-all active:scale-95 mx-auto"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
