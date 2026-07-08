const { Op } = require("sequelize");
const Venta = require("../models/Venta");
const DetalleVenta = require("../models/DetalleVenta");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");
const RolPago = require("../models/RolPago");
const NominaEmpleado = require("../models/NominaEmpleado");
const ComisionConfiguracion = require("../models/ComisionConfiguracion");
const {
  getCommercialWeekKey,
  getCommercialWeeksByMonth,
} = require("../utils/commercialWeeks");

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

const round = (value, decimals = 3) =>
  Number((Number(value || 0)).toFixed(decimals));

const emptyWeekValues = () => ({
  venden: 0,
  valorVendido: 0,
  totalComisiones: 0,
  noCumpleMetas: 0,
});

const emptyMonthlyValues = () => ({
  ventasTvCelulaMensual: 0,
  valorComisionSemanal: 0,
  valorComisionMensual: 0,
  totalComisionesSemanaMensual: 0,
  totalNoCumpleMetas: 0,
});

const buildEmptyWeeks = (weeks) =>
  weeks.reduce((acc, week) => {
    acc[week.startDate] = emptyWeekValues();
    return acc;
  }, {});

const getDetalleValue = (detalle) => {
  const cantidad = toNumber(detalle.cantidad) || 1;
  const precioVendedor = toNumber(detalle.precioVendedor);

  return {
    cantidad,
    valor: cantidad * precioVendedor,
  };
};

const getSaleTotals = (row) => {
  const detalles = row.detalleVenta || [];

  return detalles.reduce(
    (acc, detalle) => {
      const totals = getDetalleValue(detalle);
      acc.venden += totals.cantidad;
      acc.valorVendido += totals.valor;
      return acc;
    },
    { venden: 0, valorVendido: 0 },
  );
};

const getUsuarioPayload = (usuarioAgencia) => {
  const usuario = usuarioAgencia?.usuario || {};
  const nominaEmpleado = usuarioAgencia?.nominaEmpleado || null;
  const rolPago = nominaEmpleado?.rolPago || usuario.rolPago || null;
  const rol = usuario.rol || null;
  const agencia = usuarioAgencia?.agencia || null;

  return {
    usuarioId: usuario.id,
    nombre: usuario.nombre || "Sin vendedor",
    rolPagoId: nominaEmpleado?.rolPagoId || usuario.rolPagoId || rolPago?.id || null,
    cargo: rolPago?.cargo || nominaEmpleado?.cargo || "",
    nivel: rolPago?.nivel || "",
    rol: rol?.nombre || "",
    agencias: agencia?.nombre ? [agencia.nombre] : [],
  };
};

const isCargoPagoComisionable = (usuarioPayload) => {
  const cargo = normalizeText(usuarioPayload.cargo);

  if (!usuarioPayload.rolPagoId || !cargo) return false;

  const isVendedorPiso =
    cargo === "VENDEDOR PISO" ||
    cargo === "VENDEDOR DE PISO" ||
    cargo.includes("VENDEDOR PISO") ||
    cargo.includes("VENDEDOR DE PISO");
  const isVendedorCallCenter =
    cargo === "VENDEDOR CALL CENTER" ||
    cargo === "VENDEDOR DE CALL CENTER" ||
    cargo.includes("VENDEDOR CALL CENTER") ||
    cargo.includes("VENDEDOR DE CALL CENTER");
  const isAsistenteVendedor =
    cargo === "ASISTENTE VENDEDOR" ||
    cargo.includes("ASISTENTE VENDEDOR");

  return isAsistenteVendedor || isVendedorPiso || isVendedorCallCenter;
};

const resolveGrupoComision = (usuarioPayload) => {
  const text = normalizeText(
    `${usuarioPayload.cargo} ${usuarioPayload.nivel} ${usuarioPayload.rol}`,
  );

  if (text.includes("CALL CENTER")) return "VENDEDORES DE CALL CENTER";
  if (text.includes("PISO") || text.includes("FURGONETA") || text.includes("VENDEDOR")) {
    return "VENDEDORES DE PISO Y FURGONETA";
  }

  return null;
};

const parseUnitsRule = (value) => {
  const raw = normalizeText(
    String(value || "").replace(/\u00e2\u20ac\u00a6|\u2026/g, "..."),
  ).replace(/,/g, ".");
  const numbers = raw.match(/\d+(?:\.\d+)?/g);

  if (!numbers?.length) return null;

  const min = Number(numbers[0]);
  const hasRange = raw.includes("-") || raw.includes(" A ");
  const isOpenEnded = raw.includes("...") || raw.includes("MAS") || raw.includes("EN ADELANTE");
  const max = hasRange && numbers[1] ? Number(numbers[1]) : isOpenEnded ? null : min;

  if (!Number.isFinite(min)) return null;

  return {
    min,
    max: Number.isFinite(max) ? max : null,
  };
};

const buildWeeklyRulesByGroup = (configs) =>
  configs
    .filter((config) => config.periodo === "COMISION_SEMANAL")
    .reduce((acc, config) => {
      const key = normalizeText(config.grupo);
      if (!acc[key]) acc[key] = [];

      const range = parseUnitsRule(config.unidadesVendidas);
      if (range) {
        acc[key].push({
          range,
          comisionPorEquipo:
            config.comisionPorEquipo === null ? null : toNumber(config.comisionPorEquipo),
          porcentaje: config.porcentaje === null ? null : toNumber(config.porcentaje),
        });
      }

      return acc;
    }, {});

const getMonthlyPeriodCandidates = (weeksCount) => [
  `BONO_MENSUAL_${weeksCount}_SEMANAS`,
  "BONO_MENSUAL",
];

const buildMonthlyRulesByGroup = (configs, weeksCount) => {
  const periodCandidates = getMonthlyPeriodCandidates(weeksCount);
  const grouped = {};

  configs.forEach((config) => {
    const key = normalizeText(config.grupo);
    const period = config.periodo;

    if (!periodCandidates.includes(period)) return;
    if (!grouped[key]) grouped[key] = {};
    if (!grouped[key][period]) {
      grouped[key][period] = {
        tiers: [],
        extraPorEquipo: 0,
      };
    }

    const unidades = normalizeText(config.unidadesVendidas);
    const range = parseUnitsRule(config.unidadesVendidas);

    if (range) {
      grouped[key][period].tiers.push({
        min: range.min,
        bono: toNumber(config.bono),
      });
    } else if (unidades.includes("EQUIPO EXTRA")) {
      grouped[key][period].extraPorEquipo = toNumber(config.bono);
    }
  });

  return Object.entries(grouped).reduce((acc, [group, periods]) => {
    const selectedPeriod = periodCandidates.find((period) => periods[period]);
    if (!selectedPeriod) return acc;

    acc[group] = {
      ...periods[selectedPeriod],
      periodo: selectedPeriod,
      tiers: periods[selectedPeriod].tiers.sort((a, b) => a.min - b.min),
    };
    return acc;
  }, {});
};

const findRule = (rules, unidades) => {
  const candidates = rules.filter((rule) => {
    if (unidades < rule.range.min) return false;
    if (rule.range.max === null) return true;
    return unidades <= rule.range.max;
  });

  return candidates.sort((a, b) => b.range.min - a.range.min)[0] || null;
};

const getMinimumMeta = (rules) => {
  const metas = rules.map((rule) => rule.range.min).filter(Number.isFinite);
  return metas.length ? Math.min(...metas) : 0;
};

const calculateMonthlyBonus = ({ rules, venden }) => {
  if (!rules?.tiers?.length) return 0;

  const tier = [...rules.tiers]
    .filter((item) => venden >= item.min)
    .sort((a, b) => b.min - a.min)[0];

  if (!tier) return 0;

  const extra = Math.max(0, venden - tier.min) * toNumber(rules.extraPorEquipo);
  return round(toNumber(tier.bono) + extra, 2);
};

const calculateCommission = ({ rules, venden, valorVendido }) => {
  const rule = findRule(rules, venden);
  const metaMinima = getMinimumMeta(rules);

  if (!rule) {
    return {
      totalComisiones: 0,
      noCumpleMetas: venden > 0 && metaMinima ? Math.max(0, metaMinima - venden) : 0,
    };
  }

  if (rule.porcentaje !== null && rule.porcentaje !== undefined) {
    return {
      totalComisiones: round(valorVendido * rule.porcentaje),
      noCumpleMetas: 0,
    };
  }

  return {
    totalComisiones: round(venden * toNumber(rule.comisionPorEquipo)),
    noCumpleMetas: 0,
  };
};

const parseReportPeriod = ({ year, month }) => {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth)) {
    const error = new Error("Debe enviar year y month como numeros");
    error.statusCode = 400;
    throw error;
  }

  if (numericMonth < 1 || numericMonth > 12) {
    const error = new Error("El mes debe estar entre 1 y 12");
    error.statusCode = 400;
    throw error;
  }

  return { numericYear, numericMonth };
};

const mergeAgencias = (current = [], incoming = []) =>
  [...new Set([...current, ...incoming].filter(Boolean))].sort();

const ensureVendedor = (map, usuarioPayload, weeks) => {
  if (!usuarioPayload.usuarioId) return null;
  if (!isCargoPagoComisionable(usuarioPayload)) return null;

  if (!map.has(usuarioPayload.usuarioId)) {
    map.set(usuarioPayload.usuarioId, {
      ...usuarioPayload,
      grupoComision: resolveGrupoComision(usuarioPayload),
      semanas: buildEmptyWeeks(weeks),
      total: emptyWeekValues(),
    });
  } else {
    const vendedor = map.get(usuarioPayload.usuarioId);
    vendedor.agencias = mergeAgencias(vendedor.agencias, usuarioPayload.agencias);
    if (!vendedor.cargo && usuarioPayload.cargo) vendedor.cargo = usuarioPayload.cargo;
    if (!vendedor.nivel && usuarioPayload.nivel) vendedor.nivel = usuarioPayload.nivel;
    if (!vendedor.rol && usuarioPayload.rol) vendedor.rol = usuarioPayload.rol;
    if (!vendedor.grupoComision) {
      vendedor.grupoComision = resolveGrupoComision(vendedor);
    }
  }

  return map.get(usuarioPayload.usuarioId);
};

const buildIncludeUsuarioAgencia = () => ({
  model: UsuarioAgencia,
  as: "usuarioAgencia",
  required: true,
  include: [
    {
      model: Usuario,
      as: "usuario",
      attributes: ["id", "nombre", "activo", "rolPagoId", "rolId"],
      include: [
        { model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"] },
        { model: Rol, as: "rol", attributes: ["id", "nombre"] },
      ],
    },
    { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
    {
      model: NominaEmpleado,
      as: "nominaEmpleado",
      attributes: ["id", "rolPagoId", "cargo", "sueldo", "estado"],
      required: false,
      include: [
        { model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"] },
      ],
    },
  ],
});

const obtenerRelacionesVendedores = async () =>
  UsuarioAgencia.findAll({
    where: { activo: true },
    include: [
      {
        model: Usuario,
        as: "usuario",
        attributes: ["id", "nombre", "activo", "rolPagoId", "rolId"],
        where: { activo: true },
        include: [
          { model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"] },
          { model: Rol, as: "rol", attributes: ["id", "nombre"] },
        ],
      },
      { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
      {
        model: NominaEmpleado,
        as: "nominaEmpleado",
        attributes: ["id", "rolPagoId", "cargo", "sueldo", "estado"],
        required: false,
        include: [
          { model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"] },
        ],
      },
    ],
  });

const obtenerVentasRango = async ({ fechaInicio, fechaFin }) => {
  const ventas = await Venta.findAll({
    where: {
      activo: true,
      fecha: { [Op.between]: [fechaInicio, fechaFin] },
    },
    include: [
      buildIncludeUsuarioAgencia(),
      {
        model: DetalleVenta,
        as: "detalleVenta",
        attributes: ["id", "cantidad", "precioVendedor"],
      },
    ],
  });

  return ventas.map((venta) => ({ ...venta.toJSON(), origenReporte: "Venta" }));
};

const finalizarVendedor = (vendedor, weeks, weeklyRulesByGroup, monthlyRulesByGroup) => {
  const rules = vendedor.grupoComision
    ? weeklyRulesByGroup[normalizeText(vendedor.grupoComision)] || []
    : [];
  const monthlyRules = vendedor.grupoComision
    ? monthlyRulesByGroup[normalizeText(vendedor.grupoComision)] || null
    : null;

  vendedor.resumenMensual = emptyMonthlyValues();

  weeks.forEach((week) => {
    const values = vendedor.semanas[week.startDate];
    const commission = calculateCommission({
      rules,
      venden: values.venden,
      valorVendido: values.valorVendido,
    });

    values.valorVendido = round(values.valorVendido, 2);
    values.totalComisiones = commission.totalComisiones;
    values.noCumpleMetas = commission.noCumpleMetas;

    vendedor.total.venden += values.venden;
    vendedor.total.valorVendido += values.valorVendido;
    vendedor.total.totalComisiones += values.totalComisiones;
    vendedor.total.noCumpleMetas += values.noCumpleMetas;
  });

  vendedor.total.valorVendido = round(vendedor.total.valorVendido, 2);
  vendedor.total.totalComisiones = round(vendedor.total.totalComisiones);

  vendedor.resumenMensual.ventasTvCelulaMensual = vendedor.total.venden;
  vendedor.resumenMensual.valorComisionSemanal = vendedor.total.totalComisiones;
  vendedor.resumenMensual.valorComisionMensual = calculateMonthlyBonus({
    rules: monthlyRules,
    venden: vendedor.total.venden,
  });
  vendedor.resumenMensual.totalComisionesSemanaMensual = round(
    vendedor.resumenMensual.valorComisionSemanal +
      vendedor.resumenMensual.valorComisionMensual,
    2,
  );
  vendedor.resumenMensual.totalNoCumpleMetas = vendedor.total.noCumpleMetas;
};

const obtenerReportePagosComisiones = async ({ year, month }) => {
  const { numericYear, numericMonth } = parseReportPeriod({ year, month });
  const weeks = getCommercialWeeksByMonth(numericYear, numericMonth);
  const weekKeys = new Set(weeks.map((week) => week.startDate));
  const fechaInicio = weeks[0].startDate;
  const fechaFin = weeks[weeks.length - 1].endDate;

  const [relaciones, ventas, configs] = await Promise.all([
    obtenerRelacionesVendedores(),
    obtenerVentasRango({ fechaInicio, fechaFin }),
    ComisionConfiguracion.findAll({
      where: { activo: true },
      order: [["orden", "ASC"]],
    }),
  ]);

  const weeklyRulesByGroup = buildWeeklyRulesByGroup(configs);
  const monthlyRulesByGroup = buildMonthlyRulesByGroup(configs, weeks.length);
  const vendedoresMap = new Map();

  relaciones.forEach((relacion) => {
    const usuarioPayload = getUsuarioPayload(relacion);
    if (isCargoPagoComisionable(usuarioPayload)) {
      ensureVendedor(vendedoresMap, usuarioPayload, weeks);
    }
  });

  ventas.forEach((venta) => {
    const weekKey = getCommercialWeekKey(venta.fecha);
    if (!weekKeys.has(weekKey)) return;

    const usuarioPayload = getUsuarioPayload(venta.usuarioAgencia);
    if (!isCargoPagoComisionable(usuarioPayload)) return;

    const vendedor = ensureVendedor(vendedoresMap, usuarioPayload, weeks);
    if (!vendedor) return;

    const totals = getSaleTotals(venta);
    vendedor.semanas[weekKey].venden += totals.venden;
    vendedor.semanas[weekKey].valorVendido += totals.valorVendido;
  });

  const vendedores = [...vendedoresMap.values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((vendedor) => {
      finalizarVendedor(vendedor, weeks, weeklyRulesByGroup, monthlyRulesByGroup);
      return vendedor;
    });

  const total = {
    semanas: buildEmptyWeeks(weeks),
    general: emptyWeekValues(),
    resumenMensual: emptyMonthlyValues(),
  };

  vendedores.forEach((vendedor) => {
    weeks.forEach((week) => {
      const values = vendedor.semanas[week.startDate];
      total.semanas[week.startDate].venden += values.venden;
      total.semanas[week.startDate].valorVendido += values.valorVendido;
      total.semanas[week.startDate].totalComisiones += values.totalComisiones;
      total.semanas[week.startDate].noCumpleMetas += values.noCumpleMetas;
    });

    total.resumenMensual.ventasTvCelulaMensual +=
      vendedor.resumenMensual.ventasTvCelulaMensual;
    total.resumenMensual.valorComisionSemanal +=
      vendedor.resumenMensual.valorComisionSemanal;
    total.resumenMensual.valorComisionMensual +=
      vendedor.resumenMensual.valorComisionMensual;
    total.resumenMensual.totalComisionesSemanaMensual +=
      vendedor.resumenMensual.totalComisionesSemanaMensual;
    total.resumenMensual.totalNoCumpleMetas +=
      vendedor.resumenMensual.totalNoCumpleMetas;
  });

  weeks.forEach((week) => {
    const values = total.semanas[week.startDate];
    values.valorVendido = round(values.valorVendido, 2);
    values.totalComisiones = round(values.totalComisiones);
    total.general.venden += values.venden;
    total.general.valorVendido += values.valorVendido;
    total.general.totalComisiones += values.totalComisiones;
    total.general.noCumpleMetas += values.noCumpleMetas;
  });

  total.general.valorVendido = round(total.general.valorVendido, 2);
  total.general.totalComisiones = round(total.general.totalComisiones);
  total.resumenMensual.valorComisionSemanal = round(
    total.resumenMensual.valorComisionSemanal,
  );
  total.resumenMensual.valorComisionMensual = round(
    total.resumenMensual.valorComisionMensual,
    2,
  );
  total.resumenMensual.totalComisionesSemanaMensual = round(
    total.resumenMensual.totalComisionesSemanaMensual,
    2,
  );

  return {
    year: numericYear,
    month: numericMonth,
    fechaInicio,
    fechaFin,
    weeks,
    vendedores,
    total,
  };
};

module.exports = {
  isCargoPagoComisionable,
  obtenerReportePagosComisiones,
};
