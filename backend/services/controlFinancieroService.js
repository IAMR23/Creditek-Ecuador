const { sequelize } = require("../config/db");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");

const MAX_REGISTROS_POR_CARGA = 50000;

const texto = (value, maxLength) => {
  const result = String(value ?? "").trim();
  if (!result) return null;
  return maxLength ? result.slice(0, maxLength) : result;
};

const numero = (value) => {
  const result = Number(value);
  return Number.isFinite(result) ? Number(result.toFixed(2)) : 0;
};

const normalizarNombreArchivo = (value) => {
  const nombre = texto(value, 255);
  return nombre
    ? nombre.replace(/^\d{10,}-[a-f0-9]{8}-/i, "")
    : null;
};

const normalizarHash = (value) => {
  const hash = String(value || "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : null;
};

const extraerFechaIso = (value) => {
  const match = String(value || "").match(
    /(?:^|\s)(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s|$)/,
  );
  if (!match) return null;

  const primero = Number(match[1]);
  const segundo = Number(match[2]);
  const anio = Number(match[3]) + (match[3].length === 2 ? 2000 : 0);
  const dia = primero > 12 ? primero : segundo;
  const mes = primero > 12 ? segundo : primero;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(
    dia,
  ).padStart(2, "0")}`;
};

const obtenerFechaReporte = (registros = []) => {
  const frecuencias = new Map();

  registros.forEach((registro) => {
    const fecha = extraerFechaIso(registro.FECHA);
    if (fecha) frecuencias.set(fecha, (frecuencias.get(fecha) || 0) + 1);
  });

  return [...frecuencias.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

const normalizarCaja = (registro) => ({
  tipoRegistro: "CAJA",
  contrato: texto(registro.CONTRATO, 80),
  fecha: texto(registro.FECHA, 80),
  vendedor: texto(registro.VENDEDOR, 160),
  usuarioCobrador: texto(registro["USUARIO COBRADOR"], 120),
  cliente: texto(registro.CLIENTE, 255),
  modelo: null,
  imei: null,
  pagosCuotas: numero(registro["PAGOS CUOTAS"]),
  numeroCuotas: texto(registro["Nro CUOTAS"], 100),
  ventas: 0,
  entradas: 0,
  producto: texto(registro.PRODUCTO, 40),
  agencia: texto(registro.AGENCIA, 120),
  archivoOrigen: normalizarNombreArchivo(registro.ARCHIVO),
  archivoHash: normalizarHash(registro.ARCHIVO_HASH),
});

const normalizarVenta = (registro, tipoRegistro) => ({
  tipoRegistro,
  contrato: texto(registro.CONTRATO, 80),
  fecha: texto(registro.FECHA, 80),
  vendedor: texto(registro.VENDEDOR, 160),
  usuarioCobrador: null,
  cliente: texto(registro.CLIENTE, 255),
  modelo: texto(registro.MODELO, 255),
  imei:
    tipoRegistro === "VENTA_CELULAR" ? texto(registro.IMEI, 80) : null,
  pagosCuotas: 0,
  numeroCuotas: null,
  ventas: numero(registro.VENTAS),
  entradas: numero(registro.ENTRADAS),
  producto: tipoRegistro === "VENTA_TV" ? "CREDITV" : "UPHONE",
  agencia: null,
  archivoOrigen: normalizarNombreArchivo(registro.ARCHIVO),
  archivoHash: normalizarHash(registro.ARCHIVO_HASH),
});

const obtenerListas = (datos = {}) => ({
  caja: Array.isArray(datos.registrosCaja) ? datos.registrosCaja : [],
  tv: Array.isArray(datos.ventasTv) ? datos.ventasTv : [],
  celular: Array.isArray(datos.ventasCelular) ? datos.ventasCelular : [],
});

const calcularTotales = ({ caja, tv, celular }) => ({
  totalPagosCaja: numero(
    caja.reduce((total, item) => total + numero(item["PAGOS CUOTAS"]), 0),
  ),
  totalVentasTv: numero(
    tv.reduce((total, item) => total + numero(item.VENTAS), 0),
  ),
  totalEntradasTv: numero(
    tv.reduce((total, item) => total + numero(item.ENTRADAS), 0),
  ),
  totalVentasCelular: numero(
    celular.reduce((total, item) => total + numero(item.VENTAS), 0),
  ),
  totalEntradasCelular: numero(
    celular.reduce((total, item) => total + numero(item.ENTRADAS), 0),
  ),
});

const resumirRegistros = (registros) => ({
  registrosCaja: registros.filter((item) => item.tipoRegistro === "CAJA").length,
  registrosVentasTv: registros.filter(
    (item) => item.tipoRegistro === "VENTA_TV",
  ).length,
  registrosVentasCelular: registros.filter(
    (item) => item.tipoRegistro === "VENTA_CELULAR",
  ).length,
  totalPagosCaja: numero(
    registros.reduce(
      (total, item) =>
        total + (item.tipoRegistro === "CAJA" ? numero(item.pagosCuotas) : 0),
      0,
    ),
  ),
  totalVentasTv: numero(
    registros.reduce(
      (total, item) =>
        total + (item.tipoRegistro === "VENTA_TV" ? numero(item.ventas) : 0),
      0,
    ),
  ),
  totalEntradasTv: numero(
    registros.reduce(
      (total, item) =>
        total + (item.tipoRegistro === "VENTA_TV" ? numero(item.entradas) : 0),
      0,
    ),
  ),
  totalVentasCelular: numero(
    registros.reduce(
      (total, item) =>
        total +
        (item.tipoRegistro === "VENTA_CELULAR" ? numero(item.ventas) : 0),
      0,
    ),
  ),
  totalEntradasCelular: numero(
    registros.reduce(
      (total, item) =>
        total +
        (item.tipoRegistro === "VENTA_CELULAR" ? numero(item.entradas) : 0),
      0,
    ),
  ),
});

const claveNombreArchivo = (registro) => {
  const nombre = normalizarNombreArchivo(registro.archivoOrigen);
  return nombre
    ? `${registro.tipoRegistro}:${nombre.toLocaleLowerCase("es")}`
    : null;
};

const claveRegistro = (registro) =>
  [
    registro.tipoRegistro,
    registro.contrato,
    registro.fecha,
    registro.vendedor,
    registro.usuarioCobrador,
    registro.cliente,
    registro.modelo,
    registro.imei,
    numero(registro.pagosCuotas),
    registro.numeroCuotas,
    numero(registro.ventas),
    numero(registro.entradas),
    registro.producto,
    registro.agencia,
    normalizarNombreArchivo(registro.archivoOrigen),
  ]
    .map((value) => String(value ?? ""))
    .join("\u001f");

const agruparRegistrosPorArchivo = (registros) => {
  const grupos = new Map();

  registros.forEach((registro, indice) => {
    const archivoHash = normalizarHash(registro.archivoHash);
    const nombreKey = claveNombreArchivo(registro);
    const key = archivoHash
      ? `HASH:${archivoHash}`
      : `NOMBRE:${nombreKey || `SIN_ARCHIVO:${indice}`}`;

    if (!grupos.has(key)) {
      grupos.set(key, {
        archivoHash,
        nombres: new Set(),
        registros: new Map(),
      });
    }

    const grupo = grupos.get(key);
    if (nombreKey) grupo.nombres.add(nombreKey);
    grupo.registros.set(claveRegistro(registro), registro);
  });

  return [...grupos.values()];
};

const filtrarArchivosNuevos = (registros, existentes = []) => {
  const existentesPlanos = existentes.map((item) =>
    item.get ? item.get({ plain: true }) : item,
  );
  const hashesExistentes = new Set(
    existentesPlanos.map((item) => normalizarHash(item.archivoHash)).filter(Boolean),
  );
  const nombresExistentes = new Set(
    existentesPlanos.map(claveNombreArchivo).filter(Boolean),
  );
  const nombresSinHash = new Set(
    existentesPlanos
      .filter((item) => !normalizarHash(item.archivoHash))
      .map(claveNombreArchivo)
      .filter(Boolean),
  );
  const grupos = agruparRegistrosPorArchivo(registros);
  const gruposNuevos = grupos.filter((grupo) => {
    if (grupo.archivoHash && hashesExistentes.has(grupo.archivoHash)) return false;
    const nombresComparables = grupo.archivoHash
      ? nombresSinHash
      : nombresExistentes;
    return ![...grupo.nombres].some((nombre) => nombresComparables.has(nombre));
  });

  return {
    archivosAgregados: gruposNuevos.length,
    archivosOmitidos: grupos.length - gruposNuevos.length,
    registros: gruposNuevos.flatMap((grupo) => [...grupo.registros.values()]),
  };
};

const guardarCargaControlFinanciero = async ({
  datos,
  usuarioId,
  archivoGenerado,
}) => {
  const listas = obtenerListas(datos);
  const totalRegistros = listas.caja.length + listas.tv.length + listas.celular.length;

  if (!totalRegistros) {
    throw new Error(
      "No existen registros validos para guardar en control financiero.",
    );
  }

  if (totalRegistros > MAX_REGISTROS_POR_CARGA) {
    throw new Error(
      `La carga supera el limite de ${MAX_REGISTROS_POR_CARGA} registros.`,
    );
  }

  const registros = [
    ...listas.caja.map(normalizarCaja),
    ...listas.tv.map((item) => normalizarVenta(item, "VENTA_TV")),
    ...listas.celular.map((item) => normalizarVenta(item, "VENTA_CELULAR")),
  ];
  const fechaReporte = obtenerFechaReporte([
    ...listas.caja,
    ...listas.tv,
    ...listas.celular,
  ]);

  if (!fechaReporte) {
    throw new Error("No se pudo determinar la fecha desde los PDFs procesados.");
  }

  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      "SELECT pg_advisory_xact_lock(hashtext('control_financiero'), hashtext(:fechaReporte))",
      { replacements: { fechaReporte }, transaction },
    );

    let carga = await ControlFinancieroCarga.findOne({
      where: { fechaReporte, estado: "ACTIVA" },
      order: [["id", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const esCargaNueva = !carga;
    const registrosExistentes = carga
      ? await ControlFinancieroRegistro.findAll({
          where: { cargaId: carga.id },
          attributes: ["tipoRegistro", "archivoOrigen", "archivoHash"],
          transaction,
        })
      : [];
    const filtrados = filtrarArchivosNuevos(registros, registrosExistentes);
    const resumenNuevo = resumirRegistros(filtrados.registros);
    const totalExistente = carga
      ? Number(carga.registrosCaja || 0) +
        Number(carga.registrosVentasTv || 0) +
        Number(carga.registrosVentasCelular || 0)
      : 0;

    if (totalExistente + filtrados.registros.length > MAX_REGISTROS_POR_CARGA) {
      throw new Error(
        `La carga consolidada supera el limite de ${MAX_REGISTROS_POR_CARGA} registros.`,
      );
    }

    if (!carga) {
      carga = await ControlFinancieroCarga.create(
        {
          archivoGenerado: texto(archivoGenerado, 255),
          fechaReporte,
          estado: "ACTIVA",
          ...resumenNuevo,
          usuarioId: Number(usuarioId) || null,
        },
        { transaction },
      );
    } else if (filtrados.registros.length) {
      await carga.update(
        {
          archivoGenerado: texto(archivoGenerado, 255),
          registrosCaja: Number(carga.registrosCaja || 0) + resumenNuevo.registrosCaja,
          registrosVentasTv:
            Number(carga.registrosVentasTv || 0) + resumenNuevo.registrosVentasTv,
          registrosVentasCelular:
            Number(carga.registrosVentasCelular || 0) +
            resumenNuevo.registrosVentasCelular,
          totalPagosCaja: numero(
            Number(carga.totalPagosCaja || 0) + resumenNuevo.totalPagosCaja,
          ),
          totalVentasTv: numero(
            Number(carga.totalVentasTv || 0) + resumenNuevo.totalVentasTv,
          ),
          totalEntradasTv: numero(
            Number(carga.totalEntradasTv || 0) + resumenNuevo.totalEntradasTv,
          ),
          totalVentasCelular: numero(
            Number(carga.totalVentasCelular || 0) + resumenNuevo.totalVentasCelular,
          ),
          totalEntradasCelular: numero(
            Number(carga.totalEntradasCelular || 0) +
              resumenNuevo.totalEntradasCelular,
          ),
        },
        { transaction },
      );
    }

    if (filtrados.registros.length) {
      await ControlFinancieroRegistro.bulkCreate(
        filtrados.registros.map((registro) => ({ ...registro, cargaId: carga.id })),
        { transaction, validate: true },
      );
    }

    return {
      carga,
      esCargaNueva,
      archivosAgregados: filtrados.archivosAgregados,
      archivosOmitidos: filtrados.archivosOmitidos,
      registrosAgregados: filtrados.registros.length,
    };
  });
};

module.exports = {
  MAX_REGISTROS_POR_CARGA,
  calcularTotales,
  extraerFechaIso,
  filtrarArchivosNuevos,
  guardarCargaControlFinanciero,
  normalizarCaja,
  normalizarVenta,
  obtenerFechaReporte,
  resumirRegistros,
};
