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
const SancionConfiguracion = require("../models/SancionConfiguracion");
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

const getTodayEcuador = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const isFutureCommercialWeek = (week, today = getTodayEcuador()) =>
  String(week.startDate || "").slice(0, 10) > today;

const emptyWeekValues = () => ({
  venden: 0,
  valorVendido: 0,
  totalComisiones: 0,
  noCumpleMetas: 0,
  valorDescontar: 0,
});

const emptyMonthlyValues = () => ({
  ventasTvCelulaMensual: 0,
  valorComisionSemanal: 0,
  valorComisionMensual: 0,
  totalComisionesSemanaMensual: 0,
  totalNoCumpleMetas: 0,
  totalValorDescontar: 0,
  totalPagar: 0,
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
    fechaIngreso: usuario.fechaIngreso || null,
    fechaSalida: usuario.fechaSalida || null,
    jefeComercialId: usuario.jefeComercialId || null,
    supervisorComercialId: usuario.supervisorComercialId || null,
  };
};

const isActiveDuringWeek = ({ fechaIngreso, fechaSalida, week }) => {
  const inicioSemana = String(week.startDate || "").slice(0, 10);
  const finSemana = String(week.endDate || "").slice(0, 10);
  const ingreso = fechaIngreso ? String(fechaIngreso).slice(0, 10) : null;
  const salida = fechaSalida ? String(fechaSalida).slice(0, 10) : null;
  if (ingreso && ingreso > finSemana) return false;
  if (salida && salida < inicioSemana) return false;
  return true;
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
  const isJefeComercial = cargo.includes("JEFE COMERCIAL");
  const isSupervisorComercial =
    cargo.includes("SUPERVISOR") &&
    (cargo.includes("PISO") || cargo.includes("CALL CENTER"));

  return isAsistenteVendedor || isVendedorPiso || isVendedorCallCenter ||
    isJefeComercial || isSupervisorComercial;
};

const resolveGrupoComision = (usuarioPayload) => {
  const text = normalizeText(
    `${usuarioPayload.cargo} ${usuarioPayload.nivel} ${usuarioPayload.rol}`,
  );

  if (text.includes("JEFE COMERCIAL") && text.includes("CALL CENTER")) {
    return "JEFE COMERCIAL CALL CENTER";
  }
  if (text.includes("JEFE COMERCIAL") && text.includes("PISO")) {
    return "JEFE COMERCIAL PISO";
  }
  if (text.includes("SUPERVISOR") && text.includes("CALL CENTER")) {
    return "SUPERVISOR CALL CENTER";
  }
  if (text.includes("SUPERVISOR") && text.includes("PISO")) {
    return "SUPERVISOR PISO";
  }
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

const buildWeeklyRulesByGroup = (configs) => {
  const grouped = configs
    .filter((config) => config.periodo === "COMISION_SEMANAL")
    .reduce((acc, config) => {
      const baseKey = config.rolPagoId ? `ROL:${config.rolPagoId}` : normalizeText(config.grupo);
      const subgrupo = normalizeText(config.subgrupo);
      const key = subgrupo ? `${baseKey}|SUB:${subgrupo}` : baseKey;
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

  Object.values(grouped).forEach((rules) => {
    const ordered = [...rules].sort((a, b) => a.range.min - b.range.min);
    const areThresholdTiers =
      ordered.length > 1 &&
      ordered.every(
        (rule) =>
          rule.range.max === rule.range.min &&
          rule.comisionPorEquipo !== null &&
          rule.porcentaje === null,
      );

    if (!areThresholdTiers) return;

    ordered.forEach((rule, index) => {
      const next = ordered[index + 1];
      rule.range.max = next ? next.range.min - 1 : null;
    });
  });

  return grouped;
};

const getMonthlyPeriodCandidates = (weeksCount) => [
  `BONO_MENSUAL_${weeksCount}_SEMANAS`,
  "BONO_MENSUAL",
];

const buildMonthlyRulesByGroup = (configs, weeksCount) => {
  const periodCandidates = getMonthlyPeriodCandidates(weeksCount);
  const grouped = {};

  configs.forEach((config) => {
    // El bono mensual se calcula por promedio individual y no cambia por
    // el numero de vendedores del equipo. En la matriz historica aparece
    // dentro del bloque "2 vendedores", pero aplica al grupo completo.
    const key = config.rolPagoId ? `ROL:${config.rolPagoId}` : normalizeText(config.grupo);
    const period = config.periodo;

    if (!periodCandidates.includes(period)) return;
    if (!grouped[key]) grouped[key] = {};
    if (!grouped[key][period]) {
      grouped[key][period] = {
        tiers: [],
        extraPorEquipo: 0,
      };
    }

    const valorMeta = config.promedioPorVendedor || config.unidadesVendidas;
    const unidades = normalizeText(valorMeta);
    const range = parseUnitsRule(valorMeta);

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

  const orderedTiers = [...rules.tiers].sort((a, b) => a.min - b.min);
  const tier = orderedTiers
    .filter((item) => venden >= item.min)
    .sort((a, b) => b.min - a.min)[0];

  if (!tier) return 0;

  const ultimaMeta = orderedTiers[orderedTiers.length - 1].min;
  const extra = Math.max(0, venden - ultimaMeta) * toNumber(rules.extraPorEquipo);
  return round(toNumber(tier.bono) + extra, 2);
};

const calculateLeaderAverage = ({ totalDispositivos, cantidadSemanas, cantidadJuniors }) => {
  if (!cantidadSemanas || !cantidadJuniors) return 0;
  return round(
    toNumber(totalDispositivos) / toNumber(cantidadSemanas) / toNumber(cantidadJuniors),
    3,
  );
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

const buildSanctionsByRole = (configs) => {
  const byRole = {};
  const byCargo = {};
  configs.filter((config) => config.activo && config.periodo === "SEMANAL").forEach((config) => {
    if (config.rolPagoId) byRole[Number(config.rolPagoId)] = config;
    byCargo[normalizeText(config.cargoReferencia)] = config;
  });
  return { byRole, byCargo };
};

const calculateSalesPenalty = ({ config, unidadesVendidas }) => {
  if (!config) return 0;
  const faltantes = Math.max(0, toNumber(config.minimoUnidades) - toNumber(unidadesVendidas));
  return round(faltantes * toNumber(config.valorMultaUnidad), 2);
};

const calculateMissingUnits = ({ config, unidadesVendidas }) =>
  config ? Math.max(0, toNumber(config.minimoUnidades) - toNumber(unidadesVendidas)) : 0;

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
      attributes: ["id", "nombre", "activo", "rolPagoId", "rolId", "fechaIngreso", "fechaSalida", "jefeComercialId", "supervisorComercialId"],
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
        attributes: ["id", "nombre", "activo", "rolPagoId", "rolId", "fechaIngreso", "fechaSalida", "jefeComercialId", "supervisorComercialId"],
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

const finalizarVendedor = (vendedor, weeks, weeklyRulesByGroup, monthlyRulesByGroup, sanctionsByRole) => {
  const rolKey = vendedor.rolPagoId ? `ROL:${vendedor.rolPagoId}` : null;
  const grupoKey = vendedor.grupoComision ? normalizeText(vendedor.grupoComision) : null;
  const subgrupo = vendedor.vendedoresJunior?.length
    ? `${vendedor.vendedoresJunior.length} VENDEDORES`
    : null;
  const rolSubgrupoKey = rolKey && subgrupo ? `${rolKey}|SUB:${subgrupo}` : null;
  const grupoSubgrupoKey = grupoKey && subgrupo ? `${grupoKey}|SUB:${subgrupo}` : null;
  const rules = (rolSubgrupoKey && weeklyRulesByGroup[rolSubgrupoKey]) ||
    (grupoSubgrupoKey && weeklyRulesByGroup[grupoSubgrupoKey]) ||
    (rolKey && weeklyRulesByGroup[rolKey]) || (grupoKey && weeklyRulesByGroup[grupoKey]) || [];
  const monthlyRules = (rolSubgrupoKey && monthlyRulesByGroup[rolSubgrupoKey]) ||
    (grupoSubgrupoKey && monthlyRulesByGroup[grupoSubgrupoKey]) ||
    (rolKey && monthlyRulesByGroup[rolKey]) || (grupoKey && monthlyRulesByGroup[grupoKey]) || null;
  const sanctionConfig = sanctionsByRole.byRole[Number(vendedor.rolPagoId)] || sanctionsByRole.byCargo[normalizeText(vendedor.cargo)] || null;

  vendedor.resumenMensual = emptyMonthlyValues();

  weeks.forEach((week) => {
    const values = vendedor.semanas[week.startDate];
    const semanaFutura = isFutureCommercialWeek(week);
    const commission = calculateCommission({
      rules,
      venden: values.venden,
      valorVendido: values.valorVendido,
    });

    values.valorVendido = round(values.valorVendido, 2);
    values.totalComisiones = semanaFutura ? 0 : commission.totalComisiones;
    const semanaLaborada = isActiveDuringWeek({
      fechaIngreso: vendedor.fechaIngreso,
      fechaSalida: vendedor.fechaSalida,
      week,
    });
    values.noCumpleMetas = semanaLaborada && !semanaFutura
      ? calculateMissingUnits({ config: sanctionConfig, unidadesVendidas: values.venden })
      : 0;
    values.valorDescontar = semanaLaborada && !semanaFutura
      ? calculateSalesPenalty({ config: sanctionConfig, unidadesVendidas: values.venden })
      : 0;
    values.semanaLaborada = semanaLaborada;
    values.semanaFutura = semanaFutura;

    vendedor.total.venden += values.venden;
    vendedor.total.valorVendido += values.valorVendido;
    vendedor.total.totalComisiones += values.totalComisiones;
    vendedor.total.noCumpleMetas += values.noCumpleMetas;
    vendedor.total.valorDescontar += values.valorDescontar;
  });

  vendedor.total.valorVendido = round(vendedor.total.valorVendido, 2);
  vendedor.total.totalComisiones = round(vendedor.total.totalComisiones);

  vendedor.resumenMensual.ventasTvCelulaMensual = vendedor.total.venden;
  vendedor.resumenMensual.valorComisionSemanal = vendedor.total.totalComisiones;
  const esLiderComercial = vendedor.esJefeComercial || vendedor.esSupervisorComercial;
  const promedioVentasPorJunior = esLiderComercial
    ? calculateLeaderAverage({
        totalDispositivos: vendedor.total.venden,
        cantidadSemanas: weeks.length,
        cantidadJuniors: vendedor.vendedoresJunior?.length || 0,
      })
    : null;
  const unidadesParaBono = esLiderComercial
    ? promedioVentasPorJunior
    : vendedor.total.venden;
  vendedor.resumenMensual.promedioVentasPorJunior = promedioVentasPorJunior;
  vendedor.resumenMensual.valorComisionMensual = calculateMonthlyBonus({
    rules: monthlyRules,
    venden: unidadesParaBono,
  });
  vendedor.resumenMensual.totalComisionesSemanaMensual = round(
    vendedor.resumenMensual.valorComisionSemanal +
      vendedor.resumenMensual.valorComisionMensual,
    2,
  );
  vendedor.resumenMensual.totalNoCumpleMetas = vendedor.total.noCumpleMetas;
  vendedor.resumenMensual.totalValorDescontar = round(vendedor.total.valorDescontar, 2);
  vendedor.resumenMensual.totalPagar = round(
    vendedor.resumenMensual.totalComisionesSemanaMensual -
      vendedor.resumenMensual.totalValorDescontar,
    2,
  );
};

const obtenerReportePagosComisiones = async ({ year, month }) => {
  const { numericYear, numericMonth } = parseReportPeriod({ year, month });
  const weeks = getCommercialWeeksByMonth(numericYear, numericMonth);
  const weekKeys = new Set(weeks.map((week) => week.startDate));
  const fechaInicio = weeks[0].startDate;
  const fechaFin = weeks[weeks.length - 1].endDate;

  const [relaciones, ventas, configs, sanciones] = await Promise.all([
    obtenerRelacionesVendedores(),
    obtenerVentasRango({ fechaInicio, fechaFin }),
    ComisionConfiguracion.findAll({
      where: { activo: true },
      order: [["orden", "ASC"]],
    }),
    SancionConfiguracion.findAll({ where: { activo: true, periodo: "SEMANAL" } }),
  ]);

  const weeklyRulesByGroup = buildWeeklyRulesByGroup(configs);
  const monthlyRulesByGroup = buildMonthlyRulesByGroup(configs, weeks.length);
  const sanctionsByRole = buildSanctionsByRole(sanciones);
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

  const vendedoresBase = [...vendedoresMap.values()];
  vendedoresBase.forEach((jefe) => {
    const cargo = normalizeText(jefe.cargo);
    const esJefe = cargo.includes("JEFE COMERCIAL");
    const esSupervisor = cargo.includes("SUPERVISOR");
    if (!esJefe && !esSupervisor) return;

    const juniors = vendedoresBase.filter(
      (vendedor) => Number(
        esJefe ? vendedor.jefeComercialId : vendedor.supervisorComercialId,
      ) === Number(jefe.usuarioId),
    );
    jefe.esJefeComercial = esJefe;
    jefe.esSupervisorComercial = esSupervisor;
    jefe.vendedoresJunior = juniors.map(({ usuarioId, nombre }) => ({ usuarioId, nombre }));
    jefe.semanas = buildEmptyWeeks(weeks);
    jefe.total = emptyWeekValues();

    juniors.forEach((junior) => {
      weeks.forEach((week) => {
        const origen = junior.semanas[week.startDate];
        jefe.semanas[week.startDate].venden += origen.venden;
        jefe.semanas[week.startDate].valorVendido += origen.valorVendido;
      });
    });
  });

  const vendedores = [...vendedoresMap.values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((vendedor) => {
      finalizarVendedor(vendedor, weeks, weeklyRulesByGroup, monthlyRulesByGroup, sanctionsByRole);
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
      total.semanas[week.startDate].valorDescontar += values.valorDescontar;
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
    total.resumenMensual.totalValorDescontar +=
      vendedor.resumenMensual.totalValorDescontar;
    total.resumenMensual.totalPagar += vendedor.resumenMensual.totalPagar;
  });

  weeks.forEach((week) => {
    const values = total.semanas[week.startDate];
    values.semanaFutura = isFutureCommercialWeek(week);
    values.valorVendido = round(values.valorVendido, 2);
    values.totalComisiones = round(values.totalComisiones);
    total.general.venden += values.venden;
    total.general.valorVendido += values.valorVendido;
    total.general.totalComisiones += values.totalComisiones;
    total.general.noCumpleMetas += values.noCumpleMetas;
    total.general.valorDescontar += values.valorDescontar;
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
  total.resumenMensual.totalValorDescontar = round(
    total.resumenMensual.totalValorDescontar,
    2,
  );
  total.resumenMensual.totalPagar = round(total.resumenMensual.totalPagar, 2);

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
  buildWeeklyRulesByGroup,
  buildMonthlyRulesByGroup,
  calculateCommission,
  calculateSalesPenalty,
  calculateMonthlyBonus,
  calculateLeaderAverage,
  isActiveDuringWeek,
  isFutureCommercialWeek,
  obtenerReportePagosComisiones,
};
