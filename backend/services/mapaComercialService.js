const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const ECUADOR_BOUNDS = {
  minLat: -5.2,
  maxLat: 1.8,
  minLng: -82.2,
  maxLng: -75.0,
};

const isCoordinateInsideEcuador = (latitud, longitud) => {
  const lat = Number(latitud);
  const lng = Number(longitud);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= ECUADOR_BOUNDS.minLat &&
    lat <= ECUADOR_BOUNDS.maxLat &&
    lng >= ECUADOR_BOUNDS.minLng &&
    lng <= ECUADOR_BOUNDS.maxLng
  );
};

const parseCoordinatePair = (latitud, longitud) => {
  const lat = Number(latitud);
  const lng = Number(longitud);

  if (!isCoordinateInsideEcuador(lat, lng)) return null;

  return {
    latitud: Number(lat.toFixed(7)),
    longitud: Number(lng.toFixed(7)),
  };
};

const decodeLocation = (value) => {
  try {
    return decodeURIComponent(String(value || "").replace(/\+/g, " "));
  } catch (_error) {
    return String(value || "");
  }
};

const getUrl = (value) => {
  try {
    return new URL(String(value || "").trim());
  } catch (_error) {
    return null;
  }
};

const extraerCoordenadas3d4d = (texto) => {
  const match = decodeLocation(texto).match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  return match ? parseCoordinatePair(match[1], match[2]) : null;
};

const extraerCoordenadasAt = (texto) => {
  const match = decodeLocation(texto).match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i);
  return match ? parseCoordinatePair(match[1], match[2]) : null;
};

const extraerCoordenadasQueryQ = (url) => {
  const q = url.searchParams.get("q");
  if (!q) return null;

  const match = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return match ? parseCoordinatePair(match[1], match[2]) : null;
};

const esHostGoogleMapsPermitido = (hostname) =>
  ["www.google.com", "google.com"].includes(String(hostname || "").toLowerCase());

const extraerCoordenadasGooglePermitidas = (value) => {
  const url = getUrl(value);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname || "";

  if (!esHostGoogleMapsPermitido(hostname)) return null;

  if (pathname.startsWith("/maps/place/")) {
    return (
      extraerCoordenadas3d4d(url.href) ||
      extraerCoordenadasAt(url.href)
    );
  }

  if (pathname === "/maps" && url.searchParams.has("q")) {
    return extraerCoordenadasQueryQ(url);
  }

  return null;
};

const extraerCoordenadasGoogleRedireccion = (value) => {
  const url = getUrl(value);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname || "";

  if (!esHostGoogleMapsPermitido(hostname) || !pathname.startsWith("/maps")) {
    return null;
  }

  return (
    extraerCoordenadas3d4d(url.href) ||
    extraerCoordenadasAt(url.href) ||
    extraerCoordenadasGooglePermitidas(url.href)
  );
};

const clasificarUbicacionPermitida = (value) => {
  const texto = String(value || "").trim();
  if (!texto) return "formato_no_permitido";

  const url = getUrl(texto);
  if (!url) return "formato_no_permitido";

  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname || "";

  if (hostname === "maps.app.goo.gl") return "enlace_corto_google";

  if (!esHostGoogleMapsPermitido(hostname)) return "formato_no_permitido";

  if (pathname.startsWith("/maps/place/")) {
    return extraerCoordenadasGooglePermitidas(texto)
      ? "google_maps_place"
      : "google_sin_coordenadas";
  }

  if (pathname === "/maps" && url.searchParams.has("q")) {
    return extraerCoordenadasGooglePermitidas(texto)
      ? "google_maps_q"
      : "google_sin_coordenadas";
  }

  return "formato_no_permitido";
};

const parseDmsCoordinate = (degrees, minutes, seconds, direction) => {
  const deg = Number(degrees);
  const min = Number(minutes);
  const sec = Number(seconds);

  if (![deg, min, sec].every(Number.isFinite)) return null;

  const sign = /[SW]/i.test(direction) ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
};

const extraerCoordenadasDms = (texto) => {
  const match = texto.match(
    /(\d{1,3})[°º]\s*(\d{1,2})['’]\s*(\d{1,2}(?:\.\d+)?)["”]?\s*([NS])\D+(\d{1,3})[°º]\s*(\d{1,2})['’]\s*(\d{1,2}(?:\.\d+)?)["”]?\s*([EW])/i,
  );

  if (!match) return null;

  const latitud = parseDmsCoordinate(match[1], match[2], match[3], match[4]);
  const longitud = parseDmsCoordinate(match[5], match[6], match[7], match[8]);

  return parseCoordinatePair(latitud, longitud);
};

const extraerCoordenadasDeTexto = (value) => {
  const texto = decodeLocation(value);
  if (!texto.trim()) return null;

  const patterns = [
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /\b(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = texto.match(pattern);
    if (!match) continue;

    const coordenadas = parseCoordinatePair(match[1], match[2]);
    if (coordenadas) return coordenadas;
  }

  return extraerCoordenadasDms(texto);
};

const clasificarUbicacion = (value) => {
  const texto = String(value || "").trim();
  const normalizado = normalizarTexto(texto);

  if (!texto) return "sin_ubicacion";
  if (normalizado.includes("maps.app.goo.gl")) return "enlace_corto_google";
  if (normalizado.includes("google.com/maps") || normalizado.includes("goo.gl/maps")) {
    return "enlace_google";
  }
  if (extraerCoordenadasDeTexto(texto)) return "coordenadas";
  return "texto";
};

const pickUbicacion = (values = []) => {
  const limpios = values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return (
    limpios.find((value) => clasificarUbicacion(value) === "enlace_google") ||
    limpios.find((value) => clasificarUbicacion(value) === "enlace_corto_google") ||
    limpios.find((value) => clasificarUbicacion(value) === "coordenadas") ||
    limpios[0] ||
    ""
  );
};

const getZonaKey = ({ zonaId, agenciaId, zonaNombre }) => {
  if (zonaId) return `zona:${zonaId}`;
  return `texto:${agenciaId || "sin-agencia"}:${normalizarTexto(zonaNombre)}`;
};

const getModeloKey = (row) =>
  `${row.marca || "Sin marca"}||${row.modelo || "Sin modelo"}`;

const crearZonaBase = ({ zonaId, zonaNombre, agenciaId, agenciaNombre, latitud, longitud, radioMetros }) => ({
  zonaId: zonaId || null,
  zona: zonaNombre || "Sin zona",
  agenciaId: agenciaId || null,
  agencia: agenciaNombre || "Sin agencia",
  latitud: latitud === null || latitud === undefined ? null : Number(latitud),
  longitud: longitud === null || longitud === undefined ? null : Number(longitud),
  radioMetros: radioMetros || null,
  totalDispositivos: 0,
  modelos: {},
  marcas: {},
  vendedores: {},
  agencias: {},
  ultimaVenta: null,
});

const agregarVentaZona = (zona, row) => {
  const cantidad = Math.max(0, Number(row.cantidad) || 0);
  const modeloKey = getModeloKey(row);
  const marca = row.marca || "Sin marca";
  const vendedor = row.vendedor || "Sin vendedor";
  const agencia = row.agencia || "Sin agencia";

  zona.totalDispositivos += cantidad;
  zona.modelos[modeloKey] = (zona.modelos[modeloKey] || 0) + cantidad;
  zona.marcas[marca] = (zona.marcas[marca] || 0) + cantidad;
  zona.vendedores[vendedor] = (zona.vendedores[vendedor] || 0) + cantidad;
  zona.agencias[agencia] = (zona.agencias[agencia] || 0) + cantidad;

  if (row.fecha && (!zona.ultimaVenta || row.fecha > zona.ultimaVenta)) {
    zona.ultimaVenta = row.fecha;
  }
};

const serializarModelos = (modelos, total) =>
  Object.entries(modelos)
    .map(([key, cantidad]) => {
      const [marca, modelo] = key.split("||");
      return {
        marca,
        modelo,
        cantidad,
        porcentaje: total ? Number(((cantidad / total) * 100).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => b.cantidad - a.cantidad);

const serializarConteo = (obj) =>
  Object.entries(obj)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

const construirMapaComercial = ({ ventas = [], zonasCobertura = [], fechaFin }) => {
  const zonas = new Map();
  const pendientes = [];

  zonasCobertura.forEach((zona) => {
    const key = getZonaKey({
      zonaId: zona.id,
      agenciaId: zona.agenciaId,
      zonaNombre: zona.nombre,
    });

    zonas.set(
      key,
      crearZonaBase({
        zonaId: zona.id,
        zonaNombre: zona.nombre,
        agenciaId: zona.agenciaId,
        agenciaNombre: zona.agencia?.nombre,
        latitud: zona.latitudCentro,
        longitud: zona.longitudCentro,
        radioMetros: zona.radioMetros,
      }),
    );
  });

  ventas.forEach((row) => {
    if (!row.zonaNombre) {
      pendientes.push({
        ventaId: row.ventaId,
        detalleVentaId: row.detalleVentaId,
        motivo: "Venta sin sector o zona asociada",
        ubicacionOriginal: row.ubicacionOriginal || "",
      });
      return;
    }

    const zonaConfigurada = zonasCobertura.find(
      (zona) =>
        Number(zona.agenciaId) === Number(row.agenciaId) &&
        normalizarTexto(zona.nombre) === normalizarTexto(row.zonaNombre),
    );

    const key = getZonaKey({
      zonaId: zonaConfigurada?.id,
      agenciaId: row.agenciaId,
      zonaNombre: row.zonaNombre,
    });

    if (!zonas.has(key)) {
      zonas.set(
        key,
        crearZonaBase({
          zonaNombre: row.zonaNombre,
          agenciaId: row.agenciaId,
          agenciaNombre: row.agencia,
        }),
      );

      pendientes.push({
        ventaId: row.ventaId,
        detalleVentaId: row.detalleVentaId,
        zona: row.zonaNombre,
        agencia: row.agencia,
        motivo: "Zona detectada en ventas sin cobertura configurada",
        ubicacionOriginal: row.ubicacionOriginal || "",
      });
    }

    agregarVentaZona(zonas.get(key), row);
  });

  const zonasSerializadas = Array.from(zonas.values()).map((zona) => {
    const modelos = serializarModelos(zona.modelos, zona.totalDispositivos);
    return {
      ...zona,
      modelos,
      marcas: serializarConteo(zona.marcas),
      vendedores: serializarConteo(zona.vendedores),
      agencias: serializarConteo(zona.agencias),
      modeloMasVendido: modelos[0] || null,
      tieneCoordenadas: Number.isFinite(zona.latitud) && Number.isFinite(zona.longitud),
    };
  });

  const totalDispositivos = ventas.reduce(
    (acc, row) => acc + (Number(row.cantidad) || 0),
    0,
  );
  const modelosVendidos = new Set(ventas.map(getModeloKey));
  const zonasConVentas = zonasSerializadas.filter((zona) => zona.totalDispositivos > 0);
  const zonasSinVentas = zonasSerializadas.filter((zona) => zona.totalDispositivos === 0);
  const dispositivoMasVendido = getRankingDispositivos(ventas, totalDispositivos)[0] || null;
  const zonaConMasVentas = zonasConVentas
    .slice()
    .sort((a, b) => b.totalDispositivos - a.totalDispositivos)[0] || null;

  return {
    resumen: {
      totalDispositivos,
      modelosDiferentes: modelosVendidos.size,
      dispositivoMasVendido,
      zonaConMasVentas,
      zonasConVentas: zonasConVentas.length,
      zonasSinVentas: zonasSinVentas.length,
      totalZonasConfiguradas: zonasSerializadas.length,
      coberturaComercial:
        zonasSerializadas.length === 0
          ? 0
          : Number(((zonasConVentas.length / zonasSerializadas.length) * 100).toFixed(2)),
      ubicacionesPendientes: pendientes.length,
    },
    zonas: zonasSerializadas,
    zonasConVentas,
    zonasSinVentas: zonasSinVentas.map((zona) => ({
      ...zona,
      diasSinVentas: calcularDiasSinVentas(zona.ultimaVenta, fechaFin),
    })),
    pendientes,
  };
};

const getRankingDispositivos = (ventas = [], totalDispositivos = null) => {
  const total =
    totalDispositivos ??
    ventas.reduce((acc, row) => acc + (Number(row.cantidad) || 0), 0);
  const map = new Map();

  ventas.forEach((row) => {
    const key = getModeloKey(row);
    const actual = map.get(key) || {
      marca: row.marca || "Sin marca",
      modelo: row.modelo || "Sin modelo",
      cantidad: 0,
      zonas: new Set(),
    };

    actual.cantidad += Number(row.cantidad) || 0;
    if (row.zonaNombre) actual.zonas.add(normalizarTexto(row.zonaNombre));
    map.set(key, actual);
  });

  return Array.from(map.values())
    .map((item, index) => ({
      posicion: index + 1,
      marca: item.marca,
      modelo: item.modelo,
      cantidad: item.cantidad,
      porcentaje: total ? Number(((item.cantidad / total) * 100).toFixed(2)) : 0,
      zonas: item.zonas.size,
    }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .map((item, index) => ({ ...item, posicion: index + 1 }));
};

const getRankingZonas = (zonas = [], totalDispositivos = 0) =>
  zonas
    .filter((zona) => zona.totalDispositivos > 0)
    .sort((a, b) => b.totalDispositivos - a.totalDispositivos)
    .map((zona, index) => ({
      posicion: index + 1,
      zona: zona.zona,
      agencia: zona.agencia,
      cantidad: zona.totalDispositivos,
      modeloMasVendido: zona.modeloMasVendido,
      porcentaje: totalDispositivos
        ? Number(((zona.totalDispositivos / totalDispositivos) * 100).toFixed(2))
        : 0,
      zonaId: zona.zonaId,
      latitud: zona.latitud,
      longitud: zona.longitud,
    }));

const calcularDiasSinVentas = (ultimaVenta, fechaFin) => {
  if (!ultimaVenta) return null;
  const fin = fechaFin ? new Date(`${fechaFin}T00:00:00`) : new Date();
  const ultima = new Date(`${ultimaVenta}T00:00:00`);
  const diff = Math.floor((fin - ultima) / (24 * 60 * 60 * 1000));
  return Number.isFinite(diff) ? Math.max(0, diff) : null;
};

module.exports = {
  clasificarUbicacionPermitida,
  construirMapaComercial,
  clasificarUbicacion,
  extraerCoordenadasDeTexto,
  extraerCoordenadasGooglePermitidas,
  extraerCoordenadasGoogleRedireccion,
  getRankingDispositivos,
  getRankingZonas,
  isCoordinateInsideEcuador,
  normalizarTexto,
  parseCoordinatePair,
  pickUbicacion,
};
