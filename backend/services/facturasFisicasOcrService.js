const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const { Op } = require("sequelize");

const { sequelize } = require("../config/db");
const FacturaFisica = require("../models/FacturaFisica");
const facturasFisicasService = require("./facturasFisicasService");
const facturasFisicasProductosOcrService = require("./facturasFisicasProductosOcrService");

const OCR_TIMEOUT_MS = Math.max(
  10000,
  Number(process.env.FACTURAS_FISICAS_OCR_TIMEOUT_MS || 120000),
);
const OCR_LOCK_STALE_MS = Math.max(OCR_TIMEOUT_MS * 2, 300000);
const MAX_STDOUT_BYTES = 6 * 1024 * 1024;
const MAX_STDERR_BYTES = 128 * 1024;
const CAMPOS_OCR = [
  "proveedor",
  "rucProveedor",
  "numeroFactura",
  "fechaEmision",
  "subtotal",
  "impuestos",
  "total",
];

const crearError = (message, statusCode = 400, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
};

const normalizarId = (value, label = "El registro") => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw crearError(`${label} no es valido`);
  }
  return id;
};

const getPythonBin = () =>
  process.env.PYTHON_BIN ||
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

const terminarProceso = (child) => {
  if (!child?.pid) return;
  try {
    if (process.platform !== "win32") {
      process.kill(-child.pid, "SIGKILL");
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    child.kill("SIGKILL");
  }
};

const ejecutarProcesadorOcr = ({ archivo, mimeType, extension, facturaId }) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      "..",
      "python_processors",
      "facturas_fisicas_ocr.py",
    );
    const child = spawn(
      getPythonBin(),
      [
        scriptPath,
        "--archivo",
        archivo,
        "--mime",
        mimeType,
        "--extension",
        extension,
        "--factura-id",
        String(facturaId),
      ],
      {
        cwd: path.join(__dirname, ".."),
        detached: process.platform !== "win32",
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
    let outputTooLarge = false;
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    const timer = setTimeout(() => {
      timedOut = true;
      terminarProceso(child);
    }, OCR_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (Buffer.byteLength(stdout, "utf8") > MAX_STDOUT_BYTES) {
        outputTooLarge = true;
        terminarProceso(child);
      }
    });
    child.stderr.on("data", (chunk) => {
      if (Buffer.byteLength(stderr, "utf8") < MAX_STDERR_BYTES) {
        stderr += chunk.toString("utf8");
      }
    });
    child.on("error", () =>
      finish(() =>
        reject(
          crearError("No se pudo iniciar el motor OCR.", 502, {
            codigo: "OCR_START_FAILED",
          }),
        ),
      ),
    );
    child.on("close", (code) => {
      finish(() => {
        if (timedOut) {
          return reject(
            crearError("El OCR excedio el tiempo maximo de procesamiento.", 504, {
              codigo: "OCR_TIMEOUT",
            }),
          );
        }
        if (outputTooLarge) {
          return reject(
            crearError("El OCR genero una respuesta demasiado grande.", 422, {
              codigo: "OCR_OUTPUT_TOO_LARGE",
            }),
          );
        }

        let result;
        try {
          result = JSON.parse(stdout.trim());
        } catch {
          const error = crearError("El procesador OCR devolvio una respuesta invalida.", 502, {
            codigo: "OCR_INVALID_RESPONSE",
          });
          error.stderr = stderr;
          error.exitCode = code;
          return reject(error);
        }
        if (code !== 0 && result?.ok !== false) {
          return reject(
            crearError("El procesador OCR termino inesperadamente.", 502, {
              codigo: "OCR_PROCESS_FAILED",
            }),
          );
        }
        return resolve(result);
      });
    });
  });

const normalizarTextoOcr = (value, max) => {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
};

const normalizarFechaOcr = (value) => {
  const text = normalizarTextoOcr(value, 10);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text
    ? text
    : null;
};

const normalizarMontoOcr = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 9999999999.99) return null;
  return Number(number.toFixed(2));
};

const validarResultadoOcr = (result) => {
  if (!result || typeof result !== "object") {
    throw crearError("El procesador OCR devolvio una respuesta vacia.", 502);
  }
  if (result.ok !== true) {
    throw crearError(
      normalizarTextoOcr(result.error, 500) || "No se pudo procesar el documento.",
      422,
      { codigo: normalizarTextoOcr(result.codigo, 80) || "OCR_FAILED" },
    );
  }

  const rawFields = result.campos && typeof result.campos === "object"
    ? result.campos
    : {};
  const campos = {
    proveedor: normalizarTextoOcr(rawFields.proveedor, 255),
    rucProveedor: normalizarTextoOcr(rawFields.rucProveedor, 30),
    numeroFactura: normalizarTextoOcr(rawFields.numeroFactura, 80),
    fechaEmision: normalizarFechaOcr(rawFields.fechaEmision),
    subtotal: normalizarMontoOcr(rawFields.subtotal),
    impuestos: normalizarMontoOcr(rawFields.impuestos),
    total: normalizarMontoOcr(rawFields.total),
  };
  const advertencias = Array.isArray(result.advertencias)
    ? result.advertencias
        .map((value) => normalizarTextoOcr(value, 1000))
        .filter(Boolean)
        .slice(0, 100)
    : [];
  const metadata = result.metadata && typeof result.metadata === "object"
    ? result.metadata
    : {};
  if (Buffer.byteLength(JSON.stringify(metadata), "utf8") > 128 * 1024) {
    throw crearError("La metadata OCR supera el limite permitido.", 502);
  }

  return {
    texto: normalizarTextoOcr(result.texto, 5_000_000) || "",
    campos,
    productos: facturasFisicasProductosOcrService.validarProductosProcesador(
      result.productos,
    ),
    advertencias,
    metadata,
    motor: normalizarTextoOcr(metadata.motor, 80) || "desconocido",
    version: normalizarTextoOcr(metadata.versionProcesador, 40) || "1.0.0",
  };
};

const crearEvento = ({
  tipo,
  usuarioId,
  estado,
  campos,
  productos,
  error,
  fecha = new Date(),
}) => ({
  tipo,
  fecha: fecha.toISOString(),
  usuarioId,
  ...(estado ? { estado } : {}),
  ...(Array.isArray(campos) ? { campos } : {}),
  ...(Number.isInteger(productos) ? { productos } : {}),
  ...(error ? { error: normalizarTextoOcr(error, 500) } : {}),
});

const historialConEvento = (historial, evento) => [
  ...(Array.isArray(historial) ? historial : []),
  evento,
];

const asegurarActualizacionPropia = (updatedRows) => {
  const count = Array.isArray(updatedRows) ? Number(updatedRows[0]) : Number(updatedRows);
  if (count !== 1) {
    throw crearError(
      "El intento OCR fue reemplazado por otro procesamiento; se descarto este resultado.",
      409,
      { codigo: "OCR_STALE_RESULT" },
    );
  }
};

const procesarOcrFactura = async ({
  id: idValue,
  usuarioId: usuarioIdValue,
  ejecutarProcesador = ejecutarProcesadorOcr,
}) => {
  const id = normalizarId(idValue, "La factura");
  const usuarioId = normalizarId(usuarioIdValue, "El usuario");
  const factura = await FacturaFisica.findByPk(id);
  if (!factura) throw crearError("Factura fisica no encontrada", 404);
  if (factura.estado === "ANULADA") {
    throw crearError("No se puede procesar OCR de una factura anulada", 409);
  }

  const archivo = await facturasFisicasService.obtenerArchivoFactura(id);
  const token = crypto.randomUUID();
  const inicio = new Date();
  const staleBefore = new Date(inicio.getTime() - OCR_LOCK_STALE_MS);
  const historialInicial = historialConEvento(
    factura.ocrHistorial,
    crearEvento({ tipo: "PROCESAMIENTO_INICIADO", usuarioId, estado: "PROCESANDO", fecha: inicio }),
  );
  const [locked] = await FacturaFisica.update(
    {
      ocrEstado: "PROCESANDO",
      ocrError: null,
      ocrProcesadoEn: inicio,
      ocrProcesadoPorId: usuarioId,
      ocrProcesamientoToken: token,
      ocrHistorial: historialInicial,
    },
    {
      where: {
        id,
        estado: { [Op.ne]: "ANULADA" },
        [Op.or]: [
          { ocrEstado: { [Op.ne]: "PROCESANDO" } },
          { ocrProcesadoEn: null },
          { ocrProcesadoEn: { [Op.lt]: staleBefore } },
        ],
      },
    },
  );
  if (Number(locked) !== 1) {
    throw crearError("La factura ya se esta procesando por OCR", 409, {
      codigo: "OCR_IN_PROGRESS",
    });
  }

  try {
    const rawResult = await ejecutarProcesador({
      archivo: archivo.rutaAbsoluta,
      mimeType: factura.mimeType,
      extension: factura.extension,
      facturaId: id,
    });
    const result = validarResultadoOcr(rawResult);
    const procesadoEn = new Date();
    await sequelize.transaction(async (transaction) => {
      const persistencia =
        await facturasFisicasProductosOcrService.persistirProductosDetectados({
          facturaId: id,
          productos: result.productos,
          loteOcr: token,
          usuarioId,
          transaction,
        });
      const advertencias = [...result.advertencias];
      if (persistencia.preservados > 0) {
        advertencias.push(
          `Se preservaron ${persistencia.preservados} producto(s) confirmado(s) o corregido(s) manualmente; revise posibles duplicados.`,
        );
      }
      const estado = advertencias.length
        ? "PROCESADO_CON_ADVERTENCIAS"
        : "PROCESADO";
      const updatedRows = await FacturaFisica.update(
        {
          ocrEstado: estado,
          ocrTexto: result.texto,
          ocrCampos: result.campos,
          ocrAdvertencias: advertencias,
          ocrMetadata: {
            ...result.metadata,
            productosPersistencia: persistencia,
          },
          ocrError: null,
          ocrProcesadoEn: procesadoEn,
          ocrProcesadoPorId: usuarioId,
          ocrMotor: result.motor,
          ocrVersion: result.version,
          ocrProcesamientoToken: null,
          ocrHistorial: historialConEvento(
            historialInicial,
            crearEvento({
              tipo: "PROCESAMIENTO_FINALIZADO",
              usuarioId,
              estado,
              productos: persistencia.creados,
              fecha: procesadoEn,
            }),
          ),
        },
        {
          where: { id, ocrEstado: "PROCESANDO", ocrProcesamientoToken: token },
          transaction,
        },
      );
      asegurarActualizacionPropia(updatedRows);
    });
    return facturasFisicasService.obtenerFactura(id);
  } catch (error) {
    if (error.codigo === "OCR_STALE_RESULT") throw error;
    const message = normalizarTextoOcr(error.message, 1000) || "No se pudo procesar el documento.";
    const failedAt = new Date();
    await FacturaFisica.update(
      {
        ocrEstado: "ERROR",
        ocrError: message,
        ocrProcesadoEn: failedAt,
        ocrProcesadoPorId: usuarioId,
        ocrProcesamientoToken: null,
        ocrHistorial: historialConEvento(
          historialInicial,
          crearEvento({ tipo: "PROCESAMIENTO_ERROR", usuarioId, estado: "ERROR", error: message, fecha: failedAt }),
        ),
      },
      { where: { id, ocrEstado: "PROCESANDO", ocrProcesamientoToken: token } },
    );
    throw error;
  }
};

const normalizarCamposSolicitados = (value) => {
  if (!Array.isArray(value) || !value.length) {
    throw crearError("Selecciona al menos un campo OCR para aplicar");
  }
  const unique = [...new Set(value.map((field) => String(field || "").trim()))];
  const invalid = unique.filter((field) => !CAMPOS_OCR.includes(field));
  if (invalid.length) {
    throw crearError(`Campos OCR no permitidos: ${invalid.join(", ")}`);
  }
  return unique;
};

const aplicarSugerenciasOcr = async ({ id: idValue, usuarioId: usuarioIdValue, campos }) => {
  const id = normalizarId(idValue, "La factura");
  const usuarioId = normalizarId(usuarioIdValue, "El usuario");
  const requestedFields = normalizarCamposSolicitados(campos);
  const factura = await FacturaFisica.findByPk(id);
  if (!factura) throw crearError("Factura fisica no encontrada", 404);
  if (factura.estado === "ANULADA") {
    throw crearError("No se pueden aplicar sugerencias a una factura anulada", 409);
  }
  if (!factura.ocrCampos || !["PROCESADO", "PROCESADO_CON_ADVERTENCIAS"].includes(factura.ocrEstado)) {
    throw crearError("La factura no tiene sugerencias OCR disponibles", 409);
  }

  const update = { actualizadoPorId: usuarioId };
  const appliedFields = [];
  for (const field of requestedFields) {
    const value = factura.ocrCampos[field];
    if (value === null || value === undefined || value === "") continue;
    if (field === "fechaEmision") update[field] = normalizarFechaOcr(value);
    else if (["subtotal", "impuestos", "total"].includes(field)) {
      update[field] = normalizarMontoOcr(value);
    } else {
      update[field] = normalizarTextoOcr(value, field === "proveedor" ? 255 : field === "numeroFactura" ? 80 : 30);
    }
    if (update[field] !== null) appliedFields.push(field);
  }
  if (!appliedFields.length) {
    throw crearError("Los campos seleccionados no tienen sugerencias OCR aplicables");
  }
  update.ocrHistorial = historialConEvento(
    factura.ocrHistorial,
    crearEvento({ tipo: "SUGERENCIAS_APLICADAS", usuarioId, campos: appliedFields }),
  );
  await factura.update(update);
  return {
    factura: await facturasFisicasService.obtenerFactura(id),
    camposAplicados: appliedFields,
  };
};

module.exports = {
  CAMPOS_OCR,
  OCR_TIMEOUT_MS,
  aplicarSugerenciasOcr,
  ejecutarProcesadorOcr,
  procesarOcrFactura,
  validarResultadoOcr,
};
