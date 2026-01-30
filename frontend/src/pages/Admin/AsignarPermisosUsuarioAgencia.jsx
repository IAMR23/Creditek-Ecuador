import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function AsignarPermisosUsuarioAgencia() {
  const [usuariosAgencia, setUsuariosAgencia] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState([]);

  // 🔹 Cargar usuarios-agencia activos
  useEffect(() => {
    axios
      .get(`${API_URL}/usuario-agencia/activos`)
      .then(res => setUsuariosAgencia(res.data))
      .catch(() => Swal.fire("Error", "No se pudieron cargar usuarios", "error"));
  }, []);

  // 🔹 Cargar catálogo de permisos
  useEffect(() => {
    axios
      .get(`${API_URL}/api/permisos-catalogo`)
      .then(res => setPermisos(res.data))
      .catch(() => Swal.fire("Error", "No se pudieron cargar permisos", "error"));
  }, []);

  // 🔹 Al seleccionar usuario-agencia
  const seleccionarUsuario = (ua) => {
    setUsuarioSeleccionado(ua);
    const actuales = ua.permisosAsignados.map(p => p.permiso.id);
    setPermisosSeleccionados(actuales);
  };

  // 🔹 Checkbox handler
  const togglePermiso = (permisoId) => {
    setPermisosSeleccionados(prev =>
      prev.includes(permisoId)
        ? prev.filter(id => id !== permisoId)
        : [...prev, permisoId]
    );
  };

  // 🔹 Guardar permisos
  const guardarPermisos = async () => {
    if (!usuarioSeleccionado)
      return Swal.fire("Error", "Seleccione un usuario", "warning");

    try {
      await axios.post(`${API_URL}/api/usuario-agencia-permisos`, {
        usuarioAgenciaId: usuarioSeleccionado.id,
        permisoIds: permisosSeleccionados,
      });

      Swal.fire("Listo", "Permisos asignados correctamente", "success");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudieron asignar permisos", "error");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-green-500 mb-6">
        Asignar permisos a usuarios
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 🔹 Usuarios */}
        <div className="bg-white rounded shadow p-4">
          <h2 className="font-semibold mb-4">Usuarios / Agencia</h2>

          <ul className="space-y-2">
            {usuariosAgencia.map(ua => (
              <li
                key={ua.id}
                onClick={() => seleccionarUsuario(ua)}
                className={`p-3 rounded cursor-pointer border
                  ${
                    usuarioSeleccionado?.id === ua.id
                      ? "bg-green-100 border-green-500"
                      : "hover:bg-gray-100"
                  }`}
              >
                <p className="font-medium">{ua.usuario.nombre}</p>
                <p className="text-sm text-gray-500">{ua.agencia.nombre}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* 🔹 Permisos */}
        <div className="bg-white rounded shadow p-4 md:col-span-2">
          <h2 className="font-semibold mb-4">Permisos</h2>

          {!usuarioSeleccionado ? (
            <p className="text-gray-500">Seleccione un usuario para asignar permisos</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {permisos.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 border p-2 rounded cursor-pointer hover:bg-green-50"
                  >
                    <input
                      type="checkbox"
                      checked={permisosSeleccionados.includes(p.id)}
                      onChange={() => togglePermiso(p.id)}
                      className="accent-green-500"
                    />
                    <span>{p.nombre}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={guardarPermisos}
                className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600"
              >
                Guardar permisos
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
