const { Op, col, fn, where: sequelizeWhere } = require("sequelize");
const axios = require("axios");
const Agencia = require("../../models/Agencia");
const DetalleVenta = require("../../models/DetalleVenta");
const Dispositivo = require("../../models/Dispositivo");
const DispositivoMarca = require("../../models/DispositivoMarca");
const Entrega = require("../../models/Entrega");
const DetalleEntrega = require("../../models/DetalleEntrega");
const Marca = require("../../models/Marca");
const Modelo = require("../../models/Modelo");
const Usuario = require("../../models/Usuario");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Venta = require("../../models/Venta");
const MapaComercialZona = require("../../models/MapaComercialZona");
const MapaUbicacionNormalizada = require("../../models/MapaUbicacionNormalizada");
const {
  construirMapaComercial,
  clasificarUbicacionPermitida,
  extraerCoordenadasGooglePermitidas,
  extraerCoordenadasGoogleRedireccion,
  getRankingDispositivos,
  getRankingZonas,
  normalizarTexto,
} = require("../../services/mapaComercialService");

const parseIds = (value) => {
  if (!value || value === "todos") return null;
  const ids = String(value)
    .split(",")
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
  return ids.length ? ids : null;
};

const validarFecha = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const ESTADOS_PENDIENTES_UBICACION = ["pendiente", "AMBIGUO", "ambigua", "error", "omitido"];

const getFechaVenta = (fecha) => {
  if (!fecha) return "";
  if (typeof fecha === "string") return fecha.slice(0, 10);
  return fecha.toISOString().slice(0, 10);
};

const hasCoordenadas = (ubicacion) =>
  Number.isFinite(Number(ubicacion?.latitud)) &&
  Number.isFinite(Number(ubicacion?.longitud));

const validarFiltros = (req, res) => {
  const { fechaInicio, fechaFin } = req.query;

  if (fechaInicio && !validarFecha(fechaInicio)) {
    res.status(400).json({ ok: false, message: "fechaInicio invalida" });
    return false;
  }

  if (fechaFin && !validarFecha(fechaFin)) {
    res.status(400).json({ ok: false, message: "fechaFin invalida" });
    return false;
  }

  if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
    res.status(400).json({
      ok: false,
      message: "La fecha de inicio no puede ser mayor que la fecha de fin",
    });
    return false;
  }

  return true;
};

const getAgenciasPermitidas = (req, agenciaIdFiltro) => {
  const rol = normalizarTexto(req.user?.rol);
  const esAdmin = rol === "admin" || rol === "administrador";
  const agenciaUsuario = req.user?.agenciaId ? [Number(req.user.agenciaId)] : [];
  const filtro = parseIds(agenciaIdFiltro);

  if (esAdmin) return filtro;
  if (!filtro) return agenciaUsuario;

  return filtro.filter((id) => agenciaUsuario.includes(Number(id)));
};

const crearWhere = (req, incluirFechas = true) => {
  const {
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    marcaId,
    modeloId,
    zona,
  } = req.query;
  const whereVenta = {};
  const whereDetalle = {};
  const whereAgencia = {};
  const whereUsuario = {};
  const whereMarca = {};
  const whereModelo = {};
  const whereEntrega = {
    activo: true,
    [Op.and]: [
      sequelizeWhere(fn("LOWER", fn("TRIM", col("estado"))), "entregado"),
    ],
  };
  const whereDetalleEntrega = {
    ubicacion: {
      [Op.and]: [
        { [Op.not]: null },
        { [Op.ne]: "" },
      ],
    },
  };

  if (incluirFechas) {
    if (fechaInicio && fechaFin) {
      whereEntrega.fecha = { [Op.between]: [fechaInicio, fechaFin] };
    } else if (fechaInicio) {
      whereEntrega.fecha = { [Op.gte]: fechaInicio };
    } else if (fechaFin) {
      whereEntrega.fecha = { [Op.lte]: fechaFin };
    }
  }

  const agenciasPermitidas = getAgenciasPermitidas(req, agenciaId);
  if (agenciasPermitidas?.length) {
    whereAgencia.id = { [Op.in]: agenciasPermitidas };
  }

  const vendedores = parseIds(vendedorId);
  if (vendedores?.length) {
    whereUsuario.id = { [Op.in]: vendedores };
  }

  const modelos = parseIds(modeloId);
  if (modelos?.length) {
    whereModelo.id = { [Op.in]: modelos };
  }

  const marcas = parseIds(marcaId);
  if (marcas?.length) {
    whereMarca.id = { [Op.in]: marcas };
  }

  if (zona && zona !== "todos") {
    whereEntrega.sectorEntrega = { [Op.iLike]: `%${zona}%` };
  }

  return {
    whereVenta,
    whereDetalle,
    whereAgencia,
    whereUsuario,
    whereMarca,
    whereModelo,
    whereEntrega,
    whereDetalleEntrega,
    agenciasPermitidas,
  };
};

const consultarVentas = async (req, incluirFechas = true) => {
  const {
    whereVenta,
    whereDetalle,
    whereAgencia,
    whereUsuario,
    whereMarca,
    whereModelo,
    whereEntrega,
    whereDetalleEntrega,
    agenciasPermitidas,
  } = crearWhere(req, incluirFechas);

  const entregas = await Entrega.findAll({
    where: whereEntrega,
    attributes: ["id", "fecha", "sectorEntrega", "estado"],
    include: [
      {
        model: UsuarioAgencia,
        as: "usuarioAgencia",
        attributes: ["id"],
        required: true,
        include: [
          {
            model: Usuario,
            as: "usuario",
            attributes: ["id", "nombre"],
            required: Object.keys(whereUsuario).length > 0,
            ...(Object.keys(whereUsuario).length && { where: whereUsuario }),
          },
          {
            model: Agencia,
            as: "agencia",
            attributes: ["id", "nombre", "ciudad"],
            required: true,
            ...(Object.keys(whereAgencia).length && { where: whereAgencia }),
          },
        ],
      },
      {
        model: DetalleEntrega,
        as: "detalleEntregas",
        attributes: [
          "id",
          "cantidad",
          "modeloId",
          "dispositivoMarcaId",
          "ubicacion",
        ],
        required: true,
        where: {
          ...whereDetalle,
          ...whereDetalleEntrega,
        },
        include: [
          {
            model: Modelo,
            as: "modelo",
            attributes: ["id", "nombre", "marcaId"],
            required: Object.keys(whereModelo).length > 0,
            ...(Object.keys(whereModelo).length && { where: whereModelo }),
            include: [
              {
                model: Marca,
                as: "marca",
                attributes: ["id", "nombre"],
                required: Object.keys(whereMarca).length > 0,
                ...(Object.keys(whereMarca).length && { where: whereMarca }),
              },
            ],
          },
          {
            model: DispositivoMarca,
            as: "dispositivoMarca",
            attributes: ["id"],
            include: [
              { model: Dispositivo, as: "dispositivo", attributes: ["id", "nombre"] },
              { model: Marca, as: "marca", attributes: ["id", "nombre"] },
            ],
          },
        ],
      },
    ],
    order: [["fecha", "ASC"]],
  });

  return entregas.flatMap((entrega) => {
    const agencia = entrega.usuarioAgencia?.agencia;
    const vendedor = entrega.usuarioAgencia?.usuario;

    return (entrega.detalleEntregas || []).map((detalle) => {
      const modelo = detalle.modelo;
      const marca =
        modelo?.marca ||
        detalle.dispositivoMarca?.marca;
      const dispositivo = detalle.dispositivoMarca?.dispositivo;

      return {
        ventaId: entrega.id,
        detalleVentaId: detalle.id,
        fecha: entrega.fecha,
        cantidad: Number(detalle.cantidad) || 0,
        agenciaId: agencia?.id || null,
        agencia: agencia?.nombre || "",
        agenciaCiudad: agencia?.ciudad || "",
        vendedorId: vendedor?.id || null,
        vendedor: vendedor?.nombre || "",
        marcaId: marca?.id || null,
        marca: marca?.nombre || "",
        modeloId: modelo?.id || null,
        modelo: modelo?.nombre || "",
        dispositivo: dispositivo?.nombre || "",
        zonaNombre: entrega.sectorEntrega || "",
        ubicacionOriginal: String(detalle.ubicacion || "").trim(),
        agenciasPermitidas,
      };
    });
  });
};

const consultarZonasCobertura = async (req) => {
  const agenciasPermitidas = getAgenciasPermitidas(req, req.query.agenciaId);
  const where = { activo: true };

  if (agenciasPermitidas?.length) {
    where.agenciaId = { [Op.in]: agenciasPermitidas };
  }

  return MapaComercialZona.findAll({
    where,
    include: [{ model: Agencia, as: "agencia", attributes: ["id", "nombre"] }],
    order: [["nombre", "ASC"]],
  });
};

const agruparPorVenta = (ventas = []) => {
  const map = new Map();

  ventas.forEach((row) => {
    const actual = map.get(row.ventaId) || {
      ventaId: row.ventaId,
      fecha: getFechaVenta(row.fecha),
      agenciaId: row.agenciaId,
      agencia: row.agencia || "Sin agencia",
      agenciaCiudad: row.agenciaCiudad || "",
      zonaNombre: row.zonaNombre || "",
      ubicacionOriginal: row.ubicacionOriginal || "",
      dispositivos: new Map(),
      cantidadTotal: 0,
    };
    const key = `${row.marca || "Sin marca"}||${row.modelo || "Sin modelo"}`;
    const dispositivo = actual.dispositivos.get(key) || {
      marca: row.marca || "Sin marca",
      modelo: row.modelo || "Sin modelo",
      cantidad: 0,
    };

    dispositivo.cantidad += Number(row.cantidad) || 0;
    actual.cantidadTotal += Number(row.cantidad) || 0;
    actual.dispositivos.set(key, dispositivo);
    if (!actual.ubicacionOriginal && row.ubicacionOriginal) {
      actual.ubicacionOriginal = row.ubicacionOriginal;
    }
    if (!actual.zonaNombre && row.zonaNombre) {
      actual.zonaNombre = row.zonaNombre;
    }

    map.set(row.ventaId, actual);
  });

  return Array.from(map.values()).map((venta) => ({
    ...venta,
    dispositivos: Array.from(venta.dispositivos.values()),
  }));
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
      // Se omite por regla de negocio: el mapa solo acepta URLs validas de Google Maps.
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

  // No se geocodifica texto libre ni coordenadas sueltas. Si Google Maps no trae coordenadas,
  // queda omitido para revision/correccion de la ubicacion original.
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

const guardarNormalizacion = async (resultado) => {
  const [registro, created] = await MapaUbicacionNormalizada.findOrCreate({
    where: {
      entidadTipo: resultado.entidadTipo,
      entidadId: resultado.entidadId,
    },
    defaults: resultado,
  });

  if (!created) {
    await registro.update(resultado);
  }

  return registro;
};

const crearResumenNormalizacion = () => ({
  procesados: 0,
  ambiguos: 0,
  conError: 0,
  sinUbicacion: 0,
  omitidosFormato: 0,
  omitidos: 0,
});

const sumarEstadoNormalizacion = (resumen, estado) => {
  if (estado === "procesado" || estado === "manual") resumen.procesados += 1;
  else if (estado === "AMBIGUO" || estado === "ambigua") resumen.ambiguos += 1;
  else if (estado === "omitido") resumen.omitidosFormato += 1;
  else if (estado === "sin_ubicacion") resumen.sinUbicacion += 1;
  else resumen.conError += 1;
};

const normalizarVentasPendientes = async (req) => {
  const limit = Math.min(Math.max(Number(req.body?.limit || req.query.limit || 50), 1), 500);
  const force = req.body?.force === true || req.query.force === "true";
  const ventas = agruparPorVenta(await consultarVentas(req, false));
  const resumen = crearResumenNormalizacion();
  const resultados = [];
  let procesadasEnLote = 0;

  for (const venta of ventas) {
    if (procesadasEnLote >= limit) break;

    const existente = await MapaUbicacionNormalizada.findOne({
      where: { entidadTipo: "entrega", entidadId: venta.ventaId },
    });

    if (
      existente &&
      !force &&
      ["procesado", "manual"].includes(existente.estadoGeocodificacion)
    ) {
      resumen.omitidos += 1;
      continue;
    }

    try {
      procesadasEnLote += 1;
      const resultado = await normalizarVenta(venta);
      const registro = await guardarNormalizacion(resultado);
      sumarEstadoNormalizacion(resumen, registro.estadoGeocodificacion);
      resultados.push({
        id: registro.id,
        ventaId: venta.ventaId,
        estadoGeocodificacion: registro.estadoGeocodificacion,
        tipoUbicacion: registro.tipoUbicacion,
        latitud: registro.latitud,
        longitud: registro.longitud,
      });
    } catch (error) {
      const registro = await guardarNormalizacion({
        entidadTipo: "entrega",
        entidadId: venta.ventaId,
        ubicacionOriginal: venta.ubicacionOriginal || "",
        tipoUbicacion: clasificarUbicacionPermitida(venta.ubicacionOriginal),
        estadoGeocodificacion: "error",
        procesadoEn: new Date(),
        errorDetalle: error.message,
      });
      resumen.conError += 1;
      resultados.push({
        id: registro.id,
        ventaId: venta.ventaId,
        estadoGeocodificacion: "error",
        errorDetalle: error.message,
      });
    }
  }

  return { resumen, resultados };
};

const agruparPuntos = (ventas = [], ubicaciones = []) => {
  const ubicacionesPorVenta = new Map(
    ubicaciones
      .filter(hasCoordenadas)
      .map((ubicacion) => [Number(ubicacion.entidadId), ubicacion]),
  );
  const puntos = new Map();

  agruparPorVenta(ventas).forEach((venta) => {
    const ubicacion = ubicacionesPorVenta.get(Number(venta.ventaId));
    if (!ubicacion) return;

    const latitud = Number(ubicacion.latitud);
    const longitud = Number(ubicacion.longitud);
    const key = `${latitud.toFixed(4)},${longitud.toFixed(4)}`;
    const actual = puntos.get(key) || {
      latitud,
      longitud,
      fecha: venta.fecha,
      fechaInicio: venta.fecha,
      fechaFin: venta.fecha,
      agencia: venta.agencia,
      zona: venta.zonaNombre || ubicacion.ubicacionOriginal || "Sin zona",
      dispositivos: new Map(),
      cantidadTotal: 0,
      ventas: 0,
    };

    actual.ventas += 1;
    actual.fechaInicio = actual.fechaInicio && venta.fecha
      ? (actual.fechaInicio < venta.fecha ? actual.fechaInicio : venta.fecha)
      : venta.fecha || actual.fechaInicio;
    actual.fechaFin = actual.fechaFin && venta.fecha
      ? (actual.fechaFin > venta.fecha ? actual.fechaFin : venta.fecha)
      : venta.fecha || actual.fechaFin;
    actual.fecha =
      actual.fechaInicio === actual.fechaFin
        ? actual.fechaInicio
        : `${actual.fechaInicio} - ${actual.fechaFin}`;

    venta.dispositivos.forEach((item) => {
      const itemKey = `${item.marca}||${item.modelo}`;
      const dispositivo = actual.dispositivos.get(itemKey) || {
        marca: item.marca,
        modelo: item.modelo,
        cantidad: 0,
      };
      dispositivo.cantidad += Number(item.cantidad) || 0;
      actual.cantidadTotal += Number(item.cantidad) || 0;
      actual.dispositivos.set(itemKey, dispositivo);
    });

    puntos.set(key, actual);
  });

  return Array.from(puntos.values()).map((punto) => ({
    latitud: punto.latitud,
    longitud: punto.longitud,
    fecha: punto.fecha,
    agencia: punto.agencia,
    zona: punto.zona,
    dispositivos: Array.from(punto.dispositivos.values()),
    cantidadTotal: punto.cantidadTotal,
    ventas: punto.ventas,
  }));
};

const resolverUbicacionesDesdeDetalle = async (ventas = [], ubicaciones = []) => {
  const ubicacionesCompletas = [...ubicaciones];
  const ventasConUbicacion = new Set(
    ubicaciones
      .filter(hasCoordenadas)
      .map((ubicacion) => Number(ubicacion.entidadId)),
  );

  for (const venta of agruparPorVenta(ventas)) {
    if (ventasConUbicacion.has(Number(venta.ventaId))) continue;

    const resultado = await normalizarVenta(venta);
    if (resultado.estadoGeocodificacion !== "procesado" || !hasCoordenadas(resultado)) {
      // Se guarda el omitido/error para diagnostico, pero no se pinta en el mapa.
      await guardarNormalizacion(resultado);
      continue;
    }

    await guardarNormalizacion(resultado);
    ubicacionesCompletas.push(resultado);
    ventasConUbicacion.add(Number(venta.ventaId));
  }

  return ubicacionesCompletas;
};

const getData = async (req) => {
  const [ventas, ventasHistoricas, zonasCobertura] = await Promise.all([
    consultarVentas(req, true),
    consultarVentas(req, false),
    consultarZonasCobertura(req),
  ]);
  const data = construirMapaComercial({
    ventas,
    zonasCobertura,
    fechaFin: req.query.fechaFin,
  });
  const historico = construirMapaComercial({
    ventas: ventasHistoricas,
    zonasCobertura,
    fechaFin: req.query.fechaFin,
  });

  const ultimaVentaPorZona = new Map(
    historico.zonas
      .filter((zona) => zona.ultimaVenta)
      .map((zona) => [`${zona.agenciaId}:${normalizarTexto(zona.zona)}`, zona.ultimaVenta]),
  );

  data.zonasSinVentas = data.zonasSinVentas.map((zona) => {
    const ultimaVenta = ultimaVentaPorZona.get(
      `${zona.agenciaId}:${normalizarTexto(zona.zona)}`,
    );

    return {
      ...zona,
      ultimaVenta: ultimaVenta || null,
      diasSinVentas: ultimaVenta
        ? Math.max(
            0,
            Math.floor(
              (new Date(`${req.query.fechaFin || new Date().toISOString().slice(0, 10)}T00:00:00`) -
                new Date(`${ultimaVenta}T00:00:00`)) /
                (24 * 60 * 60 * 1000),
            ),
          )
        : null,
    };
  });

  data.rankings = {
    dispositivos: getRankingDispositivos(ventas, data.resumen.totalDispositivos),
    zonas: getRankingZonas(data.zonas, data.resumen.totalDispositivos),
  };

  return data;
};

const responder = (handler) => async (req, res) => {
  try {
    if (!validarFiltros(req, res)) return;
    const data = await handler(req);
    res.json({ ok: true, ...data });
  } catch (error) {
    console.error("Error mapa comercial:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

exports.resumen = responder(async (req) => {
  const data = await getData(req);
  return { resumen: data.resumen };
});

exports.distribucion = responder(async (req) => {
  const data = await getData(req);
  return {
    zonas: data.zonas,
    pendientes: data.pendientes,
  };
});

exports.rankingDispositivos = responder(async (req) => {
  const data = await getData(req);
  return { ranking: data.rankings.dispositivos };
});

exports.rankingZonas = responder(async (req) => {
  const data = await getData(req);
  return { ranking: data.rankings.zonas };
});

exports.zonasSinVentas = responder(async (req) => {
  const data = await getData(req);
  return { zonas: data.zonasSinVentas };
});

exports.filtros = responder(async (req) => {
  const agenciasPermitidas = getAgenciasPermitidas(req, req.query.agenciaId);
  const agenciaWhere = {};

  if (agenciasPermitidas?.length) {
    agenciaWhere.id = { [Op.in]: agenciasPermitidas };
  }

  const [agencias, marcas, modelos, zonas] = await Promise.all([
    Agencia.findAll({ where: agenciaWhere, attributes: ["id", "nombre"], order: [["nombre", "ASC"]] }),
    Marca.findAll({ attributes: ["id", "nombre"], order: [["nombre", "ASC"]] }),
    Modelo.findAll({ attributes: ["id", "nombre", "marcaId"], order: [["nombre", "ASC"]] }),
    MapaComercialZona.findAll({
      where: {
        activo: true,
        ...(agenciasPermitidas?.length && { agenciaId: { [Op.in]: agenciasPermitidas } }),
      },
      attributes: ["id", "nombre", "agenciaId"],
      order: [["nombre", "ASC"]],
    }),
  ]);

  return { filtros: { agencias, marcas, modelos, zonas } };
});

exports.ubicacionesPendientes = responder(async (req) => {
  const ventas = await consultarVentas(req, true);
  const entregaIds = [...new Set(ventas.map((row) => Number(row.ventaId)).filter(Boolean))];

  if (!entregaIds.length) {
    return { pendientes: [] };
  }

  const normalizadasPendientes = await MapaUbicacionNormalizada.findAll({
    where: {
      entidadTipo: "entrega",
      entidadId: { [Op.in]: entregaIds },
      estadoGeocodificacion: {
        [Op.in]: ESTADOS_PENDIENTES_UBICACION,
      },
    },
    attributes: [
      "id",
      "entidadTipo",
      "entidadId",
      "ubicacionOriginal",
      "tipoUbicacion",
      "estadoGeocodificacion",
      "precision",
      "procesadoEn",
      "errorDetalle",
    ],
    limit: 100,
    order: [["updatedAt", "DESC"]],
  });

  return {
    pendientes: normalizadasPendientes,
  };
});

exports.diagnosticoUbicaciones = responder(async (req) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const ventas = agruparPorVenta(await consultarVentas(req, false));
  const resumen = ventas.reduce(
    (acc, venta) => {
      const tipo = clasificarUbicacionPermitida(venta.ubicacionOriginal);
      acc.totalVentas += 1;
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    },
    { totalVentas: 0 },
  );
  const muestras = ventas
    .filter((venta) => venta.ubicacionOriginal)
    .slice(0, limit)
    .map((venta) => ({
      ventaId: venta.ventaId,
      campo: "detalle_entregas.ubicacion",
      tipo: clasificarUbicacionPermitida(venta.ubicacionOriginal),
      ubicacionOriginal: venta.ubicacionOriginal,
      zona: venta.zonaNombre,
      agencia: venta.agencia,
    }));

  return { diagnostico: { resumen, muestras } };
});

exports.normalizarUbicaciones = responder(async (req) => {
  const resultado = await normalizarVentasPendientes(req);
  return resultado;
});

exports.puntosVentas = async (req, res) => {
  try {
    if (!validarFiltros(req, res)) return;
    const ventas = await consultarVentas(req, true);
    const ventaIds = [...new Set(ventas.map((row) => Number(row.ventaId)).filter(Boolean))];

    if (!ventaIds.length) {
      return res.json([]);
    }

    const ubicaciones = await MapaUbicacionNormalizada.findAll({
      where: {
        entidadTipo: "entrega",
        entidadId: { [Op.in]: ventaIds },
        estadoGeocodificacion: { [Op.in]: ["procesado", "manual"] },
        latitud: { [Op.not]: null },
        longitud: { [Op.not]: null },
      },
      attributes: [
        "id",
        "entidadId",
        "ubicacionOriginal",
        "latitud",
        "longitud",
        "estadoGeocodificacion",
      ],
    });

    const ubicacionesCompletas = await resolverUbicacionesDesdeDetalle(ventas, ubicaciones);
    res.json(agruparPuntos(ventas, ubicacionesCompletas));
  } catch (error) {
    console.error("Error puntos mapa comercial:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

exports.corregirUbicacion = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, zona } = req.body || {};
    const lat = Number(latitud);
    const lng = Number(longitud);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        ok: false,
        message: "latitud y longitud son obligatorias",
      });
    }

    const registro = await MapaUbicacionNormalizada.findByPk(id);
    if (!registro) {
      return res.status(404).json({ ok: false, message: "Ubicacion no encontrada" });
    }

    await registro.update({
      latitud: lat,
      longitud: lng,
      estadoGeocodificacion: "manual",
      precision: "manual",
      procesadoEn: new Date(),
      errorDetalle: zona ? `Corregido manualmente. Zona/sector: ${zona}` : "Corregido manualmente",
    });

    res.json({ ok: true, ubicacion: registro });
  } catch (error) {
    console.error("Error corrigiendo ubicacion mapa comercial:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
};

exports.dashboard = responder(async (req) => {
  const data = await getData(req);
  return data;
});

exports.crearZona = async (req, res) => {
  try {
    const {
      agenciaId,
      nombre,
      tipo,
      latitudCentro,
      longitudCentro,
      radioMetros,
      poligono,
    } = req.body || {};

    if (!agenciaId || !nombre) {
      return res.status(400).json({
        ok: false,
        message: "agenciaId y nombre son obligatorios",
      });
    }

    const agenciasPermitidas = getAgenciasPermitidas(req, agenciaId);
    if (agenciasPermitidas && !agenciasPermitidas.includes(Number(agenciaId))) {
      return res.status(403).json({
        ok: false,
        message: "No tienes acceso a esa agencia",
      });
    }

    const [zona, created] = await MapaComercialZona.findOrCreate({
      where: { agenciaId, nombre },
      defaults: {
        tipo: tipo || "sector",
        latitudCentro,
        longitudCentro,
        radioMetros,
        poligono,
        activo: true,
      },
    });

    if (!created) {
      await zona.update({
        tipo: tipo || zona.tipo,
        latitudCentro,
        longitudCentro,
        radioMetros,
        poligono,
        activo: true,
      });
    }

    res.json({ ok: true, zona });
  } catch (error) {
    console.error("Error guardando zona mapa comercial:", error);
    res.status(500).json({ ok: false, message: error.message });
  }
};
