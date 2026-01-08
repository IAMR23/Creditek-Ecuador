import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function AdminUsuariosRoles() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [formUsuario, setFormUsuario] = useState({
    nombre: "",
    cedula: "",
    email: "",
    password: "",
    rolId: "",
  });

  const [editUsuarioModal, setEditUsuarioModal] = useState(false);
  const [editUsuario, setEditUsuario] = useState({
    id: null,
    nombre: "",
    cedula: "",
    email: "",
    password: "",
    rolId: "",
    activo: true,
  });

  const [formRol, setFormRol] = useState({
    nombre: "",
    descripcion: "",
    activo: true,
  });

  const [editRolModal, setEditRolModal] = useState(false);
  const [editRol, setEditRol] = useState({
    id: null,
    nombre: "",
    descripcion: "",
    activo: true,
  });

  const cargarUsuarios = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      setUsuarios(res.data);
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar usuarios" });
    } finally {
      setLoadingUsers(false);
    }
  };

  const cargarRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await axios.get(`${API_URL}/rol`);
      setRoles(res.data);
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar roles" });
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
    cargarRoles();
  }, []);

  const crearUsuario = async (e) => {
    e.preventDefault();
    try {
      setLoadingUsers(true);
      await axios.post(`${API_URL}/usuarios`, {
        nombre: formUsuario.nombre,
        cedula: formUsuario.cedula,
        email: formUsuario.email,
        password: formUsuario.password,
        rolId: Number(formUsuario.rolId),
      });
      setFormUsuario({ nombre: "", cedula: "", email: "", password: "", rolId: "" });
      cargarUsuarios();
      Swal.fire({ icon: "success", title: "Usuario creado", timer: 1400, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.response?.data?.message || "No se pudo crear usuario" });
    } finally {
      setLoadingUsers(false);
    }
  };

  const abrirEditarUsuario = (u) => {
    setEditUsuario({
      id: u.id,
      nombre: u.nombre || "",
      cedula: u.cedula || "",
      email: u.email || "",
      password: "",
      rolId: u.rol?.id || "",
      activo: u.activo ?? true,
    });
    setEditUsuarioModal(true);
  };

  const actualizarUsuario = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_URL}/usuarios/${editUsuario.id}`, {
        nombre: editUsuario.nombre,
        cedula: editUsuario.cedula,
        email: editUsuario.email,
        password: editUsuario.password || undefined,
        rolId: Number(editUsuario.rolId),
        activo: editUsuario.activo,
      });
      setEditUsuarioModal(false);
      cargarUsuarios();
      Swal.fire({ icon: "success", title: "Usuario actualizado", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.response?.data?.message || "No se pudo actualizar usuario" });
    }
  };

  const eliminarUsuario = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar usuario?",
      text: "Esta acción no se puede deshacer.",
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
      Swal.fire({ icon: "success", title: "Eliminado", timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar el usuario" });
    }
  };

  const crearRol = async (e) => {
    e.preventDefault();
    try {
      setLoadingRoles(true);
      await axios.post(`${API_URL}/rol`, {
        nombre: formRol.nombre,
        descripcion: formRol.descripcion,
        activo: formRol.activo,
      });
      setFormRol({ nombre: "", descripcion: "", activo: true });
      cargarRoles();
      Swal.fire({ icon: "success", title: "Rol creado", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.response?.data?.msg || "No se pudo crear rol" });
    } finally {
      setLoadingRoles(false);
    }
  };

  const abrirEditarRol = (r) => {
    setEditRol({ id: r.id, nombre: r.nombre || "", descripcion: r.descripcion || "", activo: r.activo ?? true });
    setEditRolModal(true);
  };

  const actualizarRol = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/rol/${editRol.id}`, {
        nombre: editRol.nombre,
        descripcion: editRol.descripcion,
        activo: editRol.activo,
      });
      setEditRolModal(false);
      cargarRoles();
      Swal.fire({ icon: "success", title: "Rol actualizado", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: "error", title: "Error", text: error.response?.data?.msg || "No se pudo actualizar rol" });
    }
  };

  const eliminarRol = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Desactivar rol?",
      text: "El rol quedará inactivo (soft delete).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, desactivar",
      cancelButtonText: "Cancelar",
    });
    if (!confirm.isConfirmed) return;
    try {
      await axios.delete(`${API_URL}/rol/${id}`);
      cargarRoles();
      Swal.fire({ icon: "success", title: "Rol desactivado", timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo eliminar el rol" });
    }
  };

  return (
<div className=" w-full p-6 min-h-screen ">
  <div className="bg-white rounded-2xl shadow-2xl border border-green-200 overflow-hidden h-full w-full">
    <div className="p-6 bg-gradient-to-r from-green-600 to-green-500 text-white">
      <h2 className="text-2xl font-extrabold">Gestión de Roles</h2>
      <p className="mt-1 opacity-90">Crear, editar y desactivar roles.</p>
    </div>

    <div className="p-6">
      <form onSubmit={crearRol} className="grid grid-cols-1 gap-4 mb-4">
        <input required type="text" placeholder="Nombre del rol" className="border p-3 rounded-lg" value={formRol.nombre} onChange={(e) => setFormRol({ ...formRol, nombre: e.target.value })} />
        <input type="text" placeholder="Descripción" className="border p-3 rounded-lg" value={formRol.descripcion} onChange={(e) => setFormRol({ ...formRol, descripcion: e.target.value })} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formRol.activo} onChange={(e) => setFormRol({ ...formRol, activo: e.target.checked })} />
            <span>Activo</span>
          </label>
          <button type="submit" disabled={loadingRoles} className="ml-auto bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold">{loadingRoles ? "Guardando..." : "Crear Rol"}</button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-green-500 text-white">
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Descripción</th>
              <th className="p-3 text-left">Activo</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-b hover:bg-green-50 transition-colors">
                <td className="p-3">{r.nombre}</td>
                <td className="p-3">{r.descripcion || "-"}</td>
                <td className="p-3">{r.activo ? "Sí" : "No"}</td>
                <td className="p-3 flex gap-2 justify-center">
                  <button onClick={() => abrirEditarRol(r)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg">Editar</button>
                  <button onClick={() => eliminarRol(r.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg">Desactivar</button>
                </td>
              </tr>
            ))}
            {roles.length === 0 && (
              <tr>
                <td colSpan="4" className="p-4 text-center text-gray-500">No hay roles registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  {editUsuarioModal && (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-green-600 mb-4">Editar Usuario</h3>
        <form onSubmit={actualizarUsuario} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" className="border p-3 rounded-lg" value={editUsuario.nombre} onChange={(e) => setEditUsuario({ ...editUsuario, nombre: e.target.value })} />
          <input type="text" className="border p-3 rounded-lg" value={editUsuario.cedula} onChange={(e) => setEditUsuario({ ...editUsuario, cedula: e.target.value })} />
          <input type="email" className="border p-3 rounded-lg" value={editUsuario.email} onChange={(e) => setEditUsuario({ ...editUsuario, email: e.target.value })} />
          <input type="password" className="border p-3 rounded-lg" placeholder="Nueva contraseña (opcional)" value={editUsuario.password} onChange={(e) => setEditUsuario({ ...editUsuario, password: e.target.value })} />
          <select className="border p-3 rounded-lg" value={editUsuario.rolId} onChange={(e) => setEditUsuario({ ...editUsuario, rolId: e.target.value })}>
            <option value="">Seleccionar rol</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
          <select className="border p-3 rounded-lg" value={String(editUsuario.activo)} onChange={(e) => setEditUsuario({ ...editUsuario, activo: e.target.value === "true" })}>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
          <div className="md:col-span-2 flex justify-end gap-3 mt-3">
            <button type="button" onClick={() => setEditUsuarioModal(false)} className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  )}

  {editRolModal && (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-xl p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-green-600 mb-4">Editar Rol</h3>
        <form onSubmit={actualizarRol} className="grid grid-cols-1 gap-4">
          <input type="text" className="border p-3 rounded-lg" value={editRol.nombre} onChange={(e) => setEditRol({ ...editRol, nombre: e.target.value })} />
          <input type="text" className="border p-3 rounded-lg" value={editRol.descripcion} onChange={(e) => setEditRol({ ...editRol, descripcion: e.target.value })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={editRol.activo} onChange={(e) => setEditRol({ ...editRol, activo: e.target.checked })} />
            <span>Activo</span>
          </label>
          <div className="flex justify-end gap-3 mt-3">
            <button type="button" onClick={() => setEditRolModal(false)} className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>

  );
}
