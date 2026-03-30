import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";
import { FaPlus, FaCheck, FaClock, FaSpinner } from "react-icons/fa";
import { API_URL } from "../../../config";

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    dueDate: "",
    reminderAt: ""
  });

  const token = localStorage.getItem("token");

  const api = axios.create({
    baseURL: `${API_URL}/tasks`,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  // 🔹 Obtener tareas
  const fetchTasks = async () => {
    try {
      const url = filter ? `/?status=${filter}` : "/my";
      const res = await api.get(url);
      setTasks(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  // 🔹 Crear tarea
  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      await api.post("/", form);

      Swal.fire("OK", "Tarea creada", "success");
      setForm({
        title: "",
        description: "",
        assignedTo: "",
        dueDate: "",
        reminderAt: ""
      });

      fetchTasks();
    } catch (error) {
      Swal.fire("Error", error.response?.data?.error, "error");
    }
  };

  // 🔹 Cambiar estado
  const changeStatus = async (id, status) => {
    try {
      await api.put(`/${id}/status`, { status });
      fetchTasks();
    } catch (error) {
      Swal.fire("Error", "No se pudo actualizar", "error");
    }
  };

  // 🔹 Icono según estado
  const getIcon = (status) => {
    if (status === "completed") return <FaCheck className="text-green-500" />;
    if (status === "in_progress") return <FaSpinner className="text-yellow-500" />;
    return <FaClock className="text-gray-500" />;
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      <h1 className="text-2xl font-bold mb-4">Gestión de Tareas</h1>

      {/* 🔹 Formulario */}
      <form
        onSubmit={handleCreate}
        className="bg-white p-4 rounded shadow mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <input
          type="text"
          placeholder="Título"
          className="border p-2 rounded"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />

        <input
          type="text"
          placeholder="Asignar a (userId)"
          className="border p-2 rounded"
          value={form.assignedTo}
          onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
          required
        />

        <input
          type="date"
          className="border p-2 rounded"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />

        <input
          type="datetime-local"
          className="border p-2 rounded"
          value={form.reminderAt}
          onChange={(e) => setForm({ ...form, reminderAt: e.target.value })}
        />

        <textarea
          placeholder="Descripción"
          className="border p-2 rounded col-span-1 md:col-span-2"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <button
          className="bg-blue-600 text-white p-2 rounded flex items-center justify-center gap-2"
        >
          <FaPlus /> Crear
        </button>
      </form>

      {/* 🔹 Filtros */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter("")}
          className="bg-gray-300 px-3 py-1 rounded"
        >
          Todas
        </button>
        <button
          onClick={() => setFilter("pending")}
          className="bg-gray-500 text-white px-3 py-1 rounded"
        >
          Pendientes
        </button>
        <button
          onClick={() => setFilter("in_progress")}
          className="bg-yellow-500 text-white px-3 py-1 rounded"
        >
          En progreso
        </button>
        <button
          onClick={() => setFilter("completed")}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          Completadas
        </button>
      </div>

      {/* 🔹 Lista */}
      <div className="grid gap-4">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="bg-white p-4 rounded shadow flex justify-between items-center"
          >
            <div>
              <h2 className="font-bold">{task.title}</h2>
              <p className="text-sm text-gray-600">{task.description}</p>
              <p className="text-xs text-gray-400">
                Estado: {task.status}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {getIcon(task.status)}

              <select
                value={task.status}
                onChange={(e) =>
                  changeStatus(task.id, e.target.value)
                }
                className="border p-1 rounded"
              >
                <option value="pending">Pendiente</option>
                <option value="in_progress">En progreso</option>
                <option value="completed">Completado</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}