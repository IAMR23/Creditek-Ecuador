import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ClipboardPaste,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  ImageUp,
  Pencil,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const API_BASE = "/api/gerencia/facturas";
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PROCESSED_IMAGE_BYTES = 600 * 1024;
const DEPARTAMENTOS = ["LOGISTICA", "COMERCIAL", "SISTEMAS"];
const TIPOS_DOCUMENTO_FOTO = ["Factura", "Nota de Venta", "Otros"];
const crearFiltrosIniciales = () => ({
    busqueda: "",
    estado: "",
    tipo: "",
    formaPago: "",
    departamento: "",
    fechaInicio: "",
    fechaFin: "",
});
const edicionInicial = {
  fechaFactura: "",
  proveedor: "",
  identificacionProveedor: "",
  numeroFactura: "",
  subtotal: "",
  iva: "",
  total: "",
  formaPago: "",
  estado: "",
  observaciones: "",
  tipo: "",
  departamento: "LOGISTICA",
};

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatoMonto = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? money.format(number) : "-";
};

const formatoFecha = (value, includeTime = false) => {
  if (!value) return "";
  const date = new Date(
    String(value).length === 10 ? `${value}T12:00:00` : value,
  );
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-EC", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
};

const descargarPlantilla = () => {
  const plantilla = [
    {
      "Fecha de factura": "2026-10-19",
      Proveedor: "EMPRESA EJEMPLO CIA. LTDA.",
      "RUC / Cédula": "1790000000001",
      "N.º de factura": "001-001-000000001",
      Subtotal: 100,
      IVA: 15,
      Total: 115,
      "Forma de pago": "Transferencia",
      Estado: "Pagada",
      "Enlace a la foto": "https://example.com/factura.jpg",
      Observaciones: "Factura cargada desde la plantilla",
      TIPO: "Compra",
      Departamento: "LOGISTICA",
    },
  ];
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(plantilla, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "plantilla_facturas.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

const mensajeError = (error) =>
  error.response?.data?.message || error.message || "Ocurrió un error inesperado.";

const resolverEnlaceFoto = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const base = String(api.defaults.baseURL || "").replace(/\/$/, "");
  const path = String(value).startsWith("/") ? value : `/${value}`;
  return `${base}${path}`;
};

const cargarImagenDesdeBlob = (blob) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("No se pudo preparar la imagen para girarla."));
  };
  image.src = objectUrl;
});

const convertirCanvasABlob = (canvas) => new Promise((resolve, reject) => {
  canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("No se pudo guardar la imagen girada.")),
    "image/webp",
    0.9,
  );
});

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [resumen, setResumen] = useState({ cantidad: 0, subtotal: 0, iva: 0, total: 0 });
  const [catalogos, setCatalogos] = useState({ estados: [], tipos: [], formasPago: [], departamentos: DEPARTAMENTOS });
  const [paginacion, setPaginacion] = useState({ page: 1, limit: 25, totalPaginas: 1 });
  const [filtros, setFiltros] = useState(crearFiltrosIniciales);
  const [filtrosAplicados, setFiltrosAplicados] = useState(crearFiltrosIniciales);
  const [loading, setLoading] = useState(true);
  const [modalCarga, setModalCarga] = useState(false);
  const [modoCarga, setModoCarga] = useState("archivo");
  const [archivo, setArchivo] = useState(null);
  const [archivoExcel, setArchivoExcel] = useState(null);
  const [contenidoJson, setContenidoJson] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [fotoSubiendoId, setFotoSubiendoId] = useState(null);
  const [fotoFactura, setFotoFactura] = useState(null);
  const [modoFoto, setModoFoto] = useState("archivo");
  const [fotoArchivo, setFotoArchivo] = useState(null);
  const [tipoDocumentoFoto, setTipoDocumentoFoto] = useState("");
  const [fotoVista, setFotoVista] = useState(null);
  const [zoomFoto, setZoomFoto] = useState(1);
  const [rotacionFoto, setRotacionFoto] = useState(0);
  const [guardandoRotacion, setGuardandoRotacion] = useState(false);
  const [facturaEditando, setFacturaEditando] = useState(null);
  const [edicion, setEdicion] = useState(edicionInicial);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  const fotoPreview = useMemo(
    () => (fotoArchivo ? URL.createObjectURL(fotoArchivo) : ""),
    [fotoArchivo],
  );

  useEffect(() => () => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
  }, [fotoPreview]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFiltrosAplicados(filtros);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [filtros]);

  const cargar = useCallback(async ({ page = 1, silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(API_BASE, {
        params: { ...filtrosAplicados, page, limit: paginacion.limit },
      });
      setFacturas(data.facturas || []);
      setResumen(data.resumen || { cantidad: 0, subtotal: 0, iva: 0, total: 0 });
      setCatalogos({
        estados: [],
        tipos: [],
        formasPago: [],
        departamentos: DEPARTAMENTOS,
        ...(data.catalogos || {}),
      });
      setPaginacion((current) => ({ ...current, ...(data.paginacion || {}) }));
    } catch (error) {
      await Swal.fire("No se pudieron cargar las facturas", mensajeError(error), "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filtrosAplicados, paginacion.limit]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const limpiarFiltros = () => {
    const filtrosDefault = crearFiltrosIniciales();
    setFiltros(filtrosDefault);
    setFiltrosAplicados(filtrosDefault);
  };

  const subirArchivo = async () => {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      const { data } = await api.post(`${API_BASE}/carga-json`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setModalCarga(false);
      setArchivo(null);
      const filtrosDefault = crearFiltrosIniciales();
      setFiltros(filtrosDefault);
      setFiltrosAplicados(filtrosDefault);
      await Swal.fire({
        title: "Carga completada",
        text: data.message,
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });
      await cargar({ page: 1, silent: true });
    } catch (error) {
      await Swal.fire("No se pudo cargar el JSON", mensajeError(error), "error");
    } finally {
      setSubiendo(false);
    }
  };

  const procesarContenidoJson = async () => {
    const contenido = contenidoJson.trim();
    if (!contenido) return;

    try {
      JSON.parse(contenido);
    } catch {
      await Swal.fire(
        "JSON inválido",
        "Corrige la estructura del contenido antes de procesarlo.",
        "error",
      );
      return;
    }

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("contenido", contenido);
      const { data } = await api.post(`${API_BASE}/carga-json-texto`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setModalCarga(false);
      setContenidoJson("");
      const filtrosDefault = crearFiltrosIniciales();
      setFiltros(filtrosDefault);
      setFiltrosAplicados(filtrosDefault);
      await Swal.fire({
        title: "Contenido procesado",
        text: data.message,
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });
      await cargar({ page: 1, silent: true });
    } catch (error) {
      await Swal.fire("No se pudo procesar el JSON", mensajeError(error), "error");
    } finally {
      setSubiendo(false);
    }
  };

  const subirExcel = async () => {
    if (!archivoExcel) return;
    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoExcel);
      const { data } = await api.post(`${API_BASE}/carga-excel`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setModalCarga(false);
      setArchivoExcel(null);
      const filtrosDefault = crearFiltrosIniciales();
      setFiltros(filtrosDefault);
      setFiltrosAplicados(filtrosDefault);
      await Swal.fire({
        title: "Excel procesado",
        text: data.message,
        icon: "success",
        timer: 2200,
        showConfirmButton: false,
      });
      await cargar({ page: 1, silent: true });
    } catch (error) {
      await Swal.fire("No se pudo procesar el Excel", mensajeError(error), "error");
    } finally {
      setSubiendo(false);
    }
  };

  const cargarFotoFactura = async (facturaId, file) => {
    if (!tipoDocumentoFoto) {
      await Swal.fire(
        "Selecciona el tipo de documento",
        "Indica si la foto corresponde a una factura, nota de venta u otro documento.",
        "warning",
      );
      return;
    }
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      await Swal.fire("Formato no válido", "Selecciona una imagen JPG, PNG o WEBP.", "info");
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      await Swal.fire("Imagen muy grande", "La imagen original no puede superar los 10 MB.", "info");
      return;
    }

    setFotoSubiendoId(facturaId);
    try {
      const processed = await imageCompression(file, {
        maxSizeMB: 0.55,
        useWebWorker: true,
        initialQuality: 0.9,
        fileType: "image/webp",
        alwaysKeepResolution: true,
      });
      if (processed.size > MAX_PROCESSED_IMAGE_BYTES) {
        throw new Error("No se pudo reducir la imagen por debajo de 600 KB.");
      }

      const lightweightFile = new File(
        [processed],
        `factura-${facturaId}.webp`,
        { type: "image/webp" },
      );
      const formData = new FormData();
      formData.append("foto", lightweightFile);
      formData.append("tipo", tipoDocumentoFoto);
      const { data } = await api.post(`${API_BASE}/${facturaId}/foto`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFacturas((current) =>
        current.map((factura) =>
          factura.id === facturaId ? { ...factura, ...data.factura } : factura,
        ),
      );
      setFotoFactura(null);
      setFotoArchivo(null);
      setTipoDocumentoFoto("");
      await Swal.fire({
        title: "Foto guardada",
        text: `Imagen optimizada a ${(lightweightFile.size / 1024).toFixed(0)} KB.`,
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire("No se pudo cargar la foto", mensajeError(error), "error");
    } finally {
      setFotoSubiendoId(null);
    }
  };

  const abrirFoto = (factura) => {
    setFotoFactura(factura);
    setModoFoto("archivo");
    setFotoArchivo(null);
    setTipoDocumentoFoto("");
  };

  const verFoto = async (factura) => {
    setZoomFoto(1);
    setRotacionFoto(0);
    setFotoVista({
      id: factura.id,
      tipo: factura.tipo,
      enlaceFoto: factura.enlaceFoto,
      url: resolverEnlaceFoto(factura.enlaceFoto),
      titulo: factura.numeroFactura ? `Factura ${factura.numeroFactura}` : `Factura #${factura.id}`,
    });
    if (factura.revisada) return;
    try {
      const { data } = await api.patch(`${API_BASE}/${factura.id}/revisada`);
      setFacturas((current) => current.map((item) =>
        item.id === factura.id ? { ...item, ...data.factura } : item));
    } catch (error) {
      await Swal.fire("No se pudo marcar como revisada", mensajeError(error), "warning");
    }
  };

  const cerrarVistaFoto = () => {
    if (guardandoRotacion) return;
    setFotoVista(null);
    setZoomFoto(1);
    setRotacionFoto(0);
  };

  const cambiarZoomFoto = (incremento) => {
    setZoomFoto((actual) => Math.min(3, Math.max(0.5, actual + incremento)));
  };

  const guardarRotacionFoto = async () => {
    const giro = ((rotacionFoto % 360) + 360) % 360;
    if (!fotoVista || giro === 0 || guardandoRotacion) return;

    let tipoDocumento = TIPOS_DOCUMENTO_FOTO.includes(fotoVista.tipo)
      ? fotoVista.tipo
      : "";
    if (!tipoDocumento) {
      const seleccion = await Swal.fire({
        title: "Selecciona el tipo de documento",
        text: "Es obligatorio para guardar la foto girada.",
        input: "select",
        inputOptions: Object.fromEntries(TIPOS_DOCUMENTO_FOTO.map((tipo) => [tipo, tipo])),
        inputPlaceholder: "Selecciona una opción",
        showCancelButton: true,
        confirmButtonText: "Continuar",
        cancelButtonText: "Cancelar",
        inputValidator: (value) => value ? undefined : "Selecciona el tipo de documento.",
      });
      if (!seleccion.isConfirmed) return;
      tipoDocumento = seleccion.value;
    }

    setGuardandoRotacion(true);
    try {
      let imagenBlob;
      if (String(fotoVista.enlaceFoto || "").startsWith("/uploads/facturas/")) {
        const response = await api.get(fotoVista.enlaceFoto, { responseType: "blob" });
        imagenBlob = response.data;
      } else {
        const response = await fetch(fotoVista.url, { credentials: "omit" });
        if (!response.ok) throw new Error("No se pudo descargar la imagen para girarla.");
        imagenBlob = await response.blob();
      }
      const image = await cargarImagenDesdeBlob(imagenBlob);
      const intercambiarDimensiones = giro === 90 || giro === 270;
      const canvas = document.createElement("canvas");
      canvas.width = intercambiarDimensiones ? image.naturalHeight : image.naturalWidth;
      canvas.height = intercambiarDimensiones ? image.naturalWidth : image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("El navegador no permite procesar esta imagen.");

      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((giro * Math.PI) / 180);
      context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

      const blobGirado = await convertirCanvasABlob(canvas);
      const archivoGirado = new File(
        [blobGirado],
        `factura-${fotoVista.id}-girada.webp`,
        { type: "image/webp" },
      );
      const archivoOptimizado = await imageCompression(archivoGirado, {
        maxSizeMB: 0.55,
        useWebWorker: true,
        initialQuality: 0.9,
        fileType: "image/webp",
        alwaysKeepResolution: true,
      });
      if (archivoOptimizado.size > MAX_PROCESSED_IMAGE_BYTES) {
        throw new Error("No se pudo reducir la imagen girada por debajo de 600 KB.");
      }

      const formData = new FormData();
      formData.append("foto", new File(
        [archivoOptimizado],
        `factura-${fotoVista.id}-girada.webp`,
        { type: "image/webp" },
      ));
      formData.append("tipo", tipoDocumento);
      const { data } = await api.post(`${API_BASE}/${fotoVista.id}/foto`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setFacturas((actuales) => actuales.map((factura) =>
        factura.id === fotoVista.id ? { ...factura, ...data.factura } : factura));
      setFotoVista((actual) => ({
        ...actual,
        tipo: data.factura.tipo,
        enlaceFoto: data.factura.enlaceFoto,
        url: resolverEnlaceFoto(data.factura.enlaceFoto),
      }));
      setRotacionFoto(0);
      setZoomFoto(1);
      await Swal.fire({
        title: "Giro guardado",
        text: "La foto conservará esta orientación.",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire("No se pudo guardar el giro", mensajeError(error), "error");
    } finally {
      setGuardandoRotacion(false);
    }
  };

  const cerrarFoto = () => {
    if (fotoSubiendoId !== null) return;
    setFotoFactura(null);
    setFotoArchivo(null);
    setTipoDocumentoFoto("");
  };

  const recibirImagenPegada = (event) => {
    const itemImagen = Array.from(event.clipboardData?.items || [])
      .find((item) => item.kind === "file" && item.type.startsWith("image/"));
    const file = itemImagen?.getAsFile();
    if (!file) return;
    event.preventDefault();
    setFotoArchivo(file);
  };

  const abrirModal = () => {
    setModoCarga("archivo");
    setArchivo(null);
    setArchivoExcel(null);
    setContenidoJson("");
    setModalCarga(true);
  };

  const abrirEdicion = (factura) => {
    setFacturaEditando(factura);
    setEdicion({
      fechaFactura: factura.fechaFactura || "",
      proveedor: factura.proveedor || "",
      identificacionProveedor: factura.identificacionProveedor || "",
      numeroFactura: factura.numeroFactura || "",
      subtotal: factura.subtotal ?? "",
      iva: factura.iva ?? "",
      total: factura.total ?? "",
      formaPago: factura.formaPago || "",
      estado: factura.estado || "",
      observaciones: factura.observaciones || "",
      tipo: factura.tipo || "",
      departamento: factura.departamento || "LOGISTICA",
    });
  };

  const cerrarEdicion = () => {
    if (guardandoEdicion) return;
    setFacturaEditando(null);
    setEdicion(edicionInicial);
  };

  const actualizarCampoEdicion = (campo, value) => {
    setEdicion((current) => ({ ...current, [campo]: value }));
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    if (!facturaEditando || guardandoEdicion) return;

    setGuardandoEdicion(true);
    try {
      const { data } = await api.patch(`${API_BASE}/${facturaEditando.id}`, edicion);
      setFacturaEditando(null);
      setEdicion(edicionInicial);
      await cargar({ page: paginacion.page, silent: true });
      await Swal.fire({
        title: "Factura actualizada",
        text: data.message,
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire("No se pudo actualizar la factura", mensajeError(error), "error");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const eliminarRegistro = async (factura) => {
    const confirmacion = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Estos registros, una vez eliminados, ya no se pueden recuperar.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });
    if (!confirmacion.isConfirmed) return;

    setEliminandoId(factura.id);
    try {
      const { data } = await api.delete(`${API_BASE}/${factura.id}`);
      const paginaDestino = facturas.length === 1 && paginacion.page > 1
        ? paginacion.page - 1
        : paginacion.page;
      await cargar({ page: paginaDestino, silent: true });
      await Swal.fire({
        title: "Registro eliminado",
        text: data.message,
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      await Swal.fire("No se pudo eliminar el registro", mensajeError(error), "error");
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-5">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-teal-100 p-2 text-teal-700">
              <ReceiptText size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-950">Facturas</h1>
              <p className="mt-1 text-xs text-slate-500">
                Registro consolidado de facturas cargadas mediante archivos JSON.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cargar({ page: paginacion.page })}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={15} /> Actualizar
            </button>
            <button
              type="button"
              onClick={abrirModal}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"
            >
              <Upload size={15} /> Cargar JSON
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Facturas", resumen.cantidad || 0],
            ["Subtotal", formatoMonto(resumen.subtotal)],
            ["IVA", formatoMonto(resumen.iva)],
            ["Total", formatoMonto(resumen.total)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
            <label className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={filtros.busqueda}
                onChange={(event) => setFiltros((current) => ({ ...current, busqueda: event.target.value }))}
                placeholder="Proveedor, RUC, factura, departamento..."
                className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-xs"
              />
            </label>
            <select value={filtros.estado} onChange={(event) => setFiltros((current) => ({ ...current, estado: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
              <option value="">Todos los estados</option>
              {catalogos.estados.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select value={filtros.tipo} onChange={(event) => setFiltros((current) => ({ ...current, tipo: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
              <option value="">Todos los tipos</option>
              {catalogos.tipos.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select value={filtros.formaPago} onChange={(event) => setFiltros((current) => ({ ...current, formaPago: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
              <option value="">Todas las formas de pago</option>
              {catalogos.formasPago.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select value={filtros.departamento} onChange={(event) => setFiltros((current) => ({ ...current, departamento: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-2 text-xs">
              <option value="">Todos los departamentos</option>
              {catalogos.departamentos.map((value) => <option key={value}>{value}</option>)}
            </select>
            <label className="grid gap-1">
              <input type="date" aria-label="Factura desde" value={filtros.fechaInicio} onChange={(event) => setFiltros((current) => ({ ...current, fechaInicio: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-2 text-xs" />
              <span className="px-1 text-[10px] font-semibold text-slate-500">Factura desde</span>
            </label>
            <label className="grid gap-1">
              <input type="date" aria-label="Factura hasta" value={filtros.fechaFin} onChange={(event) => setFiltros((current) => ({ ...current, fechaFin: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-2 text-xs" />
              <span className="px-1 text-[10px] font-semibold text-slate-500">Factura hasta</span>
            </label>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-500">
            <span>Los filtros se aplican automáticamente después de 450 ms.</span>
            <button type="button" onClick={limpiarFiltros} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><X size={14} /> Limpiar</button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
              <RefreshCw className="mr-2 animate-spin" size={18} /> Cargando facturas...
            </div>
          ) : facturas.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
              <FileJson size={44} className="text-slate-300" />
              <h2 className="mt-3 text-sm font-bold text-slate-800">No hay facturas para mostrar</h2>
              <p className="mt-1 text-xs text-slate-500">Carga un JSON o modifica los filtros aplicados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2160px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "ID", "Fecha de factura", "Fecha y hora de carga", "Usuario que subio", "Proveedor", "RUC / Cédula",
                      "N.º de factura", "Subtotal", "IVA", "Total", "Forma de pago", "Estado",
                      "Departamento", "Foto / nota de venta", "Revision", "Observaciones", "Tipo", "Acciones",
                    ].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3">{label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {facturas.map((factura) => (
                    <tr key={factura.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-bold text-slate-700">{factura.id}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatoFecha(factura.fechaFactura)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatoFecha(factura.fechaCarga, true)}</td>
                      <td className="max-w-52 px-3 py-3 font-semibold text-slate-700">{factura.cargadoPor?.nombre || factura.cargadoPor?.usuario || "-"}</td>
                      <td className="max-w-64 px-3 py-3 font-semibold text-slate-900"><span className="line-clamp-2" title={factura.proveedor || ""}>{factura.proveedor || "-"}</span></td>
                      <td className="whitespace-nowrap px-3 py-3">{factura.identificacionProveedor}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">{factura.numeroFactura}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">{formatoMonto(factura.subtotal)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">{formatoMonto(factura.iva)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-900">{formatoMonto(factura.total)}</td>
                      <td className="px-3 py-3">{factura.formaPago}</td>
                      <td className="px-3 py-3"><span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">{factura.estado}</span></td>
                      <td className="px-3 py-3"><span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">{factura.departamento || "LOGISTICA"}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {factura.enlaceFoto ? (
                            <button
                              type="button"
                              onClick={() => verFoto(factura)}
                              className="font-semibold text-teal-700 hover:underline"
                            >
                              Ver
                            </button>
                          ) : <span className="text-slate-400">Sin foto</span>}
                          <button
                            type="button"
                            title={factura.enlaceFoto ? "Reemplazar foto" : "Cargar foto"}
                            disabled={fotoSubiendoId !== null}
                            onClick={() => abrirFoto(factura)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-600 hover:border-teal-400 hover:text-teal-700 disabled:cursor-wait disabled:opacity-60"
                          >
                            {fotoSubiendoId === factura.id ? <RefreshCw size={13} className="animate-spin" /> : <ImageUp size={14} />}
                            Subir / pegar
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {!factura.enlaceFoto ? (
                          <span className="text-slate-400">-</span>
                        ) : factura.revisada ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700" title={factura.revisadaAt ? formatoFecha(factura.revisadaAt, true) : ""}>
                            <CheckCircle2 size={12} /> Revisada
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Pendiente</span>
                        )}
                      </td>
                      <td className="max-w-72 px-3 py-3 text-slate-600"><span className="line-clamp-2" title={factura.observaciones || ""}>{factura.observaciones || "-"}</span></td>
                      <td className="px-3 py-3"><span className="inline-flex rounded bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700">{factura.tipo}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={eliminandoId !== null}
                            onClick={() => abrirEdicion(factura)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800 disabled:opacity-50"
                            title={`Editar factura ${factura.numeroFactura || `#${factura.id}`}`}
                          >
                            <Pencil size={13} /> Editar
                          </button>
                          <button
                            type="button"
                            disabled={eliminandoId !== null}
                            onClick={() => eliminarRegistro(factura)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 font-semibold text-red-700 hover:border-red-400 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                            title={`Eliminar factura ${factura.numeroFactura || `#${factura.id}`}`}
                          >
                            {eliminandoId === factura.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            {eliminandoId === factura.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && resumen.cantidad > 0 && (
            <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:flex-row">
              <span>{paginacion.total} registro(s) · Página {paginacion.page} de {paginacion.totalPaginas}</span>
              <div className="flex gap-2">
                <button type="button" disabled={paginacion.page <= 1} onClick={() => cargar({ page: paginacion.page - 1 })} className="rounded border border-slate-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40">Anterior</button>
                <button type="button" disabled={paginacion.page >= paginacion.totalPaginas} onClick={() => cargar({ page: paginacion.page + 1 })} className="rounded border border-slate-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {modalCarga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Procesar facturas desde JSON</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Sube un JSON, pega su contenido o carga una hoja de Excel.</p>
              </div>
              <button type="button" disabled={subiendo} onClick={() => setModalCarga(false)} className="text-slate-500"><X size={18} /></button>
            </div>
            <div className="max-h-[calc(94vh-124px)] space-y-4 overflow-y-auto p-4">
              <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
                <button type="button" onClick={() => setModoCarga("archivo")} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 ${modoCarga === "archivo" ? "bg-white text-teal-700 shadow-sm" : "text-slate-600"}`}>
                  <Upload size={14} /> Subir archivo
                </button>
                <button type="button" onClick={() => setModoCarga("texto")} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 ${modoCarga === "texto" ? "bg-white text-teal-700 shadow-sm" : "text-slate-600"}`}>
                  <ClipboardPaste size={14} /> Pegar contenido
                </button>
                <button type="button" onClick={() => setModoCarga("excel")} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 ${modoCarga === "excel" ? "bg-white text-teal-700 shadow-sm" : "text-slate-600"}`}>
                  <FileSpreadsheet size={14} /> Subir Excel
                </button>
              </div>

              {modoCarga === "archivo" ? (
                <>
                  <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-teal-300 bg-teal-50 p-5 text-center hover:bg-teal-100/70">
                    <FileJson size={38} className="text-teal-700" />
                    <span className="mt-2 text-sm font-bold text-teal-900">Seleccionar archivo JSON</span>
                    <span className="mt-1 text-xs text-teal-700">Arreglo, objeto con clave “facturas” o una factura individual</span>
                    <input type="file" accept="application/json,.json" className="hidden" onChange={(event) => setArchivo(event.target.files?.[0] || null)} />
                  </label>
                  {archivo && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                      <span className="min-w-0 truncate font-semibold text-slate-700">{archivo.name}</span>
                      <span className="whitespace-nowrap text-slate-500">{(archivo.size / 1024).toFixed(1)} KB</span>
                    </div>
                  )}
                </>
              ) : modoCarga === "texto" ? (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">Contenido JSON editable</span>
                  <textarea
                    value={contenidoJson}
                    onChange={(event) => setContenidoJson(event.target.value)}
                    disabled={subiendo}
                    spellCheck={false}
                    placeholder={'[{\n  "Fecha de factura": "2026-10-19",\n  "Proveedor": "EMPRESA EJEMPLO",\n  "N.º de factura": "001-001-000000001"\n}]'}
                    className="min-h-72 w-full resize-y rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                  <span className="mt-1 block text-[10px] text-slate-500">Puedes corregir cualquier campo directamente aquí antes de procesar.</span>
                </label>
              ) : (
                <>
                  <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50 p-5 text-center hover:bg-emerald-100/70">
                    <FileSpreadsheet size={38} className="text-emerald-700" />
                    <span className="mt-2 text-sm font-bold text-emerald-900">Seleccionar archivo Excel</span>
                    <span className="mt-1 text-xs text-emerald-700">Formato .xlsx · primera hoja · encabezados en la primera fila</span>
                    <input
                      type="file"
                      accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                      className="hidden"
                      onChange={(event) => setArchivoExcel(event.target.files?.[0] || null)}
                    />
                  </label>
                  {archivoExcel && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                      <span className="min-w-0 truncate font-semibold text-slate-700">{archivoExcel.name}</span>
                      <span className="whitespace-nowrap text-slate-500">{(archivoExcel.size / 1024).toFixed(1)} KB</span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Usa los encabezados de la plantilla: Fecha de factura, Proveedor, RUC / Cédula, N.º de factura, Subtotal, IVA, Total, Forma de pago, Estado, Enlace a la foto, Observaciones, TIPO y Departamento.
                  </p>
                </>
              )}

              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>Todos los campos de cada factura son opcionales y pueden quedar vacíos. El ID y la fecha de carga se generan automáticamente. Máximo 1.000 facturas y 5 MB. Los números de factura repetidos están permitidos.</p>
              </div>
              <button type="button" onClick={descargarPlantilla} className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 hover:underline">
                <Download size={14} /> Descargar plantilla JSON
              </button>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" disabled={subiendo} onClick={() => setModalCarga(false)} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold">Cancelar</button>
              <button
                type="button"
                disabled={subiendo || (modoCarga === "archivo" ? !archivo : modoCarga === "texto" ? !contenidoJson.trim() : !archivoExcel)}
                onClick={modoCarga === "archivo" ? subirArchivo : modoCarga === "texto" ? procesarContenidoJson : subirExcel}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                {subiendo ? <RefreshCw size={15} className="animate-spin" /> : modoCarga === "archivo" ? <Upload size={15} /> : modoCarga === "texto" ? <ClipboardPaste size={15} /> : <FileSpreadsheet size={15} />}
                {subiendo ? "Procesando..." : modoCarga === "archivo" ? "Cargar facturas" : modoCarga === "texto" ? "Procesar contenido" : "Procesar Excel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fotoFactura && (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="foto-factura-titulo"
          onClick={cerrarFoto}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 id="foto-factura-titulo" className="text-sm font-bold text-slate-900">
                  {fotoFactura.enlaceFoto ? "Reemplazar foto" : "Agregar foto"}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Factura {fotoFactura.numeroFactura || `#${fotoFactura.id}`}
                </p>
              </div>
              <button type="button" disabled={fotoSubiendoId !== null} onClick={cerrarFoto} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div>
                <label htmlFor="tipo-documento-foto" className="mb-1.5 block text-xs font-bold text-slate-800">
                  Tipo de documento <span className="text-red-600">*</span>
                </label>
                <select
                  id="tipo-documento-foto"
                  value={tipoDocumentoFoto}
                  disabled={fotoSubiendoId !== null}
                  onChange={(event) => setTipoDocumentoFoto(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
                  required
                >
                  <option value="">Selecciona una opción</option>
                  {TIPOS_DOCUMENTO_FOTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">Obligatorio para guardar la foto.</p>
              </div>

              <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
                <button type="button" onClick={() => { setModoFoto("archivo"); setFotoArchivo(null); }} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 ${modoFoto === "archivo" ? "bg-white text-teal-700 shadow-sm" : "text-slate-600"}`}>
                  <ImageUp size={14} /> Subir foto
                </button>
                <button type="button" onClick={() => { setModoFoto("pegar"); setFotoArchivo(null); }} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 ${modoFoto === "pegar" ? "bg-white text-teal-700 shadow-sm" : "text-slate-600"}`}>
                  <ClipboardPaste size={14} /> Pegar con Ctrl+V
                </button>
              </div>

              {modoFoto === "archivo" ? (
                <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-teal-300 bg-teal-50 p-5 text-center hover:bg-teal-100/70">
                  <ImageUp size={38} className="text-teal-700" />
                  <span className="mt-2 text-sm font-bold text-teal-900">Seleccionar imagen</span>
                  <span className="mt-1 text-xs text-teal-700">JPG, PNG o WEBP · máximo 10 MB</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setFotoArchivo(event.target.files?.[0] || null)} />
                </label>
              ) : (
                <div
                  tabIndex={0}
                  autoFocus
                  onPaste={recibirImagenPegada}
                  className="flex min-h-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-violet-300 bg-violet-50 p-5 text-center outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                >
                  <ClipboardPaste size={38} className="text-violet-700" />
                  <span className="mt-2 text-sm font-bold text-violet-900">Haz clic aquí y presiona Ctrl+V</span>
                  <span className="mt-1 text-xs text-violet-700">La imagen copiada aparecerá para revisión antes de guardarla.</span>
                </div>
              )}

              {fotoPreview && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <img src={fotoPreview} alt="Vista previa de la factura" className="mx-auto max-h-64 max-w-full rounded object-contain" />
                  <div className="mt-2 flex justify-between gap-3 text-[11px] text-slate-600">
                    <span className="truncate font-semibold">{fotoArchivo.name || "imagen-pegada"}</span>
                    <span className="shrink-0">{(fotoArchivo.size / 1024).toFixed(0)} KB</span>
                  </div>
                </div>
              )}

              <p className="text-[11px] leading-5 text-slate-500">
                Se conserva la resolución original. Antes de almacenarse, la imagen se comprime y convierte a WebP (máximo 600 KB).
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button type="button" disabled={fotoSubiendoId !== null} onClick={cerrarFoto} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50">Cancelar</button>
              <button
                type="button"
                disabled={!fotoArchivo || !tipoDocumentoFoto || fotoSubiendoId !== null}
                onClick={() => cargarFotoFactura(fotoFactura.id, fotoArchivo)}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                {fotoSubiendoId !== null ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                {fotoSubiendoId !== null ? "Optimizando..." : tipoDocumentoFoto ? "Guardar foto" : "Selecciona el tipo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {facturaEditando && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editar-factura-titulo"
          onClick={cerrarEdicion}
        >
          <form
            onSubmit={guardarEdicion}
            className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <h2 id="editar-factura-titulo" className="text-sm font-bold text-slate-900">
                  Editar factura
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Registro #{facturaEditando.id} · cargado {formatoFecha(facturaEditando.fechaCarga, true)}
                </p>
              </div>
              <button
                type="button"
                disabled={guardandoEdicion}
                onClick={cerrarEdicion}
                aria-label="Cerrar edición"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Fecha de factura
                  <input
                    type="date"
                    value={edicion.fechaFactura}
                    onChange={(event) => actualizarCampoEdicion("fechaFactura", event.target.value)}
                    disabled={guardandoEdicion}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Número de factura
                  <input
                    type="text"
                    maxLength={100}
                    value={edicion.numeroFactura}
                    onChange={(event) => actualizarCampoEdicion("numeroFactura", event.target.value)}
                    disabled={guardandoEdicion}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
                  Proveedor
                  <input
                    type="text"
                    maxLength={255}
                    value={edicion.proveedor}
                    onChange={(event) => actualizarCampoEdicion("proveedor", event.target.value)}
                    disabled={guardandoEdicion}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
                  RUC / Cédula
                  <input
                    type="text"
                    maxLength={30}
                    value={edicion.identificacionProveedor}
                    onChange={(event) => actualizarCampoEdicion("identificacionProveedor", event.target.value)}
                    disabled={guardandoEdicion}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                {[
                  ["subtotal", "Subtotal"],
                  ["iva", "IVA"],
                  ["total", "Total"],
                ].map(([campo, label]) => (
                  <label key={campo} className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    {label}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={edicion[campo]}
                      onChange={(event) => actualizarCampoEdicion(campo, event.target.value)}
                      disabled={guardandoEdicion}
                      className="h-10 rounded-md border border-slate-300 px-3 text-right text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>
                ))}
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Forma de pago
                  <input
                    type="text"
                    list="formas-pago-facturas"
                    maxLength={120}
                    value={edicion.formaPago}
                    onChange={(event) => actualizarCampoEdicion("formaPago", event.target.value)}
                    disabled={guardandoEdicion}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Estado
                  <input
                    type="text"
                    list="estados-facturas"
                    maxLength={80}
                    value={edicion.estado}
                    onChange={(event) => actualizarCampoEdicion("estado", event.target.value)}
                    disabled={guardandoEdicion}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Tipo
                  <input
                    type="text"
                    list="tipos-facturas"
                    maxLength={100}
                    value={edicion.tipo}
                    onChange={(event) => actualizarCampoEdicion("tipo", event.target.value)}
                    disabled={guardandoEdicion}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Departamento
                  <select
                    value={edicion.departamento}
                    onChange={(event) => actualizarCampoEdicion("departamento", event.target.value)}
                    disabled={guardandoEdicion}
                    required
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  >
                    {catalogos.departamentos.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
                  Observaciones
                  <textarea
                    rows={4}
                    maxLength={5000}
                    value={edicion.observaciones}
                    onChange={(event) => actualizarCampoEdicion("observaciones", event.target.value)}
                    disabled={guardandoEdicion}
                    className="resize-y rounded-md border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>

              <datalist id="formas-pago-facturas">
                {catalogos.formasPago.map((value) => <option key={value} value={value} />)}
              </datalist>
              <datalist id="estados-facturas">
                {catalogos.estados.map((value) => <option key={value} value={value} />)}
              </datalist>
              <datalist id="tipos-facturas">
                {catalogos.tipos.map((value) => <option key={value} value={value} />)}
              </datalist>

              <div className="mt-4 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>La foto se administra desde la tabla. El ID y la fecha de carga no se modifican.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
              <button
                type="button"
                disabled={guardandoEdicion}
                onClick={cerrarEdicion}
                className="h-9 rounded-md border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoEdicion}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {guardandoEdicion ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      )}

      {fotoVista && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={fotoVista.titulo}
          onClick={cerrarVistaFoto}
        >
          <div
            className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{fotoVista.titulo}</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Gira y guarda la orientación, o usa el zoom para revisar detalles.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <button type="button" disabled={guardandoRotacion} onClick={() => setRotacionFoto((actual) => actual - 90)} aria-label="Girar foto a la izquierda" title="Girar a la izquierda" className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-40">
                  <RotateCcw size={18} />
                </button>
                <button type="button" disabled={guardandoRotacion} onClick={() => setRotacionFoto((actual) => actual + 90)} aria-label="Girar foto a la derecha" title="Girar a la derecha" className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-40">
                  <RotateCw size={18} />
                </button>
                <button type="button" disabled={((rotacionFoto % 360) + 360) % 360 === 0 || guardandoRotacion} onClick={guardarRotacionFoto} title="Guardar orientación" className="inline-flex h-[34px] items-center gap-1.5 rounded-md bg-teal-700 px-2.5 text-xs font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40">
                  {guardandoRotacion ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {guardandoRotacion ? "Guardando..." : "Guardar giro"}
                </button>
                <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
                <button type="button" disabled={zoomFoto <= 0.5 || guardandoRotacion} onClick={() => cambiarZoomFoto(-0.25)} aria-label="Alejar foto" title="Alejar" className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                  <ZoomOut size={18} />
                </button>
                <button type="button" disabled={guardandoRotacion} onClick={() => setZoomFoto(1)} title="Restablecer zoom" className="min-w-14 rounded-md border border-slate-300 px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                  {Math.round(zoomFoto * 100)}%
                </button>
                <button type="button" disabled={zoomFoto >= 3 || guardandoRotacion} onClick={() => cambiarZoomFoto(0.25)} aria-label="Acercar foto" title="Acercar" className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                  <ZoomIn size={18} />
                </button>
                <button type="button" disabled={guardandoRotacion} onClick={cerrarVistaFoto} aria-label="Cerrar imagen" className="ml-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40">
                  <X size={19} />
                </button>
              </div>
            </div>
            <div className={`flex min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-5 ${zoomFoto > 1 ? "items-start justify-start" : "items-center justify-center"}`}>
              <img
                src={fotoVista.url}
                alt={fotoVista.titulo}
                onDoubleClick={() => setZoomFoto((actual) => actual === 1 ? 2 : 1)}
                style={{ zoom: zoomFoto, transform: `rotate(${rotacionFoto}deg)` }}
                className={`max-h-[calc(94vh-100px)] max-w-full rounded-md object-contain shadow-sm ${zoomFoto === 1 ? "cursor-zoom-in" : "cursor-zoom-out"}`}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
