import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import { FaPlus, FaCheck, FaClock, FaSpinner } from "react-icons/fa";
import { API_URL } from "../../../config";
import TaskList from "./TaskList";

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "media",
    repeat: "none",
    repeatInterval: 1,
    reminderTime: "" , 
  });

  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;

  // =========================
  // 📥 Obtener tareas
  // =========================
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/tasks/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data.data);
    } catch (error) {
      Swal.fire("Error", "No se pudieron cargar las tareas", "error");
    } finally {
      setLoading(false);
    } 
  };

  console.log(tasks)

  useEffect(() => {
    fetchTasks();
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
        createdBy: user?.id
      };

      await axios.post(`${API_URL}/tasks`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Swal.fire("OK", "Tarea creada", "success");

      setForm({
        title: "",
        description: "",
        assignedTo: "",
        priority: "media",
        repeat: "none",
        repeatInterval: 1,
        reminderTime: ""
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
      await axios.put(`${API_URL}/tasks/${id}/complete`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

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

  // =========================
  // 🧱 UI
  // =========================
  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      <h1 className="text-2xl font-bold mb-6">Gestión de Tareas</h1>

      {/* ========================= */}
      {/* ➕ FORMULARIO */}
      {/* ========================= */}
      <div className="bg-white p-4 rounded-2xl shadow mb-6">
        <h2 className="font-semibold mb-4">Nueva tarea</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <input
            type="text"
            placeholder="Título"
            className="border p-2 rounded"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <input
            type="number"
            placeholder="Asignado a (ID)"
            className="border p-2 rounded"
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
          />

          <textarea
            placeholder="Descripción"
            className="border p-2 rounded md:col-span-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <select
            className="border p-2 rounded"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>

          <select
            className="border p-2 rounded"
            value={form.repeat}
            onChange={(e) => setForm({ ...form, repeat: e.target.value })}
          >
            <option value="none">No repetir</option>
            <option value="daily">Diario</option>
          </select>

          {form.repeat === "daily" && (
            <>
              <input
                type="number"
                placeholder="Cada X días"
                className="border p-2 rounded"
                value={form.repeatInterval}
                onChange={(e) =>
                  setForm({ ...form, repeatInterval: e.target.value })
                }
              />

              <input
                type="time"
                className="border p-2 rounded"
                value={form.reminderTime}
                onChange={(e) =>
                  setForm({ ...form, reminderTime: e.target.value })
                }
              />
            </>
          )}
        </div>

        <button
          onClick={handleCreate}
          className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <FaPlus /> Crear tarea
        </button>
      </div>

      {/* ========================= */}
      {/* 📋 LISTADO */}
      {/* ========================= */}
      <div className="bg-white rounded-2xl shadow p-4">

        {loading ? (
          <p>Cargando...</p>
        ) : tasks.length === 0 ? (
          <p>No hay tareas</p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="border p-4 rounded-xl flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <h3 className="font-semibold">{task.title}</h3>
                  </div>

                  <p className="text-sm text-gray-500">
                    {task.description}
                  </p>

                  <div className="text-xs text-gray-400 mt-1">
                    Prioridad: {task.priority} | Repetición: {task.repeat}
                  </div>
                </div>

                {task.status !== "completada" && (
                  <button
                    onClick={() => completeTask(task.id)}
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                  >
                    Completar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskList />

    </div>
  );
};

export default TasksPage;