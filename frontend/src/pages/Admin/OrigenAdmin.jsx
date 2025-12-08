import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function OrigenAdmin() {
  const [origenes, setOrigenes] = useState([]);
  const [form, setForm] = useState({ nombre: "", descripcion: "", activo: true });
  const [editId, setEditId] = useState(null);

  // 📌 Cargar todos los orígenes
  useEffect(() => {
    cargarOrigenes();
  }, []);

  const cargarOrigenes = async () => {
    try {
      const res = await axios.get(`${API_URL}/origen`);
      setOrigenes(res.data);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los orígenes", "error");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await axios.put(`${API_URL}/origen/${editId}`, form);
        Swal.fire("Éxito", "Origen actualizado", "success");
      } else {
        await axios.post(`${API_URL}/origen`, form);
        Swal.fire("Éxito", "Origen creado", "success");
      }
      setForm({ nombre: "", descripcion: "", activo: true });
      setEditId(null);
      cargarOrigenes();
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudo guardar el origen", "error");
    }
  };

  const handleEdit = (origen) => {
    setForm({ nombre: origen.nombre, descripcion: origen.descripcion, activo: origen.activo });
    setEditId(origen.id);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: "No podrás revertir esto",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`${API_URL}/origen/${id}`);
        Swal.fire("Eliminado", "Origen eliminado", "success");
        cargarOrigenes();
      } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudo eliminar", "error");
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Orígenes</h2>

      {/* Formulario Crear/Editar */}
      <div className="bg-white shadow-md rounded-md p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">{editId ? "Editar Origen" : "Nuevo Origen"}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium mb-1">Nombre</label>
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Descripción</label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              className="w-full border rounded-md p-2"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              name="activo"
              checked={form.activo}
              onChange={handleChange}
              className="mr-2"
            />
            <label>Activo</label>
          </div>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md"
          >
            {editId ? "Actualizar" : "Crear"}
          </button>
          {editId && (
            <button
              type="button"
              className="ml-2 bg-gray-400 hover:bg-gray-500 text-white py-2 px-4 rounded-md"
              onClick={() => {
                setForm({ nombre: "", descripcion: "", activo: true });
                setEditId(null);
              }}
            >
              Cancelar
            </button>
          )}
        </form>
      </div>

      {/* Tabla de Orígenes */}
      <div className="bg-white shadow-md rounded-md p-6">
        <h3 className="text-xl font-semibold mb-4">Lista de Orígenes</h3>
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">ID</th>
              <th className="border px-4 py-2">Nombre</th>
              <th className="border px-4 py-2">Descripción</th>
              <th className="border px-4 py-2">Activo</th>
              <th className="border px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {origenes.map(o => (
              <tr key={o.id} className="text-center">
                <td className="border px-4 py-2">{o.id}</td>
                <td className="border px-4 py-2">{o.nombre}</td>
                <td className="border px-4 py-2">{o.descripcion}</td>
                <td className="border px-4 py-2">{o.activo ? "Sí" : "No"}</td>
                <td className="border px-4 py-2 space-x-2">
                  <button
                    onClick={() => handleEdit(o)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(o.id)}
                    className="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {origenes.length === 0 && (
              <tr>
                <td colSpan="5" className="py-4">No hay orígenes registrados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
