const API_URL = import.meta.env.VITE_API_URL;

export const registerSW = async () => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.error("❌ Error al registrar SW:", err);
  }
};

export const initSWWithToken = async () => {
  if (!("serviceWorker" in navigator)) {
    console.warn("❌ Service Worker no soportado");
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("❌ No hay token en localStorage");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.warn("❌ Permiso denegado");
    return;
  }

  const reg = await navigator.serviceWorker.ready;

  if (!reg.active) {
    console.warn("❌ SW activo es null, reintentando en 1s...");
    setTimeout(() => initSWWithToken(), 1000);
    return;
  }

  reg.active.postMessage({
    type: "SET_TOKEN",
    token,
    apiUrl: API_URL,
  });

  console.log("📨 Mensaje enviado al SW con apiUrl:", API_URL);
};