/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { api } from "../../api/client";

const CURRENT_YEAR = new Date().getFullYear();
const EDITABLE_FIELDS = [
  "valor",
  "decimoCuarto",
  "decimoTercero",
  "vacaciones",
  "observaciones",
];

const normalizar = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const formatNumber = (value) =>
  new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const parseNumber = (value) => {
  const number = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(number) ? number : 0;
};

const validDecimal = (value) => /^\d*([.,]\d{0,2})?$/.test(value);

const getValue = (row, field, drafts) => {
  const draft = drafts[String(row.usuarioId)];
  return draft && Object.prototype.hasOwnProperty.call(draft, field)
    ? draft[field]
    : row[field];
};

export default function DescuentosDecimos() {
  const [anio, setAnio] = useState(CURRENT_YEAR);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
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
        "/api/contabilidad/descuentos-decimos",
        { params: { anio } },
      );
      setRows(Array.isArray(data.registros) ? data.registros : []);
      setDrafts({});
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron cargar los descuentos",
        "error",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const rowsFiltradas = useMemo(() => {
    const query = normalizar(busqueda);
    return rows.filter((row) => {
      const coincideBusqueda =
        !query ||
        normalizar(row.nombre).includes(query) ||
        String(row.usuarioId).includes(query);
      const coincideEstado =
        estado === "todos" ||
        (estado === "activos" && row.usuarioActivo) ||
        (estado === "inactivos" && !row.usuarioActivo);
      return coincideBusqueda && coincideEstado;
    });
  }, [busqueda, estado, rows]);

  const total = useMemo(
    () =>
      rowsFiltradas.reduce(
        (sum, row) => sum + parseNumber(getValue(row, "valor", drafts)),
        0,
      ),
    [drafts, rowsFiltradas],
  );

  const cambiosCount = Object.keys(drafts).length;

  const updateDraft = (row, field, value) => {
    if (!EDITABLE_FIELDS.includes(field)) return;
    setDrafts((current) => ({
      ...current,
      [String(row.usuarioId)]: {
        ...(current[String(row.usuarioId)] || {}),
        [field]: value,
      },
    }));
  };

  const cambiarAnio = async (nextYear) => {
    if (nextYear < 2000 || nextYear > 2100 || nextYear === anio) return;

    if (Object.keys(draftsRef.current).length > 0) {
      const confirmacion = await Swal.fire({
        title: "Cambios pendientes",
        text: "Los cambios sin guardar se descartarán al cambiar de año.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Cambiar de año",
        cancelButtonText: "Cancelar",
      });
      if (!confirmacion.isConfirmed) return;
    }

    setAnio(nextYear);
  };

  const guardar = async () => {
    const changedRows = rows.filter((row) => drafts[String(row.usuarioId)]);
    if (!changedRows.length) return;

    const registros = changedRows.map((row) => ({
      usuarioId: row.usuarioId,
      valor: getValue(row, "valor", drafts) || 0,
      decimoCuarto: getValue(row, "decimoCuarto", drafts) === true,
      decimoTercero: getValue(row, "decimoTercero", drafts) === true,
      vacaciones: getValue(row, "vacaciones", drafts) === true,
      observaciones: getValue(row, "observaciones", drafts) || "",
    }));

    try {
      setSaving(true);
      const { data } = await api.put(
        "/api/contabilidad/descuentos-decimos",
        { anio, registros },
      );
      await cargar({ silent: true });
      Swal.fire({
        icon: "success",
        title: "Descuentos guardados",
        text: `${data.total} registro(s) actualizado(s).`,
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron guardar los cambios",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const exportarExcel = () => {
    const data = [
      ["NOMBRES Y APELLIDOS", "VALOR", "DECIMO", "", "VACACIONES", "OBSERVACIONES"],
      ["", "", `XIV ${anio}`, `XIII ${anio}`, "", ""],
      ...rowsFiltradas.map((row) => [
        row.nombre,
        parseNumber(getValue(row, "valor", drafts)),
        getValue(row, "decimoCuarto", drafts) ? "X" : "",
        getValue(row, "decimoTercero", drafts) ? "X" : "",
        getValue(row, "vacaciones", drafts) ? "X" : "",
        getValue(row, "observaciones", drafts) || "",
      ]),
      ["SUMAN", total, "", "", "", ""],
    ];

    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
      { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },
    ];
    sheet["!cols"] = [
      { wch: 34 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 70 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, `Descuentos ${anio}`);
    XLSX.writeFile(workbook, `Descuentos_Decimos_${anio}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-5">
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">
            Descuentos décimos
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs font-medium text-gray-600">
            <span>{rows.length} usuarios</span>
            <span>{rows.filter((row) => row.usuarioActivo).length} activos</span>
            {cambiosCount > 0 && (
              <span className="text-amber-700">
                {cambiosCount} cambio(s) pendiente(s)
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-9 items-center rounded border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => cambiarAnio(anio - 1)}
              className="inline-flex h-full w-9 items-center justify-center text-gray-600 hover:bg-gray-100"
              title="Año anterior"
              aria-label="Año anterior"
            >
              <ChevronLeft size={17} />
            </button>
            <span className="min-w-16 border-x border-gray-300 px-3 text-center text-sm font-bold text-gray-900">
              {anio}
            </span>
            <button
              type="button"
              onClick={() => cambiarAnio(anio + 1)}
              className="inline-flex h-full w-9 items-center justify-center text-gray-600 hover:bg-gray-100"
              title="Año siguiente"
              aria-label="Año siguiente"
            >
              <ChevronRight size={17} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => cargar()}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
            title="Actualizar"
            aria-label="Actualizar"
          >
            <RefreshCw size={17} />
          </button>
          <button
            type="button"
            onClick={exportarExcel}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 bg-white text-emerald-700 hover:bg-emerald-50"
            title="Descargar Excel"
            aria-label="Descargar Excel"
          >
            <FileSpreadsheet size={18} />
          </button>

          {cambiosCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => setDrafts({})}
                disabled={saving}
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                title="Descartar cambios"
                aria-label="Descartar cambios"
              >
                <X size={17} />
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {saving ? (
                  <RefreshCw className="animate-spin" size={17} />
                ) : (
                  <Save size={17} />
                )}
                Guardar
              </button>
            </>
          )}
        </div>
      </header>

      <div className="mb-3 flex flex-col gap-2 border-y border-gray-200 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar usuario"
            className="h-9 w-full rounded border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <select
          value={estado}
          onChange={(event) => setEstado(event.target.value)}
          className="h-9 rounded border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:border-emerald-600"
        >
          <option value="todos">Todos los usuarios</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm font-medium text-gray-500">
          Cargando usuarios...
        </div>
      ) : (
        <div className="max-h-[calc(100vh-245px)] min-h-[420px] overflow-auto border border-gray-300 bg-white">
          <table className="w-full min-w-[1050px] table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[260px]" />
              <col className="w-[120px]" />
              <col className="w-[105px]" />
              <col className="w-[105px]" />
              <col className="w-[115px]" />
              <col />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-gray-100 text-gray-800">
              <tr>
                <th rowSpan={2} className="border-b border-r border-gray-300 px-3 py-2 text-left">
                  Nombres y apellidos
                </th>
                <th rowSpan={2} className="border-b border-r border-gray-300 px-3 py-2 text-right">
                  Valor
                </th>
                <th colSpan={2} className="border-b border-r border-gray-300 px-3 py-1 text-center">
                  Décimo
                </th>
                <th rowSpan={2} className="border-b border-r border-gray-300 px-3 py-2 text-center">
                  Vacaciones
                </th>
                <th rowSpan={2} className="border-b border-gray-300 px-3 py-2 text-left">
                  Observaciones
                </th>
              </tr>
              <tr>
                <th className="border-b border-r border-gray-300 px-2 py-1 text-center">
                  XIV {anio}
                </th>
                <th className="border-b border-r border-gray-300 px-2 py-1 text-center">
                  XIII {anio}
                </th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltradas.map((row) => {
                const changed = Boolean(drafts[String(row.usuarioId)]);
                return (
                  <tr
                    key={row.usuarioId}
                    className={`${changed ? "bg-amber-50" : "even:bg-gray-50"} hover:bg-emerald-50/50`}
                  >
                    <td className="border-b border-r border-gray-300 px-3 py-1.5">
                      <div className="truncate font-semibold text-gray-900" title={row.nombre}>
                        {row.nombre}
                      </div>
                      <span className={`text-[10px] font-medium ${row.usuarioActivo ? "text-emerald-700" : "text-gray-500"}`}>
                        {row.usuarioActivo ? "Activo" : "Inactivo"} · ID #{row.usuarioId}
                      </span>
                    </td>
                    <td className="border-b border-r border-gray-300 px-2 py-1.5 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getValue(row, "valor", drafts)}
                        onChange={(event) => {
                          if (validDecimal(event.target.value)) {
                            updateDraft(row, "valor", event.target.value);
                          }
                        }}
                        className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-right font-semibold tabular-nums outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        aria-label={`Valor de ${row.nombre}`}
                      />
                    </td>
                    <BooleanCell
                      checked={getValue(row, "decimoCuarto", drafts) === true}
                      label={`Décimo XIV de ${row.nombre}`}
                      onChange={(checked) => updateDraft(row, "decimoCuarto", checked)}
                    />
                    <BooleanCell
                      checked={getValue(row, "decimoTercero", drafts) === true}
                      label={`Décimo XIII de ${row.nombre}`}
                      onChange={(checked) => updateDraft(row, "decimoTercero", checked)}
                    />
                    <BooleanCell
                      checked={getValue(row, "vacaciones", drafts) === true}
                      label={`Vacaciones de ${row.nombre}`}
                      onChange={(checked) => updateDraft(row, "vacaciones", checked)}
                    />
                    <td className="border-b border-gray-300 px-2 py-1.5">
                      <textarea
                        rows={1}
                        maxLength={5000}
                        value={getValue(row, "observaciones", drafts)}
                        onChange={(event) =>
                          updateDraft(row, "observaciones", event.target.value)
                        }
                        className="h-8 w-full min-w-0 resize-y rounded border border-gray-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        placeholder="Observaciones"
                        aria-label={`Observaciones de ${row.nombre}`}
                      />
                    </td>
                  </tr>
                );
              })}

              {rowsFiltradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">
                    No hay usuarios para los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="sticky bottom-0 z-[5] bg-yellow-200 font-bold text-gray-950">
              <tr>
                <td className="border-r border-t border-gray-400 px-3 py-2 text-right uppercase">
                  Suman
                </td>
                <td className="border-r border-t border-gray-400 px-3 py-2 text-right tabular-nums">
                  {formatNumber(total)}
                </td>
                <td colSpan={4} className="border-t border-gray-400" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function BooleanCell({ checked, label, onChange }) {
  return (
    <td className="border-b border-r border-gray-300 px-2 py-1.5 text-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 cursor-pointer accent-emerald-700"
        aria-label={label}
      />
    </td>
  );
}
