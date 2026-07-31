const API_URL = import.meta.env.VITE_API_URL;

let swRefreshing = false;
let controllerChangeBound = false;
let shouldReloadOnControllerChange = false;

const bindControllerChangeReload = () => {
  if (controllerChangeBound) return;
  controllerChangeBound = true;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldReloadOnControllerChange) return;
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
};

export const registerSW = async () => {
  if (!("serviceWorker" in navigator)) return null;

  bindControllerChangeReload();

  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const reg = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });

    if (reg.waiting && hadController) {
      shouldReloadOnControllerChange = true;
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          shouldReloadOnControllerChange = true;
          newWorker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });

    await reg.update();
    return reg;
  } catch (err) {
    console.error("Error al registrar SW:", err);
    return null;
  }
};

export const initSWWithToken = async () => {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Worker no soportado");
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    console.warn("Permiso denegado");
    return;
  }

  const reg = await navigator.serviceWorker.ready;

  if (!reg.active) {
    console.warn("SW activo es null, reintentando en 1s...");
    setTimeout(() => initSWWithToken(), 1000);
    return;
  }

  reg.active.postMessage({
    type: "SET_TOKEN",
    token,
    apiUrl: API_URL,
  });
};
