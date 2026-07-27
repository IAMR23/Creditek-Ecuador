const fs = require("fs/promises");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

const [sourcePdfPath, sanitizedFirstPagePngPath, outputPdfPath] =
  process.argv.slice(2);

if (!sourcePdfPath || !sanitizedFirstPagePngPath || !outputPdfPath) {
  console.error(
    "Uso: node scripts/buildContratoCapacitacionTemplate.js <origen.pdf> <pagina-1-sanitizada.png> <salida.pdf>",
  );
  process.exit(1);
}

const buildTemplate = async () => {
  const [sourceBytes, firstPageBytes] = await Promise.all([
    fs.readFile(path.resolve(sourcePdfPath)),
    fs.readFile(path.resolve(sanitizedFirstPagePngPath)),
  ]);

  const sourceDocument = await PDFDocument.load(sourceBytes);
  if (sourceDocument.getPageCount() !== 4) {
    throw new Error("El contrato fuente debe tener exactamente 4 paginas.");
  }

  const outputDocument = await PDFDocument.create();
  const firstPageImage = await outputDocument.embedPng(firstPageBytes);
  const firstPage = outputDocument.addPage([612, 792]);

  firstPage.drawImage(firstPageImage, {
    x: 0,
    y: 0,
    width: 612,
    height: 792,
  });

  const remainingPages = await outputDocument.copyPages(
    sourceDocument,
    [1, 2, 3],
  );
  remainingPages.forEach((page) => outputDocument.addPage(page));

  outputDocument.setTitle(
    "Acuerdo de participacion en proceso de capacitacion y evaluacion",
  );
  outputDocument.setAuthor("APOLO BUSINESS SOLUTIONS");
  outputDocument.setCreator("ABS");
  outputDocument.setProducer("ABS");

  const outputPath = path.resolve(outputPdfPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, await outputDocument.save());

  console.log(`Plantilla PDF sanitizada generada en ${outputPath}`);
};

buildTemplate().catch((error) => {
  console.error("No se pudo generar la plantilla PDF:", error);
  process.exitCode = 1;
});
