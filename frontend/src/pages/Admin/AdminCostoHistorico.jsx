import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { FaPen, FaPlus, FaSave, FaTimes } from "react-icons/fa";
import { API_URL } from "../../../config";

const emptyForm = {
  modeloId: "",
  costo: "",
  fechaCompra: "",
  nota: "",
};

const currencyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return currencyFormatter.format(Number(value)).replace("US$", "").trim();
};

const buildCostMatrix = (costos, modelos) => {
  const fechas = [...new Set(costos.map((c) => c.fechaCompra))]
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b));

  const costosPorModelo = costos.reduce((acc, costo) => {
    const modeloId = costo.modeloId;
    if (!acc[modeloId]) acc[modeloId] = [];
    acc[modeloId].push(costo);
    return acc;
  }, {});

  Object.values(costosPorModelo).forEach((historial) => {
    historial.sort((a, b) => new Date(a.fechaCompra) - new Date(b.fechaCompra));
  });

  const modelosConCostos = modelos
    .filter((modelo) => costosPorModelo[modelo.id]?.length)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return {
    fechas,
    filas: modelosConCostos.map((modelo) => {
      const historial = costosPorModelo[modelo.id] || [];
      let costoVigente = null;
      let historialIndex = 0;

      const valores = fechas.reduce((acc, fecha) => {
        let registroExacto = null;

        while (
          historialIndex < historial.length &&
          historial[historialIndex].fechaCompra <= fecha
        ) {
          costoVigente = historial[historialIndex];
          if (historial[historialIndex].fechaCompra === fecha) {
            registroExacto = historial[historialIndex];
          }
          historialIndex += 1;
        }

        acc[fecha] = {
          costo: costoVigente?.costo ?? null,
          registro: registroExacto,
          heredado: Boolean(costoVigente) && !registroExacto,
        };
        return acc;
      }, {});

      return { modelo, valores };
    }),
  };
};

export default function CostosHistoricosCRUD() {
  const [costos, setCostos] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [costosRes, modelosRes] = await Promise.all([
        axios.get(`${API_URL}/costos`),
        axios.get(`${API_URL}/modelos/activos`),
      ]);
      setCostos(costosRes.data);
      setModelos(modelosRes.data);
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar los costos historicos",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredCostos = useMemo(() => {
    const filtroNormalizado = filtro.trim().toLowerCase();
    if (!filtroNormalizado) return costos;

    return costos.filter((c) =>
      c.modelo?.nombre?.toLowerCase().includes(filtroNormalizado),
    );
  }, [costos, filtro]);

  const matrizCostos = useMemo(
    () => buildCostMatrix(filteredCostos, modelos),
    [filteredCostos, modelos],
  );

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setEditId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (costo) => {
    setForm({
      modeloId: costo.modeloId || "",
      costo: costo.costo ?? "",
      fechaCompra: costo.fechaCompra?.split("T")[0] || "",
      nota: costo.nota || "",
    });
    setEditId(costo.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editId) {
        await axios.put(`${API_URL}/costos/${editId}`, form);
      } else {
        await axios.post(`${API_URL}/costos`, form);
      }

      setIsModalOpen(false);
      await fetchData();
      Swal.fire({
        icon: "success",
        title: "Guardado",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      const message = error.response?.data?.message || "Error al guardar";
      Swal.fire({ icon: "error", title: "Error", text: message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando costos historicos...</div>;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Costos Historicos</h1>
          <p className="text-sm text-gray-600">
            Historial de costos por modelo y fecha, ordenado desde el registro mas reciente.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          <FaPlus /> Nuevo
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Filtrar modelo..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full rounded border px-3 py-2 sm:max-w-sm"
        />
        <span className="text-sm text-gray-600">
          {matrizCostos.filas.length} modelo{matrizCostos.filas.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="sticky left-0 z-10 min-w-72 border border-gray-300 bg-gray-800 p-2 text-left">
                Modelo
              </th>
              {matrizCostos.fechas.map((fecha) => (
                <th key={fecha} className="min-w-32 border border-gray-300 p-2 text-right">
                  {fecha}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrizCostos.filas.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={matrizCostos.fechas.length + 1}>
                  No hay costos historicos para mostrar.
                </td>
              </tr>
            ) : (
              matrizCostos.filas.map(({ modelo, valores }) => (
                <tr key={modelo.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 border border-gray-300 bg-white p-2 font-medium text-gray-900">
                    {modelo.nombre}
                  </td>
                  {matrizCostos.fechas.map((fecha) => {
                    const celda = valores[fecha];
                    const contenido = formatCurrency(celda?.costo);

                    return (
                      <td
                        key={`${modelo.id}-${fecha}`}
                        className={`border border-gray-300 p-0 text-right ${
                          celda?.heredado ? "bg-gray-50 text-gray-700" : "bg-white text-gray-900"
                        }`}
                      >
                        {celda?.registro ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(celda.registro)}
                            className="flex w-full items-center justify-end gap-2 px-2 py-1 text-right font-semibold hover:bg-blue-50"
                            title="Editar costo de esta fecha"
                          >
                            <span>{contenido}</span>
                            <FaPen className="text-xs text-blue-600" />
                          </button>
                        ) : (
                          <span className="block px-2 py-1 font-semibold">{contenido}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editId ? "Editar" : "Nuevo"} Costo
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded border text-gray-600 hover:bg-gray-100"
                title="Cerrar"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Modelo</span>
                <select
                  name="modeloId"
                  value={form.modeloId}
                  onChange={handleChange}
                  className="w-full rounded border p-2"
                  required
                >
                  <option value="">Seleccione un modelo</option>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Costo</span>
                <input
                  type="number"
                  name="costo"
                  value={form.costo}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  className="w-full rounded border p-2"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Fecha</span>
                <input
                  type="date"
                  name="fechaCompra"
                  value={form.fechaCompra}
                  onChange={handleChange}
                  className="w-full rounded border p-2"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Nota</span>
                <textarea
                  name="nota"
                  value={form.nota}
                  onChange={handleChange}
                  placeholder="Observacion opcional"
                  className="min-h-24 w-full rounded border p-2"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <FaSave /> {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
