import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import { FaPlus } from "react-icons/fa";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

export default function TrasladosList() {
  const [traslados, setTraslados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const obtenerTraslados = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_URL}/api/traslados`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setTraslados(res.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar los traslados", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerTraslados();
  }, []);

  // 🔎 Filtro por fechas
  const trasladosFiltrados = traslados.filter((t) => {
    if (!fechaInicio && !fechaFin) return true;

    const fechaTraslado = new Date(t.createdAt);

    if (fechaInicio) {
      const inicio = new Date(fechaInicio);
      if (fechaTraslado < inicio) return false;
    }

    if (fechaFin) {
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999);
      if (fechaTraslado > fin) return false;
    }

    return true;
  });

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString("es-EC", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Gestión de Traslados
            </h1>
            <p className=" text-gray-500">
              Control y seguimiento de movimientos entre agencias
            </p>
          </div>

          <button
            onClick={() => navigate("/crear-traslado")}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl shadow-md transition duration-200"
          >
            <FaPlus size={14} />
            Nuevo Traslado
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block  font-medium text-gray-700 mb-2">
                Fecha inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block  font-medium text-gray-700 mb-2">
                Fecha fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-500 ">
                Cargando traslados...
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
         <table className="min-w-full  border  rounded-xl overflow-hidden">
  <thead className=" text-gray-700 uppercase  tracking-wider">
    <tr>
      <th className="px-6 py-4 text-left border-b">ID</th>
      <th className="px-6 py-4 text-left border-b">Estado</th>
      <th className="px-6 py-4 text-left border-b">Fecha</th>
      <th className="px-6 py-4 text-left border-b">Origen</th>
      <th className="px-6 py-4 text-left border-b">Destino</th>
      <th className="px-6 py-4 text-left border-b">Detalles</th>
    </tr>
  </thead>

  <tbody className="divide-y divide-gray-200">
    {trasladosFiltrados.length === 0 ? (
      <tr>
        <td colSpan="6" className="py-12 text-center text-gray-400">
          No hay registros disponibles
        </td>
      </tr>
    ) : (
      trasladosFiltrados.map((traslado, index) => (
        <tr
          key={traslado.id}
          className={`
            ${index % 2 === 0 ? "bg-gray-400" : "bg-gray-50"}
            
          `}
        >
          <td className="px-6 py-4 font-semibold text-gray-900">
            #{traslado.id}
          </td>

          <td className="px-6 py-4">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                traslado.estado === "Pendiente"
                  ? "bg-yellow-200 text-yellow-800"
                  : traslado.estado === "Completado"
                  ? "bg-green-200 text-green-800"
                  : traslado.estado === "Transito"
                  ? "bg-blue-200 text-blue-800"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {traslado.estado}
            </span>
          </td>

          <td className="px-6 py-4 text-gray-700">
            {formatearFecha(traslado.createdAt)}
          </td>

          <td className="px-6 py-4 font-medium text-gray-800">
            {traslado.agenciaOrigen?.nombre}
          </td>

          <td className="px-6 py-4 font-medium text-gray-800">
            {traslado.agenciaDestino?.nombre}
          </td>

          <td className="px-6 py-4">
            <div className="space-y-2">
              {traslado.detalles.map((detalle) => (
                <div
                  key={detalle.id}
                  className="bg-gray-200 px-3 py-2 rounded-lg text-xs"
                >
                  <p className="font-semibold text-gray-900">
                    {detalle.dispositivoMarca?.dispositivo?.nombre}{" "}
                    {detalle.dispositivoMarca?.marca?.nombre}{" "}
                    {detalle.modelo?.nombre}
                  </p>
                  <p className="text-gray-700">
                    Cantidad: {detalle.cantidad}
                  </p>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ))
    )}
  </tbody>
</table>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
