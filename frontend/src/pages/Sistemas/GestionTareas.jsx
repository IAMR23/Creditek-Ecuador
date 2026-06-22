import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  CheckCircle2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Save,
  Square,
  Trash,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";

const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "finalizado", label: "Finalizado" },
];

const estadoLabels = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Finalizado",
  finalizado: "Finalizado",
};

const estadoClases = {
  pendiente: "border-amber-200 bg-amber-50 text-amber-700",
  en_progreso: "border-blue-200 bg-blue-50 text-blue-700",
  completada: "border-green-200 bg-green-50 text-green-700",
  finalizado: "border-green-200 bg-green-50 text-green-700",
};

const formInicial = {
  titulo: "",
  descripcion: "",
  fechaInicio: new Date().toLocaleDateString("en-CA"),
};

const getToken = () => localStorage.getItem("token");

const getAuthHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

const formatFecha = (value) => {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatTiempo = (secondsValue) => {
  const total = Math.max(0, Number(secondsValue) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
};

const calcularTiempoVisible = (tarea, now) => {
  const acumulado = Number(tarea.tiempoAcumuladoSegundos) || 0;
  if (!tarea.cronometroActivo || !tarea.ultimoInicioCronometro) return acumulado;

  const inicio = new Date(tarea.ultimoInicioCronometro).getTime();
  const diff = Math.floor((now - inicio) / 1000);
  return acumulado + Math.max(0, diff);
};

const normalizarEstado = (estado) =>
  estado === "finalizado" ? "completada" : estado;

const isFinalizada = (tarea) =>
  ["completada", "finalizado"].includes(normalizarEstado(tarea.status));

const getEstadoLabel = (tarea) =>
  estadoLabels[normalizarEstado(tarea.status)] || tarea.estado || "-";

export default function GestionTareas() {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [accionId, setAccionId] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [tareaEditando, setTareaEditando] = useState(null);
  const [form, setForm] = useState(formInicial);
  const [now, setNow] = useState(Date.now());

  const resumen = useMemo(() => {
    const total = tareas.length;
    const pendientes = tareas.filter((tarea) => tarea.status === "pendiente").length;
    const enProgreso = tareas.filter((tarea) => tarea.status === "en_progreso").length;
    const finalizadas = tareas.filter((tarea) => isFinalizada(tarea)).length;

    return { total, pendientes, enProgreso, finalizadas };
  }, [tareas]);

  const cargarTareas = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/api/tareas`, {
        headers: getAuthHeaders(),
      });
      setTareas(data.tareas || []);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron cargar las tareas",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTareas();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const abrirNuevaTarea = () => {
    setTareaEditando(null);
    setForm(formInicial);
    setModalAbierto(true);
  };

  const abrirEditarTarea = (tarea) => {
    setTareaEditando(tarea);
    setForm({
      titulo: tarea.titulo || "",
      descripcion: tarea.descripcion || "",
      fechaInicio: tarea.fechaInicio || formInicial.fechaInicio,
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setTareaEditando(null);
    setForm(formInicial);
  };

  const guardarTarea = async (event) => {
    event.preventDefault();

    if (!form.titulo.trim()) {
      Swal.fire("Validacion", "El titulo es obligatorio", "warning");
      return;
    }

    if (!form.fechaInicio) {
      Swal.fire("Validacion", "La fecha de inicio es obligatoria", "warning");
      return;
    }

    try {
      setGuardando(true);
      const request = tareaEditando
        ? axios.put(`${API_URL}/api/tareas/${tareaEditando.id}`, form, {
            headers: getAuthHeaders(),
          })
        : axios.post(`${API_URL}/api/tareas`, form, {
            headers: getAuthHeaders(),
          });

      const { data } = await request;
      const tarea = data.tarea;

      setTareas((prev) =>
        tareaEditando
          ? prev.map((item) => (item.id === tarea.id ? tarea : item))
          : [tarea, ...prev],
      );
      cerrarModal();
      Swal.fire({
        icon: "success",
        title: tareaEditando ? "Tarea actualizada" : "Tarea creada",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la tarea",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const reemplazarTarea = (tarea) => {
    setTareas((prev) => prev.map((item) => (item.id === tarea.id ? tarea : item)));
  };

  const ejecutarAccion = async (tarea, accion) => {
    try {
      setAccionId(`${tarea.id}-${accion}`);
      const { data } = await axios.patch(
        `${API_URL}/api/tareas/${tarea.id}/${accion}`,
        {},
        { headers: getAuthHeaders() },
      );
      reemplazarTarea(data.tarea);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo ejecutar la accion",
        "error",
      );
    } finally {
      setAccionId("");
    }
  };

  const cambiarEstado = async (tarea, estado) => {
    try {
      setAccionId(`${tarea.id}-estado`);
      const { data } = await axios.patch(
        `${API_URL}/api/tareas/${tarea.id}/estado`,
        { estado },
        { headers: getAuthHeaders() },
      );
      reemplazarTarea(data.tarea);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cambiar el estado",
        "error",
      );
    } finally {
      setAccionId("");
    }
  };

  const eliminarTarea = async (tarea) => {
    const confirm = await Swal.fire({
      title: "Eliminar tarea?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      setAccionId(`${tarea.id}-eliminar`);
      await axios.delete(`${API_URL}/api/tareas/${tarea.id}`, {
        headers: getAuthHeaders(),
      });
      setTareas((prev) => prev.filter((item) => item.id !== tarea.id));
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo eliminar la tarea",
        "error",
      );
    } finally {
      setAccionId("");
    }
  };

  const renderAccionesCronometro = (tarea) => {
    const finalizada = isFinalizada(tarea);
    const activo = tarea.cronometroActivo;
    const disabled = Boolean(accionId) || finalizada;

    if (activo) {
      return (
        <button
          type="button"
          onClick={() => ejecutarAccion(tarea, "pausar")}
          disabled={Boolean(accionId)}
          className="inline-flex h-8 w-8 items-center justify-center rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          title="Pausar"
        >
          <Square size={15} />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() =>
          ejecutarAccion(
            tarea,
            Number(tarea.tiempoAcumuladoSegundos) > 0 ? "continuar" : "iniciar",
          )
        }
        disabled={disabled}
        className="inline-flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        title={Number(tarea.tiempoAcumuladoSegundos) > 0 ? "Continuar" : "Iniciar"}
      >
        {Number(tarea.tiempoAcumuladoSegundos) > 0 ? (
          <RotateCcw size={15} />
        ) : (
          <Play size={15} />
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion de Tareas</h1>
          <span className="text-sm font-semibold text-gray-500">Sistemas</span>
        </div>

        <button
          type="button"
          onClick={abrirNuevaTarea}
          className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Nueva tarea
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Tareas" value={resumen.total} />
        <Metric label="Pendientes" value={resumen.pendientes} tone="amber" />
        <Metric label="En progreso" value={resumen.enProgreso} tone="blue" />
        <Metric label="Finalizadas" value={resumen.finalizadas} tone="green" />
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">Listado de tareas</h2>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="border-b border-gray-200 px-3 py-2">Titulo</th>
                <th className="border-b border-gray-200 px-3 py-2">Descripcion</th>
                <th className="border-b border-gray-200 px-3 py-2">Fecha de inicio</th>
                <th className="border-b border-gray-200 px-3 py-2 text-right">
                  Tiempo acumulado
                </th>
                <th className="border-b border-gray-200 px-3 py-2">Estado</th>
                <th className="border-b border-gray-200 px-3 py-2 text-center">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                    Cargando tareas...
                  </td>
                </tr>
              ) : tareas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-gray-500">
                    No hay tareas registradas
                  </td>
                </tr>
              ) : (
                tareas.map((tarea) => {
                  const finalizada = isFinalizada(tarea);
                  const estadoNormalizado = normalizarEstado(tarea.status);

                  return (
                    <tr
                      key={tarea.id}
                      className={`border-b border-gray-100 hover:bg-blue-50/40 ${
                        finalizada ? "bg-gray-50 text-gray-500" : ""
                      }`}
                    >
                      <td className="px-3 py-3 align-top">
                        <div className="min-w-48 font-semibold text-gray-900">
                          {tarea.titulo}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="max-w-md whitespace-normal text-gray-700">
                          {tarea.descripcion || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-gray-700">
                        {formatFecha(tarea.fechaInicio)}
                      </td>
                      <td className="px-3 py-3 text-right align-top font-mono font-bold text-gray-900">
                        {formatTiempo(calcularTiempoVisible(tarea, now))}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex min-w-44 flex-col gap-2">
                          <span
                            className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-semibold ${
                              estadoClases[estadoNormalizado] || estadoClases.pendiente
                            }`}
                          >
                            {getEstadoLabel(tarea)}
                          </span>

                          <select
                            value={finalizada ? "finalizado" : tarea.status}
                            onChange={(event) => cambiarEstado(tarea, event.target.value)}
                            disabled={Boolean(accionId) || finalizada}
                            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                          >
                            {ESTADOS.map((estado) => (
                              <option key={estado.value} value={estado.value}>
                                {estado.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center justify-center gap-1">
                          {renderAccionesCronometro(tarea)}

                          <button
                            type="button"
                            onClick={() => ejecutarAccion(tarea, "finalizar")}
                            disabled={Boolean(accionId) || finalizada}
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Finalizar"
                          >
                            <CheckCircle2 size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => abrirEditarTarea(tarea)}
                            disabled={Boolean(accionId)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => eliminarTarea(tarea)}
                            disabled={Boolean(accionId)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            title="Eliminar"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={guardarTarea}
            className="w-full max-w-xl rounded-lg border border-gray-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-bold text-gray-900">
                {tareaEditando ? "Editar tarea" : "Nueva tarea"}
              </h2>
              <button
                type="button"
                onClick={cerrarModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700">Titulo *</span>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, titulo: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">
                  Fecha de inicio *
                </span>
                <input
                  type="date"
                  value={form.fechaInicio}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, fechaInicio: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-gray-700">
                  Descripcion
                </span>
                <textarea
                  value={form.descripcion}
                  rows={4}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, descripcion: event.target.value }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={cerrarModal}
                disabled={guardando}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <Save size={16} />
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "gray" }) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-green-200 bg-green-50 text-green-800",
  };

  return (
    <div className={`rounded border p-3 shadow-sm ${tones[tone] || tones.gray}`}>
      <div className="text-xs font-semibold uppercase opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
