const HOSTS_ONEDRIVE = new Set(["1drv.ms", "onedrive.live.com"]);
const HOSTS_GOOGLE_DRIVE = new Set(["drive.google.com", "docs.google.com"]);

const extraerIdGoogleDrive = (url) => {
  const coincidencia = url.pathname.match(/^\/file\/d\/([^/]+)/i);
  return coincidencia?.[1] || url.searchParams.get("id") || "";
};

const esEnlaceVideoPermitido = (valor) => {
  try {
    const url = new URL(String(valor || "").trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;

    if (HOSTS_GOOGLE_DRIVE.has(host)) {
      return Boolean(extraerIdGoogleDrive(url));
    }

    return (
      HOSTS_ONEDRIVE.has(host) ||
      host.endsWith(".sharepoint.com") ||
      host.endsWith(".microsoftpersonalcontent.com")
    );
  } catch {
    return false;
  }
};

const validarVideoCapacitacion = (data = {}, { parcial = false } = {}) => {
  const valores = {};

  if (!parcial || data.titulo !== undefined) {
    const titulo = String(data.titulo || "").trim();
    if (!titulo || titulo.length > 180) {
      throw new Error("El título es obligatorio y admite hasta 180 caracteres");
    }
    valores.titulo = titulo;
  }

  if (!parcial || data.enlace !== undefined) {
    const enlace = String(data.enlace || "").trim();
    if (enlace.length > 2048 || !esEnlaceVideoPermitido(enlace)) {
      throw new Error(
        "Ingrese un enlace HTTPS válido de Google Drive, OneDrive o SharePoint",
      );
    }
    valores.enlace = enlace;
  }

  if (!parcial || data.descripcion !== undefined) {
    const descripcion = String(data.descripcion || "").trim();
    if (!descripcion || descripcion.length > 5000) {
      throw new Error(
        "La descripción es obligatoria y admite hasta 5000 caracteres",
      );
    }
    valores.descripcion = descripcion;
  }

  if (data.activo !== undefined) {
    if (typeof data.activo !== "boolean") {
      throw new Error("El estado activo debe ser verdadero o falso");
    }
    valores.activo = data.activo;
  }

  return valores;
};

module.exports = {
  esEnlaceOneDrive: esEnlaceVideoPermitido,
  esEnlaceVideoPermitido,
  extraerIdGoogleDrive,
  validarVideoCapacitacion,
};
