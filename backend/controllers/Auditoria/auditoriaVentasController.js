const Agencia = require("../../models/Agencia");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const Cliente = require("../../models/Cliente");
const ConciliacionModeloCelular = require("../../models/ConciliacionModeloCelular");
const ConciliacionModeloTv = require("../../models/ConciliacionModeloTv");
const Dispositivo = require("../../models/Dispositivo");
const DispositivoMarca = require("../../models/DispositivoMarca");
const FormaPago = require("../../models/FormaPago");
const Marca = require("../../models/Marca");
const Modelo = require("../../models/Modelo");
const Obsequio = require("../../models/Obsequio");
const Origen = require("../../models/Origen");
const Usuario = require("../../models/Usuario");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Venta = require("../../models/Venta");

const { Op } = require("sequelize");
const DetalleVenta = require("../../models/DetalleVenta");
const { sequelize } = require("../../config/db");
const VentaObsequio = require("../../models/VentaObsequio");

const PYTHON_TIMEOUT_MS = Number(process.env.PYTHON_TIMEOUT_MS || 120000);

exports.obtenerReporteAuditoria = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
  vendedorId,
  modeloId,
  cierreCaja,
  origenId,
  dispositivoId,
  estado,
}) => {
  const whereVenta = {};

  // 🔹 Filtro por fecha
  if (fechaInicio && fechaFin) {
    whereVenta.fecha = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    whereVenta.fecha = { [Op.gte]: new Date(`${fechaInicio}T00:00:00`) };
  } else if (fechaFin) {
    whereVenta.fecha = { [Op.lte]: new Date(`${fechaFin}T23:59:59`) };
  }

  const estadoActivo = normalizarEstadoActivo(estado);
  if (estadoActivo !== null) {
    whereVenta.activo = estadoActivo;
  }

  const whereDetalleVenta = {};
  if (cierreCaja && cierreCaja !== "todos") {
    whereDetalleVenta.cierreCaja = cierreCaja;
  }

  if (modeloId && modeloId !== "todos") {
    whereDetalleVenta.modeloId = modeloId;
  }

  const includeUsuarioAgencia = {
    model: UsuarioAgencia,
    as: "usuarioAgencia",
    attributes: ["id"],
    required: !!agenciaId || !!vendedorId, // INNER JOIN si hay filtro
    include: [
      {
        model: Usuario,
        as: "usuario",
        attributes: ["id", "nombre"],
        ...(vendedorId &&
          vendedorId !== "todos" && {
            where: { id: vendedorId },
          }),
      },
      {
        model: Agencia,
        as: "agencia",
        attributes: ["nombre"],
        ...(agenciaId &&
          agenciaId !== "todas" && {
            where: { id: agenciaId },
          }),
      },
    ],
  };

  return await Venta.findAll({
    where: whereVenta,
    attributes: ["id", "fecha", "validada", "observacion", "activo"],
    order: [["fecha", "ASC"]],
    include: [
      includeUsuarioAgencia,
      {
        model: Cliente,
        as: "cliente",
        attributes: ["cedula", "cliente"],
      },
      {
        model: Origen,
        as: "origen",
        attributes: ["nombre"],
        required: !!origenId && origenId !== "todos",
        ...(origenId &&
          origenId !== "todos" && {
            where: { id: origenId },
          }),
      },
      {
        model: DetalleVenta,
        as: "detalleVenta",
        attributes: [
          "id",
          "modeloId",
          "precioUnitario",
          "precioVenta",
          "precioVendedor",
          "entrada",
          "margen",
          "alcance",
          "contrato",
          "cierreCaja",
          "formaPagoId",
          "referenciaPdf",
        ],
        ...((Object.keys(whereDetalleVenta).length > 0 ||
          (dispositivoId && dispositivoId !== "todos")) && {
          where: whereDetalleVenta,
          required: true,
        }),
        include: [
          { model: Modelo, as: "modelo", attributes: ["nombre"] },
          {
            model: DispositivoMarca,
            as: "dispositivoMarca",
            attributes: ["id"],
            required: !!dispositivoId && dispositivoId !== "todos",
            include: [
              {
                model: Dispositivo,
                as: "dispositivo",
                attributes: ["nombre"],
                required: !!dispositivoId && dispositivoId !== "todos",
                ...(dispositivoId &&
                  dispositivoId !== "todos" && {
                    where: { id: dispositivoId },
                  }),
              },
              { model: Marca, as: "marca", attributes: ["nombre"] },
            ],
          },
          { model: FormaPago, as: "formaPago", attributes: ["nombre"] },
        ],
      },
      {
        model: VentaObsequio,
        as: "obsequiosVenta",
        attributes: ["id"],
        include: [{ model: Obsequio, as: "obsequio", attributes: ["nombre"] }],
      },
    ],
  });
};

exports.obtenerReporte = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
  vendedorId,
  observacion,
}) => {
  /* ===============================
     WHERE VENTA
  =============================== */
  const whereVenta = {
    activo: true,
  };

  // 🔹 Filtro por fecha
  if (fechaInicio && fechaFin) {
    whereVenta.fecha = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    whereVenta.fecha = {
      [Op.gte]: new Date(`${fechaInicio}T00:00:00`),
    };
  } else if (fechaFin) {
    whereVenta.fecha = {
      [Op.lte]: new Date(`${fechaFin}T23:59:59`),
    };
  }

  // 🔹 Filtro por observación (búsqueda parcial, compatible con datalist)
  if (observacion && observacion !== "todas") {
    whereVenta.observacion = {
      [Op.iLike]: `%${observacion}%`, // PostgreSQL
    };
  }

  /* ===============================
     INCLUDE USUARIO-AGENCIA
  =============================== */
  const includeUsuarioAgencia = {
    model: UsuarioAgencia,
    as: "usuarioAgencia",
    attributes: ["id"],
    required: !!agenciaId || !!vendedorId,
    include: [
      {
        model: Usuario,
        as: "usuario",
        attributes: ["id", "nombre"],
        ...(vendedorId &&
          vendedorId !== "todos" && {
            where: { id: vendedorId },
          }),
      },
      {
        model: Agencia,
        as: "agencia",
        attributes: ["nombre"],
        ...(agenciaId &&
          agenciaId !== "todas" && {
            where: { id: agenciaId },
          }),
      },
    ],
  };

  /* ===============================
     QUERY FINAL
  =============================== */
  return await Venta.findAll({
    where: whereVenta,
    attributes: ["id", "fecha", "validada", "observacion", "activo"],
    order: [["fecha", "ASC"]],
    include: [
      includeUsuarioAgencia,
      {
        model: Cliente,
        as: "cliente",
        attributes: ["cliente"],
      },
      {
        model: Origen,
        as: "origen",
        attributes: ["nombre"],
      },
      {
        model: DetalleVenta,
        as: "detalleVenta",
        attributes: [
          "precioUnitario",
          "precioVenta",
          "precioVendedor",
          "entrada",
          "margen",
          "costo" ,
          "alcance",
          "contrato",
          "cierreCaja",
        ],
        include: [
          {
            model: Modelo,
            as: "modelo",
            attributes: ["nombre"],
          },
          {
            model: DispositivoMarca,
            as: "dispositivoMarca",
            attributes: ["id"],
            include: [
              {
                model: Dispositivo,
                as: "dispositivo",
                attributes: ["nombre"],
              },
              {
                model: Marca,
                as: "marca",
                attributes: ["nombre"],
              },
            ],
          },
          {
            model: FormaPago,
            as: "formaPago",
            attributes: ["nombre"],
          },
        ],
      },
      {
        model: VentaObsequio,
        as: "obsequiosVenta",
        attributes: ["id"],
        include: [
          {
            model: Obsequio,
            as: "obsequio",
            attributes: ["nombre"],
          },
        ],
      },
    ],
  });
};

exports.obtenerReporteGerencia = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
  vendedorId,
  cierreCaja,
}) => {
  const whereVenta = {
    activo: true,
  };

  if (fechaInicio && fechaFin) {
    whereVenta.fecha = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    whereVenta.fecha = { [Op.gte]: new Date(`${fechaInicio}T00:00:00`) };
  } else if (fechaFin) {
    whereVenta.fecha = { [Op.lte]: new Date(`${fechaFin}T23:59:59`) };
  }

  const whereDetalleVenta = {};

  if (cierreCaja && cierreCaja !== "todos") {
    whereDetalleVenta.cierreCaja = cierreCaja;
  }

  const agenciasIds = normalizarIds(agenciaId);
  const vendedoresIds = normalizarIds(vendedorId);

  const includeUsuarioAgencia = {
    model: UsuarioAgencia,
    as: "usuarioAgencia",
    attributes: ["id"],
    required: !!agenciasIds || !!vendedoresIds,
    include: [
      {
        model: Usuario,
        as: "usuario",
        attributes: ["id", "nombre"],
        ...(vendedoresIds && {
          where: {
            id: {
              [Op.in]: vendedoresIds,
            },
          },
        }),
      },
      {
        model: Agencia,
        as: "agencia",
        attributes: ["id", "nombre"],
        ...(agenciasIds && {
          where: {
            id: {
              [Op.in]: agenciasIds,
            },
          },
        }),
      },
    ],
  };

  return await Venta.findAll({
    where: whereVenta,
    attributes: ["id", "fecha", "validada", "observacion", "activo", "semana"],
    order: [["fecha", "ASC"]],
    include: [
      includeUsuarioAgencia,
      {
        model: Cliente,
        as: "cliente",
        attributes: ["cliente"],
      },
      {
        model: Origen,
        as: "origen",
        attributes: ["nombre"],
      },
      {
        model: DetalleVenta,
        as: "detalleVenta",
        attributes: [
          "precioUnitario",
          "precioVenta",
          "precioVendedor",
          "entrada",
          "alcance",
          "contrato",
          "cierreCaja",
          "margen",
        ],
        ...(Object.keys(whereDetalleVenta).length > 0 && {
          where: whereDetalleVenta,
          required: true,
        }),
        include: [
          { model: Modelo, as: "modelo", attributes: ["nombre"] },
          {
            model: DispositivoMarca,
            as: "dispositivoMarca",
            attributes: ["id"],
            include: [
              { model: Dispositivo, as: "dispositivo", attributes: ["nombre"] },
              { model: Marca, as: "marca", attributes: ["nombre"] },
            ],
          },
          { model: FormaPago, as: "formaPago", attributes: ["nombre"] },
        ],
      },
      {
        model: VentaObsequio,
        as: "obsequiosVenta",
        attributes: ["id"],
        include: [{ model: Obsequio, as: "obsequio", attributes: ["nombre"] }],
      },
    ],
  });
};

const normalizarIds = (valor) => {
  if (!valor || valor === "todas" || valor === "todos") return null;

  if (Array.isArray(valor)) {
    return valor.map(Number).filter(Boolean);
  }

  return String(valor)
    .split(",")
    .map(Number)
    .filter(Boolean);
};

const normalizarEstadoActivo = (estado) => {
  if (!estado || estado === "todos") return null;

  const valor = String(estado).toLowerCase();

  if (["activo", "activa", "true", "1"].includes(valor)) return true;
  if (["desactivada", "desactivado", "inactivo", "inactiva", "false", "0"].includes(valor)) {
    return false;
  }

  return null;
};

const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const esFormaPagoCredito = (fila) =>
  Number(fila.formaPagoId) === 1 || normalizarTexto(fila.formaPago).includes("credito");

const esDispositivoDelTipoPdf = (fila, tipo) => {
  const dispositivo = normalizarTexto(fila.tipo);

  if (tipo === "TV") {
    return (
      dispositivo === "tv" ||
      dispositivo.includes("televisor") ||
      dispositivo.includes("television")
    );
  }

  if (tipo === "CELULAR") {
    return (
      dispositivo.includes("celular") ||
      dispositivo.includes("telefono") ||
      dispositivo.includes("smartphone")
    );
  }

  return true;
};

const contarDispositivosCreditoRve = ({ tipo, ventas }) =>
  exports
    .formatearReporte(ventas)
    .filter((fila) => esFormaPagoCredito(fila) && esDispositivoDelTipoPdf(fila, tipo))
    .length;

const normalizarCodigoPdf = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const toNumero = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
};

const normalizarFecha = (value) => {
  if (!value) return "";
  const raw = String(value).trim();

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const numericDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+.*)?$/);
  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    const year = numericDate[3].length === 2 ? `20${numericDate[3]}` : numericDate[3];
    const isDayFirst = first > 12 && second <= 12;
    const monthNumber = isDayFirst ? second : first;
    const dayNumber = isDayFirst ? first : second;

    if (monthNumber >= 1 && monthNumber <= 12 && dayNumber >= 1 && dayNumber <= 31) {
      const day = String(dayNumber).padStart(2, "0");
      const month = String(monthNumber).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return raw;
};

const levenshtein = (left, right) => {
  const a = normalizarTexto(left);
  const b = normalizarTexto(right);

  if (!a && !b) return 0;
  if (!a || !b) return Math.max(a.length, b.length);

  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
};

const tokenizarTexto = (value) =>
  normalizarTexto(value)
    .split(" ")
    .filter(Boolean);

const normalizarTextoOrdenado = (value) => tokenizarTexto(value).sort().join(" ");

const similitudPorTokens = (left, right) => {
  const tokensA = new Set(tokenizarTexto(left));
  const tokensB = new Set(tokenizarTexto(right));

  if (!tokensA.size && !tokensB.size) return 0;

  let interseccion = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) interseccion += 1;
  });

  const totalUnico = new Set([...tokensA, ...tokensB]).size;
  return Math.round((interseccion / totalUnico) * 100);
};

const similitudPorNombreIncompleto = (left, right) => {
  const tokensA = new Set(tokenizarTexto(left));
  const tokensB = new Set(tokenizarTexto(right));
  const minimoTokens = Math.min(tokensA.size, tokensB.size);

  if (minimoTokens < 2) return 0;

  let interseccion = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) interseccion += 1;
  });

  const faltantes = Math.max(tokensA.size, tokensB.size) - interseccion;
  return faltantes <= 1 && interseccion === minimoTokens ? 100 : 0;
};

const similitudTexto = (left, right) => {
  const a = normalizarTexto(left);
  const b = normalizarTexto(right);
  const maxLength = Math.max(a.length, b.length);

  if (!maxLength) return 0;

  const similitudOriginal = Math.round((1 - levenshtein(a, b) / maxLength) * 100);
  const aOrdenado = normalizarTextoOrdenado(left);
  const bOrdenado = normalizarTextoOrdenado(right);
  const maxLengthOrdenado = Math.max(aOrdenado.length, bOrdenado.length);
  const similitudOrdenada = maxLengthOrdenado
    ? Math.round((1 - levenshtein(aOrdenado, bOrdenado) / maxLengthOrdenado) * 100)
    : 0;

  return Math.max(
    similitudOriginal,
    similitudOrdenada,
    similitudPorTokens(left, right),
    similitudPorNombreIncompleto(left, right),
  );
};

const getPythonBin = () =>
  process.env.PYTHON_BIN ||
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

const runPythonProcessor = ({ tipo, inputDir, outputFile }) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "python_processors",
      "main_processor.py",
    );
    const child = spawn(
      getPythonBin(),
      [scriptPath, "--tipo", tipo, "--input", inputDir, "--output", outputFile],
      {
        cwd: path.join(__dirname, "..", ".."),
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

      resolve({ stdout, stderr });
    });
  });

const readJsonIfExists = async (filePath) => {
  if (!fsSync.existsSync(filePath)) return null;
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
};

const getModeloMapeado = async ({ tipo, codigoPdf }) => {
  const codigoNormalizado = normalizarCodigoPdf(codigoPdf);
  const ModeloMapeo = tipo === "TV" ? ConciliacionModeloTv : ConciliacionModeloCelular;

  if (!codigoNormalizado) return null;

  return ModeloMapeo.findOne({
    where: {
      codigoNormalizado,
      estado: "MAPEADO",
    },
  });
};

const getValorVentasPdf = (record) => {
  const detectado =
    record.valor_ventas_detectado === true ||
    record.precio_vendedor_detectado === true;

  if (!detectado) return null;

  return toNumero(record.valor_ventas ?? record.precio_vendedor ?? record.precio);
};

const flattenVentasAuditoria = (ventas) => {
  const filas = [];

  ventas.forEach((venta) => {
    venta.detalleVenta?.forEach((detalle) => {
      filas.push({
        venta,
        detalle,
        id: venta.id,
        detalleVentaId: detalle.id,
        modeloId: detalle.modeloId,
        fecha: normalizarFecha(venta.fecha),
        cliente: venta.cliente?.cliente || "",
        referenciaPdf: detalle.referenciaPdf || "",
        precioVendedor: toNumero(detalle.precioVendedor),
        entrada: toNumero(detalle.entrada),
      });
    });
  });

  return filas;
};

const crearFilaPdfSinMatch = ({ record, tipo, mapeo, observacionError }) => ({
  id: null,
  activo: false,
  fecha: "",
  local: "",
  origen: record.origen || "",
  nombre: "",
  cedula: "",
  vendedor: "",
  tipo,
  marca: "",
  modelo: mapeo?.modeloRveNombre || record.modelo_normalizado || "",
  formaPago: "",
  precioVenta: "",
  precioVendedor: "",
  entrada: "",
  alcance: "",
  observaciones: "",
  contrato: record.factura || "",
  referenciaPdf: tipo === "TV" ? record.codigo_pdf || "" : record.imei || "",
  clientePdf: record.cliente || "",
  fechaPdf: normalizarFecha(record.fecha),
  precioVendedorPdf: getValorVentasPdf(record),
  entradaPdf:
    record.entrada_detectada === false ? null : toNumero(record.entrada),
  similitudCliente: 0,
  observacionError,
});

const construirObservacionesAuditoria = ({ record, ventaMatch, tipo }) => {
  const errores = [];
  const precioDetectado =
    record.valor_ventas_detectado === true ||
    record.precio_vendedor_detectado === true;
  const entradaDetectada = record.entrada_detectada !== false;
  const precioPdf = getValorVentasPdf(record);
  const entradaPdf = entradaDetectada ? toNumero(record.entrada) : null;
  const precioRve = ventaMatch.precioVendedor;
  const entradaRve = ventaMatch.entrada;

  if (!precioDetectado || precioPdf === null) {
    errores.push("VALOR_VENTAS_PDF_NO_DETECTADO");
  } else if (precioRve === null || Math.abs(precioPdf - precioRve) > 0.01) {
    errores.push(
      `PRECIO_VENDEDOR_DIFERENTE VENTAS_PDF:${precioPdf ?? "-"} RVE:${precioRve ?? "-"}`,
    );
  }

  if (!entradaDetectada || entradaPdf === null) {
    errores.push("ENTRADA_PDF_NO_DETECTADA");
  } else if (entradaRve === null || Math.abs(entradaPdf - entradaRve) > 0.01) {
    errores.push(`ENTRADA_DIFERENTE PDF:${entradaPdf} RVE:${entradaRve ?? "-"}`);
  }

  if (tipo === "CELULAR" && !record.imei) {
    errores.push("IMEI_PDF_NO_DETECTADO");
  }

  return errores.length ? errores.join("; ") : "OK";
};

const auditarRegistrosPdf = async ({ tipo, registrosPdf, ventas }) => {
  const ventasFlatten = flattenVentasAuditoria(ventas);
  const resultadosBase = exports.formatearReporte(ventas).map((fila) => ({
    ...fila,
    referenciaPdf: fila.referenciaPdf || "",
    clientePdf: "",
    fechaPdf: "",
    precioVendedorPdf: null,
    entradaPdf: null,
    similitudCliente: "",
    observacionError: "NO_EN_PDF",
  }));
  const resultadosPorDetalle = new Map(
    resultadosBase.map((fila) => [Number(fila.detalleVentaId), fila]),
  );
  const filasPdfSinVenta = [];
  const errores = [];
  const detallesCelularAsignados = new Set();

  for (const record of registrosPdf) {
    const codigoPdf = record.codigo_pdf || "";
    const mapeo = await getModeloMapeado({ tipo, codigoPdf });

    if (!mapeo?.modeloRveId) {
      filasPdfSinVenta.push(
        crearFilaPdfSinMatch({
          record,
          tipo,
          mapeo,
          observacionError: `MODELO_NO_MAPEADO: ${codigoPdf || "SIN_CODIGO"}`,
        }),
      );
      continue;
    }

    const fechaPdf = normalizarFecha(record.fecha);
    const candidatos = ventasFlatten
      .filter((venta) => Number(venta.modeloId) === Number(mapeo.modeloRveId))
      .map((venta) => ({
        ...venta,
        fechaOk: fechaPdf ? venta.fecha === fechaPdf : false,
        similitudCliente: similitudTexto(record.cliente, venta.cliente),
      }))
      .sort((a, b) => b.similitudCliente - a.similitudCliente);

    const candidatosDisponibles =
      tipo === "CELULAR"
        ? candidatos.filter(
            (venta) => !detallesCelularAsignados.has(Number(venta.detalleVentaId)),
          )
        : candidatos;

    const matchPorImei =
      tipo === "CELULAR" && record.imei
        ? candidatosDisponibles.find(
            (venta) =>
              venta.fechaOk &&
              venta.similitudCliente >= 85 &&
              normalizarCodigoPdf(venta.referenciaPdf) ===
                normalizarCodigoPdf(record.imei),
          )
        : null;

    const match = matchPorImei || candidatosDisponibles.find(
      (venta) => venta.fechaOk && venta.similitudCliente >= 85,
    );

    if (!match) {
      const mejor = candidatosDisponibles[0] || candidatos[0];
      const detalleError = [];

      if (!fechaPdf) detalleError.push("FECHA_PDF_NO_DETECTADA");
      else if (!candidatos.some((venta) => venta.fechaOk)) {
        detalleError.push(`FECHA_NO_COINCIDE PDF:${fechaPdf}`);
      }

      if (!mejor || mejor.similitudCliente < 85) {
        detalleError.push(
          `CLIENTE_NO_COINCIDE similitud:${mejor?.similitudCliente || 0}%`,
        );
      }

      if (
        tipo === "CELULAR" &&
        candidatos.length > 0 &&
        candidatosDisponibles.length === 0
      ) {
        detalleError.push("DETALLE_RVE_YA_ASIGNADO_A_OTRO_IMEI");
      }

      filasPdfSinVenta.push(
        crearFilaPdfSinMatch({
          record,
          tipo,
          mapeo,
          observacionError: detalleError.join("; ") || "VENTA_NO_ENCONTRADA",
        }),
      );
      continue;
    }

    if (tipo === "CELULAR") {
      detallesCelularAsignados.add(Number(match.detalleVentaId));
    }

    if (tipo === "CELULAR" && record.imei) {
      await DetalleVenta.update(
        { referenciaPdf: record.imei },
        { where: { id: match.detalleVentaId } },
      );
    }

    if (tipo === "TV" && codigoPdf) {
      await DetalleVenta.update(
        { referenciaPdf: codigoPdf },
        { where: { id: match.detalleVentaId } },
      );
    }

    const filaBase =
      resultadosPorDetalle.get(Number(match.detalleVentaId)) ||
      exports.formatearReporte([match.venta]).find(
        (venta) => venta.detalleVentaId === match.detalleVentaId,
      );
    const observacionError = construirObservacionesAuditoria({
      record,
      ventaMatch: match,
      tipo,
    });

    resultadosPorDetalle.set(Number(match.detalleVentaId), {
      ...filaBase,
      referenciaPdf:
        tipo === "TV"
          ? codigoPdf || filaBase?.referenciaPdf || ""
          : record.imei || filaBase?.referenciaPdf || "",
      clientePdf: record.cliente || "",
      fechaPdf,
      precioVendedorPdf: getValorVentasPdf(record),
      entradaPdf:
        record.entrada_detectada === false ? null : toNumero(record.entrada),
      similitudCliente: match.similitudCliente,
      observacionError,
    });
  }

  return {
    resultados: [...resultadosPorDetalle.values(), ...filasPdfSinVenta],
    errores,
  };
};


const obtenerDiaSemana = (fecha) => {
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];

  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

  return dias[d.getDay()];
};

exports.formatearReporte = (ventas) => {
  // console.log(ventas)
  const filas = [];

  ventas.forEach((venta) => {
    venta.detalleVenta?.forEach((detalle) => {
      const fechaISO = venta.fecha
        ? normalizarFecha(venta.fecha)
        : "";

      filas.push({
        id: venta.id,
        detalleVentaId: detalle.id,
        modeloId: detalle.modeloId,
        activo: venta.activo,
        semana: venta.semana || null,
        dia: obtenerDiaSemana(new Date(venta.fecha)),
        valorAcumulado: null,

        fecha: fechaISO,

        local: venta.usuarioAgencia?.agencia?.nombre || "",
        origen: venta.origen?.nombre || "",
        nombre: venta.cliente?.cliente || "",
        cedula: venta.cliente?.cedula || "",

        vendedor: venta.usuarioAgencia?.usuario?.nombre || "",

        tipo: detalle.dispositivoMarca?.dispositivo?.nombre || "",
        marca: detalle.dispositivoMarca?.marca?.nombre || "",
        modelo: detalle.modelo?.nombre || "",
        referenciaPdf: detalle.referenciaPdf || "",
        formaPagoId: detalle.formaPagoId || null,
        formaPago: detalle.formaPago?.nombre || "",
        valorCorregido: detalle.precioUnitario || "",
        precioSistema: detalle.precioUnitario || "",
        precioVenta: detalle.precioVenta || detalle.precioVendedor || "",
        precioVendedor: detalle.precioVendedor || "",
        margen: detalle.margen || "",
        costo : detalle.costo || "" , 

        cierreCaja: detalle.cierreCaja || "",

        entrada: detalle.entrada || "0",
        alcance: detalle.alcance || "0",

        observaciones: venta.observacion || "",
        contrato: detalle.contrato || "",
        validada: venta.validada || "",
      });
    });
  });

  return filas;
};

exports.actualizarVentaCompleta = async (req, res) => {
  const { id } = req.params; // id de la venta
  const datosVenta = req.body; // objeto completo con relaciones

  try {
    await sequelize.transaction(async (t) => {
      // 1️⃣ Actualizar datos principales de la venta
      const venta = await Venta.findByPk(id, { transaction: t });
      if (!venta)
        return res.status(404).json({ ok: false, msg: "Venta no encontrada" });

      await venta.update(datosVenta, { transaction: t });

      // 2️⃣ Actualizar detalles de venta
      if (datosVenta.detalleVentas && datosVenta.detalleVentas.length > 0) {
        for (const detalle of datosVenta.detalleVentas) {
          if (detalle.id) {
            // actualizar si ya existe
            await DetalleVenta.update(detalle, {
              where: { id: detalle.id },
              transaction: t,
            });
          } else {
            // crear si no existe
            await DetalleVenta.create(
              { ...detalle, entregaId: id },
              { transaction: t },
            );
          }
        }
      }

      // 3️⃣ Actualizar obsequios de venta
      if (datosVenta.obsequiosVenta && datosVenta.obsequiosVenta.length > 0) {
        for (const obsequio of datosVenta.obsequiosVenta) {
          if (obsequio.id) {
            await VentaObsequio.update(obsequio, {
              where: { id: obsequio.id },
              transaction: t,
            });
          } else {
            await VentaObsequio.create(
              { ...obsequio, entregaId: id },
              { transaction: t },
            );
          }
        }
      }
    });

    res.json({ ok: true, msg: "Venta actualizada correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ ok: false, msg: "Error al actualizar la venta", error });
  }
};

exports.obtenerVentaPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const venta = await Venta.findByPk(id, {
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          include: [
            { model: Usuario, as: "usuario", attributes: ["id", "nombre"] },
            { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
          ],
        },
        {
          model: Cliente,
          as: "cliente",
          attributes: ["id", "cliente", "cedula", "telefono"],
        },
        { model: Origen, as: "origen", attributes: ["id", "nombre"] },
        {
          model: DetalleVenta,
          as: "detalleVenta",
          include: [
            { model: Modelo, as: "modelo", attributes: ["id", "nombre"] },
            {
              model: DispositivoMarca,
              as: "dispositivoMarca",
              include: [
                {
                  model: Dispositivo,
                  as: "dispositivo",
                  attributes: ["id", "nombre"],
                },
                { model: Marca, as: "marca", attributes: ["id", "nombre"] },
              ],
            },
            { model: FormaPago, as: "formaPago", attributes: ["id", "nombre"] },
          ],
        },
        {
          model: VentaObsequio,
          as: "obsequiosVenta",
          include: [
            { model: Obsequio, as: "obsequio", attributes: ["id", "nombre"] },
          ],
        },
      ],
    });

    if (!venta) {
      return res.status(404).json({ ok: false, msg: "Venta no encontrada" });
    }

    // Formateamos para el frontend
    const ventaFormateada = {
      id: venta.id,
      fecha: venta.fecha,
      dia: venta.dia,
      local: venta.local,
      vendedor: venta.vendedor,
      contrato: venta.contrato,
      entrada: venta.entrada,
      alcance: venta.alcance,
      pvp: venta.pvp,
      observacion: venta.observacion,
      usuarioAgencia: {
        id: venta.usuarioAgencia?.id,
        usuario: {
          id: venta.usuarioAgencia?.usuario?.id,
          nombre: venta.usuarioAgencia?.usuario?.nombre,
        },
        agencia: {
          id: venta.usuarioAgencia?.agencia?.id,
          nombre: venta.usuarioAgencia?.agencia?.nombre,
        },
      },
      cliente: {
        id: venta.cliente?.id,
        nombre: venta.cliente?.cliente, // atención: en tu include pusiste "cliente" como atributo
        cedula: venta.cliente?.cedula,
        telefono: venta.cliente?.telefono,
      },
      origen: { id: venta.origen?.id, nombre: venta.origen?.nombre },
      detalleVenta: venta.detalleVenta || [],
      obsequiosVenta: venta.obsequiosVenta || [],
    };

    return res.json({ ok: true, venta: ventaFormateada });
  } catch (error) {
    console.error("Error obteniendo venta por ID:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

exports.auditarVentasDesdePdf = async (req, res) => {
  const tempRoot = req.auditoriaTempRoot;

  try {
    const tipo = String(req.body.tipo || "").trim().toUpperCase();

    if (!["TV", "CELULAR"].includes(tipo)) {
      return res.status(400).json({
        ok: false,
        message: "tipo debe ser TV o CELULAR",
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
        inputDir: req.auditoriaInputDir,
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

    const ventas = await exports.obtenerReporteAuditoria({
      fechaInicio: req.body.fechaInicio,
      fechaFin: req.body.fechaFin,
      agenciaId: req.body.agenciaId,
      vendedorId: req.body.vendedorId,
      modeloId: req.body.modeloId,
      cierreCaja: req.body.cierreCaja,
      origenId: req.body.origenId,
      dispositivoId: req.body.dispositivoId,
      estado: req.body.estado,
    });

    const registrosPdf = Array.isArray(resultado.registros_validos)
      ? resultado.registros_validos
      : [];
    const totalRegistrosPdf = Number(resultado.total_registros) || registrosPdf.length;
    const dispositivosCreditoPdf = totalRegistrosPdf;
    const dispositivosCreditoRve = contarDispositivosCreditoRve({ tipo, ventas });
    const diferenciaCredito = dispositivosCreditoRve - dispositivosCreditoPdf;
    const auditoria = await auditarRegistrosPdf({
      tipo,
      registrosPdf,
      ventas,
    });

    return res.json({
      ok: true,
      tipo,
      resumen: {
        pdfsProcesados: resultado.pdfs_procesados || 0,
        registrosPdf: totalRegistrosPdf,
        registrosPdfValidos: registrosPdf.length,
        dispositivosCreditoPdf,
        dispositivosCreditoRve,
        diferenciaCredito,
        criterioCreditoRve: "formaPago credito",
        ventasComparadas: auditoria.resultados.length,
        erroresDetectados: auditoria.resultados.filter(
          (fila) => fila.observacionError && fila.observacionError !== "OK",
        ).length,
        erroresExtraccion: Array.isArray(resultado.errores)
          ? resultado.errores.length
          : 0,
      },
      ventas: auditoria.resultados,
      errores: resultado.errores || [],
    });
  } catch (error) {
    console.error("Error auditando ventas desde PDF:", error);
    return res.status(500).json({
      ok: false,
      message: error.message || "Error al auditar PDFs",
    });
  } finally {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  }
};
