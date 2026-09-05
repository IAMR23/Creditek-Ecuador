const { Op } = require("sequelize");
const Rol = require("../models/Rol");
const Usuario = require("../models/Usuario");
const UsuarioRol = require("../models/UsuarioRol");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Agencia = require("../models/Agencia");
const CopaCreditekVendedorConfiguracion = require(
  "../models/Marketing/CopaCreditekVendedorConfiguracion",
);
const CopaCreditekSemanaVendedor = require(
  "../models/Marketing/CopaCreditekSemanaVendedor",
);
const Venta = require("../models/Venta");
const DetalleVenta = require("../models/DetalleVenta");

const EQUIPOS_COPA = [
  "Martha Bucaram",
  "Caupicho",
  "Nueva Aurora",
  "Sangolquí",
];

const normalizarTexto = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const equiposPorNombreNormalizado = new Map(
  EQUIPOS_COPA.map((equipo) => [normalizarTexto(equipo), equipo]),
);

const normalizarEquipoCopa = (valor) =>
  equiposPorNombreNormalizado.get(normalizarTexto(valor)) || null;

const nombreCortoPersona = (nombreCompleto = "") => {
  const partes = String(nombreCompleto).trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 2) return partes.join(" ");
  return [partes[0], partes[2] || partes[1]].filter(Boolean).join(" ");
};

const normalizarEnteroNoNegativo = (valor, campo) => {
  if (
    valor === null ||
    valor === undefined ||
    typeof valor === "boolean" ||
    (typeof valor === "string" && !valor.trim())
  ) {
    return {
      valido: false,
      mensaje: `${campo} debe ser un número entero mayor o igual a 0.`,
    };
  }
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0) {
    return {
      valido: false,
      mensaje: `${campo} debe ser un número entero mayor o igual a 0.`,
    };
  }
  return { valido: true, valor: numero };
};

const esFechaValida = (valor) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""))) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
};

const validarPeriodo = (fechaInicio, fechaFin) => {
  if (!esFechaValida(fechaInicio) || !esFechaValida(fechaFin)) {
    return { valido: false, mensaje: "El período seleccionado no es válido." };
  }
  if (fechaInicio > fechaFin) {
    return {
      valido: false,
      mensaje: "La fecha de inicio no puede ser mayor que la fecha de fin.",
    };
  }
  return { valido: true, fechaInicio, fechaFin };
};

const normalizarConfiguracionCompleta = (datos = {}) => {
  const usuarioId = Number(datos.usuarioId);
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
    return { valido: false, mensaje: "El vendedor indicado no es válido." };
  }

  const alias = String(datos.alias || "").trim();
  if (alias.length > 50) {
    return {
      valido: false,
      mensaje: "El alias no puede superar 50 caracteres.",
    };
  }

  const equipoInformado = String(datos.equipoCopa || "").trim();
  const equipoCopa = equipoInformado
    ? normalizarEquipoCopa(equipoInformado)
    : null;
  if (equipoInformado && !equipoCopa) {
    return {
      valido: false,
      mensaje: "El equipo Copa seleccionado no es válido.",
    };
  }

  if (typeof datos.mostrarEnMarcador !== "boolean") {
    return {
      valido: false,
      mensaje: "La visibilidad del vendedor no es válida.",
    };
  }

  const meta = normalizarEnteroNoNegativo(datos.meta, "La meta");
  if (!meta.valido) return meta;

  if (
    datos.ventasManual !== null &&
    datos.ventasManual !== undefined &&
    datos.ventasManual !== ""
  ) {
    return {
      valido: false,
      mensaje: "Las ventas de Copa se calculan automáticamente según las fechas seleccionadas.",
    };
  }

  return {
    valido: true,
    valor: {
      usuarioId,
      alias: alias || null,
      equipoCopa,
      mostrarEnMarcador: datos.mostrarEnMarcador,
      meta: meta.valor,
      ventasManual: null,
    },
  };
};

const obtenerSemanaDelPeriodo = (semanas, usuarioId, fechaInicio, fechaFin) =>
  semanas.find(
    (semana) =>
      Number(semana.usuarioId) === Number(usuarioId) &&
      semana.fechaInicio === fechaInicio &&
      semana.fechaFin === fechaFin,
  ) || null;

const resolverAgenciaActual = (agenciasPorUsuario, usuarioId) =>
  agenciasPorUsuario.get(Number(usuarioId)) || null;

const construirMarcador = ({
  usuarios,
  agenciasPorUsuario = new Map(),
  configuraciones = [],
  semanas = [],
  ventasPorUsuario = new Map(),
  ventasDiaPorUsuario = new Map(),
  fechaDia,
  fechaInicio,
  fechaFin,
}) => {
  const configuracionPorUsuario = new Map(
    configuraciones.map((configuracion) => [
      Number(configuracion.usuarioId),
      configuracion,
    ]),
  );

  const vendedores = usuarios.map((usuario) => {
    const usuarioId = Number(usuario.id);
    const configuracion = configuracionPorUsuario.get(usuarioId) || null;
    const agencia = resolverAgenciaActual(agenciasPorUsuario, usuarioId);
    const equipoConfigurado = normalizarEquipoCopa(configuracion?.equipoCopa);
    const equipoCopa =
      equipoConfigurado || normalizarEquipoCopa(agencia?.nombre) || null;
    const semana = obtenerSemanaDelPeriodo(
      semanas,
      usuarioId,
      fechaInicio,
      fechaFin,
    );
    const ventasCalculadas = Number(ventasPorUsuario.get(usuarioId) || 0);
    const metaConfigurada =
      configuracion?.meta === null || configuracion?.meta === undefined
        ? null
        : Number(configuracion.meta);
    const alias = String(configuracion?.alias || "").trim() || null;
    const nombreCorto = nombreCortoPersona(usuario.nombre);
    const mostrarEnMarcador = configuracion?.mostrarEnMarcador !== false;

    return {
      usuarioId,
      nombre: usuario.nombre,
      nombreCorto,
      nombreMostrado: alias || nombreCorto,
      agenciaId: agencia?.id ? Number(agencia.id) : null,
      agencia: agencia?.nombre || null,
      equipoCopa,
      equipoConfigurado: equipoConfigurado || null,
      alias,
      mostrarEnMarcador,
      meta: metaConfigurada ?? Number(semana?.meta || 0),
      ventasCalculadas,
      ventasDia: Number(ventasDiaPorUsuario.get(usuarioId) || 0),
      // Campo conservado por compatibilidad; los ajustes antiguos ya no puntúan.
      ventasManual: null,
      ventasMostradas: ventasCalculadas,
      requiereEquipo: mostrarEnMarcador && !equipoCopa,
    };
  });

  const equipos = EQUIPOS_COPA.map((nombre) => {
    const vendedoresEquipo = vendedores
      .filter(
        (vendedor) =>
          vendedor.mostrarEnMarcador && vendedor.equipoCopa === nombre,
      )
      .sort((a, b) =>
        a.nombreMostrado.localeCompare(b.nombreMostrado, "es", {
          sensitivity: "base",
        }),
      );

    return {
      nombre,
      total: vendedoresEquipo.reduce(
        (total, vendedor) => total + vendedor.ventasMostradas,
        0,
      ),
      totalDia: vendedoresEquipo.reduce(
        (total, vendedor) => total + vendedor.ventasDia,
        0,
      ),
      vendedores: vendedoresEquipo,
    };
  });

  return {
    fechaInicio,
    fechaFin,
    fechaDia,
    equipos,
    vendedores,
    vendedoresSinEquipo: vendedores.filter(
      (vendedor) => vendedor.mostrarEnMarcador && !vendedor.equipoCopa,
    ),
  };
};

const obtenerIdsRolesVendedor = async () => {
  const roles = await Rol.findAll({
    attributes: ["id", "nombre"],
  });
  return roles
    .filter((rol) => normalizarTexto(rol.nombre) === "vendedor")
    .map((rol) => Number(rol.id));
};

const obtenerVendedoresActivos = async () => {
  const rolIds = await obtenerIdsRolesVendedor();
  if (rolIds.length === 0) return [];

  const rolesAdicionales = await UsuarioRol.findAll({
    where: { rolId: { [Op.in]: rolIds }, activo: true },
    attributes: ["usuarioId"],
  });
  const usuarioIds = rolesAdicionales.map((relacion) => relacion.usuarioId);

  return Usuario.findAll({
    where: {
      activo: true,
      [Op.or]: [
        { rolId: { [Op.in]: rolIds } },
        ...(usuarioIds.length
          ? [{ id: { [Op.in]: usuarioIds } }]
          : []),
      ],
    },
    attributes: ["id", "nombre"],
    order: [["nombre", "ASC"]],
  });
};

const obtenerAgenciasActuales = async (usuarioIds) => {
  if (usuarioIds.length === 0) return new Map();

  const relaciones = await UsuarioAgencia.findAll({
    where: { usuarioId: { [Op.in]: usuarioIds }, activo: true },
    attributes: ["id", "usuarioId", "agenciaId", "updatedAt"],
    include: [{ model: Agencia, as: "agencia", attributes: ["id", "nombre"] }],
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  });

  const agenciasPorUsuario = new Map();
  relaciones.forEach((relacion) => {
    const usuarioId = Number(relacion.usuarioId);
    if (!agenciasPorUsuario.has(usuarioId) && relacion.agencia) {
      agenciasPorUsuario.set(usuarioId, {
        id: Number(relacion.agencia.id),
        nombre: relacion.agencia.nombre,
      });
    }
  });
  return agenciasPorUsuario;
};

const obtenerVentasPorUsuario = async ({ fechaInicio, fechaFin, usuarioIds }) => {
  if (usuarioIds.length === 0) return new Map();

  // Copa cuenta detalles de ventas cargadas, sin sumar sus entregas.
  // fecha es DATEONLY: conservar las fechas evita desplazar el período por zona horaria.
  const ventas = await Venta.findAll({
    where: { activo: true, fecha: { [Op.between]: [fechaInicio, fechaFin] } },
    attributes: ["id"],
    include: [
      {
        model: UsuarioAgencia,
        as: "usuarioAgencia",
        attributes: ["usuarioId"],
        required: true,
        // Mantener la autoría incluso si el vendedor cambió de agencia.
        where: { usuarioId: { [Op.in]: usuarioIds } },
      },
      { model: DetalleVenta, as: "detalleVenta", attributes: ["id"] },
    ],
  });

  const detallesPorUsuario = new Map();
  for (const venta of ventas) {
    const usuarioId = Number(venta.usuarioAgencia.usuarioId);
    if (!detallesPorUsuario.has(usuarioId)) {
      detallesPorUsuario.set(usuarioId, new Set());
    }
    const detalles = detallesPorUsuario.get(usuarioId);
    for (const detalle of venta.detalleVenta || []) {
      detalles.add(Number(detalle.id));
    }
  }
  return new Map(
    [...detallesPorUsuario].map(([usuarioId, detalles]) => [usuarioId, detalles.size]),
  );
};

const obtenerMarcador = async ({ fechaInicio, fechaFin }) => {
  const fechaDia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const usuarios = await obtenerVendedoresActivos();
  const usuarioIds = usuarios.map((usuario) => Number(usuario.id));
  const ventasPeriodoPromesa = obtenerVentasPorUsuario({
    fechaInicio,
    fechaFin,
    usuarioIds,
  });

  const [agenciasPorUsuario, configuraciones, semanas, ventasPorUsuario, ventasDiaPorUsuario] =
    await Promise.all([
      obtenerAgenciasActuales(usuarioIds),
      CopaCreditekVendedorConfiguracion.findAll({
        where: { usuarioId: { [Op.in]: usuarioIds } },
      }),
      CopaCreditekSemanaVendedor.findAll({
        where: {
          usuarioId: { [Op.in]: usuarioIds },
          fechaInicio,
          fechaFin,
        },
      }),
      ventasPeriodoPromesa,
      fechaInicio === fechaDia && fechaFin === fechaDia
        ? ventasPeriodoPromesa
        : obtenerVentasPorUsuario({
            fechaInicio: fechaDia,
            fechaFin: fechaDia,
            usuarioIds,
          }),
    ]);

  return construirMarcador({
    usuarios,
    agenciasPorUsuario,
    configuraciones,
    semanas,
    ventasPorUsuario,
    ventasDiaPorUsuario,
    fechaDia,
    fechaInicio,
    fechaFin,
  });
};

const esVendedorActivo = async (usuarioId) => {
  const id = Number(usuarioId);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  const rolIds = await obtenerIdsRolesVendedor();
  if (rolIds.length === 0) return false;

  const usuario = await Usuario.findOne({
    where: { id, activo: true },
    attributes: ["id", "rolId"],
  });
  if (!usuario) return false;
  if (rolIds.includes(Number(usuario.rolId))) return true;

  return Boolean(
    await UsuarioRol.findOne({
      where: { usuarioId: id, rolId: { [Op.in]: rolIds }, activo: true },
      attributes: ["id"],
    }),
  );
};

module.exports = {
  EQUIPOS_COPA,
  construirMarcador,
  esVendedorActivo,
  nombreCortoPersona,
  normalizarConfiguracionCompleta,
  normalizarEnteroNoNegativo,
  normalizarEquipoCopa,
  obtenerMarcador,
  obtenerVendedoresActivos,
  obtenerSemanaDelPeriodo,
  validarPeriodo,
};
