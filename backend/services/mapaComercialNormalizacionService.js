const axios = require("axios");
const { Op } = require("sequelize");
const MapaUbicacionNormalizada = require("../models/MapaUbicacionNormalizada");
const {
  clasificarUbicacionPermitida,
  extraerCoordenadasGooglePermitidas,
  extraerCoordenadasGoogleRedireccion,
} = require("./mapaComercialService");

const ESTADOS_LISTOS = new Set(["procesado", "manual"]);
const ESTADOS_EN_COLA = new Set(["pendiente", "procesando"]);
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

const resolverEnlaceCorto = async (url) => {
  const extraerContinueCaptcha = (html) => {
    const match = String(html || "").match(/name=['"]continue['"]\s+value=['"]([^'"]+)['"]/i);
    if (!match) return null;

    return match[1]
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
  };

  const response = await axios.get(url, {
    maxRedirects: 8,
    timeout: 12000,
    validateStatus: (status) => (status >= 200 && status < 400) || status === 429,
  });

  if (response.status === 429) {
    const continueUrl = extraerContinueCaptcha(response.data);
    if (continueUrl) return continueUrl;

    throw new Error("Google bloqueo la resolucion del enlace corto con CAPTCHA");
  }

  return (
    response.request?.res?.responseUrl ||
    response.request?._redirectable?._currentUrl ||
    response.config?.url ||
    url
  );
};

const normalizarVenta = async (venta) => {
  const ubicacionOriginal = String(venta.ubicacionOriginal || "").trim();
  const tipoUbicacion = clasificarUbicacionPermitida(ubicacionOriginal);
  const now = new Date();

  if (tipoUbicacion === "formato_no_permitido") {
    return {
      entidadTipo: "entrega",
      entidadId: venta.ventaId,
      ubicacionOriginal,
      tipoUbicacion,
      estadoGeocodificacion: "omitido",
      procesadoEn: now,
      errorDetalle: "Formato no permitido. Solo maps.app.goo.gl, google.com/maps/place o google.com/maps?q=lat,lng",
    };
  }

  let coordenadas = extraerCoordenadasGooglePermitidas(ubicacionOriginal);
  let ubicacionFinal = ubicacionOriginal;
  let precision = "extraida_url";

  if (!coordenadas && tipoUbicacion === "enlace_corto_google") {
    ubicacionFinal = await resolverEnlaceCorto(ubicacionOriginal);
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
      errorDetalle: ubicacionFinal !== ubicacionOriginal ? `URL final: ${ubicacionFinal}` : null,
    };
  }

  return {
    entidadTipo: "entrega",
    entidadId: venta.ventaId,
    ubicacionOriginal,
    tipoUbicacion: "google_sin_coordenadas",
    estadoGeocodificacion: "omitido",
    procesadoEn: now,
    errorDetalle: "URL de Google Maps permitida, pero sin coordenadas extraibles",
  };
};

const encolarVentasParaNormalizar = async ({
  ventas = [],
  limit = 50,
  force = false,
}) => {
  const limite = limitar(limit, 50, 500);
  const ids = ventas
    .map((venta) => Number(venta.ventaId))
    .filter((id) => Number.isInteger(id) && id > 0);
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
  const filas = [];
  let omitidos = 0;
  let yaEnCola = 0;

  for (const venta of ventas) {
    if (filas.length >= limite) break;

    const existente = existentesPorVenta.get(Number(venta.ventaId));
    const estado = String(existente?.estadoGeocodificacion || "").toLowerCase();

    if (existente && ESTADOS_EN_COLA.has(estado)) {
      yaEnCola += 1;
      continue;
    }

    if (existente && !force && ESTADOS_LISTOS.has(estado)) {
      omitidos += 1;
      continue;
    }

    filas.push({
      entidadTipo: "entrega",
      entidadId: venta.ventaId,
      ubicacionOriginal: String(venta.ubicacionOriginal || "").trim(),
      tipoUbicacion: clasificarUbicacionPermitida(venta.ubicacionOriginal),
      estadoGeocodificacion: "pendiente",
      procesadoEn: null,
      errorDetalle: "Pendiente de normalizacion en segundo plano",
    });
  }

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
      yaEnCola,
      omitidos,
      totalVentas: ventas.length,
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
      order: [["updatedAt", "ASC"]],
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
  procesarColaNormalizaciones,
};
