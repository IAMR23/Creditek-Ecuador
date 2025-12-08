import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";

export default function CostosHistoricosCRUD() {
  const [costos, setCostos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [formasPago, setFormasPago] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filtro, setFiltro] = useState(""); // ⬅️ NUEVO ESTADO PARA FILTRO

  const [form, setForm] = useState({
    modeloId: "",
    formaPagoId: "",
    precio: "",
    fechaCompra: "",
    proveedor: "",
    nota: ""
  });

  const [editId, setEditId] = useState(null);

  const fetchData = async () => {
    try {
      const [costosRes, modelosRes, formasRes] = await Promise.all([
        axios.get(`${API_URL}/costos`),
        axios.get(`${API_URL}/modelos`),
        axios.get(`${API_URL}/formaPago`)
      ]);

      setCostos(costosRes.data);
      setModelos(modelosRes.data);
      setFormasPago(formasRes.data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await axios.put(`${API_URL}/costos/${editId}`, form);
      } else {
        await axios.post(`${API_URL}/costos`, form);
      }

      setForm({
        modeloId: "",
        formaPagoId: "",
        precio: "",
        fechaCompra: "",
        proveedor: "",
        nota: ""
      });

      setEditId(null);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (costo) => {
    setForm({
      modeloId: costo.modeloId,
      formaPagoId: costo.formaPagoId,
      precio: costo.precio,
      fechaCompra: costo.fechaCompra.split("T")[0],
      proveedor: costo.proveedor || "",
      nota: costo.nota || ""
    });
    setEditId(costo.id);
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/costos/${id}`);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  // ⬅️ FILTRADO POR NOMBRE DEL MODELO
  const filteredCostos = costos.filter((c) =>
    c.modelo?.nombre?.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) return <div className="text-green-500 p-4">Cargando...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-green-600 mb-4">Costos Históricos CRUD</h1>

      {/* 🔍 INPUT DE FILTRO */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Filtrar por nombre del modelo..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border border-green-500 px-3 py-1 rounded w-64"
        />
      </div>

      <form onSubmit={handleSubmit} className="mb-6 bg-green-50 p-4 rounded shadow">
        <div className="grid grid-cols-2 gap-4">
          <select
            name="modeloId"
            value={form.modeloId}
            onChange={handleChange}
            className="border border-green-500 rounded px-2 py-1"
            required
          >
            <option value="">Seleccione Modelo</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>

          <select
            name="formaPagoId"
            value={form.formaPagoId}
            onChange={handleChange}
            className="border border-green-500 rounded px-2 py-1"
          >
            <option value="">Seleccione Forma de Pago</option>
            {formasPago.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>

          <input
            type="number"
            name="precio"
            placeholder="Precio"
            value={form.precio}
            onChange={handleChange}
            className="border border-green-500 rounded px-2 py-1"
            required
          />

          <input
            type="date"
            name="fechaCompra"
            placeholder="Fecha Compra"
            value={form.fechaCompra}
            onChange={handleChange}
            className="border border-green-500 rounded px-2 py-1"
            required
          />
        </div>

        <button
          type="submit"
          className="mt-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          {editId ? "Actualizar" : "Crear"}
        </button>
      </form>

      <table className="min-w-full border border-green-300">
        <thead className="bg-green-500 text-white">
          <tr>
            <th className="px-4 py-2">ID</th>
            <th className="px-4 py-2">Modelo</th>
            <th className="px-4 py-2">Forma de Pago</th>
            <th className="px-4 py-2">Precio</th>
            <th className="px-4 py-2">Fecha Compra</th>
            <th className="px-4 py-2">Acciones</th>
          </tr>
        </thead>

        {/* USAMOS LOS FILTRADOS */}
        <tbody>
          {filteredCostos.map((costo) => (
            <tr key={costo.id} className="border-b hover:bg-green-100">
              <td className="px-4 py-2">{costo.id}</td>
              <td className="px-4 py-2">{costo.modelo?.nombre || "-"}</td>
              <td className="px-4 py-2">{costo.formaPago?.nombre || "-"}</td>
              <td className="px-4 py-2">{costo.precio}</td>
              <td className="px-4 py-2">
                {new Date(costo.fechaCompra).toLocaleDateString()}
              </td>

              <td className="px-4 py-2 flex gap-2">
                <button
                  onClick={() => handleEdit(costo)}
                  className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                >
                  Editar
                </button>

                <button
                  onClick={() => handleDelete(costo.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
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
