/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  CheckCircle2,
  FilterX,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Unlink2,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";

const emptyForm = { dispositivoId: "", marcaId: "" };
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

const ordenarPorNombre = (items) =>
  [...items].sort((a, b) =>
    String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"),
  );

export default function AdminDispositivoMarca() {
  const [relaciones, setRelaciones] = useState([]);
  const [dispositivos, setDispositivos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const cargarDatos = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const [relRes, dispRes, marcaRes] = await Promise.all([
        axios.get(`${API_URL}/dispositivoMarca`),
        axios.get(`${API_URL}/dispositivos`),
        axios.get(`${API_URL}/marcas`),
      ]);

      setRelaciones(Array.isArray(relRes.data) ? relRes.data : []);
      setDispositivos(Array.isArray(dispRes.data) ? dispRes.data : []);
      setMarcas(Array.isArray(marcaRes.data) ? marcaRes.data : []);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las relaciones", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const dispositivosOrdenados = useMemo(
    () => ordenarPorNombre(dispositivos),
    [dispositivos],
  );

  const marcasOrdenadas = useMemo(() => ordenarPorNombre(marcas), [marcas]);

  const dispositivosActivos = useMemo(
    () => dispositivosOrdenados.filter((item) => item.activo !== false),
    [dispositivosOrdenados],
  );

  const marcasActivas = useMemo(
    () => marcasOrdenadas.filter((item) => item.activo !== false),
    [marcasOrdenadas],
  );

  const relacionesFiltradas = useMemo(() => {
    const busqueda = normalizar(filters.busqueda);

    return [...relaciones]
      .filter((relacion) => {
        const coincideBusqueda =
          !busqueda ||
          normalizar(relacion.dispositivo?.nombre).includes(busqueda) ||
          normalizar(relacion.marca?.nombre).includes(busqueda) ||
          String(relacion.id).includes(busqueda);
        const coincideDispositivo =
          !filters.dispositivoId ||
          String(relacion.dispositivo?.id) === String(filters.dispositivoId);
        const coincideMarca =
          !filters.marcaId ||
          String(relacion.marca?.id) === String(filters.marcaId);
        const coincideEstado =
          filters.estado === "todos" ||
          (filters.estado === "activo" && relacion.activo) ||
          (filters.estado === "inactivo" && !relacion.activo);

        return (
          coincideBusqueda &&
          coincideDispositivo &&
          coincideMarca &&
          coincideEstado
        );
      })
      .sort((a, b) => {
        const dispositivo = String(a.dispositivo?.nombre || "").localeCompare(
          String(b.dispositivo?.nombre || ""),
          "es",
        );
        if (dispositivo !== 0) return dispositivo;
        return String(a.marca?.nombre || "").localeCompare(
          String(b.marca?.nombre || ""),
          "es",
        );
      });
  }, [filters, relaciones]);

  const estadisticas = useMemo(
    () => ({
      total: relaciones.length,
      activas: relaciones.filter((relacion) => relacion.activo).length,
      inactivas: relaciones.filter((relacion) => !relacion.activo).length,
      visibles: relacionesFiltradas.length,
    }),
    [relaciones, relacionesFiltradas.length],
  );

  const closeModal = () => {
    if (saving) return;
    setForm(emptyForm);
    setModalOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.dispositivoId || !form.marcaId) {
      return Swal.fire(
        "Datos incompletos",
        "Selecciona un dispositivo y una marca",
        "warning",
      );
    }

    try {
      setSaving(true);
      await axios.post(`${API_URL}/dispositivoMarca`, form);
      setModalOpen(false);
      setForm(emptyForm);
      await cargarDatos({ silent: true });
      Swal.fire({
        icon: "success",
        title: "Relación creada",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo crear la relación",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (relacion) => {
    if (relacion.activo) {
      const confirmacion = await Swal.fire({
        title: "¿Desactivar relación?",
        text: "También se desactivarán todos los modelos relacionados.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#b91c1c",
        cancelButtonColor: "#525252",
        confirmButtonText: "Sí, desactivar",
        cancelButtonText: "Cancelar",
      });

      if (!confirmacion.isConfirmed) return;
    }

    try {
      setUpdatingId(relacion.id);
      const { data } = await axios.put(
        `${API_URL}/dispositivoMarca/${relacion.id}`,
        { activo: !relacion.activo },
      );
      await cargarDatos({ silent: true });

      const mensaje = relacion.activo
        ? `${data.modelosDesactivados || 0} modelo(s) relacionado(s) desactivado(s).`
        : "La relación está activa nuevamente.";
      Swal.fire({
        icon: "success",
        title: relacion.activo ? "Relación desactivada" : "Relación activada",
        text: mensaje,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo actualizar la relación",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const eliminar = async (relacion) => {
    const confirmacion = await Swal.fire({
      title: "¿Eliminar relación?",
      text: `${relacion.dispositivo?.nombre || "Dispositivo"} · ${relacion.marca?.nombre || "Marca"}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#b91c1c",
      cancelButtonColor: "#525252",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setUpdatingId(relacion.id);
      await axios.delete(`${API_URL}/dispositivoMarca/${relacion.id}`);
      await cargarDatos({ silent: true });
      Swal.fire({
        icon: "success",
        title: "Relación eliminada",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo eliminar la relación",
        "error",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center bg-gray-50 p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
          <LoaderCircle className="animate-spin" size={20} />
          Cargando relaciones...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">
            Dispositivos y marcas
          </h1>
          <div className="mt-1 text-sm font-medium text-gray-500">
            {estadisticas.total} relaciones registradas
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cargarDatos()}
            className="inline-flex h-10 w-10 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
            title="Actualizar datos"
            aria-label="Actualizar datos"
          >
            <RefreshCw size={18} />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={18} />
            Nueva relación
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          icon={Link2}
          label="Total"
          value={estadisticas.total}
          tone="gray"
        />
        <Metric
          icon={CheckCircle2}
          label="Activas"
          value={estadisticas.activas}
          tone="green"
        />
        <Metric
          icon={Unlink2}
          label="Inactivas"
          value={estadisticas.inactivas}
          tone="amber"
        />
        <Metric
          icon={Search}
          label="Resultados"
          value={estadisticas.visibles}
          tone="blue"
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Relaciones del catálogo
              </h2>
              <span className="text-xs font-medium text-gray-500">
                {relacionesFiltradas.length} de {relaciones.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="inline-flex h-9 items-center gap-2 rounded border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              <FilterX size={16} />
              Limpiar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Buscar
              </span>
              <div className="flex h-10 items-center rounded border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <Search className="shrink-0 text-gray-400" size={17} />
                <input
                  value={filters.busqueda}
                  onChange={(event) =>
                    setFilters({ ...filters, busqueda: event.target.value })
                  }
                  className="min-w-0 flex-1 px-2 text-sm outline-none"
                  placeholder="ID, dispositivo o marca"
                />
              </div>
            </label>

            <FilterSelect
              label="Dispositivo"
              value={filters.dispositivoId}
              onChange={(value) =>
                setFilters({ ...filters, dispositivoId: value })
              }
              options={dispositivosOrdenados}
            />

            <FilterSelect
              label="Marca"
              value={filters.marcaId}
              onChange={(value) => setFilters({ ...filters, marcaId: value })}
              options={marcasOrdenadas}
            />

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Estado
              </span>
              <select
                value={filters.estado}
                onChange={(event) =>
                  setFilters({ ...filters, estado: event.target.value })
                }
                className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="todos">Todos</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </label>
          </div>
        </div>

        <div className="max-h-[calc(100vh-350px)] min-h-[360px] overflow-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[90px]" />
              <col className="w-[30%]" />
              <col className="w-[30%]" />
              <col className="w-[180px]" />
              <col className="w-[90px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-gray-100 text-left text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Dispositivo</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {relacionesFiltradas.map((relacion) => {
                const updating = updatingId === relacion.id;
                return (
                  <tr
                    key={relacion.id}
                    className="border-t border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-500">
                      #{relacion.id}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="truncate font-semibold text-gray-900"
                        title={relacion.dispositivo?.nombre || "Sin dispositivo"}
                      >
                        {relacion.dispositivo?.nombre || "Sin dispositivo"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="truncate font-medium text-gray-700"
                        title={relacion.marca?.nombre || "Sin marca"}
                      >
                        {relacion.marca?.nombre || "Sin marca"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusSwitch
                        activo={Boolean(relacion.activo)}
                        disabled={updating}
                        onClick={() => toggleActivo(relacion)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => eliminar(relacion)}
                          disabled={updating}
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Eliminar relación"
                          aria-label="Eliminar relación"
                        >
                          {updating ? (
                            <LoaderCircle className="animate-spin" size={17} />
                          ) : (
                            <Trash2 size={17} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {relacionesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center text-gray-500">
                      <Search size={24} />
                      <span className="mt-2 text-sm font-semibold">
                        No hay resultados
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <RelationModal
          form={form}
          setForm={setForm}
          dispositivos={dispositivosActivos}
          marcas={marcasActivas}
          saving={saving}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    green: "border-green-200 bg-green-50 text-green-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase opacity-70">
          {label}
        </span>
        <Icon size={17} className="opacity-60" />
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
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
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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

function StatusSwitch({ activo, disabled, onClick }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-[126px] items-center gap-2 rounded px-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
      title={activo ? "Desactivar relación" : "Activar relación"}
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          activo ? "bg-green-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            activo ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </span>
      {activo ? "Activo" : "Inactivo"}
    </button>
  );
}

function RelationModal({
  form,
  setForm,
  dispositivos,
  marcas,
  saving,
  onClose,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="relation-modal-title"
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2
            id="relation-modal-title"
            className="text-lg font-bold text-gray-900"
          >
            Nueva relación
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-9 w-9 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Dispositivo
            </span>
            <select
              autoFocus
              value={form.dispositivoId}
              onChange={(event) =>
                setForm({ ...form, dispositivoId: event.target.value })
              }
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Selecciona un dispositivo</option>
              {dispositivos.map((dispositivo) => (
                <option key={dispositivo.id} value={dispositivo.id}>
                  {dispositivo.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Marca
            </span>
            <select
              value={form.marcaId}
              onChange={(event) =>
                setForm({ ...form, marcaId: event.target.value })
              }
              className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Selecciona una marca</option>
              {marcas.map((marca) => (
                <option key={marca.id} value={marca.id}>
                  {marca.nombre}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Save size={17} />
              )}
              {saving ? "Guardando..." : "Crear relación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
