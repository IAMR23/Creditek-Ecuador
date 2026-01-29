import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function Permisos() {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [misPermisos, setMisPermisos] = useState([]); // Lista de permisos existentes + nuevos

  // 🔹 Cargar permisos existentes al montar
  const cargarPermisos = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/permisos-catalogo`);
      setMisPermisos(data);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudieron cargar los permisos existentes", "error");
    }
  };

  useEffect(() => {
    cargarPermisos();
  }, []);

  // 🔹 Crear nuevo permiso
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre) return Swal.fire("Error", "El nombre del permiso es obligatorio", "warning");

    try {
      const { data } = await axios.post(`${API_URL}/api/permisos-catalogo`, {
        nombre,
        descripcion,
      });

      Swal.fire("Listo", "Permiso creado correctamente", "success");
      setNombre("");
      setDescripcion("");

      // Agregar el nuevo permiso a la lista
      setMisPermisos((prev) => [...prev, data]);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo crear el permiso", "error");
    }
  };

  return (
    <div className="p-6 bg-white rounded shadow-md mb-6">
      <h2 className="text-xl font-bold text-green-500 mb-4">Crear Permiso</h2>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
        <div>
          <label className="block mb-1 font-medium">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Ej: REPARTIR"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Descripción opcional"
          />
        </div>
        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Crear Permiso
        </button>
      </form>

      {/* Lista de permisos */}
      <h3 className="text-lg font-semibold text-green-500 mb-2">Permisos existentes</h3>
      {misPermisos.length === 0 ? (
        <p className="text-gray-500">No hay permisos creados todavía.</p>
      ) : (
        <table className="w-full border border-gray-200">
          <thead className="bg-green-100">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {misPermisos.map((p) => (
              <tr key={p.id} className="border-t border-gray-200">
                <td className="px-4 py-2">{p.nombre}</td>
                <td className="px-4 py-2">{p.descripcion || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
