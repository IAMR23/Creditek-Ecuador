import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import Swal from "sweetalert2";
import { FaPen, FaPlus, FaSave } from "react-icons/fa";

export default function CostosHistoricosCRUD() {
  const [costos, setCostos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filtro, setFiltro] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    modeloId: "",
    costo: "",
    fechaCompra: "",
    proveedor: "",
    nota: "",
  });

  const [editId, setEditId] = useState(null);

  const fetchData = async () => {
    try {
      const [costosRes, modelosRes] = await Promise.all([
        axios.get(`${API_URL}/costos`),
        axios.get(`${API_URL}/modelos/activos`),
      ]);
      setCostos(costosRes.data);
      setModelos(modelosRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openCreateModal = () => {
    setForm({ modeloId: "", costo: "", fechaCompra: "", proveedor: "", nota: "" });
    setEditId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (costo) => {
    setForm({
      modeloId: costo.modeloId,
      costo: costo.costo,
      fechaCompra: costo.fechaCompra.split("T")[0],
      proveedor: costo.proveedor || "",
      nota: costo.nota || "",
    });
    setEditId(costo.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await axios.put(`${API_URL}/costos/${editId}`, form);
      } else {
        await axios.post(`${API_URL}/costos`, form);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      const message = error.response?.data?.message || "Error al guardar";
      Swal.fire({ icon: "error", title: "Error", text: message });
    }
  };

  const filteredCostos = costos.filter((c) =>
    c.modelo?.nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Costos Históricos</h1>
        <button
          onClick={openCreateModal}
          className="bg-green-500 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-600"
        >
          <FaPlus /> Nuevo
        </button>
      </div>

      <input
        type="text"
        placeholder="Filtrar modelo..."
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        className="border px-3 py-2 rounded mb-4 w-full max-w-sm"
      />

      <table className="w-full border">
        <thead className="bg-gray-800 text-white">
          <tr>
            <th className="p-2">Modelo</th>
            <th className="p-2">Costo</th>
            <th className="p-2">Fecha</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredCostos.map((c) => (
            <tr key={c.id} className="border-b hover:bg-gray-100">
              <td className="p-2">{c.modelo?.nombre}</td>
              <td className="p-2">{c.costo}</td>
              <td className="p-2">{new Date(c.fechaCompra).toLocaleDateString()}</td>
              <td className="p-2">
                <button
                  onClick={() => openEditModal(c)}
                  className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                >
                  <FaPen />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editId ? "Editar" : "Nuevo"} Costo
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <select
                name="modeloId"
                value={form.modeloId}
                onChange={handleChange}
                className="border w-full p-2 rounded"
                required
              >
                <option value="">Modelo</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>

              <input
                type="text"
                name="costo"
                value={form.costo}
                onChange={handleChange}
                placeholder="Costo"
                className="border w-full p-2 rounded"
                required
              />

              <input
                type="date"
                name="fechaCompra"
                value={form.fechaCompra}
                onChange={handleChange}
                className="border w-full p-2 rounded"
                required
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1 border rounded"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-500 text-white px-4 py-1 rounded"
                >
                  <FaSave size={18}/>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}