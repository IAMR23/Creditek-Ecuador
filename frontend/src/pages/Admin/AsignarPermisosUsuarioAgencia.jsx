import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldPlus,
  Users,
} from "lucide-react";
import { api } from "../../api/client";
import { SYSTEM_ROUTES } from "../../config/routePermissions";

const getPermisosIds = (usuario) =>
  (usuario?.permisosAsignados || [])
    .map((item) => item.permiso?.id)
    .filter(Boolean);

const getPermisosNombres = (usuario) =>
  (usuario?.permisosAsignados || [])
    .map((item) => item.permiso?.nombre)
    .filter(Boolean);

export default function AsignarPermisosUsuarioAgencia() {
  const [usuarios, setUsuarios] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [permisosSeleccionados, setPermisosSeleccionados] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [permisoFiltro, setPermisoFiltro] = useState("");
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const usuariosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();

    return usuarios.filter((usuario) => {
      const permisosIds = getPermisosIds(usuario);
      const coincidePermiso =
        !permisoFiltro ||
        (permisoFiltro === "sin-permisos"
          ? permisosIds.length === 0
          : permisosIds.some((id) => String(id) === permisoFiltro));

      if (!coincidePermiso) return false;
      if (!term) return true;

      const permisosTexto = getPermisosNombres(usuario).join(" ");
      return `${usuario.nombre || ""} ${usuario.email || ""} ${usuario.rol?.nombre || ""} ${permisosTexto}`
        .toLowerCase()
        .includes(term);
    });
  }, [busqueda, permisoFiltro, usuarios]);

  const permisosPorSeccion = useMemo(() => {
    return permisos.reduce((acc, permiso) => {
      const key = permiso.nombre || "Sin nombre";
      acc[key] = permiso;
      return acc;
    }, {});
  }, [permisos]);

  const cargarUsuarios = async () => {
    const { data } = await api.get("/api/usuario-permisos/usuarios-permisos");
    setUsuarios(data || []);
    return data || [];
  };

  const cargarPermisos = async () => {
    const { data } = await api.post("/api/permisos-catalogo/sincronizar", {
      permisos: SYSTEM_ROUTES.map((ruta) => ({
        nombre: ruta.permission,
        descripcion: ruta.descripcion,
      })),
    });
    setPermisos(data || []);
    return data || [];
  };

  const cargarTodo = async () => {
    setLoading(true);
    try {
      const [usuariosData] = await Promise.all([cargarUsuarios(), cargarPermisos()]);

      if (usuarioSeleccionado) {
        const actualizado = usuariosData.find(
          (usuario) => usuario.id === usuarioSeleccionado.id,
        );
        if (actualizado) seleccionarUsuario(actualizado);
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar usuarios y permisos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seleccionarUsuario = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setPermisosSeleccionados(getPermisosIds(usuario));
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
      await api.post("/api/usuario-permisos", {
        usuarioId: usuarioSeleccionado.id,
        permisoIds: permisosSeleccionados,
      });

      const usuariosActualizados = await cargarUsuarios();
      const usuarioActualizado = usuariosActualizados.find(
        (usuario) => usuario.id === usuarioSeleccionado.id,
      );

      if (usuarioActualizado) seleccionarUsuario(usuarioActualizado);

      Swal.fire("Listo", "Permisos actualizados correctamente", "success");
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron actualizar permisos",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const seleccionarTodos = () => {
    setPermisosSeleccionados(permisos.map((permiso) => permiso.id));
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <ShieldCheck size={18} />
                Administracion
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Permisos de usuarios
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Asigna, consulta y actualiza permisos desde una sola pantalla.
              </p>
            </div>

            <button
              type="button"
              onClick={cargarTodo}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Users size={18} />
                Usuarios
              </div>
              <div className="relative mt-3">
                <Search
                  className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                  size={18}
                />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar usuario o permiso"
                  className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <select
                value={permisoFiltro}
                onChange={(event) => setPermisoFiltro(event.target.value)}
                aria-label="Filtrar usuarios por permiso"
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todos los permisos</option>
                <option value="sin-permisos">Sin permisos asignados</option>
                {permisos.map((permiso) => (
                  <option key={permiso.id} value={String(permiso.id)}>
                    {permiso.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                {usuariosFiltrados.length} de {usuarios.length} usuarios
              </p>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-3">
              {usuariosFiltrados.map((usuario) => (
                <button
                  type="button"
                  key={usuario.id}
                  onClick={() => seleccionarUsuario(usuario)}
                  className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                    usuarioSeleccionado?.id === usuario.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{usuario.nombre}</p>
                      <p className="text-xs text-slate-500">{usuario.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        usuario.activo
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {usuario.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {getPermisosIds(usuario).length} permisos asignados
                  </p>
                </button>
              ))}

              {!usuariosFiltrados.length && (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  No hay usuarios para la busqueda actual.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <ShieldPlus size={18} />
                    Editor de permisos
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {usuarioSeleccionado
                      ? `${usuarioSeleccionado.nombre} - ${permisosSeleccionados.length} permisos seleccionados`
                      : "Seleccione un usuario para editar sus permisos."}
                  </p>
                </div>

                {usuarioSeleccionado && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={seleccionarTodos}
                      disabled={guardando}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                      Seleccionar todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermisosSeleccionados([])}
                      disabled={guardando}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                    >
                      Quitar todos
                    </button>
                    <button
                      type="button"
                      onClick={guardarPermisos}
                      disabled={guardando}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {guardando ? "Guardando..." : "Guardar permisos"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              {!usuarioSeleccionado ? (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">
                  Seleccione un usuario del listado para empezar.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Object.values(permisosPorSeccion).map((permiso) => (
                    <label
                      key={permiso.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:bg-emerald-50"
                    >
                      <input
                        type="checkbox"
                        checked={permisosSeleccionados.includes(permiso.id)}
                        onChange={() => togglePermiso(permiso.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          {permiso.nombre}
                        </span>
                        {permiso.descripcion ? (
                          <span className="block text-xs text-slate-500">
                            {permiso.descripcion}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-semibold text-slate-900">Usuarios con permisos</h2>
              <span className="text-sm text-slate-500">
                {usuariosFiltrados.length} resultado(s)
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Permisos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {usuario.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{usuario.email}</td>
                    <td className="px-4 py-3">{usuario.rol?.nombre || "Sin rol"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          usuario.activo
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getPermisosNombres(usuario).length ? (
                        <div className="flex flex-wrap gap-2">
                          {getPermisosNombres(usuario).map((permiso) => (
                            <span
                              key={`${usuario.id}-${permiso}`}
                              className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                            >
                              {permiso}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">Sin permisos</span>
                      )}
                    </td>
                  </tr>
                ))}

                {!usuariosFiltrados.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No hay registros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
