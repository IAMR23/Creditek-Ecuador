import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    cedula: "",
    email: "",
    password: "",
    rolId: "",
  });

  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    nombre: "",
    cedula: "",
    email: "",
    password: "",
    rolId: "",
    activo: true,
  });

  const abrirModalEditar = (usuario) => {
    setEditForm({
      id: usuario.id,
      nombre: usuario.nombre,
      cedula: usuario.cedula,
      email: usuario.email,
      password: "",
      rolId: usuario.rol?.id || "",
      activo: usuario.activo,
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
      activo: true,
    });
  };

  const cargarUsuarios = async () => {
    const res = await axios.get(`${API_URL}/usuarios`);
    setUsuarios(res.data);
  };

  const cargarRoles = async () => {
    const res = await axios.get(`${API_URL}/rol`);
    setRoles(res.data);
  };

  useEffect(() => {
    cargarUsuarios();
    cargarRoles();
  }, []);

  const crearUsuario = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post(`${API_URL}/usuarios`, {
        nombre: form.nombre,
        cedula: form.cedula,
        email: form.email,
        password: form.password,
        rolId: form.rolId,
      });

      setForm({
        nombre: "",
        cedula: "",
        email: "",
        password: "",
        rolId: "",
      });

      cargarUsuarios();

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

  const eliminarUsuario = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar usuario?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.delete(`${API_URL}/usuarios/${id}`);
      cargarUsuarios();

      Swal.fire({
        icon: "success",
        title: "Eliminado",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo eliminar el usuario",
      });
    }
  };

  const actualizarUsuario = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_URL}/usuarios/${editForm.id}`, {
        nombre: editForm.nombre,
        cedula: editForm.cedula,
        email: editForm.email,
        password: editForm.password || undefined,
        rolId: editForm.rolId,
        activo: editForm.activo,
      });

      cerrarModalEditar();
      cargarUsuarios();

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
        text: error.response?.data?.message || "No se pudo actualizar el usuario",
      });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-green-600 mb-6">Gestión de Usuarios</h1>

      <div className="bg-white shadow-md rounded-xl p-6 mb-8 border border-green-200">
        <h2 className="text-xl font-semibold text-green-600 mb-4">Crear Usuario</h2>

        <form onSubmit={crearUsuario} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Nombre"
            className="border p-3 rounded-lg"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <input
            type="text"
            placeholder="Cédula"
            className="border p-3 rounded-lg"
            value={form.cedula}
            onChange={(e) => setForm({ ...form, cedula: e.target.value })}
          />
          <input
            type="email"
            placeholder="Email"
            className="border p-3 rounded-lg"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="border p-3 rounded-lg"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <select
            className="border p-3 rounded-lg"
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

          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg font-semibold"
          >
            {loading ? "Creando..." : "Crear Usuario"}
          </button>
        </form>
      </div>

      <div className="bg-white shadow-md rounded-xl p-6 border border-green-200">
        <h2 className="text-xl font-semibold text-green-600 mb-4">Lista de Usuarios</h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-green-500 text-white">
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Cédula</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Rol</th>
                <th className="p-3 text-left">Activo</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b hover:bg-green-100 transition-colors">
                  <td className="p-3">{u.nombre}</td>
                  <td className="p-3">{u.cedula}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.rol?.nombre || "Sin rol"}</td>
                  <td className="p-3">{u.activo ? "Sí" : "No"}</td>

                  <td className="p-3 text-center flex gap-2 justify-center">
                    <button
                      onClick={() => abrirModalEditar(u)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => eliminarUsuario(u.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {usuarios.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-gray-500">
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center">
          <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-green-600">Editar Usuario</h2>

            <form onSubmit={actualizarUsuario} className="grid grid-cols-1 gap-4">
              <input
                type="text"
                className="border p-3 rounded-lg"
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
              />
              <input
                type="text"
                className="border p-3 rounded-lg"
                value={editForm.cedula}
                onChange={(e) => setEditForm({ ...editForm, cedula: e.target.value })}
              />
              <input
                type="email"
                className="border p-3 rounded-lg"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              <input
                type="password"
                className="border p-3 rounded-lg"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />

              <select
                className="border p-3 rounded-lg"
                value={editForm.rolId}
                onChange={(e) => setEditForm({ ...editForm, rolId: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>

              <select
                className="border p-3 rounded-lg"
                value={editForm.activo}
                onChange={(e) =>
                  setEditForm({ ...editForm, activo: e.target.value === "true" })
                }
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={cerrarModalEditar}
                  className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
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
