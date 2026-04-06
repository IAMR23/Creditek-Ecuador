import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import { FaPlus, FaCheck, FaClock, FaSpinner } from "react-icons/fa";
import { API_URL } from "../../../config";
import TaskList from "./TaskList";
import SelectUsuarios from "../../components/common/SelectUsuarios";

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "media",
    repeat: "none",
    repeatInterval: 1,
    reminderTime: "",
  });

  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;
  const userId = user.usuario.id;


  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(res.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar las tareas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    cargarUsuarios();
  }, []);

  // =========================
  // ➕ Crear tarea
  // =========================
  const handleCreate = async () => {
    try {
      if (!form.title) {
        return Swal.fire("Validación", "El título es obligatorio", "warning");
      }

      const payload = {
        ...form,
        createdBy: userId,
      };

      await axios.post(`${API_URL}/tasks`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      Swal.fire("OK", "Tarea creada", "success");

      setForm({
        title: "",
        description: "",
        assignedTo: "",
        priority: "media",
        repeat: "none",
        repeatInterval: 1,
        reminderTime: "",
      });

      fetchTasks();
    } catch (error) {
      Swal.fire("Error", "No se pudo crear", "error");
    }
  };

  // =========================
  // ✅ Completar tarea
  // =========================
  const completeTask = async (id) => {
    try {
      await axios.put(
        `${API_URL}/tasks/${id}/complete`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      fetchTasks();
    } catch (error) {
      Swal.fire("Error", "No se pudo completar", "error");
    }
  };

  // =========================
  // 🎨 UI helpers
  // =========================
  const getStatusIcon = (status) => {
    switch (status) {
      case "pendiente":
        return <FaClock className="text-yellow-500" />;
      case "en_progreso":
        return <FaSpinner className="text-blue-500 animate-spin" />;
      case "completada":
        return <FaCheck className="text-green-500" />;
      default:
        return null;
    }
  };

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    }
  };

  // =========================
  // 🧱 UI
  // =========================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Gestión de Tareas
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Administra, asigna y da seguimiento a las tareas del equipo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Formulario */}
          <div className="xl:col-span-1">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Nueva tarea
                </div>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">
                  Crear tarea
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Completa la información y asígnala al usuario correspondiente.
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Título
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Llamar a cliente potencial"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Usuario asignado
                  </label>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.assignedTo}
                    onChange={(e) =>
                      setForm({ ...form, assignedTo: e.target.value })
                    }
                  >
                    <option value="">Seleccionar usuario</option>
                    {usuarios.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Descripción
                  </label>
                  <textarea
                    placeholder="Describe brevemente la tarea..."
                    rows={4}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Prioridad
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={form.priority}
                      onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                      }
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Repetición
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      value={form.repeat}
                      onChange={(e) =>
                        setForm({ ...form, repeat: e.target.value })
                      }
                    >
                      <option value="none">No repetir</option>
                      <option value="daily">Diario</option>
                    </select>
                  </div>
                </div>

                {form.repeat === "daily" && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Intervalo
                      </label>
                      <input
                        type="number"
                        placeholder="Cada X días"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        value={form.repeatInterval}
                        onChange={(e) =>
                          setForm({ ...form, repeatInterval: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Recordatorio
                      </label>
                      <input
                        type="time"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        value={form.reminderTime}
                        onChange={(e) =>
                          setForm({ ...form, reminderTime: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleCreate}
                  className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:bg-blue-600"
                >
                  <FaPlus className="transition group-hover:rotate-90" />
                  Crear tarea
                </button>
              </div>
            </div>
          </div>

          {/* Listado */}
          <div className="xl:col-span-2">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Tareas activas
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Visualiza el estado y progreso de las tareas registradas.
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                  Total: {tasks.length}
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                  <p className="text-sm text-slate-500">Cargando tareas...</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
                  <div className="mb-3 rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                    Sin registros
                  </div>
                  <p className="text-sm text-slate-500">
                    Aún no hay tareas creadas.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                              {getStatusIcon(task.status)}
                            </div>

                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-slate-900">
                                {task.title}
                              </h3>
                              <p className="text-xs text-slate-500">
                                Estado: {task.status}
                              </p>
                            </div>
                          </div>

                          <p className="mb-3 text-sm leading-relaxed text-slate-600">
                            {task.description || "Sin descripción"}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              Prioridad: {task.priority}
                            </span>
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                              Repetición: {task.repeat}
                            </span>
                          </div>
                        </div>
                        {task.status !== "completada" &&
                          Number(task.assignedTo) === Number(userId) && (
                            <div className="flex shrink-0 items-center">
                              <button
                                onClick={() => completeTask(task.id)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600"
                              >
                                <FaCheck />
                                Completar
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TasksPage;
