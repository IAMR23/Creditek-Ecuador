import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import {
  ExternalLink,
  GraduationCap,
  Link2,
  LoaderCircle,
  Pencil,
  PlayCircle,
  Plus,
  Save,
  Video,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import OneDriveVideoPlayer from "../../components/OneDriveVideoPlayer";

const formularioInicial = {
  titulo: "",
  enlace: "",
  descripcion: "",
  activo: true,
};

const mensajeError = (error, fallback) =>
  error.response?.data?.message || fallback;

export default function Capacitacion() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [previsualizando, setPrevisualizando] = useState(null);
  const [form, setForm] = useState(formularioInicial);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/sistemas/capacitacion", {
        params: { incluirInactivos: true },
      });
      setVideos(data.videos || []);
    } catch (error) {
      setVideos([]);
      Swal.fire(
        "No se pudo cargar",
        mensajeError(error, "No se pudieron cargar los videos de capacitación."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!previsualizando) return undefined;
    const cerrarConEscape = (event) => {
      if (event.key === "Escape") setPrevisualizando(null);
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [previsualizando]);

  const actualizar = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((actual) => ({
      ...actual,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const limpiarFormulario = () => {
    setEditandoId(null);
    setForm(formularioInicial);
  };

  const editar = (video) => {
    setEditandoId(video.id);
    setForm({
      titulo: video.titulo,
      enlace: video.enlace,
      descripcion: video.descripcion,
      activo: video.activo,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async (event) => {
    event.preventDefault();
    try {
      setGuardando(true);
      if (editandoId) {
        await api.patch(`/api/sistemas/capacitacion/${editandoId}`, form);
      } else {
        await api.post("/api/sistemas/capacitacion", form);
      }
      await cargar();
      limpiarFormulario();
      Swal.fire(
        editandoId ? "Video actualizado" : "Video agregado",
        "El catálogo de capacitación fue actualizado correctamente.",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "No se pudo guardar",
        mensajeError(error, "Revise los datos e intente nuevamente."),
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarVisibilidad = async (video) => {
    try {
      await api.patch(`/api/sistemas/capacitacion/${video.id}`, {
        activo: !video.activo,
      });
      await cargar();
    } catch (error) {
      Swal.fire(
        "No se pudo cambiar la visibilidad",
        mensajeError(error, "Intente nuevamente."),
        "error",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-4">
            <span className="rounded-2xl bg-emerald-600 p-3 text-white">
              <GraduationCap size={28} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Sistemas · Contenido interno
              </p>
              <h1 className="mt-1 text-2xl font-bold">Capacitación</h1>
              <p className="mt-1 text-sm text-slate-500">
                Administra los videos de OneDrive disponibles para el panel de vendedores.
              </p>
            </div>
          </div>
        </header>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <form
            onSubmit={guardar}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-5"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">
                  {editandoId ? "Editar video" : "Agregar video"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Usa un enlace compartido de OneDrive o SharePoint.
                </p>
              </div>
              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Cancelar edición"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Título del video *</span>
                <input
                  required
                  maxLength={180}
                  name="titulo"
                  value={form.titulo}
                  onChange={actualizar}
                  placeholder="Ej. Cómo registrar una venta"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Enlace del video *</span>
                <div className="relative mt-1.5">
                  <Link2 className="absolute left-3 top-3 text-slate-400" size={17} />
                  <input
                    required
                    type="url"
                    maxLength={2048}
                    name="enlace"
                    value={form.enlace}
                    onChange={actualizar}
                    placeholder="https://1drv.ms/..."
                    className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <span className="mt-1.5 block text-xs leading-5 text-slate-500">
                  Para una reproducción más confiable, usa la URL <strong>src</strong> de
                  Compartir → Insertar en OneDrive. También se admiten enlaces compartidos.
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Descripción *</span>
                <textarea
                  required
                  rows={6}
                  maxLength={5000}
                  name="descripcion"
                  value={form.descripcion}
                  onChange={actualizar}
                  placeholder="Explica qué aprenderá el vendedor en este video."
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="mt-1 block text-right text-xs text-slate-400">
                  {form.descripcion.length}/5000
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  name="activo"
                  checked={form.activo}
                  onChange={actualizar}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span>
                  <strong className="block text-sm text-slate-800">Visible para vendedores</strong>
                  <span className="text-xs text-slate-500">Los videos inactivos permanecen guardados.</span>
                </span>
              </label>
            </div>

            <button
              disabled={guardando}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {guardando ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : editandoId ? (
                <Save size={18} />
              ) : (
                <Plus size={18} />
              )}
              {editandoId ? "Guardar cambios" : "Agregar capacitación"}
            </button>
          </form>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Videos registrados</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {videos.length} {videos.length === 1 ? "video" : "videos"} en el catálogo
                </p>
              </div>
              <button
                type="button"
                onClick={limpiarFormulario}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 xl:hidden"
              >
                <Plus size={16} /> Nuevo
              </button>
            </div>

            {loading ? (
              <div className="grid min-h-64 place-items-center">
                <LoaderCircle className="animate-spin text-emerald-600" size={36} />
              </div>
            ) : videos.length ? (
              <div className="space-y-3">
                {videos.map((video) => (
                  <article
                    key={video.id}
                    className={`rounded-2xl border p-4 transition ${
                      video.activo
                        ? "border-slate-200 bg-white"
                        : "border-slate-200 bg-slate-50 opacity-75"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <Video size={23} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-slate-900">{video.titulo}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${video.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                            {video.activo ? "Visible" : "Oculto"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                          {video.descripcion}
                        </p>
                        <a
                          href={video.enlace}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline"
                        >
                          <ExternalLink size={15} />
                          <span className="truncate">Abrir enlace de OneDrive</span>
                        </a>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                        <button
                          type="button"
                          onClick={() => setPrevisualizando(video)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                        >
                          <PlayCircle size={15} /> Ver video
                        </button>
                        <button
                          type="button"
                          onClick={() => editar(video)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                        >
                          <Pencil size={15} /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => cambiarVisibilidad(video)}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                        >
                          {video.activo ? "Ocultar" : "Activar"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div>
                  <GraduationCap className="mx-auto text-slate-400" size={38} />
                  <p className="mt-3 font-semibold text-slate-700">Aún no hay videos registrados</p>
                  <p className="mt-1 text-sm text-slate-500">Agrega el primer enlace de capacitación.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {previsualizando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-600/40 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPrevisualizando(null);
          }}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="vista-previa-capacitacion-titulo"
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Vista previa para vendedores
                </p>
                <h2
                  id="vista-previa-capacitacion-titulo"
                  className="mt-1 text-xl font-bold text-slate-900"
                >
                  {previsualizando.titulo}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPrevisualizando(null)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar vista previa"
              >
                <X size={21} />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <OneDriveVideoPlayer
                enlace={previsualizando.enlace}
                titulo={previsualizando.titulo}
              />
              <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {previsualizando.descripcion}
              </p>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
