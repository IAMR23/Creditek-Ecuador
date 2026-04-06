import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import { FaCheck, FaCheckCircle } from "react-icons/fa";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [now, setNow] = useState(new Date());

  const token = localStorage.getItem("token");

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/tasks/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error) {
      console.error("Error al obtener tareas:", error);
    }
  };

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

  useEffect(() => {
    fetchTasks();
    const clock = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(clock);
  }, []);

  const getTaskStatus = (task) => {
    if (task.status === "completada") return "completada";
    if (!task.reminderTime) return "sin_hora";
    const [h, m] = task.reminderTime.split(":");
    const fechaTarea = new Date(now);
    fechaTarea.setHours(Number(h), Number(m), 0, 0);
    return now >= fechaTarea ? "vencida" : "pendiente";
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto ">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Centro de Notificaciones
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Supervisa recordatorios, estados y tareas pendientes en un solo
              lugar.
            </p>
          </div>
        </div>

        {/* Permisos */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Permisos de notificación
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Estado actual:{" "}
                <span className="font-semibold text-slate-700">
                  {"Notification" in window
                    ? Notification.permission
                    : "no soportado"}
                </span>
              </p>
            </div>

            {"Notification" in window &&
              Notification.permission !== "granted" && (
                <button
                  onClick={() => Notification.requestPermission()}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Solicitar permiso
                </button>
              )}
          </div>
        </div>

        {/* Empty state */}
        {tasks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm flex flex-col items-center gap-4  ">
            <h3 className="text-lg font-semibold text-slate-900">
              Sin tareas pendientes
            </h3>
            <FaCheckCircle className="text-emerald-500" size={50} />
            <p className="mt-2 text-sm text-slate-500">
              Cuando existan tareas con recordatorios aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="">
            {tasks.map((task) => {
              const status = getTaskStatus(task);

              const statusStyles = {
                vencida: "bg-red-50 text-red-600 border border-red-200",
                pendiente: "bg-amber-50 text-amber-600 border border-amber-200",
                proxima: "bg-blue-50 text-blue-600 border border-blue-200",
                completada:
                  "bg-emerald-50 text-emerald-600 border border-emerald-200",
              };

              return (
                <div
                  key={task.id}
                  className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex h-full flex-col justify-between gap-5">
                    <div>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold text-slate-900">
                            {task.title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {task.description || "Sin descripción"}
                          </p>
                        </div>

                        <div
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                            statusStyles[status] ||
                            "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {status.toUpperCase()}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Hora
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {task.reminderTime || "Sin hora"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Estado
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">
                            {status}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Creado por:
                          </p>
                          {task.creator && (
                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {task.creator.nombre}
                            </p>
                          )}
                        </div>
                      </div>

                      {status === "vencida" && (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                          ⚠️ Esta tarea está vencida y requiere atención.
                        </div>
                      )}
                    </div>

                    {task.status !== "completada" && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => completeTask(task.id)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                        >
                          <FaCheck />
                          Completar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
