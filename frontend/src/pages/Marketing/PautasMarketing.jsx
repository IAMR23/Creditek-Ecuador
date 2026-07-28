/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  CalendarDays,
  Facebook,
  FileImage,
  ImagePlus,
  Instagram,
  Layers3,
  Megaphone,
  Music2,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { api } from "../../api/client";
import { API_URL } from "../../../config";

const TIPOS_CONTENIDO_INICIALES = [
  "Video",
  "Carrusel",
  "Post",
  "Reel",
  "Historia",
  "Live",
  "Otro",
];

let secuenciaContenido = 0;

const crearContenido = (contenido = {}) => ({
  clave: `contenido-${secuenciaContenido += 1}`,
  producto: contenido.producto || "",
  tipoContenido: contenido.tipoContenido || "",
  fecha: contenido.fecha || "",
});

const obtenerContenidos = (pauta = {}) => {
  if (Array.isArray(pauta.contenidos) && pauta.contenidos.length) {
    return pauta.contenidos;
  }

  if (pauta.producto || pauta.tipoContenido) {
    return [
      {
        producto: pauta.producto || "",
        tipoContenido: pauta.tipoContenido || "",
        fecha: pauta.fecha || "",
      },
    ];
  }

  return [];
};

const crearFormulario = (pauta = {}) => {
  const contenidos = obtenerContenidos(pauta);

  return {
    nombrePagina: pauta.nombrePagina || "",
    seguidoresFacebook: pauta.seguidoresFacebook ?? "",
    seguidoresInstagram: pauta.seguidoresInstagram ?? "",
    seguidoresTiktok: pauta.seguidoresTiktok ?? "",
    imagen: null,
    contenidos: (contenidos.length ? contenidos : [{}]).map(crearContenido),
  };
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

const resolverImagen = (imagen) => {
  if (!imagen) return "";
  if (/^https?:\/\//i.test(imagen)) return imagen;

  const base = String(API_URL || "").replace(/\/$/, "");
  const ruta = imagen.startsWith("/") ? imagen : `/${imagen}`;
  return `${base}${ruta}`;
};

const formatoNumero = new Intl.NumberFormat("es-EC");
const formatoCompacto = new Intl.NumberFormat("es-EC", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatearFecha = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return "Sin fecha";
  }

  const [anio, mes, dia] = value.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  if (Number.isNaN(fecha.getTime())) return "Sin fecha";

  return fecha.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function ImagenPauta({ src, alt }) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
        <FileImage size={42} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
      onError={() => setError(true)}
    />
  );
}

function Seguidores({ icon, red, cantidad, color }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
      <span className={`shrink-0 ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {red}
        </p>
        <p className="truncate text-sm font-bold text-slate-700">
          {formatoNumero.format(Number(cantidad) || 0)}
        </p>
      </div>
    </div>
  );
}

function TarjetaResumen({ icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
          {icon}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="text-2xl font-black text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export default function PautasMarketing() {
  const [pautas, setPautas] = useState([]);
  const [tiposContenido, setTiposContenido] = useState(
    TIPOS_CONTENIDO_INICIALES,
  );
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(crearFormulario);
  const [preview, setPreview] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroContenido, setFiltroContenido] = useState("");

  const cargarPautas = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/marketing/pautas");
      const pautasRecibidas = data.pautas || [];
      const tiposRegistrados = pautasRecibidas.flatMap((pauta) =>
        obtenerContenidos(pauta).map((contenido) => contenido.tipoContenido),
      );

      setPautas(pautasRecibidas);
      setTiposContenido(
        Array.from(
          new Set([
            ...TIPOS_CONTENIDO_INICIALES,
            ...(data.tiposContenido || []),
            ...tiposRegistrados,
          ]),
        ).filter(Boolean),
      );
    } catch (error) {
      Swal.fire(
        "No se pudo cargar",
        getErrorMessage(error, "No se pudieron cargar las pautas de marketing"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPautas();
  }, [cargarPautas]);

  const liberarPreview = () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  };

  const cerrarModal = () => {
    liberarPreview();
    setModalAbierto(false);
    setEditando(null);
    setForm(crearFormulario());
    setPreview("");
  };

  const abrirNuevo = () => {
    liberarPreview();
    setEditando(null);
    setForm(crearFormulario());
    setPreview("");
    setModalAbierto(true);
  };

  const abrirEdicion = (pauta) => {
    liberarPreview();
    setEditando(pauta);
    setForm(crearFormulario(pauta));
    setPreview(resolverImagen(pauta.imagen));
    setModalAbierto(true);
  };

  const cambiarCampo = (event) => {
    const { name, value } = event.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  };

  const cambiarContenido = (clave, campo, value) => {
    setForm((actual) => ({
      ...actual,
      contenidos: actual.contenidos.map((contenido) =>
        contenido.clave === clave
          ? { ...contenido, [campo]: value }
          : contenido,
      ),
    }));
  };

  const agregarContenido = () => {
    if (form.contenidos.length >= 100) {
      Swal.fire(
        "Límite alcanzado",
        "Solo se permiten 100 contenidos por página.",
        "info",
      );
      return;
    }

    setForm((actual) => ({
      ...actual,
      contenidos: [...actual.contenidos, crearContenido()],
    }));
  };

  const quitarContenido = (clave) => {
    setForm((actual) => {
      if (actual.contenidos.length === 1) return actual;

      return {
        ...actual,
        contenidos: actual.contenidos.filter(
          (contenido) => contenido.clave !== clave,
        ),
      };
    });
  };

  const seleccionarImagen = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formatos = ["image/jpeg", "image/png", "image/webp"];
    if (!formatos.includes(file.type)) {
      event.target.value = "";
      Swal.fire("Formato no válido", "Usa una imagen JPG, PNG o WEBP.", "info");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      event.target.value = "";
      Swal.fire("Imagen muy grande", "La imagen no puede superar los 5 MB.", "info");
      return;
    }

    liberarPreview();
    setForm((actual) => ({ ...actual, imagen: file }));
    setPreview(URL.createObjectURL(file));
  };

  const guardarPauta = async (event) => {
    event.preventDefault();

    if (!editando && !form.imagen) {
      Swal.fire("Imagen requerida", "Selecciona una imagen para la página.", "info");
      return;
    }

    const contenidos = form.contenidos.map(
      ({ producto, tipoContenido, fecha }) => ({
        producto,
        tipoContenido,
        fecha,
      }),
    );
    const data = new FormData();
    data.append("nombrePagina", form.nombrePagina);
    data.append("seguidoresFacebook", form.seguidoresFacebook || "0");
    data.append("seguidoresInstagram", form.seguidoresInstagram || "0");
    data.append("seguidoresTiktok", form.seguidoresTiktok || "0");
    data.append("contenidos", JSON.stringify(contenidos));
    if (form.imagen) data.append("imagen", form.imagen);

    try {
      setGuardando(true);

      if (editando) {
        await api.put(`/api/marketing/pautas/${editando.id}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/api/marketing/pautas", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      const estabaEditando = Boolean(editando);
      cerrarModal();
      await cargarPautas();
      await Swal.fire({
        icon: "success",
        title: estabaEditando ? "Página actualizada" : "Página registrada",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo guardar",
        getErrorMessage(error, "Revisa los datos e intenta nuevamente"),
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const eliminarPauta = async (pauta) => {
    const confirmacion = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar esta página?",
      text: `${pauta.nombrePagina} y su lista de contenidos dejarán de mostrarse.`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await api.delete(`/api/marketing/pautas/${pauta.id}`);
      setPautas((actuales) => actuales.filter((item) => item.id !== pauta.id));
      await Swal.fire({
        icon: "success",
        title: "Página eliminada",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo eliminar",
        getErrorMessage(error, "Intenta nuevamente"),
        "error",
      );
    }
  };

  const pautasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase("es");

    return pautas.filter((pauta) => {
      const contenidos = obtenerContenidos(pauta);
      const valoresBusqueda = [
        pauta.nombrePagina,
        ...contenidos.flatMap((contenido) => [
          contenido.producto,
          contenido.tipoContenido,
          contenido.fecha,
        ]),
      ];
      const coincideTexto =
        !texto ||
        valoresBusqueda.some((valor) =>
          String(valor || "").toLocaleLowerCase("es").includes(texto),
        );
      const coincideContenido =
        !filtroContenido ||
        contenidos.some(
          (contenido) => contenido.tipoContenido === filtroContenido,
        );

      return coincideTexto && coincideContenido;
    });
  }, [busqueda, filtroContenido, pautas]);

  const resumen = useMemo(() => {
    const contenidos = pautas.flatMap(obtenerContenidos);
    const seguidores = pautas.reduce(
      (total, pauta) =>
        total +
        Number(pauta.seguidoresFacebook || 0) +
        Number(pauta.seguidoresInstagram || 0) +
        Number(pauta.seguidoresTiktok || 0),
      0,
    );

    return {
      paginas: pautas.length,
      contenidos: contenidos.length,
      productos: new Set(
        contenidos.map((contenido) => contenido.producto).filter(Boolean),
      ).size,
      seguidores,
    };
  }, [pautas]);

  const productosExistentes = useMemo(
    () =>
      Array.from(
        new Set(
          pautas
            .flatMap(obtenerContenidos)
            .map((contenido) => contenido.producto)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "es")),
    [pautas],
  );

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1700px]">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-emerald-950 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-emerald-300">
                <Megaphone size={20} aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">
                  Marketing
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Páginas y contenido pautado
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Registra cada página una sola vez y agrega debajo todos los
                productos y formatos de contenido que se hayan pautado.
              </p>
            </div>

            <button
              type="button"
              onClick={abrirNuevo}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-neutral-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <Plus size={19} aria-hidden="true" />
              Nueva página
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaResumen
            icon={<Users size={22} aria-hidden="true" />}
            label="Páginas"
            value={formatoNumero.format(resumen.paginas)}
            detail="medios registrados"
          />
          <TarjetaResumen
            icon={<Layers3 size={22} aria-hidden="true" />}
            label="Contenidos"
            value={formatoNumero.format(resumen.contenidos)}
            detail="pautas acumuladas"
          />
          <TarjetaResumen
            icon={<Package size={22} aria-hidden="true" />}
            label="Productos"
            value={formatoNumero.format(resumen.productos)}
            detail="productos diferentes"
          />
          <TarjetaResumen
            icon={<Instagram size={22} aria-hidden="true" />}
            label="Audiencia total"
            value={formatoCompacto.format(resumen.seguidores)}
            detail="seguidores declarados"
          />
        </section>

        <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar páginas o contenidos</span>
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por página, producto o tipo de contenido..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="md:w-64">
            <span className="sr-only">Filtrar por tipo de contenido</span>
            <select
              value={filtroContenido}
              onChange={(event) => setFiltroContenido(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Todo el contenido</option>
              {tiposContenido.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>
        </section>

        {loading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-[30rem] animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : pautasFiltradas.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ImagePlus size={30} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-800">
              {pautas.length
                ? "No hay coincidencias"
                : "Aún no hay páginas registradas"}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
              {pautas.length
                ? "Prueba con otra búsqueda o cambia el filtro de contenido."
                : "Agrega la primera página con su imagen, seguidores y lista de contenidos pautados."}
            </p>
            {!pautas.length && (
              <button
                type="button"
                onClick={abrirNuevo}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <Plus size={18} aria-hidden="true" />
                Registrar primera página
              </button>
            )}
          </section>
        ) : (
          <div className="mt-6 grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pautasFiltradas.map((pauta) => {
              const contenidos = obtenerContenidos(pauta);

              return (
                <article
                  key={pauta.id}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                    <ImagenPauta
                      key={pauta.imagen}
                      src={resolverImagen(pauta.imagen)}
                      alt={`Pauta de ${pauta.nombrePagina}`}
                    />
                    <div className="absolute right-3 top-3 flex gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => abrirEdicion(pauta)}
                        className="rounded-lg bg-white/95 p-2 text-slate-700 shadow-md transition hover:bg-emerald-50 hover:text-emerald-700"
                        aria-label={`Editar ${pauta.nombrePagina}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarPauta(pauta)}
                        className="rounded-lg bg-white/95 p-2 text-slate-700 shadow-md transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Eliminar ${pauta.nombrePagina}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5">
                    <h2 className="break-words text-xl font-black leading-tight text-slate-800">
                      {pauta.nombrePagina}
                    </h2>

                    <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      Cantidad de seguidores
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Seguidores
                        icon={<Facebook size={16} aria-hidden="true" />}
                        red="FB"
                        cantidad={pauta.seguidoresFacebook}
                        color="text-blue-600"
                      />
                      <Seguidores
                        icon={<Instagram size={16} aria-hidden="true" />}
                        red="IG"
                        cantidad={pauta.seguidoresInstagram}
                        color="text-fuchsia-600"
                      />
                      <Seguidores
                        icon={<Music2 size={16} aria-hidden="true" />}
                        red="TK"
                        cantidad={pauta.seguidoresTiktok}
                        color="text-slate-800"
                      />
                    </div>

                    <div className="mt-5 border-t border-slate-100 pt-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Contenido pautado
                          </p>
                          <p className="text-xs text-slate-500">
                            {contenidos.length}{" "}
                            {contenidos.length === 1
                              ? "contenido"
                              : "contenidos"}{" "}
                            · Producto + formato
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => abrirEdicion(pauta)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                        >
                          <Plus size={14} aria-hidden="true" />
                          Agregar
                        </button>
                      </div>

                      <div className="space-y-2">
                        {contenidos.map((contenido, index) => (
                          <div
                            key={`${contenido.producto}-${contenido.tipoContenido}-${contenido.fecha}-${index}`}
                            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-emerald-700 shadow-sm">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-bold text-slate-700">
                                {contenido.producto}
                              </p>
                              <p className="text-xs text-slate-400">Producto</p>
                            </div>
                            <div className="flex max-w-[48%] shrink-0 flex-col items-end gap-1.5">
                              <span className="max-w-full break-words rounded-full bg-emerald-100 px-2.5 py-1 text-center text-[11px] font-bold text-emerald-700">
                                {contenido.tipoContenido}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                                <CalendarDays size={13} aria-hidden="true" />
                                {formatearFecha(contenido.fecha)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {modalAbierto && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-pauta"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !guardando) cerrarModal();
          }}
        >
          <form
            onSubmit={guardarPauta}
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
                  Marketing
                </p>
                <h2
                  id="titulo-modal-pauta"
                  className="text-xl font-black text-slate-800"
                >
                  {editando ? "Editar página y contenidos" : "Nueva página"}
                </h2>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                disabled={guardando}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                aria-label="Cerrar formulario"
              >
                <X size={22} />
              </button>
            </div>

            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="mb-2 text-sm font-bold text-slate-700">
                  Imagen de la página <span className="text-red-500">*</span>
                </p>
                <label className="group flex aspect-[16/10] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Vista previa de la página"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex flex-col items-center px-5 text-slate-500">
                      <ImagePlus
                        size={36}
                        className="mb-3 text-emerald-600"
                        aria-hidden="true"
                      />
                      <strong className="text-sm text-slate-700">
                        Seleccionar imagen
                      </strong>
                      <span className="mt-1 text-xs">
                        JPG, PNG o WEBP · máximo 5 MB
                      </span>
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={seleccionarImagen}
                    className="sr-only"
                    required={!editando}
                  />
                </label>
                {preview && (
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-800">
                    <ImagePlus size={15} aria-hidden="true" />
                    Cambiar imagen
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={seleccionarImagen}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-slate-700">
                    Nombre de la página <span className="text-red-500">*</span>
                  </span>
                  <input
                    name="nombrePagina"
                    value={form.nombrePagina}
                    onChange={cambiarCampo}
                    maxLength={160}
                    required
                    placeholder="Ej. Tecnología Ecuador"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-slate-700">
                    Cantidad de seguidores
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label>
                      <span className="mb-1 flex items-center gap-1 text-xs font-bold text-blue-600">
                        <Facebook size={14} aria-hidden="true" /> Facebook
                      </span>
                      <input
                        type="number"
                        name="seguidoresFacebook"
                        value={form.seguidoresFacebook}
                        onChange={cambiarCampo}
                        min="0"
                        max="999999999999"
                        step="1"
                        placeholder="0"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label>
                      <span className="mb-1 flex items-center gap-1 text-xs font-bold text-fuchsia-600">
                        <Instagram size={14} aria-hidden="true" /> Instagram
                      </span>
                      <input
                        type="number"
                        name="seguidoresInstagram"
                        value={form.seguidoresInstagram}
                        onChange={cambiarCampo}
                        min="0"
                        max="999999999999"
                        step="1"
                        placeholder="0"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100"
                      />
                    </label>
                    <label>
                      <span className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-800">
                        <Music2 size={14} aria-hidden="true" /> TikTok
                      </span>
                      <input
                        type="number"
                        name="seguidoresTiktok"
                        value={form.seguidoresTiktok}
                        onChange={cambiarCampo}
                        min="0"
                        max="999999999999"
                        step="1"
                        placeholder="0"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      />
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>

            <section className="border-t border-slate-100 px-5 pb-6 pt-5 sm:px-7">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    Contenidos de esta página
                  </h3>
                  <p className="text-sm text-slate-500">
                    Agrega una fila por cada producto y formato pautado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={agregarContenido}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Plus size={17} aria-hidden="true" />
                  Agregar contenido
                </button>
              </div>

              <div className="space-y-3">
                {form.contenidos.map((contenido, index) => (
                  <div
                    key={contenido.clave}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[auto_1.1fr_1fr_0.8fr_auto] lg:items-end"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-emerald-700 shadow-sm">
                      {index + 1}
                    </span>

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-600">
                        Producto <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={contenido.producto}
                        onChange={(event) =>
                          cambiarContenido(
                            contenido.clave,
                            "producto",
                            event.target.value,
                          )
                        }
                        list="productos-marketing"
                        maxLength={120}
                        required
                        placeholder="Ej. Honor X8D"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-600">
                        Tipo de contenido <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={contenido.tipoContenido}
                        onChange={(event) =>
                          cambiarContenido(
                            contenido.clave,
                            "tipoContenido",
                            event.target.value,
                          )
                        }
                        list="tipos-contenido-marketing"
                        maxLength={80}
                        required
                        placeholder="Video, carrusel, post..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-600">
                        Fecha de pauta <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="date"
                        value={contenido.fecha}
                        onChange={(event) =>
                          cambiarContenido(
                            contenido.clave,
                            "fecha",
                            event.target.value,
                          )
                        }
                        required
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => quitarContenido(contenido.clave)}
                      disabled={form.contenidos.length === 1}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={`Eliminar contenido ${index + 1}`}
                      title={
                        form.contenidos.length === 1
                          ? "La página debe conservar al menos un contenido"
                          : "Eliminar contenido"
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              <datalist id="productos-marketing">
                {productosExistentes.map((producto) => (
                  <option key={producto} value={producto} />
                ))}
              </datalist>
              <datalist id="tipos-contenido-marketing">
                {tiposContenido.map((tipo) => (
                  <option key={tipo} value={tipo} />
                ))}
              </datalist>
            </section>

            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={cerrarModal}
                disabled={guardando}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={18} aria-hidden="true" />
                {guardando
                  ? "Guardando..."
                  : editando
                    ? "Guardar página"
                    : "Registrar página"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
