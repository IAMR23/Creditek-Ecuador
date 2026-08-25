const numeroFinito = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const aCentavos = (value) => {
  const parsed = numeroFinito(value);
  return parsed === null ? null : Math.round(parsed * 100);
};

const desdeCentavos = (value) =>
  Number((Number(value || 0) / 100).toFixed(2));

const normalizarNombre = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const distanciaLevenshtein = (left, right) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution =
        previous[rightIndex - 1] +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        substitution,
      );
    }
    previous = current;
  }

  return previous[right.length];
};

const similitudTexto = (left, right) => {
  const maxLength = Math.max(left.length, right.length);
  if (!maxLength) return 0;
  return 1 - distanciaLevenshtein(left, right) / maxLength;
};

const ordenarTokensNombre = (value) =>
  value.split(" ").filter(Boolean).sort().join(" ");

const calcularSimilitudNombres = (left, right) => {
  const normalizedLeft = normalizarNombre(left);
  const normalizedRight = normalizarNombre(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const directSimilarity = similitudTexto(normalizedLeft, normalizedRight);
  const tokenSimilarity = similitudTexto(
    ordenarTokensNombre(normalizedLeft),
    ordenarTokensNombre(normalizedRight),
  );
  return Number(Math.max(directSimilarity, tokenSimilarity).toFixed(4));
};

const esNombreReportePrefijo = (nombreReporte, nombreCierre) => {
  const tokensReporte = normalizarNombre(nombreReporte).split(" ").filter(Boolean);
  const tokensCierre = normalizarNombre(nombreCierre).split(" ").filter(Boolean);

  if (
    tokensReporte.length < 3 ||
    tokensReporte.length >= tokensCierre.length
  ) {
    return false;
  }

  return tokensReporte.every(
    (token, index) => token === tokensCierre[index],
  );
};

const construirFechaIso = (anio, mes, dia) => {
  const year = Number(anio);
  const month = Number(mes);
  const day = Number(dia);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
};

const normalizarFechaCalendario = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const getPart = (type) =>
      parts.find((part) => part.type === type)?.value || "";
    return construirFechaIso(
      getPart("year"),
      getPart("month"),
      getPart("day"),
    );
  }

  const text = String(value || "").trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/);
  if (isoMatch) {
    return construirFechaIso(isoMatch[1], isoMatch[2], isoMatch[3]);
  }

  const slashMatch = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\D|$)/,
  );
  if (!slashMatch) return null;

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const yearText = slashMatch[3];
  const year = Number(yearText) + (yearText.length === 2 ? 2000 : 0);

  // Los reportes del extractor usan M/D/YY. Si el primer componente supera
  // 12, el valor queda desambiguado como D/M/YY para compatibilidad historica.
  const day = first > 12 ? first : second;
  const month = first > 12 ? second : first;
  return construirFechaIso(year, month, day);
};

module.exports = {
  aCentavos,
  calcularSimilitudNombres,
  construirFechaIso,
  desdeCentavos,
  esNombreReportePrefijo,
  normalizarFechaCalendario,
  normalizarNombre,
  numeroFinito,
};
