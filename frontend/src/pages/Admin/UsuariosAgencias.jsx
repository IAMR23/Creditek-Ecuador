import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";

export default function UsuarioAgencia() {
  const [usuarios, setUsuarios] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [relaciones, setRelaciones] = useState([]);
  const [roles, setRoles] = useState([]);

  const [form, setForm] = useState({
    usuarioId: "",
    agenciaId: "",
    rolId: "",
    activo: true,
  });

  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  // ================================
  // 🔹 Cargar datos iniciales
  // ================================
  useEffect(() => {
    cargarUsuarios();
    cargarAgencias();
    cargarRelaciones();
    cargarRoles();
  }, []);

  const cargarUsuarios = async () => {
    const res = await axios.get(`${API_URL}/usuarios`);
    setUsuarios(res.data);
  };

  const cargarAgencias = async () => {
    const res = await axios.get(`${API_URL}/agencias`);
    setAgencias(res.data);
  };

  const cargarRelaciones = async () => {
    const res = await axios.get(`${API_URL}/usuario-agencia`);
    setRelaciones(res.data);
  };

  const cargarRoles = async () => {
    const res = await axios.get(`${API_URL}/rol`);
    setRoles(res.data);
  };

  // ================================
  // 🔹 Manejador de inputs
  // ================================
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // ================================
  // 🔹 Guardar relación
  // ================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.usuarioId || !form.agenciaId || !form.rolId) {
      setError("Debes seleccionar usuario, agencia y rol.");
      return;
    }

    try {
      if (editingId) {
        await axios.put(`${API_URL}/usuario-agencia/${editingId}`, form);
      } else {
        await axios.post(`${API_URL}/usuario-agencia`, form);
      }

      cargarRelaciones();

      // Reset
      setForm({
        usuarioId: "",
        agenciaId: "",
        rolId: "",
        activo: true,
      });
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.message || "Error al guardar relación");
    }
  };

  // ================================
  // 🔹 Editar relación
  // ================================
  const handleEdit = (rel) => {
    setEditingId(rel.id);
    setForm({
      usuarioId: rel.usuario?.id || "",
      agenciaId: rel.agencia?.id || "",
      rolId: rel.rol?.id || "",   // 👈 IMPORTANTE
      activo: rel.activo,
    });
  };

  // ================================
  // 🔹 Eliminar relación
  // ================================
  const handleDelete = async (id) => {
    await axios.delete(`${API_URL}/usuario-agencia/${id}`);
    cargarRelaciones();
  };

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-3xl font-bold text-gray-800">
        Asignar Usuarios a Agencias
      </h1>

      {/* FORMULARIO */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-lg rounded-xl p-6 grid grid-cols-2 gap-4 border border-gray-100"
      >
        {error && (
          <p className="text-red-600 col-span-2 font-semibold">{error}</p>
        )}

        {/* USUARIO */}
        <div className="col-span-1">
          <label className="text-sm font-semibold text-gray-700">Usuario</label>
          <select
            name="usuarioId"
            value={form.usuarioId}
            onChange={handleChange}
            className="border border-gray-300 p-2 rounded w-full mt-1 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Seleccionar usuario</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* AGENCIA */}
        <div className="col-span-1">
          <label className="text-sm font-semibold text-gray-700">Agencia</label>
          <select
            name="agenciaId"
            value={form.agenciaId}
            onChange={handleChange}
            className="border border-gray-300 p-2 rounded w-full mt-1 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Seleccionar agencia</option>
            {agencias.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} — {a.ciudad}
              </option>
            ))}
          </select>
        </div>

        {/* ROL (DESDE API) */}
        <div className="col-span-2">
          <label className="text-sm font-semibold text-gray-700">Rol</label>
          <select
            name="rolId"
            value={form.rolId}
            onChange={handleChange}
            className="border border-gray-300 p-2 rounded w-full mt-1 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Seleccionar rol</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* ACTIVO */}
        <div className="flex items-center gap-3 mt-6">
          <input
            type="checkbox"
            name="activo"
            checked={form.activo}
            onChange={handleChange}
            className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="font-medium">Activo</span>
        </div>

        <button className="bg-green-500 text-white py-2 rounded col-span-2 font-semibold hover:bg-green-600 transition">
          {editingId ? "Actualizar Relación" : "Crear Relación"}
        </button>
      </form>

      {/* TABLA */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
          <thead>
            <tr className="bg-green-500 text-white">
              <th className="p-3 text-left">Usuario</th>
              <th className="text-left">Agencia</th>
              <th className="text-left">Rol</th>
              <th className="text-left">Estado</th>
              <th className="text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {relaciones.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{r.usuario?.nombre}</td>
                <td>{r.agencia?.nombre}</td>

                {/* ROL desde API */}
                <td className="capitalize">{r.rol?.nombre}</td>

                <td>
                  <span
                    className={`px-2 py-1 rounded text-sm font-semibold ${
                      r.activo
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>

                <td className="flex gap-2 py-2">
                  <button
                    onClick={() => handleEdit(r)}
                    className="bg-yellow-400 px-3 py-1 rounded hover:bg-yellow-500 transition"
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => handleDelete(r.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
}
