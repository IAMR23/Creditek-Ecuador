import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { FaPen, FaPlus, FaSave, FaSearch, FaTimes } from "react-icons/fa";
import { API_URL } from "../../../config";

const emptyForm = {
  nombre: "",
  identificadorUph: "",
  activo: true,
  dispositivoMarcaId: "",
};

const emptyFilters = {
  busqueda: "",
  dispositivoId: "",
  marcaId: "",
  estado: "todos",
};

const normalizar = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const uniqueById = (items) => {
  const map = new Map();
  items.forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  return [...map.values()];
};

const getDispositivoNombre = (modelo) =>
  modelo.dispositivoMarca?.dispositivo?.nombre || "-";

const getMarcaNombre = (modelo) => modelo.dispositivoMarca?.marca?.nombre || "-";

export default function ModelosAdmin() {
  const [modelos, setModelos] = useState([]);
  const [dispositivoMarcas, setDispositivoMarcas] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [modalOpen, setModalOpen] = useState(false);

  const dispositivos = useMemo(
    () => uniqueById(dispositivoMarcas.map((dm) => dm.dispositivo)),
    [dispositivoMarcas],
  );

  const marcas = useMemo(
    () => uniqueById(dispositivoMarcas.map((dm) => dm.marca)),
    [dispositivoMarcas],
  );

  const modelosFiltrados = useMemo(() => {
    const busqueda = normalizar(filters.busqueda);

    return modelos.filter((modelo) => {
      const dm = modelo.dispositivoMarca;
      const coincideBusqueda =
        !busqueda ||
        normalizar(modelo.nombre).includes(busqueda) ||
        normalizar(modelo.identificadorUph || modelo.descripcion).includes(busqueda) ||
        normalizar(getDispositivoNombre(modelo)).includes(busqueda) ||
        normalizar(getMarcaNombre(modelo)).includes(busqueda);

      const coincideDispositivo =
        !filters.dispositivoId ||
        String(dm?.dispositivo?.id) === String(filters.dispositivoId);

      const coincideMarca =
        !filters.marcaId || String(dm?.marca?.id) === String(filters.marcaId);

      const coincideEstado =
        filters.estado === "todos" ||
        (filters.estado === "activo" && modelo.activo) ||
        (filters.estado === "inactivo" && !modelo.activo);

      return (
        coincideBusqueda &&
        coincideDispositivo &&
        coincideMarca &&
        coincideEstado
      );
    });
  }, [filters, modelos]);

  const estadisticas = useMemo(
    () => ({
      total: modelos.length,
      activos: modelos.filter((m) => m.activo).length,
      inactivos: modelos.filter((m) => !m.activo).length,
      visibles: modelosFiltrados.length,
    }),
    [modelos, modelosFiltrados.length],
  );

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [mRes, dmRes] = await Promise.all([
        axios.get(`${API_URL}/modelos`),
        axios.get(`${API_URL}/dispositivoMarca`),
      ]);
      setModelos(Array.isArray(mRes.data) ? mRes.data : []);
      setDispositivoMarcas(Array.isArray(dmRes.data) ? dmRes.data : []);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los datos", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(false);
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nombre = form.nombre.trim();
    const dispositivoMarcaId = form.dispositivoMarcaId;

    if (!nombre || !dispositivoMarcaId) {
      return Swal.fire(
        "Atencion",
        "Nombre y Dispositivo-Marca son obligatorios",
        "warning",
      );
    }

    const payload = {
      nombre,
      identificadorUph: form.identificadorUph.trim() || null,
      activo: form.activo,
      dispositivoMarcaId,
    };

    try {
      setSaving(true);
      if (editingId) {
        await axios.put(`${API_URL}/modelos/${editingId}`, payload);
        Swal.fire("Exito", "Modelo actualizado", "success");
      } else {
        await axios.post(`${API_URL}/modelos`, payload);
        Swal.fire("Exito", "Modelo creado", "success");
      }
      reset();
      await fetchAll();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al guardar",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (modelo) => {
    setEditingId(modelo.id);
    setForm({
      nombre: modelo.nombre || "",
      identificadorUph: modelo.identificadorUph || modelo.descripcion || "",
      activo: Boolean(modelo.activo),
      dispositivoMarcaId:
        modelo.dispositivoMarcaId || modelo.dispositivoMarca?.id || "",
    });
    setModalOpen(true);
  };

  const clearFilters = () => setFilters(emptyFilters);

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Cargando modelos...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modelos</h1>
          <div className="mt-1 text-sm text-gray-600">
            Catalogo operativo por dispositivo, marca e identificador UPH.
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          <FaPlus />
          Nuevo modelo
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Total" value={estadisticas.total} />
        <Metric label="Activos" value={estadisticas.activos} tone="green" />
        <Metric label="Inactivos" value={estadisticas.inactivos} tone="slate" />
        <Metric label="Filtrados" value={estadisticas.visibles} tone="blue" />
      </div>

      <div className="mb-5">
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Listado de modelos
              </h2>
              <span className="text-xs text-gray-500">
                {modelosFiltrados.length} de {modelos.length}
              </span>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Limpiar filtros
            </button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block xl:col-span-1">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Buscar
              </span>
              <div className="flex items-center rounded border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <FaSearch className="text-gray-400" />
                <input
                  value={filters.busqueda}
                  onChange={(e) =>
                    setFilters({ ...filters, busqueda: e.target.value })
                  }
                  className="w-full px-2 py-2 text-sm outline-none"
                  placeholder="Modelo, UPH, marca..."
                />
              </div>
            </label>

            <FilterSelect
              label="Dispositivo"
              value={filters.dispositivoId}
              onChange={(value) =>
                setFilters({ ...filters, dispositivoId: value })
              }
              options={dispositivos}
            />

            <FilterSelect
              label="Marca"
              value={filters.marcaId}
              onChange={(value) => setFilters({ ...filters, marcaId: value })}
              options={marcas}
            />

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Estado
              </span>
              <select
                value={filters.estado}
                onChange={(e) =>
                  setFilters({ ...filters, estado: e.target.value })
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="todos">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </label>
          </div>

          <div className="max-h-[calc(100vh-320px)] min-h-[360px] overflow-auto rounded border border-gray-200">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[22%]" />
                <col className="w-[18%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">Modelo</th>
                  <th className="px-3 py-2">Identificador UPH</th>
                  <th className="px-3 py-2">Dispositivo</th>
                  <th className="px-3 py-2">Marca</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {modelosFiltrados.map((modelo) => (
                  <tr key={modelo.id} className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2 align-top">
                      <div className="truncate font-semibold text-gray-900" title={modelo.nombre}>
                        {modelo.nombre}
                      </div>
                      <div className="text-xs text-gray-500">ID #{modelo.id}</div>
                    </td>
                    <td
                      className="truncate px-3 py-2 align-top text-gray-700"
                      title={modelo.identificadorUph || modelo.descripcion || "-"}
                    >
                      {modelo.identificadorUph || modelo.descripcion || "-"}
                    </td>
                    <td
                      className="truncate px-3 py-2 align-top"
                      title={getDispositivoNombre(modelo)}
                    >
                      {getDispositivoNombre(modelo)}
                    </td>
                    <td
                      className="truncate px-3 py-2 align-top"
                      title={getMarcaNombre(modelo)}
                    >
                      {getMarcaNombre(modelo)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <StatusBadge activo={modelo.activo} />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleEdit(modelo)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                          title="Editar modelo"
                        >
                          <FaPen />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {modelosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                      No hay modelos para los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalOpen && (
        <ModeloFormModal
          dispositivoMarcas={dispositivoMarcas}
          editingId={editingId}
          form={form}
          onClose={reset}
          onSubmit={handleSubmit}
          saving={saving}
          setForm={setForm}
        />
      )}
    </div>
  );
}

function Metric({ label, value, tone = "gray" }) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    green: "border-green-200 bg-green-50 text-green-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase opacity-70">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function ModeloFormModal({
  dispositivoMarcas,
  editingId,
  form,
  onClose,
  onSubmit,
  saving,
  setForm,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {editingId ? "Editar modelo" : "Nuevo modelo"}
            </h2>
            {editingId && (
              <span className="text-xs font-medium text-blue-700">
                ID #{editingId}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-9 w-9 items-center justify-center rounded border text-gray-600 hover:bg-gray-100 disabled:opacity-60"
            title="Cerrar"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Nombre
            </span>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Ej. A15 128GB"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Identificador UPH
            </span>
            <input
              value={form.identificadorUph}
              onChange={(e) =>
                setForm({ ...form, identificadorUph: e.target.value })
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Codigo o referencia interna"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Dispositivo - Marca
            </span>
            <select
              value={form.dispositivoMarcaId}
              onChange={(e) =>
                setForm({ ...form, dispositivoMarcaId: e.target.value })
              }
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Seleccione dispositivo - marca</option>
              {dispositivoMarcas.map((dm) => (
                <option key={dm.id} value={dm.id}>
                  {dm.dispositivo?.nombre || "-"} - {dm.marca?.nombre || "-"}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Estado
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, activo: true })}
                className={`rounded border px-3 py-2 text-sm font-semibold ${
                  form.activo
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Activo
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, activo: false })}
                className={`rounded border px-3 py-2 text-sm font-semibold ${
                  !form.activo
                    ? "border-slate-700 bg-slate-100 text-slate-800"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Inactivo
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <FaSave />
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ activo }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        activo ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-700"
      }`}
    >
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}
