const HOSTS_ONEDRIVE = new Set(["1drv.ms", "onedrive.live.com"]);

const esEnlaceOneDrive = (valor) => {
  try {
    const url = new URL(String(valor || "").trim());
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      (HOSTS_ONEDRIVE.has(host) ||
        host.endsWith(".sharepoint.com") ||
        host.endsWith(".microsoftpersonalcontent.com"))
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
    if (enlace.length > 2048 || !esEnlaceOneDrive(enlace)) {
      throw new Error("Ingrese un enlace HTTPS válido de OneDrive o SharePoint");
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

module.exports = { esEnlaceOneDrive, validarVideoCapacitacion };
