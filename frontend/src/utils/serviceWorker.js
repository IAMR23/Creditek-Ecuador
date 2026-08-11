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
