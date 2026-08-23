const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { Op } = require("sequelize");

const FacturaFisica = require("../models/FacturaFisica");
const Usuario = require("../models/Usuario");

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const STORAGE_ROOT = path.join(__dirname, "..", "storage", "facturas_fisicas");
const ESTADOS = FacturaFisica.ESTADOS;
const ESTADOS_EDITABLES = ESTADOS.filter((estado) => estado !== "ANULADA");
const MIME_EXTENSIONS = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
};

const includeUsuarios = [
  {
    model: Usuario,
    as: "usuarioCarga",
    attributes: ["id", "nombre"],
    required: false,
  },
  {
    model: Usuario,
    as: "creadoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
  {
    model: Usuario,
    as: "actualizadoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
  {
    model: Usuario,
    as: "anuladoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
  {
    model: Usuario,
    as: "ocrProcesadoPor",
    attributes: ["id", "nombre"],
    required: false,
  },
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

const normalizarTexto = (value, max = 255) => {
  if (value === undefined || value === null) return null;
  const texto = String(value).trim();
  if (!texto) return null;
  if (texto.length > max) {
    throw crearError(`El texto no puede superar ${max} caracteres`);
  }
  return texto;
};

const normalizarFechaIso = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const texto = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw crearError("La fecha debe tener formato YYYY-MM-DD");
  }
  const fecha = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
    throw crearError("La fecha no es valida");
  }
  return texto;
};

const normalizarMonto = (value, label) => {
  if (value === undefined || value === null || value === "") return null;
  const numero = Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0 || numero > 9999999999.99) {
    throw crearError(`${label} debe ser un numero mayor o igual a 0`);
  }
  return Number(numero.toFixed(2));
};

const normalizarDatosAdicionales = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    try {
      return normalizarDatosAdicionales(JSON.parse(value));
    } catch {
      throw crearError("datosAdicionales debe ser un JSON valido");
    }
  }
  if (Array.isArray(value)) {
    const resultado = {};
    value.forEach((item) => {
      const clave = normalizarTexto(item?.clave, 80);
      if (!clave) return;
      resultado[clave] = normalizarTexto(item?.valor, 500) || "";
    });
    return Object.keys(resultado).length ? resultado : null;
  }
  if (typeof value !== "object") {
    throw crearError("datosAdicionales debe ser un objeto JSON");
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([clave, valor]) => [
        normalizarTexto(clave, 80),
        valor === null || valor === undefined
          ? ""
          : normalizarTexto(valor, 500) || "",
      ])
      .filter(([clave]) => clave),
  );
};

const normalizarEstado = (value, permitidos = ESTADOS) => {
  const estado = String(value || "").trim().toUpperCase();
  if (!permitidos.includes(estado)) {
    throw crearError("El estado solicitado no es valido");
  }
  return estado;
};

const normalizarOrigenCarga = (value) => {
  const origen = String(value || "WEB").trim().toUpperCase();
  if (!["WEB", "CELULAR"].includes(origen)) return "WEB";
  return origen;
};

const extensionPermitida = (file) => {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const permitidas = MIME_EXTENSIONS[file.mimetype] || [];
  return permitidas.includes(extension) ? extension : null;
};

const validarArchivo = (file) => {
  if (!file) throw crearError("Selecciona un archivo para cargar");
  if (!Buffer.isBuffer(file.buffer)) {
    throw crearError("No se pudo leer el archivo cargado");
  }
  if (file.size <= 0) throw crearError("El archivo esta vacio");
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw crearError("El archivo supera el limite de 15 MB");
  }
  const extension = extensionPermitida(file);
  if (!extension) {
    throw crearError("Solo se permiten archivos JPG, JPEG, PNG, WEBP o PDF");
  }
  return extension;
};

const calcularSha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const obtenerCarpetaRelativa = (fecha = new Date()) => {
  const year = String(fecha.getFullYear());
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  return path.join(year, month);
};

const serializarFactura = (value, { incluirRuta = false } = {}) => {
  const factura = typeof value?.toJSON === "function" ? value.toJSON() : value;
  if (!factura) return null;
  const { rutaArchivo, ...segura } = factura;
  return {
    ...segura,
    ...(incluirRuta ? { rutaArchivo } : {}),
    sizeBytes: Number(factura.sizeBytes || 0),
    subtotal: factura.subtotal === null ? null : Number(factura.subtotal),
    impuestos: factura.impuestos === null ? null : Number(factura.impuestos),
    total: factura.total === null ? null : Number(factura.total),
  };
};

const buscarDuplicado = async (sha256) => {
  const factura = await FacturaFisica.findOne({
    where: { sha256 },
    attributes: [
      "id",
      "nombreArchivoOriginal",
      "estado",
      "proveedor",
      "numeroFactura",
      "createdAt",
    ],
    order: [["createdAt", "ASC"], ["id", "ASC"]],
  });
  return serializarFactura(factura);
};

const crearFactura = async ({ file, body = {}, usuarioId }) => {
  const usuarioCargaId = normalizarId(usuarioId, "El usuario");
  const extension = validarArchivo(file);
  const sha256 = calcularSha256(file.buffer);
  const facturaExistente = await buscarDuplicado(sha256);

  if (facturaExistente) {
    throw crearError("Este documento ya fue registrado.", 409, {
      duplicado: true,
      facturaExistente,
    });
  }

  const carpetaRelativa = obtenerCarpetaRelativa();
  const carpeta = path.join(STORAGE_ROOT, carpetaRelativa);
  const nombreArchivoGuardado = `${crypto.randomUUID()}${extension}`;
  const rutaArchivo = path.join(carpeta, nombreArchivoGuardado);

  await fs.mkdir(carpeta, { recursive: true });
  await fs.writeFile(rutaArchivo, file.buffer, { flag: "wx" });

  const factura = await FacturaFisica.create({
    nombreArchivoOriginal: path.basename(file.originalname || "documento"),
    nombreArchivoGuardado,
    mimeType: file.mimetype,
    extension: extension.replace(".", ""),
    sizeBytes: file.size,
    sha256,
    rutaArchivo,
    estado: "CARGADA",
    origenCarga: normalizarOrigenCarga(body.origenCarga),
    usuarioCargaId,
    creadoPorId: usuarioCargaId,
    proveedor: normalizarTexto(body.proveedor, 255),
    rucProveedor: normalizarTexto(body.rucProveedor, 30),
    numeroFactura: normalizarTexto(body.numeroFactura, 80),
    fechaEmision: normalizarFechaIso(body.fechaEmision),
    subtotal: normalizarMonto(body.subtotal, "El subtotal"),
    impuestos: normalizarMonto(body.impuestos, "Los impuestos"),
    total: normalizarMonto(body.total, "El total"),
    observacion: normalizarTexto(body.observacion, 1000),
    datosAdicionales: normalizarDatosAdicionales(body.datosAdicionales),
  });

  return obtenerFactura(factura.id);
};

const construirWhereListado = (query = {}) => {
  const where = {};
  const fechaInicio = normalizarFechaIso(query.fechaInicio);
  const fechaFin = normalizarFechaIso(query.fechaFin);
  const estado = String(query.estado || "").trim().toUpperCase();
  const usuarioCargaId = query.usuarioCargaId
    ? normalizarId(query.usuarioCargaId, "El usuario de carga")
    : null;
  const busqueda = String(query.busqueda || "").trim();

  if (fechaInicio || fechaFin) {
    where.createdAt = {};
    if (fechaInicio) where.createdAt[Op.gte] = new Date(`${fechaInicio}T00:00:00.000-05:00`);
    if (fechaFin) where.createdAt[Op.lte] = new Date(`${fechaFin}T23:59:59.999-05:00`);
  }
  if (estado && estado !== "TODOS") where.estado = normalizarEstado(estado);
  if (usuarioCargaId) where.usuarioCargaId = usuarioCargaId;
  if (busqueda) {
    where[Op.or] = [
      { nombreArchivoOriginal: { [Op.iLike]: `%${busqueda}%` } },
      { proveedor: { [Op.iLike]: `%${busqueda}%` } },
      { rucProveedor: { [Op.iLike]: `%${busqueda}%` } },
      { numeroFactura: { [Op.iLike]: `%${busqueda}%` } },
    ];
  }

  return where;
};

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const obtenerResumen = async (where) => {
  const conteos = await FacturaFisica.count({
    where,
    group: ["estado"],
  });
  const porEstado = Object.fromEntries(
    ESTADOS.map((estado) => [estado, 0]),
  );
  conteos.forEach((item) => {
    porEstado[item.estado] = Number(item.count || 0);
  });
  return {
    totalDocumentos: Object.values(porEstado).reduce((suma, count) => suma + count, 0),
    cargadas: porEstado.CARGADA,
    pendientesRevision: porEstado.PENDIENTE_REVISION,
    confirmadas: porEstado.CONFIRMADA,
    anuladas: porEstado.ANULADA,
    porEstado,
  };
};

const listarFacturas = async (query = {}) => {
  const page = parsePositiveInt(query.page || query.pagina, 1, 100000);
  const limit = parsePositiveInt(query.limit || query.limite, 20, 100);
  const where = construirWhereListado(query);

  const [resultado, resumen] = await Promise.all([
    FacturaFisica.findAndCountAll({
      where,
      include: includeUsuarios,
      distinct: true,
      limit,
      offset: (page - 1) * limit,
      order: [["createdAt", "DESC"], ["id", "DESC"]],
    }),
    obtenerResumen(where),
  ]);

  return {
    ok: true,
    facturas: resultado.rows.map((factura) => serializarFactura(factura)),
    resumen,
    paginacion: {
      page,
      limit,
      total: resultado.count,
      totalPaginas: Math.max(1, Math.ceil(resultado.count / limit)),
    },
  };
};

const obtenerFactura = async (idValue, options = {}) => {
  const id = normalizarId(idValue);
  const factura = await FacturaFisica.findByPk(id, {
    include: includeUsuarios,
  });
  if (!factura) throw crearError("Factura fisica no encontrada", 404);
  return serializarFactura(factura, options);
};

const actualizarFactura = async (idValue, payload = {}, usuarioId) => {
  const id = normalizarId(idValue);
  const actualizadoPorId = normalizarId(usuarioId, "El usuario actualizador");
  const factura = await FacturaFisica.findByPk(id);
  if (!factura) throw crearError("Factura fisica no encontrada", 404);
  if (factura.estado === "ANULADA") {
    throw crearError("No se puede editar una factura anulada", 409);
  }

  const update = {
    proveedor: normalizarTexto(payload.proveedor, 255),
    rucProveedor: normalizarTexto(payload.rucProveedor, 30),
    numeroFactura: normalizarTexto(payload.numeroFactura, 80),
    fechaEmision: normalizarFechaIso(payload.fechaEmision),
    subtotal: normalizarMonto(payload.subtotal, "El subtotal"),
    impuestos: normalizarMonto(payload.impuestos, "Los impuestos"),
    total: normalizarMonto(payload.total, "El total"),
    observacion: normalizarTexto(payload.observacion, 1000),
    datosAdicionales: normalizarDatosAdicionales(payload.datosAdicionales),
    actualizadoPorId,
  };

  if (payload.estado !== undefined) {
    update.estado = normalizarEstado(payload.estado, ESTADOS_EDITABLES);
  }

  await factura.update(update);
  return obtenerFactura(id);
};

const anularFactura = async (idValue, payload = {}, usuarioId) => {
  const id = normalizarId(idValue);
  const anuladoPorId = normalizarId(usuarioId, "El usuario anulador");
  const motivo = normalizarTexto(payload.motivo, 1000);
  if (!motivo) throw crearError("El motivo de anulacion es obligatorio");

  const factura = await FacturaFisica.findByPk(id);
  if (!factura) throw crearError("Factura fisica no encontrada", 404);
  if (factura.estado === "ANULADA") {
    throw crearError("La factura ya se encuentra anulada", 409);
  }

  await factura.update({
    estado: "ANULADA",
    motivoAnulacion: motivo,
    anuladoPorId,
    anuladoEn: new Date(),
    actualizadoPorId: anuladoPorId,
  });

  return obtenerFactura(id);
};

const obtenerArchivoFactura = async (idValue) => {
  const factura = await obtenerFactura(idValue, { incluirRuta: true });
  const rutaAbsoluta = path.resolve(factura.rutaArchivo);
  const storageAbsoluto = path.resolve(STORAGE_ROOT);

  if (!rutaAbsoluta.startsWith(`${storageAbsoluto}${path.sep}`)) {
    throw crearError("La ruta del archivo no es segura", 409);
  }

  try {
    await fs.access(rutaAbsoluta);
  } catch {
    throw crearError("El archivo fisico no se encuentra disponible", 404);
  }

  return {
    rutaAbsoluta,
    mimeType: factura.mimeType,
    nombreArchivoOriginal: factura.nombreArchivoOriginal,
  };
};

module.exports = {
  ESTADOS,
  MAX_FILE_SIZE_BYTES,
  MIME_EXTENSIONS,
  STORAGE_ROOT,
  actualizarFactura,
  anularFactura,
  crearFactura,
  listarFacturas,
  obtenerArchivoFactura,
  obtenerFactura,
  validarArchivo,
};
