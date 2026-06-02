import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const normalizeText = (value) => (value?.trim() ? value.trim() : null);

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [relacionesActivas, setRelacionesActivas] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    q: "",
    rolId: "",
    agenciaId: "",
    activo: "",
  });

  const [form, setForm] = useState({
    nombre: "",
    cedula: "",
    email: "",
    password: "",
    rolId: "",
    fechaIngreso: "",
    fechaSalida: "",
    numeroCuenta: "",
    direccion: "",
    telefono: "",
    agenciasIds: [],
  });

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    nombre: "",
    cedula: "",
    email: "",
    password: "",
    rolId: "",
    fechaIngreso: "",
    fechaSalida: "",
    numeroCuenta: "",
    direccion: "",
    telefono: "",
    activo: true,
    agenciasIds: [],
  });

  const cargarTodo = async () => {
    const [u, r, a, rel] = await Promise.all([
      api.get("/usuarios"),
      api.get("/rol"),
      api.get("/agencias"),
      api.get("/usuario-agencia/activos"),
    ]);
    setUsuarios(u.data);
    setRoles(r.data);
    setAgencias(a.data);
    setRelacionesActivas(rel.data);
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const agenciasPorUsuario = useMemo(() => {
    const map = new Map();
    for (const rel of relacionesActivas) {
      const usuarioId = rel.usuarioId ?? rel.usuario?.id;
      const agencia = rel.agencia;
      if (!usuarioId || !agencia) continue;
      if (!map.has(usuarioId)) map.set(usuarioId, []);
      map.get(usuarioId).push({ usuarioAgenciaId: rel.id, ...agencia });
    }
    return map;
  }, [relacionesActivas]);

  const toggleAgenciaInList = (list, agenciaId) => {
    const id = String(agenciaId);
    if (list.some((x) => String(x) === id)) return list.filter((x) => String(x) !== id);
    return [...list, agenciaId];
  };

  const crearUsuario = async (e) => {
    e.preventDefault();
    if (!form.rolId) {
      return Swal.fire({ icon: "warning", title: "Rol requerido", text: "Selecciona un rol." });
    }
    if (form.agenciasIds.length === 0) {
      return Swal.fire({
        icon: "warning",
        title: "Agencia requerida",
        text: "Selecciona al menos una agencia para el usuario.",
      });
    }

    try {
      setLoading(true);
      const res = await api.post("/usuarios", {
        nombre: form.nombre,
        cedula: form.cedula,
        email: form.email,
        password: form.password,
        rolId: form.rolId,
        fechaIngreso: form.fechaIngreso || null,
        fechaSalida: form.fechaSalida || null,
        numeroCuenta: normalizeText(form.numeroCuenta),
        direccion: normalizeText(form.direccion),
        telefono: normalizeText(form.telefono),
      });

      const userId = res.data?.id;
      await Promise.all(
        form.agenciasIds.map((agenciaId) =>
          api.post("/usuario-agencia", { usuarioId: userId, agenciaId, activo: true })
        )
      );

      setForm({
        nombre: "",
        cedula: "",
        email: "",
        password: "",
        rolId: "",
        fechaIngreso: "",
        fechaSalida: "",
        numeroCuenta: "",
        direccion: "",
        telefono: "",
        agenciasIds: [],
      });

      await cargarTodo();
      Swal.fire({ icon: "success", title: "Usuario creado", timer: 1300, showConfirmButton: false });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "No se pudo crear el usuario",
      });
    } finally {
      setLoading(false);
    }
  };

  const abrirModalEditar = (usuario) => {
    const agenciasUser = agenciasPorUsuario.get(usuario.id) || [];
    setEditForm({
      id: usuario.id,
      nombre: usuario.nombre || "",
      cedula: usuario.cedula || "",
      email: usuario.email || "",
      password: "",
      rolId: usuario.rol?.id || "",
      fechaIngreso: usuario.fechaIngreso || "",
      fechaSalida: usuario.fechaSalida || "",
      numeroCuenta: usuario.numeroCuenta || "",
      direccion: usuario.direccion || "",
      telefono: usuario.telefono || "",
      activo: !!usuario.activo,
      agenciasIds: agenciasUser.map((a) => a.id),
    });
    setEditModal(true);
  };

  const cerrarModalEditar = () => {
    setEditModal(false);
    setEditForm({
      id: null,
      nombre: "",
      cedula: "",
      email: "",
      password: "",
      rolId: "",
      fechaIngreso: "",
      fechaSalida: "",
      numeroCuenta: "",
      direccion: "",
      telefono: "",
      activo: true,
      agenciasIds: [],
    });
  };

  const sincronizarAgenciasUsuario = async (usuarioId, agenciasSeleccionadas) => {
    const actuales = (agenciasPorUsuario.get(usuarioId) || []).map((a) => ({
      agenciaId: a.id,
      usuarioAgenciaId: a.usuarioAgenciaId,
    }));

    const selectedSet = new Set(agenciasSeleccionadas.map((id) => String(id)));

    const toDisable = actuales.filter((x) => !selectedSet.has(String(x.agenciaId)));
    const toKeep = actuales.filter((x) => selectedSet.has(String(x.agenciaId)));
    const currentSet = new Set(actuales.map((x) => String(x.agenciaId)));
    const toCreate = agenciasSeleccionadas.filter((id) => !currentSet.has(String(id)));

    await Promise.all([
      ...toDisable.map((x) => api.put(`/usuario-agencia/${x.usuarioAgenciaId}`, { activo: false })),
      ...toKeep.map((x) => api.put(`/usuario-agencia/${x.usuarioAgenciaId}`, { activo: true })),
      ...toCreate.map((agenciaId) =>
        api.post("/usuario-agencia", { usuarioId, agenciaId, activo: true })
      ),
    ]);
  };

  const actualizarUsuario = async (e) => {
    e.preventDefault();
    if (!editForm.rolId) {
      return Swal.fire({ icon: "warning", title: "Rol requerido", text: "Selecciona un rol." });
    }
    if (editForm.agenciasIds.length === 0) {
      return Swal.fire({
        icon: "warning",
        title: "Agencia requerida",
        text: "Selecciona al menos una agencia para el usuario.",
      });
    }

    try {
      await api.put(`/usuarios/${editForm.id}`, {
        nombre: editForm.nombre,
        cedula: editForm.cedula,
        email: editForm.email,
        password: editForm.password || undefined,
        rolId: editForm.rolId,
        fechaIngreso: editForm.fechaIngreso || null,
        fechaSalida: editForm.fechaSalida || null,
        numeroCuenta: normalizeText(editForm.numeroCuenta),
        direccion: normalizeText(editForm.direccion),
        telefono: normalizeText(editForm.telefono),
        activo: editForm.activo,
      });

      await sincronizarAgenciasUsuario(editForm.id, editForm.agenciasIds);

      cerrarModalEditar();
      await cargarTodo();
      Swal.fire({ icon: "success", title: "Actualizado", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "No se pudo actualizar el usuario",
      });
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return usuarios
      .filter((u) => {
        if (!q) return true;
        const nombre = (u.nombre || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const cedula = (u.cedula || "").toLowerCase();
        const telefono = (u.telefono || "").toLowerCase();
        return (
          nombre.includes(q) || email.includes(q) || cedula.includes(q) || telefono.includes(q)
        );
      })
      .filter((u) => {
        if (!filters.rolId) return true;
        return String(u.rol?.id || "") === String(filters.rolId);
      })
      .filter((u) => {
        if (!filters.agenciaId) return true;
        const list = agenciasPorUsuario.get(u.id) || [];
        return list.some((a) => String(a.id) === String(filters.agenciaId));
      })
      .filter((u) => {
        if (filters.activo === "") return true;
        return u.activo === (filters.activo === "true");
      });
  }, [usuarios, filters, agenciasPorUsuario]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Usuarios</h1>
        <p className="text-sm text-slate-500 mt-1">
          Mostrando {usuariosFiltrados.length} de {usuarios.length}
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm rounded-2xl p-6 mb-8 border border-slate-200">
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Crear usuario</h2>
            <p className="text-sm text-slate-500 mt-1">
              Asigna un rol y al menos una agencia.
            </p>
          </div>
          <div className="hidden md:block h-px flex-1 bg-gradient-to-r from-orange-200 to-transparent" />
        </div>

        <form onSubmit={crearUsuario} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Nombre"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <input
            type="text"
            placeholder="Cédula"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.cedula}
            onChange={(e) => setForm({ ...form, cedula: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <select
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.rolId}
            onChange={(e) => setForm({ ...form, rolId: e.target.value })}
          >
            <option value="">Rol</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Teléfono"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />

          <input
            type="text"
            placeholder="Número de cuenta"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.numeroCuenta}
            onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })}
          />

          <input
            type="date"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.fechaIngreso}
            onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
          />

          <input
            type="date"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.fechaSalida}
            onChange={(e) => setForm({ ...form, fechaSalida: e.target.value })}
          />

          <textarea
            placeholder="Dirección"
            className="border border-slate-200 bg-white p-3 rounded-xl md:col-span-2 min-h-[44px] outline-none focus:ring-2 focus:ring-orange-200"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          />

          <div className="md:col-span-2 border border-slate-200 rounded-2xl p-4 bg-white">
            <div className="text-sm font-extrabold tracking-tight text-slate-950">
              Agencias
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Selecciona al menos una.
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {agencias.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.agenciasIds.some((id) => String(id) === String(a.id))}
                    onChange={() =>
                      setForm({
                        ...form,
                        agenciasIds: toggleAgenciaInList(form.agenciasIds, a.id),
                      })
                    }
                  />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900">{a.nombre}</div>
                    <div className="text-xs text-slate-500">{a.ciudad || "-"}</div>
                  </div>
                </label>
              ))}
              {agencias.length === 0 && (
                <div className="text-sm text-slate-500">
                  No hay agencias. Crea una en “Agencias”.
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 bg-slate-950 hover:bg-slate-900 disabled:bg-slate-700 text-white p-3 rounded-xl font-semibold"
          >
            {loading ? "Creando..." : "Crear Usuario"}
          </button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm rounded-2xl p-6 border border-slate-200">
        <div className="flex flex-col gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-950">Lista</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Buscar (nombre, email, cédula, teléfono)"
              className="border border-slate-200 bg-white p-3 rounded-xl md:col-span-2 outline-none focus:ring-2 focus:ring-orange-200"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />

            <select
              className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
              value={filters.rolId}
              onChange={(e) => setFilters({ ...filters, rolId: e.target.value })}
            >
              <option value="">Todos los roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>

            <select
              className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
              value={filters.agenciaId}
              onChange={(e) => setFilters({ ...filters, agenciaId: e.target.value })}
            >
              <option value="">Todas las agencias</option>
              {agencias.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>

            <select
              className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
              value={filters.activo}
              onChange={(e) => setFilters({ ...filters, activo: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>

            <button
              type="button"
              onClick={() => setFilters({ q: "", rolId: "", agenciaId: "", activo: "" })}
              className="md:col-span-5 justify-self-start text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950 text-white">
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Rol</th>
                <th className="p-3 text-left hidden lg:table-cell">Agencias</th>
                <th className="p-3 text-left">Activo</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuariosFiltrados.map((u) => {
                const list = agenciasPorUsuario.get(u.id) || [];
                return (
                  <tr key={u.id} className="border-b border-slate-200 hover:bg-white">
                    <td className="p-3">{u.nombre}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.rol?.nombre || "-"}</td>
                    <td className="p-3 hidden lg:table-cell">
                      {list.length ? list.map((a) => a.nombre).join(", ") : "-"}
                    </td>
                    <td className="p-3">{u.activo ? "Sí" : "No"}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => abrirModalEditar(u)}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-semibold"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500">
                    No hay usuarios para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-3xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-950">
                Editar usuario
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-orange-200 to-transparent" />
            </div>

            <form onSubmit={actualizarUsuario} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nombre"
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
              />
              <input
                type="text"
                placeholder="Cédula"
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.cedula}
                onChange={(e) => setEditForm({ ...editForm, cedula: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              <input
                type="password"
                placeholder="Nueva contraseña (opcional)"
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />

              <select
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.rolId}
                onChange={(e) => setEditForm({ ...editForm, rolId: e.target.value })}
              >
                <option value="">Rol</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Teléfono"
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.telefono}
                onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
              />

              <input
                type="text"
                placeholder="Número de cuenta"
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.numeroCuenta}
                onChange={(e) => setEditForm({ ...editForm, numeroCuenta: e.target.value })}
              />

              <input
                type="date"
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.fechaIngreso}
                onChange={(e) => setEditForm({ ...editForm, fechaIngreso: e.target.value })}
              />

              <input
                type="date"
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.fechaSalida}
                onChange={(e) => setEditForm({ ...editForm, fechaSalida: e.target.value })}
              />

              <textarea
                placeholder="Dirección"
                className="border border-slate-200 bg-white p-3 rounded-xl md:col-span-2 min-h-[44px] outline-none focus:ring-2 focus:ring-orange-200"
                value={editForm.direccion}
                onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })}
              />

              <div className="md:col-span-2 border border-slate-200 rounded-2xl p-4 bg-white">
                <div className="text-sm font-extrabold tracking-tight text-slate-950">
                  Agencias
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {agencias.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={editForm.agenciasIds.some((id) => String(id) === String(a.id))}
                        onChange={() =>
                          setEditForm({
                            ...editForm,
                            agenciasIds: toggleAgenciaInList(editForm.agenciasIds, a.id),
                          })
                        }
                      />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-900">{a.nombre}</div>
                        <div className="text-xs text-slate-500">{a.ciudad || "-"}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <select
                className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
                value={String(editForm.activo)}
                onChange={(e) => setEditForm({ ...editForm, activo: e.target.value === "true" })}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>

              <div className="flex justify-end gap-3 mt-2 md:col-span-2">
                <button
                  type="button"
                  onClick={cerrarModalEditar}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl font-semibold"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

