import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ListChecks,
  RefreshCw,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import { API_URL } from "../../../config";

const emptyResumen = {
  pdfsProcesados: 0,
  totalRegistros: 0,
  modelosDetectados: 0,
  modelosNuevos: 0,
  modelosActualizados: 0,
  totalMapeos: 0,
  modelosMapeados: 0,
  modelosPendientes: 0,
  errores: 0,
};

const normalizar = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const tipoConfig = {
  TV: {
    titulo: "Mapeo de modelos TV",
    subtitulo: "Extraccion PDF_CREDITV y modelos RVE.",
    pdfLabel: "PDFs CREDITV",
    modelosRveEndpoint: "/api/conciliacion/modelos-tv",
    modelosExtraidosEndpoint: "/api/conciliacion/modelos-tv-extraidos",
    extraerEndpoint: "/api/conciliacion/modelos-tv/extraer-pdf",
    successMessage: "Modelos TV extraidos correctamente",
    errorMessage: "No se pudieron extraer los modelos TV",
    loadingText: "Cargando modelos TV...",
  },
  CELULAR: {
    titulo: "Mapeo de modelos celulares",
    subtitulo: "Extraccion PDF_UPHONE y modelos RVE.",
    pdfLabel: "PDFs UPHONE",
    modelosRveEndpoint: "/api/conciliacion/modelos-celular",
    modelosExtraidosEndpoint: "/api/conciliacion/modelos-celular-extraidos",
    extraerEndpoint: "/api/conciliacion/modelos-celular/extraer-pdf",
    successMessage: "Modelos de celular extraidos correctamente",
    errorMessage: "No se pudieron extraer los modelos de celular",
    loadingText: "Cargando modelos de celular...",
  },
};

export default function ConciliacionFacturas() {
  const [tipo, setTipo] = useState("TV");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [modelosRve, setModelosRve] = useState([]);
  const [modelosExtraidos, setModelosExtraidos] = useState([]);
  const [errores, setErrores] = useState([]);
  const [resumenProceso, setResumenProceso] = useState(null);
  const [filters, setFilters] = useState({
    busqueda: "",
    estado: "todos",
  });
  const config = tipoConfig[tipo];

  const resumen = useMemo(() => {
    const modelosMapeados = modelosExtraidos.filter(
      (modelo) => modelo.estado === "MAPEADO",
    ).length;
    const modelosPendientes = modelosExtraidos.length - modelosMapeados;

    return {
      ...emptyResumen,
      ...(resumenProceso || {}),
      totalMapeos: modelosExtraidos.length,
      modelosMapeados,
      modelosPendientes,
      errores: errores.length,
    };
  }, [errores.length, modelosExtraidos, resumenProceso]);

  const modelosFiltrados = useMemo(() => {
    const busqueda = normalizar(filters.busqueda);

    return modelosExtraidos.filter((modelo) => {
      const coincideBusqueda =
        !busqueda ||
        normalizar(modelo.codigoPdf).includes(busqueda) ||
        normalizar(modelo.codigoNormalizado).includes(busqueda) ||
        normalizar(modelo.modeloRveNombre).includes(busqueda);

      const coincideEstado =
        filters.estado === "todos" || modelo.estado === filters.estado;

      return coincideBusqueda && coincideEstado;
    });
  }, [filters, modelosExtraidos]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      const [modelosRveRes, modelosExtraidosRes] = await Promise.all([
        axios.get(`${API_URL}${config.modelosRveEndpoint}`),
        axios.get(`${API_URL}${config.modelosExtraidosEndpoint}`),
      ]);
      setModelosRve(Array.isArray(modelosRveRes.data) ? modelosRveRes.data : []);
      setModelosExtraidos(
        Array.isArray(modelosExtraidosRes.data) ? modelosExtraidosRes.data : [],
      );
    } catch (error) {
      console.error(error);
      Swal.fire("Error", `No se pudieron cargar los modelos ${tipo}`, "error");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tipo]);

  const handleTipoChange = (nextTipo) => {
    setTipo(nextTipo);
    setFiles([]);
    setErrores([]);
    setResumenProceso(null);
    setFilters({ busqueda: "", estado: "todos" });
  };

  const handleFiles = (event) => {
    setFiles(Array.from(event.target.files || []));
    setErrores([]);
    setResumenProceso(null);
  };

  const clear = () => {
    setFiles([]);
    setErrores([]);
    setResumenProceso(null);
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!files.length) {
      return Swal.fire("Atencion", "Selecciona al menos un PDF", "warning");
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("pdfs", file));

    try {
      setLoading(true);
      const { data } = await axios.post(
        `${API_URL}${config.extraerEndpoint}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      setModelosExtraidos(Array.isArray(data.modelos) ? data.modelos : []);
      setErrores(Array.isArray(data.errores) ? data.errores : []);
      setResumenProceso(data.resumen || null);
      Swal.fire("Listo", config.successMessage, "success");
    } catch (error) {
      const data = error.response?.data;
      if (data?.resultado?.errores) {
        setErrores(data.resultado.errores);
      }
      Swal.fire(
        "Error",
        data?.message || config.errorMessage,
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateModeloExtraido = (modeloActualizado) => {
    setModelosExtraidos((prev) =>
      prev.map((modelo) =>
        modelo.id === modeloActualizado.id ? modeloActualizado : modelo,
      ),
    );
  };

  const handleMapeoChange = async (modeloExtraido, modeloRveId) => {
    try {
      setSavingId(modeloExtraido.id);
      const { data } = await axios.patch(
        `${API_URL}${config.modelosExtraidosEndpoint}/${modeloExtraido.id}`,
        { modeloRveId: modeloRveId || null },
      );

      if (data.modelo) {
        updateModeloExtraido(data.modelo);
      }
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar el mapeo",
        "error",
      );
    } finally {
      setSavingId(null);
    }
  };

  if (loadingData) {
    return <div className="p-6 text-sm text-gray-600">{config.loadingText}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {config.titulo}
          </h1>
          <div className="mt-1 text-sm text-gray-600">
            {config.subtitulo}
          </div>
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-lg border border-gray-300 bg-white p-1 shadow-sm">
        {Object.keys(tipoConfig).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleTipoChange(option)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
              tipo === option
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {option === "TV" ? "TV" : "Celulares"}
          </button>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {config.pdfLabel}
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={handleFiles}
              disabled={loading}
              className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-800 disabled:bg-gray-100"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            <button
              type="button"
              onClick={clear}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              <XCircle size={16} />
              Limpiar
            </button>
            <button
              type="submit"
              disabled={loading || !files.length}
              className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Upload size={16} />
              )}
              {loading ? "Extrayendo..." : "Extraer modelos"}
            </button>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {files.map((file) => (
              <span
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="inline-flex max-w-full items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700"
              >
                <FileText size={14} className="shrink-0" />
                <span className="max-w-[280px] truncate">{file.name}</span>
              </span>
            ))}
          </div>
        )}
      </form>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="PDFs" value={resumen.pdfsProcesados} icon={<FileText size={18} />} />
        <Metric label="Detectados" value={resumen.modelosDetectados} tone="blue" icon={<ListChecks size={18} />} />
        <Metric label="Nuevos" value={resumen.modelosNuevos} tone="green" icon={<CheckCircle2 size={18} />} />
        <Metric label="Mapeados" value={resumen.modelosMapeados} tone="green" />
        <Metric label="Pendientes" value={resumen.modelosPendientes} tone="amber" icon={<AlertTriangle size={18} />} />
      </div>

      <section className="mb-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Modelos extraidos
            </h2>
            <span className="text-xs text-gray-500">
              {modelosFiltrados.length} de {modelosExtraidos.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[260px_180px]">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Buscar
              </span>
              <div className="flex items-center rounded border border-gray-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <Search size={16} className="text-gray-400" />
                <input
                  value={filters.busqueda}
                  onChange={(event) =>
                    setFilters({ ...filters, busqueda: event.target.value })
                  }
                  className="w-full px-2 py-2 text-sm outline-none"
                  placeholder="Codigo o modelo"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Estado
              </span>
              <select
                value={filters.estado}
                onChange={(event) =>
                  setFilters({ ...filters, estado: event.target.value })
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="todos">Todos</option>
                <option value="PENDIENTE">Pendientes</option>
                <option value="MAPEADO">Mapeados</option>
              </select>
            </label>
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto rounded border border-gray-200">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Codigo PDF</th>
                <th className="px-3 py-2">Normalizado</th>
                <th className="px-3 py-2">Veces</th>
                <th className="px-3 py-2">Archivos</th>
                <th className="px-3 py-2">Modelo RVE</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {modelosFiltrados.map((modelo) => (
                <tr key={modelo.id} className="border-t hover:bg-gray-50">
                  <Cell value={modelo.codigoPdf} />
                  <Cell value={modelo.codigoNormalizado} />
                  <Cell value={modelo.vecesDetectado} />
                  <Cell value={(modelo.archivosOrigen || []).join(", ")} />
                  <td className="px-3 py-2 align-top">
                    <ModeloRveSelect
                      disabled={savingId === modelo.id}
                      modeloExtraido={modelo}
                      modelosRve={modelosRve}
                      onChange={(modeloRveId) =>
                        handleMapeoChange(modelo, modeloRveId)
                      }
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StatusBadge value={modelo.estado} />
                  </td>
                </tr>
              ))}
              {!modelosFiltrados.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    Sin modelos para los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900">Errores</h2>
          <span className="text-xs font-semibold text-gray-500">
            {errores.length}
          </span>
        </div>

        <div className="max-h-[300px] overflow-auto rounded border border-gray-200">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[24%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">Archivo</th>
                <th className="px-3 py-2">Fila</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Codigo</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {errores.map((row, index) => (
                <tr key={`${row.motivo}-${index}`} className="border-t hover:bg-gray-50">
                  <Cell value={row.archivo_origen || "-"} />
                  <Cell value={row.fila ?? "-"} />
                  <Cell value={row.motivo} />
                  <Cell value={row.codigo_pdf || "-"} />
                  <Cell value={row.detalle || "-"} />
                </tr>
              ))}
              {!errores.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                    Sin errores
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "gray", icon = null }) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase opacity-75">
        <span className="truncate">{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Cell({ value }) {
  return (
    <td
      className="truncate px-3 py-2 align-top text-gray-700"
      title={String(value || "-")}
    >
      {value || "-"}
    </td>
  );
}

function ModeloRveSelect({ disabled, modeloExtraido, modelosRve, onChange }) {
  const selectedValue = String(modeloExtraido.modeloRveId || "");

  return (
    <select
      value={selectedValue}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
    >
      <option value="">Pendiente</option>
      {modelosRve.map((modelo) => (
        <option key={modelo.id} value={modelo.id}>
          {modelo.nombre}
          {modelo.dispositivoMarca?.marca?.nombre
            ? ` - ${modelo.dispositivoMarca.marca.nombre}`
            : ""}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({ value }) {
  const tones = {
    MAPEADO: "bg-green-100 text-green-700",
    PENDIENTE: "bg-amber-100 text-amber-800",
  };

  return (
    <span
      className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${
        tones[value] || "bg-gray-100 text-gray-700"
      }`}
    >
      <span className="truncate">{value || "PENDIENTE"}</span>
    </span>
  );
}
