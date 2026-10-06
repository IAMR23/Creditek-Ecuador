const HOST_ONEDRIVE = "onedrive.live.com";
const HOSTS_GOOGLE_DRIVE = new Set(["drive.google.com", "docs.google.com"]);

const extraerIdGoogleDrive = (url) => {
  const coincidencia = url.pathname.match(/^\/file\/d\/([^/]+)/i);
  return coincidencia?.[1] || url.searchParams.get("id") || "";
};

export const obtenerProveedorVideo = (enlace) => {
  try {
    const host = new URL(String(enlace || "").trim()).hostname.toLowerCase();
    if (HOSTS_GOOGLE_DRIVE.has(host)) return "Google Drive";
    if (
      host === "1drv.ms" ||
      host === HOST_ONEDRIVE ||
      host.endsWith(".sharepoint.com") ||
      host.endsWith(".microsoftpersonalcontent.com")
    ) {
      return host.endsWith(".sharepoint.com") ? "SharePoint" : "OneDrive";
    }
    return "el proveedor original";
  } catch {
    return "el proveedor original";
  }
};

export const construirEnlaceReproductor = (enlace) => {
  try {
    const url = new URL(String(enlace || "").trim());
    const host = url.hostname.toLowerCase();
    const ruta = url.pathname.toLowerCase();

    if (url.protocol !== "https:") return "";

    if (HOSTS_GOOGLE_DRIVE.has(host)) {
      const idRecurso = extraerIdGoogleDrive(url);
      return idRecurso
        ? `https://drive.google.com/file/d/${encodeURIComponent(idRecurso)}/preview`
        : "";
    }

    if (host === HOST_ONEDRIVE && !ruta.startsWith("/embed")) {
      const idRecurso = url.searchParams.get("resid") || url.searchParams.get("id");

      if (idRecurso && idRecurso.includes("!")) {
        const urlEmbed = new URL(`https://${HOST_ONEDRIVE}/embed`);
        urlEmbed.searchParams.set("resid", idRecurso);

        ["authkey", "cid"].forEach((parametro) => {
          const valor = url.searchParams.get(parametro);
          if (valor) urlEmbed.searchParams.set(parametro, valor);
        });

        return urlEmbed.toString();
      }
    }

    if (
      host.endsWith(".sharepoint.com") &&
      !ruta.includes("/_layouts/15/embed.aspx")
    ) {
      url.searchParams.set("action", "embedview");
      return url.toString();
    }

    return url.toString();
  } catch {
    return "";
  }
};
