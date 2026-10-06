/* eslint-disable react/prop-types */
import { ExternalLink } from "lucide-react";
import {
  construirEnlaceReproductor,
  obtenerProveedorVideo,
} from "../utils/capacitacionVideo";

export default function OneDriveVideoPlayer(props) {
  const { enlace, titulo, mostrarAyuda = true } = props;
  const enlaceReproductor = construirEnlaceReproductor(enlace);
  const proveedor = obtenerProveedorVideo(enlace);

  if (!enlaceReproductor) {
    return (
      <div className="grid aspect-video place-items-center rounded-2xl border border-slate-200 bg-slate-100 p-6 text-center text-sm text-slate-600">
        No se pudo preparar el enlace de este video.
      </div>
    );
  }

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm">
        <iframe
          src={enlaceReproductor}
          title={`Reproductor: ${titulo || "video de capacitación"}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      {mostrarAyuda && (
        <div className="mt-3 flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>El acceso al video depende de los permisos configurados en {proveedor}.</p>
          <a
            href={enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 font-bold text-emerald-700 hover:underline"
          >
            <ExternalLink size={14} /> Abrir en {proveedor}
          </a>
        </div>
      )}
    </div>
  );
}
