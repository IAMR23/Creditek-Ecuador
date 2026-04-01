import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [now, setNow] = useState(new Date());

  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;

  // =========================
  // 📥 Obtener tareas
  // =========================
  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/tasks/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setTasks(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error) {
      console.error("Error al obtener tareas:", error);
    }
  };
  const requestNotificationPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        console.log("Permiso notificaciones:", permission);
      });
    }
  };
  const sendNotification = (task) => {
    if (Notification.permission === "granted") {
      new Notification("⏰ Recordatorio de tarea", {
        body: `${task.title} - ${task.description || ""}`,
      });
    }
  };

  useEffect(() => {
    fetchTasks();
    requestNotificationPermission();

    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    tasks.forEach((task) => {
      const status = getTaskStatus(task);

      if (
        status === "vencida" &&
        (!task.lastReminderSent ||
          new Date(task.lastReminderSent).toDateString() !==
            now.toDateString())
      ) {
        sendNotification(task);

        // 🔥 Marcar como notificada en backend
        axios
          .put(`${API_URL}/tasks/${task.id}/notify`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
          .catch(() => {});
      }
    });
  }, [now, tasks]);

  const getTaskStatus = (task) => {
    const horaActual = now
      .toLocaleTimeString("es-EC", {
        timeZone: "America/Guayaquil",
        hour12: false,
      })
      .slice(0, 5);

    if (task.status === "completada") return "completada";
    if (!task.reminderTime) return "sin_hora";

    const horaTarea = task.reminderTime.slice(0, 5);

    if (horaActual >= horaTarea) return "vencida";

    return "pendiente";
  };

  // =========================
  // 🎨 Colores
  // =========================
  const getColor = (status) => {
    switch (status) {
      case "vencida":
        return "red";
      case "pendiente":
        return "orange";
      case "completada":
        return "green";
      default:
        return "gray";
    }
  };

  const getTimeDiff = (task) => {
    if (!task.reminderTime) return "";

    const [h, m] = task.reminderTime.split(":");

    const fechaTarea = new Date(now);
    fechaTarea.setHours(h, m, 0);

    const diffMs = now - fechaTarea;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin > 0) return `Hace ${diffMin} min`;
    if (diffMin < 0) return `En ${Math.abs(diffMin)} min`;

    return "Ahora";
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Mis tareas</h2>

      {tasks.length === 0 && <p>No hay tareas</p>}

      {tasks.map((task) => {
        const status = getTaskStatus(task);

        return (
          <div
            key={task.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "8px",
              padding: "10px",
              marginBottom: "10px",
            }}
          >
            <h3>{task.title}</h3>

            <p>{task.description}</p>

            <p>
              <strong>Hora:</strong>{" "}
              {task.reminderTime || "Sin hora"}
            </p>

            <p style={{ color: getColor(status) }}>
              <strong>Estado:</strong> {status.toUpperCase()}
            </p>

            {task.reminderTime && (
              <p>
                <strong>Tiempo:</strong> {getTimeDiff(task)}
              </p>
            )}

            {status === "vencida" && (
              <div
                style={{
                  background: "#ffe5e5",
                  color: "red",
                  padding: "5px",
                  marginTop: "5px",
                  borderRadius: "5px",
                }}
              >
                ⚠️ TAREA VENCIDA
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}