/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  ScanText,
} from "lucide-react";
import FacturaFisicaProductosOcrPanel from "./FacturaFisicaProductosOcrPanel";

const FIELD_GROUPS = [
  {
    title: "Datos de factura",
    fields: [
      { key: "proveedor", label: "Proveedor", formal: true },
      { key: "rucProveedor", label: "RUC", formal: true },
      { key: "numeroFactura", label: "N.º factura", formal: true },
      { key: "numeroAutorizacion", label: "N.º autorización" },
      { key: "claveAcceso", label: "Clave de acceso" },
      { key: "fechaEmision", label: "Fecha", formal: true },
      { key: "horaEmision", label: "Hora" },
    ],
  },
  {
    title: "Cliente",
    fields: [
      { key: "cliente", label: "Nombre" },
      { key: "identificacionCliente", label: "Identificación" },
      { key: "codigoCliente", label: "Código" },
      { key: "placa", label: "Placa" },
    ],
  },
  {
    title: "Valores",
    fields: [
      { key: "subtotal", label: "Subtotal", money: true, formal: true },
      { key: "impuestos", label: "Impuestos", money: true, formal: true },
      { key: "total", label: "Total", money: true, formal: true },
    ],
  },
  {
    title: "Información adicional",
    fields: [
      { key: "condicionPago", label: "Condición de pago" },
      { key: "formaPago", label: "Forma de pago" },
      { key: "ambiente", label: "Ambiente" },
      { key: "tipoEmision", label: "Tipo de emisión" },
      { key: "datosAdicionales", label: "Otros datos", object: true },
    ],
  },
];
const FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

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
  if (field.object && typeof value === "object") {
    return (
      Object.entries(value)
        .map(([key, item]) => `${key}: ${String(item)}`)
        .join(" · ") || "-"
    );
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
  const [textoCopiado, setTextoCopiado] = useState(false);
  const estado = factura?.ocrEstado || "NO_PROCESADO";
  const sugerencias = factura?.ocrCampos || {};
  const advertencias = Array.isArray(factura?.ocrAdvertencias)
    ? factura.ocrAdvertencias
    : [];
  const tieneResultado = ["PROCESADO", "PROCESADO_CON_ADVERTENCIAS"].includes(
    estado,
  );
  const esAnulada = factura?.estado === "ANULADA";
  const diagnosticoOcr = factura?.ocrMetadata?.ocr || {};
  const textoRaw = factura?.ocrMetadata?.textoRaw || "";
  const confianzaOcr = Number(diagnosticoOcr.confianzaMedia);

  useEffect(() => {
    setSeleccionados([]);
    setTextoAbierto(false);
    setTextoCopiado(false);
  }, [factura?.id, factura?.ocrProcesadoEn]);

  const copiarTextoCompleto = async () => {
    if (!factura?.ocrTexto) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(factura.ocrTexto);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = factura.ocrTexto;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setTextoCopiado(true);
      window.setTimeout(() => setTextoCopiado(false), 1500);
    } catch {
      setTextoCopiado(false);
    }
  };

  const camposDisponibles = FIELDS.filter(({ key }) => {
    const value = sugerencias[key];
    return (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      (key !== "datosAdicionales" || Object.keys(value || {}).length > 0)
    );
  }).map(({ key }) => key);

  const valorActual = (field) => {
    if (field.formal) return valoresActuales?.[field.key];
    if (field.key === "datosAdicionales") return factura?.datosAdicionales;
    return factura?.datosAdicionales?.[field.key];
  };

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
            <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${stateTone[estado] || stateTone.NO_PROCESADO}`}>
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
          {procesando ? <RefreshCw size={15} className="animate-spin" /> : <ScanText size={15} />}
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
          <RefreshCw size={17} className="animate-spin" /> El documento se está procesando. Mantén esta ventana abierta.
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
            {advertencias.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
          </ul>
        </div>
      )}

      {tieneResultado && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
          <span><strong className="text-slate-800">Motor:</strong> {factura?.ocrMotor || "Tesseract"}</span>
          {diagnosticoOcr.estrategiaSeleccionada && (
            <span><strong className="text-slate-800">Estrategia:</strong> {diagnosticoOcr.estrategiaSeleccionada}</span>
          )}
          {Number.isFinite(confianzaOcr) && (
            <span><strong className="text-slate-800">Confianza:</strong> {Math.round(confianzaOcr)}%</span>
          )}
          {Number.isInteger(diagnosticoOcr.numeroPasadas) && (
            <span><strong className="text-slate-800">Pasadas:</strong> {diagnosticoOcr.numeroPasadas}</span>
          )}
          {Number.isFinite(Number(diagnosticoOcr.duracionMs)) && (
            <span><strong className="text-slate-800">Tiempo:</strong> {(Number(diagnosticoOcr.duracionMs) / 1000).toFixed(1)} s</span>
          )}
        </div>
      )}

      {tieneResultado && (
        <>
          <div className="space-y-3">
            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  {group.title}
                </div>
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                    <tr>
                      <th className="w-10 px-3 py-2" aria-label="Seleccionar" />
                      <th className="px-3 py-2">Campo</th>
                      <th className="px-3 py-2">Valor actual</th>
                      <th className="px-3 py-2">Sugerencia OCR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.fields.map((field) => {
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
                          <td className="px-3 py-2 font-semibold text-slate-700">{field.label}</td>
                          <td className="max-w-72 px-3 py-2 text-slate-600">{formatValue(field, valorActual(field))}</td>
                          <td className={`max-w-96 px-3 py-2 ${available ? "font-semibold text-slate-950" : "text-slate-400"}`}>
                            {formatValue(field, sugerencias[field.key])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
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
              {aplicando ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Aplicar seleccionados
            </button>
          </div>

          <div className="rounded-md border border-slate-200 bg-white">
            <div className="flex items-center border-b border-transparent">
              <button
                type="button"
                onClick={() => setTextoAbierto((current) => !current)}
                className="flex flex-1 items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold text-slate-700"
              >
                <span>
                  OCR reconstruido
                  {Number.isInteger(factura?.ocrMetadata?.totalLineas)
                    ? ` · ${factura.ocrMetadata.totalLineas} líneas`
                    : ""}
                </span>
                {textoAbierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button
                type="button"
                onClick={copiarTextoCompleto}
                disabled={!factura?.ocrTexto}
                className="mr-2 inline-flex h-8 items-center gap-1.5 rounded border border-slate-200 px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <Copy size={13} /> {textoCopiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            {textoAbierto && (
              <div className="border-t border-slate-200">
                {Number.isInteger(factura?.ocrMetadata?.totalLineas) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                    <span>{factura.ocrMetadata.totalLineas} líneas reconocidas</span>
                    <span>{factura.ocrMetadata.totalLineasInterpretadas || 0} interpretadas</span>
                    <span>{factura.ocrMetadata.totalLineasNoClasificadas || 0} sin clasificar</span>
                  </div>
                )}
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-3 text-xs leading-5 text-slate-600">
                  {factura?.ocrTexto || "El procesador no devolvió texto legible."}
                </pre>
              </div>
            )}
          </div>

          {textoRaw && (
            <details className="rounded-md border border-slate-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-slate-700">
                Comparar OCR RAW vs. reconstruido
              </summary>
              <div className="grid gap-3 border-t border-slate-200 p-3 lg:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">OCR original</p>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    {textoRaw || "Sin salida RAW disponible."}
                  </pre>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">OCR reconstruido</p>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                    {factura?.ocrTexto || "Sin texto reconstruido disponible."}
                  </pre>
                </div>
              </div>
            </details>
          )}
        </>
      )}

      <FacturaFisicaProductosOcrPanel factura={factura} />
    </section>
  );
}
