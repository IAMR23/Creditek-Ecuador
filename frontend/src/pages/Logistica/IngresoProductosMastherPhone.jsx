import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { api } from "../../api/client";

const getEcuadorDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const addDays = (dateOnly, days) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
};

const getWeekStart = (dateOnly) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  return addDays(dateOnly, -(dayOfWeek === 0 ? 6 : dayOfWeek - 1));
};

const getPresetRange = (type) => {
  const today = getEcuadorDate();
  const [year, month] = today.split("-").map(Number);
  if (type === "SEMANA") {
    const start = getWeekStart(today);
    return { fechaInicio: start, fechaFin: addDays(start, 6) };
  }
  if (type === "SIETE_DIAS") {
    return { fechaInicio: addDays(today, -6), fechaFin: today };
  }
  if (type === "MES") {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      fechaInicio: `${year}-${String(month).padStart(2, "0")}-01`,
      fechaFin: `${year}-${String(month).padStart(2, "0")}-${lastDay}`,
    };
  }
  if (type === "ANIO") {
    return { fechaInicio: `${year}-01-01`, fechaFin: `${year}-12-31` };
  }
  return null;
};

const createRequestKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `masther-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const initialEntry = () => ({
  marcaId: "",
  modeloId: "",
  bodega: "",
  fechaIngreso: getEcuadorDate(),
  cantidad: 1,
  precioUnitario: "",
  requestKey: createRequestKey(),
});

const formatDate = (dateOnly) => {
  if (!dateOnly) return "-";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeZone: "America/Guayaquil",
  }).format(new Date(`${dateOnly}T12:00:00-05:00`));
};

const formatNumber = (value) =>
  new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(value || 0);

const formatCurrency = (value) =>
  value === null || value === undefined
    ? "Precio pendiente"
    : new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(value);

const isValidUnitPrice = (value) => {
  const text = String(value ?? "").trim();
  return /^\d+(?:\.\d{1,6})?$/.test(text) && Number(text) > 0;
};

const calculateAmounts = (quantityValue, unitPriceValue) => {
  const quantity = Number(quantityValue);
  const unitPriceUnits = Math.round(Number(unitPriceValue) * 1000000);
  if (!Number.isInteger(quantity) || quantity < 1 || unitPriceUnits < 1) {
    return { subtotal: 0, iva: 0, total: 0 };
  }
  const subtotalUnits = unitPriceUnits * quantity;
  const ivaUnits = Math.round(subtotalUnits * 0.15);
  return {
    subtotal: subtotalUnits / 1000000,
    iva: ivaUnits / 1000000,
    total: (subtotalUnits + ivaUnits) / 1000000,
  };
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

function PendingValue() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
      <AlertTriangle size={13} /> Pendiente de conciliación
    </span>
  );
}

export default function IngresoProductosMastherPhone() {
  const [catalog, setCatalog] = useState({ marcas: [], modelos: [] });
  const [entry, setEntry] = useState(initialEntry);
  const [filters, setFilters] = useState({ marcaId: "", modeloId: "" });
  const [periodType, setPeriodType] = useState("SEMANA");
  const [period, setPeriod] = useState(() => getPresetRange("SEMANA"));
  const [report, setReport] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingEntryEdit, setSavingEntryEdit] = useState(false);
  const [error, setError] = useState("");

  const entryModels = useMemo(
    () =>
      catalog.modelos.filter(
        (model) => String(model.marcaId) === String(entry.marcaId),
      ),
    [catalog.modelos, entry.marcaId],
  );
  const filterModels = useMemo(
    () =>
      filters.marcaId
        ? catalog.modelos.filter(
            (model) => String(model.marcaId) === String(filters.marcaId),
          )
        : catalog.modelos,
    [catalog.modelos, filters.marcaId],
  );
  const editModels = useMemo(
    () =>
      editDraft
        ? catalog.modelos.filter(
            (model) => String(model.marcaId) === String(editDraft.marcaId),
          )
        : [],
    [catalog.modelos, editDraft],
  );
  const entryAmounts = useMemo(
    () => calculateAmounts(entry.cantidad, entry.precioUnitario),
    [entry.cantidad, entry.precioUnitario],
  );
  const editAmounts = useMemo(
    () => calculateAmounts(editDraft?.cantidad, editDraft?.precioUnitario),
    [editDraft?.cantidad, editDraft?.precioUnitario],
  );

  const loadCatalog = useCallback(async () => {
    const { data } = await api.get("/api/logistica/masther-phone/catalogos");
    setCatalog({ marcas: data.marcas || [], modelos: data.modelos || [] });
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/logistica/masther-phone/reporte", {
        params: {
          fechaInicio: period.fechaInicio,
          fechaFin: period.fechaFin,
          ...(filters.marcaId ? { marcaId: filters.marcaId } : {}),
          ...(filters.modeloId ? { modeloId: filters.modeloId } : {}),
        },
      });
      setReport(data);
    } catch (requestError) {
      setReport(null);
      setError(getErrorMessage(requestError, "No se pudo cargar el control semanal."));
    } finally {
      setLoading(false);
    }
  }, [filters.marcaId, filters.modeloId, period.fechaFin, period.fechaInicio]);

  const loadEntries = useCallback(async () => {
    try {
      const { data } = await api.get("/api/logistica/masther-phone/ingresos", {
        params: {
          fechaInicio: period.fechaInicio,
          fechaFin: period.fechaFin,
          ...(filters.marcaId ? { marcaId: filters.marcaId } : {}),
          ...(filters.modeloId ? { modeloId: filters.modeloId } : {}),
        },
      });
      setEntries(data.ingresos || []);
    } catch (requestError) {
      setEntries([]);
      setError(getErrorMessage(requestError, "No se pudieron cargar los movimientos."));
    }
  }, [filters.marcaId, filters.modeloId, period.fechaFin, period.fechaInicio]);

  useEffect(() => {
    loadCatalog().catch((requestError) => {
      setError(getErrorMessage(requestError, "No se pudo cargar el catálogo."));
    });
  }, [loadCatalog]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const submitEntry = async (event) => {
    event.preventDefault();
    const quantity = Number(entry.cantidad);
    if (
      !entry.marcaId ||
      !entry.modeloId ||
      !entry.bodega ||
      !entry.fechaIngreso ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !isValidUnitPrice(entry.precioUnitario)
    ) {
      return Swal.fire(
        "Datos incompletos",
        "Selecciona todos los datos. El precio debe usar punto y tener máximo seis decimales.",
        "warning",
      );
    }

    try {
      setSavingEntry(true);
      const { data } = await api.post("/api/logistica/masther-phone/ingresos", {
        modeloId: Number(entry.modeloId),
        bodega: entry.bodega,
        fechaIngreso: entry.fechaIngreso,
        cantidad: quantity,
        precioUnitario: entry.precioUnitario,
        requestKey: entry.requestKey,
      });
      setEntry(initialEntry());
      await Promise.all([loadReport(), loadEntries()]);
      await Swal.fire(
        data.duplicado ? "Ingreso ya registrado" : "Ingreso registrado",
        data.duplicado
          ? "La solicitud ya había sido procesada; no se duplicó la cantidad."
          : "El movimiento independiente fue guardado correctamente.",
        "success",
      );
    } catch (requestError) {
      Swal.fire(
        "Error",
        getErrorMessage(requestError, "No se pudo registrar el ingreso."),
        "error",
      );
    } finally {
      setSavingEntry(false);
    }
  };

  const applyPeriodType = (type) => {
    setPeriodType(type);
    const preset = getPresetRange(type);
    if (preset) setPeriod(preset);
  };

  const shiftPeriod = (direction) => {
    if (periodType === "MES") {
      const [year, month] = period.fechaInicio.split("-").map(Number);
      const target = new Date(Date.UTC(year, month - 1 + direction, 1));
      const targetYear = target.getUTCFullYear();
      const targetMonth = target.getUTCMonth() + 1;
      const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
      setPeriod({
        fechaInicio: `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`,
        fechaFin: `${targetYear}-${String(targetMonth).padStart(2, "0")}-${lastDay}`,
      });
      return;
    }
    if (periodType === "ANIO") {
      const year = Number(period.fechaInicio.slice(0, 4)) + direction;
      setPeriod({ fechaInicio: `${year}-01-01`, fechaFin: `${year}-12-31` });
      return;
    }
    const start = new Date(`${period.fechaInicio}T00:00:00Z`);
    const end = new Date(`${period.fechaFin}T00:00:00Z`);
    const spanDays = Math.round((end - start) / 86400000) + 1;
    setPeriod({
      fechaInicio: addDays(period.fechaInicio, spanDays * direction),
      fechaFin: addDays(period.fechaFin, spanDays * direction),
    });
  };

  const startEditingEntry = (movement) => {
    setEditingEntryId(movement.id);
    setEditDraft({
      marcaId: String(movement.marcaId),
      modeloId: String(movement.modeloId),
      bodega: movement.bodega,
      fechaIngreso: movement.fechaIngreso,
      cantidad: movement.cantidad,
      precioUnitario: movement.precioUnitario ?? "",
    });
  };

  const saveEditedEntry = async () => {
    const quantity = Number(editDraft?.cantidad);
    if (
      !editDraft?.marcaId ||
      !editDraft?.modeloId ||
      !editDraft?.bodega ||
      !editDraft?.fechaIngreso ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !isValidUnitPrice(editDraft?.precioUnitario)
    ) {
      return Swal.fire(
        "Datos incompletos",
        "Selecciona todos los datos. El precio debe usar punto y tener máximo seis decimales.",
        "warning",
      );
    }

    try {
      setSavingEntryEdit(true);
      await api.put(`/api/logistica/masther-phone/ingresos/${editingEntryId}`, {
        modeloId: Number(editDraft.modeloId),
        bodega: editDraft.bodega,
        fechaIngreso: editDraft.fechaIngreso,
        cantidad: quantity,
        precioUnitario: editDraft.precioUnitario,
      });
      setEditingEntryId(null);
      setEditDraft(null);
      await Promise.all([loadReport(), loadEntries()]);
      Swal.fire("Ingreso actualizado", "La corrección fue guardada.", "success");
    } catch (requestError) {
      Swal.fire(
        "Error",
        getErrorMessage(requestError, "No se pudo actualizar el ingreso."),
        "error",
      );
    } finally {
      setSavingEntryEdit(false);
    }
  };

  const tableRows = report?.filas || [];
  const totals = report?.totales;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                Logística · Masther Phone
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Ingreso de productos
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Registra movimientos y concilia semanalmente las ventas por origen de stock.
              </p>
            </div>
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <strong>Período:</strong> {formatDate(period.fechaInicio)} al{" "}
              {formatDate(period.fechaFin)}
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <PackagePlus size={21} />
            </span>
            <div>
              <h2 className="font-bold text-slate-800">Nuevo ingreso de Masther Phone</h2>
              <p className="text-xs text-slate-500">Cada envío se guarda como un movimiento independiente.</p>
            </div>
          </div>
          <form onSubmit={submitEntry} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[1fr_1.3fr_180px_170px_110px_145px_auto] 2xl:items-end">
            <label className="text-sm font-semibold text-slate-700">
              Marca
              <select
                value={entry.marcaId}
                onChange={(event) =>
                  setEntry((current) => ({
                    ...current,
                    marcaId: event.target.value,
                    modeloId: "",
                  }))
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                required
              >
                <option value="">Selecciona una marca</option>
                {catalog.marcas.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.nombre}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Modelo
              <select
                value={entry.modeloId}
                onChange={(event) =>
                  setEntry((current) => ({ ...current, modeloId: event.target.value }))
                }
                disabled={!entry.marcaId}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none disabled:bg-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                required
              >
                <option value="">Selecciona un modelo</option>
                {entryModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.nombre}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Bodega
              <select
                value={entry.bodega}
                onChange={(event) =>
                  setEntry((current) => ({ ...current, bodega: event.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                required
              >
                <option value="">Selecciona una bodega</option>
                <option value="CREDITEK">Bodega Creditek</option>
                <option value="PROVEEDOR">Bodega Proveedor</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Fecha de ingreso
              <input
                type="date"
                value={entry.fechaIngreso}
                onChange={(event) =>
                  setEntry((current) => ({ ...current, fechaIngreso: event.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {entry.bodega === "CREDITEK" ? "Cantidad Stock Creditek" : "Cantidad Masther Phone"}
              <input
                type="number"
                min="1"
                step="1"
                value={entry.cantidad}
                onChange={(event) =>
                  setEntry((current) => ({ ...current, cantidad: event.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-right outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Precio unitario
              <input
                type="text"
                inputMode="decimal"
                pattern="\d+(\.\d{1,6})?"
                value={entry.precioUnitario}
                onChange={(event) =>
                  setEntry((current) => ({ ...current, precioUnitario: event.target.value }))
                }
                placeholder="0.000000"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-right outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </label>
            <button
              type="submit"
              disabled={savingEntry}
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingEntry ? <RefreshCw className="animate-spin" size={17} /> : <PackagePlus size={17} />}
              Registrar
            </button>
          </form>
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs font-bold uppercase text-slate-500">Subtotal</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(entryAmounts.subtotal)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs font-bold uppercase text-slate-500">IVA 15%</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(entryAmounts.iva)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-right">
              <p className="text-xs font-bold uppercase text-emerald-700">Valor total</p>
              <p className="mt-1 text-lg font-bold text-emerald-800">{formatCurrency(entryAmounts.total)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[170px_180px_180px_auto_1fr_1fr_auto] xl:items-end">
            <label className="text-sm font-semibold text-slate-700">
              Período
              <select
                value={periodType}
                onChange={(event) => applyPeriodType(event.target.value)}
                className="mt-1.5 h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-emerald-500"
              >
                <option value="SEMANA">Semana actual</option>
                <option value="SIETE_DIAS">Últimos 7 días</option>
                <option value="MES">Mes actual</option>
                <option value="ANIO">Año actual</option>
                <option value="PERSONALIZADO">Personalizado</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Fecha inicial
              <input
                type="date"
                value={period.fechaInicio}
                onChange={(event) => {
                  setPeriodType("PERSONALIZADO");
                  setPeriod((current) => ({ ...current, fechaInicio: event.target.value }));
                }}
                className="mt-1.5 h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
                required
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Fecha final
              <input
                type="date"
                value={period.fechaFin}
                onChange={(event) => {
                  setPeriodType("PERSONALIZADO");
                  setPeriod((current) => ({ ...current, fechaFin: event.target.value }));
                }}
                className="mt-1.5 h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
                required
              />
            </label>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shiftPeriod(-1)} className="rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-50" aria-label="Período anterior">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={() => shiftPeriod(1)} className="rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-50" aria-label="Período siguiente">
                <ChevronRight size={18} />
              </button>
            </div>
            <label className="text-sm font-semibold text-slate-700">
              Filtrar por marca
              <select
                value={filters.marcaId}
                onChange={(event) =>
                  setFilters({ marcaId: event.target.value, modeloId: "" })
                }
                className="mt-1.5 h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-emerald-500"
              >
                <option value="">Todas las marcas</option>
                {catalog.marcas.map((brand) => (
                  <option key={brand.id} value={brand.id}>{brand.nombre}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Filtrar por modelo
              <select
                value={filters.modeloId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, modeloId: event.target.value }))
                }
                className="mt-1.5 h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-emerald-500"
              >
                <option value="">Todos los modelos</option>
                {filterModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.marca} · {model.nombre}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={loadReport} className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
              <RefreshCw size={17} /> Actualizar
            </button>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <CalendarDays size={15} className="text-emerald-600" />
            Las ventas respetan exactamente las fechas elegidas. La bodega seleccionada al registrar cada movimiento determina si suma en CANTIDAD o en STOCK CREDITEK.
          </p>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-800">Movimientos del período</h2>
              <p className="mt-1 text-xs text-slate-500">
                Corrige el producto, la bodega, la fecha, la cantidad o el precio unitario registrado.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {entries.length} movimiento(s)
            </span>
          </div>
          {entries.length === 0 ? (
            <p className="p-5 text-center text-sm text-slate-500">
              No existen movimientos dentro de las fechas seleccionadas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left">FECHA DE INGRESO</th>
                    <th className="px-4 py-3 text-left">PRODUCTO</th>
                    <th className="px-4 py-3 text-left">BODEGA</th>
                    <th className="px-4 py-3 text-right">CANTIDAD</th>
                    <th className="px-4 py-3 text-right">PRECIO UNITARIO</th>
                    <th className="px-4 py-3 text-right">SUBTOTAL</th>
                    <th className="px-4 py-3 text-right">IVA 15%</th>
                    <th className="px-4 py-3 text-right">VALOR TOTAL</th>
                    <th className="px-4 py-3 text-right">ACCIONES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((movement) => {
                    const editing = editingEntryId === movement.id;
                    return (
                      <tr key={movement.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          {editing ? (
                            <input
                              type="date"
                              value={editDraft.fechaIngreso}
                              onChange={(event) =>
                                setEditDraft((current) => ({ ...current, fechaIngreso: event.target.value }))
                              }
                              className="rounded-lg border border-slate-300 px-2 py-1.5 outline-none focus:border-emerald-500"
                            />
                          ) : formatDate(movement.fechaIngreso)}
                        </td>
                        <td className="px-4 py-3">
                          {editing ? (
                            <div className="grid min-w-80 grid-cols-2 gap-2">
                              <select
                                value={editDraft.marcaId}
                                onChange={(event) =>
                                  setEditDraft((current) => ({
                                    ...current,
                                    marcaId: event.target.value,
                                    modeloId: "",
                                  }))
                                }
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-emerald-500"
                              >
                                {catalog.marcas.map((brand) => (
                                  <option key={brand.id} value={brand.id}>{brand.nombre}</option>
                                ))}
                              </select>
                              <select
                                value={editDraft.modeloId}
                                onChange={(event) =>
                                  setEditDraft((current) => ({ ...current, modeloId: event.target.value }))
                                }
                                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-emerald-500"
                              >
                                <option value="">Selecciona un modelo</option>
                                {editModels.map((model) => (
                                  <option key={model.id} value={model.id}>{model.nombre}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className="font-semibold text-slate-800">{movement.producto}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editing ? (
                            <select
                              value={editDraft.bodega}
                              onChange={(event) =>
                                setEditDraft((current) => ({ ...current, bodega: event.target.value }))
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-emerald-500"
                            >
                              <option value="CREDITEK">Bodega Creditek</option>
                              <option value="PROVEEDOR">Bodega Proveedor</option>
                            </select>
                          ) : movement.bodega === "CREDITEK" ? "Bodega Creditek" : "Bodega Proveedor"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={editDraft.cantidad}
                              onChange={(event) =>
                                setEditDraft((current) => ({ ...current, cantidad: event.target.value }))
                              }
                              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right outline-none focus:border-emerald-500"
                            />
                          ) : (
                            <span className="font-bold tabular-nums">{formatNumber(movement.cantidad)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editing ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="\d+(\.\d{1,6})?"
                              value={editDraft.precioUnitario}
                              onChange={(event) =>
                                setEditDraft((current) => ({ ...current, precioUnitario: event.target.value }))
                              }
                              placeholder="0.000000"
                              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right outline-none focus:border-emerald-500"
                            />
                          ) : formatCurrency(movement.precioUnitario)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {editing ? formatCurrency(editAmounts.subtotal) : formatCurrency(movement.subtotal)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {editing ? formatCurrency(editAmounts.iva) : formatCurrency(movement.iva)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800">
                          {editing ? formatCurrency(editAmounts.total) : formatCurrency(movement.total)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editing ? (
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={saveEditedEntry} disabled={savingEntryEdit} className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:opacity-50" title="Guardar corrección">
                                {savingEntryEdit ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                              </button>
                              <button type="button" onClick={() => { setEditingEntryId(null); setEditDraft(null); }} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100" title="Cancelar edición">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => startEditingEntry(movement)} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:border-emerald-400 hover:text-emerald-700" title="Editar ingreso">
                              <Pencil size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-800">
                <Boxes size={19} className="text-emerald-600" /> Control por período
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Ejemplo: ingreso 90, ventas 23 y STOCK CREDITEK 7 → MASTHER PHONE 16 y TOTAL BODEGA 74.
              </p>
            </div>
            <div className="text-right text-xs font-semibold text-slate-500">
              <p>Zona horaria: America/Guayaquil</p>
              {report && (
                <p className="mt-1">Rango consultado: {formatDate(report.fechaInicioSolicitada)} al {formatDate(report.fechaFinSolicitada)}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
              <RefreshCw className="mr-2 animate-spin" size={18} /> Cargando control...
            </div>
          ) : tableRows.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center text-slate-500">
              <Boxes size={36} className="text-slate-300" />
              <p className="mt-3 font-semibold">No existen ingresos acumulados para este período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">PRODUCTO</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">CANTIDAD</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">STOCK CREDITEK</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">VENTAS TOTALES SEMANA</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">MASTHER PHONE</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">TOTAL BODEGA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableRows.map((row) => (
                    <tr key={row.modeloId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{row.producto}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Control desde {formatDate(row.fechaInicioControl)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <p className="font-bold text-slate-800">{formatNumber(row.cantidad)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatNumber(row.stockCreditek)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(row.ventasTotalesSemana)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {row.mastherPhone === null ? <PendingValue /> : formatNumber(row.mastherPhone)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-800">
                        {row.totalBodega === null ? <PendingValue /> : formatNumber(row.totalBodega)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-800">
                  <tr>
                    <td className="px-4 py-3 text-left">TOTALES</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(totals?.cantidad)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totals?.stockCreditek === null ? <PendingValue /> : formatNumber(totals?.stockCreditek)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(totals?.ventasTotalesSemana)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totals?.mastherPhone === null ? <PendingValue /> : formatNumber(totals?.mastherPhone)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {totals?.totalBodega === null ? <PendingValue /> : formatNumber(totals?.totalBodega)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
