import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function CrearOrigen() {
  const [nombre, setNombre] = useState("");
  const [activa, setActiva] = useState(true);
  const [loading, setLoading] = useState(false);
  const [origenes, setOrigenes] = useState([]);

  // 🔽 Obtener lista
  const obtenerOrigenes = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/gestion/origen-callcenter`
      );
      setOrigenes(res.data);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los orígenes", "error");
    }
  };

  useEffect(() => {
    obtenerOrigenes();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nombre.trim()) {
      Swal.fire("Atención", "El nombre es obligatorio", "warning");
      return;
    }

    try {
      setLoading(true);

      await axios.post(`${API_URL}/api/gestion/origen-callcenter`, {
        nombre,
        activa,
      });

      Swal.fire("Éxito", "Origen creado correctamente", "success");

      // 🔄 Reset
      setNombre("");
      setActiva(true);

      // 🔄 Recargar lista
      obtenerOrigenes();
    } catch (error) {
      console.error(error);

      const mensaje =
        error.response?.data?.message || "Error al crear origen";

      Swal.fire("Error", mensaje, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-md space-y-6">
      {/* FORM */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Crear Origen Call Center
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ej: WHATSAPP"
            />
          </div>

          {/* Activa */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={activa}
              onChange={(e) => setActiva(e.target.checked)}
            />
            <label className="text-sm text-gray-700">Activo</label>
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>

      {/* TABLA */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          Lista de Orígenes
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-gray-700 text-sm">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Estado</th>
              </tr>
            </thead>

            <tbody>
              {origenes.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-3 text-center text-gray-500">
                    No hay registros
                  </td>
                </tr>
              ) : (
                origenes.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2">{item.id}</td>
                    <td className="p-2">{item.nombre}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          item.activa
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.activa ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}