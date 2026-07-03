const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS || 120000);

const getPythonBin = () =>
  process.env.PYTHON_BIN ||
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const normalizarAsignacionesAgencia = (raw) => {
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Las asignaciones de agencias no tienen un formato valido.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Las asignaciones de agencias deben ser una lista.");
  }

  if (parsed.length > 200) {
    throw new Error("No se permiten mas de 200 asignaciones por reporte.");
  }

  return parsed
    .map((item) => ({
      fecha: String(item?.fecha || "").trim(),
      usuario: String(item?.usuario || "").trim().toUpperCase(),
      horaInicio: String(item?.horaInicio || "").trim(),
      horaFin: String(item?.horaFin || "").trim(),
      agencia: String(item?.agencia || "").trim().toUpperCase(),
    }))
    .filter(
      (item) =>
        item.fecha ||
        item.usuario ||
        item.horaInicio ||
        item.horaFin ||
        item.agencia,
    )
    .map((item) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.fecha)) {
        throw new Error("Cada asignacion debe tener una fecha valida.");
      }

      if (!item.usuario || item.usuario.length > 50) {
        throw new Error("Cada asignacion debe tener un usuario valido.");
      }

      if (!item.agencia || item.agencia.length > 80) {
        throw new Error("Cada asignacion debe tener una agencia valida.");
      }

      const tieneHorario = item.horaInicio || item.horaFin;

      if (tieneHorario) {
        if (!HORA_REGEX.test(item.horaInicio) || !HORA_REGEX.test(item.horaFin)) {
          throw new Error("Cada asignacion debe tener un horario valido.");
        }

        if (item.horaInicio > item.horaFin) {
          throw new Error("La hora inicial no puede ser mayor que la hora final.");
        }
      }

      return item;
    });
};

const runReporteCajaProcessor = ({ pdfs, outputFile, asignacionesAgencias }) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "python",
      "extraccion_reportes_cajas",
      "processor.py",
    );

    const args = [scriptPath, "--output", outputFile];

    if (asignacionesAgencias.length) {
      args.push("--asignaciones-agencias", JSON.stringify(asignacionesAgencias));
    }

    const child = spawn(getPythonBin(), [...args, ...pdfs], {
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

    const asignacionesAgencias = normalizarAsignacionesAgencia(
      req.body?.asignacionesAgencias,
    );
    const pdfs = archivos.map((file) => file.path);
    const outputFile = path.join(tempRoot, "REPORTE_CAJA_GENERADO.xlsx");

    const { summary } = await runReporteCajaProcessor({
      pdfs,
      outputFile,
      asignacionesAgencias,
    });

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
