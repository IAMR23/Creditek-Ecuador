import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Camera,
  CheckCircle2,
  Eye,
  FileText,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Upload,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import FacturaFisicaOcrPanel from "../../components/Gerencia/FacturaFisicaOcrPanel";

const API_BASE = "/api/gerencia/facturas-fisicas";
const CAMPOS_FORMALES_OCR = [
  "proveedor",
  "rucProveedor",
  "numeroFactura",
  "fechaEmision",
  "subtotal",
  "impuestos",
  "total",
];
const ESTADOS = [
  "CARGADA",
  "PENDIENTE_REVISION",
  "REVISADA",
  "CONFIRMADA",
  "ANULADA",
  "ERROR",
];

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const estadoTone = {
  CARGADA: "border-blue-200 bg-blue-50 text-blue-700",
  PENDIENTE_REVISION: "border-amber-200 bg-amber-50 text-amber-700",
  REVISADA: "border-cyan-200 bg-cyan-50 text-cyan-700",
  CONFIRMADA: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ANULADA: "border-slate-300 bg-slate-100 text-slate-600",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
};

const formInicial = {
  proveedor: "",
  rucProveedor: "",
  numeroFactura: "",
  fechaEmision: "",
  subtotal: "",
  impuestos: "",
  total: "",
  observacion: "",
  estado: "CARGADA",
};

const filtrosIniciales = {
  fechaInicio: "",
  fechaFin: "",
  estado: "",
  busqueda: "",
};

const formatoFecha = (value) => {
  if (!value) return "-";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "-";
  return fecha.toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  });
};

const formatoFechaCorta = (value) => {
  if (!value) return "-";
  const fecha = new Date(`${value}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return "-";
  return fecha.toLocaleDateString("es-EC", { dateStyle: "medium" });
};

const bytes = (value) => {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
};

const normalizarMonto = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const numero = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
};

const crearDatosAdicionalesArray = (datos) =>
  Object.entries(datos || {}).map(([clave, valor]) => ({
    clave,
    valor: String(valor ?? ""),
  }));

const crearDatosAdicionalesObjeto = (items) =>
  items.reduce((acc, item) => {
    const clave = String(item.clave || "").trim();
    if (!clave) return acc;
    acc[clave] = String(item.valor || "").trim();
    return acc;
  }, {});

export default function FacturasFisicas() {
  const [facturas, setFacturas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [paginacion, setPaginacion] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPaginas: 1,
  });
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciales);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [procesandoOcr, setProcesandoOcr] = useState(false);
  const [aplicandoOcr, setAplicandoOcr] = useState(false);
  const [modalCarga, setModalCarga] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [previewCarga, setPreviewCarga] = useState("");
  const [origenCarga, setOrigenCarga] = useState("WEB");
  const cameraInputRef = useRef(null);
  const [detalle, setDetalle] = useState(null);
  const [visorUrl, setVisorUrl] = useState("");
  const [visorMime, setVisorMime] = useState("");
  const [form, setForm] = useState(formInicial);
  const [datosAdicionales, setDatosAdicionales] = useState([]);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const valoresNoCoinciden = useMemo(() => {
    const subtotal = normalizarMonto(form.subtotal);
    const impuestos = normalizarMonto(form.impuestos);
    const total = normalizarMonto(form.total);
    if (subtotal === null || impuestos === null || total === null) return false;
    return Math.abs(subtotal + impuestos - total) > 0.02;
  }, [form.impuestos, form.subtotal, form.total]);

  const cargarFacturas = useCallback(
    async ({ page = paginacion.page, silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get(API_BASE, {
          params: {
            ...filtrosAplicados,
            page,
            limit: paginacion.limit,
          },
        });
        setFacturas(Array.isArray(data.facturas) ? data.facturas : []);
        setResumen(data.resumen || null);
        setPaginacion((actual) => ({
          ...actual,
          ...(data.paginacion || {}),
        }));
      } catch (error) {
        Swal.fire(
          "Error",
          error.response?.data?.message || "No se pudieron cargar las facturas.",
          "error",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filtrosAplicados, paginacion.limit, paginacion.page],
  );

  useEffect(() => {
    cargarFacturas({ page: 1 });
  }, [cargarFacturas]);

  useEffect(() => {
    return () => {
      if (previewCarga) URL.revokeObjectURL(previewCarga);
      if (visorUrl) URL.revokeObjectURL(visorUrl);
    };
  }, [previewCarga, visorUrl]);

  const seleccionarArchivo = (file, origen = "WEB") => {
    if (previewCarga) URL.revokeObjectURL(previewCarga);
    setArchivo(file || null);
    setPreviewCarga(file ? URL.createObjectURL(file) : "");
    setOrigenCarga(file ? origen : "WEB");
  };

  const abrirModalCarga = () => {
    seleccionarArchivo(null);
    setModalCarga(true);
  };

  const cerrarModalCarga = () => {
    if (subiendo) return;
    seleccionarArchivo(null);
    setModalCarga(false);
  };

  const repetirFoto = () => {
    seleccionarArchivo(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
      cameraInputRef.current.click();
    }
  };

  const subirFactura = async (event) => {
    event.preventDefault();
    if (!archivo) {
      Swal.fire("Archivo requerido", "Selecciona un documento.", "warning");
      return;
    }

    const formData = new FormData();
    formData.append("archivo", archivo);
    formData.append("origenCarga", origenCarga);

    try {
      setSubiendo(true);
      const { data } = await api.post(API_BASE, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setModalCarga(false);
      seleccionarArchivo(null);
      await cargarFacturas({ page: 1, silent: true });
      Swal.fire({
        icon: "success",
        title: data.message || "Factura registrada",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      if (error.response?.data?.duplicado) {
        const existente = error.response.data.facturaExistente;
        Swal.fire(
          "Documento duplicado",
          existente
            ? `Ya existe como registro #${existente.id}: ${existente.nombreArchivoOriginal}`
            : "Este documento ya fue registrado.",
          "warning",
        );
        return;
      }
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo subir la factura.",
        "error",
      );
    } finally {
      setSubiendo(false);
    }
  };

  const cargarDetalle = async (id) => {
    try {
      setGuardando(true);
      const [{ data }, archivoResponse] = await Promise.all([
        api.get(`${API_BASE}/${id}`),
        api.get(`${API_BASE}/${id}/archivo`, { responseType: "blob" }),
      ]);
      if (visorUrl) URL.revokeObjectURL(visorUrl);
      const factura = data.factura;
      setDetalle(factura);
      setForm({
        proveedor: factura.proveedor || "",
        rucProveedor: factura.rucProveedor || "",
        numeroFactura: factura.numeroFactura || "",
        fechaEmision: factura.fechaEmision || "",
        subtotal: factura.subtotal ?? "",
        impuestos: factura.impuestos ?? "",
        total: factura.total ?? "",
        observacion: factura.observacion || "",
        estado: factura.estado || "CARGADA",
      });
      setDatosAdicionales(crearDatosAdicionalesArray(factura.datosAdicionales));
      setMotivoAnulacion("");
      setVisorMime(archivoResponse.headers["content-type"] || factura.mimeType || "");
      setVisorUrl(URL.createObjectURL(archivoResponse.data));
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo abrir el detalle.",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const guardarCambios = async (estadoForzado) => {
    if (!detalle || guardando) return;
    const payload = {
      ...form,
      estado: estadoForzado || form.estado,
      datosAdicionales: crearDatosAdicionalesObjeto(datosAdicionales),
    };
    try {
      setGuardando(true);
      const { data } = await api.patch(`${API_BASE}/${detalle.id}`, payload);
      setDetalle(data.factura);
      await cargarFacturas({ page: paginacion.page, silent: true });
      Swal.fire({
        icon: "success",
        title: "Cambios guardados",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron guardar los cambios.",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const anularFactura = async () => {
    if (!detalle || guardando) return;
    if (!motivoAnulacion.trim()) {
      Swal.fire("Motivo requerido", "Ingresa el motivo de anulacion.", "warning");
      return;
    }
    const confirmacion = await Swal.fire({
      title: "Anular factura",
      text: "El registro y el archivo se conservaran.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#be123c",
    });
    if (!confirmacion.isConfirmed) return;

    try {
      setGuardando(true);
      const { data } = await api.patch(`${API_BASE}/${detalle.id}/anular`, {
        motivo: motivoAnulacion,
      });
      setDetalle(data.factura);
      setForm((actual) => ({ ...actual, estado: "ANULADA" }));
      await cargarFacturas({ page: paginacion.page, silent: true });
      Swal.fire({
        icon: "success",
        title: "Factura anulada",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo anular la factura.",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const procesarOcr = async () => {
    if (!detalle || procesandoOcr || detalle.estado === "ANULADA") return;
    try {
      setProcesandoOcr(true);
      const { data } = await api.post(`${API_BASE}/${detalle.id}/ocr`);
      setDetalle(data.factura);
      await cargarFacturas({ page: paginacion.page, silent: true });
      Swal.fire({
        icon: data.factura?.ocrAdvertencias?.length ? "warning" : "success",
        title: data.factura?.ocrAdvertencias?.length
          ? "OCR procesado con advertencias"
          : "OCR procesado",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      try {
        const { data } = await api.get(`${API_BASE}/${detalle.id}`);
        setDetalle(data.factura);
      } catch {
        // Se conserva el detalle visible si no fue posible refrescar el error OCR.
      }
      Swal.fire(
        "Error OCR",
        error.response?.data?.message || "No se pudo procesar el documento.",
        "error",
      );
    } finally {
      setProcesandoOcr(false);
    }
  };

  const aplicarSugerenciasOcr = async (campos) => {
    if (!detalle || aplicandoOcr || !campos?.length) return false;
    try {
      setAplicandoOcr(true);
      let response;
      try {
        response = await api.patch(`${API_BASE}/${detalle.id}/aplicar-ocr`, {
          campos,
        });
      } catch (error) {
        if (error.response?.data?.code !== "OCR_ADDITIONAL_DATA_CONFLICT") {
          throw error;
        }
        const conflicts = error.response.data.conflictos || [];
        const confirmation = await Swal.fire({
          icon: "warning",
          title: "Datos adicionales existentes",
          text: `Ya existen valores distintos para: ${conflicts.join(", ")}. ¿Deseas reemplazarlos con la sugerencia OCR?`,
          showCancelButton: true,
          confirmButtonText: "Sí, reemplazar",
          cancelButtonText: "Conservar actuales",
          confirmButtonColor: "#b45309",
        });
        if (!confirmation.isConfirmed) return false;
        response = await api.patch(`${API_BASE}/${detalle.id}/aplicar-ocr`, {
          campos,
          sobrescribirDatosAdicionales: true,
        });
      }
      const { data } = response;
      setDetalle(data.factura);
      setDatosAdicionales(
        crearDatosAdicionalesArray(data.factura?.datosAdicionales),
      );
      setForm((actual) =>
        campos.filter((field) => CAMPOS_FORMALES_OCR.includes(field)).reduce(
          (next, field) => ({
            ...next,
            [field]: data.factura?.[field] ?? "",
          }),
          actual,
        ),
      );
      await cargarFacturas({ page: paginacion.page, silent: true });
      Swal.fire({
        icon: "success",
        title: "Sugerencias aplicadas",
        text: `${data.camposAplicados?.length || campos.length} campo(s) actualizado(s).`,
        timer: 1500,
        showConfirmButton: false,
      });
      return true;
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron aplicar las sugerencias OCR.",
        "error",
      );
      return false;
    } finally {
      setAplicandoOcr(false);
    }
  };

  const aplicarFiltros = (event) => {
    event.preventDefault();
    setPaginacion((actual) => ({ ...actual, page: 1 }));
    setFiltrosAplicados(filtros);
  };

  const limpiarFiltros = () => {
    setFiltros(filtrosIniciales);
    setFiltrosAplicados(filtrosIniciales);
    setPaginacion((actual) => ({ ...actual, page: 1 }));
  };

  const cambiarDatoAdicional = (index, field, value) => {
    setDatosAdicionales((actuales) =>
      actuales.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const resumenCards = [
    ["Total documentos", resumen?.totalDocumentos || 0],
    ["Cargadas", resumen?.cargadas || 0],
    ["Pendientes de revision", resumen?.pendientesRevision || 0],
    ["Confirmadas", resumen?.confirmadas || 0],
    ["Anuladas", resumen?.anuladas || 0],
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Gerencia</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Facturas fisicas
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Registro y control de facturas fisicas recibidas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cargarFacturas({ silent: false })}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={abrirModalCarga}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Plus size={17} />
              Nueva factura
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {resumenCards.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase text-slate-500">
                {label}
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
                {value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <form
            onSubmit={aplicarFiltros}
            className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-[150px_150px_180px_minmax(240px,1fr)_auto_auto]"
          >
            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
              Fecha inicio
              <input
                type="date"
                value={filtros.fechaInicio}
                onChange={(event) =>
                  setFiltros((actual) => ({
                    ...actual,
                    fechaInicio: event.target.value,
                  }))
                }
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
              Fecha fin
              <input
                type="date"
                value={filtros.fechaFin}
                onChange={(event) =>
                  setFiltros((actual) => ({
                    ...actual,
                    fechaFin: event.target.value,
                  }))
                }
                className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
              Estado
              <select
                value={filtros.estado}
                onChange={(event) =>
                  setFiltros((actual) => ({ ...actual, estado: event.target.value }))
                }
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Todos</option>
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
              Busqueda
              <span className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={filtros.busqueda}
                  onChange={(event) =>
                    setFiltros((actual) => ({
                      ...actual,
                      busqueda: event.target.value,
                    }))
                  }
                  placeholder="Archivo, proveedor, RUC o factura"
                  className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </span>
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center self-end rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex h-10 items-center justify-center self-end rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Limpiar
            </button>
          </form>

          {loading ? (
            <div className="grid gap-3 p-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-12 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : facturas.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
              <FileText size={28} className="text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Sin facturas registradas
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Vista previa</th>
                      <th className="px-3 py-2.5">Archivo</th>
                      <th className="px-3 py-2.5">Proveedor</th>
                      <th className="px-3 py-2.5">RUC</th>
                      <th className="px-3 py-2.5">N. factura</th>
                      <th className="px-3 py-2.5">Fecha emision</th>
                      <th className="px-3 py-2.5 text-right">Total</th>
                      <th className="px-3 py-2.5">Fecha carga</th>
                      <th className="px-3 py-2.5">Usuario</th>
                      <th className="px-3 py-2.5">Estado</th>
                      <th className="px-4 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {facturas.map((factura) => (
                      <tr key={factura.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex size-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                            <FileText size={18} />
                          </span>
                        </td>
                        <td className="max-w-52 px-3 py-3">
                          <p className="truncate font-semibold text-slate-900">
                            {factura.nombreArchivoOriginal}
                          </p>
                          <p className="text-xs text-slate-500">
                            {factura.extension?.toUpperCase()} · {bytes(factura.sizeBytes)}
                          </p>
                        </td>
                        <td className="max-w-44 px-3 py-3 text-slate-700">
                          <span className="block truncate">
                            {factura.proveedor || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {factura.rucProveedor || "-"}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {factura.numeroFactura || "-"}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {formatoFechaCorta(factura.fechaEmision)}
                        </td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-950">
                          {factura.total === null ? "-" : money.format(factura.total)}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {formatoFecha(factura.createdAt)}
                        </td>
                        <td className="max-w-36 px-3 py-3 text-slate-600">
                          <span className="block truncate">
                            {factura.usuarioCarga?.nombre || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                              estadoTone[factura.estado] || estadoTone.CARGADA
                            }`}
                          >
                            {factura.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => cargarDetalle(factura.id)}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                              title="Ver"
                              aria-label="Ver factura"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => cargarDetalle(factura.id)}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                              title="Editar"
                              aria-label="Editar factura"
                            >
                              <Pencil size={15} />
                            </button>
                            {factura.estado !== "ANULADA" && (
                              <button
                                type="button"
                                onClick={() => cargarDetalle(factura.id)}
                                className="inline-flex size-8 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                                title="Anular"
                                aria-label="Anular factura"
                              >
                                <Ban size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {paginacion.total} documentos · pagina {paginacion.page} de{" "}
                  {paginacion.totalPaginas}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={paginacion.page <= 1}
                    onClick={() => cargarFacturas({ page: paginacion.page - 1 })}
                    className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={paginacion.page >= paginacion.totalPaginas}
                    onClick={() => cargarFacturas({ page: paginacion.page + 1 })}
                    className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {modalCarga && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <section className="mx-auto my-4 w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl sm:my-8">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Nueva factura
                </h2>
                <p className="text-xs text-slate-500">
                  Carga un JPG, PNG, WEBP o PDF de hasta 15 MB.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarModalCarga}
                disabled={subiendo}
                className="inline-flex size-10 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                aria-label="Cerrar nueva factura"
              >
                <X size={17} />
              </button>
            </header>
            <form onSubmit={subirFactura} className="space-y-4 p-4 sm:p-5">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <p className="font-semibold">
                  Procura que toda la factura aparezca dentro de la imagen y que el texto sea legible.
                </p>
                <p className="mt-1 text-xs">Evita sombras, reflejos y movimiento.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:bg-slate-100 sm:min-h-36">
                  <Upload size={24} className="text-slate-500" />
                  <span className="mt-2 text-sm font-semibold text-slate-700">
                    Subir archivo
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    JPG, PNG, WEBP o PDF
                  </span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    onClick={(event) => {
                      event.currentTarget.value = "";
                    }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) seleccionarArchivo(file, "WEB");
                    }}
                  />
                </label>
                <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-blue-300 bg-blue-50 p-4 text-center hover:bg-blue-100 sm:min-h-36">
                  <Camera size={24} className="text-slate-500" />
                  <span className="mt-2 text-sm font-semibold text-slate-700">
                    Tomar foto
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    Usara la camara trasera cuando sea posible
                  </span>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onClick={(event) => {
                      event.currentTarget.value = "";
                    }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) seleccionarArchivo(file, "CELULAR");
                    }}
                  />
                </label>
              </div>

              {archivo && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex min-h-64 w-full items-center justify-center overflow-hidden rounded-md bg-slate-100 sm:min-h-80">
                    {archivo.type.startsWith("image/") ? (
                      <img
                        src={previewCarga}
                        alt="Vista previa completa de la factura seleccionada"
                        className="max-h-[55vh] w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500">
                        <FileText size={48} className="text-slate-400" />
                        <span className="text-xs font-semibold">
                          Documento PDF seleccionado
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {archivo.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {archivo.type || "Tipo no disponible"} · {bytes(archivo.size)}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase text-slate-500">
                        Origen: {origenCarga === "CELULAR" ? "Camara" : "Archivo"}
                      </p>
                    </div>
                    {origenCarga === "CELULAR" && archivo.type.startsWith("image/") && (
                      <button
                        type="button"
                        onClick={repetirFoto}
                        disabled={subiendo}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-blue-300 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 sm:w-auto"
                      >
                        <Camera size={16} />
                        Repetir foto
                      </button>
                    )}
                  </div>
                </div>
              )}

              <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cerrarModalCarga}
                  disabled={subiendo}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={subiendo || !archivo}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  {subiendo ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                  Confirmar carga
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-3">
          <section className="mx-auto my-4 w-full max-w-7xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <header className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-950">
                  {detalle.nombreArchivoOriginal}
                </h2>
                <p className="text-xs text-slate-500">
                  Cargada {formatoFecha(detalle.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="inline-flex size-8 items-center justify-center self-start rounded-md text-slate-500 hover:bg-slate-100 sm:self-auto"
              >
                <X size={17} />
              </button>
            </header>

            <div className="grid max-h-[calc(100vh-120px)] overflow-y-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
              <div className="min-h-[420px] border-b border-slate-200 bg-slate-100 p-4 lg:border-b-0 lg:border-r">
                <div className="flex h-full min-h-[380px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {visorMime.startsWith("image/") ? (
                    <img
                      src={visorUrl}
                      alt="Factura fisica"
                      className="h-full max-h-[75vh] w-full object-contain"
                    />
                  ) : visorMime === "application/pdf" ? (
                    <iframe
                      src={visorUrl}
                      title="Factura PDF"
                      className="h-[75vh] w-full"
                    />
                  ) : (
                    <FileText size={42} className="text-slate-400" />
                  )}
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    Proveedor
                    <input
                      value={form.proveedor}
                      onChange={(event) =>
                        setForm((actual) => ({
                          ...actual,
                          proveedor: event.target.value,
                        }))
                      }
                      disabled={detalle.estado === "ANULADA"}
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    RUC
                    <input
                      value={form.rucProveedor}
                      onChange={(event) =>
                        setForm((actual) => ({
                          ...actual,
                          rucProveedor: event.target.value,
                        }))
                      }
                      disabled={detalle.estado === "ANULADA"}
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    Numero factura
                    <input
                      value={form.numeroFactura}
                      onChange={(event) =>
                        setForm((actual) => ({
                          ...actual,
                          numeroFactura: event.target.value,
                        }))
                      }
                      disabled={detalle.estado === "ANULADA"}
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    Fecha emision
                    <input
                      type="date"
                      value={form.fechaEmision}
                      onChange={(event) =>
                        setForm((actual) => ({
                          ...actual,
                          fechaEmision: event.target.value,
                        }))
                      }
                      disabled={detalle.estado === "ANULADA"}
                      className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    />
                  </label>
                  {["subtotal", "impuestos", "total"].map((field) => (
                    <label
                      key={field}
                      className="grid gap-1.5 text-xs font-semibold capitalize text-slate-700"
                    >
                      {field}
                      <input
                        inputMode="decimal"
                        value={form[field]}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (/^\d*([.,]\d{0,2})?$/.test(next)) {
                            setForm((actual) => ({ ...actual, [field]: next }));
                          }
                        }}
                        disabled={detalle.estado === "ANULADA"}
                        className="h-10 rounded-md border border-slate-300 px-3 text-right text-sm font-bold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                      />
                    </label>
                  ))}
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    Estado
                    <select
                      value={form.estado}
                      onChange={(event) =>
                        setForm((actual) => ({ ...actual, estado: event.target.value }))
                      }
                      disabled={detalle.estado === "ANULADA"}
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                    >
                      {ESTADOS.filter((estado) => estado !== "ANULADA").map((estado) => (
                        <option key={estado} value={estado}>
                          {estado}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {valoresNoCoinciden && (
                  <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle size={18} className="shrink-0" />
                    <span>
                      Los valores ingresados no coinciden con el total de la factura.
                    </span>
                  </div>
                )}

                <FacturaFisicaOcrPanel
                  factura={detalle}
                  valoresActuales={form}
                  procesando={procesandoOcr}
                  aplicando={aplicandoOcr}
                  onProcesar={procesarOcr}
                  onAplicar={aplicarSugerenciasOcr}
                />

                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Observacion
                  <textarea
                    value={form.observacion}
                    onChange={(event) =>
                      setForm((actual) => ({
                        ...actual,
                        observacion: event.target.value,
                      }))
                    }
                    disabled={detalle.estado === "ANULADA"}
                    rows={3}
                    className="resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                  />
                </label>

                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-bold uppercase text-slate-600">
                      Datos adicionales
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setDatosAdicionales((actual) => [
                          ...actual,
                          { clave: "", valor: "" },
                        ])
                      }
                      disabled={detalle.estado === "ANULADA"}
                      className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {datosAdicionales.length === 0 ? (
                      <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
                        Sin datos adicionales.
                      </p>
                    ) : (
                      datosAdicionales.map((item, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <input
                            value={item.clave}
                            onChange={(event) =>
                              cambiarDatoAdicional(index, "clave", event.target.value)
                            }
                            disabled={detalle.estado === "ANULADA"}
                            placeholder="Clave"
                            className="h-9 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                          />
                          <input
                            value={item.valor}
                            onChange={(event) =>
                              cambiarDatoAdicional(index, "valor", event.target.value)
                            }
                            disabled={detalle.estado === "ANULADA"}
                            placeholder="Valor"
                            className="h-9 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDatosAdicionales((actual) =>
                                actual.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                            disabled={detalle.estado === "ANULADA"}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                            aria-label="Quitar dato"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {detalle.estado !== "ANULADA" && (
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    Motivo de anulacion
                    <textarea
                      value={motivoAnulacion}
                      onChange={(event) => setMotivoAnulacion(event.target.value)}
                      rows={2}
                      placeholder="Requerido solo si vas a anular"
                      className="resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </label>
                )}

                <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => guardarCambios()}
                    disabled={guardando || detalle.estado === "ANULADA"}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {guardando ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => guardarCambios("CONFIRMADA")}
                    disabled={guardando || detalle.estado === "ANULADA"}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} />
                    Confirmar
                  </button>
                  {detalle.estado !== "ANULADA" && (
                    <button
                      type="button"
                      onClick={anularFactura}
                      disabled={guardando}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <Ban size={16} />
                      Anular
                    </button>
                  )}
                </footer>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
