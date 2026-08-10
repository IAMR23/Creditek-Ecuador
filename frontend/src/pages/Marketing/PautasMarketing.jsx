/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
  cumplidoFacebook: Boolean(contenido.cumplidoFacebook),
  cumplidoInstagram: Boolean(contenido.cumplidoInstagram),
  cumplidoTiktok: Boolean(contenido.cumplidoTiktok),
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

const formatoMes = new Intl.DateTimeFormat("es-EC", {
  month: "long",
  year: "numeric",
});

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const fechaIsoLocal = (fecha) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

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

const contenidoCoincideFecha = (contenido, fechaDesde, fechaHasta) => {
  if (!fechaDesde && !fechaHasta) return true;

  const fecha = String(contenido?.fecha || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  if (fechaDesde && fecha < fechaDesde) return false;
  if (fechaHasta && fecha > fechaHasta) return false;
  return true;
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

function CheckCumplimiento({
  icon,
  red,
  nombreRed,
  color,
  checked,
  disabled,
  onChange,
}) {
  return (
    <label
      className={`flex min-w-0 cursor-pointer items-center justify-between gap-1 rounded-lg border px-2 py-1.5 transition ${
        checked
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white"
      } ${disabled ? "cursor-wait opacity-60" : ""}`}
      title={`${nombreRed}: ${checked ? "cumplido" : "pendiente"}`}
    >
      <span className={`inline-flex min-w-0 items-center gap-1 ${color}`}>
        {icon}
        <span className="truncate text-[10px] font-black uppercase">{red}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-600 disabled:cursor-wait"
        aria-label={`Marcar ${nombreRed} como cumplido`}
      />
    </label>
  );
}

function FormularioContenidoRapido({
  numero,
  contenido,
  titulo = "Nuevo contenido",
  guardando,
  onChange,
  onGuardar,
  onCancelar,
}) {
  return (
    <form
      onSubmit={onGuardar}
      className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-emerald-700 shadow-sm">
          {numero}
        </span>
        <p className="text-xs font-black text-slate-700">{titulo}</p>
      </div>

      <div className="space-y-2">
        <label className="block">
          <span className="sr-only">Dispositivo o producto</span>
          <input
            value={contenido.producto}
            onChange={(event) => onChange("producto", event.target.value)}
            maxLength={120}
            placeholder="Dispositivo / producto"
            disabled={guardando}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="sr-only">Tipo de contenido</span>
            <select
              value={contenido.tipoContenido}
              onChange={(event) =>
                onChange("tipoContenido", event.target.value)
              }
              disabled={guardando}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
            >
              <option value="">Tipo de contenido</option>
              {TIPOS_CONTENIDO_INICIALES.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Fecha de pauta</span>
            <input
              type="date"
              value={contenido.fecha}
              onChange={(event) => onChange("fecha", event.target.value)}
              disabled={guardando}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <CheckCumplimiento
            icon={<Facebook size={13} aria-hidden="true" />}
            red="FB"
            nombreRed="Facebook"
            color="text-blue-600"
            checked={contenido.cumplidoFacebook}
            disabled={guardando}
            onChange={(cumplido) => onChange("cumplidoFacebook", cumplido)}
          />
          <CheckCumplimiento
            icon={<Instagram size={13} aria-hidden="true" />}
            red="IG"
            nombreRed="Instagram"
            color="text-fuchsia-600"
            checked={contenido.cumplidoInstagram}
            disabled={guardando}
            onChange={(cumplido) => onChange("cumplidoInstagram", cumplido)}
          />
          <CheckCumplimiento
            icon={<Music2 size={13} aria-hidden="true" />}
            red="TK"
            nombreRed="TikTok"
            color="text-slate-800"
            checked={contenido.cumplidoTiktok}
            disabled={guardando}
            onChange={(cumplido) => onChange("cumplidoTiktok", cumplido)}
          />
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-white disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          <Save size={13} aria-hidden="true" />
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
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

function ChecksRedesCalendario({ evento, disabled, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-1 border-t border-slate-100 px-1.5 py-1.5">
      <CheckCumplimiento
        red="FB"
        nombreRed="Facebook"
        color="text-blue-600"
        checked={Boolean(evento.cumplidoFacebook)}
        disabled={disabled}
        onChange={(cumplido) =>
          onChange(
            evento.pauta,
            evento.indiceOriginal,
            "cumplidoFacebook",
            cumplido,
          )
        }
      />
      <CheckCumplimiento
        red="IG"
        nombreRed="Instagram"
        color="text-fuchsia-600"
        checked={Boolean(evento.cumplidoInstagram)}
        disabled={disabled}
        onChange={(cumplido) =>
          onChange(
            evento.pauta,
            evento.indiceOriginal,
            "cumplidoInstagram",
            cumplido,
          )
        }
      />
      <CheckCumplimiento
        red="TK"
        nombreRed="TikTok"
        color="text-slate-800"
        checked={Boolean(evento.cumplidoTiktok)}
        disabled={disabled}
        onChange={(cumplido) =>
          onChange(
            evento.pauta,
            evento.indiceOriginal,
            "cumplidoTiktok",
            cumplido,
          )
        }
      />
    </div>
  );
}

function CalendarioPautas({
  pautas,
  onEditar,
  onCambiarCumplimiento,
  cumplimientosActualizando,
  fechaDesde,
  fechaHasta,
}) {
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const hoy = fechaIsoLocal(new Date());

  const agenda = useMemo(
    () =>
      pautas.flatMap((pauta) =>
        obtenerContenidos(pauta)
          .map((contenido, indiceOriginal) => ({
            contenido,
            indiceOriginal,
          }))
          .filter(({ contenido }) =>
            contenidoCoincideFecha(contenido, fechaDesde, fechaHasta),
          )
          .map(({ contenido, indiceOriginal }) => ({
            id: `${pauta.id}-${indiceOriginal}`,
            pauta,
            indiceOriginal,
            pagina: pauta.nombrePagina,
            dispositivo: contenido.producto || "Dispositivo pendiente",
            tipoContenido: contenido.tipoContenido || "Contenido pendiente",
            cumplidoFacebook: contenido.cumplidoFacebook,
            cumplidoInstagram: contenido.cumplidoInstagram,
            cumplidoTiktok: contenido.cumplidoTiktok,
            fecha: /^\d{4}-\d{2}-\d{2}$/.test(contenido.fecha || "")
              ? contenido.fecha
              : "",
          })),
      ),
    [fechaDesde, fechaHasta, pautas],
  );

  useEffect(() => {
    setMesSeleccionado(fechaDesde ? fechaDesde.slice(0, 7) : "");
  }, [fechaDesde, fechaHasta]);

  const agendaConFecha = useMemo(
    () =>
      agenda
        .filter((item) => item.fecha)
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [agenda],
  );
  const agendaSinFecha = useMemo(
    () => agenda.filter((item) => !item.fecha),
    [agenda],
  );

  const mesPredeterminado = useMemo(() => {
    const siguiente = agendaConFecha.find((item) => item.fecha >= hoy);
    const referencia =
      siguiente || agendaConFecha[agendaConFecha.length - 1];
    return referencia?.fecha.slice(0, 7) || hoy.slice(0, 7);
  }, [agendaConFecha, hoy]);
  const mesVisible = mesSeleccionado || mesPredeterminado;

  const datosMes = useMemo(() => {
    const [anio, mes] = mesVisible.split("-").map(Number);
    const primerDia = new Date(anio, mes - 1, 1);
    const diasDelMes = new Date(anio, mes, 0).getDate();
    const espaciosIniciales = (primerDia.getDay() + 6) % 7;
    const totalCeldas = Math.ceil((espaciosIniciales + diasDelMes) / 7) * 7;
    const celdas = Array.from({ length: totalCeldas }, (_, posicion) => {
      const dia = posicion - espaciosIniciales + 1;
      if (dia < 1 || dia > diasDelMes) return null;

      return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    });

    return {
      celdas,
      titulo: formatoMes.format(primerDia),
    };
  }, [mesVisible]);

  const eventosPorFecha = useMemo(() => {
    const agrupados = new Map();
    agendaConFecha.forEach((item) => {
      const eventos = agrupados.get(item.fecha) || [];
      eventos.push(item);
      agrupados.set(item.fecha, eventos);
    });
    return agrupados;
  }, [agendaConFecha]);

  const moverMes = (cantidad) => {
    const [anio, mes] = mesVisible.split("-").map(Number);
    const nuevoMes = new Date(anio, mes - 1 + cantidad, 1);
    setMesSeleccionado(fechaIsoLocal(nuevoMes).slice(0, 7));
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <CalendarDays size={20} aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-800">
              Calendario de contenidos
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Cada viñeta indica qué publicar, el dispositivo y la página.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => moverMes(-1)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="min-w-40 text-center text-sm font-black capitalize text-slate-700">
            {datosMes.titulo}
          </p>
          <button
            type="button"
            onClick={() => moverMes(1)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => setMesSeleccionado(hoy.slice(0, 7))}
            className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
          >
            Hoy
          </button>
        </div>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <div className="min-w-[1120px]">
          <div className="grid grid-cols-7 gap-2">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="px-2 pb-1 text-center text-[11px] font-black uppercase tracking-wide text-slate-400"
              >
                {dia}
              </div>
            ))}

            {datosMes.celdas.map((fecha, index) => {
              const eventos = fecha ? eventosPorFecha.get(fecha) || [] : [];

              return fecha ? (
                <div
                  key={fecha}
                  className={`min-h-32 rounded-xl border p-2 ${
                    fecha === hoy
                      ? "border-emerald-300 bg-emerald-50/50"
                      : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <p
                    className={`mb-1 text-xs font-black ${
                      fecha === hoy ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {Number(fecha.slice(-2))}
                  </p>
                  <ul className="max-h-44 space-y-1 overflow-y-auto">
                    {eventos.map((evento) => (
                      <li
                        key={evento.id}
                        className="overflow-hidden rounded-lg bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => onEditar(evento.pauta)}
                          className="flex w-full gap-1.5 px-2 py-1.5 text-left transition hover:bg-emerald-50"
                          title={`Publicar ${evento.tipoContenido} de ${evento.dispositivo} en ${evento.pagina}`}
                        >
                          <span className="shrink-0 font-black text-emerald-600">
                            •
                          </span>
                          <span className="min-w-0">
                            <span className="block break-words text-[10px] font-bold leading-4 text-slate-700">
                              Publicar {evento.tipoContenido} de {evento.dispositivo}
                            </span>
                            <span className="block truncate text-[9px] text-slate-400">
                              Página: {evento.pagina}
                            </span>
                          </span>
                        </button>
                        <ChecksRedesCalendario
                          evento={evento}
                          disabled={cumplimientosActualizando.some((clave) =>
                            clave.startsWith(`${evento.pauta.id}-`),
                          )}
                          onChange={onCambiarCumplimiento}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div
                  key={`vacio-${index}`}
                  className="min-h-32 rounded-xl bg-slate-50/30"
                  aria-hidden="true"
                />
              );
            })}
          </div>
        </div>
      </div>

      {agendaSinFecha.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-700">
              Por programar
            </h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
              {agendaSinFecha.length} sin fecha
            </span>
          </div>
          <ul className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-4">
            {agendaSinFecha.map((evento) => (
              <li
                key={evento.id}
                className="overflow-hidden rounded-xl border border-amber-100 bg-amber-50/60"
              >
                <button
                  type="button"
                  onClick={() => onEditar(evento.pauta)}
                  className="flex w-full gap-2 px-3 py-2 text-left transition hover:bg-amber-50"
                >
                  <span className="font-black text-amber-600">•</span>
                  <span className="min-w-0 text-xs text-slate-600">
                    <strong>{evento.tipoContenido}</strong> de {evento.dispositivo}
                    <span className="block truncate text-[10px] text-slate-400">
                      Página: {evento.pagina}
                    </span>
                  </span>
                </button>
                <ChecksRedesCalendario
                  evento={evento}
                  disabled={cumplimientosActualizando.some((clave) =>
                    clave.startsWith(`${evento.pauta.id}-`),
                  )}
                  onChange={onCambiarCumplimiento}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cumplimientosActualizando, setCumplimientosActualizando] = useState(
    [],
  );
  const [contenidoRapido, setContenidoRapido] = useState(null);
  const [guardandoContenidoRapido, setGuardandoContenidoRapido] =
    useState(false);
  const [contenidoEditando, setContenidoEditando] = useState(null);
  const [guardandoContenidoEditando, setGuardandoContenidoEditando] =
    useState(false);
  const [contenidoEliminando, setContenidoEliminando] = useState("");

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
    setContenidoRapido(null);
    setContenidoEditando(null);
    setEditando(null);
    setForm(crearFormulario());
    setPreview("");
    setModalAbierto(true);
  };

  const abrirEdicion = (pauta) => {
    liberarPreview();
    setContenidoRapido(null);
    setContenidoEditando(null);
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
    setForm((actual) => ({
      ...actual,
      contenidos: actual.contenidos.filter(
        (contenido) => contenido.clave !== clave,
      ),
    }));
  };

  const abrirContenidoRapido = (pauta) => {
    const contenidos = obtenerContenidos(pauta);
    if (contenidos.length >= 100) {
      Swal.fire(
        "Límite alcanzado",
        "Solo se permiten 100 contenidos por página.",
        "info",
      );
      return;
    }

    setContenidoEditando(null);
    setContenidoRapido({
      ...crearContenido(),
      pautaId: pauta.id,
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const lista = document.getElementById(`contenidos-pauta-${pauta.id}`);
        lista?.scrollTo({ top: lista.scrollHeight, behavior: "smooth" });
      });
    });
  };

  const cambiarContenidoRapido = (campo, value) => {
    setContenidoRapido((actual) =>
      actual ? { ...actual, [campo]: value } : actual,
    );
  };

  const guardarContenidoRapido = async (event) => {
    event.preventDefault();
    if (!contenidoRapido) return;

    const {
      pautaId,
      producto,
      tipoContenido,
      fecha,
      cumplidoFacebook,
      cumplidoInstagram,
      cumplidoTiktok,
    } = contenidoRapido;
    const tieneDatos =
      [producto, tipoContenido, fecha].some((value) => String(value).trim()) ||
      cumplidoFacebook ||
      cumplidoInstagram ||
      cumplidoTiktok;

    if (!tieneDatos) {
      Swal.fire(
        "Contenido vacío",
        "Ingresa al menos un dato antes de guardar.",
        "info",
      );
      return;
    }

    try {
      setGuardandoContenidoRapido(true);
      const { data } = await api.post(
        `/api/marketing/pautas/${pautaId}/contenidos`,
        {
          producto,
          tipoContenido,
          fecha,
          cumplidoFacebook,
          cumplidoInstagram,
          cumplidoTiktok,
        },
      );
      setPautas((actuales) =>
        actuales.map((pauta) =>
          pauta.id === pautaId ? data.pauta : pauta,
        ),
      );
      setContenidoRapido(null);
    } catch (error) {
      Swal.fire(
        "No se pudo agregar",
        getErrorMessage(error, "Revisa el contenido e intenta nuevamente"),
        "error",
      );
    } finally {
      setGuardandoContenidoRapido(false);
    }
  };

  const abrirEdicionContenido = (pauta, contenido) => {
    setContenidoRapido(null);
    setContenidoEditando({
      ...crearContenido(contenido),
      pautaId: pauta.id,
      indice: contenido.indiceOriginal,
    });
  };

  const cambiarContenidoEditando = (campo, value) => {
    setContenidoEditando((actual) =>
      actual ? { ...actual, [campo]: value } : actual,
    );
  };

  const guardarContenidoEditando = async (event) => {
    event.preventDefault();
    if (!contenidoEditando) return;

    const {
      pautaId,
      indice,
      producto,
      tipoContenido,
      fecha,
      cumplidoFacebook,
      cumplidoInstagram,
      cumplidoTiktok,
    } = contenidoEditando;
    const tieneDatos =
      [producto, tipoContenido, fecha].some((value) => String(value).trim()) ||
      cumplidoFacebook ||
      cumplidoInstagram ||
      cumplidoTiktok;

    if (!tieneDatos) {
      Swal.fire(
        "Contenido vacío",
        "Ingresa al menos un dato antes de guardar.",
        "info",
      );
      return;
    }

    try {
      setGuardandoContenidoEditando(true);
      const { data } = await api.put(
        `/api/marketing/pautas/${pautaId}/contenidos/${indice}`,
        {
          producto,
          tipoContenido,
          fecha,
          cumplidoFacebook,
          cumplidoInstagram,
          cumplidoTiktok,
        },
      );
      setPautas((actuales) =>
        actuales.map((pauta) =>
          pauta.id === pautaId ? data.pauta : pauta,
        ),
      );
      setContenidoEditando(null);
    } catch (error) {
      Swal.fire(
        "No se pudo editar",
        getErrorMessage(error, "Revisa el contenido e intenta nuevamente"),
        "error",
      );
    } finally {
      setGuardandoContenidoEditando(false);
    }
  };

  const eliminarContenido = async (pauta, contenido) => {
    const indice = contenido.indiceOriginal;
    const descripcion =
      contenido.producto || contenido.tipoContenido || `Contenido ${indice + 1}`;
    const confirmacion = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar este contenido?",
      text: `${descripcion} se eliminará de ${pauta.nombrePagina}.`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (!confirmacion.isConfirmed) return;

    const clave = `${pauta.id}-${indice}`;
    try {
      setContenidoEliminando(clave);
      const { data } = await api.delete(
        `/api/marketing/pautas/${pauta.id}/contenidos/${indice}`,
      );
      setPautas((actuales) =>
        actuales.map((item) => (item.id === pauta.id ? data.pauta : item)),
      );
      if (
        contenidoEditando?.pautaId === pauta.id &&
        contenidoEditando?.indice === indice
      ) {
        setContenidoEditando(null);
      }
      await Swal.fire({
        icon: "success",
        title: "Contenido eliminado",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo eliminar",
        getErrorMessage(error, "Intenta nuevamente"),
        "error",
      );
    } finally {
      setContenidoEliminando("");
    }
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

    const contenidos = form.contenidos
      .map(
        ({
          producto,
          tipoContenido,
          fecha,
          cumplidoFacebook,
          cumplidoInstagram,
          cumplidoTiktok,
        }) => ({
          producto,
          tipoContenido,
          fecha,
          cumplidoFacebook,
          cumplidoInstagram,
          cumplidoTiktok,
        }),
      )
      .filter(
        ({
          producto,
          tipoContenido,
          fecha,
          cumplidoFacebook,
          cumplidoInstagram,
          cumplidoTiktok,
        }) =>
          [producto, tipoContenido, fecha].some((value) =>
            String(value).trim(),
          ) || cumplidoFacebook || cumplidoInstagram || cumplidoTiktok,
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

  const cambiarCumplimiento = async (pauta, indice, red, cumplido) => {
    const claveActualizacion = `${pauta.id}-${indice}-${red}`;
    if (
      cumplimientosActualizando.some((clave) =>
        clave.startsWith(`${pauta.id}-`),
      )
    ) {
      return;
    }
    const contenidoAnterior = obtenerContenidos(pauta)[indice];

    const aplicarCumplimiento = (items, valor) =>
      items.map((item) => {
        if (item.id !== pauta.id) return item;

        return {
          ...item,
          contenidos: obtenerContenidos(item).map((contenido, posicion) =>
            posicion === indice
              ? { ...contenido, [red]: valor }
              : contenido,
          ),
        };
      });

    setCumplimientosActualizando((actuales) => [
      ...actuales,
      claveActualizacion,
    ]);
    setPautas((actuales) => aplicarCumplimiento(actuales, cumplido));

    try {
      const { data } = await api.patch(
        `/api/marketing/pautas/${pauta.id}/contenidos/${indice}/cumplimiento`,
        { red, cumplido },
      );
      const valorGuardado = Boolean(
        data.pauta?.contenidos?.[indice]?.[red],
      );
      setPautas((actuales) => aplicarCumplimiento(actuales, valorGuardado));
    } catch (error) {
      setPautas((actuales) =>
        aplicarCumplimiento(
          actuales,
          Boolean(contenidoAnterior?.[red]),
        ),
      );
      Swal.fire(
        "No se pudo actualizar",
        getErrorMessage(error, "Intenta marcar nuevamente la red social"),
        "error",
      );
    } finally {
      setCumplimientosActualizando((actuales) =>
        actuales.filter((clave) => clave !== claveActualizacion),
      );
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
    const filtroFechaActivo = Boolean(fechaDesde || fechaHasta);

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
      const coincideFecha =
        !filtroFechaActivo ||
        contenidos.some((contenido) =>
          contenidoCoincideFecha(contenido, fechaDesde, fechaHasta),
        );

      return coincideTexto && coincideContenido && coincideFecha;
    });
  }, [busqueda, fechaDesde, fechaHasta, filtroContenido, pautas]);

  const resumen = useMemo(() => {
    const filtroFechaActivo = Boolean(fechaDesde || fechaHasta);
    const pautasEnRango = filtroFechaActivo
      ? pautas.filter((pauta) =>
          obtenerContenidos(pauta).some((contenido) =>
            contenidoCoincideFecha(contenido, fechaDesde, fechaHasta),
          ),
        )
      : pautas;
    const contenidos = pautasEnRango.flatMap((pauta) =>
      obtenerContenidos(pauta).filter((contenido) =>
        contenidoCoincideFecha(contenido, fechaDesde, fechaHasta),
      ),
    );
    const seguidores = pautasEnRango.reduce(
      (total, pauta) =>
        total +
        Number(pauta.seguidoresFacebook || 0) +
        Number(pauta.seguidoresInstagram || 0) +
        Number(pauta.seguidoresTiktok || 0),
      0,
    );

    return {
      paginas: pautasEnRango.length,
      contenidos: contenidos.length,
      productos: new Set(
        contenidos.map((contenido) => contenido.producto).filter(Boolean),
      ).size,
      seguidores,
    };
  }, [fechaDesde, fechaHasta, pautas]);

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

        <section className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(18rem,1fr)_14rem_11rem_11rem_auto] xl:items-end">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-500">
              Búsqueda global
            </span>
            <span className="relative block">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Página, dispositivo o contenido..."
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </span>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-500">
              Tipo de contenido
            </span>
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

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-500">
              Fecha desde
            </span>
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(event) => {
                const value = event.target.value;
                setFechaDesde(value);
                if (fechaHasta && value && value > fechaHasta) {
                  setFechaHasta(value);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-500">
              Fecha hasta
            </span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(event) => {
                const value = event.target.value;
                setFechaHasta(value);
                if (fechaDesde && value && value < fechaDesde) {
                  setFechaDesde(value);
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              setFechaDesde("");
              setFechaHasta("");
            }}
            disabled={!fechaDesde && !fechaHasta}
            className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={15} aria-hidden="true" />
            Limpiar fechas
          </button>
        </section>

        {loading ? (
          <div className="mt-6 grid snap-x snap-mandatory grid-flow-col auto-cols-[82%] items-start gap-4 overflow-x-auto pb-4 sm:auto-cols-[calc((100%_-_1rem)/2)] lg:auto-cols-[calc((100%_-_3rem)/4)]">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-[25rem] snap-start animate-pulse rounded-2xl border border-slate-200 bg-white"
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
                ? "Prueba con otra búsqueda, tipo de contenido o rango de fechas."
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
          <div className="mt-6 grid snap-x snap-mandatory grid-flow-col auto-cols-[82%] items-start gap-4 overflow-x-auto pb-4 sm:auto-cols-[calc((100%_-_1rem)/2)] lg:auto-cols-[calc((100%_-_3rem)/4)]">
            {pautasFiltradas.map((pauta) => {
              const todosLosContenidos = obtenerContenidos(pauta);
              const contenidos = todosLosContenidos
                .map((contenido, indiceOriginal) => ({
                  ...contenido,
                  indiceOriginal,
                }))
                .filter((contenido) =>
                  contenidoCoincideFecha(
                    contenido,
                    fechaDesde,
                    fechaHasta,
                  ),
                );
              const guardandoContenidoPauta =
                (guardandoContenidoRapido &&
                  contenidoRapido?.pautaId === pauta.id) ||
                (guardandoContenidoEditando &&
                  contenidoEditando?.pautaId === pauta.id) ||
                contenidoEliminando.startsWith(`${pauta.id}-`);

              return (
                <article
                  key={pauta.id}
                  className="group snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
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

                  <div className="p-3.5">
                    <h2 className="break-words text-base font-black leading-tight text-slate-800">
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
                            {fechaDesde || fechaHasta
                              ? `${contenidos.length} de ${todosLosContenidos.length}`
                              : contenidos.length}{" "}
                            {contenidos.length === 1
                              ? "contenido"
                              : "contenidos"}{" "}
                            · Datos opcionales
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => abrirContenidoRapido(pauta)}
                          disabled={
                            guardandoContenidoRapido ||
                            guardandoContenidoEditando ||
                            Boolean(contenidoEliminando) ||
                            contenidoRapido?.pautaId === pauta.id
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Plus size={14} aria-hidden="true" />
                          {contenidoRapido?.pautaId === pauta.id
                            ? "Agregando"
                            : "Agregar"}
                        </button>
                      </div>

                      <div
                        id={`contenidos-pauta-${pauta.id}`}
                        className="max-h-72 space-y-2 overflow-y-auto pr-1"
                      >
                        {contenidos.length === 0 && (
                          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">
                            Sin contenidos en este rango
                          </p>
                        )}
                        {contenidos.map((contenido) => {
                          const editandoEsteContenido =
                            contenidoEditando?.pautaId === pauta.id &&
                            contenidoEditando?.indice ===
                              contenido.indiceOriginal;

                          if (editandoEsteContenido) {
                            return (
                              <FormularioContenidoRapido
                                key={`editar-${pauta.id}-${contenido.indiceOriginal}`}
                                numero={contenido.indiceOriginal + 1}
                                contenido={contenidoEditando}
                                titulo="Editar contenido"
                                guardando={guardandoContenidoEditando}
                                onChange={cambiarContenidoEditando}
                                onGuardar={guardarContenidoEditando}
                                onCancelar={() => setContenidoEditando(null)}
                              />
                            );
                          }

                          return (
                            <div
                            key={`${contenido.producto}-${contenido.tipoContenido}-${contenido.fecha}-${contenido.indiceOriginal}`}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-2.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-emerald-700 shadow-sm">
                                {contenido.indiceOriginal + 1}
                              </span>
                               <div className="min-w-0 flex-1">
                                <p className="break-words text-xs font-bold text-slate-700">
                                  {contenido.producto || "Sin dispositivo"}
                                </p>
                                <p className="truncate text-[10px] text-slate-400">
                                  {contenido.tipoContenido || "Sin tipo"} · {formatearFecha(contenido.fecha)}
                                 </p>
                               </div>
                               <div className="flex shrink-0 gap-1">
                                 <button
                                   type="button"
                                   onClick={() =>
                                     abrirEdicionContenido(pauta, contenido)
                                   }
                                   disabled={
                                     guardandoContenidoRapido ||
                                     guardandoContenidoEditando ||
                                     Boolean(contenidoEliminando)
                                   }
                                   className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm transition hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                                   aria-label={`Editar contenido ${contenido.indiceOriginal + 1}`}
                                   title="Editar contenido"
                                 >
                                   <Pencil size={13} />
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => eliminarContenido(pauta, contenido)}
                                   disabled={
                                     guardandoContenidoRapido ||
                                     guardandoContenidoEditando ||
                                     Boolean(contenidoEliminando)
                                   }
                                   className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                                   aria-label={`Eliminar contenido ${contenido.indiceOriginal + 1}`}
                                   title="Eliminar contenido"
                                 >
                                   <Trash2 size={13} />
                                 </button>
                               </div>
                             </div>

                            <div className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-200 pt-2">
                              <CheckCumplimiento
                                icon={<Facebook size={13} aria-hidden="true" />}
                                red="FB"
                                nombreRed="Facebook"
                                color="text-blue-600"
                                checked={Boolean(contenido.cumplidoFacebook)}
                                disabled={
                                  guardandoContenidoPauta ||
                                  cumplimientosActualizando.some((clave) =>
                                    clave.startsWith(`${pauta.id}-`),
                                  )
                                }
                                onChange={(cumplido) =>
                                  cambiarCumplimiento(
                                    pauta,
                                    contenido.indiceOriginal,
                                    "cumplidoFacebook",
                                    cumplido,
                                  )
                                }
                              />
                              <CheckCumplimiento
                                icon={<Instagram size={13} aria-hidden="true" />}
                                red="IG"
                                nombreRed="Instagram"
                                color="text-fuchsia-600"
                                checked={Boolean(contenido.cumplidoInstagram)}
                                disabled={
                                  guardandoContenidoPauta ||
                                  cumplimientosActualizando.some((clave) =>
                                    clave.startsWith(`${pauta.id}-`),
                                  )
                                }
                                onChange={(cumplido) =>
                                  cambiarCumplimiento(
                                    pauta,
                                    contenido.indiceOriginal,
                                    "cumplidoInstagram",
                                    cumplido,
                                  )
                                }
                              />
                              <CheckCumplimiento
                                icon={<Music2 size={13} aria-hidden="true" />}
                                red="TK"
                                nombreRed="TikTok"
                                color="text-slate-800"
                                checked={Boolean(contenido.cumplidoTiktok)}
                                disabled={
                                  guardandoContenidoPauta ||
                                  cumplimientosActualizando.some((clave) =>
                                    clave.startsWith(`${pauta.id}-`),
                                  )
                                }
                                onChange={(cumplido) =>
                                  cambiarCumplimiento(
                                    pauta,
                                    contenido.indiceOriginal,
                                    "cumplidoTiktok",
                                    cumplido,
                                  )
                                }
                              />
                            </div>
                            </div>
                          );
                        })}
                        {contenidoRapido?.pautaId === pauta.id && (
                          <FormularioContenidoRapido
                            numero={todosLosContenidos.length + 1}
                            contenido={contenidoRapido}
                            guardando={guardandoContenidoRapido}
                            onChange={cambiarContenidoRapido}
                            onGuardar={guardarContenidoRapido}
                            onCancelar={() => setContenidoRapido(null)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && (
          <CalendarioPautas
            pautas={pautasFiltradas}
            onEditar={abrirEdicion}
            onCambiarCumplimiento={cambiarCumplimiento}
            cumplimientosActualizando={cumplimientosActualizando}
            fechaDesde={fechaDesde}
            fechaHasta={fechaHasta}
          />
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
                    Dispositivo/producto, tipo de contenido y fecha son opcionales.
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
                {form.contenidos.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                    No hay contenidos agregados. Puedes guardar la página así o
                    agregar uno cuando lo necesites.
                  </div>
                )}
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
                        Dispositivo / producto <span className="font-normal text-slate-400">(opcional)</span>
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
                        placeholder="Ej. Honor X8D"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-600">
                        Tipo de contenido <span className="font-normal text-slate-400">(opcional)</span>
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
                        placeholder="Video, carrusel, post..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-600">
                        Fecha de pauta <span className="font-normal text-slate-400">(opcional)</span>
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
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => quitarContenido(contenido.clave)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Eliminar contenido ${index + 1}`}
                      title="Eliminar contenido"
                    >
                      <Trash2 size={18} />
                    </button>

                    <fieldset className="lg:col-span-3 lg:col-start-2">
                      <legend className="mb-2 text-xs font-bold text-slate-600">
                        Cumplimiento de este contenido
                      </legend>
                      <div className="grid grid-cols-3 gap-2">
                        <CheckCumplimiento
                          icon={<Facebook size={14} aria-hidden="true" />}
                          red="Facebook"
                          nombreRed="Facebook"
                          color="text-blue-600"
                          checked={contenido.cumplidoFacebook}
                          onChange={(cumplido) =>
                            cambiarContenido(
                              contenido.clave,
                              "cumplidoFacebook",
                              cumplido,
                            )
                          }
                        />
                        <CheckCumplimiento
                          icon={<Instagram size={14} aria-hidden="true" />}
                          red="Instagram"
                          nombreRed="Instagram"
                          color="text-fuchsia-600"
                          checked={contenido.cumplidoInstagram}
                          onChange={(cumplido) =>
                            cambiarContenido(
                              contenido.clave,
                              "cumplidoInstagram",
                              cumplido,
                            )
                          }
                        />
                        <CheckCumplimiento
                          icon={<Music2 size={14} aria-hidden="true" />}
                          red="TikTok"
                          nombreRed="TikTok"
                          color="text-slate-800"
                          checked={contenido.cumplidoTiktok}
                          onChange={(cumplido) =>
                            cambiarContenido(
                              contenido.clave,
                              "cumplidoTiktok",
                              cumplido,
                            )
                          }
                        />
                      </div>
                    </fieldset>
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
