import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import { api } from "../../api/client";

const normalizeText = (value) => (value?.trim() ? value.trim() : null);

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [rolesPago, setRolesPago] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    q: "",
    rolId: "",
    activo: "",
  });

  const [form, setForm] = useState({
    nombre: "",
    cedula: "",
    email: "",
    usuario: "",
    password: "",
    rolId: "",
    rolIds: [],
    rolPagoId: "",
    fechaIngreso: "",
    fechaSalida: "",
    numeroCuenta: "",
    entidadFinanciera: "",
    direccion: "",
    telefono: "",
  });

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    nombre: "",
    cedula: "",
    email: "",
    usuario: "",
    password: "",
    rolId: "",
    rolIds: [],
    rolPagoId: "",
    fechaIngreso: "",
    fechaSalida: "",
    numeroCuenta: "",
    entidadFinanciera: "",
    direccion: "",
    telefono: "",
    activo: true,
  });

  const abrirModalEditar = (usuario) => {
    const rolIds = usuario.roles?.length
      ? usuario.roles.map((rol) => String(rol.id))
      : usuario.rol?.id
        ? [String(usuario.rol.id)]
        : [];

    setEditForm({
      id: usuario.id,
      nombre: usuario.nombre || "",
      cedula: usuario.cedula || "",
      email: usuario.email || "",
      usuario: usuario.usuario || "",
      password: "",
      rolId: rolIds[0] || "",
      rolIds,
      rolPagoId: usuario.rolPagoId ? String(usuario.rolPagoId) : "",
      fechaIngreso: usuario.fechaIngreso || "",
      fechaSalida: usuario.fechaSalida || "",
      numeroCuenta: usuario.numeroCuenta || "",
      entidadFinanciera: usuario.entidadFinanciera || "",
      direccion: usuario.direccion || "",
      telefono: usuario.telefono || "",
      activo: !!usuario.activo,
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
      usuario: "",
      password: "",
      rolId: "",
      rolIds: [],
      rolPagoId: "",
      fechaIngreso: "",
      fechaSalida: "",
      numeroCuenta: "",
      entidadFinanciera: "",
      direccion: "",
      telefono: "",
      activo: true,
    });
  };

  const cargarUsuarios = async () => {
    const res = await axios.get(`${API_URL}/usuarios`, {
      params: { incluirInactivos: true },
    });
    setUsuarios(res.data);
  };

  const cargarRoles = async () => {
    const res = await axios.get(`${API_URL}/rol`);
    setRoles(res.data);
  };

  const cargarRolesPago = async () => {
    try {
      const { data } = await api.get("/api/contabilidad/roles-pago");
      setRolesPago(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando roles de pago", error);
      setRolesPago([]);
    }
  };

  const toggleRol = (estado, setEstado, rolId) => {
    setEstado((prev) => {
      const rolIds = prev.rolIds || [];
      const existe = rolIds.includes(String(rolId));
      const nuevosRolIds = existe
        ? rolIds.filter((id) => id !== String(rolId))
        : [...rolIds, String(rolId)];

      return {
        ...prev,
        rolIds: nuevosRolIds,
        rolId: nuevosRolIds[0] || "",
      };
    });
  };

  useEffect(() => {
    cargarUsuarios();
    cargarRoles();
    cargarRolesPago();
  }, []);

  const crearUsuario = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post(`${API_URL}/usuarios`, {
        nombre: form.nombre,
        cedula: form.cedula,
        email: form.email,
        usuario: form.usuario,
        password: form.password,
        rolId: form.rolIds[0] || form.rolId,
        rolIds: form.rolIds,
        rolPagoId: form.rolPagoId || null,
        fechaIngreso: form.fechaIngreso || null,
        fechaSalida: form.fechaSalida || null,
        numeroCuenta: normalizeText(form.numeroCuenta),
        entidadFinanciera: normalizeText(form.entidadFinanciera),
        direccion: normalizeText(form.direccion),
        telefono: normalizeText(form.telefono),
      });

      setForm({
        nombre: "",
        cedula: "",
        email: "",
        usuario: "",
        password: "",
        rolId: "",
        rolIds: [],
        rolPagoId: "",
        fechaIngreso: "",
        fechaSalida: "",
        numeroCuenta: "",
        entidadFinanciera: "",
        direccion: "",
        telefono: "",
      });

      await cargarUsuarios();

      Swal.fire({
        icon: "success",
        title: "Usuario creado",
        timer: 2000,
        showConfirmButton: false,
      });
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

  const actualizarUsuario = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/usuarios/${editForm.id}`, {
        nombre: editForm.nombre,
        cedula: editForm.cedula,
        email: editForm.email,
        usuario: editForm.usuario,
        password: editForm.password || undefined,
        rolId: editForm.rolIds[0] || editForm.rolId,
        rolIds: editForm.rolIds,
        rolPagoId: editForm.rolPagoId || null,
        fechaIngreso: editForm.fechaIngreso || null,
        fechaSalida: editForm.fechaSalida || null,
        numeroCuenta: normalizeText(editForm.numeroCuenta),
        entidadFinanciera: normalizeText(editForm.entidadFinanciera),
        direccion: normalizeText(editForm.direccion),
        telefono: normalizeText(editForm.telefono),
        activo: editForm.activo,
      });

      cerrarModalEditar();
      await cargarUsuarios();

      Swal.fire({
        icon: "success",
        title: "Actualizado",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error.response?.data?.message || "No se pudo actualizar el usuario",
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
        const usuario = (u.usuario || "").toLowerCase();
        const cedula = (u.cedula || "").toLowerCase();
        const telefono = (u.telefono || "").toLowerCase();
        return (
          nombre.includes(q) ||
          email.includes(q) ||
          usuario.includes(q) ||
          cedula.includes(q) ||
          telefono.includes(q)
        );
      })
      .filter((u) => {
        if (!filters.rolId) return true;
        const rolesUsuario = u.roles?.length ? u.roles : u.rol ? [u.rol] : [];
        return rolesUsuario.some((rol) => String(rol.id) === String(filters.rolId));
      })
      .filter((u) => {
        if (filters.activo === "") return true;
        return u.activo === (filters.activo === "true");
      });
  }, [usuarios, filters]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                Administración
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Gestión de Usuarios
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Controla usuarios, roles, accesos y estado operativo del
                sistema.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">Total</p>
                <p className="text-xl font-bold text-slate-900">
                  {usuarios.length}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-medium text-emerald-700">
                  Mostrando
                </p>
                <p className="text-xl font-bold text-emerald-700">
                  {usuariosFiltrados.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FORM CREAR USUARIO */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-lg font-bold text-slate-900">Crear Usuario</h2>
            <p className="mt-1 text-sm text-slate-500">
              Registra un nuevo usuario con su información personal y rol
              asignado.
            </p>
          </div>

          <form onSubmit={crearUsuario} className="p-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Nombre completo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Cédula
                </label>
                <input
                  type="text"
                  placeholder="Ej: 1723456789"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.cedula}
                  onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="usuario@empresa.com"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Nombre de usuario
                </label>
                <input
                  type="text"
                  placeholder="Ej: juan.perez"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.usuario}
                  onChange={(e) =>
                    setForm({ ...form, usuario: e.target.value.toLowerCase() })
                  }
                  pattern="[a-z0-9._-]{3,50}"
                  title="Use entre 3 y 50 letras, numeros, puntos, guiones o guiones bajos"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="Contraseña de acceso"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Rol del usuario
                </label>
                <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
                  {roles.map((r) => (
                    <label key={r.id} className="mb-2 flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={(form.rolIds || []).includes(String(r.id))}
                        onChange={() => toggleRol(form, setForm, r.id)}
                        className="accent-emerald-600"
                      />
                      <span>{r.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Cargo salarial
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.rolPagoId}
                  onChange={(e) => setForm({ ...form, rolPagoId: e.target.value })}
                >
                  <option value="">Sin cargo salarial</option>
                  {rolesPago.map((rolPago) => (
                    <option key={rolPago.id} value={rolPago.id}>
                      {rolPago.nivel} - {rolPago.cargo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Teléfono
                </label>
                <input
                  type="text"
                  placeholder="Ej: 0999999999"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.telefono}
                  onChange={(e) =>
                    setForm({ ...form, telefono: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Número de cuenta
                </label>
                <input
                  type="text"
                  placeholder="Cuenta bancaria"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.numeroCuenta}
                  onChange={(e) =>
                    setForm({ ...form, numeroCuenta: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Entidad financiera
                </label>
                <input
                  type="text"
                  placeholder="Banco o cooperativa"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.entidadFinanciera}
                  onChange={(e) =>
                    setForm({ ...form, entidadFinanciera: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Fecha de ingreso
                </label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.fechaIngreso}
                  onChange={(e) =>
                    setForm({ ...form, fechaIngreso: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Fecha de salida
                </label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.fechaSalida}
                  onChange={(e) =>
                    setForm({ ...form, fechaSalida: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
                <label className="text-sm font-semibold text-slate-700">
                  Dirección
                </label>
                <textarea
                  placeholder="Dirección domiciliaria"
                  className="min-h-[90px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={form.direccion}
                  onChange={(e) =>
                    setForm({ ...form, direccion: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mt-6  flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-black  text-white inline-flex items-center justify-center rounded-2xl  px-6 py-3 text-sm font-bold  shadow-sm transition "
              >
                {loading ? "Creando usuario..." : "Crear Usuario"}
              </button>
            </div>
          </form>
        </div>

        {/* LISTA USUARIOS */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Lista de Usuarios
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Filtra, revisa y administra usuarios registrados.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-slate-700">
                  Buscar usuario
                </label>
                <input
                  type="text"
                  placeholder="Buscar por nombre, usuario, email, cédula o teléfono"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  value={filters.q}
                  onChange={(e) =>
                    setFilters({ ...filters, q: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Filtrar por rol
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  value={filters.rolId}
                  onChange={(e) =>
                    setFilters({ ...filters, rolId: e.target.value })
                  }
                >
                  <option value="">Todos los roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Estado
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  value={filters.activo}
                  onChange={(e) =>
                    setFilters({ ...filters, activo: e.target.value })
                  }
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setFilters({ q: "", rolId: "", activo: "" })}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4 text-left">Usuario</th>
                  <th className="px-6 py-4 text-left">Cédula</th>
                  <th className="px-6 py-4 text-left">Contacto</th>
                  <th className="px-6 py-4 text-left">Rol</th>
                  <th className="px-6 py-4 text-left">Cargo salarial</th>
                  <th className="px-6 py-4 text-left">Ingreso</th>
                  <th className="px-6 py-4 text-left">Estado</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id} className="transition hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {u.nombre}
                        </p>
                        <p className="text-xs font-medium text-emerald-700">
                          @{u.usuario || "sin-usuario"}
                        </p>
                        <p className="text-sm text-slate-500">{u.email}</p>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {u.cedula}
                    </td>

                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-800">
                        {u.rolPago?.cargo || "-"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {u.rolPago?.nivel || ""}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">
                        {u.telefono || "-"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Cuenta: {u.numeroCuenta || "-"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Entidad: {u.entidadFinanciera || "-"}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles?.length ? u.roles : u.rol ? [u.rol] : []).map((rol) => (
                          <span key={rol.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            {rol.nombre}
                          </span>
                        ))}
                        {!(u.roles?.length || u.rol) && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            Sin rol
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-700">
                        {u.fechaIngreso || "-"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Salida: {u.fechaSalida || "-"}
                      </p>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          u.activo
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => abrirModalEditar(u)}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}

                {usuariosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center">
                      <p className="font-semibold text-slate-700">
                        No se encontraron usuarios
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Ajusta los filtros para ver más resultados.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="grid grid-cols-1 gap-4 p-4 lg:hidden">
            {usuariosFiltrados.map((u) => (
              <div
                key={u.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{u.nombre}</h3>
                    <p className="text-xs font-medium text-emerald-700">
                      @{u.usuario || "sin-usuario"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{u.email}</p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      u.activo
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      Cédula
                    </p>
                    <p className="font-medium text-slate-700">{u.cedula}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400">Rol</p>
                    <p className="font-medium text-slate-700">
                      {(u.roles?.length ? u.roles : u.rol ? [u.rol] : [])
                        .map((rol) => rol.nombre)
                        .join(", ") || "Sin rol"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      Cargo salarial
                    </p>
                    <p className="font-medium text-slate-700">
                      {u.rolPago?.cargo || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      Teléfono
                    </p>
                    <p className="font-medium text-slate-700">
                      {u.telefono || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      Entidad financiera
                    </p>
                    <p className="font-medium text-slate-700">
                      {u.entidadFinanciera || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400">
                      Ingreso
                    </p>
                    <p className="font-medium text-slate-700">
                      {u.fechaIngreso || "-"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => abrirModalEditar(u)}
                  className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
                >
                  Editar usuario
                </button>
              </div>
            ))}

            {usuariosFiltrados.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-semibold text-slate-700">
                  No hay usuarios para los filtros actuales.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* MODAL EDITAR */}
        {editModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4">
            <div className="flex min-h-full items-start justify-center py-4 sm:py-6">
              <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl max-sm:min-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)]">
              <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Editar Usuario
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Actualiza la información y permisos principales del
                      usuario.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={cerrarModalEditar}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <form onSubmit={actualizarUsuario} className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.nombre}
                      onChange={(e) =>
                        setEditForm({ ...editForm, nombre: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Entidad financiera
                    </label>
                    <input
                      type="text"
                      placeholder="Banco o cooperativa"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.entidadFinanciera}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          entidadFinanciera: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Cédula
                    </label>
                    <input
                      type="text"
                      placeholder="Cédula"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.cedula}
                      onChange={(e) =>
                        setEditForm({ ...editForm, cedula: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Correo electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="Email"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Nombre de usuario
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: juan.perez"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.usuario}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          usuario: e.target.value.toLowerCase(),
                        })
                      }
                      pattern="[a-z0-9._-]{3,50}"
                      title="Use entre 3 y 50 letras, numeros, puntos, guiones o guiones bajos"
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="Opcional"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.password}
                      onChange={(e) =>
                        setEditForm({ ...editForm, password: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Rol
                    </label>
                    <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
                      {roles.map((r) => (
                        <label key={r.id} className="mb-2 flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={(editForm.rolIds || []).includes(String(r.id))}
                            onChange={() => toggleRol(editForm, setEditForm, r.id)}
                            className="accent-emerald-600"
                          />
                          <span>{r.nombre}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Cargo salarial
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.rolPagoId}
                      onChange={(e) =>
                        setEditForm({ ...editForm, rolPagoId: e.target.value })
                      }
                    >
                      <option value="">Sin cargo salarial</option>
                      {rolesPago.map((rolPago) => (
                        <option key={rolPago.id} value={rolPago.id}>
                          {rolPago.nivel} - {rolPago.cargo}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      placeholder="Teléfono"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.telefono}
                      onChange={(e) =>
                        setEditForm({ ...editForm, telefono: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Número de cuenta
                    </label>
                    <input
                      type="text"
                      placeholder="Número de cuenta"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.numeroCuenta}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          numeroCuenta: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Estado
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.activo}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          activo: e.target.value === "true",
                        })
                      }
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Fecha de ingreso
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.fechaIngreso}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          fechaIngreso: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Fecha de salida
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.fechaSalida}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          fechaSalida: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Dirección
                    </label>
                    <textarea
                      placeholder="Dirección"
                      className="min-h-[90px] w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editForm.direccion}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          direccion: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={cerrarModalEditar}
                    className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
