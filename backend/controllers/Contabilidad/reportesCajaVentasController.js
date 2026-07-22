const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const {
  guardarCargaControlFinanciero,
  obtenerFechaReporte,
} = require("../../services/controlFinancieroService");

const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS || 120000);
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const getPythonBin = () =>
  process.env.PYTHON_BIN ||
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

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
      if (
        tieneHorario &&
        (!HORA_REGEX.test(item.horaInicio) ||
          !HORA_REGEX.test(item.horaFin) ||
          item.horaInicio > item.horaFin)
      ) {
        throw new Error("Cada asignacion debe tener un horario valido.");
      }

      return item;
    });
};

const runProcessor = ({
  reportesCajaDir,
  ventasTvDir,
  ventasCelularDir,
  outputFile,
  dataOutputFile,
  asignacionesAgencias,
}) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "python",
      "extraccion_reportes_cajas",
      "ventas_cierre_processor.py",
    );
    const args = [
      scriptPath,
      "--output",
      outputFile,
      "--reportes-caja-dir",
      reportesCajaDir,
      "--ventas-tv-dir",
      ventasTvDir,
      "--ventas-celular-dir",
      ventasCelularDir,
      "--data-output",
      dataOutputFile,
    ];

    if (asignacionesAgencias.length) {
      args.push("--asignaciones-agencias", JSON.stringify(asignacionesAgencias));
    }

    const child = spawn(getPythonBin(), args, {
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
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

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

    child.on("error", (error) => finish(() => reject(error)));

    child.on("close", (code) => {
      finish(() => {
        if (timedOut) {
          return reject(new Error("Tiempo agotado procesando los PDFs"));
        }

        if (code !== 0) {
          const detalle = stderr.trim().split(/\r?\n/).pop();
          return reject(
            new Error(detalle || stdout.trim() || "El procesador Python fallo"),
          );
        }

        let summary = null;
        try {
          summary = stdout.trim()
            ? JSON.parse(stdout.trim().split(/\r?\n/).pop())
            : null;
        } catch {
          summary = null;
        }

        return resolve({ summary });
      });
    });
  });

const limpiarTemporal = async (dir) => {
  if (!dir) return;
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
};

exports.extraerCierreCajaConVentas = async (req, res) => {
  const tempRoot = req.reportesCajaVentasTempRoot;

  try {
    const reportesCaja = req.files?.reportesCaja || [];
    if (!reportesCaja.length) {
      await limpiarTemporal(tempRoot);
      return res.status(400).json({
        ok: false,
        message: "Sube al menos un PDF de reporte de caja para generar el cierre.",
      });
    }

    const asignacionesAgencias = normalizarAsignacionesAgencia(
      req.body?.asignacionesAgencias,
    );
    const outputFile = path.join(tempRoot, "CIERRE_CAJA_CON_VENTAS.xlsx");
    const dataOutputFile = path.join(tempRoot, "CONTROL_FINANCIERO.json");
    const { summary } = await runProcessor({
      reportesCajaDir: req.reportesCajaDir,
      ventasTvDir: req.ventasTvDir,
      ventasCelularDir: req.ventasCelularDir,
      outputFile,
      dataOutputFile,
      asignacionesAgencias,
    });

    if (!fs.existsSync(outputFile)) {
      throw new Error("No se genero el archivo Excel.");
    }

    if (!fs.existsSync(dataOutputFile)) {
      throw new Error("No se generaron los datos para control financiero.");
    }

    const datosControlFinanciero = JSON.parse(
      await fsp.readFile(dataOutputFile, "utf8"),
    );
    const fechaReporte = obtenerFechaReporte(datosControlFinanciero.registrosCaja);
    if (!fechaReporte) {
      throw new Error("No se pudo determinar la fecha del reporte desde el PDF de caja.");
    }
    const filename = `CIERRE_CAJA_${fechaReporte.replace(/-/g, "")}.xlsx`;
    const persistencia = await guardarCargaControlFinanciero({
      datos: datosControlFinanciero,
      usuarioId: req.user?.id,
      archivoGenerado: filename,
    });
    const { carga } = persistencia;

    if (summary) {
      res.setHeader("X-RVE-Registros", String(summary.registrosCaja || 0));
      res.setHeader("X-RVE-No-Leidas", String(summary.noLeidas || 0));
      res.setHeader("X-RVE-Ventas-TV", String(summary.ventasTv || 0));
      res.setHeader(
        "X-RVE-Ventas-Celular",
        String(summary.ventasCelular || 0),
      );
    }
    res.setHeader("X-RVE-Control-Financiero-Carga", String(carga.id));
    res.setHeader("X-RVE-Fecha-Reporte", fechaReporte);
    res.setHeader(
      "X-RVE-Control-Financiero-Carga-Nueva",
      persistencia.esCargaNueva ? "1" : "0",
    );
    res.setHeader(
      "X-RVE-Archivos-Agregados",
      String(persistencia.archivosAgregados),
    );
    res.setHeader(
      "X-RVE-Archivos-Omitidos",
      String(persistencia.archivosOmitidos),
    );

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
    console.error("Error generando cierre de caja con ventas:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "No se pudo generar el cierre de caja.",
    });
  }
};

exports.normalizarAsignacionesAgencia = normalizarAsignacionesAgencia;
