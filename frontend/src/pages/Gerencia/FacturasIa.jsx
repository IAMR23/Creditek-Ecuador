import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileJson,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const API_BASE = "/api/gerencia/facturas-ia";
const filtrosIniciales = {
  busqueda: "",
  seleccionada: "",
  fechaInicio: "",
  fechaFin: "",
};

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const formatoMonto = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? money.format(number) : "-";
};

const formatoFecha = (value) => {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("es-EC", { dateStyle: "medium" });
};

const escaparHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const productosDe = (resultado) =>
  Array.isArray(resultado?.payloadNormalizado?.productos)
    ? resultado.payloadNormalizado.productos
    : [];

const descargarPlantillaJson = () => {
  const template = {
    proveedor: { nombre: "EMPRESA EJEMPLO CIA. LTDA.", ruc: "1790000000001" },
    factura: {
      numero: "001-001-000000001",
      fechaEmision: "2026-08-19",
      subtotal: 100,
      impuestos: 15,
      total: 115,
    },
    cliente: { nombre: "CLIENTE EJEMPLO", identificacion: "1700000000" },
    productos: [
      {
        codigo: "P001",
        descripcion: "PRODUCTO EJEMPLO",
        cantidad: 2,
        precioUnitario: 50,
        descuento: 0,
        total: 100,
      },
    ],
    textoCompleto: "Texto completo entregado por la IA",
    advertencias: [],
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(template, null, 2)], { type: "application/json;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "plantilla_factura_ia.json";
  anchor.click();
  URL.revokeObjectURL(url);
};

const construirExcel = (resultados) => {
  const rows = resultados.map((item) => ({
    ID: item.id,
    "Grupo de comparación": item.grupoComparacion,
    Recomendada: item.esRecomendada ? "SI" : "NO",
    Seleccionada: item.esSeleccionada ? "SI" : "NO",
    Puntaje: Number(item.puntaje || 0),
    "Archivo JSON": item.nombreArchivoJson,
    Proveedor: item.proveedor || "",
    "RUC proveedor": item.rucProveedor || "",
    "Número factura": item.numeroFactura || "",
    "Fecha emisión": item.fechaEmision
      ? new Date(`${item.fechaEmision}T12:00:00`)
      : null,
    Subtotal: item.subtotal === null ? null : Number(item.subtotal),
    Impuestos: item.impuestos === null ? null : Number(item.impuestos),
    Total: item.total === null ? null : Number(item.total),
    "Suma productos": item.totalProductosCalculado === null
      ? null
      : Number(item.totalProductosCalculado),
    "Diferencia productos-subtotal": item.diferenciaProductosSubtotal === null
      ? null
      : Number(item.diferenciaProductosSubtotal),
    "Diferencia subtotal+impuestos-total": item.diferenciaSubtotalImpuestosTotal === null
      ? null
      : Number(item.diferenciaSubtotalImpuestosTotal),
    "Cantidad productos": Number(item.cantidadProductos || 0),
    Advertencias: Array.isArray(item.advertencias) ? item.advertencias.join(" | ") : "",
    "Fecha carga": item.createdAt ? new Date(item.createdAt) : null,
  }));
  const productRows = resultados.flatMap((item) =>
    productosDe(item).map((product) => ({
      "ID resultado": item.id,
      "Grupo de comparación": item.grupoComparacion,
      Seleccionada: item.esSeleccionada ? "SI" : "NO",
      "Número factura": item.numeroFactura || "",
      Orden: product.orden,
      Código: product.codigo || "",
      Descripción: product.descripcion || "",
      Cantidad: product.cantidad,
      "Precio unitario": product.precioUnitario,
      Descuento: product.descuento,
      "Total fuente": product.totalFuente,
      "Total calculado": product.totalCalculado,
      "Total usado": product.totalUsado,
    })),
  );
  const invoiceSheet = XLSX.utils.json_to_sheet(rows, { cellDates: true });
  const productsSheet = XLSX.utils.json_to_sheet(productRows, { cellDates: true });
  invoiceSheet["!cols"] = [8, 28, 13, 13, 10, 24, 30, 18, 20, 15, 14, 14, 14, 16, 20, 28, 17, 48, 20]
    .map((wch) => ({ wch }));
  productsSheet["!cols"] = [12, 28, 13, 20, 9, 16, 36, 12, 16, 14, 14, 16, 14]
    .map((wch) => ({ wch }));
  if (rows.length) invoiceSheet["!autofilter"] = { ref: `A1:S${rows.length + 1}` };
  if (productRows.length) productsSheet["!autofilter"] = { ref: `A1:M${productRows.length + 1}` };

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Facturas IA", "Resumen de exportación"],
    ["Fecha de exportación", new Date()],
    ["Total de resultados", { f: `COUNTA('Facturas'!A2:A${Math.max(2, rows.length + 1)})` }],
    ["Resultados seleccionados", { f: `COUNTIF('Facturas'!D2:D${Math.max(2, rows.length + 1)},"SI")` }],
    ["Suma total seleccionada", { f: `SUMIF('Facturas'!D2:D${Math.max(2, rows.length + 1)},"SI",'Facturas'!M2:M${Math.max(2, rows.length + 1)})` }],
  ]);
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 24 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
  XLSX.utils.book_append_sheet(workbook, invoiceSheet, "Facturas");
  XLSX.utils.book_append_sheet(workbook, productsSheet, "Productos");
  XLSX.writeFile(
    workbook,
    `Facturas_IA_${new Date().toISOString().slice(0, 10)}.xlsx`,
    { cellDates: true },
  );
};

const escribirPdfImprimible = (windowRef, resultados) => {
  const sections = resultados.map((item) => {
    const products = productosDe(item);
    const productRows = products.map((product) => `
      <tr>
        <td>${escaparHtml(product.orden)}</td>
        <td>${escaparHtml(product.codigo || "")}</td>
        <td>${escaparHtml(product.descripcion || "")}</td>
        <td class="num">${escaparHtml(product.cantidad ?? "")}</td>
        <td class="num">${escaparHtml(product.precioUnitario ?? "")}</td>
        <td class="num">${escaparHtml(product.totalUsado ?? "")}</td>
      </tr>`).join("");
    return `
      <section class="invoice">
        <div class="invoice-title">
          <div><h2>${escaparHtml(item.grupoComparacion)}</h2><small>${escaparHtml(item.nombreArchivoJson)}</small></div>
          <div class="score">${escaparHtml(item.puntaje)} / 100${item.esSeleccionada ? " · SELECCIONADA" : ""}</div>
        </div>
        <div class="grid">
          <div><span>Proveedor</span><strong>${escaparHtml(item.proveedor || "-")}</strong></div>
          <div><span>RUC</span><strong>${escaparHtml(item.rucProveedor || "-")}</strong></div>
          <div><span>Factura</span><strong>${escaparHtml(item.numeroFactura || "-")}</strong></div>
          <div><span>Fecha</span><strong>${escaparHtml(item.fechaEmision || "-")}</strong></div>
          <div><span>Subtotal</span><strong>${escaparHtml(formatoMonto(item.subtotal))}</strong></div>
          <div><span>Impuestos</span><strong>${escaparHtml(formatoMonto(item.impuestos))}</strong></div>
          <div><span>Total factura</span><strong>${escaparHtml(formatoMonto(item.total))}</strong></div>
          <div><span>Suma productos</span><strong>${escaparHtml(formatoMonto(item.totalProductosCalculado))}</strong></div>
        </div>
        <table><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Cantidad</th><th>P. unitario</th><th>Total</th></tr></thead>
          <tbody>${productRows || '<tr><td colspan="6">Sin productos</td></tr>'}</tbody>
        </table>
        ${item.advertencias?.length ? `<div class="warnings"><strong>Advertencias:</strong> ${escaparHtml(item.advertencias.join(" | "))}</div>` : ""}
      </section>`;
  }).join("");
  windowRef.document.open();
  windowRef.document.write(`<!doctype html><html><head><meta charset="utf-8" />
    <title>Facturas IA</title><style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; } body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
    header { border-bottom: 2px solid #0f766e; margin-bottom: 14px; padding-bottom: 8px; }
    h1 { font-size: 20px; margin: 0; } header p { color: #64748b; font-size: 10px; margin: 4px 0 0; }
    .invoice { page-break-after: always; } .invoice:last-child { page-break-after: auto; }
    .invoice-title { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    h2 { font-size: 14px; margin: 0; } small { color: #64748b; } .score { font-size: 10px; font-weight: 700; color: #0f766e; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
    .grid div { background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px; }
    .grid span { display: block; color: #64748b; font-size: 8px; text-transform: uppercase; }
    .grid strong { display: block; font-size: 9px; margin-top: 2px; overflow-wrap: anywhere; }
    table { width: 100%; border-collapse: collapse; font-size: 8px; }
    th { background: #0f766e; color: white; text-align: left; } th, td { padding: 4px; border-bottom: 1px solid #cbd5e1; }
    .num { text-align: right; } .warnings { margin-top: 8px; background: #fffbeb; border: 1px solid #fde68a; padding: 6px; font-size: 8px; }
    </style></head><body><header><h1>Facturas IA</h1><p>Reporte generado ${escaparHtml(new Date().toLocaleString("es-EC"))} · ${resultados.length} resultado(s)</p></header>${sections}
    <script>window.onload=()=>{window.focus();window.print();};</script></body></html>`);
  windowRef.document.close();
};

export default function FacturasIa() {
  const [resultados, setResultados] = useState([]);
  const [resumen, setResumen] = useState({
    totalResultados: 0,
    totalSeleccionadas: 0,
    sumaTotalSeleccionadas: 0,
  });
  const [paginacion, setPaginacion] = useState({ page: 1, limit: 50, totalPaginas: 1 });
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciales);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [modalCarga, setModalCarga] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [grupoComparacion, setGrupoComparacion] = useState("");
  const [detalle, setDetalle] = useState(null);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const result of resultados) {
      const values = map.get(result.grupoComparacion) || [];
      values.push(result);
      map.set(result.grupoComparacion, values);
    }
    return [...map.entries()];
  }, [resultados]);

  const cargar = useCallback(async ({ page = 1, silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(API_BASE, {
        params: { ...filtrosAplicados, page, limit: paginacion.limit },
      });
      setResultados(Array.isArray(data.resultados) ? data.resultados : []);
      setResumen(data.resumen || {});
      setPaginacion((current) => ({ ...current, ...(data.paginacion || {}) }));
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "No se pudieron cargar las facturas IA.", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filtrosAplicados, paginacion.limit]);

  useEffect(() => {
    cargar({ page: 1 });
  }, [cargar]);

  const aplicarFiltros = (event) => {
    event.preventDefault();
    setPaginacion((current) => ({ ...current, page: 1 }));
    setFiltrosAplicados(filtros);
  };

  const subirArchivos = async () => {
    if (!archivos.length) {
      Swal.fire("Selecciona JSON", "Agrega al menos un archivo .json.", "warning");
      return;
    }
    try {
      setSubiendo(true);
      let total = 0;
      for (const file of archivos) {
        const formData = new FormData();
        formData.append("archivo", file);
        if (grupoComparacion.trim()) formData.append("grupoComparacion", grupoComparacion.trim());
        const { data } = await api.post(API_BASE, formData);
        total += data.resultados?.length || 0;
      }
      setModalCarga(false);
      setArchivos([]);
      setGrupoComparacion("");
      await cargar({ page: 1, silent: true });
      Swal.fire("Carga completada", `${total} factura(s) fueron registradas sin eliminar resultados anteriores.`, "success");
    } catch (error) {
      Swal.fire("No se pudo cargar", error.response?.data?.message || "Revisa que los archivos contengan JSON válido en UTF-8.", "error");
    } finally {
      setSubiendo(false);
    }
  };

  const seleccionar = async (result) => {
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Seleccionar mejor resultado",
      text: `Se marcará esta opción como seleccionada para ${result.grupoComparacion}. Los demás JSON se conservarán.`,
      showCancelButton: true,
      confirmButtonText: "Seleccionar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0f766e",
    });
    if (!confirmation.isConfirmed) return;
    try {
      await api.patch(`${API_BASE}/${result.id}/seleccionar`);
      await cargar({ page: paginacion.page, silent: true });
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "No se pudo seleccionar el resultado.", "error");
    }
  };

  const abrirDetalle = async (result) => {
    try {
      const { data } = await api.get(`${API_BASE}/${result.id}`);
      setDetalle(data.resultado);
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "No se pudo abrir el JSON completo.", "error");
    }
  };

  const obtenerExportacion = async () => {
    const { data } = await api.get(`${API_BASE}/exportacion`, { params: filtrosAplicados });
    const values = Array.isArray(data.resultados) ? data.resultados : [];
    if (!values.length) throw new Error("No existen resultados para exportar con los filtros actuales.");
    return values;
  };

  const exportarExcel = async () => {
    try {
      setExportando(true);
      construirExcel(await obtenerExportacion());
    } catch (error) {
      Swal.fire("No se pudo exportar", error.response?.data?.message || error.message, "error");
    } finally {
      setExportando(false);
    }
  };

  const exportarPdf = async () => {
    const printable = window.open("", "_blank");
    if (!printable) {
      Swal.fire("Ventana bloqueada", "Permite ventanas emergentes para generar el PDF.", "warning");
      return;
    }
    try {
      setExportando(true);
      printable.document.write("<p style='font-family:Arial;padding:24px'>Preparando reporte...</p>");
      printable.document.close();
      escribirPdfImprimible(printable, await obtenerExportacion());
    } catch (error) {
      printable.close();
      Swal.fire("No se pudo exportar", error.response?.data?.message || error.message, "error");
    } finally {
      setExportando(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-3 md:p-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="text-teal-700" size={22} />
              <h1 className="text-xl font-bold text-slate-950">Facturas IA</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">Carga resultados JSON, compáralos y conserva cada versión antes de seleccionar la mejor.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => cargar({ page: paginacion.page })} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-50">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Actualizar
            </button>
            <button type="button" onClick={exportarExcel} disabled={exportando || !resumen.totalResultados} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 disabled:opacity-50">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button type="button" onClick={exportarPdf} disabled={exportando || !resumen.totalResultados} className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 disabled:opacity-50">
              <FileText size={16} /> PDF
            </button>
            <button type="button" onClick={() => setModalCarga(true)} className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800">
              <Upload size={16} /> Cargar JSON
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Resultados cargados", resumen.totalResultados || 0],
            ["Facturas seleccionadas", resumen.totalSeleccionadas || 0],
            ["Suma total seleccionada", formatoMonto(resumen.sumaTotalSeleccionadas || 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <form onSubmit={aplicarFiltros} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[minmax(240px,1fr)_180px_160px_160px_auto]">
          <label className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={filtros.busqueda} onChange={(event) => setFiltros((current) => ({ ...current, busqueda: event.target.value }))} placeholder="Grupo, proveedor, RUC, factura..." className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-xs" />
          </label>
          <select value={filtros.seleccionada} onChange={(event) => setFiltros((current) => ({ ...current, seleccionada: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-3 text-xs">
            <option value="">Todas las opciones</option>
            <option value="true">Solo seleccionadas</option>
            <option value="false">No seleccionadas</option>
          </select>
          <input type="date" value={filtros.fechaInicio} onChange={(event) => setFiltros((current) => ({ ...current, fechaInicio: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-3 text-xs" aria-label="Fecha inicial" />
          <input type="date" value={filtros.fechaFin} onChange={(event) => setFiltros((current) => ({ ...current, fechaFin: event.target.value }))} className="h-9 rounded-md border border-slate-300 px-3 text-xs" aria-label="Fecha final" />
          <button className="h-9 rounded-md bg-slate-900 px-4 text-xs font-semibold text-white">Filtrar</button>
        </form>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-500"><RefreshCw className="mr-2 animate-spin" size={18} /> Cargando resultados...</div>
        ) : grupos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <FileJson size={42} className="mx-auto text-slate-300" />
            <h2 className="mt-3 text-sm font-bold text-slate-800">Aún no hay resultados JSON</h2>
            <p className="mt-1 text-xs text-slate-500">Carga una o varias respuestas de ChatGPT para comenzar la comparación.</p>
          </div>
        ) : (
          <section className="space-y-3">
            {grupos.map(([group, values]) => (
              <article key={group} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{group}</h2>
                    <p className="text-[11px] text-slate-500">{values.length} alternativa(s) visible(s) · compara puntaje y sumatorias</p>
                  </div>
                  {values.some((item) => item.esSeleccionada) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 size={13} /> Mejor resultado seleccionado</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">Pendiente de selección</span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] text-left text-xs">
                    <thead className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
                      <tr><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Proveedor / factura</th><th className="px-3 py-2 text-right">Subtotal</th><th className="px-3 py-2 text-right">Impuestos</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Suma productos</th><th className="px-3 py-2 text-right">Diferencia</th><th className="px-3 py-2">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {values.map((item) => {
                        const difference = Number(item.diferenciaProductosSubtotal);
                        const matches = Number.isFinite(difference) && Math.abs(difference) <= 0.02;
                        return (
                          <tr key={item.id} className={item.esSeleccionada ? "bg-emerald-50/60" : "hover:bg-slate-50"}>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-slate-900">{Number(item.puntaje).toFixed(0)}</span>
                                <span className="text-[10px] text-slate-400">/100</span>
                                {item.esRecomendada && <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700"><Star size={10} /> Recomendada</span>}
                                {item.esSeleccionada && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">Seleccionada</span>}
                              </div>
                              <p className="mt-1 max-w-44 truncate text-[10px] text-slate-500" title={item.nombreArchivoJson}>{item.nombreArchivoJson}</p>
                            </td>
                            <td className="px-3 py-3"><p className="max-w-60 truncate font-semibold text-slate-800">{item.proveedor || "Sin proveedor"}</p><p className="text-[10px] text-slate-500">{item.rucProveedor || "Sin RUC"} · {item.numeroFactura || "Sin número"} · {formatoFecha(item.fechaEmision)}</p></td>
                            <td className="px-3 py-3 text-right">{formatoMonto(item.subtotal)}</td>
                            <td className="px-3 py-3 text-right">{formatoMonto(item.impuestos)}</td>
                            <td className="px-3 py-3 text-right font-bold">{formatoMonto(item.total)}</td>
                            <td className="px-3 py-3 text-right"><p className="font-semibold">{formatoMonto(item.totalProductosCalculado)}</p><p className="text-[10px] text-slate-400">{item.cantidadProductos} producto(s)</p></td>
                            <td className={`px-3 py-3 text-right font-semibold ${matches ? "text-emerald-700" : "text-amber-700"}`}>{item.diferenciaProductosSubtotal === null ? "-" : formatoMonto(item.diferenciaProductosSubtotal)}</td>
                            <td className="px-3 py-3"><div className="flex gap-2"><button type="button" onClick={() => abrirDetalle(item)} className="inline-flex h-8 items-center gap-1 rounded border border-slate-300 px-2 text-[10px] font-semibold text-slate-700"><Eye size={13} /> Ver</button><button type="button" onClick={() => seleccionar(item)} disabled={item.esSeleccionada} className="inline-flex h-8 items-center gap-1 rounded bg-teal-700 px-2 text-[10px] font-semibold text-white disabled:opacity-40"><CheckCircle2 size={13} /> Elegir</button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </section>
        )}

        {paginacion.totalPaginas > 1 && (
          <div className="flex items-center justify-center gap-3 text-xs">
            <button type="button" disabled={paginacion.page <= 1} onClick={() => cargar({ page: paginacion.page - 1 })} className="rounded border border-slate-300 bg-white px-3 py-2 disabled:opacity-40">Anterior</button>
            <span>Página {paginacion.page} de {paginacion.totalPaginas}</span>
            <button type="button" disabled={paginacion.page >= paginacion.totalPaginas} onClick={() => cargar({ page: paginacion.page + 1 })} className="rounded border border-slate-300 bg-white px-3 py-2 disabled:opacity-40">Siguiente</button>
          </div>
        )}
      </div>

      {modalCarga && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-bold text-slate-900">Cargar respuestas JSON</h2><p className="text-[11px] text-slate-500">Máximo 2 MB por archivo. Puedes seleccionar varios.</p></div><button type="button" onClick={() => setModalCarga(false)} disabled={subiendo}><X size={18} /></button></div>
            <div className="space-y-4 p-4">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Grupo de comparación opcional</span><input value={grupoComparacion} onChange={(event) => setGrupoComparacion(event.target.value)} maxLength={160} placeholder="Ej. Factura combustible agosto" className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm" /><span className="mt-1 block text-[10px] text-slate-500">Usa el mismo grupo cuando las IAs escriban distinto el RUC o número de factura.</span></label>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-teal-300 bg-teal-50 p-5 text-center"><FileJson size={36} className="text-teal-700" /><span className="mt-2 text-sm font-bold text-teal-900">Seleccionar archivos JSON</span><span className="text-xs text-teal-700">Una factura, un arreglo o un objeto con la clave “facturas”</span><input type="file" accept="application/json,.json" multiple className="hidden" onChange={(event) => setArchivos([...event.target.files])} /></label>
              {archivos.length > 0 && <ul className="max-h-28 space-y-1 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600">{archivos.map((file) => <li key={`${file.name}-${file.lastModified}`} className="flex justify-between gap-2"><span className="truncate">{file.name}</span><span>{(file.size / 1024).toFixed(1)} KB</span></li>)}</ul>}
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800"><strong>Importante:</strong> el JSON original se conserva. Las sumatorias y normalizaciones se guardan por separado.</div>
              <button type="button" onClick={descargarPlantillaJson} className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 hover:underline"><FileJson size={14} /> Descargar plantilla JSON de ejemplo</button>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" onClick={() => setModalCarga(false)} disabled={subiendo} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold">Cancelar</button><button type="button" onClick={subirArchivos} disabled={subiendo || !archivos.length} className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white disabled:opacity-50">{subiendo ? <RefreshCw size={15} className="animate-spin" /> : <Upload size={15} />} Cargar</button></div>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-bold text-slate-900">{detalle.grupoComparacion}</h2><p className="text-[11px] text-slate-500">{detalle.nombreArchivoJson} · puntaje {detalle.puntaje}/100</p></div><button type="button" onClick={() => setDetalle(null)}><X size={18} /></button></div>
            <div className="max-h-[calc(94vh-60px)] space-y-4 overflow-auto p-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[
                ["Proveedor", detalle.proveedor || "-"], ["RUC", detalle.rucProveedor || "-"], ["Factura", detalle.numeroFactura || "-"], ["Fecha", formatoFecha(detalle.fechaEmision)], ["Subtotal", formatoMonto(detalle.subtotal)], ["Impuestos", formatoMonto(detalle.impuestos)], ["Total", formatoMonto(detalle.total)], ["Suma productos", formatoMonto(detalle.totalProductosCalculado)],
              ].map(([label, value]) => <div key={label} className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[9px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 break-words text-xs font-semibold text-slate-900">{value}</p></div>)}</div>
              {detalle.advertencias?.length > 0 && <div className="rounded-md border border-amber-200 bg-amber-50 p-3"><p className="flex items-center gap-2 text-xs font-bold text-amber-800"><AlertTriangle size={15} /> Advertencias</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">{detalle.advertencias.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div>}
              <div className="overflow-x-auto rounded border border-slate-200"><table className="w-full min-w-[700px] text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Descripción</th><th className="px-3 py-2 text-right">Cantidad</th><th className="px-3 py-2 text-right">Precio unitario</th><th className="px-3 py-2 text-right">Total fuente</th><th className="px-3 py-2 text-right">Total usado</th></tr></thead><tbody className="divide-y divide-slate-100">{productosDe(detalle).map((product) => <tr key={product.orden}><td className="px-3 py-2">{product.orden}</td><td className="px-3 py-2 font-medium">{product.descripcion || "-"}</td><td className="px-3 py-2 text-right">{product.cantidad ?? "-"}</td><td className="px-3 py-2 text-right">{product.precioUnitario ?? "-"}</td><td className="px-3 py-2 text-right">{product.totalFuente ?? "-"}</td><td className="px-3 py-2 text-right font-bold">{product.totalUsado ?? "-"}</td></tr>)}</tbody></table></div>
              <details className="rounded border border-slate-200"><summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-700">Ver JSON original conservado</summary><pre className="max-h-96 overflow-auto border-t border-slate-200 bg-slate-950 p-3 text-[11px] leading-5 text-slate-100">{JSON.stringify(detalle.payloadOriginal, null, 2)}</pre></details>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
