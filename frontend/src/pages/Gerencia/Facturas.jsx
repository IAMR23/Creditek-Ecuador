import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ClipboardPaste,
  Download,
  FileJson,
  FileSpreadsheet,
  ImageUp,
  ReceiptText,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const API_BASE = "/api/gerencia/facturas";
const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PROCESSED_IMAGE_BYTES = 600 * 1024;
const filtrosIniciales = {
  busqueda: "",
  estado: "",
  tipo: "",
  formaPago: "",
  fechaInicio: "",
  fechaFin: "",
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

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);
  const [resumen, setResumen] = useState({ cantidad: 0, subtotal: 0, iva: 0, total: 0 });
  const [catalogos, setCatalogos] = useState({ estados: [], tipos: [], formasPago: [] });
  const [paginacion, setPaginacion] = useState({ page: 1, limit: 25, totalPaginas: 1 });
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciales);
  const [loading, setLoading] = useState(true);
  const [modalCarga, setModalCarga] = useState(false);
  const [modoCarga, setModoCarga] = useState("archivo");
  const [archivo, setArchivo] = useState(null);
  const [archivoExcel, setArchivoExcel] = useState(null);
  const [contenidoJson, setContenidoJson] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [fotoSubiendoId, setFotoSubiendoId] = useState(null);
  const [fotoVista, setFotoVista] = useState(null);

  const cargar = useCallback(async ({ page = 1, silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(API_BASE, {
        params: { ...filtrosAplicados, page, limit: paginacion.limit },
      });
      setFacturas(data.facturas || []);
      setResumen(data.resumen || { cantidad: 0, subtotal: 0, iva: 0, total: 0 });
      setCatalogos(data.catalogos || { estados: [], tipos: [], formasPago: [] });
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

  const aplicarFiltros = (event) => {
    event.preventDefault();
    setFiltrosAplicados({ ...filtros });
  };

  const limpiarFiltros = () => {
    setFiltros(filtrosIniciales);
    setFiltrosAplicados(filtrosIniciales);
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
      setFiltros(filtrosIniciales);
      setFiltrosAplicados(filtrosIniciales);
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
      setFiltros(filtrosIniciales);
      setFiltrosAplicados(filtrosIniciales);
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
      setFiltros(filtrosIniciales);
      setFiltrosAplicados(filtrosIniciales);
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
        maxSizeMB: 0.35,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        initialQuality: 0.82,
        fileType: "image/webp",
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
      const { data } = await api.post(`${API_BASE}/${facturaId}/foto`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFacturas((current) =>
        current.map((factura) =>
          factura.id === facturaId ? { ...factura, ...data.factura } : factura,
        ),
      );
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

  const abrirModal = () => {
    setModoCarga("archivo");
    setArchivo(null);
    setArchivoExcel(null);
    setContenidoJson("");
    setModalCarga(true);
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

        <form onSubmit={aplicarFiltros} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_160px_180px_145px_145px_auto]">
            <label className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={filtros.busqueda}
                onChange={(event) => setFiltros((current) => ({ ...current, busqueda: event.target.value }))}
                placeholder="Proveedor, RUC, factura..."
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
            <input type="date" aria-label="Fecha inicial" value={filtros.fechaInicio} onChange={(event) => setFiltros((current) => ({ ...current, fechaInicio: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-2 text-xs" />
            <input type="date" aria-label="Fecha final" value={filtros.fechaFin} onChange={(event) => setFiltros((current) => ({ ...current, fechaFin: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-2 text-xs" />
            <div className="flex gap-1">
              <button className="h-9 flex-1 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white">Filtrar</button>
              <button type="button" onClick={limpiarFiltros} title="Limpiar filtros" className="h-9 rounded-md border border-slate-300 px-2 text-xs text-slate-600"><X size={15} /></button>
            </div>
          </div>
        </form>

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
              <table className="w-full min-w-[1750px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "ID", "Fecha de factura", "Fecha de carga", "Proveedor", "RUC / Cédula",
                      "N.º de factura", "Subtotal", "IVA", "Total", "Forma de pago", "Estado",
                      "Foto / nota de venta", "Observaciones", "Tipo",
                    ].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3">{label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {facturas.map((factura) => (
                    <tr key={factura.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-bold text-slate-700">{factura.id}</td>
                      <td className="whitespace-nowrap px-3 py-3">{formatoFecha(factura.fechaFactura)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatoFecha(factura.fechaCarga, true)}</td>
                      <td className="max-w-64 px-3 py-3 font-semibold text-slate-900"><span className="line-clamp-2" title={factura.proveedor}>{factura.proveedor}</span></td>
                      <td className="whitespace-nowrap px-3 py-3">{factura.identificacionProveedor}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-medium">{factura.numeroFactura}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">{formatoMonto(factura.subtotal)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">{formatoMonto(factura.iva)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-900">{formatoMonto(factura.total)}</td>
                      <td className="px-3 py-3">{factura.formaPago}</td>
                      <td className="px-3 py-3"><span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">{factura.estado}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          {factura.enlaceFoto ? (
                            <button
                              type="button"
                              onClick={() => setFotoVista({
                                url: resolverEnlaceFoto(factura.enlaceFoto),
                                titulo: factura.numeroFactura
                                  ? `Factura ${factura.numeroFactura}`
                                  : `Factura #${factura.id}`,
                              })}
                              className="font-semibold text-teal-700 hover:underline"
                            >
                              Ver
                            </button>
                          ) : <span className="text-slate-400">Sin foto</span>}
                          <label
                            title={factura.enlaceFoto ? "Reemplazar foto" : "Cargar foto"}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700 ${fotoSubiendoId === factura.id ? "cursor-wait opacity-60" : "cursor-pointer"}`}
                          >
                            {fotoSubiendoId === factura.id ? <RefreshCw size={13} className="animate-spin" /> : <ImageUp size={14} />}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={fotoSubiendoId !== null}
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                event.target.value = "";
                                cargarFotoFactura(factura.id, file);
                              }}
                            />
                          </label>
                        </div>
                      </td>
                      <td className="max-w-72 px-3 py-3 text-slate-600"><span className="line-clamp-2" title={factura.observaciones || ""}>{factura.observaciones || "-"}</span></td>
                      <td className="px-3 py-3"><span className="inline-flex rounded bg-teal-50 px-2 py-1 text-[10px] font-bold text-teal-700">{factura.tipo}</span></td>
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
                    Usa los encabezados de la plantilla: Fecha de factura, Proveedor, RUC / Cédula, N.º de factura, Subtotal, IVA, Total, Forma de pago, Estado, Enlace a la foto, Observaciones y TIPO.
                  </p>
                </>
              )}

              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>Todos los campos de cada factura son opcionales y pueden quedar vacíos. El ID y la fecha de carga se generan automáticamente. Máximo 1.000 facturas y 5 MB; si un número de factura informado ya existe, no se guardará ningún registro.</p>
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

      {fotoVista && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={fotoVista.titulo}
          onClick={() => setFotoVista(null)}
        >
          <div
            className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{fotoVista.titulo}</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Foto de factura o nota de venta</p>
              </div>
              <button
                type="button"
                onClick={() => setFotoVista(null)}
                aria-label="Cerrar imagen"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={19} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-3 sm:p-5">
              <img
                src={fotoVista.url}
                alt={fotoVista.titulo}
                className="max-h-[calc(94vh-86px)] max-w-full rounded-md object-contain shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
