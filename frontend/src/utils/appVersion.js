const VERSION_URL = "/version.json";
const CHECK_INTERVAL_MS = 60 * 1000;

let currentVersion = null;
let intervalId = null;
let reloading = false;

const fetchVersion = async () => {
  const response = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`No se pudo consultar la version de la app: ${response.status}`);
  }

  const data = await response.json();
  return data?.version || null;
};

export const initAppVersionWatcher = async () => {
  if (import.meta.env.DEV || intervalId) return;

  const checkForUpdate = async () => {
    try {
      const nextVersion = await fetchVersion();

      if (!nextVersion) return;

      if (!currentVersion) {
        currentVersion = nextVersion;
        return;
      }

      if (nextVersion !== currentVersion && !reloading) {
        reloading = true;
        window.location.reload();
      }
    } catch (error) {
      console.warn("[AppVersion] No se pudo verificar una nueva version:", error);
    }
  };

  await checkForUpdate();
  intervalId = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);
};
