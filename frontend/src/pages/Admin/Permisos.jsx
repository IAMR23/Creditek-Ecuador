import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

export default function Permisos() {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [misPermisos, setMisPermisos] = useState([]);

  const cargarPermisos = async () => {
    try {
      const { data } = await api.get("/api/permisos-catalogo");
      setMisPermisos(data);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudieron cargar los permisos existentes", "error");
    }
  };

  useEffect(() => {
    cargarPermisos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) {
      return Swal.fire("Error", "El nombre del permiso es obligatorio", "warning");
    }

    try {
      const { data } = await api.post("/api/permisos-catalogo", {
        nombre,
        descripcion,
      });

      Swal.fire("Listo", "Permiso creado correctamente", "success");
      setNombre("");
      setDescripcion("");
      setMisPermisos((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo crear el permiso", "error");
    }
  };

  const eliminarPermiso = async (permiso) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Eliminar permiso",
      text: `Se quitara "${permiso.nombre}" de todos los usuarios que lo tengan asignado.`,
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    try {
      const { data } = await api.delete(`/api/permisos-catalogo/${permiso.id}`);

      setMisPermisos((prev) => prev.filter((p) => p.id !== permiso.id));
      Swal.fire(
        "Eliminado",
        `Permiso eliminado. Asignaciones removidas: ${data.asignacionesEliminadas || 0}`,
        "success",
      );
    } catch (err) {
      console.error(err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo eliminar el permiso",
        "error",
      );
    }
  };

  return (
    <div className="p-6 bg-white rounded shadow-md mb-6">
      <h2 className="text-xl font-bold text-green-500 mb-4">Crear Permiso</h2>

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
          <label className="block mb-1 font-medium">Descripcion</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Descripcion opcional"
          />
        </div>
        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Crear Permiso
        </button>
      </form>

      <h3 className="text-lg font-semibold text-green-500 mb-2">Permisos existentes</h3>
      {misPermisos.length === 0 ? (
        <p className="text-gray-500">No hay permisos creados todavia.</p>
      ) : (
        <table className="w-full border border-gray-200">
          <thead className="bg-green-100">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">Descripcion</th>
              <th className="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {misPermisos.map((p) => (
              <tr key={p.id} className="border-t border-gray-200">
                <td className="px-4 py-2">{p.nombre}</td>
                <td className="px-4 py-2">{p.descripcion || "-"}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => eliminarPermiso(p)}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
