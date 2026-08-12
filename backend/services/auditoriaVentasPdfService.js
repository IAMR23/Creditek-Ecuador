const fs = require("fs/promises");
const path = require("path");
const { spawn } = require("child_process");

const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS || 120000);
const TIPOS_AUDITORIA = new Set(["TV", "CELULAR"]);

const getPythonBin = () =>
  process.env.PYTHON_BIN ||
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

const ejecutarProcesadorAuditoria = ({ tipo, directorioEntrada, archivoSalida }) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      "..",
      "python_processors",
      "main_processor.py",
    );
    const child = spawn(
      getPythonBin(),
      [
        scriptPath,
        "--tipo",
        tipo,
        "--input",
        directorioEntrada,
        "--output",
        archivoSalida,
      ],
      {
        cwd: path.join(__dirname, ".."),
        env: {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: "1",
        },
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const finalizar = (callback) => {
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
    child.on("error", (error) => finalizar(() => reject(error)));
    child.on("close", (code) => {
      finalizar(() => {
        if (timedOut) {
          return reject(new Error("Tiempo agotado procesando los PDFs"));
        }
        if (code !== 0) {
          return reject(
            new Error(
              stderr.trim() || stdout.trim() || "El procesador Python fallo",
            ),
          );
        }
        return resolve({ stdout, stderr });
      });
    });
  });

const leerJsonSiExiste = async (archivo) => {
  try {
    return JSON.parse(await fs.readFile(archivo, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const crearErrorProcesamiento = ({ error, resultado }) => {
  const procesamientoError = new Error(
    error?.message ||
      resultado?.errores?.[0]?.detalle ||
      "No se pudieron procesar los PDFs",
  );
  procesamientoError.statusCode = 422;
  procesamientoError.resultado = resultado || null;
  return procesamientoError;
};

const auditarVentasDesdeRegistros = async ({
  auditoriaId,
  tipo,
  registrosPdf = [],
  totalRegistrosPdf,
  pdfsProcesados = 0,
  erroresExtraccion = [],
  fechaInicio,
  fechaFin,
  usuarioId,
  app,
  filtros = {},
  origenAuditoria = "MANUAL",
  controlFinancieroCargaId = null,
  obtenerReporteAuditoria,
  auditarRegistrosPdf,
  contarDispositivosCreditoRve,
  esFilaConIncidencia,
  notificarDiferenciasPrecioAuditoria,
  persistirAuditoriaVentasPdf,
}) => {
  const tipoNormalizado = String(tipo || "").trim().toUpperCase();
  if (!TIPOS_AUDITORIA.has(tipoNormalizado)) {
    const error = new Error("tipo debe ser TV o CELULAR");
    error.statusCode = 400;
    throw error;
  }

  const registrosValidos = Array.isArray(registrosPdf) ? registrosPdf : [];
  const totalRegistros =
    Number(totalRegistrosPdf) || registrosValidos.length;
  const erroresProcesamiento = Array.isArray(erroresExtraccion)
    ? erroresExtraccion
    : [];
  const ventas = await obtenerReporteAuditoria({
    ...filtros,
    fechaInicio,
    fechaFin,
  });
  const dispositivosCreditoPdf = totalRegistros;
  const dispositivosCreditoRve = contarDispositivosCreditoRve({
    tipo: tipoNormalizado,
    ventas,
  });
  const auditoria = await auditarRegistrosPdf({
    tipo: tipoNormalizado,
    registrosPdf: registrosValidos,
    ventas,
  });
  await notificarDiferenciasPrecioAuditoria(
    { usuarioId, app },
    auditoria.resultados,
  );

  const erroresDetectados = auditoria.resultados.filter(
    esFilaConIncidencia,
  ).length;
  const resultadoAuditoria = {
    ok: true,
    tipo: tipoNormalizado,
    resumen: {
      pdfsProcesados: Number(pdfsProcesados) || 0,
      registrosPdf: totalRegistros,
      registrosPdfValidos: registrosValidos.length,
      dispositivosCreditoPdf,
      dispositivosCreditoRve,
      diferenciaCredito: dispositivosCreditoRve - dispositivosCreditoPdf,
      criterioCreditoRve: "formaPago credito",
      ventasComparadas: auditoria.resultados.length,
      erroresDetectados,
      erroresExtraccion: erroresProcesamiento.length,
    },
    ventas: auditoria.resultados,
    errores: erroresProcesamiento,
  };

  let auditoriaGuardada = null;
  if (persistirAuditoriaVentasPdf) {
    auditoriaGuardada = await persistirAuditoriaVentasPdf({
      auditoriaId,
      tipo: tipoNormalizado,
      fechaInicio,
      fechaFin,
      origen: origenAuditoria,
      estado:
        erroresDetectados > 0
          ? "COMPLETADA_CON_INCONSISTENCIAS"
          : "COMPLETADA",
      registrosPdf: registrosValidos,
      resultados: resultadoAuditoria.ventas,
      resumen: resultadoAuditoria.resumen,
      errores: resultadoAuditoria.errores,
      usuarioId,
      controlFinancieroCargaId,
    });
  }

  resultadoAuditoria.auditoriaId = auditoriaGuardada?.id || auditoriaId || null;
  if (Array.isArray(auditoriaGuardada?.resultados)) {
    resultadoAuditoria.ventas = auditoriaGuardada.resultados;
  }

  return resultadoAuditoria;
};

const auditarVentasDesdeDirectorio = async ({
  auditoriaId,
  tipo,
  directorioEntrada,
  directorioSalida,
  fechaInicio,
  fechaFin,
  usuarioId,
  app,
  filtros = {},
  origenAuditoria = "MANUAL",
  controlFinancieroCargaId = null,
  obtenerReporteAuditoria,
  auditarRegistrosPdf,
  contarDispositivosCreditoRve,
  esFilaConIncidencia,
  notificarDiferenciasPrecioAuditoria,
  persistirAuditoriaVentasPdf,
}) => {
  const tipoNormalizado = String(tipo || "").trim().toUpperCase();
  if (!TIPOS_AUDITORIA.has(tipoNormalizado)) {
    const error = new Error("tipo debe ser TV o CELULAR");
    error.statusCode = 400;
    throw error;
  }
  if (!directorioEntrada || !directorioSalida) {
    throw new Error("Los directorios de auditoria son obligatorios");
  }

  await fs.mkdir(directorioSalida, { recursive: true });
  const archivoSalida = path.join(directorioSalida, "resultado.json");
  let processError = null;

  try {
    await ejecutarProcesadorAuditoria({
      tipo: tipoNormalizado,
      directorioEntrada,
      archivoSalida,
    });
  } catch (error) {
    processError = error;
  }

  const resultado = await leerJsonSiExiste(archivoSalida);
  if (!resultado) {
    throw processError || new Error("No se genero resultado.json");
  }
  if (processError || !resultado.ok) {
    throw crearErrorProcesamiento({ error: processError, resultado });
  }

  const registrosPdf = Array.isArray(resultado.registros_validos)
    ? resultado.registros_validos
    : [];
  const totalRegistrosPdf =
    Number(resultado.total_registros) || registrosPdf.length;

  return auditarVentasDesdeRegistros({
    auditoriaId,
    tipo: tipoNormalizado,
    registrosPdf,
    totalRegistrosPdf,
    pdfsProcesados: resultado.pdfs_procesados || 0,
    erroresExtraccion: resultado.errores || [],
    fechaInicio,
    fechaFin,
    usuarioId,
    app,
    filtros,
    origenAuditoria,
    controlFinancieroCargaId,
    obtenerReporteAuditoria,
    auditarRegistrosPdf,
    contarDispositivosCreditoRve,
    esFilaConIncidencia,
    notificarDiferenciasPrecioAuditoria,
    persistirAuditoriaVentasPdf,
  });
};

const contarPdfs = async (directorio) => {
  if (!directorio) return 0;

  try {
    const archivos = await fs.readdir(directorio, { withFileTypes: true });
    return archivos.filter(
      (archivo) =>
        archivo.isFile() && path.extname(archivo.name).toLowerCase() === ".pdf",
    ).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
};

const crearResumenTipoVacio = () => ({
  aplica: false,
  registros: 0,
  inconsistencias: 0,
  resultado: null,
});

const auditarVentasDesdeDirectorios = async ({
  directorioTv,
  directorioCelular,
  directorioResultados,
  fechaInicio,
  fechaFin,
  usuarioId,
  app,
  origenAuditoria = "CAJA",
  controlFinancieroCargaId = null,
  dependencias,
  auditarDirectorio = auditarVentasDesdeDirectorio,
  contarPdfsDirectorio = contarPdfs,
}) => {
  const resumen = {
    estado: "NO_APLICA",
    inconsistencias: 0,
    tv: crearResumenTipoVacio(),
    celular: crearResumenTipoVacio(),
    errores: [],
  };
  const configuraciones = [
    { clave: "tv", tipo: "TV", directorio: directorioTv },
    {
      clave: "celular",
      tipo: "CELULAR",
      directorio: directorioCelular,
    },
  ];

  for (const configuracion of configuraciones) {
    const cantidadPdfs = await contarPdfsDirectorio(configuracion.directorio);
    if (!cantidadPdfs) continue;

    resumen[configuracion.clave].aplica = true;
    try {
      const resultado = await auditarDirectorio({
        tipo: configuracion.tipo,
        directorioEntrada: configuracion.directorio,
        directorioSalida: path.join(
          directorioResultados,
          configuracion.clave,
        ),
        fechaInicio,
        fechaFin,
        usuarioId,
        app,
        origenAuditoria,
        controlFinancieroCargaId,
        ...dependencias,
      });
      const inconsistencias =
        Number(resultado.resumen.erroresDetectados) || 0;
      resumen[configuracion.clave] = {
        aplica: true,
        registros: Number(resultado.resumen.registrosPdf) || 0,
        inconsistencias,
        resultado,
      };
      resumen.inconsistencias += inconsistencias;
    } catch (error) {
      resumen.errores.push({
        tipo: configuracion.tipo,
        message: error.message || "Error de auditoria",
      });
    }
  }

  const aplica = resumen.tv.aplica || resumen.celular.aplica;
  if (!aplica) {
    resumen.estado = "NO_APLICA";
  } else if (resumen.errores.length) {
    resumen.estado = "ERROR";
  } else if (resumen.inconsistencias > 0) {
    resumen.estado = "COMPLETADA_CON_INCONSISTENCIAS";
  } else {
    resumen.estado = "COMPLETADA";
  }

  return resumen;
};

module.exports = {
  auditarVentasDesdeDirectorio,
  auditarVentasDesdeDirectorios,
  auditarVentasDesdeRegistros,
  contarPdfs,
  ejecutarProcesadorAuditoria,
  leerJsonSiExiste,
};
