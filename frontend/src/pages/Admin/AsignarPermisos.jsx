import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function AsignarPermisos() {
  const [usuariosAgencia, setUsuariosAgencia] = useState([]);
  const [todosLosPermisos, setTodosLosPermisos] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [permisosSeleccionados, setPermisosSeleccionados] = useState([]);

  // Cargar UsuariosAgencia
  useEffect(() => {
    const cargarUsuariosAgencia = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/usuario-agencia/activos`);
        setUsuariosAgencia(data);
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "No se pudieron cargar los usuarios-agencia", "error");
      }
    };
    cargarUsuariosAgencia();
  }, []);

  // Cargar permisos del catálogo
  useEffect(() => {
    const cargarPermisos = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/api/permisos-catalogo`);
        setTodosLosPermisos(data);
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "No se pudieron cargar los permisos", "error");
      }
    };
    cargarPermisos();
  }, []);

  // Manejar selección de checkbox
  const togglePermiso = (id) => {
    setPermisosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // Enviar al backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usuarioSeleccionado) return Swal.fire("Error", "Seleccione un usuario-agencia", "warning");
    if (permisosSeleccionados.length === 0) return Swal.fire("Error", "Seleccione al menos un permiso", "warning");

try {
  const { data } = await axios.post(`${API_URL}/api/usuario-agencia-permisos`, {
    usuarioAgenciaId: usuarioSeleccionado,
    permisoIds: permisosSeleccionados,
  });

  Swal.fire("Listo", "Permisos asignados correctamente", "success");

  // Limpiar selección
  setPermisosSeleccionados([]);
} catch (err) {
  console.error(err);

  // Mostrar mensaje real del backend si existe
  const mensaje = err.response?.data?.message || "No se pudieron asignar los permisos";
  Swal.fire("Error", mensaje, "error");
}

  };

  return (
    <div className="p-6 bg-white rounded shadow-md">
      <h2 className="text-xl font-bold text-green-500 mb-4">Asignar Permisos a Usuario-Agencia</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Seleccionar UsuarioAgencia */}
        <div>
          <label className="block mb-1 font-medium">Usuario-Agencia</label>
          <select
            value={usuarioSeleccionado}
            onChange={(e) => setUsuarioSeleccionado(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">-- Seleccione un usuario --</option>
            {usuariosAgencia.map((ua) => (
              <option key={ua.id} value={ua.id}>
                {ua.usuario?.nombre} - {ua.agencia?.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Lista de permisos */}
        <div>
          <label className="block mb-1 font-medium">Permisos</label>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded p-2">
            {todosLosPermisos.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permisosSeleccionados.includes(p.id)}
                  onChange={() => togglePermiso(p.id)}
                  
                  className="accent-green-500"
                />
                <span>{p.nombre} {p.descripcion && `(${p.descripcion})`}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Asignar Permisos
        </button>
      </form>
    </div>
  );
}
