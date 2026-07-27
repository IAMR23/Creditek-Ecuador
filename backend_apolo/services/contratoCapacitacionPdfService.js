const fs = require("fs/promises");
const path = require("path");
const {
  PDFDocument,
  StandardFonts,
  rgb,
} = require("pdf-lib");

const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "assets",
  "contrato-capacitacion-template.pdf",
);

const TEXT_X = 72;
const TEXT_MAX_WIDTH = 468;
const TEXT_START_Y = 658;
const MAX_LINES = 6;
const MAX_NAME_LENGTH = 180;
const MAX_IDENTIFICATION_LENGTH = 30;

let templateBytesPromise = null;

const limpiarTexto = (value) =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizarDatosContrato = ({ nombreCompleto, cedula }) => {
  const nombre = limpiarTexto(nombreCompleto).toLocaleUpperCase("es-EC");
  const identificacion = limpiarTexto(cedula);

  if (!nombre) {
    const error = new Error(
      "El postulante no tiene un nombre completo registrado.",
    );
    error.statusCode = 422;
    throw error;
  }

  if (!identificacion) {
    const error = new Error("El postulante no tiene una cédula registrada.");
    error.statusCode = 422;
    throw error;
  }

  if (nombre.length > MAX_NAME_LENGTH) {
    const error = new Error("El nombre completo excede el límite permitido.");
    error.statusCode = 422;
    throw error;
  }

  if (identificacion.length > MAX_IDENTIFICATION_LENGTH) {
    const error = new Error("La cédula excede el límite permitido.");
    error.statusCode = 422;
    throw error;
  }

  return { nombre, cedula: identificacion };
};

const construirComparecencia = ({ nombre, cedula }) =>
  `Comparecen a la celebración del presente Convenio de Capacitación y Evaluación Pre-laboral, por una parte, APOLO BUSINESS SOLUTIONS, con RUC No. 1714319066001, representada legalmente por el señor LENIN ADOLFO APOLO CÁRDENAS, a quien en adelante se le denominará “LA ENTIDAD CAPACITADORA”; y por otra parte el (la) señor (ita) ${nombre} portador(a) de la cédula No ${cedula}, a quien en adelante se le denominará “LA PERSONA EN CAPACITACIÓN”`;

const dividirPalabra = (word, font, size, maxWidth) => {
  const fragments = [];
  let current = "";

  for (const character of word) {
    const candidate = `${current}${character}`;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      fragments.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) fragments.push(current);
  return fragments;
};

const envolverTexto = (text, font, size, maxWidth) => {
  const words = limpiarTexto(text).split(" ");
  const lines = [];
  let current = [];

  const pushLine = () => {
    if (!current.length) return;
    lines.push(current);
    current = [];
  };

  for (const rawWord of words) {
    const fragments =
      font.widthOfTextAtSize(rawWord, size) > maxWidth
        ? dividirPalabra(rawWord, font, size, maxWidth)
        : [rawWord];

    for (const word of fragments) {
      const candidate = [...current, word].join(" ");
      if (
        current.length &&
        font.widthOfTextAtSize(candidate, size) > maxWidth
      ) {
        pushLine();
      }
      current.push(word);
    }
  }

  pushLine();
  return lines;
};

const resolverTipografia = (text, font) => {
  for (let size = 12; size >= 9.5; size -= 0.25) {
    const lines = envolverTexto(text, font, size, TEXT_MAX_WIDTH);
    if (lines.length <= MAX_LINES) {
      return {
        size,
        lineHeight: size * 1.18,
        lines,
      };
    }
  }

  const error = new Error(
    "El nombre y la cédula no caben en el formato del contrato.",
  );
  error.statusCode = 422;
  throw error;
};

const dibujarLineaJustificada = ({
  page,
  words,
  font,
  size,
  y,
  justify,
}) => {
  if (!justify || words.length < 2) {
    page.drawText(words.join(" "), {
      x: TEXT_X,
      y,
      font,
      size,
      color: rgb(0, 0, 0),
    });
    return;
  }

  const wordsWidth = words.reduce(
    (total, word) => total + font.widthOfTextAtSize(word, size),
    0,
  );
  const gap = (TEXT_MAX_WIDTH - wordsWidth) / (words.length - 1);
  let cursorX = TEXT_X;

  words.forEach((word, index) => {
    page.drawText(word, {
      x: cursorX,
      y,
      font,
      size,
      color: rgb(0, 0, 0),
    });
    cursorX += font.widthOfTextAtSize(word, size);
    if (index < words.length - 1) cursorX += gap;
  });
};

const cargarPlantilla = async () => {
  if (!templateBytesPromise) {
    templateBytesPromise = fs.readFile(TEMPLATE_PATH).catch((error) => {
      templateBytesPromise = null;
      throw error;
    });
  }

  return templateBytesPromise;
};

const generarContratoCapacitacionPdf = async ({
  nombreCompleto,
  cedula,
}) => {
  const datos = normalizarDatosContrato({ nombreCompleto, cedula });
  const document = await PDFDocument.load(await cargarPlantilla());

  if (document.getPageCount() !== 4) {
    throw new Error("La plantilla del contrato no tiene 4 páginas.");
  }

  const font = await document.embedFont(StandardFonts.TimesRoman);
  const clause = construirComparecencia(datos);
  const typography = resolverTipografia(clause, font);
  const firstPage = document.getPage(0);

  typography.lines.forEach((words, index) => {
    dibujarLineaJustificada({
      page: firstPage,
      words,
      font,
      size: typography.size,
      y: TEXT_START_Y - index * typography.lineHeight,
      justify: index < typography.lines.length - 1,
    });
  });

  document.setTitle(
    `Acuerdo de capacitación - ${datos.nombre}`,
  );
  document.setSubject("Convenio de capacitación y evaluación pre-laboral");
  document.setAuthor("APOLO BUSINESS SOLUTIONS");
  document.setCreator("ABS");
  document.setProducer("ABS");

  return Buffer.from(await document.save());
};

module.exports = {
  construirComparecencia,
  generarContratoCapacitacionPdf,
  normalizarDatosContrato,
  envolverTexto,
};
