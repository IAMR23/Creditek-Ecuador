export const ESTADOS_ITEMS_FORMULA = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "FINALIZADO", label: "Finalizado" },
];

const ESTADOS_VALIDOS = new Set(
  ESTADOS_ITEMS_FORMULA.map((estado) => estado.value),
);

const generarIdItem = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const normalizarEstado = (estado) => {
  const normalizado = String(estado || "PENDIENTE")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (normalizado === "COMPLETADO") return "FINALIZADO";
  return ESTADOS_VALIDOS.has(normalizado) ? normalizado : "PENDIENTE";
};

export const crearItemFormula = (item = {}) => ({
  id: item.id || generarIdItem(),
  descripcion: String(item.descripcion ?? item.texto ?? item.respuesta ?? ""),
  estado: normalizarEstado(item.estado),
});

export const normalizarItemsFormula = (
  respuesta,
  { incluirVacio = false } = {},
) => {
  const valores = Array.isArray(respuesta)
    ? respuesta
    : respuesta === undefined || respuesta === null
      ? []
      : [respuesta];

  const items = valores.map((item) => {
    if (item && typeof item === "object") return crearItemFormula(item);
    return crearItemFormula({ descripcion: item });
  });

  return items.length || !incluirVacio ? items : [crearItemFormula()];
};

export const normalizarRespuestasFormula = (
  respuestas = {},
  cantidadPreguntas = 0,
) => {
  const normalizadas = {};

  if (respuestas && typeof respuestas === "object" && !Array.isArray(respuestas)) {
    Object.entries(respuestas).forEach(([numero, respuesta]) => {
      normalizadas[numero] = normalizarItemsFormula(respuesta, {
        incluirVacio: true,
      });
    });
  }

  for (let numero = 1; numero <= cantidadPreguntas; numero += 1) {
    if (!normalizadas[numero]) {
      normalizadas[numero] = [crearItemFormula()];
    }
  }

  return normalizadas;
};

export const etiquetaEstadoItemFormula = (estado) =>
  ESTADOS_ITEMS_FORMULA.find((item) => item.value === normalizarEstado(estado))
    ?.label || "Pendiente";

export const clasesEstadoItemFormula = {
  PENDIENTE: "border-amber-200 bg-amber-50 text-amber-700",
  EN_PROGRESO: "border-blue-200 bg-blue-50 text-blue-700",
  FINALIZADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
