import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import Swal from "sweetalert2";

export default function Agencias() {
  const [agencias, setAgencias] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    ciudad: "",
    activo: true,
  });

  // ======================
  // 📌 Cargar agencias
  // ======================
  useEffect(() => {
    fetchAgencias();
  }, []);

  const fetchAgencias = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  // ======================
  // 📌 Abrir modal (crear/editar)
  // ======================
  const abrirModal = (agencia = null) => {
    if (agencia) {
      setForm(agencia);
      setEditId(agencia.id);
    } else {
      setForm({
        nombre: "",
        direccion: "",
        telefono: "",
        ciudad: "",
        activo: true,
      });
      setEditId(null);
    }
    setShowModal(true);
  };

  const guardarAgencia = async (e) => {
    e.preventDefault();

    try {
      if (!editId) {
        await axios.post(`${API_URL}/agencias`, form);
        Swal.fire({
          icon: "success",
          title: "Agencia registrada",
          text: "La agencia se guardó correctamente.",
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        await axios.put(`${API_URL}/agencias/${editId}`, form);
        Swal.fire({
          icon: "success",
          title: "Agencia actualizada",
          text: "Los cambios se guardaron correctamente.",
          timer: 1500,
          showConfirmButton: false,
        });
      }

      setShowModal(false);
      fetchAgencias();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error al guardar",
        text: error?.response?.data?.message || "Ocurrió un error inesperado.",
      });
    }
  };

  const eliminarAgencia = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar agencia?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${API_URL}/agencias/${id}`);
      Swal.fire({
        icon: "success",
        title: "Eliminado",
        text: "La agencia fue eliminada correctamente.",
        timer: 1500,
        showConfirmButton: false,
      });

      fetchAgencias();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error al eliminar",
        text: error?.response?.data?.message || "Ocurrió un error inesperado.",
      });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Título */}
      <h1 className="text-3xl font-bold text-green-600">Gestión de Agencias</h1>

      {/* Botón crear */}
      <button
        onClick={() => abrirModal()}
        className="bg-green-600 text-white px-5 py-2 rounded-lg 
      hover:bg-green-700 shadow-md transition-all"
      >
        + Nueva Agencia
      </button>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white shadow-xl rounded-2xl border border-gray-100 animate-fadeIn">
        {loading ? (
          <p className="p-4 text-gray-500">Cargando agencias...</p>
        ) : agencias.length === 0 ? (
          <p className="p-4 text-gray-500">No hay agencias registradas</p>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Ciudad</th>
                <th className="p-3 text-left">Teléfono</th>
                <th className="p-3 text-left">Estado</th>
                <th className="p-3 text-left">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {agencias.map((a) => (
                <tr
                  key={a.id}
                  className="border-b hover:bg-emerald-50 transition"
                >
                  <td className="p-3 font-medium">{a.nombre}</td>
                  <td className="p-3">{a.ciudad}</td>
                  <td className="p-3">{a.telefono}</td>

                  <td className="p-3">
                    {a.activo ? (
                      <span
                        className="px-2 py-1 rounded bg-emerald-100 
                    text-emerald-700 font-semibold text-sm"
                      >
                        Activo
                      </span>
                    ) : (
                      <span
                        className="px-2 py-1 rounded bg-red-100 
                    text-red-600 font-semibold text-sm"
                      >
                        Inactivo
                      </span>
                    )}
                  </td>

                  <td className="p-3 flex gap-2">
                    <button
                      onClick={() => abrirModal(a)}
                      className="px-3 py-1 bg-green-500 text-white rounded-lg 
                    hover:bg-green-600 transition shadow-sm"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => eliminarAgencia(a.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded-lg 
                    hover:bg-red-600 transition shadow-sm"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 
      flex justify-center items-center backdrop-blur-sm z-50 animate-fadeIn"
        >
          <div className="bg-white w-96 p-6 rounded-2xl shadow-2xl animate-scaleIn">
            <h2 className="text-2xl font-bold mb-4 text-emerald-600">
              {editId ? "Editar Agencia" : "Crear Agencia"}
            </h2>

            <form onSubmit={guardarAgencia} className="space-y-4">
              <input
                type="text"
                placeholder="Nombre"
                className="w-full border p-2 rounded focus:ring-2 
              focus:ring-emerald-500 outline-none"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />

              <input
                type="text"
                placeholder="Dirección"
                className="w-full border p-2 rounded focus:ring-2 
              focus:ring-emerald-500 outline-none"
                value={form.direccion}
                onChange={(e) =>
                  setForm({ ...form, direccion: e.target.value })
                }
              />

              <input
                type="text"
                placeholder="Teléfono"
                className="w-full border p-2 rounded focus:ring-2 
              focus:ring-emerald-500 outline-none"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              />

              <input
                type="text"
                placeholder="Ciudad"
                className="w-full border p-2 rounded focus:ring-2 
              focus:ring-emerald-500 outline-none"
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              />

              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm({ ...form, activo: e.target.checked })
                  }
                  className="w-4 h-4 accent-green-600"
                />
                Activo
              </label>

              <button
                type="submit"
                className="w-full bg-green-600 text-white py-2 rounded-lg 
              hover:bg-green-700 transition font-semibold shadow-sm"
              >
                Guardar
              </button>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full bg-gray-300 py-2 rounded-lg hover:bg-gray-400 
              transition font-semibold"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Animaciones */}
      <style>{`
      .animate-fadeIn { animation: fadeIn .25s ease-in-out; }
      .animate-scaleIn { animation: scaleIn .25s ease-out; }

      @keyframes fadeIn {
        from { opacity: 0 }
        to { opacity: 1 }
      }

      @keyframes scaleIn {
        from { transform: scale(.8); opacity: 0 }
        to { transform: scale(1); opacity: 1 }
      }
    `}</style>
    </div>
  );
}
