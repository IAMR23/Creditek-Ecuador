import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { nombreCortoUsuario } from "../../utils/nombres";
import { Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  Eye,
  FileText,
  FileSpreadsheet,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash,
  Upload,
  X,
} from "lucide-react";
import Swal from "sweetalert2";

const STORAGE_KEY = "ventas_auditoria_filtros";

const getHoyLocal = () => new Date().toLocaleDateString("en-CA");

const TABLE_COLUMNS = [
  "ID Venta",
  "Fecha",
  "Fecha PDF",
  "Cedula",
  "Cliente",
  "Cliente PDF",
  "Similitud Cliente",
  "Agencia",
  "Vendedor",
  "Origen",
  "Dispositivo",
  "Modelo",
  "Codigo / IMEI PDF",
  "Precio Carga",
  "Precio Vendedor",
  "Costo",
  "Ventas PDF",
  "Diferencia",
  "Precio Unitario",
  "Forma Pago",
  "Entrada",
  "Entrada PDF",
  "Alcance",
  "Estado",
  "Observacion",
  "Observacion Error",
];

const obtenerFiltrosGuardados = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    console.error("Error leyendo filtros guardados:", error);
    return {};
  }
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toMoney = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : "";
};

const normalizarBusqueda = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const normalizarDecimalInput = (value) => String(value ?? "").replace(",", ".");

const esDecimalEditable = (value) => /^\d*\.?\d{0,2}$/.test(value);

const getModeloLabel = (modelo) =>
  modelo.dispositivoMarca?.marca?.nombre
    ? `${modelo.dispositivoMarca.marca.nombre} ${modelo.nombre}`
    : modelo.nombre;

const getFilaEditableId = (fila) =>
  fila.detalleVentaId ? String(fila.detalleVentaId) : "";

const getPrecioVendedorClass = (precioVendedorValue, precioVentaValue) => {
  const precioVenta = Number(precioVentaValue);
  const precioVendedor = Number(precioVendedorValue);

  if (!Number.isFinite(precioVenta) || !Number.isFinite(precioVendedor)) {
    return "";
  }

  if (precioVendedor > precioVenta) return " text-green-600 font-bold";
  if (precioVendedor < precioVenta) return " text-red-600 font-bold";
  return " text-gray-700 font-semibold";
};

const getEstadoBadge = (estado) =>
  estado === "Activo"
    ? "bg-green-100 text-green-700 border-green-200"
    : estado === "Sin venta"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : "bg-red-100 text-red-700 border-red-200";

const escaparHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const obtenerNombreSeleccionado = (items, id) =>
  items.find((item) => String(item.id) === String(id))?.nombre || "Todos";

const getDiferenciaCreditoTone = (value) =>
  Number(value || 0) === 0 ? "green" : "red";

const formatearDiferenciaPrecio = (value) => {
  const diferencia = Number(value);
  if (!Number.isFinite(diferencia) || diferencia === 0) return "-";
  return Number(Math.abs(diferencia).toFixed(2));
};

const getValorColumnaReporte = (fila, columna) =>
  columna === "Diferencia"
    ? formatearDiferenciaPrecio(fila[columna])
    : fila[columna] ?? "";

const esFilaConIncidencia = (fila) => {
  const observacion = String(fila["Observacion Error"] || "").trim().toUpperCase();
  return Boolean(observacion && observacion !== "OK");
};

const coincideBusquedaCliente = (fila, busqueda) => {
  const termino = normalizarBusqueda(busqueda);
  if (!termino) return true;

  return ["Cliente", "Cliente PDF", "Cedula"].some((key) =>
    normalizarBusqueda(fila[key]).includes(termino),
  );
};

const mapVentaAuditoria = (venta) => {
  const precioVenta = toMoney(venta.precioVenta);
  const precioVendedor = toMoney(venta.precioVendedor);
  const diferencia =
    precioVenta !== "" || precioVendedor !== ""
      ? Number((toNumber(precioVenta) - toNumber(precioVendedor)).toFixed(2))
      : "";

  return {
    id: venta.id,
    detalleVentaId: venta.detalleVentaId,
    "ID Venta": venta.id ?? "",
    modeloId: venta.modeloId ?? "",
    Fecha: venta.fecha ?? "",
    "Fecha PDF": venta.fechaPdf ?? "",
    Cedula: venta.cedula ?? "",
    Cliente: venta.nombre ?? "",
    "Cliente PDF": venta.clientePdf ?? "",
    "Similitud Cliente":
      venta.similitudCliente !== undefined && venta.similitudCliente !== null
        ? `${venta.similitudCliente}%`
        : "",
    Agencia: venta.local ?? "",
    Vendedor: venta.vendedor ?? "",
    Origen: venta.origen ?? "",
    Observacion: venta.observaciones ?? "",
    Dispositivo: `${venta.tipo ?? ""}`.toUpperCase(),
    Modelo: `${venta.marca ?? ""} ${venta.modelo ?? ""}`.toUpperCase(),
    "Codigo / IMEI PDF": venta.referenciaPdf ?? "",
    "Precio Carga": precioVenta,
    "Precio Vendedor": precioVendedor,
    Costo: toMoney(venta.costo),
    "Ventas PDF": toMoney(venta.precioVendedorPdf),
    Diferencia: diferencia,
    "Precio Unitario":
      venta.precioVendedor != null
        ? Number((venta.precioVendedor / 1.15).toFixed(2))
        : "",
    "Forma Pago": venta.formaPago ?? "",
    Entrada: venta.entrada ?? "",
    "Entrada PDF": toMoney(venta.entradaPdf),
    Alcance: venta.alcance ?? "",
    Estado: venta.id ? (venta.activo ? "Activo" : "Desactivada") : "Sin venta",
    "Observacion Error": venta.observacionError ?? "",
  };
};

export default function VentasAuditoria() {
  const filtrosGuardados = obtenerFiltrosGuardados();
  const hoyLocal = getHoyLocal();

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(
    filtrosGuardados.fechaInicio || hoyLocal,
  );
  const [fechaFin, setFechaFin] = useState(filtrosGuardados.fechaFin || hoyLocal);
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState(filtrosGuardados.agenciaId || "");
  const [usuarios, setUsuarios] = useState([]);
  const [vendedorId, setVendedorId] = useState(
    filtrosGuardados.vendedorId || "",
  );
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState(filtrosGuardados.modeloId || "");
  const [origenes, setOrigenes] = useState([]);
  const [origenId, setOrigenId] = useState(filtrosGuardados.origenId || "");
  const [dispositivos, setDispositivos] = useState([]);
  const [dispositivoId, setDispositivoId] = useState(
    filtrosGuardados.dispositivoId || "",
  );
  const [cierreCaja, setCierreCaja] = useState(
    filtrosGuardados.cierreCaja || "",
  );
  const [estado, setEstado] = useState(filtrosGuardados.estado || "");
  const [pdfTipo, setPdfTipo] = useState("TV");
  const [pdfFiles, setPdfFiles] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfResumen, setPdfResumen] = useState(null);
  const [vistaResultados, setVistaResultados] = useState("todos");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [filaEditandoId, setFilaEditandoId] = useState("");
  const [edicionFila, setEdicionFila] = useState({});
  const [guardandoFilaId, setGuardandoFilaId] = useState("");

  const filasFiltradasPorCliente = useMemo(
    () => filas.filter((fila) => coincideBusquedaCliente(fila, busquedaCliente)),
    [filas, busquedaCliente],
  );

  const filasVisibles = useMemo(
    () =>
      vistaResultados === "errores"
        ? filasFiltradasPorCliente.filter(esFilaConIncidencia)
        : filasFiltradasPorCliente,
    [filasFiltradasPorCliente, vistaResultados],
  );

  const resumen = useMemo(() => {
    const totalVenta = filasFiltradasPorCliente.reduce(
      (acc, fila) => acc + toNumber(fila["Precio Vendedor"]),
      0,
    );
    const diferencias = filasFiltradasPorCliente.reduce(
      (acc, fila) => acc + toNumber(fila.Diferencia),
      0,
    );
    const activas = filasFiltradasPorCliente.filter(
      (fila) => fila.Estado === "Activo",
    ).length;

    return {
      registros: filasFiltradasPorCliente.length,
      activas,
      desactivadas: filasFiltradasPorCliente.length - activas,
      totalVenta: Number(totalVenta.toFixed(2)),
      diferencias: Number(diferencias.toFixed(2)),
    };
  }, [filasFiltradasPorCliente]);

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`, {
        params: { rol: "Vendedor" },
      });
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    }
  };

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data || []);
    } catch (error) {
      console.error("Error cargando agencias:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las agencias.",
      });
      setAgencias([]);
    }
  };

  const cargarCatalogosFiltros = async () => {
    try {
      const [modelosRes, origenesRes, dispositivosRes] = await Promise.all([
        axios.get(`${API_URL}/modelos`),
        axios.get(`${API_URL}/origen`),
        axios.get(`${API_URL}/dispositivos`),
      ]);

      setModelos(modelosRes.data || []);
      setOrigenes(origenesRes.data || []);
      setDispositivos(dispositivosRes.data || []);
    } catch (error) {
      console.error("Error cargando catalogos de filtros:", error);
      setModelos([]);
      setOrigenes([]);
      setDispositivos([]);
    }
  };

  useEffect(() => {
    cargarAgencias();
    cargarUsuarios();
    cargarCatalogosFiltros();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUsuarioInfo(decoded.usuario);
      } catch (error) {
        console.error("Error decodificando token:", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fechaInicio,
        fechaFin,
        agenciaId,
        vendedorId,
        modeloId,
        cierreCaja,
        origenId,
        dispositivoId,
        estado,
      }),
    );
  }, [
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    modeloId,
    cierreCaja,
    origenId,
    dispositivoId,
    estado,
  ]);

  const fetchData = async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams({
        fechaInicio,
        fechaFin,
      });

      if (agenciaId && agenciaId !== "todas") params.append("agenciaId", agenciaId);
      if (vendedorId && vendedorId !== "todos") params.append("vendedorId", vendedorId);
      if (modeloId && modeloId !== "todos") params.append("modeloId", modeloId);
      if (cierreCaja && cierreCaja !== "todos") params.append("cierreCaja", cierreCaja);
      if (origenId && origenId !== "todos") params.append("origenId", origenId);
      if (dispositivoId && dispositivoId !== "todos") {
        params.append("dispositivoId", dispositivoId);
      }
      if (estado && estado !== "todos") params.append("estado", estado);

      const url = `${API_URL}/auditoria/ventas?${params.toString()}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      const ventas = data.ventas || [];
      const resultado = ventas.map(mapVentaAuditoria);

      setFilas(resultado);
      setPdfResumen(null);
      setVistaResultados("todos");
      setFilaEditandoId("");
      setEdicionFila({});
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    const hoy = getHoyLocal();

    setFechaInicio(hoy);
    setFechaFin(hoy);
    setAgenciaId("");
    setVendedorId("");
    setModeloId("");
    setCierreCaja("");
    setOrigenId("");
    setDispositivoId("");
    setEstado("");
    setBusquedaCliente("");
    setVistaResultados("todos");
    setPdfResumen(null);
    setFilaEditandoId("");
    setEdicionFila({});
  };

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchData();
    }
  }, [
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    modeloId,
    cierreCaja,
    origenId,
    dispositivoId,
    estado,
    usuarioInfo,
  ]);

  const handlePdfFiles = (event) => {
    setPdfFiles(Array.from(event.target.files || []));
    setPdfResumen(null);
  };

  const auditarPdfs = async (event) => {
    event.preventDefault();

    if (!pdfFiles.length) {
      return Swal.fire("Atencion", "Selecciona al menos un PDF", "warning");
    }

    const formData = new FormData();
    formData.append("tipo", pdfTipo);
    formData.append("fechaInicio", fechaInicio || "");
    formData.append("fechaFin", fechaFin || "");
    formData.append("agenciaId", agenciaId || "");
    formData.append("vendedorId", vendedorId || "");
    formData.append("modeloId", modeloId || "");
    formData.append("cierreCaja", cierreCaja || "");
    formData.append("origenId", origenId || "");
    formData.append("dispositivoId", dispositivoId || "");
    formData.append("estado", estado || "");
    pdfFiles.forEach((file) => formData.append("pdfs", file));

    try {
      setPdfLoading(true);
      const { data } = await axios.post(
        `${API_URL}/auditoria/ventas/importar-pdf`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (!data.ok) return;

      setFilas((data.ventas || []).map(mapVentaAuditoria));
      setPdfResumen(data.resumen || null);
      setFilaEditandoId("");
      setEdicionFila({});

      Swal.fire(
        "Listo",
        `PDF: ${data.resumen?.dispositivosCreditoPdf ?? 0} | RVE credito: ${data.resumen?.dispositivosCreditoRve ?? 0} | Diferencia: ${data.resumen?.diferenciaCredito ?? 0}`,
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron auditar los PDFs",
        "error",
      );
    } finally {
      setPdfLoading(false);
    }
  };

  const generarReportePdf = () => {
    if (!filasVisibles.length) {
      Swal.fire({
        icon: "info",
        title: "Sin datos",
        text: "No hay ventas para generar el reporte con la vista seleccionada.",
      });
      return;
    }

    const filtros = [
      ["Fecha inicio", fechaInicio || "Todas"],
      ["Fecha fin", fechaFin || "Todas"],
      ["Agencia", obtenerNombreSeleccionado(agencias, agenciaId)],
      ["Vendedor", obtenerNombreSeleccionado(usuarios, vendedorId)],
      ["Modelo", obtenerNombreSeleccionado(modelos, modeloId)],
      ["Cierre de caja", cierreCaja || "Todos"],
      ["Origen", obtenerNombreSeleccionado(origenes, origenId)],
      ["Dispositivo", obtenerNombreSeleccionado(dispositivos, dispositivoId)],
      ["Cliente / Cedula", busquedaCliente.trim() || "Todos"],
      [
        "Estado",
        estado === "activo"
          ? "Activo"
          : estado === "desactivada"
            ? "Desactivada"
            : "Todos",
      ],
    ];

    const filasHtml = filasVisibles
      .map(
        (fila, index) => `
          <tr>
            <td>${index + 1}</td>
            ${TABLE_COLUMNS.map(
              (columna) =>
                `<td>${escaparHtml(getValorColumnaReporte(fila, columna))}</td>`,
            ).join("")}
          </tr>
        `,
      )
      .join("");

    const filtrosHtml = filtros
      .map(
        ([label, value]) =>
          `<div><strong>${escaparHtml(label)}:</strong> ${escaparHtml(value)}</div>`,
      )
      .join("");

    const ventana = window.open("", "_blank");
    if (!ventana) {
      Swal.fire({
        icon: "error",
        title: "Ventana bloqueada",
        text: "Permite ventanas emergentes para generar el PDF.",
      });
      return;
    }

    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Reporte Ventas Auditoria</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
            h1 { font-size: 18px; margin: 0 0 6px; }
            .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; font-size: 10px; margin: 10px 0 12px; }
            .summary { font-size: 11px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 8px; }
            th { background: #1f2937; color: white; }
            th, td { border: 1px solid #d1d5db; padding: 4px; text-align: left; vertical-align: top; }
            tr:nth-child(even) td { background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>Reporte Ventas Auditoria</h1>
          <div class="summary">Total de registros: ${filasVisibles.length}</div>
          <div class="meta">${filtrosHtml}</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                ${TABLE_COLUMNS.map((columna) => `<th>${escaparHtml(columna)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${filasHtml}</tbody>
          </table>
          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    ventana.document.close();
  };

  const exportarExcel = () => {
    if (!filasVisibles.length) {
      Swal.fire({
        icon: "info",
        title: "Sin datos",
        text: "No hay ventas para exportar con la vista seleccionada.",
      });
      return;
    }

    const filasExcel = filasVisibles.map((fila, index) => {
      const row = { "#": index + 1 };

      TABLE_COLUMNS.forEach((columna) => {
        row[columna] = getValorColumnaReporte(fila, columna);
      });

      return row;
    });

    const filtrosExcel = [
      ["Filtro", "Valor"],
      ["Fecha inicio", fechaInicio || "Todas"],
      ["Fecha fin", fechaFin || "Todas"],
      ["Agencia", obtenerNombreSeleccionado(agencias, agenciaId)],
      ["Vendedor", obtenerNombreSeleccionado(usuarios, vendedorId)],
      ["Modelo", obtenerNombreSeleccionado(modelos, modeloId)],
      ["Cierre de caja", cierreCaja || "Todos"],
      ["Origen", obtenerNombreSeleccionado(origenes, origenId)],
      ["Dispositivo", obtenerNombreSeleccionado(dispositivos, dispositivoId)],
      ["Cliente / Cedula", busquedaCliente.trim() || "Todos"],
      [
        "Estado",
        estado === "activo"
          ? "Activo"
          : estado === "desactivada"
            ? "Desactivada"
            : "Todos",
      ],
      ["Vista", vistaResultados === "errores" ? "Solo errores" : "Todos"],
      ["Registros exportados", filasVisibles.length],
    ];

    const worksheet = XLSX.utils.json_to_sheet(filasExcel);
    worksheet["!cols"] = [
      { wch: 6 },
      ...TABLE_COLUMNS.map((columna) => ({
        wch: Math.max(14, Math.min(36, columna.length + 8)),
      })),
    ];

    const filtrosSheet = XLSX.utils.aoa_to_sheet(filtrosExcel);
    filtrosSheet["!cols"] = [{ wch: 22 }, { wch: 36 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas Auditoria");
    XLSX.utils.book_append_sheet(workbook, filtrosSheet, "Filtros");

    const desde = fechaInicio || "todas";
    const hasta = fechaFin || "todas";
    XLSX.writeFile(workbook, `Ventas_Auditoria_${desde}_a_${hasta}.xlsx`);
  };

  const desactivarVenta = async (id) => {
    const confirm = await Swal.fire({
      title: "Desactivar venta?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, desactivar",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(`${API_URL}/ventas/${id}`, {
        activo: false,
      });

      setFilas((prev) =>
        prev.map((fila) =>
          fila.id === id ? { ...fila, Estado: "Desactivada" } : fila,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const iniciarEdicionFila = (fila) => {
    if (!fila.detalleVentaId) {
      Swal.fire("Sin venta", "Esta fila no tiene detalle de RVE para editar.", "info");
      return;
    }

    setFilaEditandoId(getFilaEditableId(fila));
    setEdicionFila({
      modeloId: fila.modeloId || "",
      precioVendedor: fila["Precio Vendedor"] ?? "",
      entrada: fila.Entrada ?? "",
      alcance: fila.Alcance ?? "",
      observacion: fila.Observacion ?? "",
    });
  };

  const cancelarEdicionFila = () => {
    setFilaEditandoId("");
    setEdicionFila({});
  };

  const actualizarCampoEdicion = (field, value) => {
    setEdicionFila((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const aplicarDetalleActualizado = (fila, data) => {
    const detalle = data.detalle || {};
    const precioVenta = toMoney(detalle.precioVenta);
    const precioVendedor = toMoney(detalle.precioVendedor);
    const modelo = `${detalle.marca ?? ""} ${detalle.modelo ?? ""}`.trim();

    return {
      ...fila,
      modeloId: detalle.modeloId ?? fila.modeloId,
      Modelo: modelo ? modelo.toUpperCase() : fila.Modelo,
      Dispositivo: detalle.dispositivo
        ? String(detalle.dispositivo).toUpperCase()
        : fila.Dispositivo,
      "Precio Carga": precioVenta,
      "Precio Vendedor": precioVendedor,
      Costo: toMoney(detalle.costo),
      Diferencia:
        precioVenta !== "" || precioVendedor !== ""
          ? Number((toNumber(precioVenta) - toNumber(precioVendedor)).toFixed(2))
          : "",
      "Precio Unitario":
        detalle.precioVendedor != null
          ? Number((Number(detalle.precioVendedor) / 1.15).toFixed(2))
          : fila["Precio Unitario"],
      Entrada: detalle.entrada ?? fila.Entrada,
      Alcance: detalle.alcance ?? fila.Alcance,
      Observacion: data.venta?.observacion ?? fila.Observacion,
    };
  };

  const guardarEdicionFila = async (fila) => {
    if (!fila.detalleVentaId) return;

    if (!edicionFila.modeloId) {
      Swal.fire("Modelo requerido", "Selecciona un modelo para guardar.", "warning");
      return;
    }

    const camposNumericos = ["precioVendedor", "entrada", "alcance"];
    const campoVacio = camposNumericos.find(
      (field) => edicionFila[field] === "" || edicionFila[field] === null,
    );

    if (campoVacio) {
      Swal.fire("Campos incompletos", "Precio vendedor, entrada y alcance son requeridos.", "warning");
      return;
    }

    const filaId = getFilaEditableId(fila);
    setGuardandoFilaId(filaId);

    try {
      const { data } = await axios.patch(
        `${API_URL}/auditoria/ventas/detalle/${fila.detalleVentaId}`,
        {
          modeloId: edicionFila.modeloId,
          precioVendedor: edicionFila.precioVendedor,
          entrada: edicionFila.entrada,
          alcance: edicionFila.alcance,
          observacion: edicionFila.observacion,
        },
      );

      if (!data.ok) return;

      setFilas((prev) =>
        prev.map((item) =>
          item.detalleVentaId === fila.detalleVentaId
            ? aplicarDetalleActualizado(item, data)
            : item,
        ),
      );
      cancelarEdicionFila();
      Swal.fire({
        icon: "success",
        title: "Fila actualizada",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo actualizar la fila.",
        "error",
      );
    } finally {
      setGuardandoFilaId("");
    }
  };

  const renderCell = (fila, key) => {
    const val = fila[key];
    const editando = filaEditandoId === getFilaEditableId(fila);

    if (editando && key === "Modelo") {
      return (
        <select
          value={edicionFila.modeloId}
          onChange={(event) => actualizarCampoEdicion("modeloId", event.target.value)}
          className="min-w-64 rounded border border-blue-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Selecciona modelo</option>
          {modelos.map((modelo) => (
            <option key={modelo.id} value={modelo.id}>
              {getModeloLabel(modelo)}
            </option>
          ))}
        </select>
      );
    }

    if (editando && key === "Precio Vendedor") {
      return (
        <input
          type="text"
          value={edicionFila.precioVendedor}
          onChange={(event) => {
            const value = normalizarDecimalInput(event.target.value);
            if (esDecimalEditable(value)) {
              actualizarCampoEdicion("precioVendedor", value);
            }
          }}
          className="w-24 rounded border border-blue-300 px-2 py-1 text-right text-xs font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      );
    }

    if (editando && key === "Entrada") {
      return (
        <input
          type="text"
          value={edicionFila.entrada}
          onChange={(event) => {
            const value = normalizarDecimalInput(event.target.value);
            if (esDecimalEditable(value)) {
              actualizarCampoEdicion("entrada", value);
            }
          }}
          className="w-24 rounded border border-blue-300 px-2 py-1 text-right text-xs font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      );
    }

    if (editando && key === "Alcance") {
      return (
        <input
          type="text"
          value={edicionFila.alcance}
          onChange={(event) => {
            const value = normalizarDecimalInput(event.target.value);
            if (esDecimalEditable(value)) {
              actualizarCampoEdicion("alcance", value);
            }
          }}
          className="w-24 rounded border border-blue-300 px-2 py-1 text-right text-xs font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      );
    }

    if (editando && key === "Observacion") {
      return (
        <input
          type="text"
          value={edicionFila.observacion}
          onChange={(event) => actualizarCampoEdicion("observacion", event.target.value)}
          className="min-w-56 rounded border border-blue-300 px-2 py-1 text-xs font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      );
    }

    if (key === "Modelo") {
      return (
        <div className="min-w-44">
          <div className="font-semibold text-gray-900">{val || "-"}</div>
        </div>
      );
    }

    if (key === "Estado") {
      return (
        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getEstadoBadge(val)}`}>
          {val}
        </span>
      );
    }

    if (key === "Observacion Error") {
      if (!val) return "-";

      const ok = val === "OK";
      return (
        <span
          className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${
            ok
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {val}
        </span>
      );
    }

    if (key === "Diferencia") {
      return formatearDiferenciaPrecio(val);
    }

    return val || "-";
  };

  const getCellClass = (fila, key) => {
    let clase = "px-3 py-2 align-top text-gray-700";

    if (key === "Precio Carga") {
      clase += " text-right font-semibold text-blue-700";
    }

    if (key === "Precio Vendedor") {
      clase += `${getPrecioVendedorClass(fila[key], fila["Precio Carga"])} text-right`;
    }

    if (key === "Diferencia") {
      const diferencia = Number(fila[key]) || 0;
      clase += " text-right";
      if (diferencia !== 0) {
        clase += diferencia > 0 ? " text-red-600 font-bold" : " text-green-600 font-semibold";
      } else {
        clase += " text-gray-600 font-semibold";
      }
    }

    if (
      [
        "Precio Unitario",
        "Entrada",
        "Entrada PDF",
        "Alcance",
        "Ventas PDF",
        "Costo",
      ].includes(key)
    ) {
      clase += " text-right tabular-nums";
    }

    if (key === "Observacion" || key === "Observacion Error") {
      clase += " max-w-64 whitespace-normal";
    } else {
      clase += " whitespace-nowrap";
    }

    return clase;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas Auditoria</h1>
          <p className="text-sm text-gray-600">
            Revision de ventas con precios, diferencias y referencias de PDF.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportarExcel}
            className="inline-flex items-center justify-center gap-2 rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>

          <button
            type="button"
            onClick={generarReportePdf}
            className="inline-flex items-center justify-center gap-2 rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            <FileText size={18} />
            PDF
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Registros" value={resumen.registros} />
        <Metric label="Activas" value={resumen.activas} tone="green" />
        <Metric label="Desactivadas" value={resumen.desactivadas} tone="red" />
        <Metric label="Total Venta" value={`$${resumen.totalVenta.toFixed(2)}`} tone="blue" />
        <Metric label="Diferencia" value={`$${resumen.diferencias.toFixed(2)}`} tone="slate" />
      </div>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">Filtros</h2>
          <button
            type="button"
            onClick={limpiarFiltros}
            className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <X size={14} />
            Limpiar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FiltroFecha label="Fecha Inicio" value={fechaInicio} onChange={setFechaInicio} />
          <FiltroFecha label="Fecha Fin" value={fechaFin} onChange={setFechaFin} />

          <FiltroSelect
            label="Agencia"
            value={agenciaId}
            onChange={setAgenciaId}
            options={agencias}
            emptyLabel="Todas"
          />

          <FiltroSelect
            label="Vendedor"
            value={vendedorId}
            onChange={setVendedorId}
            options={usuarios}
            emptyLabel="Todos"
            shortNames
          />

          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Modelo</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={modeloId}
              onChange={(e) => setModeloId(e.target.value)}
            >
              <option value="">Todos</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {getModeloLabel(m)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Cierre de caja</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={cierreCaja}
              onChange={(e) => setCierreCaja(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="CONTADO">Contado</option>
              <option value="CREDITV">CrediTV</option>
              <option value="UPHONE">Uphone</option>
            </select>
          </label>

          <FiltroSelect
            label="Origen"
            value={origenId}
            onChange={setOrigenId}
            options={origenes}
            emptyLabel="Todos"
          />

          <FiltroSelect
            label="Dispositivo"
            value={dispositivoId}
            onChange={setDispositivoId}
            options={dispositivos}
            emptyLabel="Todos"
          />

          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Estado</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="desactivada">Desactivada</option>
            </select>
          </label>
        </div>
      </section>

      <form
        onSubmit={auditarPdfs}
        className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-600" />
          <h2 className="text-sm font-bold text-gray-900">
            Auditoria desde PDFs
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[180px_1fr_auto] lg:items-end">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700">
              Tipo PDF
            </span>
            <select
              value={pdfTipo}
              onChange={(event) => {
                setPdfTipo(event.target.value);
                setPdfFiles([]);
                setPdfResumen(null);
              }}
              disabled={pdfLoading}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
            >
              <option value="TV">TV</option>
              <option value="CELULAR">Celular</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700">
              PDFs
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              onChange={handlePdfFiles}
              disabled={pdfLoading}
              className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-800 disabled:bg-gray-100"
            />
          </label>

          <button
            type="submit"
            disabled={pdfLoading || !pdfFiles.length}
            className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {pdfLoading ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <Upload size={16} />
            )}
            {pdfLoading ? "Auditando..." : "Auditar PDFs"}
          </button>
        </div>

        {pdfFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pdfFiles.map((file) => (
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

        {pdfResumen && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4 xl:grid-cols-8">
            <MiniStat label="PDFs" value={pdfResumen.pdfsProcesados} />
            <MiniStat label="Creditos PDF" value={pdfResumen.dispositivosCreditoPdf ?? pdfResumen.registrosPdf} tone="blue" />
            <MiniStat label="Creditos RVE" value={pdfResumen.dispositivosCreditoRve} tone="slate" />
            <MiniStat
              label="Dif. creditos"
              value={pdfResumen.diferenciaCredito}
              tone={getDiferenciaCreditoTone(pdfResumen.diferenciaCredito)}
            />
            <MiniStat label="Validos PDF" value={pdfResumen.registrosPdfValidos ?? pdfResumen.registrosPdf} />
            <MiniStat label="Comparados" value={pdfResumen.ventasComparadas} />
            <MiniStat
              label="Errores"
              value={pdfResumen.erroresDetectados}
              tone="red"
              active={vistaResultados === "errores"}
              onClick={() => setVistaResultados("errores")}
            />
            <MiniStat label="Extraccion" value={pdfResumen.erroresExtraccion} tone="amber" />
          </div>
        )}
      </form>

      {error && <p className="mb-3 font-semibold text-red-500">{error}</p>}

      {loading ? (
        <div className="rounded border border-gray-200 bg-white p-8 text-center text-gray-500">
          Cargando ventas...
        </div>
      ) : (
        <section className="max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Resultados</h2>
              <span className="text-xs text-gray-500">
                {filasVisibles.length} de {filasFiltradasPorCliente.length} registros
                {busquedaCliente.trim() ? ` (${filas.length} total)` : ""}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block text-xs font-semibold text-gray-600">
                <span className="mb-1 block">Cliente / Cedula</span>
                <div className="relative">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="search"
                    value={busquedaCliente}
                    onChange={(event) => setBusquedaCliente(event.target.value)}
                    placeholder="Nombre o cedula"
                    className="w-full rounded border border-gray-300 bg-white py-1.5 pl-8 pr-8 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72"
                  />
                  {busquedaCliente && (
                    <button
                      type="button"
                      onClick={() => setBusquedaCliente("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-gray-400 hover:text-gray-700"
                      aria-label="Limpiar busqueda"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </label>

              <label className="block text-xs font-semibold text-gray-600">
                <span className="mb-1 block">Vista</span>
                <select
                  value={vistaResultados}
                  onChange={(event) => setVistaResultados(event.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-auto"
                >
                  <option value="todos">Todos</option>
                  <option value="errores">Solo errores</option>
                </select>
              </label>
            </div>
          </div>

          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[2100px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-gray-100 text-left uppercase text-gray-600">
                <tr>
                  <th className="sticky left-0 z-20 border-b border-gray-200 bg-gray-100 px-3 py-2 text-center">
                    #
                  </th>
                  {TABLE_COLUMNS.map((key) => (
                    <th key={key} className="border-b border-gray-200 px-3 py-2">
                      {key}
                    </th>
                  ))}
                  <th className="border-b border-gray-200 px-3 py-2 text-center">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {filasVisibles.map((f, i) => (
                  <tr
                    key={`${f.id ?? "sin-venta"}-${f.detalleVentaId ?? i}`}
                    className={`border-b border-gray-100 hover:bg-blue-50/40 ${
                      filaEditandoId === getFilaEditableId(f) ? "bg-blue-50/60" : ""
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-center font-semibold text-gray-700">
                      {i + 1}
                    </td>

                    {TABLE_COLUMNS.map((key) => (
                      <td key={key} className={getCellClass(f, key)}>
                        {renderCell(f, key)}
                      </td>
                    ))}

                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {f.id ? (
                          filaEditandoId === getFilaEditableId(f) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => guardarEdicionFila(f)}
                                disabled={guardandoFilaId === getFilaEditableId(f)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                                title="Guardar cambios"
                              >
                                {guardandoFilaId === getFilaEditableId(f) ? (
                                  <RefreshCw className="animate-spin" size={16} />
                                ) : (
                                  <Save size={16} />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={cancelarEdicionFila}
                                disabled={guardandoFilaId === getFilaEditableId(f)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-60"
                                title="Cancelar edicion"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => iniciarEdicionFila(f)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded bg-amber-500 text-white hover:bg-amber-600"
                                title="Editar fila"
                              >
                                <Pencil size={16} />
                              </button>

                              <Link
                                to={`/ventas-auditoria/${f.id}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                                title="Ver detalle"
                              >
                                <Eye size={17} />
                              </Link>

                              <button
                                type="button"
                                onClick={() => desactivarVenta(f.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                                title="Desactivar venta"
                              >
                                <Trash size={17} />
                              </button>
                            </>
                          )
                        ) : (
                          <span className="text-xs font-semibold text-gray-400">
                            Sin venta
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filasVisibles.length === 0 && (
                  <tr>
                    <td
                      colSpan={TABLE_COLUMNS.length + 2}
                      className="px-3 py-10 text-center text-gray-500"
                    >
                      No hay registros para la vista seleccionada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function FiltroFecha({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <input
        type="date"
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FiltroSelect({ label, value, onChange, options, emptyLabel, shortNames = false }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <select
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {shortNames ? nombreCortoUsuario(option) : option.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, tone = "gray" }) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function MiniStat({ label, value, tone = "gray", active = false, onClick }) {
  const tones = {
    gray: "border-gray-200 bg-gray-50 text-gray-800",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    green: "border-green-200 bg-green-50 text-green-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  const className = `rounded border px-3 py-2 text-left transition ${
    tones[tone] || tones.gray
  } ${active ? "ring-2 ring-blue-400" : ""} ${
    onClick ? "cursor-pointer hover:brightness-95" : ""
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        <div className="font-semibold uppercase opacity-70">{label}</div>
        <div className="mt-0.5 text-base font-bold">{value ?? 0}</div>
      </button>
    );
  }

  return (
    <div className={className}>
      <div className="font-semibold uppercase opacity-70">{label}</div>
      <div className="mt-0.5 text-base font-bold">{value ?? 0}</div>
    </div>
  );
}
