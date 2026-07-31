const { Op } = require("sequelize");
const MetaMinimaMultaConfiguracion = require("../models/MetaMinimaMultaConfiguracion");
const RolPago = require("../models/RolPago");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Agencia = require("../models/Agencia");
const Venta = require("../models/Venta");
const DetalleVenta = require("../models/DetalleVenta");
const {
  MONTH_NAMES,
  addDays,
  getCommercialWeekKey,
  getCommercialWeekStart,
  parseLocalDateOnly,
  toDateOnly,
} = require("../utils/commercialWeeks");

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const isVendedorPisoCargo = (cargo) => {
  const value = normalizeText(cargo);
  return value.includes("VENDEDOR") && value.includes("PISO");
};

const isVendedorCallCenterCargo = (cargo) => {
  const value = normalizeText(cargo);
  return value.includes("VENDEDOR") && value.includes("CALL CENTER");
};

const isApplicableSellerCargo = (cargo) =>
  isVendedorPisoCargo(cargo) || isVendedorCallCenterCargo(cargo);

const hasApplicableSellerRole = (seller) =>
  (seller.rolesPago || []).some((rolPago) => isApplicableSellerCargo(rolPago.cargo));

const parseDateRange = ({ fechaInicio, fechaFin }) => {
  if (!fechaInicio || !fechaFin) {
    throw createHttpError("Debe enviar fechaInicio y fechaFin", 400);
  }

  const start = parseLocalDateOnly(fechaInicio);
  const end = parseLocalDateOnly(fechaFin);
  if (toDateOnly(start) > toDateOnly(end)) {
    throw createHttpError("La fecha de inicio no puede ser mayor que la fecha de fin", 400);
  }

  return {
    fechaInicio: toDateOnly(start),
    fechaFin: toDateOnly(end),
  };
};

const parseIdList = (value) => {
  if (value === null || value === undefined || value === "") return [];
  const values = Array.isArray(value) ? value : String(value).split(",");
  return values
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
};

const buildWeekLabel = (startDate, endDate) => {
  const startMonth = MONTH_NAMES[startDate.getMonth()];
  const endMonth = MONTH_NAMES[endDate.getMonth()];
  if (startMonth === endMonth && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.getDate()} AL ${endDate.getDate()} DE ${endMonth}`;
  }
  return `${startDate.getDate()} DE ${startMonth} AL ${endDate.getDate()} DE ${endMonth}`;
};

const buildCommercialWeeksForRange = ({ fechaInicio, fechaFin }) => {
  let startDate = getCommercialWeekStart(fechaInicio);
  const lastDate = getCommercialWeekStart(fechaFin);
  const weeks = [];

  while (toDateOnly(startDate) <= toDateOnly(lastDate)) {
    const endDate = addDays(startDate, 6);
    weeks.push({
      startDate: toDateOnly(startDate),
      endDate: toDateOnly(endDate),
      label: buildWeekLabel(startDate, endDate),
    });
    startDate = addDays(startDate, 7);
  }

  return weeks;
};

const calculateCompliance = ({
  metaMinima,
  ventas,
  valorMultaUnidad,
  estadoSinCalculo = "SIN_CONFIGURACION",
}) => {
  if (metaMinima === null || metaMinima === undefined) {
    return {
      faltan: null,
      multaEstimada: 0,
      estado: estadoSinCalculo,
    };
  }

  const faltan = Math.max(toNumber(metaMinima) - toNumber(ventas), 0);
  return {
    faltan,
    multaEstimada: faltan * toNumber(valorMultaUnidad),
    estado: faltan > 0 ? "NO_CUMPLE" : "CUMPLE",
  };
};

const getNewPersonnelPenaltyStartDate = (fechaIngreso, fechaCreacionUsuario) => {
  const baseDate = fechaIngreso || fechaCreacionUsuario;
  if (!baseDate) return null;
  return toDateOnly(addDays(parseLocalDateOnly(baseDate), 30));
};

const isNewPersonnelDuringWeek = ({ fechaIngreso, fechaCreacionUsuario, week }) => {
  const penaltyStartDate = getNewPersonnelPenaltyStartDate(
    fechaIngreso,
    fechaCreacionUsuario,
  );
  if (!penaltyStartDate) return false;
  return String(week.startDate).slice(0, 10) < penaltyStartDate;
};

const serializeConfig = (config) => ({
  id: config.id,
  rolPagoId: config.rolPagoId,
  cargoReferencia: config.cargoReferencia,
  rolPago: config.rolPago
    ? {
        id: config.rolPago.id,
        cargo: config.rolPago.cargo,
        nivel: config.rolPago.nivel,
      }
    : null,
  minimoUnidades: Number(config.minimoUnidades || 0),
  valorMultaUnidad: Number(config.valorMultaUnidad || 0),
  descripcion: config.descripcion || "",
  activo: Boolean(config.activo),
  creadoPorId: config.creadoPorId || null,
  actualizadoPorId: config.actualizadoPorId || null,
  actualizadoPor: config.actualizadoPor
    ? {
        id: config.actualizadoPor.id,
        nombre: config.actualizadoPor.nombre,
        email: config.actualizadoPor.email,
      }
    : null,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt,
});

const includeConfigRelations = [
  { model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"] },
  { model: Usuario, as: "actualizadoPor", attributes: ["id", "nombre", "email"] },
];

const listarConfiguraciones = async () => {
  const configs = await MetaMinimaMultaConfiguracion.findAll({
    include: includeConfigRelations,
    order: [
      ["activo", "DESC"],
      ["cargoReferencia", "ASC"],
    ],
  });
  return configs.map(serializeConfig);
};

const obtenerConfiguracion = async (id) => {
  const config = await MetaMinimaMultaConfiguracion.findByPk(id, {
    include: includeConfigRelations,
  });
  if (!config) throw createHttpError("Configuracion no encontrada", 404);
  return serializeConfig(config);
};

const normalizeConfigPayload = async (payload = {}, current = null) => {
  const rolPagoId = Number(payload.rolPagoId ?? current?.rolPagoId);
  if (!Number.isInteger(rolPagoId) || rolPagoId <= 0) {
    throw createHttpError("Debe seleccionar un rol de pago valido", 400);
  }

  const rolPago = await RolPago.findByPk(rolPagoId);
  if (!rolPago) throw createHttpError("Rol de pago no encontrado", 404);

  const minimoUnidades = Number(payload.minimoUnidades ?? current?.minimoUnidades);
  const valorMultaUnidad = Number(payload.valorMultaUnidad ?? current?.valorMultaUnidad);
  if (!Number.isFinite(minimoUnidades) || minimoUnidades < 0) {
    throw createHttpError("La meta minima debe ser mayor o igual a cero", 400);
  }
  if (!Number.isFinite(valorMultaUnidad) || valorMultaUnidad < 0) {
    throw createHttpError("La multa por unidad debe ser mayor o igual a cero", 400);
  }

  return {
    rolPagoId,
    cargoReferencia:
      String(payload.cargoReferencia ?? current?.cargoReferencia ?? rolPago.cargo).trim() ||
      rolPago.cargo,
    minimoUnidades,
    valorMultaUnidad,
    descripcion:
      payload.descripcion === undefined
        ? current?.descripcion ?? null
        : String(payload.descripcion || "").trim() || null,
    activo: payload.activo === undefined ? current?.activo ?? true : Boolean(payload.activo),
  };
};

const crearConfiguracion = async (payload, usuarioId) => {
  const data = await normalizeConfigPayload(payload);
  const exists = await MetaMinimaMultaConfiguracion.findOne({
    where: { rolPagoId: data.rolPagoId },
  });
  if (exists) throw createHttpError("Ya existe una configuracion para ese rol de pago", 409);

  const config = await MetaMinimaMultaConfiguracion.create({
    ...data,
    creadoPorId: usuarioId || null,
    actualizadoPorId: usuarioId || null,
  });
  return obtenerConfiguracion(config.id);
};

const actualizarConfiguracion = async (id, payload, usuarioId) => {
  const config = await MetaMinimaMultaConfiguracion.findByPk(id);
  if (!config) throw createHttpError("Configuracion no encontrada", 404);

  const data = await normalizeConfigPayload(payload, config);
  const duplicate = await MetaMinimaMultaConfiguracion.findOne({
    where: {
      rolPagoId: data.rolPagoId,
      id: { [Op.ne]: config.id },
    },
  });
  if (duplicate) throw createHttpError("Ya existe una configuracion para ese rol de pago", 409);

  await config.update({ ...data, actualizadoPorId: usuarioId || null });
  return obtenerConfiguracion(config.id);
};

const cambiarEstadoConfiguracion = async (id, { activo }, usuarioId) => {
  const config = await MetaMinimaMultaConfiguracion.findByPk(id);
  if (!config) throw createHttpError("Configuracion no encontrada", 404);
  if (typeof activo !== "boolean") {
    throw createHttpError("Debe indicar activo como booleano", 400);
  }

  await config.update({ activo, actualizadoPorId: usuarioId || null });
  return obtenerConfiguracion(config.id);
};

const buildUsuarioPayload = (relacion) => {
  const usuario = relacion.usuario || {};
  const rolesPago = new Map();
  if (usuario.rolPago) rolesPago.set(Number(usuario.rolPago.id), usuario.rolPago);
  (usuario.rolesPago || []).forEach((rolPago) => rolesPago.set(Number(rolPago.id), rolPago));

  return {
    usuarioId: usuario.id,
    nombre: usuario.nombre || "Sin vendedor",
    rolPagoId: usuario.rolPagoId || null,
    fechaIngreso: usuario.fechaIngreso || null,
    fechaCreacionUsuario: usuario.createdAt ? toDateOnly(new Date(usuario.createdAt)) : null,
    rolesPago: [...rolesPago.values()].map((rolPago) => ({
      id: rolPago.id,
      cargo: rolPago.cargo,
      nivel: rolPago.nivel,
    })),
    agencias: relacion.agencia?.nombre ? [relacion.agencia.nombre] : [],
  };
};

const mergeSeller = (map, relacion) => {
  const payload = buildUsuarioPayload(relacion);
  if (!payload.usuarioId) return;

  if (!map.has(payload.usuarioId)) {
    map.set(payload.usuarioId, payload);
    return;
  }

  const current = map.get(payload.usuarioId);
  current.agencias = [...new Set([...current.agencias, ...payload.agencias].filter(Boolean))];
  const roles = new Map(current.rolesPago.map((rolPago) => [Number(rolPago.id), rolPago]));
  payload.rolesPago.forEach((rolPago) => roles.set(Number(rolPago.id), rolPago));
  current.rolesPago = [...roles.values()];
};

const resolveApplicableConfig = (seller, configsByRole) => {
  if (!seller.rolesPago.length) {
    return { config: null, estado: "SIN_CONFIGURACION", cargo: "" };
  }

  const activeMatches = seller.rolesPago
    .map((rolPago) => ({
      rolPago,
      config: configsByRole.get(Number(rolPago.id)) || null,
    }))
    .filter((item) => item.config);

  if (activeMatches.length > 1) {
    const primaryMatch = activeMatches.find(
      (item) => Number(item.rolPago.id) === Number(seller.rolPagoId),
    );
    const selectedMatch = primaryMatch || activeMatches[0];
    return {
      config: selectedMatch.config,
      estado: null,
      cargo: selectedMatch.rolPago.cargo,
      rolPagoId: selectedMatch.rolPago.id,
    };
  }
  if (activeMatches.length === 1) {
    return {
      config: activeMatches[0].config,
      estado: null,
      cargo: activeMatches[0].rolPago.cargo,
      rolPagoId: activeMatches[0].rolPago.id,
    };
  }

  const hasApplicableRole = seller.rolesPago.some((rolPago) =>
    isApplicableSellerCargo(rolPago.cargo),
  );
  return {
    config: null,
    estado: hasApplicableRole ? "SIN_CONFIGURACION" : "NO_APLICA",
    cargo: seller.rolesPago.map((rolPago) => rolPago.cargo).filter(Boolean).join(" / "),
  };
};

const obtenerMetaMinimaDashboard = async (filters = {}) => {
  const { fechaInicio, fechaFin } = parseDateRange(filters);
  const agenciaIds = parseIdList(filters.agenciaId);
  const vendedorIds = parseIdList(filters.vendedorId);
  const cierreCaja = String(filters.cierreCaja || "").trim();
  const weeks = buildCommercialWeeksForRange({ fechaInicio, fechaFin });
  const fechaInicioConsulta = weeks[0]?.startDate || fechaInicio;
  const fechaFinConsulta = weeks[weeks.length - 1]?.endDate || fechaFin;

  const usuarioAgenciaWhere = {};
  if (agenciaIds.length) usuarioAgenciaWhere.agenciaId = { [Op.in]: agenciaIds };
  if (vendedorIds.length) usuarioAgenciaWhere.usuarioId = { [Op.in]: vendedorIds };
  const detalleVentaWhere = {};
  if (cierreCaja) detalleVentaWhere.cierreCaja = cierreCaja;

  const [relaciones, ventas, configs] = await Promise.all([
    UsuarioAgencia.findAll({
      where: usuarioAgenciaWhere,
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: ["id", "nombre", "rolPagoId", "fechaIngreso", "createdAt"],
          required: true,
          include: [
            { model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"] },
            {
              model: RolPago,
              as: "rolesPago",
              attributes: ["id", "cargo", "nivel"],
              through: { attributes: [] },
            },
          ],
        },
        { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
      ],
    }),
    Venta.findAll({
      where: {
        activo: true,
        fecha: { [Op.between]: [fechaInicioConsulta, fechaFinConsulta] },
      },
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          required: true,
          where: usuarioAgenciaWhere,
          include: [
            { model: Usuario, as: "usuario", attributes: ["id", "nombre"] },
            { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
          ],
        },
        {
          model: DetalleVenta,
          as: "detalleVenta",
          attributes: ["id", "cantidad"],
          where: detalleVentaWhere,
          required: Boolean(cierreCaja),
        },
      ],
    }),
    MetaMinimaMultaConfiguracion.findAll({
      where: { activo: true },
      include: [{ model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"] }],
    }),
  ]);

  const sellersById = new Map();
  relaciones.forEach((relacion) => mergeSeller(sellersById, relacion));

  const salesBySellerWeek = new Map();
  ventas.forEach((venta) => {
    const usuarioId = venta.usuarioAgencia?.usuario?.id;
    if (!usuarioId) return;

    const weekKey = getCommercialWeekKey(venta.fecha);
    const key = `${usuarioId}:${weekKey}`;
    const units = (venta.detalleVenta || []).reduce(
      (total, detalle) => total + toNumber(detalle.cantidad),
      0,
    );
    salesBySellerWeek.set(key, toNumber(salesBySellerWeek.get(key)) + units);
    mergeSeller(sellersById, venta.usuarioAgencia);
  });

  const configsByRole = new Map(
    configs.map((config) => [Number(config.rolPagoId), serializeConfig(config)]),
  );

  const vendedores = [...sellersById.values()]
    .filter(hasApplicableSellerRole)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((seller) => {
      const resolved = resolveApplicableConfig(seller, configsByRole);
      const metaMinima = resolved.config?.minimoUnidades ?? null;
      const valorMultaUnidad = resolved.config?.valorMultaUnidad ?? null;
      const detalleSemanas = weeks.map((week) => {
        const ventasSemana = toNumber(
          salesBySellerWeek.get(`${seller.usuarioId}:${week.startDate}`),
        );
        const compliance = calculateCompliance({
          metaMinima: isNewPersonnelDuringWeek({
            fechaIngreso: seller.fechaIngreso,
            fechaCreacionUsuario: seller.fechaCreacionUsuario,
            week,
          })
            ? null
            : metaMinima,
          ventas: ventasSemana,
          valorMultaUnidad,
          estadoSinCalculo: isNewPersonnelDuringWeek({
            fechaIngreso: seller.fechaIngreso,
            fechaCreacionUsuario: seller.fechaCreacionUsuario,
            week,
          })
            ? "PERSONAL_NUEVO"
            : resolved.estado,
        });
        return {
          ...week,
          metaMinima,
          ventas: ventasSemana,
          faltan: compliance.faltan,
          valorMultaUnidad,
          multaEstimada: compliance.multaEstimada,
          estado: compliance.estado,
          personalNuevo: compliance.estado === "PERSONAL_NUEVO",
        };
      });
      const ventasTotales = detalleSemanas.reduce((total, week) => total + week.ventas, 0);
      const faltanTotal =
        metaMinima === null
          ? null
          : detalleSemanas.reduce((total, week) => total + toNumber(week.faltan), 0);
      const multaEstimada = detalleSemanas.reduce(
        (total, week) => total + toNumber(week.multaEstimada),
        0,
      );
      const estado =
        detalleSemanas.every((week) => week.estado === "PERSONAL_NUEVO")
          ? "PERSONAL_NUEVO"
          :
        metaMinima === null
          ? resolved.estado
          : detalleSemanas.some((week) => week.estado === "NO_CUMPLE")
            ? "NO_CUMPLE"
            : "CUMPLE";

      return {
        usuarioId: seller.usuarioId,
        nombre: seller.nombre,
        rolPagoId: resolved.rolPagoId || null,
        cargo: resolved.cargo || "",
        agencias: seller.agencias,
        fechaIngreso: seller.fechaIngreso,
        fechaCreacionUsuario: seller.fechaCreacionUsuario,
        metaMinima,
        ventas: ventasTotales,
        faltan: faltanTotal,
        valorMultaUnidad,
        multaEstimada,
        estado,
        configurado: Boolean(resolved.config),
        detalleSemanas,
      };
    });

  return {
    fechaInicio,
    fechaFin,
    semanas: weeks,
    vendedores,
    resumen: {
      cumplen: vendedores.filter((item) => item.estado === "CUMPLE").length,
      noCumplen: vendedores.filter((item) => item.estado === "NO_CUMPLE").length,
      sinConfiguracion: vendedores.filter((item) => item.estado === "SIN_CONFIGURACION").length,
      configuracionAmbigua: vendedores.filter((item) => item.estado === "CONFIGURACION_AMBIGUA").length,
      noAplica: vendedores.filter((item) => item.estado === "NO_APLICA").length,
      personalNuevo: vendedores.filter((item) => item.estado === "PERSONAL_NUEVO").length,
      multaEstimadaTotal: vendedores.reduce(
        (total, item) => total + toNumber(item.multaEstimada),
        0,
      ),
    },
  };
};

module.exports = {
  normalizeText,
  isVendedorPisoCargo,
  isVendedorCallCenterCargo,
  isApplicableSellerCargo,
  buildCommercialWeeksForRange,
  calculateCompliance,
  getNewPersonnelPenaltyStartDate,
  isNewPersonnelDuringWeek,
  resolveApplicableConfig,
  listarConfiguraciones,
  obtenerConfiguracion,
  crearConfiguracion,
  actualizarConfiguracion,
  cambiarEstadoConfiguracion,
  obtenerMetaMinimaDashboard,
};
