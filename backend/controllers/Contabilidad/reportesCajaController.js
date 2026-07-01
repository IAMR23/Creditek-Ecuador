const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS || 120000);

const getPythonBin = () =>
  process.env.PYTHON_BIN ||
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

const runReporteCajaProcessor = ({ pdfs, outputFile }) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "python",
      "extraccion_reportes_cajas",
      "processor.py",
    );

    const child = spawn(getPythonBin(), [scriptPath, "--output", outputFile, ...pdfs], {
      cwd: path.join(__dirname, "..", ".."),
      env: {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: "1",
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, PYTHON_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (timedOut) {
        return reject(new Error("Tiempo agotado procesando los PDFs"));
      }

      if (code !== 0) {
        return reject(
          new Error(stderr.trim() || stdout.trim() || "El procesador Python fallo"),
        );
      }

      let summary = null;
      try {
        summary = stdout.trim() ? JSON.parse(stdout.trim().split(/\r?\n/).pop()) : null;
      } catch {
        summary = null;
      }

      resolve({ stdout, stderr, summary });
    });
  });

const limpiarTemporal = async (dir) => {
  if (!dir) return;
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
};

exports.extraerReportesCaja = async (req, res) => {
  const tempRoot = req.reportesCajaTempRoot;

  try {
    const archivos = Array.isArray(req.files) ? req.files : [];

    if (!archivos.length) {
      await limpiarTemporal(tempRoot);
      return res.status(400).json({
        ok: false,
        message: "Sube al menos un PDF para procesar.",
      });
    }

    const pdfs = archivos.map((file) => file.path);
    const outputFile = path.join(tempRoot, "REPORTE_CAJA_GENERADO.xlsx");

    const { summary } = await runReporteCajaProcessor({ pdfs, outputFile });

    if (!fs.existsSync(outputFile)) {
      throw new Error("No se genero el archivo Excel.");
    }

    const filename = `REPORTE_CAJA_${new Date()
      .toISOString()
      .slice(0, 16)
      .replace(/[-:T]/g, "")}.xlsx`;

    if (summary) {
      res.setHeader("X-RVE-Registros", String(summary.registros || 0));
      res.setHeader("X-RVE-No-Leidas", String(summary.noLeidas || 0));
    }

    return res.download(outputFile, filename, async (error) => {
      await limpiarTemporal(tempRoot);

      if (error && !res.headersSent) {
        return res.status(500).json({
          ok: false,
          message: "No se pudo descargar el Excel generado.",
        });
      }
    });
  } catch (error) {
    await limpiarTemporal(tempRoot);
    console.error("Error extrayendo reportes de caja:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "No se pudo generar el reporte de caja.",
    });
  }
};
