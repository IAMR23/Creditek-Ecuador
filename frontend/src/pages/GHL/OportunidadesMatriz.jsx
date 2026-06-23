import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, BarChart3, Filter, RefreshCcw, Search, X } from "lucide-react";
import { API_URL } from "../../../config";

const getTodayDate = () => new Date().toLocaleDateString("en-CA");

const getFiltrosIniciales = () => {
  const today = getTodayDate();

  return {
    fechaInicio: today,
    fechaFin: today,
    busqueda: "",
    propietario: "",
    etapa: "",
  };
};

const filtrosVisiblesIniciales = {
  busqueda: "",
  propietario: "",
  etapa: "",
};

const inputClass =
  "h-9 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100";

const selectClass =
  "h-9 w-full rounded border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100";

const normalizeColumns = (columns = []) =>
  columns
    .map((column) =>
      typeof column === "string"
        ? { id: column, name: column }
        : {
            id: column.id || column.pipelineStageId || column.name,
            name: column.name || column.label || column.id || "Sin etapa",
          },
    )
    .filter((column) => column.id);

const getCellValue = (row, columnId) =>
  Number(row?.values?.[columnId] ?? row?.stages?.[columnId] ?? 0);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getErrorMessage = (error) => {
  const responseMessage = error.response?.data?.message;
  if (responseMessage) return responseMessage;

  if (error.response?.status === 401) {
    return "Sesion invalida o token de HighLevel invalido";
  }

  if (error.response?.status === 403) {
    return "No tienes permisos para ver este dashboard";
  }

  return "No se pudo cargar la matriz de oportunidades";
};

export default function OportunidadesMatriz() {
  const filtrosBase = useMemo(() => getFiltrosIniciales(), []);
  const [matriz, setMatriz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState(() => getFiltrosIniciales());
  const [fechasAplicadas, setFechasAplicadas] = useState({
    fechaInicio: "",
    fechaFin: "",
  });

  const columns = useMemo(() => normalizeColumns(matriz?.columns), [matriz]);
  const rows = matriz?.rows || [];
  const totals = matriz?.totals || { values: {}, total: 0 };

  const owners = useMemo(
    () =>
      rows
        .map((row) => ({
          id: row.ownerId || row.ownerName || row.propietario,
          name: row.ownerName || row.propietario || "Sin propietario",
        }))
        .filter((owner) => owner.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rows],
  );

  const visibleColumns = useMemo(
    () =>
      filtros.etapa
        ? columns.filter((column) => column.id === filtros.etapa)
        : columns,
    [columns, filtros.etapa],
  );

  const visibleRows = useMemo(() => {
    const busqueda = normalizeText(filtros.busqueda);

    return rows
      .map((row) => {
        const visibleTotal = visibleColumns.reduce(
          (sum, column) => sum + getCellValue(row, column.id),
          0,
        );

        return {
          ...row,
          visibleTotal,
        };
      })
      .filter((row) => {
        const ownerName = row.ownerName || row.propietario || "Sin propietario";
        const ownerId = row.ownerId || ownerName;

        if (busqueda && !normalizeText(ownerName).includes(busqueda)) return false;
        if (filtros.propietario && String(ownerId) !== String(filtros.propietario)) {
          return false;
        }
        if (filtros.etapa && row.visibleTotal <= 0) return false;

        return true;
      });
  }, [filtros, rows, visibleColumns]);

  const visibleTotals = useMemo(() => {
    const values = {};
    let total = 0;

    visibleColumns.forEach((column) => {
      values[column.id] = visibleRows.reduce(
        (sum, row) => sum + getCellValue(row, column.id),
        0,
      );
      total += values[column.id];
    });

    return {
      values,
      stages: values,
      total,
    };
  }, [visibleColumns, visibleRows]);

  const topStage = useMemo(() => {
    if (!visibleColumns.length) return null;

    return visibleColumns
      .map((column) => ({
        ...column,
        total: Number(visibleTotals.values?.[column.id] ?? 0),
      }))
      .sort((a, b) => b.total - a.total)[0];
  }, [visibleColumns, visibleTotals]);

  const rangoFechasLabel =
    fechasAplicadas.fechaInicio || fechasAplicadas.fechaFin
      ? `${fechasAplicadas.fechaInicio || "Inicio"} - ${fechasAplicadas.fechaFin || "Hoy"}`
      : "Sin filtro de fecha";

  const cargarMatriz = async (filtrosConsulta = filtros) => {
    if (
      filtrosConsulta.fechaInicio &&
      filtrosConsulta.fechaFin &&
      filtrosConsulta.fechaInicio > filtrosConsulta.fechaFin
    ) {
      setError("La fecha de inicio no puede ser mayor que la fecha fin");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (filtrosConsulta.fechaInicio) {
        params.append("fechaInicio", filtrosConsulta.fechaInicio);
      }
      if (filtrosConsulta.fechaFin) {
        params.append("fechaFin", filtrosConsulta.fechaFin);
      }

      const query = params.toString();
      const url = `${API_URL}/api/ghl/dashboard/oportunidades/matriz${
        query ? `?${query}` : ""
      }`;

      const { data } = await axios.get(url);
      setMatriz(data || null);
      setFechasAplicadas({
        fechaInicio: filtrosConsulta.fechaInicio || "",
        fechaFin: filtrosConsulta.fechaFin || "",
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setMatriz(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarMatriz(filtrosBase);
  }, []);

  const actualizarFiltro = (campo, value) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: value,
    }));
  };

  const limpiarFiltros = () => {
    const filtrosIniciales = getFiltrosIniciales();
    setFiltros(filtrosIniciales);
    cargarMatriz(filtrosIniciales);
  };

  const tableMinWidth = Math.max(720, visibleColumns.length * 128 + 260);
  const hayFiltros =
    filtros.fechaInicio !== filtrosBase.fechaInicio ||
    filtros.fechaFin !== filtrosBase.fechaFin ||
    Object.keys(filtrosVisiblesIniciales).some((key) => Boolean(filtros[key]));

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-green-700">
            <BarChart3 size={17} />
            GoHighLevel
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Matriz de oportunidades
          </h1>
          <div className="mt-1 text-sm text-gray-500">
            {matriz?.meta?.pipelineName || "Pipeline configurado"} | {rangoFechasLabel}
          </div>
        </div>

        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => cargarMatriz()}
          disabled={loading}
          title="Actualizar"
        >
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total GHL" value={totals.total || 0} />
        <Metric label="Oportunidades visibles" value={visibleTotals.total || 0} />
        <Metric label="Propietarios visibles" value={visibleRows.length} />
        <Metric
          label="Etapa principal"
          value={topStage ? `${topStage.name}: ${topStage.total}` : "-"}
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="mb-4 rounded border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Filter size={17} />
          Filtros
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Field label="Fecha inicio">
            <input
              type="date"
              className={inputClass}
              value={filtros.fechaInicio}
              onChange={(event) => actualizarFiltro("fechaInicio", event.target.value)}
            />
          </Field>

          <Field label="Fecha fin">
            <input
              type="date"
              className={inputClass}
              value={filtros.fechaFin}
              onChange={(event) => actualizarFiltro("fechaFin", event.target.value)}
            />
          </Field>

          <Field label="Buscar propietario" className="xl:col-span-2">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                className={`${inputClass} pl-9`}
                value={filtros.busqueda}
                onChange={(event) => actualizarFiltro("busqueda", event.target.value)}
                placeholder="Nombre del propietario"
              />
            </div>
          </Field>

          <Field label="Propietario">
            <select
              className={selectClass}
              value={filtros.propietario}
              onChange={(event) => actualizarFiltro("propietario", event.target.value)}
            >
              <option value="">Todos</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Etapa">
            <select
              className={selectClass}
              value={filtros.etapa}
              onChange={(event) => actualizarFiltro("etapa", event.target.value)}
            >
              <option value="">Todas</option>
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </Field>



          <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
            <button
              type="button"
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded bg-green-600 px-4 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => cargarMatriz()}
              disabled={loading}
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Consultar
            </button>

            <button
              type="button"
              className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded border border-gray-300 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={limpiarFiltros}
              disabled={!hayFiltros}
              title="Limpiar filtros"
            >
              <X size={16} />
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-sm font-bold text-gray-900">
            Oportunidades por propietario y etapa
          </h2>
          {matriz?.meta?.generatedAt && (
            <span className="text-xs font-semibold text-gray-500">
              Actualizado {new Date(matriz.meta.generatedAt).toLocaleString("es-EC")}
            </span>
          )}
        </div>

        <div className="max-w-full overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            style={{ minWidth: `${tableMinWidth}px` }}
          >
            <thead className="bg-gray-100 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="border-b border-gray-200 px-3 py-3">Propietario</th>
                {visibleColumns.map((column) => (
                  <th
                    key={column.id}
                    className="border-b border-gray-200 px-3 py-3 text-right"
                  >
                    {column.name}
                  </th>
                ))}
                <th className="border-b border-gray-200 px-3 py-3 text-right">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 2}
                    className="px-3 py-10 text-center text-gray-500"
                  >
                    Cargando oportunidades...
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 2}
                    className="px-3 py-10 text-center text-gray-500"
                  >
                    No hay oportunidades con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr
                    key={row.ownerId || row.ownerName}
                    className="border-b border-gray-100 hover:bg-green-50/50"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900">
                      {row.ownerName || row.propietario || "Sin propietario"}
                    </td>
                    {visibleColumns.map((column) => (
                      <td
                        key={column.id}
                        className="px-3 py-3 text-right tabular-nums text-gray-700"
                      >
                        {getCellValue(row, column.id)}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-gray-900">
                      {row.visibleTotal || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="bg-gray-100">
              <tr>
                <td className="px-3 py-3 font-bold text-gray-900">Total</td>
                {visibleColumns.map((column) => (
                  <td
                    key={column.id}
                    className="px-3 py-3 text-right font-bold tabular-nums text-gray-900"
                  >
                    {Number(visibleTotals.values?.[column.id] ?? 0)}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-bold tabular-nums text-gray-900">
                  {visibleTotals.total || 0}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
