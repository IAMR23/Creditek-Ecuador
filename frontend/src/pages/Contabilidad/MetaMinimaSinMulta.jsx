/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { BadgeDollarSign, Download, Eye, RefreshCw, ShieldMinus, XCircle } from "lucide-react";
import { api } from "../../api/client";

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));

const getToday = () => new Date().toLocaleDateString("en-CA");
const getMonthStart = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
};

const initialFilters = {
  fechaInicio: getMonthStart(),
  fechaFin: getToday(),
  agenciaId: [],
  vendedorId: "",
  cierreCaja: "",
};

const buildExcelRows = (rows) =>
  rows.map((row, index) => ({
    "#": index + 1,
    Vendedor: row.nombre || "",
    Cargo: row.cargo || "",
    Agencias: (row.agencias || []).join(", "),
    "Meta minima": row.metaMinima ?? "",
    Ventas: row.ventas || 0,
    Faltan: row.faltan ?? "",
    "Multa por unidad": row.valorMultaUnidad ?? "",
    "Multa estimada": row.multaEstimada || 0,
  }));

const buildExcelDetailRows = (rows) =>
  rows.flatMap((row) =>
    (row.detalleSemanas || []).map((week) => ({
      Vendedor: row.nombre || "",
      Cargo: row.cargo || "",
      Semana: week.label,
      Inicio: week.startDate,
      Fin: week.endDate,
      Meta: week.metaMinima ?? "",
      Ventas: week.ventas || 0,
      Faltan: week.faltan ?? "",
      "Multa por unidad": week.valorMultaUnidad ?? "",
      "Multa estimada": week.multaEstimada || 0,
    })),
  );

export default function MetaMinimaSinMulta() {
  const [filters, setFilters] = useState(initialFilters);
  const [agencias, setAgencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [openAgencias, setOpenAgencias] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const params = useMemo(
    () => ({
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
      agenciaId: filters.agenciaId.join(","),
      vendedorId: filters.vendedorId,
      cierreCaja: filters.cierreCaja,
    }),
    [filters],
  );

  const cargarCatalogos = async () => {
    try {
      const [{ data: agenciasData }, { data: usuariosData }] = await Promise.all([
        api.get("/agencias"),
        api.get("/usuarios", { params: { rol: "Vendedor" } }),
      ]);
      setAgencias(agenciasData || []);
      setUsuarios(usuariosData || []);
    } catch (error) {
      console.error("Error cargando catalogos", error);
    }
  };

  const cargarReporte = async () => {
    if (!filters.fechaInicio || !filters.fechaFin) return;
    if (filters.fechaInicio > filters.fechaFin) {
      Swal.fire("Atencion", "La fecha de inicio no puede ser mayor a la fecha fin", "warning");
      return;
    }

    setLoading(true);
    try {
      const { data: response } = await api.get(
        "/api/dashboard/meta-minima-sin-multa",
        { params },
      );
      setData(response);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cargar la meta minima sin multa",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarReporte();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vendedores = data?.vendedores || [];
  const resumen = data?.resumen || {};

  const toggleAgencia = (id) => {
    setFilters((current) => ({
      ...current,
      agenciaId: current.agenciaId.includes(id)
        ? current.agenciaId.filter((item) => item !== id)
        : [...current.agenciaId, id],
    }));
  };

  const exportarExcel = () => {
    if (!vendedores.length) {
      Swal.fire("Sin datos", "No hay registros para exportar", "info");
      return;
    }

    setExporting(true);
    try {
      const workbook = XLSX.utils.book_new();
      const resumenSheet = XLSX.utils.json_to_sheet(buildExcelRows(vendedores));
      const detalleSheet = XLSX.utils.json_to_sheet(buildExcelDetailRows(vendedores));
      resumenSheet["!cols"] = Array.from({ length: 9 }, () => ({ wch: 20 }));
      detalleSheet["!cols"] = Array.from({ length: 10 }, () => ({ wch: 20 }));
      XLSX.utils.book_append_sheet(workbook, resumenSheet, "Resumen");
      XLSX.utils.book_append_sheet(workbook, detalleSheet, "Detalle semanal");
      XLSX.writeFile(
        workbook,
        `Meta_minima_sin_multa_${filters.fechaInicio}_a_${filters.fechaFin}.xlsx`,
      );
    } catch (error) {
      Swal.fire("Error", "No se pudo generar el Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <ShieldMinus size={18} />
                Contabilidad
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Meta minima sin multa
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Meta semanal predefinida segun el rol de pago.
              </p>
            </div>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={exporting || !vendedores.length}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Download size={16} />
              {exporting ? "Exportando..." : "Descargar Excel"}
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Field
              label="Fecha inicio"
              type="date"
              value={filters.fechaInicio}
              onChange={(value) => setFilters({ ...filters, fechaInicio: value })}
            />
            <Field
              label="Fecha fin"
              type="date"
              value={filters.fechaFin}
              onChange={(value) => setFilters({ ...filters, fechaFin: value })}
            />
            <div className="relative">
              <label className="text-sm font-medium text-slate-700">Agencias</label>
              <button
                type="button"
                onClick={() => setOpenAgencias((current) => !current)}
                className="mt-1 min-h-[38px] w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm"
              >
                {filters.agenciaId.length
                  ? `${filters.agenciaId.length} seleccionada(s)`
                  : "Todas las agencias"}
              </button>
              {openAgencias ? (
                <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                  {agencias.map((agencia) => {
                    const id = String(agencia.id);
                    const selected = filters.agenciaId.includes(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => toggleAgencia(id)}
                        className={`mb-1 w-full rounded px-3 py-2 text-left text-sm ${
                          selected ? "bg-emerald-50 text-emerald-700" : "hover:bg-slate-50"
                        }`}
                      >
                        {agencia.nombre}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <label className="text-sm font-medium text-slate-700">
              Vendedor
              <select
                value={filters.vendedorId}
                onChange={(event) =>
                  setFilters({ ...filters, vendedorId: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Cierre de caja
              <select
                value={filters.cierreCaja}
                onChange={(event) =>
                  setFilters({ ...filters, cierreCaja: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="CONTADO">Contado</option>
                <option value="CREDITV">CrediTV</option>
                <option value="UPHONE">Uphone</option>
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={cargarReporte}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Consultar
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Cumplen" value={resumen.cumplen || 0} />
          <Metric label="No cumplen" value={resumen.noCumplen || 0} />
          <Metric label="Personal nuevo" value={resumen.personalNuevo || 0} />
          <Metric label="Multa estimada" value={formatMoney(resumen.multaEstimadaTotal || 0)} />
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-slate-700">
                  <th className="border border-slate-200 px-3 py-2">Vendedor</th>
                  <th className="border border-slate-200 px-3 py-2">Cargo</th>
                  <th className="border border-slate-200 px-3 py-2">Meta minima</th>
                  <th className="border border-slate-200 px-3 py-2">Ventas</th>
                  <th className="border border-slate-200 px-3 py-2">Faltan</th>
                  <th className="border border-slate-200 px-3 py-2">Multa por unidad</th>
                  <th className="border border-slate-200 px-3 py-2">Multa estimada</th>
                  <th className="border border-slate-200 px-3 py-2">Ver detalle</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                      Cargando...
                    </td>
                  </tr>
                ) : vendedores.length ? (
                  vendedores.map((row) => (
                    <tr key={row.usuarioId} className="odd:bg-white even:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                        {row.nombre}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">{row.cargo || "-"}</td>
                      <td className="border border-slate-200 px-3 py-2">{row.metaMinima ?? "-"}</td>
                      <td className="border border-slate-200 px-3 py-2">{row.ventas || 0}</td>
                      <td className="border border-slate-200 px-3 py-2">{row.faltan ?? "-"}</td>
                      <td className="border border-slate-200 px-3 py-2">
                        {row.valorMultaUnidad === null ? "-" : formatMoney(row.valorMultaUnidad)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 font-semibold">
                        {formatMoney(row.multaEstimada)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setDetalle(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye size={14} />
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                      No hay vendedores para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {detalle ? <DetalleModal row={detalle} onClose={() => setDetalle(null)} /> : null}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function DetalleModal({ row, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <section className="w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{row.nombre}</h3>
            <p className="text-sm text-slate-500">{row.cargo || "Sin cargo"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <XCircle size={20} />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-auto p-5">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-slate-700">
                <th className="border border-slate-200 px-3 py-2">Semana</th>
                <th className="border border-slate-200 px-3 py-2">Meta</th>
                <th className="border border-slate-200 px-3 py-2">Ventas</th>
                <th className="border border-slate-200 px-3 py-2">Faltan</th>
                <th className="border border-slate-200 px-3 py-2">Multa por unidad</th>
                <th className="border border-slate-200 px-3 py-2">Multa estimada</th>
              </tr>
            </thead>
            <tbody>
              {(row.detalleSemanas || []).map((week) => (
                <tr key={week.startDate} className="odd:bg-white even:bg-slate-50">
                  <td className="border border-slate-200 px-3 py-2">{week.label}</td>
                  <td className="border border-slate-200 px-3 py-2">{week.metaMinima ?? "-"}</td>
                  <td className="border border-slate-200 px-3 py-2">{week.ventas || 0}</td>
                  <td className="border border-slate-200 px-3 py-2">{week.faltan ?? "-"}</td>
                  <td className="border border-slate-200 px-3 py-2">
                    {week.valorMultaUnidad === null ? "-" : formatMoney(week.valorMultaUnidad)}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 font-semibold">
                    {formatMoney(week.multaEstimada)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
