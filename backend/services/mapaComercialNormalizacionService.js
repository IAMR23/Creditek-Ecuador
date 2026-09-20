const axios = require("axios");
const { Op, literal } = require("sequelize");
const MapaUbicacionNormalizada = require("../models/MapaUbicacionNormalizada");
const {
  clasificarUbicacionPermitida,
  extraerCoordenadasGooglePermitidas,
  extraerCoordenadasGoogleRedireccion,
  extraerUrlGoogleMapsPermitida,
} = require("./mapaComercialService");

const ESTADOS_LISTOS = new Set(["procesado", "manual"]);
const ESTADOS_EN_COLA = new Set(["pendiente", "procesando"]);
const ESTADOS_REDIRECCION = new Set([301, 302, 303, 307, 308]);
const MENSAJE_COLA_NUEVA = "Enlace nuevo pendiente de normalizacion";
const MENSAJE_COLA_REINTENTO = "Reintento pendiente de normalizacion";
const MAXIMO_REDIRECCIONES = 5;
const TIMEOUT_ENLACE_MS = 12000;
const INTERVALO_PROCESADOR_MS = Math.max(
  Number(process.env.MAPA_COMERCIAL_NORMALIZACION_INTERVAL_MS) || 5000,
  1000,
);
const TAMANO_LOTE_PROCESADOR = Math.min(
  Math.max(Number(process.env.MAPA_COMERCIAL_NORMALIZACION_BATCH_SIZE) || 20, 1),
  100,
);
const TIEMPO_ATASCADO_MS = Math.max(
  Number(process.env.MAPA_COMERCIAL_NORMALIZACION_STALE_MS) || 5 * 60 * 1000,
  60 * 1000,
);

let procesadorActivo = false;
let temporizadorProcesador = null;

const esTablaNormalizacionInexistente = (error) => {
  const code = error?.original?.code || error?.parent?.code || error?.code;
  const detail = `${error?.message || ""} ${error?.sql || ""}`.toLowerCase();
  return (
    code === "42P01" &&
    detail.includes("mapa_ubicaciones_normalizadas")
  );
};

const limitar = (value, fallback, maximo) => {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return fallback;
  return Math.min(Math.max(Math.floor(numero), 1), maximo);
};

const crearErrorNormalizacion = (codigo, message) => {
  const error = new Error(message);
  error.codigoNormalizacion = codigo;
  return error;
};

const validarUrlGoogleMapsExacta = (value) => {
  try {
    const href = new URL(String(value || "").trim()).href;
    return extraerUrlGoogleMapsPermitida(href) === href ? href : null;
  } catch (_error) {
    return null;
  }
};

const tieneCaptcha = (response) => {
  const contenido = String(response?.data || "").toLowerCase();
  return (
    contenido.includes("captcha") ||
    contenido.includes("/sorry/") ||
    contenido.includes("unusual traffic")
  );
};

const resolverEnlaceCorto = async (url) => {
  let urlActual = validarUrlGoogleMapsExacta(url);
  if (!urlActual) {
    throw crearErrorNormalizacion(
      "redireccion_no_permitida",
      "El enlace intenta abrir un sitio que no pertenece a Google Maps.",
    );
  }

  for (let redirecciones = 0; redirecciones < MAXIMO_REDIRECCIONES; redirecciones += 1) {
    if (
      extraerCoordenadasGooglePermitidas(urlActual) ||
      extraerCoordenadasGoogleRedireccion(urlActual)
    ) {
      return urlActual;
    }

    let response;
    try {
      response = await axios.get(urlActual, {
        maxRedirects: 0,
        timeout: TIMEOUT_ENLACE_MS,
        validateStatus: () => true,
      });
    } catch (error) {
      if (
        error?.code === "ECONNABORTED" ||
        error?.code === "ETIMEDOUT" ||
        /timeout/i.test(error?.message || "")
      ) {
        throw crearErrorNormalizacion(
          "timeout",
          "Tiempo de espera agotado al consultar Google Maps. Puedes reintentar.",
        );
      }
      throw crearErrorNormalizacion(
        "conexion_google",
        "No se pudo consultar Google Maps. Puedes reintentar.",
      );
    }

    if (response.status === 429) {
      throw crearErrorNormalizacion(
        "limite_google",
        "Google Maps limito temporalmente las consultas (429/CAPTCHA). Intenta mas tarde.",
      );
    }

    if (tieneCaptcha(response)) {
      throw crearErrorNormalizacion(
        "captcha",
        "Google Maps solicito una validacion CAPTCHA. Intenta mas tarde.",
      );
    }

    if (!ESTADOS_REDIRECCION.has(response.status)) {
      if (response.status >= 200 && response.status < 300) return urlActual;

      throw crearErrorNormalizacion(
        "respuesta_google",
        `Google Maps respondio con estado ${response.status}. Puedes reintentar.`,
      );
    }

    const location =
      response.headers?.location || response.headers?.get?.("location");
    if (!location) {
      throw crearErrorNormalizacion(
        "redireccion_sin_destino",
        "Google Maps respondio con una redireccion sin destino.",
      );
    }

    let destino;
    try {
      destino = new URL(location, urlActual).href;
    } catch (_error) {
      throw crearErrorNormalizacion(
        "redireccion_invalida",
        "Google Maps devolvio una redireccion invalida.",
      );
    }

    urlActual = validarUrlGoogleMapsExacta(destino);
    if (!urlActual) {
      throw crearErrorNormalizacion(
        "redireccion_no_permitida",
        "Google Maps intento redirigir hacia un sitio no permitido.",
      );
    }

    if (
      extraerCoordenadasGooglePermitidas(urlActual) ||
      extraerCoordenadasGoogleRedireccion(urlActual)
    ) {
      return urlActual;
    }

    if (redirecciones === MAXIMO_REDIRECCIONES - 1) {
      throw crearErrorNormalizacion(
        "demasiadas_redirecciones",
        "El enlace de Google Maps excedio el maximo de redirecciones.",
      );
    }
  }

  return urlActual;
};

const normalizarVenta = async (venta) => {
  const ubicacionOriginal = String(venta.ubicacionOriginal || "").trim();
  const tipoUbicacion = clasificarUbicacionPermitida(ubicacionOriginal);
  const urlPermitida = extraerUrlGoogleMapsPermitida(ubicacionOriginal);
  const now = new Date();

  if (tipoUbicacion === "formato_no_permitido") {
    return {
      entidadTipo: "entrega",
      entidadId: venta.ventaId,
      ubicacionOriginal,
      tipoUbicacion,
      estadoGeocodificacion: "omitido",
      procesadoEn: now,
      errorDetalle: "El texto no contiene un enlace permitido de Google Maps.",
    };
  }

  let coordenadas = extraerCoordenadasGooglePermitidas(ubicacionOriginal);
  let ubicacionFinal = urlPermitida;
  let precision = "extraida_url";

  if (!coordenadas && tipoUbicacion === "enlace_corto_google") {
    ubicacionFinal = await resolverEnlaceCorto(urlPermitida);
    coordenadas =
      extraerCoordenadasGooglePermitidas(ubicacionFinal) ||
      extraerCoordenadasGoogleRedireccion(ubicacionFinal);
    precision = "extraida_redireccion";
  }

  if (coordenadas) {
    return {
      entidadTipo: "entrega",
      entidadId: venta.ventaId,
      ubicacionOriginal,
      tipoUbicacion,
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      estadoGeocodificacion: "procesado",
      precision,
      procesadoEn: now,
      errorDetalle: null,
    };
  }

  return {
    entidadTipo: "entrega",
    entidadId: venta.ventaId,
    ubicacionOriginal,
    tipoUbicacion: "google_sin_coordenadas",
    estadoGeocodificacion: "omitido",
    procesadoEn: now,
    errorDetalle: "El enlace de Google Maps no contiene coordenadas validas en Ecuador.",
  };
};

const persistirCoordenadasLocales = async ({ ventas = [] } = {}) => {
  const candidatasPorVenta = new Map();

  for (const venta of ventas) {
    const entidadId = Number(venta.ventaId);
    if (!Number.isInteger(entidadId) || entidadId <= 0 || candidatasPorVenta.has(entidadId)) {
      continue;
    }

    const ubicacionOriginal = String(venta.ubicacionOriginal || "").trim();
    const coordenadas = extraerCoordenadasGooglePermitidas(ubicacionOriginal);
    if (!coordenadas) continue;

    candidatasPorVenta.set(entidadId, {
      entidadTipo: "entrega",
      entidadId,
      ubicacionOriginal,
      tipoUbicacion: clasificarUbicacionPermitida(ubicacionOriginal),
      latitud: coordenadas.latitud,
      longitud: coordenadas.longitud,
      estadoGeocodificacion: "procesado",
      precision: "extraida_url",
      procesadoEn: new Date(),
      errorDetalle: null,
    });
  }

  const candidatas = Array.from(candidatasPorVenta.values());
  if (!candidatas.length) return { guardadas: 0, yaGuardadas: 0 };

  const existentes = await MapaUbicacionNormalizada.findAll({
    where: {
      entidadTipo: "entrega",
      entidadId: { [Op.in]: candidatas.map((fila) => fila.entidadId) },
    },
    attributes: ["entidadId", "estadoGeocodificacion"],
    raw: true,
  });
  const estadosPorVenta = new Map(
    existentes.map((fila) => [
      Number(fila.entidadId),
      String(fila.estadoGeocodificacion || "").toLowerCase(),
    ]),
  );
  const filas = candidatas.filter((fila) => {
    const estado = estadosPorVenta.get(fila.entidadId);
    return !ESTADOS_LISTOS.has(estado) && estado !== "procesando";
  });

  if (filas.length) {
    await MapaUbicacionNormalizada.bulkCreate(filas, {
      updateOnDuplicate: [
        "ubicacionOriginal",
        "tipoUbicacion",
        "latitud",
        "longitud",
        "estadoGeocodificacion",
        "precision",
        "procesadoEn",
        "errorDetalle",
        "updatedAt",
      ],
    });
  }

  return {
    guardadas: filas.length,
    yaGuardadas: candidatas.length - filas.length,
  };
};

const encolarVentasParaNormalizar = async ({
  ventas = [],
  limit = 50,
  force = false,
}) => {
  const limite = limitar(limit, 50, 500);
  const ventasUnicas = Array.from(
    new Map(
      ventas
        .map((venta) => [Number(venta.ventaId), venta])
        .filter(([id]) => Number.isInteger(id) && id > 0),
    ).values(),
  );
  const ids = ventasUnicas.map((venta) => Number(venta.ventaId));
  const existentes = ids.length
    ? await MapaUbicacionNormalizada.findAll({
        where: {
          entidadTipo: "entrega",
          entidadId: { [Op.in]: ids },
        },
        attributes: ["id", "entidadId", "estadoGeocodificacion"],
        raw: true,
      })
    : [];
  const existentesPorVenta = new Map(
    existentes.map((ubicacion) => [Number(ubicacion.entidadId), ubicacion]),
  );
  const nuevas = [];
  const reintentos = [];
  let yaEnCola = 0;
  let yaProcesados = 0;

  for (const venta of ventasUnicas) {
    const existente = existentesPorVenta.get(Number(venta.ventaId));
    const estado = String(existente?.estadoGeocodificacion || "").toLowerCase();

    if (existente && ESTADOS_EN_COLA.has(estado)) {
      yaEnCola += 1;
      continue;
    }

    if (existente && !force && ESTADOS_LISTOS.has(estado)) {
      yaProcesados += 1;
      continue;
    }

    const fila = {
      entidadTipo: "entrega",
      entidadId: venta.ventaId,
      ubicacionOriginal: String(venta.ubicacionOriginal || "").trim(),
      tipoUbicacion: clasificarUbicacionPermitida(venta.ubicacionOriginal),
      estadoGeocodificacion: "pendiente",
      procesadoEn: null,
      errorDetalle: existente ? MENSAJE_COLA_REINTENTO : MENSAJE_COLA_NUEVA,
    };

    if (existente) reintentos.push(fila);
    else nuevas.push(fila);
  }

  const candidatos = [...nuevas, ...reintentos];
  const filas = candidatos.slice(0, limite);
  const nuevosEncolados = filas.filter(
    (fila) => fila.errorDetalle === MENSAJE_COLA_NUEVA,
  ).length;
  const reintentosEncolados = filas.length - nuevosEncolados;
  const omitidosPorLimite = candidatos.length - filas.length;

  if (filas.length) {
    await MapaUbicacionNormalizada.bulkCreate(filas, {
      updateOnDuplicate: [
        "ubicacionOriginal",
        "tipoUbicacion",
        "estadoGeocodificacion",
        "procesadoEn",
        "errorDetalle",
        "updatedAt",
      ],
    });
  }

  return {
    resumen: {
      encolados: filas.length,
      nuevosEncolados,
      reintentosEncolados,
      yaEnCola,
      yaProcesados,
      omitidosPorLimite,
      omitidos: yaProcesados + omitidosPorLimite,
      totalVentas: ventasUnicas.length,
    },
  };
};

const recuperarNormalizacionesAtascadas = async () => {
  const limiteAtascado = new Date(Date.now() - TIEMPO_ATASCADO_MS);

  await MapaUbicacionNormalizada.update(
    {
      estadoGeocodificacion: "pendiente",
      errorDetalle: "Reanudada despues de una interrupcion del procesador",
    },
    {
      where: {
        entidadTipo: "entrega",
        estadoGeocodificacion: "procesando",
        updatedAt: { [Op.lt]: limiteAtascado },
      },
    },
  );
};

const procesarColaNormalizaciones = async ({
  limit = TAMANO_LOTE_PROCESADOR,
} = {}) => {
  if (procesadorActivo) {
    return { procesando: true, procesados: 0 };
  }

  procesadorActivo = true;
  let procesados = 0;

  try {
    await recuperarNormalizacionesAtascadas();
    const pendientes = await MapaUbicacionNormalizada.findAll({
      where: {
        entidadTipo: "entrega",
        estadoGeocodificacion: "pendiente",
      },
      attributes: ["id", "entidadId", "ubicacionOriginal"],
      order: [
        [
          literal(
            `CASE WHEN "errorDetalle" = '${MENSAJE_COLA_NUEVA}' THEN 0 ` +
            `WHEN "errorDetalle" = '${MENSAJE_COLA_REINTENTO}' THEN 2 ELSE 1 END`,
          ),
          "ASC",
        ],
        ["updatedAt", "ASC"],
      ],
      limit: limitar(limit, TAMANO_LOTE_PROCESADOR, 100),
      raw: true,
    });

    for (const pendiente of pendientes) {
      const [reclamado] = await MapaUbicacionNormalizada.update(
        {
          estadoGeocodificacion: "procesando",
          errorDetalle: "Normalizando ubicacion en segundo plano",
        },
        {
          where: {
            id: pendiente.id,
            estadoGeocodificacion: "pendiente",
          },
        },
      );

      if (!reclamado) continue;

      try {
        const resultado = await normalizarVenta({
          ventaId: pendiente.entidadId,
          ubicacionOriginal: pendiente.ubicacionOriginal,
        });

        const [actualizado] = await MapaUbicacionNormalizada.update(resultado, {
          where: {
            id: pendiente.id,
            estadoGeocodificacion: "procesando",
          },
        });
        if (actualizado) procesados += 1;
      } catch (error) {
        await MapaUbicacionNormalizada.update(
          {
            estadoGeocodificacion: "error",
            procesadoEn: new Date(),
            errorDetalle: error.message,
          },
          {
            where: {
              id: pendiente.id,
              estadoGeocodificacion: "procesando",
            },
          },
        );
        procesados += 1;
      }
    }
    return { procesando: false, procesados };
  } catch (error) {
    if (!esTablaNormalizacionInexistente(error)) throw error;

    await MapaUbicacionNormalizada.sync();
    return {
      procesando: false,
      procesados: 0,
      esquemaRecuperado: true,
    };
  } finally {
    procesadorActivo = false;
  }
};

const obtenerEstadoNormalizacion = async () => {
  const [pendientes, procesando] = await Promise.all([
    MapaUbicacionNormalizada.count({
      where: {
        entidadTipo: "entrega",
        estadoGeocodificacion: "pendiente",
      },
    }),
    MapaUbicacionNormalizada.count({
      where: {
        entidadTipo: "entrega",
        estadoGeocodificacion: "procesando",
      },
    }),
  ]);

  return {
    pendientes,
    procesando,
    activo: procesadorActivo || procesando > 0 || pendientes > 0,
  };
};

const iniciarProcesadorNormalizaciones = () => {
  if (temporizadorProcesador) return;

  void procesarColaNormalizaciones().catch((error) => {
    console.error("Error iniciando cola de normalizacion del mapa:", error);
  });

  temporizadorProcesador = setInterval(() => {
    void procesarColaNormalizaciones().catch((error) => {
      console.error("Error procesando cola de normalizacion del mapa:", error);
    });
  }, INTERVALO_PROCESADOR_MS);
  temporizadorProcesador.unref?.();
};

const detenerProcesadorNormalizaciones = () => {
  if (!temporizadorProcesador) return;
  clearInterval(temporizadorProcesador);
  temporizadorProcesador = null;
};

module.exports = {
  detenerProcesadorNormalizaciones,
  encolarVentasParaNormalizar,
  iniciarProcesadorNormalizaciones,
  normalizarVenta,
  obtenerEstadoNormalizacion,
  persistirCoordenadasLocales,
  procesarColaNormalizaciones,
  resolverEnlaceCorto,
};
