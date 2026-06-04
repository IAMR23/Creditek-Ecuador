import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import { SYSTEM_ROUTES } from "../../config/routePermissions";

export default function AsignarPermisosUsuarioAgencia() {
  const [usuariosAgencia, setUsuariosAgencia] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const cargarUsuariosAgencia = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/usuario-agencia/activos`);
      setUsuariosAgencia(data || []);
      return data || [];
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar usuarios", "error");
      return [];
    }
  };

  const cargarPermisos = async () => {
    try {
      const { data } = await axios.post(`${API_URL}/api/permisos-catalogo/sincronizar`, {
        permisos: SYSTEM_ROUTES.map((ruta) => ({
          nombre: ruta.permission,
          descripcion: ruta.path,
        })),
      });
      setPermisos(data || []);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar permisos", "error");
    }
  };

  useEffect(() => {
    cargarUsuariosAgencia();
    cargarPermisos();
  }, []);

  const seleccionarUsuario = (ua) => {
    setUsuarioSeleccionado(ua);
    setPermisosSeleccionados(
      (ua.permisosAsignados || [])
        .map((p) => p.permiso?.id)
        .filter(Boolean),
    );
  };

  const togglePermiso = (permisoId) => {
    setPermisosSeleccionados((prev) =>
      prev.includes(permisoId)
        ? prev.filter((id) => id !== permisoId)
        : [...prev, permisoId],
    );
  };

  const guardarPermisos = async () => {
    if (!usuarioSeleccionado) {
      return Swal.fire("Error", "Seleccione un usuario", "warning");
    }

    setGuardando(true);

    try {
      await axios.post(`${API_URL}/api/usuario-agencia-permisos`, {
        usuarioAgenciaId: usuarioSeleccionado.id,
        permisoIds: permisosSeleccionados,
      });

      const usuariosActualizados = await cargarUsuariosAgencia();
      const usuarioActualizado = usuariosActualizados.find(
        (ua) => ua.id === usuarioSeleccionado.id,
      );

      if (usuarioActualizado) {
        seleccionarUsuario(usuarioActualizado);
      }

      Swal.fire("Listo", "Permisos actualizados correctamente", "success");
    } catch (error) {
      console.error(error);
      const mensaje =
        error.response?.data?.message || "No se pudieron actualizar permisos";
      Swal.fire("Error", mensaje, "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="mb-6 text-2xl font-bold text-green-600">
        Asignar permisos a usuarios
      </h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded bg-white p-4 shadow">
          <h2 className="mb-4 font-semibold">Usuarios / Agencia</h2>

          <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
            {usuariosAgencia.map((ua) => (
              <li
                key={ua.id}
                onClick={() => seleccionarUsuario(ua)}
                className={`cursor-pointer rounded border p-3 ${
                  usuarioSeleccionado?.id === ua.id
                    ? "border-green-500 bg-green-100"
                    : "hover:bg-gray-100"
                }`}
              >
                <p className="font-medium">{ua.usuario?.nombre}</p>
                <p className="text-sm text-gray-500">{ua.agencia?.nombre}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded bg-white p-4 shadow md:col-span-2">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">Permisos</h2>
            {usuarioSeleccionado && (
              <span className="text-sm text-gray-500">
                {permisosSeleccionados.length} seleccionados
              </span>
            )}
          </div>

          {!usuarioSeleccionado ? (
            <p className="text-gray-500">
              Seleccione un usuario para asignar permisos.
            </p>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {permisos.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded border p-2 hover:bg-green-50"
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

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPermisosSeleccionados([])}
                  disabled={guardando}
                  className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  Quitar todos
                </button>
                <button
                  onClick={guardarPermisos}
                  disabled={guardando}
                  className="rounded bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Guardar permisos"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
