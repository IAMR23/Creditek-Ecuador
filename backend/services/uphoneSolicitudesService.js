const ExcelJS = require("exceljs");
const { Op, QueryTypes } = require("sequelize");

const UphoneSolicitud = require("../models/UphoneSolicitud");

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS_PER_FILE = 25000;
const MAX_EXPORT_ROWS = 25000;
const MAX_PAGE_SIZE = 100;
const INSERT_CHUNK_SIZE = 500;

const COLUMNAS = [
  { key: "distribuidor", label: "DISTRIBUIDOR" },
  { key: "matriz", label: "MATRIZ" },
  { key: "vendedor", label: "VENDEDOR" },
  {
    key: "numeroSolicitud",
    label: "NUMERO DE SOLICITUD",
    aliases: ["NUMERO DE SOLICTUD"],
  },
  { key: "usuario", label: "USUARIO" },
  { key: "cedula", label: "CEDULA" },
  { key: "cliente", label: "CLIENTE" },
  { key: "telefonoSolicitud", label: "TELEFONO SOLICITUD" },
  { key: "telefonoContrato", label: "TELEFONO CONTRATO" },
  { key: "fechaSolicitud", label: "FECHA SOLICITUD" },
  { key: "fechaContrato", label: "FECHA CONTRATO" },
  { key: "grupoArrendamiento", label: "GRUPO ARRENDAMIENTO" },
  { key: "estado", label: "ESTADO" },
  { key: "estadoContrato", label: "ESTADO CONTRATO" },
];

const crearError = (message, statusCode = 400, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
};

const normalizarEncabezado = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const valorCelda = (cell) => {
  const value = cell?.value;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if (Object.hasOwn(value, "result")) return value.result;
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || "").join("");
    }
    if (Object.hasOwn(value, "text")) return value.text;
  }
  return value;
};

const normalizarTexto = (value, maxLength) => {
  if (value === undefined || value === null) return null;
  const text = String(value).replaceAll("\u0000", "").trim();
  return text ? text.slice(0, maxLength) : null;
};

const normalizarNumeroSolicitud = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && Number.isInteger(value)
      ? String(value)
      : null;
  }
  const text = normalizarTexto(value, 40);
  if (!text) return null;
  return /^\d+\.0+$/.test(text) ? text.replace(/\.0+$/, "") : text;
};

const normalizarCedula = (value) => {
  const text = normalizarTexto(value, 30);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
};

const normalizarFechaSolicitud = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Excel no guarda zona horaria. ExcelJS entrega sus componentes como UTC;
    // se reinterpretan como hora local de Ecuador para no restar cinco horas
    // al mostrar el reporte.
    const pad = (part) => String(part).padStart(2, "0");
    return new Date(
      `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
      + `T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}-05:00`,
    );
  }

  const text = normalizarTexto(value, 40);
  if (!text) return null;

  let match = text.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) {
    const latin = text.match(
      /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
    );
    if (latin) {
      match = [latin[0], latin[3], latin[2], latin[1], latin[4], latin[5], latin[6]];
    }
  }
  if (!match) return null;

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const validationDate = new Date(`${isoDate}T00:00:00.000Z`);
  if (
    Number.isNaN(validationDate.getTime()) ||
    validationDate.toISOString().slice(0, 10) !== isoDate
  ) {
    return null;
  }

  const parsed = new Date(
    `${isoDate}T${String(hour).padStart(2, "0")}:${minute}:${second}-05:00`,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const obtenerDiaSolicitudEcuador = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const valueByType = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
};

const obtenerMapaColumnas = (row) => {
  const encabezados = new Map();
  row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const header = normalizarEncabezado(valorCelda(cell));
    if (header) encabezados.set(header, columnNumber);
  });

  const columns = {};
  for (const definition of COLUMNAS) {
    const aliases = [definition.label, ...(definition.aliases || [])].map(
      normalizarEncabezado,
    );
    const alias = aliases.find((candidate) => encabezados.has(candidate));
    if (alias) columns[definition.key] = encabezados.get(alias);
  }
  return columns;
};

const buscarEncabezados = (workbook) => {
  for (const worksheet of workbook.worksheets) {
    const rowsToInspect = Math.min(15, worksheet.actualRowCount || 0);
    for (let rowNumber = 1; rowNumber <= rowsToInspect; rowNumber += 1) {
      const columns = obtenerMapaColumnas(worksheet.getRow(rowNumber));
      if (columns.numeroSolicitud) return { worksheet, rowNumber, columns };
    }
  }
  return null;
};

const parsearExcel = async (buffer) => {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw crearError("Debes adjuntar un archivo Excel no vacio", 400, "ARCHIVO_REQUERIDO");
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw crearError("El archivo no es un Excel .xlsx valido", 400, "EXCEL_INVALIDO");
  }

  const header = buscarEncabezados(workbook);
  if (!header) {
    throw crearError(
      "No se encontro la fila de encabezados del reporte Uphone",
      400,
      "ENCABEZADOS_NO_ENCONTRADOS",
    );
  }

  const missing = COLUMNAS.filter(({ key }) => !header.columns[key]).map(
    ({ label }) => label,
  );
  if (missing.length) {
    throw crearError(
      `Faltan columnas requeridas: ${missing.join(", ")}`,
      400,
      "COLUMNAS_FALTANTES",
    );
  }

  const dataRowCount = Math.max(0, header.worksheet.actualRowCount - header.rowNumber);
  if (dataRowCount > MAX_ROWS_PER_FILE) {
    throw crearError(
      `El archivo supera el limite de ${MAX_ROWS_PER_FILE} filas`,
      400,
      "DEMASIADAS_FILAS",
    );
  }

  const records = [];
  const invalidRows = [];
  let emptyRows = 0;

  for (
    let rowNumber = header.rowNumber + 1;
    rowNumber <= header.worksheet.actualRowCount;
    rowNumber += 1
  ) {
    const row = header.worksheet.getRow(rowNumber);
    const get = (key) => valorCelda(row.getCell(header.columns[key]));
    const rawValues = COLUMNAS.map(({ key }) => get(key));
    const hasData = rawValues.some((value) => normalizarTexto(value, 10));
    if (!hasData) {
      emptyRows += 1;
      continue;
    }

    const numeroSolicitud = normalizarNumeroSolicitud(get("numeroSolicitud"));
    if (!numeroSolicitud) {
      invalidRows.push({ fila: rowNumber, motivo: "Numero de solicitud vacio o invalido" });
      continue;
    }

    const cedula = normalizarTexto(get("cedula"), 30);
    const fechaSolicitud = normalizarFechaSolicitud(get("fechaSolicitud"));
    records.push({
      filaExcel: rowNumber,
      numeroSolicitud,
      distribuidor: normalizarTexto(get("distribuidor"), 180),
      matriz: normalizarTexto(get("matriz"), 180),
      vendedor: normalizarTexto(get("vendedor"), 220),
      usuario: normalizarTexto(get("usuario"), 100),
      cedula,
      cedulaNormalizada: normalizarCedula(cedula),
      fechaSolicitudDia: obtenerDiaSolicitudEcuador(fechaSolicitud),
      cliente: normalizarTexto(get("cliente"), 220),
      telefonoSolicitud: normalizarTexto(get("telefonoSolicitud"), 30),
      telefonoContrato: normalizarTexto(get("telefonoContrato"), 30),
      fechaSolicitud,
      fechaContrato: normalizarTexto(get("fechaContrato"), 40),
      grupoArrendamiento: normalizarTexto(get("grupoArrendamiento"), 160),
      estado: normalizarTexto(get("estado"), 80),
      estadoContrato: normalizarTexto(get("estadoContrato"), 120),
    });
  }

  return {
    records,
    invalidRows,
    emptyRows,
    sheetName: header.worksheet.name,
  };
};

const importarExcel = async ({ file, usuarioId, requestId }) => {
  if (!file?.buffer) {
    throw crearError("Debes adjuntar el Excel en el campo archivo", 400, "ARCHIVO_REQUERIDO");
  }

  let parsed;
  try {
    parsed = await parsearExcel(file.buffer);
  } catch (error) {
    error.uphoneStage = "analizar_excel";
    throw error;
  }
  const seenNumbers = new Set();
  const seenCedulasPorDia = new Set();
  const uniqueRecords = [];
  for (const record of parsed.records) {
    if (seenNumbers.has(record.numeroSolicitud)) continue;
    seenNumbers.add(record.numeroSolicitud);
    const claveCedulaDia = record.cedulaNormalizada
      ? `${record.cedulaNormalizada}|${record.fechaSolicitudDia || "SIN_FECHA"}`
      : null;
    if (claveCedulaDia && seenCedulasPorDia.has(claveCedulaDia)) continue;
    if (claveCedulaDia) seenCedulasPorDia.add(claveCedulaDia);
    uniqueRecords.push(record);
  }

  const candidates = uniqueRecords.map(({ filaExcel, ...record }) => ({
    ...record,
    archivoOrigen: normalizarTexto(file.originalname, 255) || "reporte-uphone.xlsx",
    importadoPorId: usuarioId || null,
  }));

  const inserted = [];
  for (let index = 0; index < candidates.length; index += INSERT_CHUNK_SIZE) {
    const chunk = candidates.slice(index, index + INSERT_CHUNK_SIZE);
    let created;
    try {
      created = await UphoneSolicitud.bulkCreate(chunk, {
        ignoreDuplicates: true,
        returning: ["id", "numeroSolicitud"],
      });
    } catch (error) {
      error.uphoneStage = "insertar_postgresql";
      error.uphoneChunk = {
        index: Math.floor(index / INSERT_CHUNK_SIZE) + 1,
        rows: chunk.length,
        requestId,
      };
      throw error;
    }
    inserted.push(...created.filter((item) => item?.id));
  }

  return {
    archivo: normalizarTexto(file.originalname, 255),
    hoja: parsed.sheetName,
    filasLeidas: parsed.records.length + parsed.invalidRows.length,
    solicitudesValidas: parsed.records.length,
    insertadas: inserted.length,
    omitidasDuplicadas: parsed.records.length - inserted.length,
    omitidasInvalidas: parsed.invalidRows.length,
    omitidasVacias: parsed.emptyRows,
    errores: parsed.invalidRows.slice(0, 20),
  };
};

const normalizarEntero = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const parseDateBoundary = (value, endOfDay = false) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const suffix = endOfDay ? "T23:59:59.999-05:00" : "T00:00:00.000-05:00";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const obtenerFechaActualEcuador = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valueByType = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
};

const normalizarListaFiltro = (value, maxLength = 100, maxItems = 100) => {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(
    values
      .map((item) => normalizarTexto(item, maxLength))
      .filter(Boolean),
  )].slice(0, maxItems);
};

const crearWhereSolicitudes = (query = {}) => {
  const where = {};
  const condicionesAnd = [];
  const q = normalizarTexto(query.q, 120);
  const estado = normalizarTexto(query.estado, 80);
  const usuariosUphone = normalizarListaFiltro(
    query.usuariosUphone ?? query.usuarioUphone,
    100,
  );
  const agencia = normalizarTexto(query.agencia, 180);
  const desde = parseDateBoundary(query.fechaDesde);
  const hasta = parseDateBoundary(query.fechaHasta, true);

  if (desde && hasta && desde > hasta) {
    throw crearError(
      "La fecha inicial no puede ser posterior a la fecha final",
      400,
      "RANGO_FECHAS_INVALIDO",
    );
  }

  if (q) {
    where[Op.or] = [
      "numeroSolicitud",
      "distribuidor",
      "matriz",
      "vendedor",
      "usuario",
      "cedula",
      "cliente",
    ].map((field) => ({ [field]: { [Op.iLike]: `%${q}%` } }));
  }
  if (estado) where.estado = { [Op.iLike]: estado };
  if (usuariosUphone.length) {
    condicionesAnd.push({
      [Op.or]: usuariosUphone.map((usuario) => ({
        usuario: { [Op.iLike]: usuario },
      })),
    });
  }
  if (agencia) {
    condicionesAnd.push({
      [Op.or]: [
        { distribuidor: { [Op.iLike]: agencia } },
        {
          [Op.and]: [
            { [Op.or]: [{ distribuidor: null }, { distribuidor: "" }] },
            { matriz: { [Op.iLike]: agencia } },
          ],
        },
      ],
    });
  }
  if (desde || hasta) {
    where.fechaSolicitud = {
      ...(desde ? { [Op.gte]: desde } : {}),
      ...(hasta ? { [Op.lte]: hasta } : {}),
    };
  }
  if (condicionesAnd.length) where[Op.and] = condicionesAnd;

  return where;
};

const normalizarEtiqueta = (value, fallback) =>
  normalizarTexto(value, 180)?.replace(/\s+/g, " ").toUpperCase() || fallback;

const clasificarValorResultado = (value) => {
  const normalized = normalizarEncabezado(value);
  if (normalized.includes("INVALIDAD")) return "invalidadas";
  if (normalized.includes("APROBAD")) return "aprobadas";
  if (normalized.includes("DENEG") || normalized.includes("RECHAZ")) {
    return "denegadas";
  }
  return "otros";
};

const clasificarResultado = (estadoContrato, estado) => {
  const resultadoContrato = clasificarValorResultado(estadoContrato);
  return resultadoContrato === "otros"
    ? clasificarValorResultado(estado)
    : resultadoContrato;
};

const crearDashboard = (rows = [], totalSolicitudes = 0) => {
  const estados = new Map();
  const agencias = new Map();

  rows.forEach((row) => {
    const cantidad = Number(row.cantidad) || 0;
    const concretadas = Number(row.concretadas) || 0;
    const estado = normalizarEtiqueta(row.estado, "SIN ESTADO");
    const agencia = normalizarEtiqueta(
      row.distribuidor || row.matriz,
      "SIN AGENCIA",
    );
    const resultado = clasificarResultado(row.estadoContrato, row.estado);

    estados.set(estado, (estados.get(estado) || 0) + cantidad);
    const acumulado = agencias.get(agencia) || {
      agencia,
      total: 0,
      aprobadas: 0,
      concretadas: 0,
      denegadas: 0,
      invalidadas: 0,
      otros: 0,
    };
    acumulado.total += cantidad;
    acumulado.concretadas += concretadas;
    acumulado[resultado] += cantidad;
    agencias.set(agencia, acumulado);
  });

  const detalleAgencias = [...agencias.values()].sort(
    (a, b) => b.total - a.total || a.agencia.localeCompare(b.agencia),
  );
  const detalleEstados = [...estados.entries()]
    .map(([estado, cantidad]) => ({ estado, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.estado.localeCompare(b.estado));
  const totales = detalleAgencias.reduce(
    (acc, item) => ({
      aprobadas: acc.aprobadas + item.aprobadas,
      concretadas: acc.concretadas + item.concretadas,
      denegadas: acc.denegadas + item.denegadas,
      invalidadas: acc.invalidadas + item.invalidadas,
      otros: acc.otros + item.otros,
    }),
    { aprobadas: 0, concretadas: 0, denegadas: 0, invalidadas: 0, otros: 0 },
  );

  return {
    totalSolicitudes: Number(totalSolicitudes) || 0,
    totalAprobadas: totales.aprobadas,
    totalConcretadas: totales.concretadas,
    totalDenegadas: totales.denegadas,
    totalInvalidadas: totales.invalidadas,
    totalOtros: totales.otros,
    estados: detalleEstados,
    agencias: detalleAgencias,
    agenciaLider: detalleAgencias[0] || null,
  };
};

const crearReemplazosDashboard = ({ desde, hasta, usuariosUphone, agencia }) => ({
  desde,
  hasta,
  filtrarUsuarios: usuariosUphone.length > 0,
  usuariosUphone: usuariosUphone.length
    ? usuariosUphone.map((usuario) => usuario.toLowerCase())
    : [null],
  agencia: agencia || null,
});

const obtenerResumenDashboard = async ({ desde, hasta, usuariosUphone, agencia }) =>
  UphoneSolicitud.sequelize.query(
    `
      WITH solicitudes_clasificadas AS (
        SELECT
          id,
          distribuidor,
          matriz,
          usuario,
          estado,
          "estadoContrato",
          "fechaContrato",
          "fechaSolicitud",
          CASE
            WHEN LENGTH(REGEXP_REPLACE(COALESCE(cedula, ''), '[^0-9]', '', 'g')) >= 6
              THEN 'CEDULA:' || REGEXP_REPLACE(cedula, '[^0-9]', '', 'g')
            ELSE 'SOLICITUD:' || id::text
          END AS cliente_clave,
          CASE
            WHEN UPPER(COALESCE("estadoContrato", '')) LIKE '%APROBAD%'
              THEN TRUE
            ELSE FALSE
          END AS contrato_aprobado,
          CASE
            WHEN UPPER(COALESCE("estadoContrato", '')) LIKE '%APROBAD%'
              AND NULLIF(BTRIM("fechaContrato"), '') IS NOT NULL
              AND UPPER(BTRIM("fechaContrato")) NOT IN (
                'NO APLICA', 'N/A', 'NA', 'S/N', 'SIN FECHA', 'PENDIENTE', '-'
              )
              THEN TRUE
            ELSE FALSE
          END AS concretada
        FROM uphone_solicitudes
      ), solicitudes_priorizadas AS (
        SELECT
          *,
          COUNT(*) FILTER (WHERE contrato_aprobado) OVER (
            PARTITION BY
              cliente_clave,
              ("fechaSolicitud" AT TIME ZONE 'America/Guayaquil')::date
          ) AS contratos_aprobados_cliente,
          ROW_NUMBER() OVER (
            PARTITION BY
              cliente_clave,
              ("fechaSolicitud" AT TIME ZONE 'America/Guayaquil')::date
            ORDER BY contrato_aprobado DESC, "fechaSolicitud" DESC NULLS LAST, id DESC
          ) AS prioridad_cliente
        FROM solicitudes_clasificadas
      ), solicitudes_periodo AS (
        SELECT
          *,
          contratos_aprobados_cliente > 0
            AND NOT (contrato_aprobado AND prioridad_cliente = 1) AS invalidada
        FROM solicitudes_priorizadas
        WHERE "fechaSolicitud" BETWEEN :desde AND :hasta
          AND (
            :filtrarUsuarios = FALSE
            OR LOWER(BTRIM(usuario)) IN (:usuariosUphone)
          )
          AND (
            :agencia IS NULL
            OR LOWER(
              COALESCE(NULLIF(BTRIM(distribuidor), ''), BTRIM(matriz))
            ) = LOWER(:agencia)
          )
      )
      SELECT
        distribuidor,
        matriz,
        CASE
          WHEN invalidada THEN 'INVALIDADA_POR_CONTRATO_APROBADO'
          ELSE estado
        END AS estado,
        CASE
          WHEN invalidada THEN 'INVALIDADA_POR_CONTRATO_APROBADO'
          ELSE "estadoContrato"
        END AS "estadoContrato",
        COUNT(*)::integer AS cantidad,
        COUNT(*) FILTER (
          WHERE NOT invalidada AND concretada
        )::integer AS concretadas
      FROM solicitudes_periodo
      GROUP BY
        distribuidor,
        matriz,
        CASE
          WHEN invalidada THEN 'INVALIDADA_POR_CONTRATO_APROBADO'
          ELSE estado
        END,
        CASE
          WHEN invalidada THEN 'INVALIDADA_POR_CONTRATO_APROBADO'
          ELSE "estadoContrato"
        END
    `,
    {
      replacements: crearReemplazosDashboard({
        desde,
        hasta,
        usuariosUphone,
        agencia,
      }),
      type: QueryTypes.SELECT,
    },
  );

const obtenerClientesPorVendedor = async ({ desde, hasta, usuariosUphone, agencia }) =>
  UphoneSolicitud.sequelize.query(
    `
      WITH solicitudes_periodo AS (
        SELECT
          id,
          "fechaSolicitud",
          UPPER(NULLIF(BTRIM(usuario), '')) AS usuario_uphone_clave,
          CASE
            WHEN UPPER(COALESCE("estadoContrato", '')) LIKE '%APROBAD%'
              THEN 'aprobadas'
            WHEN UPPER(COALESCE("estadoContrato", '')) LIKE '%DENEG%'
              OR UPPER(COALESCE("estadoContrato", '')) LIKE '%RECHAZ%'
              THEN 'denegadas'
            WHEN UPPER(COALESCE(estado, '')) LIKE '%APROBAD%'
              THEN 'aprobadas'
            WHEN UPPER(COALESCE(estado, '')) LIKE '%DENEG%'
              OR UPPER(COALESCE(estado, '')) LIKE '%RECHAZ%'
              THEN 'denegadas'
            ELSE 'otros'
          END AS resultado,
          CASE
            WHEN UPPER(COALESCE("estadoContrato", '')) LIKE '%APROBAD%'
              AND NULLIF(BTRIM("fechaContrato"), '') IS NOT NULL
              AND UPPER(BTRIM("fechaContrato")) NOT IN (
                'NO APLICA', 'N/A', 'NA', 'S/N', 'SIN FECHA', 'PENDIENTE', '-'
              )
              THEN TRUE
            ELSE FALSE
          END AS concretada,
          CASE
            WHEN LENGTH(REGEXP_REPLACE(COALESCE(cedula, ''), '[^0-9]', '', 'g')) >= 6
              THEN 'CEDULA:' || REGEXP_REPLACE(cedula, '[^0-9]', '', 'g')
            ELSE 'SOLICITUD:' || id::text
          END AS cliente_clave
        FROM uphone_solicitudes
        WHERE "fechaSolicitud" BETWEEN :desde AND :hasta
          AND (
            :filtrarUsuarios = FALSE
            OR LOWER(BTRIM(usuario)) IN (:usuariosUphone)
          )
          AND (
            :agencia IS NULL
            OR LOWER(
              COALESCE(NULLIF(BTRIM(distribuidor), ''), BTRIM(matriz))
            ) = LOWER(:agencia)
          )
      ), clientes_priorizados AS (
        SELECT
          *,
          ROW_NUMBER() OVER (
            PARTITION BY
              cliente_clave,
              ("fechaSolicitud" AT TIME ZONE 'America/Guayaquil')::date
            ORDER BY
              (resultado = 'aprobadas') DESC,
              "fechaSolicitud" DESC NULLS LAST,
              id DESC
          ) AS prioridad_cliente
        FROM solicitudes_periodo
      )
      SELECT
        COALESCE(
          NULLIF(BTRIM(u.nombre), ''),
          s.usuario_uphone_clave,
          'SIN USUARIO UPHONE'
        ) AS vendedor,
        COALESCE(NULLIF(BTRIM(u."usuarioUphone"), ''), s.usuario_uphone_clave) AS "usuarioUphone",
        u.id AS "usuarioId",
        (u.id IS NOT NULL) AS vinculado,
        COUNT(*)::integer AS clientes,
        COUNT(*) FILTER (WHERE s.resultado = 'aprobadas')::integer AS aprobadas,
        COUNT(*) FILTER (
          WHERE s.resultado = 'aprobadas' AND s.concretada
        )::integer AS concretadas,
        COUNT(*) FILTER (WHERE s.resultado = 'denegadas')::integer AS denegadas,
        COUNT(*) FILTER (WHERE s.resultado = 'otros')::integer AS otros
      FROM clientes_priorizados s
      LEFT JOIN usuarios u
        ON LOWER(BTRIM(u."usuarioUphone")) = LOWER(s.usuario_uphone_clave)
      WHERE s.prioridad_cliente = 1
      GROUP BY
        u.id,
        u.nombre,
        u."usuarioUphone",
        s.usuario_uphone_clave
      ORDER BY clientes DESC, vendedor ASC
    `,
    {
      replacements: crearReemplazosDashboard({
        desde,
        hasta,
        usuariosUphone,
        agencia,
      }),
      type: QueryTypes.SELECT,
    },
  );

const crearResumenVendedores = (rows = []) => rows.map((row) => ({
  usuarioId: row.usuarioId ? Number(row.usuarioId) : null,
  vendedor: normalizarTexto(row.vendedor, 180) || "SIN USUARIO UPHONE",
  usuarioUphone: normalizarTexto(row.usuarioUphone, 100),
  vinculado: row.vinculado === true,
  clientes: Number(row.clientes) || 0,
  aprobadas: Number(row.aprobadas) || 0,
  concretadas: Number(row.concretadas) || 0,
  denegadas: Number(row.denegadas) || 0,
  otros: Number(row.otros) || 0,
}));

const crearResumenTelefonos099999 = (rows = [], totalSolicitudes = 0) => {
  const convertirFila = (row) => {
    const total = Number(row.total) || 0;
    const cantidad = Number(row.cantidad) || 0;
    return {
      nombre: normalizarTexto(row.nombre, 220) || "SIN IDENTIFICAR",
      usuarioUphone: normalizarTexto(row.usuarioUphone, 100),
      usuarioId: row.usuarioId ? Number(row.usuarioId) : null,
      vinculado: row.vinculado === true,
      total,
      cantidad,
      porcentaje: total ? Number(((cantidad / total) * 100).toFixed(2)) : 0,
    };
  };

  const ordenar = (items) => items.sort(
    (a, b) => b.porcentaje - a.porcentaje
      || b.cantidad - a.cantidad
      || a.nombre.localeCompare(b.nombre),
  );
  const agencias = ordenar(
    rows
      .filter((row) => row.dimension === "agencia")
      .map(convertirFila)
      .map((item) => ({ ...item, nombre: normalizarEtiqueta(item.nombre, "SIN AGENCIA") })),
  );
  const vendedores = ordenar(
    rows.filter((row) => row.dimension === "vendedor").map(convertirFila),
  );
  const cantidad = agencias.reduce((total, item) => total + item.cantidad, 0);
  const total = Number(totalSolicitudes) || 0;

  return {
    patron: "099999*",
    cantidad,
    total,
    porcentaje: total ? Number(((cantidad / total) * 100).toFixed(2)) : 0,
    agencias,
    vendedores,
  };
};

const obtenerResumenTelefonos099999 = async ({
  desde,
  hasta,
  usuariosUphone,
  agencia,
}) => UphoneSolicitud.sequelize.query(
  `
    WITH solicitudes_periodo AS (
      SELECT
        COALESCE(
          NULLIF(BTRIM(distribuidor), ''),
          NULLIF(BTRIM(matriz), ''),
          'SIN AGENCIA'
        ) AS agencia,
        UPPER(NULLIF(BTRIM(usuario), '')) AS usuario_uphone_clave,
        vendedor,
        REGEXP_REPLACE(
          COALESCE("telefonoSolicitud", ''),
          '[^0-9]',
          '',
          'g'
        ) LIKE '099999%' AS telefono_099999
      FROM uphone_solicitudes
      WHERE "fechaSolicitud" BETWEEN :desde AND :hasta
        AND (
          :filtrarUsuarios = FALSE
          OR LOWER(BTRIM(usuario)) IN (:usuariosUphone)
        )
        AND (
          :agencia IS NULL
          OR LOWER(
            COALESCE(NULLIF(BTRIM(distribuidor), ''), BTRIM(matriz))
          ) = LOWER(:agencia)
        )
    ), solicitudes_normalizadas AS (
      SELECT
        solicitudes_periodo.*,
        u.id AS usuario_id,
        u.nombre AS usuario_nombre,
        u."usuarioUphone" AS usuario_uphone_rve
      FROM solicitudes_periodo
      LEFT JOIN usuarios u
        ON LOWER(BTRIM(u."usuarioUphone"))
          = LOWER(solicitudes_periodo.usuario_uphone_clave)
    ), solicitudes_etiquetadas AS (
      SELECT
        solicitudes_normalizadas.*,
        COALESCE(
          NULLIF(BTRIM(usuario_nombre), ''),
          NULLIF(BTRIM(vendedor), ''),
          usuario_uphone_clave,
          'SIN VENDEDOR'
        ) AS vendedor_normalizado,
        COALESCE(
          NULLIF(BTRIM(usuario_uphone_rve), ''),
          usuario_uphone_clave
        ) AS usuario_uphone_normalizado
      FROM solicitudes_normalizadas
    )
    SELECT
      'agencia' AS dimension,
      agencia AS nombre,
      NULL::text AS "usuarioUphone",
      NULL::integer AS "usuarioId",
      FALSE AS vinculado,
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE telefono_099999)::integer AS cantidad
    FROM solicitudes_etiquetadas
    GROUP BY agencia

    UNION ALL

    SELECT
      'vendedor' AS dimension,
      vendedor_normalizado AS nombre,
      usuario_uphone_normalizado AS "usuarioUphone",
      usuario_id AS "usuarioId",
      (usuario_id IS NOT NULL) AS vinculado,
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE telefono_099999)::integer AS cantidad
    FROM solicitudes_etiquetadas
    GROUP BY
      usuario_id,
      vendedor_normalizado,
      usuario_uphone_normalizado
  `,
  {
    replacements: crearReemplazosDashboard({
      desde,
      hasta,
      usuariosUphone,
      agencia,
    }),
    type: QueryTypes.SELECT,
  },
);

const obtenerUsuariosUphone = async () =>
  UphoneSolicitud.sequelize.query(
    `
      SELECT
        id,
        nombre,
        BTRIM("usuarioUphone") AS "usuarioUphone"
      FROM usuarios
      WHERE NULLIF(BTRIM("usuarioUphone"), '') IS NOT NULL
      ORDER BY nombre ASC, "usuarioUphone" ASC
    `,
    { type: QueryTypes.SELECT },
  );

const crearCatalogoUsuariosUphone = (rows = []) => rows.map((row) => ({
  id: Number(row.id),
  nombre: normalizarTexto(row.nombre, 180) || row.usuarioUphone,
  usuarioUphone: normalizarTexto(row.usuarioUphone, 100),
})).filter((row) => row.usuarioUphone);

const obtenerAgenciasUphone = async () =>
  UphoneSolicitud.sequelize.query(
    `
      SELECT DISTINCT
        COALESCE(
          NULLIF(BTRIM(distribuidor), ''),
          NULLIF(BTRIM(matriz), '')
        ) AS agencia
      FROM uphone_solicitudes
      WHERE COALESCE(
        NULLIF(BTRIM(distribuidor), ''),
        NULLIF(BTRIM(matriz), '')
      ) IS NOT NULL
      ORDER BY agencia ASC
    `,
    { type: QueryTypes.SELECT },
  );

const crearCatalogoAgenciasUphone = (rows = []) => rows
  .map((row) => normalizarTexto(row.agencia, 180))
  .filter(Boolean);

const listar = async (query = {}) => {
  const page = normalizarEntero(query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = normalizarEntero(query.pageSize, 25, 1, MAX_PAGE_SIZE);
  const where = crearWhereSolicitudes(query);
  const fechaActual = obtenerFechaActualEcuador();
  const dashboardFechaDesde = parseDateBoundary(query.dashboardFechaDesde)
    ? query.dashboardFechaDesde
    : fechaActual;
  const dashboardFechaHasta = parseDateBoundary(query.dashboardFechaHasta, true)
    ? query.dashboardFechaHasta
    : fechaActual;
  const dashboardDesde = parseDateBoundary(dashboardFechaDesde);
  const dashboardHasta = parseDateBoundary(dashboardFechaHasta, true);
  const dashboardUsuariosUphone = normalizarListaFiltro(
    query.dashboardUsuariosUphone ?? query.dashboardUsuarioUphone,
    100,
  );
  const dashboardAgencia = normalizarTexto(query.dashboardAgencia, 180);

  if (dashboardDesde > dashboardHasta) {
    throw crearError(
      "La fecha inicial del dashboard no puede ser posterior a la fecha final",
      400,
      "RANGO_FECHAS_INVALIDO",
    );
  }

  const [
    result,
    totalRegistradas,
    resumenAgrupado,
    clientesPorVendedor,
    telefonos099999,
    usuariosUphone,
    agenciasUphone,
  ] = await Promise.all([
    UphoneSolicitud.findAndCountAll({
      where,
      attributes: { exclude: ["cedulaNormalizada", "fechaSolicitudDia"] },
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ["fechaSolicitud", "DESC NULLS LAST"],
        ["id", "DESC"],
      ],
    }),
    UphoneSolicitud.count(),
    obtenerResumenDashboard({
      desde: dashboardDesde,
      hasta: dashboardHasta,
      usuariosUphone: dashboardUsuariosUphone,
      agencia: dashboardAgencia,
    }),
    obtenerClientesPorVendedor({
      desde: dashboardDesde,
      hasta: dashboardHasta,
      usuariosUphone: dashboardUsuariosUphone,
      agencia: dashboardAgencia,
    }),
    obtenerResumenTelefonos099999({
      desde: dashboardDesde,
      hasta: dashboardHasta,
      usuariosUphone: dashboardUsuariosUphone,
      agencia: dashboardAgencia,
    }),
    obtenerUsuariosUphone(),
    obtenerAgenciasUphone(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.count / pageSize));
  const dashboardTotal = resumenAgrupado.reduce(
    (total, item) => total + (Number(item.cantidad) || 0),
    0,
  );
  return {
    ok: true,
    solicitudes: result.rows,
    resumen: {
      totalRegistradas,
      totalFiltradas: result.count,
    },
    dashboard: {
      ...crearDashboard(resumenAgrupado, dashboardTotal),
      vendedores: crearResumenVendedores(clientesPorVendedor),
      telefonos099999: crearResumenTelefonos099999(
        telefonos099999,
        dashboardTotal,
      ),
      usuarios: crearCatalogoUsuariosUphone(usuariosUphone),
      agenciasDisponibles: crearCatalogoAgenciasUphone(agenciasUphone),
      periodo: {
        fechaDesde: dashboardFechaDesde,
        fechaHasta: dashboardFechaHasta,
        usuariosUphone: dashboardUsuariosUphone,
        agencia: dashboardAgencia,
      },
    },
    paginacion: {
      page,
      pageSize,
      total: result.count,
      totalPages,
    },
  };
};

const exportarExcel = async (query = {}) => {
  const solicitudes = await UphoneSolicitud.findAll({
    where: crearWhereSolicitudes(query),
    attributes: { exclude: ["cedulaNormalizada", "fechaSolicitudDia"] },
    order: [
      ["fechaSolicitud", "DESC NULLS LAST"],
      ["id", "DESC"],
    ],
    limit: MAX_EXPORT_ROWS + 1,
    raw: true,
  });

  if (solicitudes.length > MAX_EXPORT_ROWS) {
    throw crearError(
      `La exportacion supera ${MAX_EXPORT_ROWS} registros. Refina los filtros e intenta nuevamente`,
      413,
      "EXPORTACION_DEMASIADO_GRANDE",
    );
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RVE";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Solicitudes Uphone", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "NUMERO DE SOLICITUD", key: "numeroSolicitud", width: 22 },
    { header: "DISTRIBUIDOR", key: "distribuidor", width: 28 },
    { header: "MATRIZ", key: "matriz", width: 28 },
    { header: "VENDEDOR", key: "vendedor", width: 28 },
    { header: "USUARIO UPHONE", key: "usuario", width: 20 },
    { header: "CEDULA", key: "cedula", width: 18 },
    { header: "CLIENTE", key: "cliente", width: 32 },
    { header: "TELEFONO SOLICITUD", key: "telefonoSolicitud", width: 20 },
    { header: "TELEFONO CONTRATO", key: "telefonoContrato", width: 20 },
    { header: "FECHA SOLICITUD", key: "fechaSolicitud", width: 22 },
    { header: "FECHA CONTRATO", key: "fechaContrato", width: 20 },
    { header: "GRUPO ARRENDAMIENTO", key: "grupoArrendamiento", width: 28 },
    { header: "ESTADO", key: "estado", width: 24 },
    { header: "ESTADO CONTRATO", key: "estadoContrato", width: 34 },
    { header: "ARCHIVO ORIGEN", key: "archivoOrigen", width: 30 },
  ];
  sheet.addRows(solicitudes.map((solicitud) => ({
    numeroSolicitud: solicitud.numeroSolicitud,
    distribuidor: solicitud.distribuidor,
    matriz: solicitud.matriz,
    vendedor: solicitud.vendedor,
    usuario: solicitud.usuario,
    cedula: solicitud.cedula,
    cliente: solicitud.cliente,
    telefonoSolicitud: solicitud.telefonoSolicitud,
    telefonoContrato: solicitud.telefonoContrato,
    fechaSolicitud: solicitud.fechaSolicitud,
    fechaContrato: solicitud.fechaContrato,
    grupoArrendamiento: solicitud.grupoArrendamiento,
    estado: solicitud.estado,
    estadoContrato: solicitud.estadoContrato,
    archivoOrigen: solicitud.archivoOrigen,
  })));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 24;
  sheet.autoFilter = { from: "A1", to: `O${Math.max(1, solicitudes.length + 1)}` };
  sheet.getColumn("fechaSolicitud").numFmt = "dd/mm/yyyy hh:mm";

  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    filename: `solicitudes-uphone-${obtenerFechaActualEcuador()}.xlsx`,
    total: solicitudes.length,
  };
};

const eliminarSolicitud = async (id) => {
  const solicitudId = Number.parseInt(id, 10);
  if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
    throw crearError(
      "El identificador de la solicitud no es valido",
      400,
      "SOLICITUD_ID_INVALIDO",
    );
  }

  const solicitud = await UphoneSolicitud.findByPk(solicitudId);
  if (!solicitud) {
    throw crearError(
      "La solicitud Uphone no existe o ya fue eliminada",
      404,
      "SOLICITUD_NO_ENCONTRADA",
    );
  }

  const resultado = {
    id: solicitud.id,
    numeroSolicitud: solicitud.numeroSolicitud,
    cliente: solicitud.cliente,
  };
  await solicitud.destroy();
  return resultado;
};

module.exports = {
  MAX_FILE_SIZE_BYTES,
  MAX_EXPORT_ROWS,
  MAX_ROWS_PER_FILE,
  crearWhereSolicitudes,
  eliminarSolicitud,
  exportarExcel,
  importarExcel,
  listar,
  crearDashboard,
  crearCatalogoAgenciasUphone,
  crearCatalogoUsuariosUphone,
  crearResumenVendedores,
  crearResumenTelefonos099999,
  normalizarCedula,
  parsearExcel,
};
