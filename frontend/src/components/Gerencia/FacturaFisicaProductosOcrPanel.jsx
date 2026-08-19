/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Pencil,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const API_BASE = "/api/gerencia/facturas-fisicas";
const EDITABLE_FIELDS = [
  "descripcion",
  "codigo",
  "cantidad",
  "precioUnitario",
  "descuento",
  "totalLinea",
];

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const stateTone = {
  DETECTADO: "border-amber-200 bg-amber-50 text-amber-700",
  CONFIRMADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  DESCARTADO: "border-slate-300 bg-slate-100 text-slate-500",
};

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? money.format(number) : "-";
};

const formatQuantity = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("es-EC", { maximumFractionDigits: 3 }).format(
    Number(value),
  );
};

const toDraft = (product) =>
  EDITABLE_FIELDS.reduce(
    (draft, field) => ({
      ...draft,
      [field]: product?.[field] ?? "",
    }),
    {},
  );

const inputClass =
  "h-8 w-full min-w-20 rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export default function FacturaFisicaProductosOcrPanel({ factura }) {
  const [productos, setProductos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [accionandoId, setAccionandoId] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [borrador, setBorrador] = useState({});
  const [error, setError] = useState("");
  const esAnulada = factura?.estado === "ANULADA";

  const cargar = useCallback(
    async ({ signal, silent = false } = {}) => {
      if (!factura?.id) return;
      if (!silent) setCargando(true);
      setError("");
      try {
        const { data } = await api.get(
          `${API_BASE}/${factura.id}/productos-ocr`,
          { signal },
        );
        setProductos(Array.isArray(data.productos) ? data.productos : []);
        setResumen(data.resumen || null);
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        setError(
          requestError.response?.data?.message ||
            "No se pudieron cargar los productos detectados.",
        );
      } finally {
        if (!silent && !signal?.aborted) setCargando(false);
      }
    },
    [factura?.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    setEditandoId(null);
    setBorrador({});
    cargar({ signal: controller.signal });
    return () => controller.abort();
  }, [cargar, factura?.ocrProcesadoEn]);

  const comenzarEdicion = (product) => {
    setEditandoId(product.id);
    setBorrador(toDraft(product));
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setBorrador({});
  };

  const guardarEdicion = async (productId) => {
    if (!String(borrador.descripcion || "").trim()) {
      Swal.fire("Descripcion requerida", "Ingresa la descripcion del producto.", "warning");
      return;
    }
    try {
      setAccionandoId(productId);
      const payload = EDITABLE_FIELDS.reduce(
        (values, field) => ({
          ...values,
          [field]: borrador[field] === "" ? null : borrador[field],
        }),
        {},
      );
      await api.patch(
        `${API_BASE}/${factura.id}/productos-ocr/${productId}`,
        payload,
      );
      cancelarEdicion();
      await cargar({ silent: true });
      Swal.fire({
        icon: "success",
        title: "Producto actualizado",
        timer: 1100,
        showConfirmButton: false,
      });
    } catch (requestError) {
      Swal.fire(
        "Error",
        requestError.response?.data?.message || "No se pudo actualizar el producto.",
        "error",
      );
    } finally {
      setAccionandoId(null);
    }
  };

  const cambiarEstado = async (product, accion) => {
    if (accion === "descartar") {
      const confirmation = await Swal.fire({
        icon: "warning",
        title: "Descartar linea detectada",
        text: "La linea quedara disponible en la trazabilidad del OCR.",
        showCancelButton: true,
        confirmButtonText: "Descartar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#b45309",
      });
      if (!confirmation.isConfirmed) return;
    }
    try {
      setAccionandoId(product.id);
      await api.patch(
        `${API_BASE}/${factura.id}/productos-ocr/${product.id}/${accion}`,
      );
      if (editandoId === product.id) cancelarEdicion();
      await cargar({ silent: true });
      Swal.fire({
        icon: "success",
        title: accion === "confirmar" ? "Producto confirmado" : "Producto descartado",
        timer: 1100,
        showConfirmButton: false,
      });
    } catch (requestError) {
      Swal.fire(
        "Error",
        requestError.response?.data?.message ||
          `No se pudo ${accion} el producto.`,
        "error",
      );
    } finally {
      setAccionandoId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase text-slate-700">
            Productos detectados
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Revisa cada linea antes de usarla como dato confirmado.
          </p>
        </div>
        {resumen && (
          <div className="flex flex-wrap gap-1.5 text-[10px] font-bold uppercase">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
              {resumen.detectados || 0} detectados
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
              {resumen.confirmados || 0} confirmados
            </span>
            <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-slate-500">
              {resumen.descartados || 0} descartados
            </span>
          </div>
        )}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
          <RefreshCw size={15} className="animate-spin" /> Cargando productos...
        </div>
      ) : error ? (
        <div className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : productos.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
          No hay lineas de producto detectadas para esta factura.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[940px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="w-24 px-3 py-2 text-right">Cantidad</th>
                <th className="w-28 px-3 py-2 text-right">P. unitario</th>
                <th className="w-28 px-3 py-2 text-right">Descuento</th>
                <th className="w-28 px-3 py-2 text-right">Total</th>
                <th className="w-28 px-3 py-2">Estado</th>
                <th className="w-40 px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productos.map((product) => {
                const editing = editandoId === product.id;
                const busy = accionandoId === product.id;
                const detected = product.estado === "DETECTADO";
                return (
                  <tr
                    key={product.id}
                    className={product.estado === "DESCARTADO" ? "bg-slate-50 opacity-75" : ""}
                  >
                    <td className="px-3 py-2 align-top">
                      {editing ? (
                        <div className="grid gap-1.5">
                          <input
                            value={borrador.descripcion}
                            onChange={(event) =>
                              setBorrador((current) => ({
                                ...current,
                                descripcion: event.target.value,
                              }))
                            }
                            className={inputClass}
                            aria-label="Descripcion del producto"
                          />
                          <input
                            value={borrador.codigo}
                            onChange={(event) =>
                              setBorrador((current) => ({
                                ...current,
                                codigo: event.target.value,
                              }))
                            }
                            placeholder="Codigo opcional"
                            className={inputClass}
                            aria-label="Codigo del producto"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-slate-800">{product.descripcion}</p>
                          {product.codigo && (
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              Codigo: {product.codigo}
                            </p>
                          )}
                          {product.editadoManualmente && (
                            <p className="mt-0.5 text-[10px] font-semibold text-blue-600">
                              Corregido manualmente
                            </p>
                          )}
                          {product.advertencias?.map((warning, index) => (
                            <p
                              key={`${product.id}-warning-${index}`}
                              className="mt-1 flex gap-1 text-[10px] text-amber-700"
                            >
                              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                              {warning}
                            </p>
                          ))}
                        </div>
                      )}
                    </td>
                    {[
                      ["cantidad", formatQuantity],
                      ["precioUnitario", formatMoney],
                      ["descuento", formatMoney],
                      ["totalLinea", formatMoney],
                    ].map(([field, formatter]) => (
                      <td key={field} className="px-3 py-2 text-right align-top">
                        {editing ? (
                          <input
                            inputMode="decimal"
                            value={borrador[field]}
                            onChange={(event) =>
                              setBorrador((current) => ({
                                ...current,
                                [field]: event.target.value,
                              }))
                            }
                            className={`${inputClass} text-right`}
                            aria-label={field}
                          />
                        ) : (
                          <span className="font-semibold text-slate-700">
                            {formatter(product[field])}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                          stateTone[product.estado] || stateTone.DETECTADO
                        }`}
                      >
                        {product.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex justify-end gap-1">
                        {busy ? (
                          <span className="inline-flex size-8 items-center justify-center text-slate-500">
                            <RefreshCw size={15} className="animate-spin" />
                          </span>
                        ) : editing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => guardarEdicion(product.id)}
                              className="inline-flex size-8 items-center justify-center rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              title="Guardar cambios"
                              aria-label="Guardar cambios"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelarEdicion}
                              className="inline-flex size-8 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                              title="Cancelar edicion"
                              aria-label="Cancelar edicion"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            {detected && (
                              <button
                                type="button"
                                onClick={() => comenzarEdicion(product)}
                                disabled={esAnulada || accionandoId !== null}
                                className="inline-flex size-8 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                                title="Editar producto"
                                aria-label="Editar producto"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {detected && (
                              <button
                                type="button"
                                onClick={() => cambiarEstado(product, "confirmar")}
                                disabled={esAnulada || accionandoId !== null}
                                className="inline-flex size-8 items-center justify-center rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                                title="Confirmar producto"
                                aria-label="Confirmar producto"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            {product.estado !== "DESCARTADO" && (
                              <button
                                type="button"
                                onClick={() => cambiarEstado(product, "descartar")}
                                disabled={esAnulada || accionandoId !== null}
                                className="inline-flex size-8 items-center justify-center rounded border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
                                title="Descartar producto"
                                aria-label="Descartar producto"
                              >
                                <Ban size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {resumen?.sumaTotalesLinea !== null && resumen?.sumaTotalesLinea !== undefined && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-500">
            Suma de lineas activas{resumen.sumaCompleta ? "" : " conocidas"}
          </span>
          <span className="font-bold text-slate-800">
            {formatMoney(resumen.sumaTotalesLinea)}
          </span>
        </div>
      )}

      {resumen?.advertencias?.map((warning, index) => (
        <div
          key={`summary-warning-${index}`}
          className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
        >
          <AlertTriangle size={15} className="shrink-0" />
          <span>{warning}</span>
        </div>
      ))}

      {esAnulada && productos.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 size={14} /> La revision se conserva en modo de consulta.
        </p>
      )}
    </section>
  );
}
