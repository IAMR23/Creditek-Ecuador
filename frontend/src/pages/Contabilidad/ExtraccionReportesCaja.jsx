import { useMemo, useRef, useState } from "react";
import axios from "axios";
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
import { API_URL } from "../../../config";

const API_ENDPOINT = `${API_URL}/api/contabilidad/reportes-caja/extraer`;
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
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);
  const [asignaciones, setAsignaciones] = useState([]);

  const totalSize = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files],
  );

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files || []);
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

  const clearFiles = () => {
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
    if (!files.length) {
      Swal.fire("Faltan PDFs", "Selecciona al menos un PDF para procesar.", "info");
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
    files.forEach((file) => formData.append("pdfs", file));
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
      const response = await axios.post(API_ENDPOINT, formData, {
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
      const filename =
        getFilenameFromDisposition(response.headers["content-disposition"]) ||
        `REPORTE_CAJA_${new Date().toISOString().slice(0, 10)}.xlsx`;

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setLastSummary({
        registros: Number(response.headers["x-rve-registros"] || 0),
        noLeidas: Number(response.headers["x-rve-no-leidas"] || 0),
        archivo: filename,
      });

      Swal.fire("Listo", "El Excel fue generado correctamente.", "success");
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
                Sube los PDFs de reportes y descarga el Excel consolidado.
              </p>
            </div>

            <button
              type="button"
              onClick={generarExcel}
              disabled={loading || !files.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {loading ? "Procesando..." : "Generar Excel"}
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-6 text-center transition hover:bg-emerald-50">
              <Upload className="mb-3 text-emerald-600" size={34} />
              <span className="text-base font-semibold text-slate-900">
                Elegir PDFs
              </span>
              <span className="mt-1 text-sm text-slate-500">
                Puedes seleccionar varios archivos a la vez.
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={handleFiles}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">PDFs</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{files.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Tamano</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatBytes(totalSize)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Estado</p>
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  {loading ? "Procesando" : files.length ? "Listo" : "Pendiente"}
                </p>
              </div>
            </div>
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

        {files.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" />
                <h2 className="font-semibold text-slate-900">Archivos seleccionados</h2>
              </div>
              <button
                type="button"
                onClick={clearFiles}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <X size={16} />
                Limpiar
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {files.map((file) => (
                <div
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{file.name}</p>
                    <p className="text-sm text-slate-500">{formatBytes(file.size)}</p>
                  </div>
                  <FileSpreadsheet className="shrink-0 text-emerald-600" size={20} />
                </div>
              ))}
            </div>
          </section>
        )} 

        {lastSummary && (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Ultimo archivo generado: {lastSummary.archivo}</p>
            <p className="mt-1">
              Registros: {lastSummary.registros} | Filas no leidas:{" "}
              {lastSummary.noLeidas}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
