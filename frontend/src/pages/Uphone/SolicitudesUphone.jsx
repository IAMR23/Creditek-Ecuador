/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, RefreshCw, Search, UploadCloud } from "lucide-react";
import Swal from "sweetalert2";

import api from "../../api/client";

const EMPTY_FILTERS = {
  q: "",
  estado: "",
  fechaDesde: "",
  fechaHasta: "",
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  }).format(date);
};

const formatStatus = (value) => String(value || "").replaceAll("_", " ");

const StatusBadge = ({ children, tone = "slate" }) => {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20",
    slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  };
  return (
    <span className={`inline-flex max-w-full justify-center break-words rounded-full px-2 py-1 text-center text-[10px] font-semibold leading-4 ring-1 ring-inset ${tones[tone]}`}>
      {children || "Sin estado"}
    </span>
  );
};

const estadoTone = (value) => {
  const normalized = String(value || "").toUpperCase();
  if (normalized.includes("APROBAD")) return "green";
  if (normalized.includes("RECHAZ") || normalized.includes("ANUL")) return "red";
  if (normalized.includes("PEND")) return "amber";
  return "slate";
};

export default function SolicitudesUphone() {
  const fileInputRef = useRef(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({
    solicitudes: [],
    resumen: { totalRegistradas: 0, totalFiltradas: 0 },
    paginacion: { page: 1, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [lastImport, setLastImport] = useState(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/api/uphone/solicitudes", {
        params: {
          ...appliedFilters,
          page,
          pageSize: 25,
        },
      });
      setData(response.data);
    } catch (error) {
      Swal.fire(
        "No se pudo cargar",
        getErrorMessage(error, "No se pudieron consultar las solicitudes Uphone."),
        "error",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const uploadFile = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      return Swal.fire(
        "Archivo requerido",
        "Selecciona un reporte .xlsx de Uphone.",
        "warning",
      );
    }

    const formData = new FormData();
    formData.append("archivo", selectedFile);
    setUploading(true);
    try {
      const response = await api.post(
        "/api/uphone/solicitudes/importar-manual",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      const result = response.data.resultado;
      setLastImport(result);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPage(1);
      await loadData({ silent: true });
      await Swal.fire({
        icon: result.insertadas > 0 ? "success" : "info",
        title: response.data.message,
        html: `<b>${result.insertadas}</b> nuevas · <b>${result.omitidasDuplicadas}</b> duplicadas · <b>${result.omitidasInvalidas}</b> inválidas`,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo importar",
        getErrorMessage(error, "Verifica que el archivo tenga el formato de Uphone."),
        "error",
      );
    } finally {
      setUploading(false);
    }
  };

  const pageLabel = useMemo(() => {
    const total = data.paginacion?.total || 0;
    if (!total) return "0 resultados";
    const from = (page - 1) * 25 + 1;
    const to = Math.min(page * 25, total);
    return `${from}-${to} de ${total}`;
  }, [data.paginacion?.total, page]);

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-none space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Uphone</p>
            <h1 className="text-2xl font-bold text-slate-900">Solicitudes importadas</h1>
            <p className="mt-1 text-sm text-slate-500">
              Los reportes llegan mediante API key y también pueden cargarse manualmente en caso de contingencia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form onSubmit={applyFilters} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
              <Search size={17} className="text-teal-600" /> Consultar solicitudes
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                Buscar
                <input
                  value={filters.q}
                  onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
                  placeholder="Solicitud, vendedor, usuario o cliente"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Estado
                <input
                  value={filters.estado}
                  onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value }))}
                  placeholder="PENDIENTE"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-slate-600">
                  Desde
                  <input
                    type="date"
                    value={filters.fechaDesde}
                    onChange={(event) => setFilters((current) => ({ ...current, fechaDesde: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Hasta
                  <input
                    type="date"
                    value={filters.fechaHasta}
                    onChange={(event) => setFilters((current) => ({ ...current, fechaHasta: event.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={clearFilters} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Limpiar
              </button>
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Aplicar filtros
              </button>
            </div>
          </form>
          <form onSubmit={uploadFile} className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <UploadCloud size={18} className="text-teal-600" /> Carga manual
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Para contingencias. Archivo .xlsx, máximo 10 MB y 25.000 filas.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="mt-3 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-teal-700 hover:file:bg-teal-100"
            />
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet size={17} />
              {uploading ? "Importando..." : "Importar manualmente"}
            </button>
          </form>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total único</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{data.resumen?.totalRegistradas || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado del filtro</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{data.resumen?.totalFiltradas || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última carga manual</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {lastImport
                ? `${lastImport.insertadas} nuevas · ${lastImport.omitidasDuplicadas} duplicadas`
                : "Sin carga en esta sesión"}
            </p>
            {lastImport && (
              <p className="mt-1 truncate text-xs text-slate-500">{lastImport.archivo}</p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed divide-y divide-slate-200 text-sm">
              <colgroup>
                <col className="w-[7%]" />
                <col className="w-[10%]" />
                <col className="w-[15%]" />
                <col className="w-[16%]" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[8%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Solicitud</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Distribuidor / matriz</th>
                  <th className="px-3 py-3">Vendedor</th>
                  <th className="px-3 py-3">Cliente</th>
                  <th className="px-3 py-3">Grupo</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Contrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Cargando solicitudes...</td></tr>
                ) : data.solicitudes?.length ? (
                  data.solicitudes.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-slate-50/80">
                      <td className="break-words px-3 py-3">
                        <p className="font-bold text-slate-900">#{item.numeroSolicitud}</p>
                        <p className="break-words text-xs text-slate-500">{item.usuario || "Sin usuario"}</p>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{formatDateTime(item.fechaSolicitud)}</td>
                      <td className="break-words px-3 py-3">
                        <p className="font-medium text-slate-800">{item.distribuidor || "—"}</p>
                        <p className="break-words text-xs text-slate-500">{item.matriz || "—"}</p>
                      </td>
                      <td className="break-words px-3 py-3 text-slate-700">{item.vendedor || "—"}</td>
                      <td className="break-words px-3 py-3">
                        <p className="font-medium text-slate-800">{item.cliente || "Sin nombre"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">CI {item.cedula || "—"}</p>
                        <p className="text-xs text-slate-500">Tel. {item.telefonoSolicitud || "—"}</p>
                      </td>
                      <td className="break-words px-3 py-3 text-slate-700">{item.grupoArrendamiento || "—"}</td>
                      <td className="px-3 py-3"><StatusBadge tone={estadoTone(item.estado)}>{formatStatus(item.estado)}</StatusBadge></td>
                      <td className="px-3 py-3"><StatusBadge tone={estadoTone(item.estadoContrato)}>{formatStatus(item.estadoContrato)}</StatusBadge></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No hay solicitudes para los filtros seleccionados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">{pageLabel}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= (data.paginacion?.totalPages || 1) || loading}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
