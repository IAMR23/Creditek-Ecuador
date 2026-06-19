const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { sequelize } = require("../config/db");
const ConciliacionLote = require("../models/ConciliacionLote");
const ConciliacionPdfImportacion = require("../models/ConciliacionPdfImportacion");
const ConciliacionModeloTv = require("../models/ConciliacionModeloTv");
const ConciliacionModeloCelular = require("../models/ConciliacionModeloCelular");
const Modelo = require("../models/Modelo");
const DispositivoMarca = require("../models/DispositivoMarca");
const Dispositivo = require("../models/Dispositivo");
const Marca = require("../models/Marca");

const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS || 120000);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizePdfCode = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const getPythonBin = () =>
  process.env.PYTHON_BIN ||
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

const runPythonProcessor = ({ tipo, inputDir, outputFile }) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      "..",
      "python_processors",
      "main_processor.py",
    );
    const args = [
      scriptPath,
      "--tipo",
      tipo,
      "--input",
      inputDir,
      "--output",
      outputFile,
    ];
    const child = spawn(getPythonBin(), args, {
      cwd: path.join(__dirname, ".."),
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
        const error = new Error(
          stderr.trim() || stdout.trim() || "El procesador Python fallo",
        );
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        return reject(error);
      }

      resolve({ stdout, stderr });
    });
  });

const readJsonIfExists = async (filePath) => {
  if (!fsSync.existsSync(filePath)) return null;
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
};

const modeloInclude = [
  {
    model: DispositivoMarca,
    as: "dispositivoMarca",
    include: [
      { model: Dispositivo, as: "dispositivo", attributes: ["id", "nombre"] },
      { model: Marca, as: "marca", attributes: ["id", "nombre"] },
    ],
  },
];

const isTvModelo = (modelo) => {
  const dispositivo = modelo?.dispositivoMarca?.dispositivo;
  const dispositivoNombre = normalizeText(dispositivo?.nombre);

  return {
    id: Number(dispositivo?.id),
    matches:
      Number(dispositivo?.id) === 1 ||
      dispositivoNombre.includes("tv") ||
      dispositivoNombre.includes("televisor"),
  };
};

const isTvModeloMatch = (modelo) => isTvModelo(modelo).matches;

const isCelularModelo = (modelo) => {
  const dispositivo = modelo?.dispositivoMarca?.dispositivo;
  const dispositivoNombre = normalizeText(dispositivo?.nombre);

  return {
    id: Number(dispositivo?.id),
    matches:
      Number(dispositivo?.id) === 2 ||
      dispositivoNombre.includes("celular") ||
      dispositivoNombre.includes("telefono") ||
      dispositivoNombre.includes("phone") ||
      dispositivoNombre.includes("movil"),
  };
};

const isCelularModeloMatch = (modelo) => isCelularModelo(modelo).matches;

const manualComparison = () => ({
  estado: "PENDIENTE_REVISION",
  observacion: "Pendiente de conciliacion manual contra modelos TV",
});

const modelosTvMapeoInclude = [
  {
    model: Modelo,
    as: "modeloRve",
    include: modeloInclude,
  },
];

const modelosCelularMapeoInclude = [
  {
    model: Modelo,
    as: "modeloRve",
    include: modeloInclude,
  },
];

const listarMapeosModelosTv = () =>
  ConciliacionModeloTv.findAll({
    include: modelosTvMapeoInclude,
    order: [
      ["estado", "ASC"],
      ["codigoNormalizado", "ASC"],
    ],
  });

const listarMapeosModelosCelular = () =>
  ConciliacionModeloCelular.findAll({
    include: modelosCelularMapeoInclude,
    order: [
      ["estado", "ASC"],
      ["codigoNormalizado", "ASC"],
    ],
  });

const extraerModelosUnicos = (resultado) => {
  const map = new Map();
  const registros = Array.isArray(resultado.registros_validos)
    ? resultado.registros_validos
    : [];
  const errores = Array.isArray(resultado.errores) ? resultado.errores : [];

  for (const record of [...registros, ...errores]) {
    const codigoPdf = String(record.codigo_pdf || "").trim();
    const codigoNormalizado = normalizePdfCode(codigoPdf);

    if (!codigoNormalizado) continue;

    const current =
      map.get(codigoNormalizado) || {
        codigoPdf,
        codigoNormalizado,
        vecesDetectado: 0,
        archivosOrigen: new Set(),
      };

    current.vecesDetectado += 1;
    if (record.archivo_origen) current.archivosOrigen.add(record.archivo_origen);
    map.set(codigoNormalizado, current);
  }

  return [...map.values()].map((item) => ({
    ...item,
    archivosOrigen: [...item.archivosOrigen],
  }));
};

const guardarModelosDetectados = async ({
  ModeloMapeo,
  modelosDetectados,
  origen,
  transaction,
}) => {
  let nuevos = 0;
  let actualizados = 0;

  for (const item of modelosDetectados) {
    const existente = await ModeloMapeo.findOne({
      where: { codigoNormalizado: item.codigoNormalizado },
      transaction,
    });

    if (!existente) {
      await ModeloMapeo.create(
        {
          origen,
          codigoPdf: item.codigoPdf,
          codigoNormalizado: item.codigoNormalizado,
          vecesDetectado: item.vecesDetectado,
          archivosOrigen: item.archivosOrigen,
          estado: "PENDIENTE",
          observacion: "Modelo extraido de PDF pendiente de mapeo",
        },
        { transaction },
      );
      nuevos += 1;
      continue;
    }

    const archivosOrigen = new Set([
      ...(Array.isArray(existente.archivosOrigen) ? existente.archivosOrigen : []),
      ...item.archivosOrigen,
    ]);

    await existente.update(
      {
        codigoPdf: existente.codigoPdf || item.codigoPdf,
        vecesDetectado: Number(existente.vecesDetectado || 0) + item.vecesDetectado,
        archivosOrigen: [...archivosOrigen],
      },
      { transaction },
    );
    actualizados += 1;
  }

  return { nuevos, actualizados };
};

const buildResumen = ({ resultado, registros, errores }) => ({
  pdfsProcesados: resultado.pdfs_procesados || 0,
  totalRegistros: resultado.total_registros || 0,
  registrosValidos: registros.length,
  errores: errores.length,
  modelosNoMapeados: errores.filter((error) => error.motivo === "MODELO_NO_MAPEADO")
    .length,
  imeisInvalidos: errores.filter((error) => error.motivo === "IMEI_OBLIGATORIO")
    .length,
  conciliadosManual: registros.filter((record) => record.estado === "CONCILIADO_MANUAL")
    .length,
  coincidencias: registros.filter((record) => record.estado === "COINCIDE").length,
  diferencias: registros.filter((record) => record.estado === "DIFERENCIA").length,
  noEncontrados: registros.filter((record) => record.estado === "NO_ENCONTRADO")
    .length,
  pendientesRevision: registros.filter(
    (record) => record.estado === "PENDIENTE_REVISION",
  ).length,
});

const toDbRecord = (record, comparison, loteId) => ({
  tipoProducto: record.tipo_producto,
  origen: record.origen,
  archivoOrigen: record.archivo_origen || null,
  factura: record.factura || null,
  fecha: record.fecha || null,
  cliente: record.cliente || null,
  codigoPdf: record.codigo_pdf || null,
  modeloNormalizado: record.modelo_normalizado || null,
  imei: record.imei || null,
  cantidad: Number(record.cantidad) || 1,
  precio: Number(record.precio) || 0,
  estado: comparison.estado,
  observacion: comparison.observacion,
  loteImportacionId: loteId,
});

const toResponseRecord = (record, dbRecord) => ({
  ...record,
  id: dbRecord.id,
  loteImportacionId: dbRecord.loteImportacionId,
  estado: dbRecord.estado,
  observacion: dbRecord.observacion,
});

exports.importarPdf = async (req, res) => {
  const tempRoot = req.conciliacionTempRoot;

  try {
    const tipo = String(req.body.tipo || req.body.tipoProducto || "")
      .trim()
      .toUpperCase();

    if (tipo !== "TV") {
      return res.status(400).json({
        ok: false,
        message: "Por ahora la conciliacion PDF esta habilitada solo para TV",
      });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        ok: false,
        message: "Debes subir al menos un PDF",
      });
    }

    const outputDir = path.join(tempRoot, "resultado");
    const outputFile = path.join(outputDir, "resultado.json");
    let processError = null;

    try {
      await runPythonProcessor({
        tipo,
        inputDir: req.conciliacionInputDir,
        outputFile,
      });
    } catch (error) {
      processError = error;
    }

    const resultado = await readJsonIfExists(outputFile);

    if (!resultado) {
      throw processError || new Error("No se genero resultado.json");
    }

    if (processError || !resultado.ok) {
      return res.status(422).json({
        ok: false,
        message:
          processError?.message ||
          resultado.errores?.[0]?.detalle ||
          "No se pudieron procesar los PDFs",
        resultado,
      });
    }

    const registrosPython = Array.isArray(resultado.registros_validos)
      ? resultado.registros_validos
      : [];
    const errores = Array.isArray(resultado.errores) ? resultado.errores : [];

    const registrosComparados = registrosPython.map((record) => ({
      record,
      comparison: manualComparison(record),
    }));

    const transaction = await sequelize.transaction();
    try {
      const lote = await ConciliacionLote.create(
        {
          tipoProducto: tipo,
          totalRegistros: Number(resultado.total_registros) || 0,
          totalValidos: registrosPython.length,
          totalErrores: errores.length,
          estado: "IMPORTADO",
          usuarioId: req.user?.id || null,
        },
        { transaction },
      );

      const dbPayload = registrosComparados.map(({ record, comparison }) =>
        toDbRecord(record, comparison, lote.id),
      );

      const dbRecords = dbPayload.length
        ? await ConciliacionPdfImportacion.bulkCreate(dbPayload, {
            transaction,
            returning: true,
          })
        : [];

      await transaction.commit();

      const registros = registrosComparados.map(({ record }, index) =>
        toResponseRecord(record, dbRecords[index] || { loteImportacionId: lote.id }),
      );
      const resumen = buildResumen({ resultado, registros, errores });

      return res.status(201).json({
        ok: true,
        message: "PDFs procesados correctamente",
        lote,
        resumen,
        registros_validos: registros,
        errores,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error importando PDFs de conciliacion:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "Error al importar PDFs",
    });
  } finally {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
};

exports.listarModelosTv = async (req, res) => {
  try {
    const modelos = await Modelo.findAll({
      where: { activo: true },
      include: modeloInclude,
      order: [["nombre", "ASC"]],
    });

    return res.json(modelos.filter(isTvModeloMatch));
  } catch (error) {
    console.error("Error listando modelos TV:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron cargar los modelos TV",
    });
  }
};

exports.listarModelosTvExtraidos = async (req, res) => {
  try {
    const modelos = await listarMapeosModelosTv();
    return res.json(modelos);
  } catch (error) {
    console.error("Error listando modelos TV extraidos:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron cargar los modelos TV extraidos",
    });
  }
};

exports.extraerModelosTvDesdePdf = async (req, res) => {
  const tempRoot = req.conciliacionTempRoot;

  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        ok: false,
        message: "Debes subir al menos un PDF",
      });
    }

    const outputDir = path.join(tempRoot, "resultado");
    const outputFile = path.join(outputDir, "resultado.json");
    let processError = null;

    try {
      await runPythonProcessor({
        tipo: "TV",
        inputDir: req.conciliacionInputDir,
        outputFile,
      });
    } catch (error) {
      processError = error;
    }

    const resultado = await readJsonIfExists(outputFile);

    if (!resultado) {
      throw processError || new Error("No se genero resultado.json");
    }

    if (processError || !resultado.ok) {
      return res.status(422).json({
        ok: false,
        message:
          processError?.message ||
          resultado.errores?.[0]?.detalle ||
          "No se pudieron extraer los modelos TV",
        resultado,
      });
    }

    const modelosDetectados = extraerModelosUnicos(resultado);
    const transaction = await sequelize.transaction();
    let guardado;

    try {
      guardado = await guardarModelosDetectados({
        ModeloMapeo: ConciliacionModeloTv,
        modelosDetectados,
        origen: "PDF_CREDITV",
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const modelos = await listarMapeosModelosTv();
    const errores = Array.isArray(resultado.errores) ? resultado.errores : [];

    return res.status(201).json({
      ok: true,
      message: "Modelos TV extraidos correctamente",
      resumen: {
        pdfsProcesados: resultado.pdfs_procesados || 0,
        totalRegistros: resultado.total_registros || 0,
        modelosDetectados: modelosDetectados.length,
        modelosNuevos: guardado.nuevos,
        modelosActualizados: guardado.actualizados,
        totalMapeos: modelos.length,
        modelosMapeados: modelos.filter((modelo) => modelo.estado === "MAPEADO")
          .length,
        modelosPendientes: modelos.filter((modelo) => modelo.estado !== "MAPEADO")
          .length,
        errores: errores.length,
      },
      modelos,
      errores,
    });
  } catch (error) {
    console.error("Error extrayendo modelos TV:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "Error al extraer modelos TV",
    });
  } finally {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
};

exports.actualizarMapeoModeloTv = async (req, res) => {
  try {
    const mapeo = await ConciliacionModeloTv.findByPk(req.params.id);

    if (!mapeo) {
      return res.status(404).json({
        ok: false,
        message: "Modelo TV extraido no encontrado",
      });
    }

    const modeloRveId = req.body.modeloRveId || req.body.modeloId || null;

    if (!modeloRveId) {
      await mapeo.update({
        modeloRveId: null,
        modeloRveNombre: null,
        estado: "PENDIENTE",
        observacion: "Modelo extraido de PDF pendiente de mapeo",
      });

      const actualizado = await ConciliacionModeloTv.findByPk(mapeo.id, {
        include: modelosTvMapeoInclude,
      });

      return res.json({ ok: true, modelo: actualizado });
    }

    const modeloRve = await Modelo.findByPk(modeloRveId, {
      include: modeloInclude,
    });

    if (!modeloRve || !isTvModeloMatch(modeloRve)) {
      return res.status(400).json({
        ok: false,
        message: "El modelo seleccionado no corresponde a TV",
      });
    }

    await mapeo.update({
      modeloRveId: modeloRve.id,
      modeloRveNombre: modeloRve.nombre,
      estado: "MAPEADO",
      observacion: `Mapeado a modelo RVE: ${modeloRve.nombre}`,
    });

    const actualizado = await ConciliacionModeloTv.findByPk(mapeo.id, {
      include: modelosTvMapeoInclude,
    });

    return res.json({ ok: true, modelo: actualizado });
  } catch (error) {
    console.error("Error actualizando mapeo TV:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo actualizar el mapeo del modelo TV",
    });
  }
};

exports.listarModelosCelular = async (req, res) => {
  try {
    const modelos = await Modelo.findAll({
      where: { activo: true },
      include: modeloInclude,
      order: [["nombre", "ASC"]],
    });

    return res.json(modelos.filter(isCelularModeloMatch));
  } catch (error) {
    console.error("Error listando modelos celular:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron cargar los modelos de celular",
    });
  }
};

exports.listarModelosCelularExtraidos = async (req, res) => {
  try {
    const modelos = await listarMapeosModelosCelular();
    return res.json(modelos);
  } catch (error) {
    console.error("Error listando modelos celular extraidos:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron cargar los modelos de celular extraidos",
    });
  }
};

exports.extraerModelosCelularDesdePdf = async (req, res) => {
  const tempRoot = req.conciliacionTempRoot;

  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      return res.status(400).json({
        ok: false,
        message: "Debes subir al menos un PDF",
      });
    }

    const outputDir = path.join(tempRoot, "resultado");
    const outputFile = path.join(outputDir, "resultado.json");
    let processError = null;

    try {
      await runPythonProcessor({
        tipo: "CELULAR",
        inputDir: req.conciliacionInputDir,
        outputFile,
      });
    } catch (error) {
      processError = error;
    }

    const resultado = await readJsonIfExists(outputFile);

    if (!resultado) {
      throw processError || new Error("No se genero resultado.json");
    }

    if (processError || !resultado.ok) {
      return res.status(422).json({
        ok: false,
        message:
          processError?.message ||
          resultado.errores?.[0]?.detalle ||
          "No se pudieron extraer los modelos de celular",
        resultado,
      });
    }

    const modelosDetectados = extraerModelosUnicos(resultado);
    const transaction = await sequelize.transaction();
    let guardado;

    try {
      guardado = await guardarModelosDetectados({
        ModeloMapeo: ConciliacionModeloCelular,
        modelosDetectados,
        origen: "PDF_UPHONE",
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const modelos = await listarMapeosModelosCelular();
    const errores = Array.isArray(resultado.errores) ? resultado.errores : [];

    return res.status(201).json({
      ok: true,
      message: "Modelos de celular extraidos correctamente",
      resumen: {
        pdfsProcesados: resultado.pdfs_procesados || 0,
        totalRegistros: resultado.total_registros || 0,
        modelosDetectados: modelosDetectados.length,
        modelosNuevos: guardado.nuevos,
        modelosActualizados: guardado.actualizados,
        totalMapeos: modelos.length,
        modelosMapeados: modelos.filter((modelo) => modelo.estado === "MAPEADO")
          .length,
        modelosPendientes: modelos.filter((modelo) => modelo.estado !== "MAPEADO")
          .length,
        errores: errores.length,
      },
      modelos,
      errores,
    });
  } catch (error) {
    console.error("Error extrayendo modelos de celular:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "Error al extraer modelos de celular",
    });
  } finally {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
};

exports.actualizarMapeoModeloCelular = async (req, res) => {
  try {
    const mapeo = await ConciliacionModeloCelular.findByPk(req.params.id);

    if (!mapeo) {
      return res.status(404).json({
        ok: false,
        message: "Modelo de celular extraido no encontrado",
      });
    }

    const modeloRveId = req.body.modeloRveId || req.body.modeloId || null;

    if (!modeloRveId) {
      await mapeo.update({
        modeloRveId: null,
        modeloRveNombre: null,
        estado: "PENDIENTE",
        observacion: "Modelo extraido de PDF pendiente de mapeo",
      });

      const actualizado = await ConciliacionModeloCelular.findByPk(mapeo.id, {
        include: modelosCelularMapeoInclude,
      });

      return res.json({ ok: true, modelo: actualizado });
    }

    const modeloRve = await Modelo.findByPk(modeloRveId, {
      include: modeloInclude,
    });

    if (!modeloRve || !isCelularModeloMatch(modeloRve)) {
      return res.status(400).json({
        ok: false,
        message: "El modelo seleccionado no corresponde a celular",
      });
    }

    await mapeo.update({
      modeloRveId: modeloRve.id,
      modeloRveNombre: modeloRve.nombre,
      estado: "MAPEADO",
      observacion: `Mapeado a modelo RVE: ${modeloRve.nombre}`,
    });

    const actualizado = await ConciliacionModeloCelular.findByPk(mapeo.id, {
      include: modelosCelularMapeoInclude,
    });

    return res.json({ ok: true, modelo: actualizado });
  } catch (error) {
    console.error("Error actualizando mapeo celular:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo actualizar el mapeo del modelo de celular",
    });
  }
};

exports.actualizarModeloImportacionTv = async (req, res) => {
  try {
    const importacion = await ConciliacionPdfImportacion.findByPk(req.params.id);

    if (!importacion) {
      return res.status(404).json({
        ok: false,
        message: "Importacion no encontrada",
      });
    }

    const modeloId = req.body.modeloId;

    if (!modeloId) {
      await importacion.update({
        modeloNormalizado: "NO_MAPEADO",
        estado: "PENDIENTE_REVISION",
        observacion: "Pendiente de conciliacion manual contra modelos TV",
      });

      return res.json({ ok: true, importacion, modelo: null });
    }

    const modelo = await Modelo.findByPk(modeloId, {
      include: modeloInclude,
    });

    if (!modelo || !isTvModeloMatch(modelo)) {
      return res.status(400).json({
        ok: false,
        message: "El modelo seleccionado no corresponde a TV",
      });
    }

    await importacion.update({
      modeloNormalizado: modelo.nombre,
      estado: "CONCILIADO_MANUAL",
      observacion: `Modelo TV conciliado manualmente: ${modelo.nombre}`,
    });

    return res.json({ ok: true, importacion, modelo });
  } catch (error) {
    console.error("Error actualizando modelo de importacion:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo actualizar el modelo de la importacion",
    });
  }
};
