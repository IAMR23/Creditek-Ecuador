const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");
const {
  guardarCargaControlFinanciero,
  obtenerFechaReporte,
} = require("../../services/controlFinancieroService");
const {
  conciliarCarga,
} = require("../../services/conciliacionEntradasService");
const {
  conciliarCargaCaja,
} = require("../../services/conciliacionCuotasCajaService");
const {
  auditarVentasDesdeDirectorios,
} = require("../../services/auditoriaVentasPdfService");
const {
  guardarAuditoriaVentasPdf,
} = require("../../services/auditoriaVentasPersistenciaService");
const auditoriaVentasController = require("../Auditoria/auditoriaVentasController");
const {
  obtenerMapeoReporteCaja,
} = require("../../services/reporteCajaAgenciasService");

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
  mapeoAgencias,
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
    args.push("--mapeo-agencias", JSON.stringify(mapeoAgencias));

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

const crearResumenAuditoriaNoAplica = () => ({
  estado: "NO_APLICA",
  inconsistencias: 0,
  tv: { aplica: false, registros: 0, inconsistencias: 0 },
  celular: { aplica: false, registros: 0, inconsistencias: 0 },
  errores: [],
});

const establecerHeadersAuditoria = (res, auditoria) => {
  res.setHeader("X-RVE-Auditoria-Estado", auditoria.estado);
  res.setHeader(
    "X-RVE-Auditoria-Inconsistencias",
    String(auditoria.inconsistencias || 0),
  );
  res.setHeader(
    "X-RVE-Auditoria-TV-Registros",
    String(auditoria.tv?.registros || 0),
  );
  res.setHeader(
    "X-RVE-Auditoria-TV-Inconsistencias",
    String(auditoria.tv?.inconsistencias || 0),
  );
  res.setHeader(
    "X-RVE-Auditoria-Celular-Registros",
    String(auditoria.celular?.registros || 0),
  );
  res.setHeader(
    "X-RVE-Auditoria-Celular-Inconsistencias",
    String(auditoria.celular?.inconsistencias || 0),
  );
};

const crearErrorHttp = (
  message,
  statusCode = 500,
  code = "REPORTES_CAJA_ERROR",
) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const procesarCargaReportesCajaVentas = async (req) => {
  const tempRoot = req.reportesCajaVentasTempRoot;
  const reportesCaja = req.files?.reportesCaja || [];
  const ventasTv = req.files?.ventasTv || [];
  const ventasCelular = req.files?.ventasCelular || [];
  if (!reportesCaja.length && !ventasTv.length && !ventasCelular.length) {
    const nombreTipo =
      req.reportesCajaApiTipo === "CELULAR"
        ? "celulares"
        : req.reportesCajaApiTipo === "TV"
          ? "televisiones"
          : null;
    throw crearErrorHttp(
      nombreTipo
        ? `Adjunta al menos un PDF de ${nombreTipo}.`
        : "Sube al menos un PDF de caja, ventas TV o ventas celular para generar el Excel.",
      400,
      "ARCHIVOS_REQUERIDOS",
    );
  }

  const asignacionesAgencias = normalizarAsignacionesAgencia(
    req.body?.asignacionesAgencias,
  );
  const mapeoAgencias = reportesCaja.length
    ? await obtenerMapeoReporteCaja()
    : [];
  const outputFile = path.join(tempRoot, "CIERRE_CAJA_CON_VENTAS.xlsx");
  const dataOutputFile = path.join(tempRoot, "CONTROL_FINANCIERO.json");
  const { summary } = await runProcessor({
    reportesCajaDir: req.reportesCajaDir,
    ventasTvDir: req.ventasTvDir,
    ventasCelularDir: req.ventasCelularDir,
    outputFile,
    dataOutputFile,
    asignacionesAgencias,
    mapeoAgencias,
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
  const fechaReporte = obtenerFechaReporte([
    ...(datosControlFinanciero.registrosCaja || []),
    ...(datosControlFinanciero.ventasTv || []),
    ...(datosControlFinanciero.ventasCelular || []),
  ]);
  if (!fechaReporte) {
    throw new Error("No se pudo determinar la fecha desde los PDFs procesados.");
  }

  const filename = `CIERRE_CAJA_${fechaReporte.replace(/-/g, "")}.xlsx`;
  const persistencia = await guardarCargaControlFinanciero({
    datos: datosControlFinanciero,
    usuarioId: req.user?.id,
    archivoGenerado: filename,
  });
  const { carga } = persistencia;
  let conciliacionEntradas = null;
  let conciliacionCaja = null;

  try {
    conciliacionEntradas = await conciliarCarga({
      cargaId: carga.id,
      origen: "CARGA",
      usuarioId: req.user?.id,
    });
  } catch (errorConciliacion) {
    console.error(
      "La carga se guardo, pero no se pudo conciliar sus entradas:",
      errorConciliacion,
    );
  }

  if ((datosControlFinanciero.registrosCaja || []).length) {
    try {
      conciliacionCaja = await conciliarCargaCaja({
        cargaId: carga.id,
        origen: "CARGA",
        usuarioId: req.user?.id,
      });
    } catch (errorConciliacionCaja) {
      console.error(
        "La carga se guardo, pero no se pudo conciliar su caja:",
        errorConciliacionCaja,
      );
    }
  }

  let auditoriaAutomatica = crearResumenAuditoriaNoAplica();
  try {
    auditoriaAutomatica = await auditarVentasDesdeDirectorios({
      directorioTv: req.ventasTvDir,
      directorioCelular: req.ventasCelularDir,
      directorioResultados: path.join(tempRoot, "auditoria-resultados"),
      fechaInicio: fechaReporte,
      fechaFin: fechaReporte,
      usuarioId: req.user?.id,
      app: req.app,
      origenAuditoria: "CAJA",
      controlFinancieroCargaId: carga.id,
      dependencias: {
        obtenerReporteAuditoria:
          auditoriaVentasController.obtenerReporteAuditoria,
        auditarRegistrosPdf: auditoriaVentasController.auditarRegistrosPdf,
        contarDispositivosCreditoRve:
          auditoriaVentasController.contarDispositivosCreditoRve,
        esFilaConIncidencia:
          auditoriaVentasController.esFilaConIncidenciaAuditoriaPdf,
        notificarDiferenciasPrecioAuditoria:
          auditoriaVentasController.notificarDiferenciasPrecioAuditoria,
        persistirAuditoriaVentasPdf: guardarAuditoriaVentasPdf,
      },
    });

    auditoriaAutomatica.errores.forEach((errorAuditoria) => {
      console.error(
        `Error en auditoria automatica de ventas ${errorAuditoria.tipo}:`,
        errorAuditoria.message,
      );
    });
  } catch (errorAuditoria) {
    auditoriaAutomatica = {
      ...crearResumenAuditoriaNoAplica(),
      estado: "ERROR",
      errores: [
        {
          tipo: "GENERAL",
          message: errorAuditoria.message || "Error de auditoria automatica",
        },
      ],
    };
    console.error(
      "Error inesperado ejecutando la auditoria automatica de ventas:",
      errorAuditoria,
    );
  }

  return {
    auditoriaAutomatica,
    conciliacionCaja,
    conciliacionEntradas,
    datosControlFinanciero,
    fechaReporte,
    filename,
    outputFile,
    persistencia,
    summary,
  };
};

const establecerHeadersResultado = (res, resultado) => {
  const {
    auditoriaAutomatica,
    conciliacionCaja,
    conciliacionEntradas,
    fechaReporte,
    persistencia,
    summary,
  } = resultado;

  if (summary) {
    res.setHeader("X-RVE-Registros", String(summary.registrosCaja || 0));
    res.setHeader("X-RVE-No-Leidas", String(summary.noLeidas || 0));
    res.setHeader("X-RVE-Ventas-TV", String(summary.ventasTv || 0));
    res.setHeader("X-RVE-Ventas-Celular", String(summary.ventasCelular || 0));
  }
  res.setHeader(
    "X-RVE-Control-Financiero-Carga",
    String(persistencia.carga.id),
  );
  res.setHeader("X-RVE-Fecha-Reporte", fechaReporte);
  res.setHeader(
    "X-RVE-Control-Financiero-Carga-Nueva",
    persistencia.esCargaNueva ? "1" : "0",
  );
  res.setHeader(
    "X-RVE-Archivos-Agregados",
    String(persistencia.archivosAgregados || 0),
  );
  res.setHeader(
    "X-RVE-Archivos-Omitidos",
    String(persistencia.archivosOmitidos || 0),
  );
  res.setHeader(
    "X-RVE-Registros-Omitidos",
    String(persistencia.registrosOmitidos || 0),
  );
  if (conciliacionEntradas?.id) {
    res.setHeader("X-RVE-Conciliacion-Entradas", String(conciliacionEntradas.id));
  }
  if (conciliacionCaja?.id) {
    res.setHeader("X-RVE-Conciliacion-Caja", String(conciliacionCaja.id));
  }
  establecerHeadersAuditoria(res, auditoriaAutomatica);
};

const resumirAuditoriaApi = (auditoria) => ({
  estado: auditoria.estado,
  inconsistencias: auditoria.inconsistencias || 0,
  tv: {
    aplica: Boolean(auditoria.tv?.aplica),
    registros: auditoria.tv?.registros || 0,
    inconsistencias: auditoria.tv?.inconsistencias || 0,
  },
  celular: {
    aplica: Boolean(auditoria.celular?.aplica),
    registros: auditoria.celular?.registros || 0,
    inconsistencias: auditoria.celular?.inconsistencias || 0,
  },
  errores: auditoria.errores || [],
});

exports.extraerCierreCajaConVentas = async (req, res) => {
  const tempRoot = req.reportesCajaVentasTempRoot;

  try {
    const resultado = await procesarCargaReportesCajaVentas(req);
    establecerHeadersResultado(res, resultado);

    return res.download(
      resultado.outputFile,
      resultado.filename,
      async (error) => {
        await limpiarTemporal(tempRoot);

        if (error && !res.headersSent) {
          return res.status(500).json({
            ok: false,
            message: "No se pudo descargar el Excel generado.",
          });
        }
      },
    );
  } catch (error) {
    await limpiarTemporal(tempRoot);
    console.error("Error generando cierre de caja con ventas:", error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.statusCode ? error.code : "REPORTES_CAJA_ERROR",
      message: error.message || "No se pudo generar el cierre de caja.",
    });
  }
};

exports.importarVentasApi = async (req, res) => {
  const tempRoot = req.reportesCajaVentasTempRoot;
  const tipo = req.reportesCajaApiTipo;
  const esCelular = tipo === "CELULAR";

  try {
    const resultado = await procesarCargaReportesCajaVentas(req);
    establecerHeadersResultado(res, resultado);
    await limpiarTemporal(tempRoot);

    const archivosRecibidos = esCelular
      ? req.files?.ventasCelular?.length || 0
      : req.files?.ventasTv?.length || 0;
    const registrosProcesados = esCelular
      ? resultado.summary?.ventasCelular || 0
      : resultado.summary?.ventasTv || 0;
    const registrosAgregados = resultado.persistencia.registrosAgregados || 0;
    const status = registrosAgregados > 0 ? 201 : 200;
    const nombreTipo = esCelular ? "celulares" : "televisiones";

    console.info(`[REPORTES_CAJA_API] Importacion de ${nombreTipo} completada`, {
      requestId: req.reportesCajaRequestId,
      fechaReporte: resultado.fechaReporte,
      cargaId: resultado.persistencia.carga.id,
      archivosRecibidos,
      archivosAgregados: resultado.persistencia.archivosAgregados || 0,
      archivosOmitidos: resultado.persistencia.archivosOmitidos || 0,
      registrosAgregados,
    });

    return res.status(status).json({
      ok: true,
      message:
        registrosAgregados > 0
          ? `Los PDFs de ${nombreTipo} se importaron correctamente`
          : `Los PDFs de ${nombreTipo} ya habian sido importados`,
      requestId: req.reportesCajaRequestId,
      tipo,
      resultado: {
        fechaReporte: resultado.fechaReporte,
        cargaId: resultado.persistencia.carga.id,
        cargaNueva: resultado.persistencia.esCargaNueva,
        archivosRecibidos,
        archivosAgregados: resultado.persistencia.archivosAgregados || 0,
        archivosOmitidos: resultado.persistencia.archivosOmitidos || 0,
        registrosProcesados,
        registrosAgregados,
        registrosOmitidos: resultado.persistencia.registrosOmitidos || 0,
        conciliacionEntradasId: resultado.conciliacionEntradas?.id || null,
        auditoria: resumirAuditoriaApi(resultado.auditoriaAutomatica),
      },
    });
  } catch (error) {
    await limpiarTemporal(tempRoot);
    console.error(
      `[REPORTES_CAJA_API] Error importando ${esCelular ? "celulares" : "televisiones"}`,
      {
        requestId: req.reportesCajaRequestId,
        message: error.message,
      },
    );
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.statusCode ? error.code : "REPORTES_CAJA_IMPORT_ERROR",
      message: error.message || "No se pudieron importar los PDFs.",
      requestId: req.reportesCajaRequestId,
    });
  }
};

exports.normalizarAsignacionesAgencia = normalizarAsignacionesAgencia;
exports.establecerHeadersAuditoria = establecerHeadersAuditoria;
