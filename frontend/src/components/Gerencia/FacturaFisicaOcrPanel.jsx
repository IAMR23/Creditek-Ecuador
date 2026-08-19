/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ScanText,
} from "lucide-react";
import FacturaFisicaProductosOcrPanel from "./FacturaFisicaProductosOcrPanel";

const FIELDS = [
  { key: "proveedor", label: "Proveedor" },
  { key: "rucProveedor", label: "RUC" },
  { key: "numeroFactura", label: "N.º factura" },
  { key: "fechaEmision", label: "Fecha" },
  { key: "subtotal", label: "Subtotal", money: true },
  { key: "impuestos", label: "Impuestos", money: true },
  { key: "total", label: "Total", money: true },
];

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const stateTone = {
  NO_PROCESADO: "border-slate-300 bg-slate-100 text-slate-600",
  PROCESANDO: "border-blue-200 bg-blue-50 text-blue-700",
  PROCESADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PROCESADO_CON_ADVERTENCIAS: "border-amber-200 bg-amber-50 text-amber-700",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  });
};

const formatValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (field.money) {
    const number = Number(value);
    return Number.isFinite(number) ? moneyFormatter.format(number) : String(value);
  }
  return String(value);
};

export default function FacturaFisicaOcrPanel({
  factura,
  valoresActuales,
  procesando,
  aplicando,
  onProcesar,
  onAplicar,
}) {
  const [seleccionados, setSeleccionados] = useState([]);
  const [textoAbierto, setTextoAbierto] = useState(false);
  const estado = factura?.ocrEstado || "NO_PROCESADO";
  const sugerencias = factura?.ocrCampos || {};
  const advertencias = Array.isArray(factura?.ocrAdvertencias)
    ? factura.ocrAdvertencias
    : [];
  const tieneResultado = ["PROCESADO", "PROCESADO_CON_ADVERTENCIAS"].includes(
    estado,
  );
  const esAnulada = factura?.estado === "ANULADA";

  useEffect(() => {
    setSeleccionados([]);
    setTextoAbierto(false);
  }, [factura?.id, factura?.ocrProcesadoEn]);

  const camposDisponibles = FIELDS.filter(({ key }) => {
    const value = sugerencias[key];
    return value !== null && value !== undefined && value !== "";
  }).map(({ key }) => key);

  const toggleField = (field) => {
    setSeleccionados((current) =>
      current.includes(field)
        ? current.filter((value) => value !== field)
        : [...current, field],
    );
  };

  const aplicar = async () => {
    const applied = await onAplicar(seleccionados);
    if (applied) setSeleccionados([]);
  };

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Reconocimiento OCR</h3>
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                stateTone[estado] || stateTone.NO_PROCESADO
              }`}
            >
              {estado.replaceAll("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Último proceso: {formatDateTime(factura?.ocrProcesadoEn)}
            {factura?.ocrMotor ? ` · ${factura.ocrMotor}` : ""}
            {factura?.ocrVersion ? ` · v${factura.ocrVersion}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onProcesar}
          disabled={procesando || aplicando || esAnulada || estado === "PROCESANDO"}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          {procesando ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <ScanText size={15} />
          )}
          {tieneResultado || estado === "ERROR" ? "Reprocesar OCR" : "Procesar OCR"}
        </button>
      </div>

      {esAnulada && (
        <p className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
          Una factura anulada conserva su OCR previo, pero no admite procesamiento ni aplicación.
        </p>
      )}

      {estado === "PROCESANDO" && (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          <RefreshCw size={17} className="animate-spin" />
          El documento se está procesando. Mantén esta ventana abierta.
        </div>
      )}

      {factura?.ocrError && (
        <div className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <span>{factura.ocrError}</span>
        </div>
      )}

      {advertencias.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <p className="flex items-center gap-2 text-xs font-bold uppercase">
            <AlertTriangle size={15} /> Advertencias de calidad
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {advertencias.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {tieneResultado && (
        <>
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2" aria-label="Seleccionar" />
                  <th className="px-3 py-2">Campo</th>
                  <th className="px-3 py-2">Valor actual</th>
                  <th className="px-3 py-2">Sugerencia OCR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {FIELDS.map((field) => {
                  const available = camposDisponibles.includes(field.key);
                  return (
                    <tr key={field.key}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={seleccionados.includes(field.key)}
                          onChange={() => toggleField(field.key)}
                          disabled={!available || aplicando || esAnulada}
                          className="size-4 rounded border-slate-300"
                          aria-label={`Aplicar ${field.label}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-700">
                        {field.label}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {formatValue(field, valoresActuales?.[field.key])}
                      </td>
                      <td className={`px-3 py-2 ${available ? "font-semibold text-slate-950" : "text-slate-400"}`}>
                        {formatValue(field, sugerencias[field.key])}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSeleccionados(camposDisponibles)}
              disabled={!camposDisponibles.length || aplicando || esAnulada}
              className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Seleccionar sugerencias disponibles
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={!seleccionados.length || aplicando || procesando || esAnulada}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {aplicando ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Aplicar seleccionados
            </button>
          </div>

          <div className="rounded-md border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setTextoAbierto((current) => !current)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold text-slate-700"
            >
              Ver texto detectado
              {textoAbierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {textoAbierto && (
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-slate-200 p-3 text-xs leading-5 text-slate-600">
                {factura?.ocrTexto || "El procesador no devolvió texto legible."}
              </pre>
            )}
          </div>
        </>
      )}

      <FacturaFisicaProductosOcrPanel factura={factura} />
    </section>
  );
}
