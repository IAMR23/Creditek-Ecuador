/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { api } from "../../api/client";
import { hasRouteAccess } from "../../config/routePermissions";
import { socket } from "../../socket/socket";

const getHoyLocal = () => new Date().toLocaleDateString("en-CA");

const currencyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? currencyFormatter.format(number) : "-";
};

const normalizarBusqueda = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const escaparHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const PRICE_FIELDS = [
  "precioCarga",
  "precioContado",
  "precioTarjetaCredito",
];

const getDraftValue = (row, field, borradores) => {
  const draft = borradores[String(row.modeloId)];
  return draft && Object.prototype.hasOwnProperty.call(draft, field)
    ? draft[field]
    : row[field] ?? "";
};

const esDecimalValido = (value) => /^\d*([.,]\d{0,2})?$/.test(value);

function PriceInput({ row, field, borradores, onChange, disabled }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={getDraftValue(row, field, borradores)}
      disabled={disabled}
      onChange={(event) => {
        const value = event.target.value;
        if (esDecimalValido(value)) onChange(row.modeloId, field, value);
      }}
      aria-label={`${field} de ${row.marca} ${row.nombre}`}
      className="h-7 w-20 rounded border border-gray-300 bg-white px-1.5 text-right text-[11px] font-semibold tabular-nums text-gray-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-gray-100 disabled:text-gray-400"
    />
  );
}

function TablaPrecios({
  title,
  rows,
  esTv,
  canEdit,
  borradores,
  onChange,
}) {
  const columnasPrecio = esTv
    ? [{ field: "precioCarga", label: "PVP Credito" }]
    : [
        { field: "precioCarga", label: "PVP Credito" },
        { field: "precioContado", label: "PVP Contado" },
        { field: "precioTarjetaCredito", label: "PVP Tarj. Credito" },
      ];

  return (
    <section className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase text-gray-800">{title}</h2>
        <span className="text-[11px] font-semibold text-gray-500">
          {rows.length} modelos
        </span>
      </div>

      <div className="overflow-x-auto border border-gray-300 bg-white">
        <table
          className={`w-full border-collapse text-[11px] ${esTv ? "min-w-[340px]" : "min-w-[500px]"}`}
        >
          <thead className="sticky top-0 z-[1] bg-gray-100 text-gray-700">
            <tr>
              <th className="border-b border-r border-gray-300 px-1.5 py-1.5 text-left">
                Marca
              </th>
              <th className="border-b border-r border-gray-300 px-1.5 py-1.5 text-left">
                Nombre
              </th>
              {columnasPrecio.map((column) => (
                <th
                  key={column.field}
                  className="border-b border-r border-gray-300 px-1.5 py-1.5 text-right last:border-r-0"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const changed = Boolean(borradores[String(row.modeloId)]);
              const sinCosto = !row.costoHistoricoId;

              return (
                <tr
                  key={row.modeloId}
                  className={`${changed ? "bg-amber-50" : "even:bg-gray-50"} hover:bg-emerald-50/60`}
                >
                  <td className="border-b border-r border-gray-300 px-1.5 py-1 font-bold text-gray-900">
                    <div className="truncate" title={row.marca || "-"}>
                      {row.marca || "-"}
                    </div>
                  </td>
                  <td className="border-b border-r border-gray-300 px-1.5 py-1 font-medium text-gray-800">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="truncate" title={row.nombre || "-"}>
                        {row.nombre || "-"}
                      </span>
                    {sinCosto && (
                      <span
                        className="shrink-0 text-[9px] font-semibold text-red-600"
                        title="Sin costo histórico"
                      >
                        Sin costo
                      </span>
                    )}
                    </div>
                  </td>
                  {columnasPrecio.map((column) => (
                    <td
                      key={column.field}
                      className="border-b border-r border-gray-300 px-1.5 py-1 text-right last:border-r-0"
                    >
                      {canEdit ? (
                        <PriceInput
                          row={row}
                          field={column.field}
                          borradores={borradores}
                          onChange={onChange}
                          disabled={sinCosto}
                        />
                      ) : (
                        <span
                          className={`tabular-nums ${column.field === "precioCarga" ? "font-bold text-gray-950" : "font-medium text-gray-800"}`}
                        >
                          {formatCurrency(row[column.field])}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}

            {!rows.length && (
              <tr>
                <td
                  colSpan={columnasPrecio.length + 2}
                  className="px-3 py-8 text-center text-gray-500"
                >
                  No hay modelos para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ListaPrecios({ auth }) {
  const [fecha, setFecha] = useState(getHoyLocal());
  const [rows, setRows] = useState([]);
  const [borradores, setBorradores] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const borradoresRef = useRef(borradores);

  const canEdit = hasRouteAccess({
    rol: auth?.rol,
    permisos: auth?.permisos || [],
    permission: ["Catalogos", "Administracion"],
  });

  useEffect(() => {
    borradoresRef.current = borradores;
  }, [borradores]);

  const cargarLista = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);

      try {
        const { data } = await api.get("/costos/lista-precios", {
          params: { fecha },
        });
        const modelosActivos = Array.isArray(data.precios)
          ? data.precios.filter((row) => row.activo === true)
          : [];
        setRows(modelosActivos);
        setBorradores({});
      } catch (error) {
        Swal.fire(
          "Error",
          error.response?.data?.message || "No se pudo cargar la lista de precios.",
          "error",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [fecha],
  );

  useEffect(() => {
    cargarLista();
  }, [cargarLista]);

  useEffect(() => {
    const handleUpdated = ({ fechaVigencia } = {}) => {
      if (
        fechaVigencia === fecha &&
        Object.keys(borradoresRef.current).length === 0
      ) {
        cargarLista({ silent: true });
      }
    };

    socket.on("listaPrecios:updated", handleUpdated);
    return () => socket.off("listaPrecios:updated", handleUpdated);
  }, [cargarLista, fecha]);

  const rowsFiltradas = useMemo(() => {
    const needle = normalizarBusqueda(busqueda);
    return rows.filter((row) => {
      const coincideVista =
        vista === "todos" ||
        (vista === "movil" && row.tipo === "MOVIL") ||
        (vista === "tv" && row.tipo === "TV");
      const coincideTexto =
        !needle ||
        normalizarBusqueda(
          `${row.marca} ${row.nombre} ${row.dispositivo}`,
        ).includes(needle);
      return coincideVista && coincideTexto;
    });
  }, [busqueda, rows, vista]);

  const moviles = useMemo(
    () => rowsFiltradas.filter((row) => row.tipo !== "TV"),
    [rowsFiltradas],
  );
  const televisores = useMemo(
    () => rowsFiltradas.filter((row) => row.tipo === "TV"),
    [rowsFiltradas],
  );
  const cambiosCount = Object.keys(borradores).length;

  const actualizarPrecio = (modeloId, field, value) => {
    if (!PRICE_FIELDS.includes(field)) return;
    setBorradores((prev) => ({
      ...prev,
      [String(modeloId)]: {
        ...(prev[String(modeloId)] || {}),
        [field]: value,
      },
    }));
  };

  const descartarCambios = () => setBorradores({});

  const guardarCambios = async () => {
    const changedRows = rows.filter((row) => borradores[String(row.modeloId)]);
    if (!changedRows.length) return;

    const precios = changedRows.map((row) => ({
      modeloId: row.modeloId,
      precioCarga: getDraftValue(row, "precioCarga", borradores),
      precioContado: getDraftValue(row, "precioContado", borradores),
      precioTarjetaCredito: getDraftValue(
        row,
        "precioTarjetaCredito",
        borradores,
      ),
    }));

    try {
      setSaving(true);
      const { data } = await api.put("/costos/lista-precios", {
        fechaVigencia: fecha,
        precios,
      });
      await cargarLista({ silent: true });
      Swal.fire({
        icon: "success",
        title: "Precios actualizados",
        text: `${data.creados} nuevas vigencias y ${data.actualizados} actualizaciones.`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron guardar los precios.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const exportarExcel = () => {
    const mapMovil = (row) => ({
      Marca: row.marca,
      Nombre: row.nombre,
      "PVP CREDITO": row.precioCarga,
      "PVP CONTADO": row.precioContado,
      "PVP TARJ. CREDITO": row.precioTarjetaCredito,
    });
    const mapTv = (row) => ({
      Marca: row.marca,
      Nombre: row.nombre,
      "PVP CREDITO": row.precioCarga,
    });

    const workbook = XLSX.utils.book_new();
    const movilSheet = XLSX.utils.json_to_sheet(moviles.map(mapMovil));
    movilSheet["!cols"] = [
      { wch: 16 },
      { wch: 38 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
    ];
    const tvSheet = XLSX.utils.json_to_sheet(televisores.map(mapTv));
    tvSheet["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, movilSheet, "Celulares");
    XLSX.utils.book_append_sheet(workbook, tvSheet, "Televisores");
    XLSX.writeFile(workbook, `Lista_Precios_${fecha}.xlsx`);
  };

  const imprimir = () => {
    const renderRows = (items, tv = false) =>
      items
        .map(
          (row) => `<tr>
            <td>${escaparHtml(row.marca)}</td>
            <td>${escaparHtml(row.nombre)}</td>
            <td class="money strong">${escaparHtml(formatCurrency(row.precioCarga))}</td>
            ${
              tv
                ? ""
                : `<td class="money">${escaparHtml(formatCurrency(row.precioContado))}</td>
                   <td class="money">${escaparHtml(formatCurrency(row.precioTarjetaCredito))}</td>`
            }
          </tr>`,
        )
        .join("");

    const ventana = window.open("", "_blank");
    if (!ventana) {
      Swal.fire("Ventana bloqueada", "Permite ventanas emergentes para imprimir.", "warning");
      return;
    }

    ventana.document.write(`<!doctype html>
      <html><head><title>Lista de precios ${escaparHtml(fecha)}</title>
      <style>
        @page { size: A4 landscape; margin: 9mm; }
        body { font-family: Arial, sans-serif; margin: 0; color: #111827; }
        header { display: flex; justify-content: space-between; align-items: end; margin-bottom: 10px; }
        h1 { font-size: 18px; margin: 0; } .date { font-size: 11px; }
        .tables { display: grid; grid-template-columns: 1.7fr 1fr; gap: 16px; align-items: start; }
        h2 { font-size: 11px; margin: 0 0 4px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; font-size: 9px; }
        th, td { border: 1px solid #9ca3af; padding: 4px; text-align: left; }
        th { background: #f3f4f6; } .money { text-align: right; } .strong { font-weight: 700; }
      </style></head><body>
      <header><h1>Lista de precios</h1><div class="date">Vigencia: ${escaparHtml(fecha)}</div></header>
      <div class="tables">
        <section><h2>Celulares y tablets</h2><table><thead><tr><th>Marca</th><th>Nombre</th><th>PVP Credito</th><th>PVP Contado</th><th>PVP Tarj. Credito</th></tr></thead><tbody>${renderRows(moviles)}</tbody></table></section>
        <section><h2>Televisores</h2><table><thead><tr><th>Marca</th><th>Nombre</th><th>PVP Credito</th></tr></thead><tbody>${renderRows(televisores, true)}</tbody></table></section>
      </div><script>window.onload=()=>{window.focus();window.print();};</script>
      </body></html>`);
    ventana.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 md:p-4">
      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950">Lista de precios</h1>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium text-gray-600">
            <span>{rows.length} modelos activos</span>
            <span>Vigencia {fecha}</span>
            {canEdit && cambiosCount > 0 && (
              <span className="text-amber-700">{cambiosCount} cambios pendientes</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-1.5">
          <label className="text-[11px] font-semibold text-gray-700">
            <span className="mb-0.5 block">Vigencia</span>
            <input
              type="date"
              value={fecha}
              onChange={(event) => {
                if (cambiosCount) {
                  Swal.fire(
                    "Cambios pendientes",
                    "Guarda o descarta los cambios antes de cambiar la vigencia.",
                    "warning",
                  );
                  return;
                }
                setFecha(event.target.value);
              }}
              className="h-8 rounded border border-gray-300 bg-white px-2 text-xs outline-none focus:border-emerald-600"
            />
          </label>

          <button
            type="button"
            onClick={exportarExcel}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-emerald-700 hover:bg-emerald-50"
            title="Descargar Excel"
            aria-label="Descargar lista en Excel"
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            type="button"
            onClick={imprimir}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-red-700 hover:bg-red-50"
            title="Imprimir o guardar PDF"
            aria-label="Imprimir o guardar lista en PDF"
          >
            <Printer size={16} />
          </button>

          {canEdit && cambiosCount > 0 && (
            <>
              <button
                type="button"
                onClick={descartarCambios}
                disabled={saving}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                title="Descartar cambios"
                aria-label="Descartar cambios"
              >
                <X size={17} />
              </button>
              <button
                type="button"
                onClick={guardarCambios}
                disabled={saving}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded bg-emerald-700 px-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {saving ? <RefreshCw className="animate-spin" size={17} /> : <Save size={17} />}
                Guardar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-2 border-y border-gray-200 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar marca o modelo"
            className="h-8 w-full rounded border border-gray-300 bg-white pl-8 pr-2 text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="inline-flex h-8 self-start rounded border border-gray-300 bg-white p-0.5 sm:self-auto">
          {[
            ["todos", "Todos"],
            ["movil", "Moviles"],
            ["tv", "TV"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setVista(value)}
              className={`px-2.5 text-[11px] font-semibold ${
                vista === value
                  ? "rounded bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-950"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm font-medium text-gray-500">
          Cargando lista de precios...
        </div>
      ) : (
        <div
          className={`grid items-start gap-4 ${
            vista === "todos" ? "xl:grid-cols-[minmax(0,1.75fr)_minmax(340px,0.85fr)]" : "grid-cols-1"
          }`}
        >
          {vista !== "tv" && (
            <TablaPrecios
              title="Celulares y tablets"
              rows={moviles}
              canEdit={canEdit}
              borradores={borradores}
              onChange={actualizarPrecio}
            />
          )}
          {vista !== "movil" && (
            <TablaPrecios
              title="Televisores"
              rows={televisores}
              esTv
              canEdit={canEdit}
              borradores={borradores}
              onChange={actualizarPrecio}
            />
          )}
        </div>
      )}
    </div>
  );
}
