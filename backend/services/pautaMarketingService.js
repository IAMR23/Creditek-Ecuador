const TIPOS_CONTENIDO = [
  "Video",
  "Carrusel",
  "Post",
  "Reel",
  "Historia",
  "Live",
  "Otro",
];

const MAX_SEGUIDORES = 999999999999;
const MAX_CONTENIDOS_POR_PAGINA = 100;

const limpiarTexto = (value, maxLength) => {
  const texto = String(value ?? "").trim().replace(/\s+/g, " ");
  return texto ? texto.slice(0, maxLength) : "";
};

const normalizarSeguidores = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valido: true, valor: 0 };
  }

  const numero = Number(value);
  const valido =
    Number.isSafeInteger(numero) &&
    numero >= 0 &&
    numero <= MAX_SEGUIDORES;

  return { valido, valor: valido ? numero : 0 };
};

const normalizarBooleano = (value) => {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() === "true" ||
    String(value).toLowerCase() === "on"
  ) {
    return { valido: true, valor: true };
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === null ||
    value === undefined ||
    value === "" ||
    String(value).toLowerCase() === "false" ||
    String(value).toLowerCase() === "off"
  ) {
    return { valido: true, valor: false };
  }

  return { valido: false, valor: false };
};

const normalizarFecha = (value) => {
  const fecha = String(value || "").trim();
  if (!fecha) return { valido: false, valor: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { valido: false, valor: null };
  }

  const [anio, mes, dia] = fecha.split("-").map(Number);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  const valido =
    fechaUtc.getUTCFullYear() === anio &&
    fechaUtc.getUTCMonth() === mes - 1 &&
    fechaUtc.getUTCDate() === dia;

  return { valido, valor: valido ? fecha : null };
};

const parsearContenidos = (value) => {
  if (typeof value !== "string") {
    return { valido: true, contenidos: value };
  }

  if (!value.trim()) return { valido: true, contenidos: [] };

  try {
    return { valido: true, contenidos: JSON.parse(value) };
  } catch {
    return { valido: false, contenidos: [] };
  }
};

const resolverContenidos = (payload = {}) => {
  const parseado = parsearContenidos(payload.contenidos);
  if (!parseado.valido) {
    return {
      errores: ["La lista de contenidos no es valida"],
      contenidos: [],
    };
  }

  let items = Array.isArray(parseado.contenidos)
    ? parseado.contenidos
    : [];

  if (!items.length && (payload.producto || payload.tipoContenido)) {
    items = [
      {
        producto: payload.producto,
        tipoContenido: payload.tipoContenido,
        fecha: payload.fecha,
      },
    ];
  }

  const errores = [];
  if (items.length > MAX_CONTENIDOS_POR_PAGINA) {
    errores.push(
      `Solo se permiten ${MAX_CONTENIDOS_POR_PAGINA} contenidos por pagina`,
    );
  }

  const contenidos = items
    .slice(0, MAX_CONTENIDOS_POR_PAGINA)
    .filter(
      (item) =>
        limpiarTexto(item?.producto, 120) ||
        limpiarTexto(item?.tipoContenido, 80) ||
        String(item?.fecha || "").trim() ||
        normalizarBooleano(item?.cumplidoFacebook).valor ||
        normalizarBooleano(item?.cumplidoInstagram).valor ||
        normalizarBooleano(item?.cumplidoTiktok).valor,
    )
    .map((item, index) => {
      const producto = limpiarTexto(item?.producto, 120);
      const tipoContenido = limpiarTexto(item?.tipoContenido, 80);
      const fecha = normalizarFecha(item?.fecha);
      const cumplidoFacebook = normalizarBooleano(item?.cumplidoFacebook);
      const cumplidoInstagram = normalizarBooleano(item?.cumplidoInstagram);
      const cumplidoTiktok = normalizarBooleano(item?.cumplidoTiktok);

      if (item?.fecha && !fecha.valido) {
        errores.push(`La fecha del contenido ${index + 1} no es valida`);
      }
      if (!cumplidoFacebook.valido) {
        errores.push(
          `El cumplimiento de Facebook del contenido ${index + 1} no es valido`,
        );
      }
      if (!cumplidoInstagram.valido) {
        errores.push(
          `El cumplimiento de Instagram del contenido ${index + 1} no es valido`,
        );
      }
      if (!cumplidoTiktok.valido) {
        errores.push(
          `El cumplimiento de TikTok del contenido ${index + 1} no es valido`,
        );
      }

      return {
        producto,
        tipoContenido,
        fecha: fecha.valor,
        cumplidoFacebook: cumplidoFacebook.valor,
        cumplidoInstagram: cumplidoInstagram.valor,
        cumplidoTiktok: cumplidoTiktok.valor,
      };
    });

  return { errores, contenidos };
};

const validarPautaMarketing = (payload = {}) => {
  const nombrePagina = limpiarTexto(payload.nombrePagina, 160);
  const seguidoresFacebook = normalizarSeguidores(payload.seguidoresFacebook);
  const seguidoresInstagram = normalizarSeguidores(payload.seguidoresInstagram);
  const seguidoresTiktok = normalizarSeguidores(payload.seguidoresTiktok);
  const contenidosResultado = resolverContenidos(payload);
  const errores = [...contenidosResultado.errores];

  if (!nombrePagina) errores.push("El nombre de la pagina es obligatorio");

  if (!seguidoresFacebook.valido) {
    errores.push("La cantidad de seguidores de Facebook no es valida");
  }
  if (!seguidoresInstagram.valido) {
    errores.push("La cantidad de seguidores de Instagram no es valida");
  }
  if (!seguidoresTiktok.valido) {
    errores.push("La cantidad de seguidores de TikTok no es valida");
  }
  const primerContenido = contenidosResultado.contenidos[0] || {
    producto: "",
    tipoContenido: "",
  };

  return {
    errores,
    data: {
      producto: primerContenido.producto,
      nombrePagina,
      tipoContenido: primerContenido.tipoContenido,
      contenidos: contenidosResultado.contenidos,
      seguidoresFacebook: seguidoresFacebook.valor,
      seguidoresInstagram: seguidoresInstagram.valor,
      seguidoresTiktok: seguidoresTiktok.valor,
    },
  };
};

const serializarPautaMarketing = (registro) => {
  const pauta = registro?.get ? registro.get({ plain: true }) : registro;
  if (!pauta) return null;

  const contenidos = resolverContenidos({
    contenidos: pauta.contenidos,
    producto: pauta.producto,
    tipoContenido: pauta.tipoContenido,
  }).contenidos;

  return {
    id: pauta.id,
    nombrePagina: pauta.nombrePagina,
    imagen: pauta.imagen,
    seguidoresFacebook: Number(pauta.seguidoresFacebook || 0),
    seguidoresInstagram: Number(pauta.seguidoresInstagram || 0),
    seguidoresTiktok: Number(pauta.seguidoresTiktok || 0),
    contenidos,
    createdAt: pauta.createdAt,
    updatedAt: pauta.updatedAt,
  };
};

module.exports = {
  MAX_CONTENIDOS_POR_PAGINA,
  TIPOS_CONTENIDO,
  limpiarTexto,
  normalizarBooleano,
  normalizarFecha,
  normalizarSeguidores,
  resolverContenidos,
  serializarPautaMarketing,
  validarPautaMarketing,
};
