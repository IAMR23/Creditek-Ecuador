/* eslint-disable react/prop-types */
import { ExternalLink } from "lucide-react";

const HOST_ONEDRIVE = "onedrive.live.com";

const construirEnlaceReproductor = (enlace) => {
  try {
    const url = new URL(String(enlace || "").trim());
    const host = url.hostname.toLowerCase();
    const ruta = url.pathname.toLowerCase();

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

export default function OneDriveVideoPlayer(props) {
  const { enlace, titulo } = props;
  const enlaceReproductor = construirEnlaceReproductor(enlace);

  if (!enlaceReproductor) {
    return (
      <div className="grid aspect-video place-items-center rounded-2xl bg-slate-950 p-6 text-center text-sm text-slate-300">
        No se pudo preparar el enlace de este video.
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950 shadow-inner">
        <iframe
          src={enlaceReproductor}
          title={`Reproductor: ${titulo || "video de capacitación"}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>El acceso al video depende de los permisos configurados en OneDrive.</p>
        <a
          href={enlace}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 font-bold text-emerald-700 hover:underline"
        >
          <ExternalLink size={14} /> Abrir en OneDrive
        </a>
      </div>
    </div>
  );
}
