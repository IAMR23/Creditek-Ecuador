import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import { FaPen } from "react-icons/fa";

export default function ModelosAdmin() {
  const [modelos, setModelos] = useState([]);
  const [dispositivoMarcas, setDispositivoMarcas] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    activo: true,
    dispositivoMarcaId: "",
    PVP1: "",
  });

  /* =====================
     Helpers
  ===================== */

  // Normaliza número: coma → punto, solo números y 2 decimales
  const normalizeNumber = (value) => {
    if (value === "") return "";

    let v = value.replace(",", ".");
    v = v.replace(/[^0-9.]/g, "");

    // Evitar más de un punto
    const parts = v.split(".");
    if (parts.length > 2) {
      v = parts[0] + "." + parts.slice(1).join("");
    }

    // Máx 2 decimales
    if (parts[1]?.length > 2) {
      v = parts[0] + "." + parts[1].slice(0, 2);
    }

    return v;
  };

  /* =====================
     Fetch
  ===================== */

  const fetchAll = async () => {
    try {
      const [mRes, dmRes] = await Promise.all([
        axios.get(`${API_URL}/modelos`),
        axios.get(`${API_URL}/dispositivoMarca`),
      ]);
      setModelos(mRes.data);
      setDispositivoMarcas(dmRes.data);
    } catch {
      Swal.fire("Error", "No se pudieron cargar los datos", "error");
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  /* =====================
     Form actions
  ===================== */

  const reset = () => {
    setForm({
      nombre: "",
      descripcion: "",
      activo: true,
      dispositivoMarcaId: "",
      PVP1: "",
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.nombre || !form.dispositivoMarcaId) {
      return Swal.fire(
        "Atención",
        "Nombre y Dispositivo-Marca son obligatorios",
        "warning"
      );
    }

    if (form.PVP1 === "" || Number(form.PVP1) < 0) {
      return Swal.fire(
        "Atención",
        "El PVP1 debe ser un número válido mayor o igual a 0",
        "warning"
      );
    }

    const payload = {
      ...form,
      PVP1: Number(form.PVP1), // 🔥 siempre se envía con punto
    };

    try {
      if (editingId) {
        await axios.put(`${API_URL}/modelos/${editingId}`, payload);
        Swal.fire("Éxito", "Modelo actualizado", "success");
      } else {
        await axios.post(`${API_URL}/modelos`, payload);
        Swal.fire("Éxito", "Modelo creado", "success");
      }
      reset();
      fetchAll();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al guardar",
        "error"
      );
    }
  };

  const handleEdit = (m) => {
    setEditingId(m.id);
    setForm({
      nombre: m.nombre || "",
      descripcion: m.descripcion || "",
      activo: !!m.activo,
      dispositivoMarcaId:
        m.dispositivoMarcaId || m.dispositivoMarca?.id || "",
      PVP1: m.PVP1 != null ? m.PVP1.toFixed(2) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  return (
    <div>
      <div className="bg-white rounded-2xl shadow-2xl p-6 mb-6">
        <h2 className="text-2xl font-extrabold mb-2">Modelos</h2>
        <p className="text-sm text-gray-500 mb-4">
          Crea y administra modelos (selecciona primero Dispositivo-Marca).
        </p>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
        >
          {/* Nombre */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Nombre
            </label>
            <input
              value={form.nombre}
              onChange={(e) =>
                setForm({ ...form, nombre: e.target.value })
              }
              className="w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Activo */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Activo
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, activo: true })}
                className={`px-3 py-2 rounded-md text-white ${
                  form.activo ? "bg-green-600" : "bg-green-500/40"
                }`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, activo: false })}
                className={`px-3 py-2 rounded-md text-white ${
                  !form.activo ? "bg-green-600" : "bg-green-500/40"
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Dispositivo-Marca */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">
              Dispositivo - Marca
            </label>
            <select
              value={form.dispositivoMarcaId}
              onChange={(e) =>
                setForm({ ...form, dispositivoMarcaId: e.target.value })
              }
              className="w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-green-500"
            >
              <option value="">Seleccione dispositivo - marca</option>
              {dispositivoMarcas.map((dm) => (
                <option key={dm.id} value={dm.id}>
                  {dm.dispositivo?.nombre} — {dm.marca?.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* PVP1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              PVP Base (PVP1)
            </label>
            <input
              inputMode="decimal"
              value={form.PVP1}
              onChange={(e) =>
                setForm({
                  ...form,
                  PVP1: normalizeNumber(e.target.value),
                })
              }
              className="w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="0.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              Solo números, se guarda con punto (.)
            </p>
          </div>

          {/* Descripción */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <textarea
              rows={3}
              value={form.descripcion}
              onChange={(e) =>
                setForm({ ...form, descripcion: e.target.value })
              }
              className="w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Botones */}
          <div className="md:col-span-3 flex gap-3">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow"
            >
              {editingId ? "Actualizar Modelo" : "Crear Modelo"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-lg border"
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-bold mb-4">
          Listado de Modelos ({modelos.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-green-600 text-white">
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>PVP1</th>
                <th>Dispositivo - Marca</th>
                <th>Activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map((m, i) => (
                <tr key={m.id} className="even:bg-gray-50">
                  <td>{i + 1}</td>
                  <td>{m.nombre}</td>
                  <td className="font-mono">
                    ${Number(m.PVP1).toFixed(2)}
                  </td>
                  <td>
                    {m.dispositivoMarca?.dispositivo?.nombre} —{" "}
                    {m.dispositivoMarca?.marca?.nombre}
                  </td>
                  <td>{m.activo ? "Activo" : "Inactivo"}</td>
                  <td>
                    <button
                      onClick={() => handleEdit(m)}
                      className="m-2 bg-green-400 hover:bg-green-500 text-white px-3 py-1 rounded flex items-center gap-2"
                    >
                      <FaPen size={18} />
                    </button>
                
                  </td>
                </tr>
              ))}
              {modelos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500">
                    No hay modelos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
