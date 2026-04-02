// ✅ Sin ningún import
let API_URL = null;
let token = null;
let notifiedKeys = new Set();
let pollingInterval = null;

self.addEventListener("message", (event) => {
  if (event.data?.type === "SET_TOKEN") {
    token = event.data.token;
    API_URL = event.data.apiUrl; // ✅ Llega desde la app
    console.log("[SW] Token y URL recibidos, iniciando polling...");
    startPolling();
  }
});

function startPolling() {
  if (pollingInterval) return;
  checkTasks();
  pollingInterval = setInterval(checkTasks, 3 * 60 * 60 * 1000);
}

async function checkTasks() {
  if (!token || !API_URL) return;

  try {
    const res = await fetch(`${API_URL}/tasks/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    const tasks = Array.isArray(json.data) ? json.data : [];
    const now = new Date();

    tasks.forEach((task) => {
      if (task.status === "completada" || !task.reminderTime) return;

      const [h, m] = task.reminderTime.split(":");
      const fechaTarea = new Date(now);
      fechaTarea.setHours(Number(h), Number(m), 0, 0);

      if (now < fechaTarea) return;

      const bloqueActual = Math.floor(now.getHours() / 3);
      const dateStr = now.toISOString().slice(0, 10);
      const key = `${task.id}-${dateStr}-bloque-${bloqueActual}`;

      if (notifiedKeys.has(key)) return;
      notifiedKeys.add(key);

      self.registration.showNotification("⏰ Recordatorio de tarea", {
        body: `${task.title}${task.description ? " - " + task.description : ""}`,
        tag: key,
        vibrate: [200, 100, 200],
      });

      fetch(`${API_URL}/tasks/${task.id}/notify`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    });

  } catch (err) {
    console.error("[SW] Error al chequear tareas:", err);
  }
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});