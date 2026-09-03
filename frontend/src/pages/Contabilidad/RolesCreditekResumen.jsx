/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import { descargarExcelResumenRoles } from "../../utils/rolesCreditekResumenExcel";

const ahora = new Date();
const CAMPOS_MANUALES = [
  "adelantosTransfer",
  "deudaJimena",
  "atrasos",
  "diasNoLaborables",
  "planmovi",
  "prestamo",
  "mecanica",
  "pagosLentes",
];
const CAMPOS_CALCULADOS = [
  "descuentosMeta",
  "cajaGeneral",
  "entradas",
  "transferencias",
  "descuentos",
  "jefes",
  "multasFacturacion",
  "otros",
];
const CAMPOS_PRESTAMOS = ["planmovi", "prestamo", "mecanica", "pagosLentes"];
const CAMPOS_INGRESOS = ["ingresosComisiones"];
const CAMPOS_NOMINA_MANUALES = ["sueldo"];
const CAMPOS_ANTICIPOS = [
  "adelantosTransfer",
  ...CAMPOS_CALCULADOS,
  ...CAMPOS_MANUALES.filter((campo) => campo !== "adelantosTransfer"),
].filter((campo) => !CAMPOS_PRESTAMOS.includes(campo));
const CAMPOS_VALORES = [...CAMPOS_ANTICIPOS, ...CAMPOS_PRESTAMOS];
const CAMPOS_GUARDADO = [...CAMPOS_MANUALES, ...CAMPOS_NOMINA_MANUALES];
const CAMPOS_MANUALES_FINALES = CAMPOS_MANUALES.filter(
  (campo) =>
    campo !== "adelantosTransfer" && !CAMPOS_PRESTAMOS.includes(campo),
);
const ETIQUETAS_CAMPOS = {
  adelantosTransfer: "Adelantos transfer",
  descuentosMeta: "Descuentos por meta",
  cajaGeneral: "Caja general",
  entradas: "Entradas",
  transferencias: "Transferencias",
  descuentos: "Descuentos",
  jefes: "Jefes",
  multasFacturacion: "Multas facturacion",
  otros: "Otros",
  deudaJimena: "Deuda Jimena",
  atrasos: "Atrasos",
  diasNoLaborables: "Dias no laborables",
  planmovi: "Planmovi",
  prestamo: "Prestamo",
  mecanica: "Mecanica",
  pagosLentes: "Pagos de lentes",
};
const TOTAL_COLUMNAS_EGRESOS =
  1 + CAMPOS_ANTICIPOS.length + 1 + CAMPOS_PRESTAMOS.length + 1 + 1;
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const numero = (value) => {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const redondear = (value) => Number(numero(value).toFixed(2));

const formatoDinero = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatoNumero = (value) =>
  new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero(value));

const tieneCampo = (obj, campo) =>
  Object.prototype.hasOwnProperty.call(obj || {}, campo);

const valorCampo = (row, campo, drafts) => {
  const draft = drafts[String(row.usuarioId)];
  if (tieneCampo(draft, campo)) {
    return CAMPOS_CALCULADOS.includes(campo) && draft[campo] === ""
      ? row[`${campo}Calculado`]
      : draft[campo];
  }
  return row[campo];
};

const valorInput = (row, campo, drafts) => {
  const draft = drafts[String(row.usuarioId)];
  if (tieneCampo(draft, campo)) {
    return draft[campo];
  }

  if (CAMPOS_CALCULADOS.includes(campo)) {
    const value = row[`${campo}Manual`];
    return value === null || value === undefined
      ? ""
      : String(value).replace(",", ".");
  }

  const value = row[campo];
  return numero(value) === 0 ? "" : String(value).replace(",", ".");
};

const totalAnticiposFila = (row, drafts) =>
  redondear(
    CAMPOS_ANTICIPOS.reduce(
      (total, campo) => total + numero(valorCampo(row, campo, drafts)),
      0,
    ),
  );

const sumanPrestamosFila = (row, drafts) =>
  redondear(
    CAMPOS_PRESTAMOS.reduce(
      (total, campo) => total + numero(valorCampo(row, campo, drafts)),
      0,
    ),
  );

const totalDescuentosFila = (row, drafts) =>
  redondear(totalAnticiposFila(row, drafts) + sumanPrestamosFila(row, drafts));

const totalNominaFila = (row, drafts) =>
  redondear(numero(row.ingresosComisiones) - totalDescuentosFila(row, drafts));

const totalPagarNominaFila = (row, drafts) =>
  redondear(totalNominaFila(row, drafts) + numero(valorCampo(row, "sueldo", drafts)));

const InputValor = ({
  row,
  campo,
  drafts,
  onChange,
  disabled,
  calculado = false,
}) => (
  <div className="relative min-w-28">
    <span
      className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold ${
        calculado ? "text-blue-700" : "text-amber-700"
      }`}
    >
      $
    </span>
    <input
      type="text"
      inputMode="decimal"
      value={valorInput(row, campo, drafts)}
      placeholder={calculado ? formatoNumero(row[`${campo}Calculado`]) : undefined}
      title={calculado ? `Calculado: ${formatoDinero.format(numero(row[`${campo}Calculado`]))}` : undefined}
      onChange={(event) => onChange(row, campo, event.target.value)}
      disabled={disabled}
      aria-label={`${campo} de ${row.nombre}`}
      className={`h-9 w-full rounded-md border pl-6 pr-2 text-right text-sm font-semibold text-slate-800 outline-none transition disabled:opacity-60 ${
        calculado
          ? "border-blue-300 bg-blue-50 placeholder:text-blue-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          : "border-amber-300 bg-amber-50 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
      }`}
    />
  </div>
);

const limpiarPdf = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

const textoPdf = (text, x, y, size = 8) =>
  `BT /F1 ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${limpiarPdf(text)}) Tj ET\n`;

const descargarPdfTabla = ({ titulo, subtitulo, columnas, filas, archivo }) => {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 28;
  const rowHeight = 18;
  const headerY = pageHeight - 86;
  const rowsPerPage = 24;
  const pages = [];

  for (let index = 0; index < Math.max(filas.length, 1); index += rowsPerPage) {
    pages.push(filas.slice(index, index + rowsPerPage));
  }

  const objects = {};
  const pageIds = [];
  let nextId = 4;

  pages.forEach((pageRows, pageIndex) => {
    let content = "";
    content += "0.2 w\n";
    content += textoPdf(titulo, margin, pageHeight - 34, 15);
    content += textoPdf(subtitulo, margin, pageHeight - 54, 9);
    content += textoPdf(`Pagina ${pageIndex + 1} de ${pages.length}`, pageWidth - 104, pageHeight - 34, 8);

    let x = margin;
    columnas.forEach((column) => {
      content += textoPdf(column.label, x + 2, headerY, 7);
      x += column.width;
    });
    content += `${margin} ${headerY - 5} m ${pageWidth - margin} ${headerY - 5} l S\n`;

    pageRows.forEach((row, rowIndex) => {
      const y = headerY - 24 - rowIndex * rowHeight;
      let currentX = margin;
      columnas.forEach((column) => {
        const rawValue = column.getValue(row);
        const value = column.money ? formatoDinero.format(numero(rawValue)) : rawValue;
        const maxChars = Math.max(8, Math.floor(column.width / 4.6));
        const text = String(value ?? "").slice(0, maxChars);
        const textX =
          column.align === "right"
            ? currentX + column.width - Math.min(column.width - 4, text.length * 4.2) - 2
            : currentX + 2;
        content += textoPdf(text, textX, y, 7);
        currentX += column.width;
      });
    });

    if (!pageRows.length) {
      content += textoPdf("No hay registros para mostrar.", margin, headerY - 30, 9);
    }

    const contentId = nextId++;
    const pageId = nextId++;
    objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}endstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    pageIds.push(pageId);
  });

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  const orderedIds = Object.keys(objects).map(Number).sort((a, b) => a - b);
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  orderedIds.forEach((id) => {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${orderedIds.length + 1}\n0000000000 65535 f \n`;
  orderedIds.forEach((id) => {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${orderedIds.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = archivo;
  link.click();
  URL.revokeObjectURL(url);
};

export default function RolesCreditekResumen() {
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [ingresosRows, setIngresosRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [tabActiva, setTabActiva] = useState("egresos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(null);
  const draftsRef = useRef(drafts);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const cargar = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(
        "/api/contabilidad/roles-creditek-resumen",
        { params: { anio, mes } },
      );
      const registros = Array.isArray(data.registros) ? data.registros : [];
      setRows(registros);
      setIngresosRows(Array.isArray(data.ingresos) ? data.ingresos : registros);
      setDrafts({});
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cargar el resumen de roles.",
        "error",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [anio, mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarPeriodo = async (nextAnio, nextMes) => {
    if (nextAnio === anio && nextMes === mes) return;
    if (Object.keys(draftsRef.current).length) {
      const confirmacion = await Swal.fire({
        title: "Cambios pendientes",
        text: "Los valores manuales sin guardar se descartaran al cambiar de periodo.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Cambiar periodo",
        cancelButtonText: "Cancelar",
      });
      if (!confirmacion.isConfirmed) return;
    }
    setAnio(nextAnio);
    setMes(nextMes);
  };

  const cambiarManual = (row, campo, value) => {
    const esCalculado = CAMPOS_CALCULADOS.includes(campo);
    if (!CAMPOS_GUARDADO.includes(campo) && !esCalculado) return;
    const valorNormalizado = value.replace(/,/g, ".");
    if (esCalculado && valorNormalizado === "") {
      setDrafts((actuales) => ({
        ...actuales,
        [String(row.usuarioId)]: {
          ...(actuales[String(row.usuarioId)] || {}),
          [campo]: "",
        },
      }));
      return;
    }
    if (!/^\d{0,10}(\.\d{0,2})?$/.test(valorNormalizado)) return;
    setDrafts((actuales) => ({
      ...actuales,
      [String(row.usuarioId)]: {
        ...(actuales[String(row.usuarioId)] || {}),
        [campo]: valorNormalizado,
      },
    }));
  };

  const guardar = async () => {
    const modificados = rows.filter((row) => drafts[String(row.usuarioId)]);
    if (!modificados.length) return;
    const registros = modificados.map((row) => {
      const draft = drafts[String(row.usuarioId)] || {};
      return {
        usuarioId: row.usuarioId,
        ...Object.fromEntries(
          CAMPOS_MANUALES.map((campo) => [
            campo,
            numero(valorCampo(row, campo, drafts)),
          ]),
        ),
        ...Object.fromEntries(
          CAMPOS_NOMINA_MANUALES.map((campo) => [
            campo,
            numero(valorCampo(row, campo, drafts)),
          ]),
        ),
        ...Object.fromEntries(
          CAMPOS_CALCULADOS.map((campo) => {
            const campoManual = `${campo}Manual`;
            const value = tieneCampo(draft, campo)
              ? draft[campo]
              : row[campoManual];
            return [
              campoManual,
              value === "" || value === null || value === undefined
                ? null
                : numero(value),
            ];
          }),
        ),
      };
    });

    try {
      setSaving(true);
      const { data } = await api.put(
        "/api/contabilidad/roles-creditek-resumen",
        { anio, mes, registros },
      );
      await cargar({ silent: true });
      Swal.fire({
        icon: "success",
        title: "Valores guardados",
        text: `${data.total} colaborador(es) actualizado(s).`,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron guardar los valores.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const rowsFiltradas = useMemo(() => {
    const query = normalizarTexto(busqueda);
    if (!query) return rows;
    return rows.filter(
      (row) =>
        normalizarTexto(row.nombre).includes(query) ||
        String(row.usuarioId).includes(query),
    );
  }, [busqueda, rows]);

  const ingresosFiltrados = useMemo(() => {
    const query = normalizarTexto(busqueda);
    if (!query) return ingresosRows;
    return ingresosRows.filter(
      (row) =>
        normalizarTexto(row.nombre).includes(query) ||
        normalizarTexto(row.cargo).includes(query) ||
        String(row.usuarioId).includes(query),
    );
  }, [busqueda, ingresosRows]);

  const totales = useMemo(() => {
    const resultado = Object.fromEntries(
      [
        ...CAMPOS_INGRESOS,
        ...CAMPOS_VALORES,
        "totalAnticipos",
        "sumanPrestamos",
        "totalDescuentos",
        "sueldo",
        "totalNomina",
        "totalPagarNomina",
      ].map((campo) => [campo, 0]),
    );
    ingresosFiltrados.forEach((row) => {
      CAMPOS_INGRESOS.forEach((campo) => {
        resultado[campo] += numero(row[campo]);
      });
    });
    rowsFiltradas.forEach((row) => {
      CAMPOS_VALORES.forEach((campo) => {
        resultado[campo] += numero(valorCampo(row, campo, drafts));
      });
      resultado.totalAnticipos += totalAnticiposFila(row, drafts);
      resultado.sumanPrestamos += sumanPrestamosFila(row, drafts);
      resultado.totalDescuentos += totalDescuentosFila(row, drafts);
      resultado.sueldo += numero(valorCampo(row, "sueldo", drafts));
      resultado.totalNomina += totalNominaFila(row, drafts);
      resultado.totalPagarNomina += totalPagarNominaFila(row, drafts);
    });
    Object.keys(resultado).forEach((campo) => {
      resultado[campo] = redondear(resultado[campo]);
    });
    return resultado;
  }, [drafts, ingresosFiltrados, rowsFiltradas]);

  const exportarExcel = async (seccionId = null) => {
    if (exportandoExcel) return;

    const anticiposColumns = [
      "adelantosTransfer",
      ...CAMPOS_CALCULADOS,
      ...CAMPOS_MANUALES_FINALES,
    ].map((campo) => ({
      key: campo,
      label: ETIQUETAS_CAMPOS[campo],
      calculated: CAMPOS_CALCULADOS.includes(campo),
    }));
    const prestamosColumns = CAMPOS_PRESTAMOS.map((campo) => ({
      key: campo,
      label: ETIQUETAS_CAMPOS[campo],
    }));
    const payload = {
      anio,
      mes,
      period: `${MESES[mes - 1]} ${anio}`,
      anticiposColumns,
      prestamosColumns,
      ingresos: ingresosFiltrados.map((row) => ({
        nombre: row.nombre,
        ingresos: numero(row.ingresosComisiones),
      })),
      egresos: rowsFiltradas.map((row) => ({
        nombre: row.nombre,
        anticipos: anticiposColumns.map(({ key }) =>
          numero(valorCampo(row, key, drafts)),
        ),
        totalAnticipos: totalAnticiposFila(row, drafts),
        prestamos: CAMPOS_PRESTAMOS.map((campo) =>
          numero(valorCampo(row, campo, drafts)),
        ),
        sumanPrestamos: sumanPrestamosFila(row, drafts),
        totalDescuentos: totalDescuentosFila(row, drafts),
      })),
      nomina: rowsFiltradas.map((row) => ({
        nombre: row.nombre,
        ingresos: numero(row.ingresosComisiones),
        egresos: totalDescuentosFila(row, drafts),
        nomina: totalNominaFila(row, drafts),
        sueldo: numero(valorCampo(row, "sueldo", drafts)),
        total: totalPagarNominaFila(row, drafts),
      })),
    };
    const exportKey = seccionId || "general";

    try {
      setExportandoExcel(exportKey);
      await descargarExcelResumenRoles(payload, seccionId);
    } catch (error) {
      Swal.fire(
        "Error",
        error?.message || "No se pudo generar el archivo Excel.",
        "error",
      );
    } finally {
      setExportandoExcel(null);
    }
  };

  const exportarPdf = () => {
    const periodoLabel = `${MESES[mes - 1]} ${anio}`;
    const baseFile = `Roles_Creditek_${tabActiva}_${anio}_${String(mes).padStart(2, "0")}.pdf`;

    if (tabActiva === "ingresos") {
      descargarPdfTabla({
        titulo: "Ingresos Creditek",
        subtitulo: periodoLabel,
        archivo: baseFile,
        columnas: [
          { label: "Personal", width: 520, getValue: (row) => row.nombre },
          {
            label: "Ingresos",
            width: 260,
            align: "right",
            money: true,
            getValue: (row) => row.ingresosComisiones,
          },
        ],
        filas: [
          ...ingresosFiltrados,
          { nombre: "TOTAL", ingresosComisiones: totales.ingresosComisiones },
        ],
      });
      return;
    }

    if (tabActiva === "nomina") {
      descargarPdfTabla({
        titulo: "Nomina Creditek",
        subtitulo: periodoLabel,
        archivo: baseFile,
        columnas: [
          { label: "Personal", width: 250, getValue: (row) => row.nombre },
          {
            label: "Ingresos",
            width: 106,
            align: "right",
            money: true,
            getValue: (row) => row.ingresosComisiones,
          },
          {
            label: "Egresos",
            width: 106,
            align: "right",
            money: true,
            getValue: (row) =>
              row.esTotal ? row.totalDescuentos : totalDescuentosFila(row, drafts),
          },
          {
            label: "Nomina",
            width: 106,
            align: "right",
            money: true,
            getValue: (row) =>
              row.esTotal ? row.totalNomina : totalNominaFila(row, drafts),
          },
          {
            label: "Sueldo",
            width: 106,
            align: "right",
            money: true,
            getValue: (row) => valorCampo(row, "sueldo", drafts),
          },
          {
            label: "Total",
            width: 106,
            align: "right",
            money: true,
            getValue: (row) =>
              row.esTotal
                ? row.totalPagarNomina
                : totalPagarNominaFila(row, drafts),
          },
        ],
        filas: [
          ...rowsFiltradas,
          {
            nombre: "TOTAL",
            esTotal: true,
            ingresosComisiones: totales.ingresosComisiones,
            totalDescuentos: totales.totalDescuentos,
            totalNomina: totales.totalNomina,
            sueldo: totales.sueldo,
            totalPagarNomina: totales.totalPagarNomina,
          },
        ],
      });
      return;
    }

    descargarPdfTabla({
      titulo: "Egresos Creditek",
      subtitulo: periodoLabel,
      archivo: baseFile,
      columnas: [
        { label: "Personal", width: 98, getValue: (row) => row.nombre },
        ...CAMPOS_ANTICIPOS.map((campo) => ({
          label: ETIQUETAS_CAMPOS[campo],
          width: 40,
          align: "right",
          getValue: (row) => valorCampo(row, campo, drafts),
        })),
        {
          label: "Anticipos",
          width: 48,
          align: "right",
          getValue: (row) => totalAnticiposFila(row, drafts),
        },
        ...CAMPOS_PRESTAMOS.map((campo) => ({
          label: ETIQUETAS_CAMPOS[campo],
          width: 40,
          align: "right",
          getValue: (row) => valorCampo(row, campo, drafts),
        })),
        {
          label: "Prestamos",
          width: 48,
          align: "right",
          getValue: (row) => sumanPrestamosFila(row, drafts),
        },
        {
          label: "Descuentos",
          width: 52,
          align: "right",
          getValue: (row) => totalDescuentosFila(row, drafts),
        },
      ],
      filas: rowsFiltradas,
    });
  };

  const cambios = Object.keys(drafts).length;
  const anios = Array.from({ length: 7 }, (_, index) => ahora.getFullYear() - 3 + index);

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-5">
      <div className="mx-auto max-w-[1800px] space-y-4">
        <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <Calculator size={16} /> Contabilidad / Roles Creditek
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Resumen de egresos Creditek
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Los valores azules se calculan desde Egresos y Pagos comisiones,
                y se pueden reemplazar manualmente cuando sea necesario.
                Los valores amarillos se ingresan manualmente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={mes}
                onChange={(event) => cambiarPeriodo(anio, Number(event.target.value))}
                disabled={loading || saving}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
                aria-label="Mes"
              >
                {MESES.map((label, index) => (
                  <option key={label} value={index + 1}>{label}</option>
                ))}
              </select>
              <select
                value={anio}
                onChange={(event) => cambiarPeriodo(Number(event.target.value), mes)}
                disabled={loading || saving}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
                aria-label="Anio"
              >
                {anios.map((value) => <option key={value}>{value}</option>)}
              </select>
              <button
                type="button"
                onClick={() => cargar()}
                disabled={loading || saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => exportarExcel()}
                disabled={
                  !(rowsFiltradas.length || ingresosFiltrados.length) ||
                  loading ||
                  Boolean(exportandoExcel)
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {exportandoExcel === "general" ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={17} />
                )}
                Excel general
              </button>
              <button
                type="button"
                onClick={() => exportarExcel(tabActiva)}
                disabled={
                  loading ||
                  Boolean(exportandoExcel) ||
                  (tabActiva === "ingresos"
                    ? !ingresosFiltrados.length
                    : !rowsFiltradas.length)
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                title={`Descargar solamente la seccion de ${tabActiva}`}
              >
                {exportandoExcel === tabActiva ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={17} />
                )}
                Excel {tabActiva === "nomina" ? "Nomina" : tabActiva[0].toUpperCase() + tabActiva.slice(1)}
              </button>
              <button
                type="button"
                onClick={exportarPdf}
                disabled={!(rowsFiltradas.length || ingresosFiltrados.length) || loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                <FileText size={17} /> PDF
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={!cambios || loading || saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={17} />
                {saving ? "Guardando..." : `Guardar${cambios ? ` (${cambios})` : ""}`}
              </button>
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {[
                { id: "ingresos", label: "Ingresos" },
                { id: "egresos", label: "Egresos" },
                { id: "nomina", label: "Nomina" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabActiva(tab.id)}
                  className={`h-9 rounded-lg border px-4 text-sm font-bold transition ${
                    tabActiva === tab.id
                      ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                {tabActiva === "ingresos" ? ingresosFiltrados.length : rowsFiltradas.length} colaboradores
              </span>
            </div>
            <label className="relative block sm:w-72">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar colaborador..."
                className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          {tabActiva === "ingresos" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  <th className="sticky left-0 z-20 w-64 border-b border-r border-slate-300 bg-slate-100 px-4 py-3 text-left">Personal</th>
                  <th className="w-64 border-b border-slate-300 bg-emerald-700 px-4 py-3 text-right text-white">Total Comisiones Semana + Mensual</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="2" className="px-4 py-14 text-center font-semibold text-slate-500">Calculando resumen del periodo...</td></tr>
                ) : ingresosFiltrados.length === 0 ? (
                  <tr><td colSpan="2" className="px-4 py-14 text-center text-slate-500">No hay colaboradores para mostrar.</td></tr>
                ) : ingresosFiltrados.map((row, index) => (
                  <tr key={row.usuarioId} className={index % 2 ? "bg-slate-50/60" : "bg-white"}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-4 py-2.5 font-bold text-slate-800">{row.nombre}</td>
                    <td className="border-b border-slate-200 bg-emerald-50/60 px-4 py-2.5 text-right text-base font-extrabold text-emerald-900">{formatoDinero.format(numero(row.ingresosComisiones))}</td>
                  </tr>
                ))}
              </tbody>
              {!loading && ingresosFiltrados.length > 0 && (
                <tfoot>
                  <tr className="font-extrabold text-white">
                    <td className="sticky bottom-0 left-0 z-30 border-r border-emerald-800 bg-emerald-800 px-4 py-3 text-left uppercase">Total</td>
                    <td className="sticky bottom-0 z-20 bg-emerald-700 px-4 py-3 text-right text-base">{formatoDinero.format(totales.ingresosComisiones)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          ) : tabActiva === "nomina" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  <th className="sticky left-0 z-20 w-72 border-b border-r border-slate-300 bg-slate-100 px-4 py-3 text-left">Personal</th>
                  <th className="w-44 border-b border-r border-slate-300 bg-emerald-700 px-4 py-3 text-right text-white">Ingresos</th>
                  <th className="w-44 border-b border-r border-slate-300 bg-rose-100 px-4 py-3 text-right text-rose-900">Egresos</th>
                  <th className="w-44 border-b border-r border-slate-300 bg-blue-700 px-4 py-3 text-right text-white">Nomina</th>
                  <th className="w-44 border-b border-r border-slate-300 bg-amber-100 px-4 py-3 text-right text-amber-900">Sueldo</th>
                  <th className="w-44 border-b border-slate-300 bg-green-500 px-4 py-3 text-right text-slate-950">Total</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="px-4 py-14 text-center font-semibold text-slate-500">Calculando resumen del periodo...</td></tr>
                ) : rowsFiltradas.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-14 text-center text-slate-500">No hay colaboradores para mostrar.</td></tr>
                ) : rowsFiltradas.map((row, index) => (
                  <tr key={row.usuarioId} className={index % 2 ? "bg-slate-50/60" : "bg-white"}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-4 py-2.5 font-bold text-slate-800">{row.nombre}</td>
                    <td className="border-b border-r border-slate-200 bg-emerald-50/60 px-4 py-2.5 text-right text-base font-extrabold text-emerald-900">{formatoDinero.format(numero(row.ingresosComisiones))}</td>
                    <td className="border-b border-r border-slate-200 bg-rose-50/60 px-4 py-2.5 text-right text-base font-extrabold text-rose-900">{formatoDinero.format(totalDescuentosFila(row, drafts))}</td>
                    <td className="border-b border-r border-slate-200 bg-blue-50/70 px-4 py-2.5 text-right text-base font-extrabold text-blue-900">{formatoDinero.format(totalNominaFila(row, drafts))}</td>
                    <td className="border-b border-r border-slate-200 px-2 py-1.5">
                      <InputValor row={row} campo="sueldo" drafts={drafts} onChange={cambiarManual} disabled={saving} />
                    </td>
                    <td className="border-b border-slate-200 bg-green-50 px-4 py-2.5 text-right text-base font-extrabold text-green-900">{formatoDinero.format(totalPagarNominaFila(row, drafts))}</td>
                  </tr>
                ))}
              </tbody>
              {!loading && rowsFiltradas.length > 0 && (
                <tfoot>
                  <tr className="font-extrabold text-white">
                    <td className="sticky bottom-0 left-0 z-30 border-r border-blue-800 bg-blue-800 px-4 py-3 text-left uppercase">Total</td>
                    <td className="sticky bottom-0 z-20 border-r border-emerald-800 bg-emerald-700 px-4 py-3 text-right text-base">{formatoDinero.format(totales.ingresosComisiones)}</td>
                    <td className="sticky bottom-0 z-20 border-r border-rose-800 bg-rose-700 px-4 py-3 text-right text-base">{formatoDinero.format(totales.totalDescuentos)}</td>
                    <td className="sticky bottom-0 z-20 border-r border-blue-800 bg-blue-700 px-4 py-3 text-right text-base">{formatoDinero.format(totales.totalNomina)}</td>
                    <td className="sticky bottom-0 z-20 border-r border-amber-600 bg-amber-500 px-4 py-3 text-right text-base text-slate-950">{formatoDinero.format(totales.sueldo)}</td>
                    <td className="sticky bottom-0 z-20 bg-green-500 px-4 py-3 text-right text-base text-slate-950">{formatoDinero.format(totales.totalPagarNomina)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[3120px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  <th rowSpan="2" className="sticky left-0 z-20 w-64 border-b border-r border-slate-300 bg-slate-100 px-4 py-3 text-left">Personal</th>
                  <th className="border-b border-r border-slate-300 bg-amber-100 px-3 py-2 text-center text-amber-900">Valor manual</th>
                  <th colSpan={CAMPOS_CALCULADOS.length} className="border-b border-r border-slate-300 bg-blue-100 px-3 py-2 text-center text-blue-900">Valores calculados</th>
                  <th colSpan={CAMPOS_MANUALES_FINALES.length} className="border-b border-r border-slate-300 bg-amber-100 px-3 py-2 text-center text-amber-900">Valores manuales</th>
                  <th rowSpan="2" className="w-40 border-b border-r border-slate-300 bg-blue-700 px-3 py-3 text-right text-white">Total anticipos</th>
                  <th colSpan="4" className="border-b border-r border-slate-300 bg-emerald-100 px-3 py-2 text-center text-emerald-900">Prestamos a la empresa</th>
                  <th rowSpan="2" className="w-40 border-b border-r border-slate-300 bg-emerald-100 px-3 py-3 text-right text-emerald-950">Suman prestamos</th>
                  <th rowSpan="2" className="sticky right-0 z-20 w-44 border-b border-slate-300 bg-green-500 px-3 py-3 text-right text-slate-950">Total descuentos</th>
                </tr>
                <tr className="text-[11px] font-bold uppercase leading-tight text-slate-700">
                  <th className="w-40 border-b border-r border-slate-300 bg-amber-50 px-3 py-3 text-right">Adelantos transfer</th>
                  {CAMPOS_CALCULADOS.map((campo) => (
                    <th key={campo} className="w-36 border-b border-r border-slate-300 bg-blue-50 px-3 py-3 text-right">{ETIQUETAS_CAMPOS[campo]}</th>
                  ))}
                  {CAMPOS_MANUALES_FINALES.map((campo) => (
                    <th key={campo} className="w-40 border-b border-r border-slate-300 bg-amber-50 px-3 py-3 text-right">{ETIQUETAS_CAMPOS[campo]}</th>
                  ))}
                  {CAMPOS_PRESTAMOS.map((campo) => (
                    <th key={campo} className="w-40 border-b border-r border-slate-300 bg-emerald-50 px-3 py-3 text-right">{ETIQUETAS_CAMPOS[campo]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={TOTAL_COLUMNAS_EGRESOS} className="px-4 py-14 text-center font-semibold text-slate-500">Calculando resumen del periodo...</td></tr>
                ) : rowsFiltradas.length === 0 ? (
                  <tr><td colSpan={TOTAL_COLUMNAS_EGRESOS} className="px-4 py-14 text-center text-slate-500">No hay colaboradores para mostrar.</td></tr>
                ) : rowsFiltradas.map((row, index) => (
                  <tr key={row.usuarioId} className={index % 2 ? "bg-slate-50/60" : "bg-white"}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-4 py-2.5 font-bold text-slate-800">{row.nombre}</td>
                    <td className="border-b border-r border-slate-200 px-2 py-1.5">
                      <InputValor row={row} campo="adelantosTransfer" drafts={drafts} onChange={cambiarManual} disabled={saving} />
                    </td>
                    {CAMPOS_CALCULADOS.map((campo) => (
                      <td key={campo} className="border-b border-r border-slate-200 bg-blue-50/40 px-2 py-1.5">
                        <InputValor
                          row={row}
                          campo={campo}
                          drafts={drafts}
                          onChange={cambiarManual}
                          disabled={saving}
                          calculado
                        />
                      </td>
                    ))}
                    {CAMPOS_MANUALES_FINALES.map((campo) => (
                      <td key={campo} className="border-b border-r border-slate-200 px-2 py-1.5">
                        <InputValor row={row} campo={campo} drafts={drafts} onChange={cambiarManual} disabled={saving} />
                      </td>
                    ))}
                    <td className="border-b border-r border-slate-200 bg-blue-700 px-3 py-2.5 text-right text-base font-extrabold text-white">{formatoDinero.format(totalAnticiposFila(row, drafts))}</td>
                    {CAMPOS_PRESTAMOS.map((campo) => (
                      <td key={campo} className="border-b border-r border-slate-200 bg-emerald-50/40 px-2 py-1.5">
                        <InputValor row={row} campo={campo} drafts={drafts} onChange={cambiarManual} disabled={saving} />
                      </td>
                    ))}
                    <td className="border-b border-r border-slate-200 bg-emerald-100 px-3 py-2.5 text-right font-extrabold text-emerald-900">{formatoNumero(sumanPrestamosFila(row, drafts))}</td>
                    <td className="sticky right-0 z-10 border-b border-slate-200 bg-green-400 px-3 py-2.5 text-right text-base font-extrabold text-slate-950">{formatoDinero.format(totalDescuentosFila(row, drafts))}</td>
                  </tr>
                ))}
              </tbody>
              {!loading && rowsFiltradas.length > 0 && (
                <tfoot>
                  <tr className="font-extrabold text-white">
                    <td className="sticky bottom-0 left-0 z-30 border-r border-blue-800 bg-blue-800 px-4 py-3 text-left uppercase">Total</td>
                    {CAMPOS_ANTICIPOS.map((campo) => (
                      <td key={campo} className="sticky bottom-0 z-20 border-r border-blue-700 bg-blue-700 px-3 py-3 text-right">{formatoNumero(totales[campo])}</td>
                    ))}
                    <td className="sticky bottom-0 z-20 border-r border-blue-700 bg-blue-700 px-3 py-3 text-right text-base">{formatoDinero.format(totales.totalAnticipos)}</td>
                    {CAMPOS_PRESTAMOS.map((campo) => (
                      <td key={campo} className="sticky bottom-0 z-20 border-r border-emerald-700 bg-emerald-600 px-3 py-3 text-right">{formatoNumero(totales[campo])}</td>
                    ))}
                    <td className="sticky bottom-0 z-20 border-r border-emerald-800 bg-emerald-700 px-3 py-3 text-right">{formatoNumero(totales.sumanPrestamos)}</td>
                    <td className="sticky bottom-0 right-0 z-30 bg-green-500 px-3 py-3 text-right text-base text-slate-950">{formatoDinero.format(totales.totalDescuentos)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          )}
        </section>
      </div>
    </div>
  );
}
