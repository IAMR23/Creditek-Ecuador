import { useEffect, useState } from "react";
import {
  GraduationCap,
  LoaderCircle,
  PlayCircle,
  Video,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import OneDriveVideoPlayer from "../../components/OneDriveVideoPlayer";

export default function Capacitacion() {
  const [videos, setVideos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const cargar = async () => {
      try {
        setError("");
        const { data } = await api.get("/api/sistemas/capacitacion");
        setVideos(data.videos || []);
      } catch (requestError) {
        console.error("Error cargando capacitación:", requestError);
        setVideos([]);
        setError("No se pudieron cargar los videos de capacitación.");
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, []);

  useEffect(() => {
    if (!seleccionado) return undefined;
    const cerrarConEscape = (event) => {
      if (event.key === "Escape") setSeleccionado(null);
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [seleccionado]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/50 p-4 sm:p-7">
      <div className="mx-auto max-w-6xl">
        <header className="overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <span className="rounded-2xl bg-emerald-500 p-3 text-white shadow-sm">
                <GraduationCap size={30} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                  Formación interna
                </p>
                <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Capacitación</h1>
                <p className="mt-1 text-sm text-slate-300">
                  Aprende procesos y herramientas con los videos preparados para ti.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center">
              <p className="text-2xl font-bold text-emerald-300">{videos.length}</p>
              <p className="text-xs text-slate-300">Videos disponibles</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="grid min-h-80 place-items-center">
            <LoaderCircle className="animate-spin text-emerald-600" size={40} />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center font-medium text-red-700">
            {error}
          </div>
        ) : videos.length ? (
          <section className="mt-6 space-y-4">
            {videos.map((video, index) => (
              <button
                key={video.id}
                type="button"
                onClick={() => setSeleccionado(video)}
                className="group flex w-full flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center"
              >
                <span className="flex h-20 w-full shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white sm:w-24">
                  <Video size={34} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Video {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block text-lg font-bold text-slate-900 group-hover:text-emerald-800">
                    {video.titulo}
                  </span>
                  <span className="mt-2 line-clamp-2 block text-sm leading-6 text-slate-600">
                    {video.descripcion}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                  <PlayCircle size={18} /> Ver capacitación
                </span>
              </button>
            ))}
          </section>
        ) : (
          <div className="mt-6 grid min-h-80 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white/70 p-8 text-center">
            <div>
              <GraduationCap className="mx-auto text-slate-400" size={46} />
              <h2 className="mt-4 text-lg font-bold text-slate-700">Próximamente habrá contenido</h2>
              <p className="mt-1 text-sm text-slate-500">Sistemas todavía no ha publicado videos de capacitación.</p>
            </div>
          </div>
        )}
      </div>

      {seleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSeleccionado(null);
          }}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="capacitacion-titulo"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                  <PlayCircle size={24} />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Video de capacitación</p>
                  <h2 id="capacitacion-titulo" className="mt-1 text-xl font-bold text-slate-900">
                    {seleccionado.titulo}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeleccionado(null)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar detalle"
              >
                <X size={21} />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <OneDriveVideoPlayer
                enlace={seleccionado.enlace}
                titulo={seleccionado.titulo}
              />

              <h3 className="mt-6 text-sm font-bold text-slate-800">Descripción</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {seleccionado.descripcion}
              </p>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
