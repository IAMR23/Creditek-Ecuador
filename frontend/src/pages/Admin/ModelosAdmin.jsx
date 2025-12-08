import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function ModelosAdmin() {
  const [modelos, setModelos] = useState([]);
  const [dispositivoMarcas, setDispositivoMarcas] = useState([]);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    activo: true,
    dispositivoMarcaId: "",
  });
  const [editingId, setEditingId] = useState(null);
  const fetchAll = async () => {
    try {
      const [mRes, dmRes] = await Promise.all([
        axios.get(`${API_URL}/modelos`),
        axios.get(`${API_URL}/dispositivoMarca`),
      ]);
      setModelos(mRes.data);
      setDispositivoMarcas(dmRes.data);
    } catch (e) {
      Swal.fire("Error", "No se pudieron cargar los datos", "error");
    }
  };
  useEffect(() => {
    fetchAll();
  }, []);
  const reset = () => {
    setForm({ nombre: "", descripcion: "", activo: true, dispositivoMarcaId: "" });
    setEditingId(null);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre || !form.dispositivoMarcaId) return Swal.fire("Atención", "Nombre y Dispositivo-Marca son obligatorios", "warning");
    try {
      if (editingId) {
        await axios.put(`${API_URL}/modelos/${editingId}`, form);
        Swal.fire("Éxito", "Modelo actualizado", "success");
      } else {
        await axios.post(`${API_URL}/modelos`, form);
        Swal.fire("Éxito", "Modelo creado", "success");
      }
      reset();
      fetchAll();
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Error al guardar", "error");
    }
  };
  const handleEdit = (m) => {
    setEditingId(m.id);
    setForm({
      nombre: m.nombre || "",
      descripcion: m.descripcion || "",
      activo: !!m.activo,
      dispositivoMarcaId: m.dispositivoMarcaId || (m.dispositivoMarca?.id ?? ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleDelete = (id) => {
    Swal.fire({
      title: "¿Eliminar modelo?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#d33",
      confirmButtonText: "Eliminar",
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          await axios.delete(`${API_URL}/modelos/${id}`);
          Swal.fire("Eliminado", "Modelo eliminado", "success");
          fetchAll();
        } catch (e) {
          Swal.fire("Error", "No se pudo eliminar", "error");
        }
      }
    });
  };
  return (
    <div className="">
      <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
        <h2 className="text-2xl font-extrabold mb-2">Modelos</h2>
        <p className="text-sm text-gray-500 mb-4">Crea y administra modelos (selecciona primero Dispositivo-Marca).</p>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="Nombre del modelo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Activo</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, activo: true })}
                className={`px-3 py-2 rounded-md text-white ${form.activo ? "bg-green-600" : "bg-green-500/40"}`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, activo: false })}
                className={`px-3 py-2 rounded-md text-white ${!form.activo ? "bg-green-600" : "bg-green-500/40"}`}
              >
                No
              </button>
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Dispositivo - Marca</label>
            <select
              value={form.dispositivoMarcaId}
              onChange={(e) => setForm({ ...form, dispositivoMarcaId: e.target.value })}
              className="w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-green-500"
            >
              <option value="">Seleccione dispositivo - marca</option>
              {dispositivoMarcas.map((dm) => (
                <option key={dm.id} value={dm.id}>
                  {dm.dispositivo?.nombre || dm.dispositivo || "—"} — {dm.marca?.nombre || dm.marca || "—"}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder="Descripción (opcional)"
            />
          </div>

          <div className="md:col-span-3 flex gap-3">
            <button type="submit" className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow">
              {editingId ? "Actualizar Modelo" : "Crear Modelo"}
            </button>
            <button type="button" onClick={reset} className="px-4 py-2 rounded-lg border text-gray-700">
              Limpiar
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Listado de Modelos</h3>
          <div className="text-sm text-gray-500">{modelos.length} registros</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Nombre</th>
                <th className="px-4 py-2 text-left">Descripción</th>
                <th className="px-4 py-2 text-left">Dispositivo - Marca</th>
                <th className="px-4 py-2 text-left">Activo</th>
                <th className="px-4 py-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map((m, i) => (
                <tr key={m.id} className="even:bg-gray-50">
                  <td className="px-4 py-3">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{m.nombre}</td>
                  <td className="px-4 py-3">{m.descripcion}</td>
                  <td className="px-4 py-3">
                    {m.dispositivoMarca?.dispositivo?.nombre || m.dispositivoMarca?.dispositivo || "—"} — {m.dispositivoMarca?.marca?.nombre || m.dispositivoMarca?.marca || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-sm font-semibold ${m.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {m.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex gap-2">
                      <button onClick={() => handleEdit(m)} className="px-3 py-1 rounded-md border hover:shadow">Editar</button>
                      <button onClick={() => handleDelete(m.id)} className="px-3 py-1 rounded-md bg-gradient-to-r from-green-500 to-green-600 text-white">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {modelos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No hay modelos</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
