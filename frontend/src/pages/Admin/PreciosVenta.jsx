import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { FaPlus, FaSave, FaTrash } from "react-icons/fa";
import { API_URL } from "../../../config";
import { socket } from "../../socket/socket";

const emptyRow = {
  modeloId: "",
  marca: "",
  nombre: "",
  pvpCredito: "",
  pvpContado: "",
  pvpTarjetaCredito: "",
};

const normalizePrice = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const formatPrice = (value) => {
  const text = normalizePrice(value);
  if (!text) return "-";
  if (/^[A-Za-z]/.test(text)) return text.toUpperCase();
  return text.startsWith("$") ? text : `$${text}`;
};

const parsePastedRows = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const columns = line.split(/\t|;/).map((column) => column.trim());
      return {
        marca: columns[0] || "",
        nombre: columns[1] || "",
        pvpCredito: columns[2] || "",
        pvpContado: columns[3] || "",
        pvpTarjetaCredito: columns[4] || "",
      };
    })
    .filter((row) => row.marca && row.nombre);

export default function PreciosVenta() {
  const [precios, setPrecios] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [form, setForm] = useState(emptyRow);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [pasteText, setPasteText] = useState("");

  const fetchPrecios = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/precios-venta`);
      setPrecios(data);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los precios de venta", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [preciosRes, modelosRes] = await Promise.all([
        axios.get(`${API_URL}/precios-venta`),
        axios.get(`${API_URL}/modelos/activos`),
      ]);
      setPrecios(preciosRes.data);
      setModelos(modelosRes.data);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los precios de venta", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const handleRealtimeUpdate = (rows) => {
      setPrecios(rows || []);
    };

    socket.on("preciosVenta:updated", handleRealtimeUpdate);

    return () => {
      socket.off("preciosVenta:updated", handleRealtimeUpdate);
    };
  }, []);

  const selectedModelo = useMemo(
    () => modelos.find((modelo) => String(modelo.id) === String(form.modeloId)),
    [form.modeloId, modelos],
  );

  const getModeloMarca = (modelo) =>
    modelo?.dispositivoMarca?.marca?.nombre || modelo?.marca?.nombre || "";

  const getPrecioMarca = (precio) => getModeloMarca(precio.modelo) || precio.marca || "";

  const getPrecioNombre = (precio) => precio.modelo?.nombre || precio.nombre || "";

  const getModeloLabel = (modelo) => {
    const marca = getModeloMarca(modelo);
    return [marca, modelo.nombre].filter(Boolean).join(" - ");
  };

  const filteredPrecios = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return precios;

    return precios.filter((precio) =>
      [getPrecioMarca(precio), getPrecioNombre(precio)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [filter, precios]);

  const resetForm = () => {
    setForm(emptyRow);
    setEditingId(null);
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (precio) => {
    setEditingId(precio.id);
    setForm({
      modeloId: precio.modeloId || precio.modelo?.id || "",
      marca: precio.marca || "",
      nombre: precio.nombre || "",
      pvpCredito: precio.pvpCredito || "",
      pvpContado: precio.pvpContado || "",
      pvpTarjetaCredito: precio.pvpTarjetaCredito || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.modeloId) {
      return Swal.fire("Atencion", "Seleccione un modelo", "warning");
    }

    const payload = {
      modeloId: form.modeloId,
      pvpCredito: normalizePrice(form.pvpCredito),
      pvpContado: normalizePrice(form.pvpContado),
      pvpTarjetaCredito: normalizePrice(form.pvpTarjetaCredito),
    };

    try {
      setSaving(true);

      if (editingId) {
        await axios.put(`${API_URL}/precios-venta/${editingId}`, payload);
      } else {
        await axios.post(`${API_URL}/precios-venta`, payload);
      }

      resetForm();
      await fetchPrecios();
      Swal.fire({
        icon: "success",
        title: "Guardado",
        timer: 1100,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar el precio",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpload = async () => {
    const rows = parsePastedRows(pasteText).map((row) => {
      const modelo = modelos.find((item) => {
        const marca = getModeloMarca(item).trim().toLowerCase();
        const nombre = item.nombre.trim().toLowerCase();

        return (
          marca === row.marca.trim().toLowerCase() &&
          nombre === row.nombre.trim().toLowerCase()
        );
      });

      return { ...row, modeloId: modelo?.id || "" };
    });

    const rowsConModelo = rows.filter((row) => row.modeloId);

    if (rowsConModelo.length === 0) {
      return Swal.fire(
        "Atencion",
        "No se encontro ningun modelo que coincida con las filas pegadas",
        "warning",
      );
    }

    try {
      setSaving(true);
      await axios.post(`${API_URL}/precios-venta/bulk`, { precios: rowsConModelo });
      setPasteText("");
      await fetchPrecios();
      Swal.fire({
        icon: "success",
        title: `${rowsConModelo.length} precios cargados`,
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron cargar los precios",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (precio) => {
    const result = await Swal.fire({
      title: "Eliminar precio",
      text: `${getPrecioMarca(precio)} ${getPrecioNombre(precio)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${API_URL}/precios-venta/${precio.id}`);
      await fetchPrecios();
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo eliminar el precio",
        "error",
      );
    }
  };

  if (loading) {
    return <div className="p-6">Cargando precios de venta...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Precio de Venta</h1>
          <p className="text-sm text-gray-600">
            Tabla de precios vigente. Los cambios se actualizan en tiempo real.
          </p>
        </div>

        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Buscar marca o nombre..."
          className="w-full rounded border px-3 py-2 md:max-w-sm"
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="mb-5 grid grid-cols-1 gap-3 rounded border bg-white p-4 shadow-sm md:grid-cols-6"
      >
        <label className="block md:col-span-3">
          <span className="mb-1 block text-sm font-medium text-gray-700">Modelo</span>
          <select
            value={form.modeloId}
            onChange={(event) => setField("modeloId", event.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          >
            <option value="">Seleccione un modelo</option>
            {modelos.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {getModeloLabel(modelo)}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded border bg-gray-50 px-3 py-2">
          <span className="block text-xs font-medium text-gray-500">Marca</span>
          <span className="font-semibold text-gray-900">
            {getModeloMarca(selectedModelo) || "-"}
          </span>
        </div>

        <div className="rounded border bg-gray-50 px-3 py-2 md:col-span-2">
          <span className="block text-xs font-medium text-gray-500">Nombre</span>
          <span className="font-semibold text-gray-900">
            {selectedModelo?.nombre || "-"}
          </span>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">PVP Credito</span>
          <input
            value={form.pvpCredito}
            onChange={(event) => setField("pvpCredito", event.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="$0.00"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">PVP Contado</span>
          <input
            value={form.pvpContado}
            onChange={(event) => setField("pvpContado", event.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="$0.00"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">PVP Tarj. Credito</span>
          <input
            value={form.pvpTarjetaCredito}
            onChange={(event) => setField("pvpTarjetaCredito", event.target.value)}
            className="w-full rounded border px-3 py-2"
            placeholder="$0.00"
          />
        </label>

        <div className="flex gap-2 md:col-span-6">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
          >
            {editingId ? <FaSave /> : <FaPlus />}
            {editingId ? "Actualizar" : "Agregar"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-100"
          >
            Limpiar
          </button>
        </div>
      </form>

      <div className="mb-5 rounded border bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Pegar filas desde Excel
        </label>
        <textarea
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          rows={4}
          className="w-full rounded border px-3 py-2 font-mono text-sm"
          placeholder={"HONOR\tMagic 8 LITE 5G 8GB 2562GB\t$450,00\t$435,00\t$435,00"}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-600">
            Columnas: Marca, Nombre, PVP Credito, PVP Contado, PVP Tarj. Credito.
          </span>
          <button
            type="button"
            onClick={handleBulkUpload}
            disabled={saving}
            className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-60"
          >
            Cargar pegado
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded border bg-white shadow-sm">
        <table className="w-full min-w-[840px] border-collapse text-sm">
          <thead className="bg-gray-900 text-white">
            <tr>
              <th className="border border-gray-300 p-2 text-left">Marca</th>
              <th className="border border-gray-300 p-2 text-left">Nombre</th>
              <th className="border border-gray-300 p-2 text-right">PVP Credito</th>
              <th className="border border-gray-300 p-2 text-right">PVP Contado</th>
              <th className="border border-gray-300 p-2 text-right">PVP Tarj. Credito</th>
              <th className="w-28 border border-gray-300 p-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPrecios.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No hay precios de venta para mostrar.
                </td>
              </tr>
            ) : (
              filteredPrecios.map((precio) => (
                <tr
                  key={precio.id}
                  className="cursor-pointer even:bg-gray-50 hover:bg-green-50"
                  onClick={() => handleEdit(precio)}
                >
                  <td className="border border-gray-300 p-2 font-semibold">
                    {getPrecioMarca(precio)}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {getPrecioNombre(precio)}
                  </td>
                  <td className="border border-gray-300 p-2 text-right font-bold">
                    {formatPrice(precio.pvpCredito)}
                  </td>
                  <td className="border border-gray-300 p-2 text-right">
                    {formatPrice(precio.pvpContado)}
                  </td>
                  <td className="border border-gray-300 p-2 text-right">
                    {formatPrice(precio.pvpTarjetaCredito)}
                  </td>
                  <td className="border border-gray-300 p-2 text-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(precio);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded border text-red-600 hover:bg-red-50"
                      title="Eliminar"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
