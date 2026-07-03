import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../api/client";

const STATUS_CONFIG = {
  vencida: {
    label: "Vencida",
    icon: AlertTriangle,
    badge: "border-red-200 bg-red-50 text-red-700",
    iconBox: "bg-red-50 text-red-600",
  },
  pendiente: {
    label: "Pendiente",
    icon: Clock3,
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    iconBox: "bg-amber-50 text-amber-600",
  },
  sin_hora: {
    label: "Sin hora",
    icon: Bell,
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    iconBox: "bg-slate-100 text-slate-600",
  },
  completada: {
    label: "Completada",
    icon: CheckCircle2,
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconBox: "bg-emerald-50 text-emerald-600",
  },
};

const PRIORITY_CONFIG = {
  alta: "border-red-200 bg-red-50 text-red-700",
  media: "border-blue-200 bg-blue-50 text-blue-700",
  baja: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const NOTIFICATION_LABELS = {
  granted: "Permitidas",
  denied: "Bloqueadas",
  default: "Pendientes",
  no_soportado: "No soportadas",
};

const STATUS_ORDER = {
  vencida: 0,
  pendiente: 1,
  sin_hora: 2,
  completada: 3,
};

const PRIORITY_ORDER = {
  alta: 0,
  media: 1,
  baja: 2,
};

const getNotificationPermission = () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "no_soportado";
  }

  return Notification.permission;
};

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const formatDateTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatTime = (value) => {
  if (!value) return "Sin hora";
  const [hours = "00", minutes = "00"] = String(value).split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
};

const getReminderDate = (task, now) => {
  if (task.reminderAt) {
    const reminderAt = new Date(task.reminderAt);
    if (!Number.isNaN(reminderAt.getTime())) return reminderAt;
  }

  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
    if (!Number.isNaN(dueDate.getTime())) return dueDate;
  }

  if (task.reminderTime) {
    const [hours, minutes] = String(task.reminderTime).split(":");
    const reminderTime = new Date(now);
    reminderTime.setHours(Number(hours), Number(minutes || 0), 0, 0);

    if (!Number.isNaN(reminderTime.getTime())) return reminderTime;
  }

  return null;
};

const getTaskStatus = (task, now) => {
  if (task.status === "completada") return "completada";

  const reminderDate = getReminderDate(task, now);
  if (!reminderDate) return "sin_hora";

  return now >= reminderDate ? "vencida" : "pendiente";
};

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [priorityFilter, setPriorityFilter] = useState("todas");
  const [completingId, setCompletingId] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    getNotificationPermission,
  );

  const fetchTasks = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const res = await api.get("/tasks/me");
      setTasks(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (fetchError) {
      console.error("Error al obtener tareas:", fetchError);
      setError("No se pudieron cargar las tareas.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const completeTask = async (id) => {
    try {
      setCompletingId(id);
      await api.put(`/tasks/${id}/complete`, {});
      setTasks((prev) => prev.filter((task) => task.id !== id));
      await fetchTasks({ silent: true });
    } catch (completeError) {
      console.error("Error al completar tarea:", completeError);
      Swal.fire("Error", "No se pudo completar", "error");
    } finally {
      setCompletingId(null);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  useEffect(() => {
    fetchTasks();
    const clock = setInterval(() => setNow(new Date()), 60000);

    return () => clearInterval(clock);
  }, [fetchTasks]);

  const enrichedTasks = useMemo(
    () =>
      tasks
        .map((task) => ({
          ...task,
          computedStatus: getTaskStatus(task, now),
        }))
        .sort((a, b) => {
          const statusDiff =
            STATUS_ORDER[a.computedStatus] - STATUS_ORDER[b.computedStatus];
          if (statusDiff !== 0) return statusDiff;

          const priorityDiff =
            (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
          if (priorityDiff !== 0) return priorityDiff;

          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }),
    [tasks, now],
  );

  const stats = useMemo(
    () =>
      enrichedTasks.reduce(
        (acc, task) => {
          acc.total += 1;
          acc[task.computedStatus] = (acc[task.computedStatus] || 0) + 1;
          return acc;
        },
        {
          total: 0,
          vencida: 0,
          pendiente: 0,
          sin_hora: 0,
        },
      ),
    [enrichedTasks],
  );

  const filteredTasks = useMemo(() => {
    const query = normalize(search);

    return enrichedTasks.filter((task) => {
      const matchesStatus =
        statusFilter === "todas" || task.computedStatus === statusFilter;
      const matchesPriority =
        priorityFilter === "todas" || task.priority === priorityFilter;
      const searchable = normalize(
        [
          task.title,
          task.description,
          task.creator?.nombre,
          task.assignee?.nombre,
          task.priority,
          task.status,
        ].join(" "),
      );

      return matchesStatus && matchesPriority && searchable.includes(query);
    });
  }, [enrichedTasks, priorityFilter, search, statusFilter]);

  return (
    <section className="w-full max-w-full bg-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Centro de notificaciones
            </p>
            <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">
              Tareas pendientes
            </h2>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              <ShieldCheck size={15} />
              {NOTIFICATION_LABELS[notificationPermission] || notificationPermission}
            </span>

            {notificationPermission === "default" && (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Bell size={15} />
                Permitir
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchTasks()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-700">Vencidas</p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              {stats.vencida}
            </p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-700">Pendientes</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">
              {stats.pendiente}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Sin hora</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {stats.sin_hora}
            </p>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_150px_150px]">
          <label className="relative block">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tarea, usuario o prioridad"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="todas">Todos</option>
            <option value="vencida">Vencidas</option>
            <option value="pendiente">Pendientes</option>
            <option value="sin_hora">Sin hora</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="todas">Prioridad</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-lg border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
            <CheckCircle2 className="text-emerald-500" size={42} />
            <h3 className="mt-3 text-base font-semibold text-slate-950">
              Sin tareas para mostrar
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Cambia los filtros o actualiza la lista.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredTasks.map((task) => {
              const status = STATUS_CONFIG[task.computedStatus] || STATUS_CONFIG.sin_hora;
              const StatusIcon = status.icon;
              const reminderLabel =
                formatDateTime(task.reminderAt || task.dueDate) ||
                formatTime(task.reminderTime);

              return (
                <article
                  key={task.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-4"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${status.iconBox}`}
                      >
                        <StatusIcon size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <h3 className="break-words text-base font-semibold leading-snug text-slate-950">
                            {task.title || "Tarea sin titulo"}
                          </h3>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${status.badge}`}
                            >
                              {status.label}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                PRIORITY_CONFIG[task.priority] ||
                                "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                            >
                              {task.priority || "sin prioridad"}
                            </span>
                          </div>
                        </div>

                        <p className="mt-2 max-h-28 overflow-auto whitespace-pre-line break-words pr-1 text-sm leading-relaxed text-slate-600">
                          {task.description || "Sin descripcion"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium text-slate-500">Hora</p>
                        <p className="mt-0.5 font-semibold text-slate-800">
                          {reminderLabel}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium text-slate-500">Creada por</p>
                        <p className="mt-0.5 truncate font-semibold text-slate-800">
                          {task.creator?.nombre || "Sistema"}
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-xs font-medium text-slate-500">Asignada a</p>
                        <p className="mt-0.5 truncate font-semibold text-slate-800">
                          {task.assignee?.nombre || "Usuario"}
                        </p>
                      </div>
                    </div>

                    {task.status !== "completada" && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => completeTask(task.id)}
                          disabled={completingId === task.id}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                        >
                          <Check size={16} />
                          {completingId === task.id ? "Completando" : "Completar"}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
