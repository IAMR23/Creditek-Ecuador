/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { api } from "../../api/client";

const ahora = new Date();
const CAMPOS_MANUALES = [
  "adelantosTransfer",
  "deudaJimena",
  "atrasos",
  "diasNoLaborables",
  "multasFacturacion",
  "planmovi",
  "prestamo",
  "mecanica",
];
const CAMPOS_PRESTAMOS = ["planmovi", "prestamo", "mecanica"];
const CAMPOS_ANTICIPOS = [
  "adelantosTransfer",
  "descuentosMeta",
  "cajaGeneral",
  "entradas",
  "descuentos",
  ...CAMPOS_MANUALES.filter((campo) => campo !== "adelantosTransfer"),
].filter((campo) => !CAMPOS_PRESTAMOS.includes(campo));
const CAMPOS_VALORES = [...CAMPOS_ANTICIPOS, ...CAMPOS_PRESTAMOS];
const CAMPOS_MANUALES_FINALES = CAMPOS_MANUALES.filter(
  (campo) =>
    campo !== "adelantosTransfer" && !CAMPOS_PRESTAMOS.includes(campo),
);
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

const valorCampo = (row, campo, drafts) => {
  const draft = drafts[String(row.usuarioId)];
  return draft && Object.prototype.hasOwnProperty.call(draft, campo)
    ? draft[campo]
    : row[campo];
};

const valorInput = (row, campo, drafts) => {
  const draft = drafts[String(row.usuarioId)];
  if (draft && Object.prototype.hasOwnProperty.call(draft, campo)) {
    return draft[campo];
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

const InputValor = ({ row, campo, drafts, onChange, disabled }) => (
  <div className="relative min-w-28">
    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-amber-700">
      $
    </span>
    <input
      type="text"
      inputMode="decimal"
      value={valorInput(row, campo, drafts)}
      onChange={(event) => onChange(row, campo, event.target.value)}
      disabled={disabled}
      aria-label={`${campo} de ${row.nombre}`}
      className="h-9 w-full rounded-md border border-amber-300 bg-amber-50 pl-6 pr-2 text-right text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100 disabled:opacity-60"
    />
  </div>
);

export default function RolesCreditekResumen() {
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setRows(Array.isArray(data.registros) ? data.registros : []);
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
    if (!CAMPOS_MANUALES.includes(campo)) return;
    const valorNormalizado = value.replace(/,/g, ".");
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
    const registros = modificados.map((row) => ({
      usuarioId: row.usuarioId,
      ...Object.fromEntries(
        CAMPOS_MANUALES.map((campo) => [
          campo,
          numero(valorCampo(row, campo, drafts)),
        ]),
      ),
    }));

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

  const totales = useMemo(() => {
    const resultado = Object.fromEntries(
      [
        ...CAMPOS_VALORES,
        "totalAnticipos",
        "sumanPrestamos",
        "totalDescuentos",
      ].map((campo) => [campo, 0]),
    );
    rowsFiltradas.forEach((row) => {
      CAMPOS_VALORES.forEach((campo) => {
        resultado[campo] += numero(valorCampo(row, campo, drafts));
      });
      resultado.totalAnticipos += totalAnticiposFila(row, drafts);
      resultado.sumanPrestamos += sumanPrestamosFila(row, drafts);
      resultado.totalDescuentos += totalDescuentosFila(row, drafts);
    });
    Object.keys(resultado).forEach((campo) => {
      resultado[campo] = redondear(resultado[campo]);
    });
    return resultado;
  }, [drafts, rowsFiltradas]);

  const exportarExcel = () => {
    const data = [
      ["EGRESOS CREDITEK"],
      [
        "PERSONAL",
        "ADELANTOS TRANSFER",
        "DESCUENTOS POR META",
        "CAJA GENERAL",
        "ENTRADAS",
        "DESCUENTOS",
        "DEUDA JIMENA",
        "ATRASOS",
        "DIAS NO LABORABLES",
        "MULTAS FACTURACION",
        "TOTAL ANTICIPOS",
        "PLANMOVI",
        "PRESTAMO",
        "MECANICA",
        "SUMAN PRESTAMOS",
        "TOTAL DESCUENTOS",
      ],
      ...rowsFiltradas.map((row) => [
        row.nombre,
        ...CAMPOS_ANTICIPOS.map((campo) =>
          numero(valorCampo(row, campo, drafts)),
        ),
        totalAnticiposFila(row, drafts),
        ...CAMPOS_PRESTAMOS.map((campo) =>
          numero(valorCampo(row, campo, drafts)),
        ),
        sumanPrestamosFila(row, drafts),
        totalDescuentosFila(row, drafts),
      ]),
      [
        "TOTAL",
        ...CAMPOS_ANTICIPOS.map((campo) => totales[campo]),
        totales.totalAnticipos,
        ...CAMPOS_PRESTAMOS.map((campo) => totales[campo]),
        totales.sumanPrestamos,
        totales.totalDescuentos,
      ],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }];
    sheet["!cols"] = [
      { wch: 30 },
      ...Array.from({ length: 15 }, () => ({ wch: 18 })),
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Resumen");
    XLSX.writeFile(
      workbook,
      `Roles_Creditek_${anio}_${String(mes).padStart(2, "0")}.xlsx`,
    );
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
                Los valores azules se calculan desde Egresos y Pagos comisiones.
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
                onClick={exportarExcel}
                disabled={!rowsFiltradas.length || loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                <FileSpreadsheet size={17} /> Exportar
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
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
            
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">{rowsFiltradas.length} colaboradores</span>
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[2450px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  <th rowSpan="2" className="sticky left-0 z-20 w-64 border-b border-r border-slate-300 bg-slate-100 px-4 py-3 text-left">Personal</th>
                  <th className="border-b border-r border-slate-300 bg-amber-100 px-3 py-2 text-center text-amber-900">Valor manual</th>
                  <th colSpan="4" className="border-b border-r border-slate-300 bg-blue-100 px-3 py-2 text-center text-blue-900">Valores calculados</th>
                  <th colSpan="4" className="border-b border-r border-slate-300 bg-amber-100 px-3 py-2 text-center text-amber-900">Valores manuales</th>
                  <th rowSpan="2" className="w-40 border-b border-r border-slate-300 bg-blue-700 px-3 py-3 text-right text-white">Total anticipos</th>
                  <th colSpan="3" className="border-b border-r border-slate-300 bg-emerald-100 px-3 py-2 text-center text-emerald-900">Prestamos a la empresa</th>
                  <th rowSpan="2" className="w-40 border-b border-r border-slate-300 bg-emerald-100 px-3 py-3 text-right text-emerald-950">Suman prestamos</th>
                  <th rowSpan="2" className="sticky right-0 z-20 w-44 border-b border-slate-300 bg-green-500 px-3 py-3 text-right text-slate-950">Total descuentos</th>
                </tr>
                <tr className="text-[11px] font-bold uppercase leading-tight text-slate-700">
                  <th className="w-40 border-b border-r border-slate-300 bg-amber-50 px-3 py-3 text-right">Adelantos transfer</th>
                  {[
                    "Descuentos por meta",
                    "Caja general",
                    "Entradas",
                    "Descuentos",
                  ].map((label) => (
                    <th key={label} className="w-36 border-b border-r border-slate-300 bg-blue-50 px-3 py-3 text-right">{label}</th>
                  ))}
                  {["Deuda Jimena", "Atrasos", "Dias no laborables", "Multas facturacion"].map((label) => (
                    <th key={label} className="w-40 border-b border-r border-slate-300 bg-amber-50 px-3 py-3 text-right">{label}</th>
                  ))}
                  {["Planmovi", "Prestamo", "Mecanica"].map((label) => (
                    <th key={label} className="w-40 border-b border-r border-slate-300 bg-emerald-50 px-3 py-3 text-right">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="16" className="px-4 py-14 text-center font-semibold text-slate-500">Calculando resumen del periodo...</td></tr>
                ) : rowsFiltradas.length === 0 ? (
                  <tr><td colSpan="16" className="px-4 py-14 text-center text-slate-500">No hay colaboradores para mostrar.</td></tr>
                ) : rowsFiltradas.map((row, index) => (
                  <tr key={row.usuarioId} className={index % 2 ? "bg-slate-50/60" : "bg-white"}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-inherit px-4 py-2.5 font-bold text-slate-800">{row.nombre}</td>
                    <td className="border-b border-r border-slate-200 px-2 py-1.5">
                      <InputValor row={row} campo="adelantosTransfer" drafts={drafts} onChange={cambiarManual} disabled={saving} />
                    </td>
                    {["descuentosMeta", "cajaGeneral", "entradas", "descuentos"].map((campo) => (
                      <td key={campo} className="border-b border-r border-slate-200 bg-blue-50/40 px-3 py-2.5 text-right font-semibold text-blue-900">{formatoNumero(row[campo])}</td>
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
        </section>
      </div>
    </div>
  );
}
