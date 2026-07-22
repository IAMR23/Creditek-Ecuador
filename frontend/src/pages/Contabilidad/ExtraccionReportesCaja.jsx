/* eslint-disable react/prop-types */
import { useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "../../api/client";

const API_ENDPOINT = "/api/contabilidad/reportes-caja-ventas/extraer";
const AGENCIAS = ["NUEVA AURORA", "CAUPICHO", "SANGOLQUI", "OTROS"];

const crearAsignacionVacia = (orden = 0) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  fecha: new Date().toISOString().slice(0, 10),
  horaInicio: orden === 0 ? "10:00" : "14:00",
  horaFin: orden === 0 ? "13:59" : "19:59",
  agencia: orden === 0 ? "CAUPICHO" : "NUEVA AURORA",
});

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const getFilenameFromDisposition = (disposition) => {
  if (!disposition) return null;
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i);
  return decodeURIComponent(match?.[1] || match?.[2] || "");
};

export default function ExtraccionReportesCaja() {
  const reportesCajaInputRef = useRef(null);
  const ventasTvInputRef = useRef(null);
  const ventasCelularInputRef = useRef(null);
  const [reportesCaja, setReportesCaja] = useState([]);
  const [ventasTv, setVentasTv] = useState([]);
  const [ventasCelular, setVentasCelular] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);

  const totalArchivos = reportesCaja.length + ventasTv.length + ventasCelular.length;
  const totalSize = useMemo(
    () =>
      [...reportesCaja, ...ventasTv, ...ventasCelular].reduce(
        (total, file) => total + file.size,
        0,
      ),
    [reportesCaja, ventasTv, ventasCelular],
  );

  const handleFiles = (archivos, setFiles) => {
    const selected = Array.from(archivos || []);
    const pdfs = selected.filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf"),
    );

    if (selected.length !== pdfs.length) {
      Swal.fire("Archivo no valido", "Solo se permiten archivos PDF.", "warning");
    }

    setFiles(pdfs);
    setLastSummary(null);
  };

  const clearFiles = (setFiles, inputRef) => {
    setFiles([]);
    setLastSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const agregarAsignacion = () => {
    setAsignaciones((actual) => [...actual, crearAsignacionVacia(actual.length)]);
  };

  const actualizarAsignacion = (id, campo, valor) => {
    setAsignaciones((actual) =>
      actual.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)),
    );
  };

  const eliminarAsignacion = (id) => {
    setAsignaciones((actual) => actual.filter((item) => item.id !== id));
  };

  const generarExcel = async () => {
    if (!reportesCaja.length) {
      Swal.fire(
        "Faltan reportes de caja",
        "Selecciona al menos un PDF de reporte de caja para generar el cierre.",
        "info",
      );
      return;
    }

    const asignacionInvalida = asignaciones.find(
      ({ horaInicio, horaFin }) => !horaInicio || !horaFin || horaInicio > horaFin,
    );

    if (asignacionInvalida) {
      Swal.fire(
        "Horario no valido",
        "Revisa que cada asignacion tenga hora desde y hasta en orden.",
        "warning",
      );
      return;
    }

    const formData = new FormData();
    reportesCaja.forEach((file) => formData.append("reportesCaja", file));
    ventasTv.forEach((file) => formData.append("ventasTv", file));
    ventasCelular.forEach((file) => formData.append("ventasCelular", file));
    formData.append(
      "asignacionesAgencias",
      JSON.stringify(
        asignaciones.map(({ fecha, horaInicio, horaFin, agencia }) => ({
          fecha,
          usuario: "BRYAN",
          horaInicio,
          horaFin,
          agencia,
        })),
      ),
    );

    setLoading(true);
    setLastSummary(null);

    try {
      const response = await api.post(API_ENDPOINT, formData, {
        responseType: "blob",
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fechaReporte = response.headers["x-rve-fecha-reporte"] || "REPORTE";
      const filename =
        getFilenameFromDisposition(response.headers["content-disposition"]) ||
        `CIERRE_CAJA_${fechaReporte.replace(/-/g, "")}.xlsx`;

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const cargaNueva =
        response.headers["x-rve-control-financiero-carga-nueva"] === "1";
      const archivosAgregados = Number(
        response.headers["x-rve-archivos-agregados"] || 0,
      );
      const archivosOmitidos = Number(
        response.headers["x-rve-archivos-omitidos"] || 0,
      );

      setLastSummary({
        registros: Number(response.headers["x-rve-registros"] || 0),
        noLeidas: Number(response.headers["x-rve-no-leidas"] || 0),
        ventasTv: Number(response.headers["x-rve-ventas-tv"] || 0),
        ventasCelular: Number(response.headers["x-rve-ventas-celular"] || 0),
        cargaId: Number(
          response.headers["x-rve-control-financiero-carga"] || 0,
        ),
        cargaNueva,
        archivosAgregados,
        archivosOmitidos,
        archivo: filename,
      });

      if (!archivosAgregados && archivosOmitidos) {
        Swal.fire(
          "Archivos repetidos",
          "El Excel fue generado, pero los archivos ya estaban guardados en la carga de ese dia.",
          "info",
        );
      } else {
        const detalleOmitidos = archivosOmitidos
          ? ` Se omitieron ${archivosOmitidos} archivo(s) repetido(s).`
          : "";
        Swal.fire(
          "Listo",
          `El Excel fue generado y se agregaron ${archivosAgregados} archivo(s) a Control financiero.${detalleOmitidos}`,
          "success",
        );
      }
    } catch (error) {
      console.error("Error generando reporte de caja", error);

      let message = "No se pudo generar el Excel.";
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          message = json.message || message;
        } catch {
          message = "No se pudo procesar la respuesta del servidor.";
        }
      } else {
        message = error.response?.data?.message || error.message || message;
      }

      Swal.fire("Error", message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Contabilidad
          </span>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Extraccion de reportes caja
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Consolida los reportes de caja y adjunta las ventas de TV y celular
                en un solo Excel.
              </p>
            </div>

            <button
              type="button"
              onClick={generarExcel}
              disabled={loading || !reportesCaja.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {loading ? "Procesando..." : "Generar Excel"}
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-3">
            <SelectorPdfs
              titulo="Reportes de caja"
              descripcion="PDFs de cobranzas usados para construir el cierre."
              requerido
              files={reportesCaja}
              inputRef={reportesCajaInputRef}
              loading={loading}
              onFiles={(files) => handleFiles(files, setReportesCaja)}
            />
            <SelectorPdfs
              titulo="Ventas TV"
              descripcion="Contrato, fecha, vendedor, cliente, modelo, ventas y entradas."
              files={ventasTv}
              inputRef={ventasTvInputRef}
              loading={loading}
              onFiles={(files) => handleFiles(files, setVentasTv)}
            />
            <SelectorPdfs
              titulo="Ventas celular"
              descripcion="Incluye las columnas de ventas y el IMEI del equipo."
              files={ventasCelular}
              inputRef={ventasCelularInputRef}
              loading={loading}
              onFiles={(files) => handleFiles(files, setVentasCelular)}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ResumenCarga label="PDFs totales" value={totalArchivos} />
            <ResumenCarga label="Tamano total" value={formatBytes(totalSize)} />
            <ResumenCarga
              label="Estado"
              value={loading ? "Procesando" : reportesCaja.length ? "Listo" : "Pendiente"}
              destacado
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Asignacion por horario de BRYAN
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Aplica a cualquier usuario cuyo codigo contenga BRYAN.
              </p>
            </div>
            <button
              type="button"
              onClick={agregarAsignacion}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
            >
              <Plus size={16} />
              Agregar horario
            </button>
          </div>

          {asignaciones.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              Sin asignaciones temporales. Se usara el mapeo fijo del reporte.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {asignaciones.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 p-4 md:grid-cols-[160px_130px_130px_1fr_auto] md:items-end"
                >
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      Fecha
                    </span>
                    <input
                      type="date"
                      value={item.fecha}
                      onChange={(event) =>
                        actualizarAsignacion(item.id, "fecha", event.target.value)
                      }
                      disabled={loading}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      Desde
                    </span>
                    <input
                      type="time"
                      value={item.horaInicio}
                      onChange={(event) =>
                        actualizarAsignacion(item.id, "horaInicio", event.target.value)
                      }
                      disabled={loading}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      Hasta
                    </span>
                    <input
                      type="time"
                      value={item.horaFin}
                      onChange={(event) =>
                        actualizarAsignacion(item.id, "horaFin", event.target.value)
                      }
                      disabled={loading}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase text-slate-500">
                      Agencia
                    </span>
                    <select
                      value={item.agencia}
                      onChange={(event) =>
                        actualizarAsignacion(item.id, "agencia", event.target.value)
                      }
                      disabled={loading}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                    >
                      {AGENCIAS.map((agencia) => (
                        <option key={agencia} value={agencia}>
                          {agencia}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => eliminarAsignacion(item.id)}
                    disabled={loading}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                    aria-label="Eliminar asignacion"
                    title="Eliminar asignacion"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {totalArchivos > 0 && (
          <section className="grid gap-4 lg:grid-cols-3">
            <GrupoArchivos
              titulo="Reportes de caja"
              files={reportesCaja}
              loading={loading}
              onClear={() => clearFiles(setReportesCaja, reportesCajaInputRef)}
            />
            <GrupoArchivos
              titulo="Ventas TV"
              files={ventasTv}
              loading={loading}
              onClear={() => clearFiles(setVentasTv, ventasTvInputRef)}
            />
            <GrupoArchivos
              titulo="Ventas celular"
              files={ventasCelular}
              loading={loading}
              onClear={() => clearFiles(setVentasCelular, ventasCelularInputRef)}
            />
          </section>
        )}

        {lastSummary && (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Ultimo archivo generado: {lastSummary.archivo}</p>
            <p className="mt-1">
              Caja: {lastSummary.registros} | Ventas TV: {lastSummary.ventasTv} |
              Ventas celular: {lastSummary.ventasCelular} | Filas no leidas:{" "}
              {lastSummary.noLeidas}
            </p>
            {lastSummary.cargaId > 0 && (
              <div className="mt-1 font-medium">
                <p>
                  {lastSummary.cargaNueva ? "Creada" : "Actualizada"} carga #
                  {lastSummary.cargaId} en Control financiero.
                </p>
                <p>
                  Archivos agregados: {lastSummary.archivosAgregados} | Repetidos
                  omitidos: {lastSummary.archivosOmitidos}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function SelectorPdfs({
  titulo,
  descripcion,
  requerido = false,
  files,
  inputRef,
  loading,
  onFiles,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!loading) setIsDragging(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (!loading) onFiles(event.dataTransfer.files);
  };

  return (
    <label
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex min-h-52 cursor-pointer flex-col rounded-lg border-2 border-dashed p-5 transition ${
        isDragging
          ? "scale-[1.01] border-emerald-500 bg-emerald-100 ring-4 ring-emerald-100"
          : "border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50"
      } ${loading ? "cursor-not-allowed opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <Upload className="text-emerald-600" size={30} />
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
          {files.length} PDF{files.length === 1 ? "" : "s"}
        </span>
      </div>
      <span className="mt-5 text-base font-semibold text-slate-900">
        {titulo} {requerido && <span className="text-red-500">*</span>}
      </span>
      <span className="mt-1 flex-1 text-sm text-slate-500">{descripcion}</span>
      <span className="mt-4 text-sm font-semibold text-emerald-700">
        {loading
          ? "Procesando..."
          : isDragging
            ? "Suelta los PDFs aqui"
            : "Seleccionar archivos o arrastrarlos aqui"}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        disabled={loading}
        className="hidden"
        onChange={(event) => onFiles(event.target.files)}
      />
    </label>
  );
}

function ResumenCarga({ label, value, destacado = false }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p
        className={`mt-2 font-bold ${
          destacado ? "text-sm text-emerald-700" : "text-2xl text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function GrupoArchivos({ titulo, files, loading, onClear }) {
  if (!files.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
        <p className="font-semibold text-slate-700">{titulo}</p>
        <p className="mt-2">Sin archivos seleccionados.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={18} className="shrink-0 text-emerald-600" />
          <h2 className="truncate font-semibold text-slate-900">{titulo}</h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <X size={14} />
          Limpiar
        </button>
      </div>

      <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
        {files.map((file) => (
          <div
            key={`${file.name}-${file.size}-${file.lastModified}`}
            className="flex items-center justify-between gap-3 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
            </div>
            <FileSpreadsheet className="shrink-0 text-emerald-600" size={18} />
          </div>
        ))}
      </div>
    </div>
  );
}
