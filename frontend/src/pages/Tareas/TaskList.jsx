import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";

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

  const getColor = (status) => {
    switch (status) {
      case "vencida": return "red";
      case "pendiente": return "orange";
      case "completada": return "green";
      default: return "gray";
    }
  };

  const getTimeDiff = (task) => {
    if (!task.reminderTime) return "";
    const [h, m] = task.reminderTime.split(":");
    const fechaTarea = new Date(now);
    fechaTarea.setHours(Number(h), Number(m), 0, 0);
    const diffMin = Math.floor((now - fechaTarea) / 60000);
    if (diffMin > 0) return `Hace ${diffMin} min`;
    if (diffMin < 0) return `En ${Math.abs(diffMin)} min`;
    return "Ahora";
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Mis tareas</h2>

      <p style={{ fontSize: "12px", color: "#888" }}>
        Notificaciones:{" "}
        <strong>
          {"Notification" in window ? Notification.permission : "no soportado"}
        </strong>
        {Notification.permission !== "granted" && (
          <button
            onClick={() => Notification.requestPermission()}
            style={{ marginLeft: "10px", fontSize: "12px" }}
          >
            Solicitar permiso
          </button>
        )}
      </p>

      {tasks.length === 0 && <p>No hay tareas</p>}

      {tasks.map((task) => {
        const status = getTaskStatus(task);
        return (
          <div key={task.id} style={{
            border: "1px solid #ccc", borderRadius: "8px",
            padding: "10px", marginBottom: "10px",
          }}>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
            <p><strong>Hora:</strong> {task.reminderTime || "Sin hora"}</p>
            <p style={{ color: getColor(status) }}>
              <strong>Estado:</strong> {status.toUpperCase()}
            </p>
            {task.reminderTime && (
              <p><strong>Tiempo:</strong> {getTimeDiff(task)}</p>
            )}
            {status === "vencida" && (
              <div style={{
                background: "#ffe5e5", color: "red",
                padding: "5px", marginTop: "5px", borderRadius: "5px",
              }}>
                ⚠️ TAREA VENCIDA
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}