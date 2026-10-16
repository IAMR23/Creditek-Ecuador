import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
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

const toEcuadorDateTimeLocal = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

const addDays = (dateOnly, days) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const getWeekStart = (dateOnly) => {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(dateOnly, -((dayOfWeek - 4 + 7) % 7));
};

const createRequestKey = () =>
  globalThis.crypto?.randomUUID?.() ||
  `masther-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

const initialEntry = () => ({
  marcaId: "",
  modeloId: "",
  bodega: "",
  fechaIngreso: toEcuadorDateTimeLocal(),
  cantidad: 1,
  precioUnitario: "",
  requestKey: createRequestKey(),
});

const initialAdjustment = () => ({
  marcaId: "",
  modeloId: "",
  origen: "",
  fechaAjuste: toEcuadorDateTimeLocal(),
  cantidad: "",
  motivo: "",
  corregirCierreVisible: false,
  requestKey: createRequestKey(),
});

const formatDate = (dateOnly) => {
  if (!dateOnly) return "-";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeZone: "America/Guayaquil",
  }).format(new Date(`${dateOnly}T12:00:00-05:00`));
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  }).format(date);
};

const formatNumber = (value) =>
  new Intl.NumberFormat("es-EC", { maximumFractionDigits: 0 }).format(value || 0);

const formatSigned = (value) => {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${formatNumber(number)}`;
};

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
  if (!String(unitPriceValue ?? "").trim()) {
    return { subtotal: null, iva: null, total: null };
  }
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

const modelsForBrand = (catalog, brandId) =>
  brandId
    ? catalog.modelos.filter((model) => String(model.marcaId) === String(brandId))
    : catalog.modelos;

export default function IngresoProductosMastherPhone() {
  const [catalog, setCatalog] = useState({ marcas: [], modelos: [] });
  const [entry, setEntry] = useState(initialEntry);
  const [adjustment, setAdjustment] = useState(initialAdjustment);
  const [filters, setFilters] = useState({ marcaId: "", modeloId: "" });
  const [weekStart, setWeekStart] = useState(() => getWeekStart(getEcuadorDate()));
  const [report, setReport] = useState(null);
  const [entries, setEntries] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [savingEntryEdit, setSavingEntryEdit] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState(null);
  const [error, setError] = useState("");

  const weekEnd = addDays(weekStart, 6);
  const entryModels = useMemo(
    () => modelsForBrand(catalog, entry.marcaId),
    [catalog, entry.marcaId],
  );
  const adjustmentModels = useMemo(
    () => modelsForBrand(catalog, adjustment.marcaId),
    [adjustment.marcaId, catalog],
  );
  const filterModels = useMemo(
    () => modelsForBrand(catalog, filters.marcaId),
    [catalog, filters.marcaId],
  );
  const editModels = useMemo(
    () => modelsForBrand(catalog, editDraft?.marcaId),
    [catalog, editDraft?.marcaId],
  );
  const entryAmounts = useMemo(
    () => calculateAmounts(entry.cantidad, entry.precioUnitario),
    [entry.cantidad, entry.precioUnitario],
  );
  const editAmounts = useMemo(
    () => calculateAmounts(editDraft?.cantidad, editDraft?.precioUnitario),
    [editDraft?.cantidad, editDraft?.precioUnitario],
  );

  const filterParams = useMemo(
    () => ({
      ...(filters.marcaId ? { marcaId: filters.marcaId } : {}),
      ...(filters.modeloId ? { modeloId: filters.modeloId } : {}),
    }),
    [filters.marcaId, filters.modeloId],
  );

  const loadCatalog = useCallback(async () => {
    const { data } = await api.get("/api/logistica/masther-phone/catalogos");
    setCatalog({ marcas: data.marcas || [], modelos: data.modelos || [] });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [reportResponse, entriesResponse, adjustmentsResponse] = await Promise.all([
        api.get("/api/logistica/masther-phone/reporte", {
          params: { semanaInicio: weekStart, ...filterParams },
        }),
        api.get("/api/logistica/masther-phone/ingresos", {
          params: { fechaInicio: weekStart, fechaFin: addDays(weekStart, 6), ...filterParams },
        }),
        api.get("/api/logistica/masther-phone/ajustes", {
          params: { fechaInicio: weekStart, fechaFin: addDays(weekStart, 6), ...filterParams },
        }),
      ]);
      setReport(reportResponse.data);
      setEntries(entriesResponse.data.ingresos || []);
      setAdjustments(adjustmentsResponse.data.ajustes || []);
    } catch (requestError) {
      setReport(null);
      setEntries([]);
      setAdjustments([]);
      setError(getErrorMessage(requestError, "No se pudo cargar el control semanal."));
    } finally {
      setLoading(false);
    }
  }, [filterParams, weekStart]);

  useEffect(() => {
    loadCatalog().catch((requestError) =>
      setError(getErrorMessage(requestError, "No se pudo cargar el catálogo.")),
    );
  }, [loadCatalog]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      (String(entry.precioUnitario).trim() && !isValidUnitPrice(entry.precioUnitario))
    ) {
      return Swal.fire(
        "Datos incompletos",
        "Selecciona todos los datos. Si ingresas un precio, usa punto y máximo seis decimales.",
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
      await loadData();
      await Swal.fire(
        data.duplicado ? "Ingreso ya registrado" : "Ingreso registrado",
        data.duplicado
          ? "La solicitud ya había sido procesada; no se duplicó la cantidad."
          : "El movimiento fue guardado en el origen seleccionado.",
        "success",
      );
    } catch (requestError) {
      Swal.fire("Error", getErrorMessage(requestError, "No se pudo registrar el ingreso."), "error");
    } finally {
      setSavingEntry(false);
    }
  };

  const submitAdjustment = async (event) => {
    event.preventDefault();
    const quantity = Number(adjustment.cantidad);
    if (
      !adjustment.marcaId ||
      !adjustment.modeloId ||
      !adjustment.origen ||
      !adjustment.fechaAjuste ||
      !Number.isInteger(quantity) ||
      quantity === 0 ||
      adjustment.motivo.trim().length < 5
    ) {
      return Swal.fire(
        "Ajuste incompleto",
        "Indica producto, origen, un entero distinto de cero y un motivo de al menos 5 caracteres.",
        "warning",
      );
    }
    try {
      setSavingAdjustment(true);
      await api.post("/api/logistica/masther-phone/ajustes", {
        modeloId: Number(adjustment.modeloId),
        origen: adjustment.origen,
        fechaAjuste: adjustment.fechaAjuste,
        cantidad: quantity,
        motivo: adjustment.motivo.trim(),
        requestKey: adjustment.requestKey,
        ...(adjustment.corregirCierreVisible && report?.cierre?.id
          ? { cierreCorregidoId: report.cierre.id }
          : {}),
      });
      setAdjustment(initialAdjustment());
      await loadData();
      await Swal.fire(
        "Ajuste registrado",
        "El ajuste quedó auditado y se aplicará en la semana abierta de su fecha.",
        "success",
      );
    } catch (requestError) {
      Swal.fire("Error", getErrorMessage(requestError, "No se pudo registrar el ajuste."), "error");
    } finally {
      setSavingAdjustment(false);
    }
  };

  const closeSelectedWeek = async () => {
    const totals = report?.totales || {};
    const confirmation = await Swal.fire({
      title: "¿Cerrar semana?",
      html: `
        <div style="text-align:left">
          <p><strong>${formatDate(weekStart)} al ${formatDate(weekEnd)}</strong></p>
          <p>Ventas: ${formatNumber(totals.ventasTotales)}</p>
          <p>Saldo Creditek: ${formatNumber(totals.saldoFinalCreditek)}</p>
          <p>Saldo proveedor: ${formatNumber(totals.saldoFinalProveedor)}</p>
          <p style="margin-top:10px">El cierre guardará una foto histórica inmutable.</p>
        </div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#059669",
      confirmButtonText: "Sí, cerrar semana",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    try {
      setClosing(true);
      await api.post(`/api/logistica/masther-phone/cierres/${weekStart}`);
      await loadData();
      await Swal.fire("Semana cerrada", "Los saldos quedaron listos para el jueves siguiente.", "success");
    } catch (requestError) {
      await Swal.fire("No se pudo cerrar", getErrorMessage(requestError, "Revisa las incidencias."), "error");
    } finally {
      setClosing(false);
    }
  };

  const startEditingEntry = (movement) => {
    setEditingEntryId(movement.id);
    setEditDraft({
      marcaId: String(movement.marcaId),
      modeloId: String(movement.modeloId),
      bodega: movement.bodega,
      fechaIngreso: toEcuadorDateTimeLocal(movement.fechaIngreso),
      cantidad: movement.cantidad,
      precioUnitario: movement.precioUnitario ?? "",
    });
  };

  const saveEditedEntry = async () => {
    const quantity = Number(editDraft?.cantidad);
    if (
      !editDraft?.modeloId ||
      !editDraft?.bodega ||
      !editDraft?.fechaIngreso ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      (String(editDraft?.precioUnitario ?? "").trim() &&
        !isValidUnitPrice(editDraft?.precioUnitario))
    ) {
      return Swal.fire("Datos incompletos", "Revisa los datos del ingreso.", "warning");
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
      await loadData();
      Swal.fire("Ingreso actualizado", "La corrección fue guardada.", "success");
    } catch (requestError) {
      Swal.fire("Error", getErrorMessage(requestError, "No se pudo actualizar el ingreso."), "error");
    } finally {
      setSavingEntryEdit(false);
    }
  };

  const deleteMovement = async (movement) => {
    const confirmation = await Swal.fire({
      title: "¿Eliminar movimiento?",
      text: `Se eliminará el ingreso de ${movement.producto}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;
    try {
      setDeletingEntryId(movement.id);
      await api.delete(`/api/logistica/masther-phone/ingresos/${movement.id}`);
      setEditingEntryId(null);
      setEditDraft(null);
      await loadData();
    } catch (requestError) {
      Swal.fire("Error", getErrorMessage(requestError, "No se pudo eliminar el movimiento."), "error");
    } finally {
      setDeletingEntryId(null);
    }
  };

  const tableRows = report?.filas || [];
  const totals = report?.totales || {};
  const closed = report?.estado === "CERRADA";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                Logística · Masther Phone
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">Ingreso de productos</h1>
              <p className="mt-1 text-sm text-slate-500">
                Control semanal por origen, de jueves 00:00 a jueves 00:00 (exclusivo).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <strong>Semana:</strong> {formatDate(weekStart)} al {formatDate(weekEnd)}
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${
                  closed ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-800"
                }`}
              >
                {closed ? <LockKeyhole size={16} /> : <CalendarDays size={16} />}
                {closed ? "Cerrada" : "Abierta"}
              </span>
            </div>
          </div>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700"><PackagePlus size={21} /></span>
            <div>
              <h2 className="font-bold text-slate-800">Nuevo ingreso</h2>
              <p className="text-xs text-slate-500">El saldo arrastrado no aparece aquí: no es un ingreso nuevo.</p>
            </div>
          </div>
          <form onSubmit={submitEntry} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[1fr_1.3fr_170px_190px_130px_160px_auto] 2xl:items-end">
            <label className="text-sm font-semibold text-slate-700">Marca
              <select value={entry.marcaId} onChange={(event) => setEntry((current) => ({ ...current, marcaId: event.target.value, modeloId: "" }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" required>
                <option value="">Selecciona</option>
                {catalog.marcas.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Modelo
              <select value={entry.modeloId} onChange={(event) => setEntry((current) => ({ ...current, modeloId: event.target.value }))} disabled={!entry.marcaId} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-100" required>
                <option value="">Selecciona</option>
                {entryModels.map((model) => <option key={model.id} value={model.id}>{model.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Origen
              <select value={entry.bodega} onChange={(event) => setEntry((current) => ({ ...current, bodega: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" required>
                <option value="">Selecciona</option>
                <option value="CREDITEK">Creditek</option>
                <option value="PROVEEDOR">Proveedor</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Fecha y hora
              <input type="datetime-local" value={entry.fechaIngreso} onChange={(event) => setEntry((current) => ({ ...current, fechaIngreso: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
            </label>
            <label className="text-sm font-semibold text-slate-700">Cantidad
              <input type="number" min="1" step="1" value={entry.cantidad} onChange={(event) => setEntry((current) => ({ ...current, cantidad: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-right" required />
            </label>
            <label className="text-sm font-semibold text-slate-700">Precio unitario
              <input type="text" inputMode="decimal" pattern="\d+(\.\d{1,6})?" value={entry.precioUnitario} onChange={(event) => setEntry((current) => ({ ...current, precioUnitario: event.target.value }))} placeholder="Opcional" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-right" />
            </label>
            <button type="submit" disabled={savingEntry} className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {savingEntry ? <RefreshCw className="animate-spin" size={17} /> : <PackagePlus size={17} />} Registrar
            </button>
          </form>
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
            {[['Subtotal', entryAmounts.subtotal], ['IVA 15%', entryAmounts.iva], ['Valor total', entryAmounts.total]].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{formatCurrency(value)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-lg bg-blue-100 p-2 text-blue-700"><SlidersHorizontal size={21} /></span>
            <div>
              <h2 className="font-bold text-slate-800">Ajuste auditado</h2>
              <p className="text-xs text-slate-500">Usa cantidad positiva para sumar y negativa para restar. El motivo es obligatorio.</p>
            </div>
          </div>
          <form onSubmit={submitAdjustment} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[1fr_1.3fr_160px_190px_130px_2fr_auto] 2xl:items-end">
            <label className="text-sm font-semibold text-slate-700">Marca
              <select value={adjustment.marcaId} onChange={(event) => setAdjustment((current) => ({ ...current, marcaId: event.target.value, modeloId: "" }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" required>
                <option value="">Selecciona</option>
                {catalog.marcas.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Modelo
              <select value={adjustment.modeloId} onChange={(event) => setAdjustment((current) => ({ ...current, modeloId: event.target.value }))} disabled={!adjustment.marcaId} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-100" required>
                <option value="">Selecciona</option>
                {adjustmentModels.map((model) => <option key={model.id} value={model.id}>{model.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Origen
              <select value={adjustment.origen} onChange={(event) => setAdjustment((current) => ({ ...current, origen: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5" required>
                <option value="">Selecciona</option><option value="CREDITEK">Creditek</option><option value="PROVEEDOR">Proveedor</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Fecha y hora
              <input type="datetime-local" value={adjustment.fechaAjuste} onChange={(event) => setAdjustment((current) => ({ ...current, fechaAjuste: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
            </label>
            <label className="text-sm font-semibold text-slate-700">Cantidad ±
              <input type="number" step="1" value={adjustment.cantidad} onChange={(event) => setAdjustment((current) => ({ ...current, cantidad: event.target.value }))} placeholder="Ej. -2" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-right" required />
            </label>
            <label className="text-sm font-semibold text-slate-700">Motivo
              <input type="text" minLength="5" maxLength="500" value={adjustment.motivo} onChange={(event) => setAdjustment((current) => ({ ...current, motivo: event.target.value }))} placeholder="Detalle verificable del ajuste" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" required />
            </label>
            <button type="submit" disabled={savingAdjustment} className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {savingAdjustment ? <RefreshCw className="animate-spin" size={17} /> : <Save size={17} />} Guardar
            </button>
            {closed && report?.cierre?.id && (
              <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2 xl:col-span-4 2xl:col-span-7">
                <input type="checkbox" checked={adjustment.corregirCierreVisible} onChange={(event) => setAdjustment((current) => ({ ...current, corregirCierreVisible: event.target.checked }))} />
                Marcar como corrección trazable del cierre visible. Se aplicará en la semana abierta indicada por la fecha, sin modificar el cierre histórico.
              </label>
            )}
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => setWeekStart((current) => addDays(current, -7))} className="rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-50" aria-label="Semana anterior"><ChevronLeft size={18} /></button>
              <div className="min-w-64 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center text-sm font-bold text-slate-700">
                Jueves {formatDate(weekStart)} — miércoles {formatDate(weekEnd)}
              </div>
              <button type="button" onClick={() => setWeekStart((current) => addDays(current, 7))} className="rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-50" aria-label="Semana siguiente"><ChevronRight size={18} /></button>
              <button type="button" onClick={() => setWeekStart(getWeekStart(getEcuadorDate()))} className="h-[42px] rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">Actual</button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold text-slate-700">Marca
                <select value={filters.marcaId} onChange={(event) => setFilters({ marcaId: event.target.value, modeloId: "" })} className="mt-1.5 block h-[42px] min-w-48 rounded-lg border border-slate-300 bg-white px-3">
                  <option value="">Todas</option>{catalog.marcas.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">Modelo
                <select value={filters.modeloId} onChange={(event) => setFilters((current) => ({ ...current, modeloId: event.target.value }))} className="mt-1.5 block h-[42px] min-w-56 rounded-lg border border-slate-300 bg-white px-3">
                  <option value="">Todos</option>{filterModels.map((model) => <option key={model.id} value={model.id}>{model.marca} · {model.nombre}</option>)}
                </select>
              </label>
              <button type="button" onClick={loadData} className="inline-flex h-[42px] items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"><RefreshCw size={17} /> Actualizar</button>
              <button type="button" onClick={closeSelectedWeek} disabled={!report?.puedeCerrar || closing} className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {closing ? <RefreshCw className="animate-spin" size={17} /> : <LockKeyhole size={17} />} Cerrar semana
              </button>
            </div>
          </div>
          {!report?.puedeCerrar && report?.motivoNoCierre && (
            <p className="mt-3 text-xs font-semibold text-slate-500">Cierre no disponible: {report.motivoNoCierre}</p>
          )}
        </section>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {(report?.incidencias || []).length > 0 && (
          <section className="rounded-xl border border-red-300 bg-red-50 p-4 shadow-sm">
            <h2 className="flex items-center gap-2 font-bold text-red-800"><AlertTriangle size={19} /> Incidencias pendientes</h2>
            <p className="mt-1 text-sm text-red-700">Estas salidas no tienen existencias suficientes y bloquean el cierre.</p>
            <div className="mt-3 space-y-2">
              {report.incidencias.map((incident, index) => (
                <div key={`${incident.tipo}-${incident.referenciaId}-${index}`} className="rounded-lg bg-white p-3 text-sm text-red-800">
                  <strong>{incident.producto}</strong> · {formatDate(incident.fecha)} · faltante {formatNumber(incident.faltante)}. {incident.mensaje}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-800"><Boxes size={19} className="text-emerald-600" /> Control semanal</h2>
              <p className="mt-1 text-xs text-slate-500">Stock inicial arrastrado, movimientos del período y saldo final por origen.</p>
            </div>
            {closed && report?.cierre && <p className="text-xs font-semibold text-slate-500">Cierre #{report.cierre.id} · {formatDateTime(report.cierre.cerradoEn)}</p>}
          </div>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-slate-500"><RefreshCw className="mr-2 animate-spin" size={18} /> Cargando control...</div>
          ) : tableRows.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center p-6 text-center text-slate-500"><Boxes size={36} className="text-slate-300" /><p className="mt-3 font-semibold">No hay saldos ni movimientos para esta semana.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px] border-collapse text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-3 text-left">Producto</th>
                    <th className="px-3 py-3 text-right">Inicial Creditek</th><th className="px-3 py-3 text-right">Inicial Proveedor</th>
                    <th className="px-3 py-3 text-right">Ingresos Creditek</th><th className="px-3 py-3 text-right">Ingresos Proveedor</th>
                    <th className="px-3 py-3 text-right">Ventas totales</th><th className="px-3 py-3 text-right">Desde Creditek</th><th className="px-3 py-3 text-right">Desde proveedor</th>
                    <th className="px-3 py-3 text-right">Ajuste Creditek</th><th className="px-3 py-3 text-right">Ajuste Proveedor</th>
                    <th className="px-3 py-3 text-right">Final Creditek</th><th className="px-3 py-3 text-right">Final Proveedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableRows.map((row) => (
                    <tr key={row.modeloId} className={row.incidencias?.length ? "bg-red-50" : "hover:bg-slate-50/70"}>
                      <td className="px-3 py-3 font-bold text-slate-800">{row.producto}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatNumber(row.stockInicialCreditek)}</td><td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatNumber(row.stockInicialProveedor)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatNumber(row.ingresosCreditek)}</td><td className="px-3 py-3 text-right tabular-nums">{formatNumber(row.ingresosProveedor)}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">{formatNumber(row.ventasTotales)}</td><td className="px-3 py-3 text-right tabular-nums">{formatNumber(row.ventasCreditek)}</td><td className="px-3 py-3 text-right tabular-nums">{formatNumber(row.ventasProveedor)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatSigned(row.ajustesCreditek)}</td><td className="px-3 py-3 text-right tabular-nums">{formatSigned(row.ajustesProveedor)}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700">{formatNumber(row.saldoFinalCreditek)}</td><td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-700">{formatNumber(row.saldoFinalProveedor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-800">
                  <tr>
                    <td className="px-3 py-3">Totales</td>
                    {['stockInicialCreditek','stockInicialProveedor','ingresosCreditek','ingresosProveedor','ventasTotales','ventasCreditek','ventasProveedor'].map((field) => <td key={field} className="px-3 py-3 text-right tabular-nums">{formatNumber(totals[field])}</td>)}
                    <td className="px-3 py-3 text-right tabular-nums">{formatSigned(totals.ajustesCreditek)}</td><td className="px-3 py-3 text-right tabular-nums">{formatSigned(totals.ajustesProveedor)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(totals.saldoFinalCreditek)}</td><td className="px-3 py-3 text-right tabular-nums">{formatNumber(totals.saldoFinalProveedor)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div><h2 className="font-bold text-slate-800">Ingresos del período</h2><p className="mt-1 text-xs text-slate-500">Los saldos iniciales no se incluyen en esta lista.</p></div>
            <span className="text-xs font-semibold text-slate-500">{entries.length} movimiento(s)</span>
          </div>
          {entries.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">No hay ingresos en esta semana.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[1300px] text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600"><tr><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Producto</th><th className="px-4 py-3 text-left">Origen</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-right">Precio</th><th className="px-4 py-3 text-right">Subtotal</th><th className="px-4 py-3 text-right">IVA</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{entries.map((movement) => {
                const editing = editingEntryId === movement.id;
                return <tr key={movement.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">{editing ? <input type="datetime-local" value={editDraft.fechaIngreso} onChange={(event) => setEditDraft((current) => ({ ...current, fechaIngreso: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1.5" /> : formatDateTime(movement.fechaIngreso)}</td>
                  <td className="px-4 py-3">{editing ? <div className="grid min-w-80 grid-cols-2 gap-2"><select value={editDraft.marcaId} onChange={(event) => setEditDraft((current) => ({ ...current, marcaId: event.target.value, modeloId: "" }))} className="rounded-lg border border-slate-300 px-2 py-1.5">{catalog.marcas.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre}</option>)}</select><select value={editDraft.modeloId} onChange={(event) => setEditDraft((current) => ({ ...current, modeloId: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1.5">{editModels.map((model) => <option key={model.id} value={model.id}>{model.nombre}</option>)}</select></div> : <span className="font-semibold">{movement.producto}</span>}</td>
                  <td className="px-4 py-3">{editing ? <select value={editDraft.bodega} onChange={(event) => setEditDraft((current) => ({ ...current, bodega: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-1.5"><option value="CREDITEK">Creditek</option><option value="PROVEEDOR">Proveedor</option></select> : movement.bodega}</td>
                  <td className="px-4 py-3 text-right">{editing ? <input type="number" min="1" step="1" value={editDraft.cantidad} onChange={(event) => setEditDraft((current) => ({ ...current, cantidad: event.target.value }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right" /> : formatNumber(movement.cantidad)}</td>
                  <td className="px-4 py-3 text-right">{editing ? <input type="text" value={editDraft.precioUnitario} onChange={(event) => setEditDraft((current) => ({ ...current, precioUnitario: event.target.value }))} className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right" /> : formatCurrency(movement.precioUnitario)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(editing ? editAmounts.subtotal : movement.subtotal)}</td><td className="px-4 py-3 text-right">{formatCurrency(editing ? editAmounts.iva : movement.iva)}</td><td className="px-4 py-3 text-right font-bold">{formatCurrency(editing ? editAmounts.total : movement.total)}</td>
                  <td className="px-4 py-3 text-right">{editing ? <div className="flex justify-end gap-2"><button type="button" onClick={saveEditedEntry} disabled={savingEntryEdit} className="rounded-lg bg-emerald-600 p-2 text-white">{savingEntryEdit ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}</button><button type="button" onClick={() => { setEditingEntryId(null); setEditDraft(null); }} className="rounded-lg border border-slate-300 p-2"><X size={16} /></button></div> : <div className="flex justify-end gap-2"><button type="button" onClick={() => startEditingEntry(movement)} disabled={closed || deletingEntryId === movement.id} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40"><Pencil size={16} /></button><button type="button" onClick={() => deleteMovement(movement)} disabled={closed || deletingEntryId === movement.id} className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-40">{deletingEntryId === movement.id ? <RefreshCw className="animate-spin" size={16} /> : <Trash2 size={16} />}</button></div>}</td>
                </tr>;
              })}</tbody>
            </table></div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-4"><div><h2 className="font-bold text-slate-800">Ajustes del período</h2><p className="mt-1 text-xs text-slate-500">Son inmutables; una corrección se registra con otro ajuste y motivo.</p></div><span className="text-xs font-semibold text-slate-500">{adjustments.length} ajuste(s)</span></div>
          {adjustments.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">No hay ajustes en esta semana.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600"><tr><th className="px-4 py-3 text-left">Fecha</th><th className="px-4 py-3 text-left">Producto</th><th className="px-4 py-3 text-left">Origen</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-left">Motivo</th><th className="px-4 py-3 text-left">Tipo</th></tr></thead><tbody className="divide-y divide-slate-100">{adjustments.map((item) => <tr key={item.id}><td className="px-4 py-3">{formatDateTime(item.fechaAjuste)}</td><td className="px-4 py-3 font-semibold">{item.producto}</td><td className="px-4 py-3">{item.origen}</td><td className="px-4 py-3 text-right font-bold tabular-nums">{formatSigned(item.cantidad)}</td><td className="px-4 py-3">{item.motivo}</td><td className="px-4 py-3">{item.tipo === "CORRECCION_CIERRE" ? <span className="inline-flex items-center gap-1 text-blue-700"><CheckCircle2 size={15} /> Corrección cierre #{item.cierreCorregidoId}</span> : "Ajuste"}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </div>
  );
}
