import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function AdminDispositivoMarca() {
  const [relaciones, setRelaciones] = useState([]);
  const [dispositivos, setDispositivos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [form, setForm] = useState({ dispositivoId: "", marcaId: "" });

  const cargarDatos = async () => {
    try {
      const [relRes, dispRes, marcaRes] = await Promise.all([
        axios.get(`${API_URL}/dispositivoMarca`),
        axios.get(`${API_URL}/dispositivos`),
        axios.get(`${API_URL}/marcas`),
      ]);

      setRelaciones(relRes.data);
      setDispositivos(dispRes.data);
      setMarcas(marcaRes.data);
    } catch (e) {
      Swal.fire("Error", "Error al cargar datos", "error");
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleSubmit = async () => {
    if (!form.dispositivoId || !form.marcaId) {
      return Swal.fire("Advertencia", "Completa todos los campos", "warning");
    }

    try {
      await axios.post(`${API_URL}/dispositivoMarca`, form);
      Swal.fire("Éxito", "Relación creada correctamente", "success");
      setForm({ dispositivoId: "", marcaId: "" });
      cargarDatos();
    } catch (e) {
      Swal.fire("Error", e.response?.data?.message || "Error al crear", "error");
    }
  };

  const toggleActivo = async (id, actual) => {
    try {
      await axios.put(`${API_URL}/dispositivoMarca/${id}`, { activo: !actual });
      Swal.fire("Actualizado", "Estado actualizado", "success");
      cargarDatos();
    } catch (e) {
      Swal.fire("Error", "No se pudo actualizar", "error");
    }
  };

  const eliminar = async (id) => {
    Swal.fire({
      title: "¿Eliminar?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#b91c1c",
      confirmButtonText: "Sí, eliminar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`${API_URL}/dispositivoMarca/${id}`);
          Swal.fire("Eliminado", "Relación eliminada", "success");
          cargarDatos();
        } catch (e) {
          Swal.fire("Error", "No se pudo eliminar", "error");
        }
      }
    });
  };

  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold text-green-600 mb-4">
        Administrar Dispositivo - Marca
      </h1>

      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-semibold">Dispositivo</label>
            <select
              className="border p-2 w-full rounded"
              value={form.dispositivoId}
              onChange={(e) => setForm({ ...form, dispositivoId: e.target.value })}
            >
              <option value="">Seleccione...</option>
              {dispositivos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold">Marca</label>
            <select
              className="border p-2 w-full rounded"
              value={form.marcaId}
              onChange={(e) => setForm({ ...form, marcaId: e.target.value })}
            >
              <option value="">Seleccione...</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="mt-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Crear Relación
        </button>
      </div>

      <table className="w-full border-collapse bg-white shadow rounded">
        <thead>
          <tr className="bg-green-600 text-white">
            <th className="p-2 border">ID</th>
            <th className="p-2 border">Dispositivo</th>
            <th className="p-2 border">Marca</th>
            <th className="p-2 border">Activo</th>
            <th className="p-2 border">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {relaciones.map((r) => (
            <tr key={r.id} className="text-center">
              <td className="border p-2">{r.id}</td>
              <td className="border p-2">{r.dispositivo?.nombre || "—"}</td>
              <td className="border p-2">{r.marca?.nombre || "—"}</td>
              <td className="border p-2">
                <button
                  onClick={() => toggleActivo(r.id, r.activo)}
                  className={`px-3 py-1 rounded text-white ${
                    r.activo ? "bg-green-500" : "bg-gray-400"
                  }`}
                >
                  {r.activo ? "Activo" : "Inactivo"}
                </button>
              </td>
              <td className="border p-2">
                <button
                  onClick={() => eliminar(r.id)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
