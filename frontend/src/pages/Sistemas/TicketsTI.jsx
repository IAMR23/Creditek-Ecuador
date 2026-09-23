/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import imageCompression from "browser-image-compression";
import Swal from "sweetalert2";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Download,
  FilePlus2,
  GripVertical,
  KanbanSquare,
  ListFilter,
  LoaderCircle,
  MessageSquarePlus,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  TicketCheck,
  UserRound,
  X,
} from "lucide-react";
import { api } from "../../api/client";

const ESTADOS = ["Solicitado", "Construcción", "Pruebas", "Producción"];
const ESTADOS_KANBAN = ESTADOS;
const TIPOS = ["Error", "Mejora", "Nuevo desarrollo", "Soporte", "Reporte"];
const PROYECTOS = [
  "RVE",
  "ABS",
  "GHL",
  "Nómina",
  "Entregas",
  "Ventas",
  "Shortener",
  "Otro",
];
const PRIORIDADES = ["Baja", "Media", "Alta", "Urgente"];
const MAX_ARCHIVOS = 5;
const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024;
const EXTENSION_IMAGEN = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const TRANSICIONES = {
  Solicitado: ["Construcción"],
  Construcción: ["Pruebas"],
  Pruebas: ["Construcción", "Producción"],
  Producción: ["Pruebas", "Construcción"],
};

const COLORES_ESTADO = {
  Solicitado: "border-slate-300 bg-slate-100 text-slate-700",
  Construcción: "border-amber-300 bg-amber-50 text-amber-800",
  Pruebas: "border-violet-300 bg-violet-50 text-violet-700",
  Producción: "border-emerald-300 bg-emerald-50 text-emerald-700",
};
const COLORES_PRIORIDAD = {
  Baja: "bg-slate-100 text-slate-600",
  Media: "bg-blue-100 text-blue-700",
  Alta: "bg-orange-100 text-orange-700",
  Urgente: "bg-red-100 text-red-700",
};

const filtrosIniciales = {
  q: "",
  estado: "",
  tipo: "",
  fechaDesde: "",
  fechaHasta: "",
};
const hoyLocal = () => new Date().toLocaleDateString("en-CA");
const formularioInicial = {
  titulo: "",
  descripcion: "",
  tipo: "Soporte",
  proyecto: "RVE",
  areaSolicitante: "",
  prioridad: "Media",
  fechaInicio: hoyLocal(),
  fechaEstimada: hoyLocal(),
};

const fecha = (value, conHora = false) => {
  if (!value) return "—";
  if (!conHora && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(
    "es-EC",
    conHora
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" },
  );
};
const nombreUsuario = (usuario) =>
  usuario?.nombre || usuario?.email || "Sin asignar";
const errorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

const notificarPegado = (icon, title) =>
  Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    timer: 2200,
    showConfirmButton: false,
  });

const obtenerImagenesPegadas = (clipboardData) =>
  Array.from(clipboardData?.items || [])
    .filter(
      (item) => item.kind === "file" && item.type.startsWith("image/"),
    )
    .map((item, index) => {
      const archivo = item.getAsFile();
      const extension = EXTENSION_IMAGEN[archivo?.type];
      if (!archivo || !extension) return null;

      return new File(
        [archivo],
        `captura-${Date.now()}-${index + 1}.${extension}`,
        {
          type: archivo.type,
          lastModified: Date.now(),
        },
      );
    })
    .filter(Boolean);

const comprimirImagen = async (archivo) => {
  const nombreBase = archivo.name.replace(/\.[^.]+$/, "") || "captura";
  const comprimida = await imageCompression(archivo, {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1280,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.82,
  });

  return new File([comprimida], `${nombreBase}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
};

const prepararArchivos = async (archivos) =>
  Promise.all(
    archivos.map((archivo) =>
      archivo.type.startsWith("image/") ? comprimirImagen(archivo) : archivo,
    ),
  );

const agregarArchivosSeleccionados = async (
  nuevosArchivos,
  archivos,
  setArchivos,
  setProcesandoArchivos,
) => {
  const cuposDisponibles = Math.max(0, MAX_ARCHIVOS - archivos.length);
  if (!cuposDisponibles) {
    notificarPegado("warning", "Puede adjuntar como máximo 5 archivos.");
    return;
  }

  const archivosPermitidos = nuevosArchivos
    .filter((archivo) => archivo.size <= MAX_BYTES_ARCHIVO)
    .slice(0, cuposDisponibles);
  if (!archivosPermitidos.length) {
    notificarPegado("warning", "Cada archivo puede pesar como máximo 10 MB.");
    return;
  }

  setProcesandoArchivos(true);
  try {
    const preparados = await prepararArchivos(archivosPermitidos);
    setArchivos((actuales) => [...actuales, ...preparados]);
  } catch (error) {
    console.error("No se pudo comprimir la imagen del ticket:", error);
    notificarPegado("error", "No se pudo procesar la imagen.");
  } finally {
    setProcesandoArchivos(false);
  }
};

const agregarImagenesPegadas = async (
  event,
  archivos,
  setArchivos,
  setProcesandoArchivos,
) => {
  const itemsImagen = Array.from(event.clipboardData?.items || []).filter(
    (item) => item.kind === "file" && item.type.startsWith("image/"),
  );
  if (!itemsImagen.length) return;

  event.preventDefault();

  const imagenes = obtenerImagenesPegadas(event.clipboardData);
  if (!imagenes.length) {
    notificarPegado("warning", "Pega una imagen JPG, PNG o WEBP.");
    return;
  }

  const imagenesValidas = imagenes.filter((archivo) =>
    archivo.size <= MAX_BYTES_ARCHIVO
  );
  if (!imagenesValidas.length) {
    notificarPegado("warning", "La imagen no puede superar los 10 MB.");
    return;
  }

  const cuposDisponibles = Math.max(0, MAX_ARCHIVOS - archivos.length);
  const imagenesAgregadas = imagenesValidas.slice(0, cuposDisponibles);
  if (!imagenesAgregadas.length) {
    notificarPegado("warning", "Puede adjuntar como máximo 5 archivos.");
    return;
  }

  setProcesandoArchivos(true);
  try {
    const comprimidas = await prepararArchivos(imagenesAgregadas);
    setArchivos((actuales) => [...actuales, ...comprimidas]);
    notificarPegado(
      "success",
      comprimidas.length === 1
        ? "Imagen comprimida y pegada como evidencia."
        : `${comprimidas.length} imágenes comprimidas y pegadas como evidencia.`,
    );
  } catch (error) {
    console.error("No se pudo comprimir la imagen pegada:", error);
    notificarPegado("error", "No se pudo procesar la imagen pegada.");
  } finally {
    setProcesandoArchivos(false);
  }
};
const ETIQUETAS_CAMBIO = {
  estado: "Estado",
  responsableId: "Responsable",
  prioridad: "Prioridad",
  fechaInicio: "Fecha de inicio",
  fechaEstimada: "Fecha estimada",
  fechaFinalizacion: "Fecha real",
  titulo: "Título",
  descripcion: "Descripción",
  tipo: "Tipo",
  proyecto: "Proyecto",
  areaSolicitante: "Área",
  motivoEstado: "Motivo",
};

function Badge({ children, className = "" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function Stat({ label, value, icon: Icon, tone }) {
  const tonos = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    violet: "bg-violet-100 text-violet-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 inline-flex rounded-xl p-2 ${tonos[tone]}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function TicketCard({
  ticket,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
  moviendo = false,
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ticket.id)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      disabled={moviendo}
      className={`w-full rounded-xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-60 ${
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${ticket.retrasado ? "border-red-300" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-bold text-emerald-700">
          {ticket.codigo}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge className={COLORES_PRIORIDAD[ticket.prioridad]}>
            {ticket.prioridad}
          </Badge>
          {draggable && (
            <GripVertical
              size={16}
              className="text-slate-400"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">
        {ticket.titulo}
      </h3>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-500">
        <Badge className="bg-slate-100 text-slate-600">{ticket.proyecto}</Badge>
        {ticket.retrasado && (
          <Badge className="bg-red-100 text-red-700">Retrasado</Badge>
        )}
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <p className="truncate">
          Solicita: {nombreUsuario(ticket.solicitante)}
        </p>
        <p className="truncate">
          <UserRound className="mr-1 inline" size={13} />
          {nombreUsuario(ticket.responsable)}
        </p>
        <p>Inicio: {fecha(ticket.fechaInicio)}</p>
        <p>
          <CalendarClock className="mr-1 inline" size={13} />
          Cierre tentativo: {fecha(ticket.fechaEstimada)}
        </p>
      </div>
    </button>
  );
}

function Filtros({ filtros, setFiltros, onBuscar }) {
  const update = (event) => {
    const { name, value, checked, type } = event.target;
    setFiltros((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onBuscar();
      }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            name="q"
            value={filtros.q}
            onChange={update}
            placeholder="Código, título o descripción"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm"
          />
        </label>
        <select
          name="estado"
          value={filtros.estado}
          onChange={update}
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          name="tipo"
          value={filtros.tipo}
          onChange={update}
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="date"
          name="fechaDesde"
          value={filtros.fechaDesde}
          onChange={update}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="fechaHasta"
          value={filtros.fechaHasta}
          onChange={update}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          <ListFilter size={16} />
          Aplicar filtros
        </button>
        <button
          type="button"
          onClick={() => {
            setFiltros(filtrosIniciales);
            onBuscar(filtrosIniciales);
          }}
          className="text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          Limpiar
        </button>
      </div>
    </form>
  );
}

function ModalImagen({ src, nombre, onClose, onDownload }) {
  useEffect(() => {
    const cerrarConEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vista previa de ${nombre}`}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
            {nombre}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100"
                aria-label={`Descargar ${nombre}`}
              >
                <Download size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-900 p-2 text-white hover:bg-slate-700"
              aria-label="Cerrar vista previa"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="grid min-h-0 place-items-center overflow-auto bg-slate-100 p-3">
          <img
            src={src}
            alt={nombre}
            className="max-h-[82vh] max-w-full object-contain"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ArchivoPendiente({ archivo, onRemove }) {
  const [preview, setPreview] = useState("");
  const [imagenAbierta, setImagenAbierta] = useState(false);

  useEffect(() => {
    if (!archivo.type.startsWith("image/")) {
      setPreview("");
      return undefined;
    }

    const url = URL.createObjectURL(archivo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      {preview ? (
        <button
          type="button"
          onClick={() => setImagenAbierta(true)}
          className="block w-full cursor-zoom-in"
          aria-label={`Ampliar ${archivo.name}`}
        >
          <img
            src={preview}
            alt={`Vista previa de ${archivo.name}`}
            className="h-28 w-full object-cover"
          />
        </button>
      ) : (
        <div className="flex h-28 items-center justify-center text-slate-400">
          <Paperclip size={24} />
        </div>
      )}
      <div className="p-2">
        <p className="truncate text-xs font-semibold" title={archivo.name}>
          {archivo.name}
        </p>
        <p className="text-[11px] text-slate-500">
          {Math.max(1, Math.ceil(archivo.size / 1024))} KB
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded-full bg-slate-950/75 p-1 text-white hover:bg-red-600"
        aria-label={`Quitar ${archivo.name}`}
      >
        <X size={14} />
      </button>
      {imagenAbierta && (
        <ModalImagen
          src={preview}
          nombre={archivo.name}
          onClose={() => setImagenAbierta(false)}
        />
      )}
    </div>
  );
}

function ArchivosPendientes({ archivos, setArchivos }) {
  if (!archivos.length) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {archivos.map((archivo, index) => (
        <ArchivoPendiente
          key={`${archivo.name}-${archivo.lastModified}-${index}`}
          archivo={archivo}
          onRemove={() =>
            setArchivos((actuales) =>
              actuales.filter((_, posicion) => posicion !== index),
            )
          }
        />
      ))}
    </div>
  );
}

function ArchivoAdjuntoTicket({ ticketId, archivo, onDescargar }) {
  const [preview, setPreview] = useState("");
  const [imagenAbierta, setImagenAbierta] = useState(false);
  const esImagen = archivo.mimeType?.startsWith("image/");

  useEffect(() => {
    if (!esImagen) return undefined;

    let activo = true;
    let url = "";

    api
      .get(
        `/api/sistemas/tickets/${ticketId}/archivos/${archivo.id}/descargar`,
        { responseType: "blob" },
      )
      .then((response) => {
        if (!activo) return;
        url = URL.createObjectURL(response.data);
        setPreview(url);
      })
      .catch(() => {
        if (activo) setPreview("");
      });

    return () => {
      activo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [archivo.id, esImagen, ticketId]);

  return (
    <>
      <button
        type="button"
        onClick={() =>
          preview ? setImagenAbierta(true) : onDescargar(archivo)
        }
        className={`flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 ${preview ? "cursor-zoom-in" : ""}`}
      >
        {preview ? (
          <img
            src={preview}
            alt={`Vista previa de ${archivo.nombreOriginal}`}
            className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
          />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-slate-100">
            <Paperclip size={20} className="text-emerald-600" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {archivo.nombreOriginal}
          </span>
          <span className="text-xs text-slate-500">
            {Math.ceil(archivo.tamano / 1024)} KB ·{" "}
            {fecha(archivo.createdAt, true)}
          </span>
        </span>
        <Download size={16} />
      </button>
      {imagenAbierta && (
        <ModalImagen
          src={preview}
          nombre={archivo.nombreOriginal}
          onClose={() => setImagenAbierta(false)}
          onDownload={(event) => {
            event.stopPropagation();
            onDescargar(archivo);
          }}
        />
      )}
    </>
  );
}

function CrearTicket({ onCreated, onCancel }) {
  const [form, setForm] = useState(formularioInicial);
  const [archivos, setArchivos] = useState([]);
  const [procesandoArchivos, setProcesandoArchivos] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const update = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const pegarImagen = (event) =>
    agregarImagenesPegadas(
      event,
      archivos,
      setArchivos,
      setProcesandoArchivos,
    );
  const seleccionarArchivos = (event) => {
    const seleccionados = Array.from(event.target.files || []);
    event.target.value = "";
    return agregarArchivosSeleccionados(
      seleccionados,
      archivos,
      setArchivos,
      setProcesandoArchivos,
    );
  };
  const submit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) =>
        payload.append(key, value),
      );
      archivos.forEach((archivo) => payload.append("archivos", archivo));
      const { data } = await api.post("/api/sistemas/tickets", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await Swal.fire(
        "Ticket creado",
        `${data.ticket.codigo} fue registrado correctamente.`,
        "success",
      );
      onCreated(data.ticket);
    } catch (error) {
      Swal.fire(
        "No se pudo crear",
        errorMessage(error, "Revise los datos e intente nuevamente."),
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      onPaste={pegarImagen}
      className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Nuevo ticket</h2>
          <p className="text-sm text-slate-500">
            El código y el estado Solicitado se asignan automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <X />
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Título *</span>
          <input
            required
            maxLength={180}
            name="titulo"
            value={form.titulo}
            onChange={update}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Descripción *
          </span>
          <textarea
            required
            rows={5}
            name="descripcion"
            value={form.descripcion}
            onChange={update}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">Tipo *</span>
          <select
            name="tipo"
            value={form.tipo}
            onChange={update}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          >
            {TIPOS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">Proyecto *</span>
          <select
            name="proyecto"
            value={form.proyecto}
            onChange={update}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          >
            {PROYECTOS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">
            Área solicitante *
          </span>
          <input
            required
            maxLength={100}
            name="areaSolicitante"
            value={form.areaSolicitante}
            onChange={update}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">
            Prioridad solicitada
          </span>
          <select
            name="prioridad"
            value={form.prioridad}
            onChange={update}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          >
            {PRIORIDADES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">
            Fecha de inicio de la solicitud *
          </span>
          <input
            required
            type="date"
            name="fechaInicio"
            value={form.fechaInicio}
            onChange={update}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-semibold">
            Fecha tentativa de cierre *
          </span>
          <input
            required
            type="date"
            min={form.fechaInicio}
            name="fechaEstimada"
            value={form.fechaEstimada}
            onChange={update}
            className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-semibold">
            Evidencias (máximo 5, 10 MB cada una)
          </span>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.xlsx,.docx"
            onChange={seleccionarArchivos}
            className="w-full rounded-xl border border-dashed border-slate-300 p-4 text-sm"
          />
          <span className="mt-2 block text-xs text-slate-500">
            También puede pegar una captura con Ctrl+V en cualquier parte del
            formulario. Las imágenes se comprimen automáticamente.
          </span>
          {(procesandoArchivos || archivos.length > 0) && (
            <span className="mt-2 block text-xs font-semibold text-emerald-700">
              {procesandoArchivos
                ? "Comprimiendo imagen..."
                : `${archivos.length} archivo(s) listo(s) para adjuntar.`}
            </span>
          )}
          <ArchivosPendientes
            archivos={archivos}
            setArchivos={setArchivos}
          />
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-5 py-2.5 font-semibold"
        >
          Cancelar
        </button>
        <button
          disabled={guardando || procesandoArchivos}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {guardando ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <Plus size={18} />
          )}
          Crear ticket
        </button>
      </div>
    </form>
  );
}

function DetalleTicket({ ticketId, responsables, onClose, onChanged }) {
  const [ticket, setTicket] = useState(null);
  const [puedeGestionar, setPuedeGestionar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [gestion, setGestion] = useState({});
  const [comentario, setComentario] = useState("");
  const [comentarioPruebas, setComentarioPruebas] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [procesandoArchivos, setProcesandoArchivos] = useState(false);

  const pegarImagen = (event) =>
    agregarImagenesPegadas(
      event,
      archivos,
      setArchivos,
      setProcesandoArchivos,
    );
  const seleccionarArchivos = (event) => {
    const seleccionados = Array.from(event.target.files || []);
    event.target.value = "";
    return agregarArchivosSeleccionados(
      seleccionados,
      archivos,
      setArchivos,
      setProcesandoArchivos,
    );
  };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/sistemas/tickets/${ticketId}`);
      setTicket(data.ticket);
      setPuedeGestionar(data.puedeGestionar);
      setGestion({
        titulo: data.ticket.titulo,
        descripcion: data.ticket.descripcion,
        tipo: data.ticket.tipo,
        proyecto: data.ticket.proyecto,
        areaSolicitante: data.ticket.areaSolicitante,
        responsableId: data.ticket.responsableId || "",
        prioridad: data.ticket.prioridad,
        estado: data.ticket.estado,
        fechaInicio: data.ticket.fechaInicio || "",
        fechaEstimada: data.ticket.fechaEstimada || "",
      });
    } catch (error) {
      Swal.fire(
        "No se pudo abrir",
        errorMessage(error, "No se encontró el ticket."),
        "error",
      );
      onClose();
    } finally {
      setLoading(false);
    }
  }, [ticketId, onClose]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarGestion = async () => {
    setGuardando(true);
    try {
      const { data } = await api.patch(
        `/api/sistemas/tickets/${ticketId}`,
        gestion,
      );
      setTicket(data.ticket);
      onChanged();
      Swal.fire(
        "Actualizado",
        "Los cambios y su historial fueron guardados.",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "No se pudo actualizar",
        errorMessage(error, "Intente nuevamente."),
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };
  const comentar = async (e) => {
    e.preventDefault();
    if (!comentario.trim()) return;
    setGuardando(true);
    try {
      const { data } = await api.post(
        `/api/sistemas/tickets/${ticketId}/comentarios`,
        { contenido: comentario, esEvidenciaPruebas: comentarioPruebas },
      );
      setTicket(data.ticket);
      setComentario("");
      setComentarioPruebas(false);
      onChanged();
    } catch (error) {
      Swal.fire(
        "No se pudo comentar",
        errorMessage(error, "Intente nuevamente."),
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };
  const adjuntar = async () => {
    if (!archivos.length || procesandoArchivos) return;
    setGuardando(true);
    try {
      const payload = new FormData();
      archivos.forEach((item) => payload.append("archivos", item));
      const { data } = await api.post(
        `/api/sistemas/tickets/${ticketId}/archivos`,
        payload,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setTicket(data.ticket);
      setArchivos([]);
      onChanged();
    } catch (error) {
      Swal.fire(
        "No se pudo adjuntar",
        errorMessage(error, "Revise el archivo."),
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };
  const descargar = async (archivo) => {
    try {
      const response = await api.get(
        `/api/sistemas/tickets/${ticketId}/archivos/${archivo.id}/descargar`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = archivo.nombreOriginal;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      Swal.fire("No disponible", "No se pudo descargar el archivo.", "error");
    }
  };
  const valorCambio = (campo, value) => {
    if (value === null || value === undefined || value === "")
      return "Sin asignar";
    if (campo === "responsableId") {
      return (
        responsables.find((item) => Number(item.id) === Number(value))
          ?.nombre || `Usuario #${value}`
      );
    }
    if (["fechaInicio", "fechaEstimada", "fechaFinalizacion"].includes(campo)) {
      return fecha(value, campo === "fechaFinalizacion");
    }
    const texto = String(value);
    return texto.length > 80 ? `${texto.slice(0, 80)}…` : texto;
  };

  if (loading)
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
        <LoaderCircle className="animate-spin text-white" size={40} />
      </div>
    );
  if (!ticket) return null;
  const estadosDisponibles = [
    ticket.estado,
    ...(TRANSICIONES[ticket.estado] || []),
  ];
  return (
    <div
      onPaste={pegarImagen}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-2 sm:p-6"
    >
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-emerald-700">
                {ticket.codigo}
              </span>
              <Badge className={COLORES_ESTADO[ticket.estado]}>
                {ticket.estado}
              </Badge>
              <Badge className={COLORES_PRIORIDAD[ticket.prioridad]}>
                {ticket.prioridad}
              </Badge>
              {ticket.retrasado && (
                <Badge className="bg-red-100 text-red-700">Retrasado</Badge>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {ticket.titulo}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X />
          </button>
        </header>
        <div className="grid gap-5 p-4 lg:grid-cols-[1.45fr_1fr] lg:p-6">
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 font-bold">Detalle</h3>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {ticket.descripcion}
              </p>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Tipo / proyecto</dt>
                  <dd className="font-semibold">
                    {ticket.tipo} · {ticket.proyecto}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Área</dt>
                  <dd className="font-semibold">{ticket.areaSolicitante}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Solicitante</dt>
                  <dd className="font-semibold">
                    {nombreUsuario(ticket.solicitante)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Responsable</dt>
                  <dd className="font-semibold">
                    {nombreUsuario(ticket.responsable)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Fecha de inicio</dt>
                  <dd>{fecha(ticket.fechaInicio)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">
                    Cierre tentativo / finalización
                  </dt>
                  <dd>
                    {fecha(ticket.fechaEstimada)} ·{" "}
                    {fecha(ticket.fechaFinalizacion, true)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Registro en sistema</dt>
                  <dd>{fecha(ticket.createdAt, true)}</dd>
                </div>
              </dl>
              {ticket.motivoEstado && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <strong>Motivo:</strong> {ticket.motivoEstado}
                </div>
              )}
            </div>
            {puedeGestionar && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 font-bold">Gestión de Sistemas</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-500">
                      Título
                    </span>
                    <input
                      value={gestion.titulo}
                      onChange={(e) =>
                        setGestion((p) => ({ ...p, titulo: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-500">
                      Descripción
                    </span>
                    <textarea
                      rows={4}
                      value={gestion.descripcion}
                      onChange={(e) =>
                        setGestion((p) => ({
                          ...p,
                          descripcion: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-500">
                      Estado
                    </span>
                    <select
                      value={gestion.estado}
                      onChange={(e) =>
                        setGestion((p) => ({ ...p, estado: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    >
                      {estadosDisponibles.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-500">
                      Responsable
                    </span>
                    <select
                      value={gestion.responsableId}
                      onChange={(e) =>
                        setGestion((p) => ({
                          ...p,
                          responsableId: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    >
                      <option value="">Sin asignar</option>
                      {responsables.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-500">
                      Prioridad
                    </span>
                    <select
                      value={gestion.prioridad}
                      onChange={(e) =>
                        setGestion((p) => ({ ...p, prioridad: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    >
                      {PRIORIDADES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-500">
                      Fecha de inicio
                    </span>
                    <input
                      type="date"
                      value={gestion.fechaInicio}
                      onChange={(e) =>
                        setGestion((p) => ({
                          ...p,
                          fechaInicio: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-500">
                      Fecha tentativa de cierre
                    </span>
                    <input
                      type="date"
                      min={gestion.fechaInicio}
                      value={gestion.fechaEstimada}
                      onChange={(e) =>
                        setGestion((p) => ({
                          ...p,
                          fechaEstimada: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-500">
                      Tipo
                    </span>
                    <select
                      value={gestion.tipo}
                      onChange={(e) =>
                        setGestion((p) => ({ ...p, tipo: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    >
                      {TIPOS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-semibold text-slate-500">
                      Proyecto
                    </span>
                    <select
                      value={gestion.proyecto}
                      onChange={(e) =>
                        setGestion((p) => ({ ...p, proyecto: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    >
                      {PROYECTOS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="sm:col-span-2">
                    <span className="text-xs font-semibold text-slate-500">
                      Área solicitante
                    </span>
                    <input
                      value={gestion.areaSolicitante}
                      onChange={(e) =>
                        setGestion((p) => ({
                          ...p,
                          areaSolicitante: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </label>
                </div>
                <button
                  onClick={guardarGestion}
                  disabled={guardando}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white disabled:opacity-60"
                >
                  <Save size={17} />
                  Guardar gestión
                </button>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 font-bold">Comentarios</h3>
              <div className="space-y-3">
                {ticket.comentarios?.length ? (
                  ticket.comentarios.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                        <strong className="text-slate-700">
                          {nombreUsuario(item.usuario)}
                        </strong>
                        <span>{fecha(item.createdAt, true)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">
                        {item.contenido}
                      </p>
                      {item.esEvidenciaPruebas && (
                        <Badge className="mt-2 bg-violet-100 text-violet-700">
                          Evidencia de pruebas
                        </Badge>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Aún no hay comentarios.
                  </p>
                )}
              </div>
              <form
                onSubmit={comentar}
                className="mt-4 border-t border-slate-200 pt-4"
              >
                <textarea
                  required
                  rows={3}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Agregar comentario..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={comentarioPruebas}
                      onChange={(e) => setComentarioPruebas(e.target.checked)}
                    />
                    Marcar como evidencia de pruebas
                  </label>
                  <button
                    disabled={guardando}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    <MessageSquarePlus size={16} />
                    Comentar
                  </button>
                </div>
              </form>
            </div>
          </section>
          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 font-bold">Evidencias y archivos</h3>
              <div className="space-y-2">
                {ticket.archivos?.map((item) => (
                  <ArchivoAdjuntoTicket
                    key={item.id}
                    ticketId={ticketId}
                    archivo={item}
                    onDescargar={descargar}
                  />
                ))}
              </div>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.xlsx,.docx"
                onChange={seleccionarArchivos}
                className="mt-4 w-full text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                Pegue una captura con Ctrl+V dentro del ticket. Las imágenes se
                comprimen automáticamente.
              </p>
              {(procesandoArchivos || archivos.length > 0) && (
                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  {procesandoArchivos
                    ? "Comprimiendo imagen..."
                    : `${archivos.length} archivo(s) listo(s) para adjuntar.`}
                </p>
              )}
              <ArchivosPendientes
                archivos={archivos}
                setArchivos={setArchivos}
              />
              <button
                onClick={adjuntar}
                disabled={
                  !archivos.length || guardando || procesandoArchivos
                }
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-40"
              >
                <FilePlus2 size={16} />
                Adjuntar
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 font-bold">Historial</h3>
              <div className="space-y-4 border-l-2 border-slate-200 pl-4">
                {ticket.historial?.map((item) => (
                  <article key={item.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <p className="text-sm font-semibold">
                      {item.accion.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {nombreUsuario(item.usuario)} ·{" "}
                      {fecha(item.createdAt, true)}
                    </p>
                    {Object.entries(item.cambios || {})
                      .filter(
                        ([, cambio]) =>
                          cambio &&
                          typeof cambio === "object" &&
                          "anterior" in cambio &&
                          "nuevo" in cambio,
                      )
                      .map(([campo, cambio]) => (
                        <p key={campo} className="mt-1 text-xs text-slate-600">
                          <strong>{ETIQUETAS_CAMBIO[campo] || campo}:</strong>{" "}
                          {valorCambio(campo, cambio.anterior)} →{" "}
                          {valorCambio(campo, cambio.nuevo)}
                        </p>
                      ))}
                  </article>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
              <p>Última modificación</p>
              <p className="mt-1 font-semibold text-slate-700">
                {nombreUsuario(ticket.ultimaModificacionUsuario)}
              </p>
              <p>{fecha(ticket.updatedAt, true)}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function TicketsTI({
  soloSeguimiento = false,
  integrado = false,
}) {
  const [vista, setVista] = useState("kanban");
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciales);
  const [dashboard, setDashboard] = useState({
    total: 0,
    abiertos: 0,
    retrasados: 0,
    produccionMesActual: 0,
    porEstado: {},
    puedeGestionar: false,
  });
  const [columnas, setColumnas] = useState({});
  const [tickets, setTickets] = useState([]);
  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    totalPaginas: 1,
    total: 0,
  });
  const [responsables, setResponsables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalleId, setDetalleId] = useState(null);
  const [revision, setRevision] = useState(0);
  const [ticketArrastrado, setTicketArrastrado] = useState(null);
  const [estadoSobre, setEstadoSobre] = useState(null);
  const [ticketMoviendoId, setTicketMoviendoId] = useState(null);

  const params = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(filtrosAplicados).filter(
          ([, value]) => value !== "" && value !== false,
        ),
      ),
    [filtrosAplicados],
  );
  const cargar = useCallback(async () => {
    if (vista === "nuevo") return;
    setLoading(true);
    try {
      const peticionVista =
        vista === "kanban"
          ? api.get("/api/sistemas/tickets/kanban", { params })
          : api.get("/api/sistemas/tickets", {
              params: { ...params, pagina: paginacion.pagina, limite: 20 },
            });
      const [dash, dataVista] = await Promise.all([
        api.get("/api/sistemas/tickets/dashboard"),
        peticionVista,
      ]);
      setDashboard(dash.data);
      if (vista === "kanban") setColumnas(dataVista.data.columnas || {});
      else {
        setTickets(dataVista.data.tickets || []);
        setPaginacion(dataVista.data.paginacion);
      }
    } catch (error) {
      Swal.fire(
        "No se pudieron cargar los tickets",
        errorMessage(error, "Intente nuevamente."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [vista, params, paginacion.pagina]);
  useEffect(() => {
    cargar();
  }, [cargar, revision]);
  useEffect(() => {
    if (!dashboard.puedeGestionar) return;
    api
      .get("/api/sistemas/tickets/responsables")
      .then(({ data }) => {
        setResponsables(data.responsables || []);
      })
      .catch(() => {
        setResponsables([]);
      });
  }, [dashboard.puedeGestionar]);

  const refrescar = () => setRevision((value) => value + 1);
  const aplicarFiltros = (valores = filtros) => {
    setPaginacion((p) => ({ ...p, pagina: 1 }));
    setFiltrosAplicados({ ...valores });
  };

  const limpiarArrastre = () => {
    setTicketArrastrado(null);
    setEstadoSobre(null);
  };

  const iniciarArrastre = (event, ticket) => {
    if (!dashboard.puedeGestionar || ticketMoviendoId) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(ticket.id));
    setTicketArrastrado({ id: ticket.id, estado: ticket.estado });
  };

  const moverTicket = async (estadoDestino) => {
    const ticket = ticketArrastrado;
    limpiarArrastre();

    if (!ticket || ticket.estado === estadoDestino) return;

    if (!(TRANSICIONES[ticket.estado] || []).includes(estadoDestino)) {
      await Swal.fire(
        "Movimiento no permitido",
        `No se permite pasar de ${ticket.estado} a ${estadoDestino}.`,
        "warning",
      );
      return;
    }

    setTicketMoviendoId(ticket.id);
    try {
      const { data } = await api.patch(`/api/sistemas/tickets/${ticket.id}`, {
        estado: estadoDestino,
      });
      const ticketActualizado = data.ticket;

      setColumnas((actuales) => {
        const siguientes = Object.fromEntries(
          ESTADOS_KANBAN.map((estado) => [
            estado,
            (actuales[estado] || []).filter((item) => item.id !== ticket.id),
          ]),
        );
        siguientes[estadoDestino] = [
          ticketActualizado,
          ...(siguientes[estadoDestino] || []),
        ];
        return siguientes;
      });
      setDashboard((actual) => ({
        ...actual,
        porEstado: {
          ...actual.porEstado,
          [ticket.estado]: Math.max(
            0,
            Number(actual.porEstado?.[ticket.estado] || 0) - 1,
          ),
          [estadoDestino]: Number(actual.porEstado?.[estadoDestino] || 0) + 1,
        },
      }));

      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: `${ticketActualizado.codigo} pasó a ${estadoDestino}.`,
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo mover el ticket",
        errorMessage(error, "Revise la transición e intente nuevamente."),
        "error",
      );
    } finally {
      setTicketMoviendoId(null);
    }
  };

  return (
    <div
      className={
        integrado
          ? "text-slate-900"
          : "min-h-full bg-slate-100 p-3 text-slate-900 sm:p-6"
      }
    >
      <div className="mx-auto max-w-[1700px]">
        {!integrado && (
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-emerald-600 p-3 text-white">
                  <TicketCheck size={26} />
                </span>
                <div>
                  <h1 className="text-2xl font-bold">
                    {soloSeguimiento
                      ? "Seguimiento de Tickets"
                      : "Tickets de TI"}
                  </h1>
                  <p className="text-sm text-slate-500">
                    {soloSeguimiento
                      ? "Consulta el estado y avance de tus solicitudes"
                      : "Solicitudes, seguimiento y trazabilidad de Sistemas"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={refrescar}
                className="rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600"
              >
                <RefreshCw size={19} />
              </button>
              {!soloSeguimiento && (
                <button
                  onClick={() => setVista("nuevo")}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
          </header>
        )}
        {integrado && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Seguimiento de Tickets</h2>
              <p className="text-sm text-slate-500">
                Consulta el estado y avance de tus solicitudes.
              </p>
            </div>
            <button
              type="button"
              onClick={refrescar}
              className="rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600"
              aria-label="Actualizar tickets"
            >
              <RefreshCw size={19} />
            </button>
          </div>
        )}
        <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Tickets abiertos"
            value={dashboard.abiertos || 0}
            icon={Clock3}
            tone="blue"
          />
          <Stat
            label="Solicitados"
            value={dashboard.porEstado?.Solicitado || 0}
            icon={CircleDot}
            tone="slate"
          />
          <Stat
            label="Construcción"
            value={dashboard.porEstado?.Construcción || 0}
            icon={Clock3}
            tone="blue"
          />
          <Stat
            label="Pruebas"
            value={dashboard.porEstado?.Pruebas || 0}
            icon={CheckCircle2}
            tone="violet"
          />
          <Stat
            label="Atrasados"
            value={dashboard.retrasados || 0}
            icon={AlertTriangle}
            tone="red"
          />
          <Stat
            label="Producción este mes"
            value={dashboard.produccionMesActual || 0}
            icon={CheckCircle2}
            tone="green"
          />
        </div>
        {vista === "nuevo" ? (
          <CrearTicket
            onCancel={() => setVista("kanban")}
            onCreated={(ticket) => {
              setVista("kanban");
              setDetalleId(ticket.id);
              refrescar();
            }}
          />
        ) : (
          <>
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setVista("kanban")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${vista === "kanban" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
              >
                <KanbanSquare size={17} />
                Kanban
              </button>
              <button
                onClick={() => setVista("lista")}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${vista === "lista" ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}
              >
                <ListFilter size={17} />
                Lista
              </button>
            </div>
            <Filtros
              filtros={filtros}
              setFiltros={setFiltros}
              onBuscar={aplicarFiltros}
            />
            {loading ? (
              <div className="grid min-h-64 place-items-center">
                <LoaderCircle
                  className="animate-spin text-emerald-600"
                  size={38}
                />
              </div>
            ) : vista === "kanban" ? (
              <div className="mt-5">
                {dashboard.puedeGestionar && (
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
                    <GripVertical size={16} />
                    Arrastra cada solicitud a la siguiente etapa para actualizar
                    su estado.
                  </p>
                )}
                <div className="overflow-x-auto pb-4">
                  <div className="grid min-w-[1200px] grid-cols-4 gap-4">
                    {ESTADOS_KANBAN.map((estado) => {
                      const esDestinoActivo = estadoSobre === estado;
                      const puedeRecibir = Boolean(
                        ticketArrastrado &&
                        (TRANSICIONES[ticketArrastrado.estado] || []).includes(
                          estado,
                        ),
                      );

                      return (
                        <section
                          key={estado}
                          onDragEnter={() => {
                            if (ticketArrastrado) setEstadoSobre(estado);
                          }}
                          onDragOver={(event) => {
                            if (!ticketArrastrado) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = puedeRecibir
                              ? "move"
                              : "none";
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            moverTicket(estado);
                          }}
                          className={`rounded-2xl border-2 p-3 transition-colors ${
                            esDestinoActivo && puedeRecibir
                              ? "border-emerald-400 bg-emerald-50"
                              : esDestinoActivo
                                ? "border-red-300 bg-red-50/70"
                                : "border-transparent bg-slate-200/60"
                          }`}
                        >
                          <header className="mb-3 flex items-center justify-between">
                            <Badge className={COLORES_ESTADO[estado]}>
                              {estado}
                            </Badge>
                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500">
                              {dashboard.porEstado?.[estado] || 0}
                            </span>
                          </header>
                          <div className="min-h-28 space-y-3">
                            {columnas[estado]?.map((ticket) => (
                              <TicketCard
                                key={ticket.id}
                                ticket={ticket}
                                onOpen={setDetalleId}
                                draggable={dashboard.puedeGestionar}
                                moviendo={ticketMoviendoId === ticket.id}
                                onDragStart={(event) =>
                                  iniciarArrastre(event, ticket)
                                }
                                onDragEnd={limpiarArrastre}
                              />
                            ))}
                            {!columnas[estado]?.length && (
                              <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-400">
                                {esDestinoActivo && puedeRecibir
                                  ? "Suelta aquí para cambiar el estado"
                                  : "Sin tickets"}
                              </p>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        {[
                          "Código",
                          "Título",
                          "Tipo",
                          "Proyecto",
                          "Solicitante",
                          "Responsable",
                          "Prioridad",
                          "Estado",
                          "Inicio",
                          "Cierre tentativo",
                        ].map((label) => (
                          <th key={label} className="px-4 py-3">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          onClick={() => setDetalleId(ticket.id)}
                          className={`cursor-pointer hover:bg-slate-50 ${ticket.retrasado ? "bg-red-50/40" : ""}`}
                        >
                          <td className="px-4 py-3 font-mono font-bold text-emerald-700">
                            {ticket.codigo}
                          </td>
                          <td className="max-w-xs px-4 py-3 font-semibold">
                            {ticket.titulo}
                          </td>
                          <td className="px-4 py-3">{ticket.tipo}</td>
                          <td className="px-4 py-3">{ticket.proyecto}</td>
                          <td className="px-4 py-3">
                            {nombreUsuario(ticket.solicitante)}
                          </td>
                          <td className="px-4 py-3">
                            {nombreUsuario(ticket.responsable)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={COLORES_PRIORIDAD[ticket.prioridad]}
                            >
                              {ticket.prioridad}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={COLORES_ESTADO[ticket.estado]}>
                              {ticket.estado}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {fecha(ticket.fechaInicio)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {fecha(ticket.fechaEstimada)}
                            {ticket.retrasado && (
                              <AlertTriangle
                                className="ml-1 inline text-red-500"
                                size={15}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!tickets.length && (
                  <p className="p-10 text-center text-slate-500">
                    No se encontraron tickets.
                  </p>
                )}
                <footer className="flex items-center justify-between border-t border-slate-200 p-4 text-sm">
                  <span>{paginacion.total || 0} tickets</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={paginacion.pagina <= 1}
                      onClick={() =>
                        setPaginacion((p) => ({ ...p, pagina: p.pagina - 1 }))
                      }
                      className="rounded-lg border p-2 disabled:opacity-30"
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <span>
                      Página {paginacion.pagina} de {paginacion.totalPaginas}
                    </span>
                    <button
                      disabled={paginacion.pagina >= paginacion.totalPaginas}
                      onClick={() =>
                        setPaginacion((p) => ({ ...p, pagina: p.pagina + 1 }))
                      }
                      className="rounded-lg border p-2 disabled:opacity-30"
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </footer>
              </div>
            )}
          </>
        )}
      </div>
      {detalleId && (
        <DetalleTicket
          ticketId={detalleId}
          responsables={responsables}
          onClose={() => setDetalleId(null)}
          onChanged={refrescar}
        />
      )}
    </div>
  );
}
