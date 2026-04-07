import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { socket } from "../socket/socket";
import { API_URL } from "../../config";

const TaskNotificationContext = createContext();

export function TaskNotificationProvider({ children }) {
  const [pendingTasks, setPendingTasks] = useState([]);
  const [connected, setConnected] = useState(false);

  const clearNotifications = () => {
    setPendingTasks([]);
    setConnected(false);
  };

  const loadPendingTasks = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setPendingTasks([]);
        return;
      }

      const res = await axios.get(`${API_URL}/tasks/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const tasks = Array.isArray(res.data.data) ? res.data.data : [];

      // Solo pendientes
      setPendingTasks(tasks.filter((t) => t.status === "pendiente"));
    } catch (error) {
      console.error("Error cargando tareas pendientes:", error);
      setPendingTasks([]);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      clearNotifications();
      return;
    }

    loadPendingTasks();

    const onConnect = () => {
      setConnected(true);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onTaskSync = ({ type, task }) => {
      setPendingTasks((prev) => {
        const exists = prev.some((t) => t.id === task.id);

        if (task.status === "pendiente") {
          if (exists) {
            return prev.map((t) => (t.id === task.id ? task : t));
          }
          return [task, ...prev];
        }

        return prev.filter((t) => t.id !== task.id);
      });

      if (
        type === "created" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Nueva tarea asignada", {
          body: task.title,
        });
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("task:sync", onTaskSync);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("task:sync", onTaskSync);
    };
  }, []);

  const pendingCount = useMemo(() => pendingTasks.length, [pendingTasks]);

  return (
    <TaskNotificationContext.Provider
      value={{
        pendingTasks,
        pendingCount,
        connected,
        setPendingTasks,
        reloadPendingTasks: loadPendingTasks,
        clearNotifications,
      }}
    >
      {children}
    </TaskNotificationContext.Provider>
  );
}

export function useTaskNotifications() {
  return useContext(TaskNotificationContext);
}