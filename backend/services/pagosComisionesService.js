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
const PagoComisionMultaAjuste = require("../models/PagoComisionMultaAjuste");
const {
  addDays,
  getCommercialWeekKey,
  getCommercialWeeksByMonth,
  parseLocalDateOnly,
  toDateOnly,
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

const getPositionLevelRank = ({ nivel, cargo } = {}) => {
  const position = normalizeText(`${nivel || ""} ${cargo || ""}`);

  if (position.includes("GERENTE")) return 6;
  if (position.includes("JEFE")) return 5;
  if (position.includes("SUPERVISOR")) return 4;
  if (position.includes("ESPECIALISTA")) return 3;
  if (position.includes("ENCARGADO") || position.includes("TECNICO")) return 2;
  if (position.includes("ASISTENTE") || position.includes("VENDEDOR")) return 1;
  return 0;
};

const buildPaidPosition = ({
  rolPago,
  rolPagoId,
  cargo,
  nivel,
  sueldo,
} = {}) => {
  const position = {
    rolPagoId: rolPago?.id || rolPagoId || null,
    cargo: rolPago?.cargo || cargo || "",
    nivel: rolPago?.nivel || nivel || "",
  };
  if (!position.rolPagoId || !position.cargo) return null;

  const sueldoRol =
    toNumber(rolPago?.sueldoBase) + toNumber(rolPago?.sueldoExtra);

  return {
    ...position,
    remuneracionReferencia: Math.max(
      toNumber(rolPago?.ingresoMax),
      sueldoRol,
      toNumber(sueldo),
    ),
    nivelJerarquia: getPositionLevelRank(position),
  };
};

const selectHighestPaidPosition = (positions = []) =>
  positions
    .filter(Boolean)
    .sort(
      (left, right) =>
        toNumber(right.remuneracionReferencia) -
          toNumber(left.remuneracionReferencia) ||
        toNumber(right.nivelJerarquia) - toNumber(left.nivelJerarquia),
    )[0] || null;

const getDistinctPaidPositions = (positions = []) => {
  const positionsByRole = new Map();

  positions.filter(Boolean).forEach((position) => {
    const key = position.rolPagoId
      ? `ROL:${Number(position.rolPagoId)}`
      : `CARGO:${normalizeText(position.cargo)}`;
    const current = positionsByRole.get(key);
    const preferred = selectHighestPaidPosition([current, position]);
    if (preferred) positionsByRole.set(key, preferred);
  });

  return [...positionsByRole.values()];
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

const getDateOnlyEcuador = (input) => {
  if (!input) return null;
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
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

const buildPersonalSellerView = ({ vendedor, weeks, semanasPersonales }) => {
  const semanas = buildEmptyWeeks(weeks);
  const total = emptyWeekValues();

  weeks.forEach((week) => {
    const source = semanasPersonales?.[week.startDate] || emptyWeekValues();
    const values = semanas[week.startDate];
    values.venden = toNumber(source.venden);
    values.valorVendido = round(source.valorVendido, 2);
    values.totalComisiones = 0;
    values.noCumpleMetas = 0;
    values.valorMultaCalculado = 0;
    values.valorDescontar = 0;
    values.multaOmitida = false;
    values.personalNuevo = isNewPersonnelDuringWeek({
      fechaCreacionUsuario: vendedor.fechaCreacionUsuario,
      week,
    });
    values.semanaLaborada = isActiveDuringWeek({
      fechaIngreso: vendedor.fechaIngreso || vendedor.fechaCreacionUsuario,
      fechaSalida: vendedor.fechaSalida,
      week,
    });
    values.semanaCompletaParaDescuento = isActiveFullWeek({
      fechaIngreso: vendedor.fechaIngreso || vendedor.fechaCreacionUsuario,
      fechaSalida: vendedor.fechaSalida,
      week,
    });
    values.semanaFutura = isFutureCommercialWeek(week);

    total.venden += values.venden;
    total.valorVendido += values.valorVendido;
  });

  total.valorVendido = round(total.valorVendido, 2);
  return {
    semanas,
    total,
    resumenMensual: {
      ...emptyMonthlyValues(),
      ventasTvCelulaMensual: total.venden,
    },
  };
};

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
  const posicionesPago = getDistinctPaidPositions([
    buildPaidPosition({
      rolPago: nominaEmpleado?.rolPago,
      rolPagoId: nominaEmpleado?.rolPagoId,
      cargo: nominaEmpleado?.cargo,
      sueldo: nominaEmpleado?.sueldo,
    }),
    buildPaidPosition({ rolPago: usuario.rolPago }),
    ...(usuario.rolesPago || []).map((rolPago) =>
      buildPaidPosition({ rolPago }),
    ),
  ]);
  const cargoPrincipal = selectHighestPaidPosition(posicionesPago);
  const rol = usuario.rol || null;
  const agencia = usuarioAgencia?.agencia || null;

  return {
    usuarioId: usuario.id,
    nombre: usuario.nombre || "Sin vendedor",
    rolPagoId: cargoPrincipal?.rolPagoId || null,
    cargo: cargoPrincipal?.cargo || "",
    nivel: cargoPrincipal?.nivel || "",
    prioridadCargo: cargoPrincipal?.remuneracionReferencia || 0,
    nivelJerarquiaCargo: cargoPrincipal?.nivelJerarquia || 0,
    posicionesPago,
    tieneMultiplesCargos: posicionesPago.length > 1,
    rol: rol?.nombre || "",
    agencias: agencia?.nombre ? [agencia.nombre] : [],
    fechaIngreso: usuario.fechaIngreso || null,
    fechaSalida: usuario.fechaSalida || null,
    fechaCreacionUsuario: getDateOnlyEcuador(usuario.createdAt),
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

const isActiveFullWeek = ({ fechaIngreso, fechaSalida, week }) => {
  const inicioSemana = String(week.startDate || "").slice(0, 10);
  const finSemana = String(week.endDate || "").slice(0, 10);
  const ingreso = fechaIngreso ? String(fechaIngreso).slice(0, 10) : null;
  const salida = fechaSalida ? String(fechaSalida).slice(0, 10) : null;
  if (ingreso && ingreso > inicioSemana) return false;
  if (salida && salida < finSemana) return false;
  return true;
};

const getActiveTeamMembersForWeek = (members, week) =>
  members.filter((member) => {
    const inicioSemana = String(week.startDate || "").slice(0, 10);
    const finSemana = String(week.endDate || "").slice(0, 10);
    const ingreso = member.fechaIngreso || member.fechaCreacionUsuario;
    const fechaIngreso = ingreso ? String(ingreso).slice(0, 10) : null;
    const fechaSalida = member.fechaSalida
      ? String(member.fechaSalida).slice(0, 10)
      : null;

    if (fechaIngreso && fechaIngreso > inicioSemana) return false;
    if (fechaSalida && fechaSalida <= finSemana) return false;
    return true;
  });

const getCommissionTeamMembersForWeek = ({ members, week, esSupervisor }) =>
  esSupervisor
    ? getActiveTeamMembersForWeek(members, week)
    : members.filter((member) =>
        isActiveDuringWeek({
          fechaIngreso: member.fechaIngreso || member.fechaCreacionUsuario,
          fechaSalida: member.fechaSalida,
          week,
        }),
      );

const getCommissionTeamProductionForWeek = ({
  members,
  week,
  esSupervisor,
}) => {
  const integrantes = getCommissionTeamMembersForWeek({
    members,
    week,
    esSupervisor,
  });

  return integrantes.reduce(
    (production, member) => {
      const values = member.semanas?.[week.startDate] || emptyWeekValues();
      production.venden += toNumber(values.venden);
      production.valorVendido += toNumber(values.valorVendido);
      production.dispositivosPorVendedor.push({
        usuarioId: member.usuarioId,
        nombre: member.nombre,
        venden: toNumber(values.venden),
        valorVendido: round(values.valorVendido, 2),
        esLiderVendedor: Boolean(member.esLiderVendedor),
        tieneMultiplesCargos: Boolean(member.tieneMultiplesCargos),
      });
      return production;
    },
    {
      integrantes,
      dispositivosPorVendedor: [],
      venden: 0,
      valorVendido: 0,
    },
  );
};

const getNewPersonnelPenaltyStartDate = (fechaCreacionUsuario) => {
  const fechaCreacion = getDateOnlyEcuador(fechaCreacionUsuario);
  if (!fechaCreacion) return null;
  return toDateOnly(addDays(parseLocalDateOnly(fechaCreacion), 30));
};

const isNewPersonnelDuringWeek = ({ fechaCreacionUsuario, week }) => {
  const fechaInicioMultas = getNewPersonnelPenaltyStartDate(fechaCreacionUsuario);
  if (!fechaInicioMultas) return false;
  const inicioSemana = String(week.startDate || "").slice(0, 10);
  return inicioSemana < fechaInicioMultas;
};

const isActiveDuringPeriod = ({ fechaIngreso, fechaSalida, fechaInicio, fechaFin }) => {
  const ingreso = fechaIngreso ? String(fechaIngreso).slice(0, 10) : null;
  const salida = fechaSalida ? String(fechaSalida).slice(0, 10) : null;
  if (ingreso && ingreso > fechaFin) return false;
  if (salida && salida < fechaInicio) return false;
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

const getCommissionablePaidPosition = (usuarioPayload) =>
  selectHighestPaidPosition(
    (usuarioPayload.posicionesPago?.length
      ? usuarioPayload.posicionesPago
      : [usuarioPayload]
    ).filter((position) => isCargoPagoComisionable(position)),
  );

const hasCommissionablePaidPosition = (usuarioPayload) =>
  Boolean(getCommissionablePaidPosition(usuarioPayload));

const isIndividualSellerPosition = (position) => {
  const cargo = normalizeText(position?.cargo);
  return (
    cargo.includes("VENDEDOR") &&
    !cargo.includes("JEFE") &&
    !cargo.includes("SUPERVISOR")
  );
};

const getLeaderCommissionMembers = ({ leader, juniors }) => {
  const membersByUser = new Map(
    juniors
      .filter(
        (member) => Number(member.usuarioId) !== Number(leader.usuarioId),
      )
      .map((member) => [Number(member.usuarioId), member]),
  );
  const liderTambienEsVendedor =
    leader.tieneMultiplesCargos &&
    (leader.posicionesPago || []).some(isIndividualSellerPosition);

  if (liderTambienEsVendedor) {
    membersByUser.set(Number(leader.usuarioId), {
      ...leader,
      esLiderVendedor: true,
    });
  }

  return [...membersByUser.values()];
};

const getLeaderBonusExclusionReasons = ({ member, weeks }) => {
  const reasons = [];
  if (member.tieneMultiplesCargos) reasons.push("Doble cargo");
  if (member.fechaSalida) reasons.push("Fecha de salida");
  if (
    weeks.some((week) =>
      isNewPersonnelDuringWeek({
        fechaCreacionUsuario: member.fechaCreacionUsuario,
        week,
      }),
    )
  ) {
    reasons.push("Personal nuevo");
  }
  return reasons;
};

const getLeaderBonusTeam = ({ members, weeks }) =>
  members.reduce(
    (team, member) => {
      const reasons = getLeaderBonusExclusionReasons({ member, weeks });
      if (reasons.length) {
        team.excluded.push({
          usuarioId: member.usuarioId,
          nombre: member.nombre,
          razones: reasons,
        });
      } else {
        team.included.push(member);
      }
      return team;
    },
    { included: [], excluded: [] },
  );

const applyCommissionPosition = (vendedor) => {
  const position = getCommissionablePaidPosition(vendedor);
  vendedor.rolPagoComisionId = position?.rolPagoId || null;
  vendedor.cargoComision = position?.cargo || "";
  vendedor.nivelComision = position?.nivel || "";
  vendedor.grupoComision = position
    ? resolveGrupoComision({
        ...vendedor,
        cargo: position.cargo,
        nivel: position.nivel,
      })
    : null;
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

const calculateLeaderAverage = ({
  totalDispositivos,
  cantidadSemanas,
  cantidadJuniors,
  totalVendedoresSemanas,
}) => {
  const usaConteoSemanal =
    totalVendedoresSemanas !== null && totalVendedoresSemanas !== undefined;
  const divisor = usaConteoSemanal
    ? toNumber(totalVendedoresSemanas)
    : toNumber(cantidadSemanas) * toNumber(cantidadJuniors);
  if (!divisor) return 0;
  return round(toNumber(totalDispositivos) / divisor, 3);
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

const resolveSalesSanctionConfig = (vendedor, sanctionsByRole) => {
  if (vendedor.tieneMultiplesCargos) return null;

  const cargo = normalizeText(vendedor.cargo);
  const esLiderComercial =
    cargo.includes("JEFE COMERCIAL") || cargo.includes("SUPERVISOR");
  if (esLiderComercial) return null;

  return (
    sanctionsByRole.byRole[Number(vendedor.rolPagoId)] ||
    sanctionsByRole.byCargo[cargo] ||
    null
  );
};

const calculateSalesPenalty = ({ config, unidadesVendidas }) => {
  if (!config) return 0;
  const faltantes = Math.max(0, toNumber(config.minimoUnidades) - toNumber(unidadesVendidas));
  return round(faltantes * toNumber(config.valorMultaUnidad), 2);
};

const calculateMissingUnits = ({ config, unidadesVendidas }) =>
  config ? Math.max(0, toNumber(config.minimoUnidades) - toNumber(unidadesVendidas)) : 0;

const calculateWeeklyPenalty = ({
  config,
  unidadesVendidas,
  aplicaDescuento,
  multaOmitida,
}) => {
  if (!aplicaDescuento) {
    return {
      noCumpleMetas: 0,
      valorMultaCalculado: 0,
      valorDescontar: 0,
      multaOmitida: false,
    };
  }

  const noCumpleMetas = calculateMissingUnits({ config, unidadesVendidas });
  const valorMultaCalculado = calculateSalesPenalty({ config, unidadesVendidas });
  const omisionAplicada = Boolean(multaOmitida && valorMultaCalculado > 0);

  return {
    noCumpleMetas,
    valorMultaCalculado,
    valorDescontar: omisionAplicada ? 0 : valorMultaCalculado,
    multaOmitida: omisionAplicada,
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
  if (!hasCommissionablePaidPosition(usuarioPayload)) return null;

  if (!map.has(usuarioPayload.usuarioId)) {
    const vendedor = {
      ...usuarioPayload,
      semanas: buildEmptyWeeks(weeks),
      total: emptyWeekValues(),
    };
    applyCommissionPosition(vendedor);
    map.set(usuarioPayload.usuarioId, vendedor);
  } else {
    const vendedor = map.get(usuarioPayload.usuarioId);
    vendedor.agencias = mergeAgencias(vendedor.agencias, usuarioPayload.agencias);
    vendedor.posicionesPago = getDistinctPaidPositions([
      ...(vendedor.posicionesPago || []),
      ...(usuarioPayload.posicionesPago || []),
    ]);
    const cargoPrincipal = selectHighestPaidPosition(vendedor.posicionesPago);
    if (cargoPrincipal) {
      vendedor.rolPagoId = cargoPrincipal.rolPagoId;
      vendedor.cargo = cargoPrincipal.cargo;
      vendedor.nivel = cargoPrincipal.nivel;
      vendedor.prioridadCargo = cargoPrincipal.remuneracionReferencia;
      vendedor.nivelJerarquiaCargo = cargoPrincipal.nivelJerarquia;
    }
    vendedor.tieneMultiplesCargos = vendedor.posicionesPago.length > 1;
    if (!vendedor.rol && usuarioPayload.rol) vendedor.rol = usuarioPayload.rol;
    applyCommissionPosition(vendedor);
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
      attributes: ["id", "nombre", "activo", "rolPagoId", "rolId", "fechaIngreso", "fechaSalida", "createdAt", "jefeComercialId", "supervisorComercialId"],
      include: [
        {
          model: RolPago,
          as: "rolPago",
          attributes: [
            "id",
            "cargo",
            "nivel",
            "sueldoBase",
            "sueldoExtra",
            "ingresoMax",
          ],
        },
        {
          model: RolPago,
          as: "rolesPago",
          attributes: [
            "id",
            "cargo",
            "nivel",
            "sueldoBase",
            "sueldoExtra",
            "ingresoMax",
          ],
          through: { attributes: [] },
        },
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
        {
          model: RolPago,
          as: "rolPago",
          attributes: [
            "id",
            "cargo",
            "nivel",
            "sueldoBase",
            "sueldoExtra",
            "ingresoMax",
          ],
        },
      ],
    },
  ],
});

const obtenerRelacionesVendedores = async () =>
  UsuarioAgencia.findAll({
    include: [
      {
        model: Usuario,
        as: "usuario",
        attributes: ["id", "nombre", "activo", "rolPagoId", "rolId", "fechaIngreso", "fechaSalida", "createdAt", "jefeComercialId", "supervisorComercialId"],
        include: [
          {
            model: RolPago,
            as: "rolPago",
            attributes: [
              "id",
              "cargo",
              "nivel",
              "sueldoBase",
              "sueldoExtra",
              "ingresoMax",
            ],
          },
          {
            model: RolPago,
            as: "rolesPago",
            attributes: [
              "id",
              "cargo",
              "nivel",
              "sueldoBase",
              "sueldoExtra",
              "ingresoMax",
            ],
            through: { attributes: [] },
          },
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
          {
            model: RolPago,
            as: "rolPago",
            attributes: [
              "id",
              "cargo",
              "nivel",
              "sueldoBase",
              "sueldoExtra",
              "ingresoMax",
            ],
          },
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

const getPenaltyAdjustmentKey = (usuarioId, semanaInicio) =>
  `${Number(usuarioId)}:${String(semanaInicio).slice(0, 10)}`;

const buildPenaltyAdjustmentsMap = (adjustments) =>
  adjustments.reduce((map, adjustment) => {
    map.set(
      getPenaltyAdjustmentKey(adjustment.usuarioId, adjustment.semanaInicio),
      Boolean(adjustment.omitida),
    );
    return map;
  }, new Map());

const finalizarVendedor = (
  vendedor,
  weeks,
  weeklyRulesByGroup,
  monthlyRulesByGroup,
  sanctionsByRole,
  penaltyAdjustments,
) => {
  const rolComisionId = vendedor.rolPagoComisionId || vendedor.rolPagoId;
  const rolKey = rolComisionId ? `ROL:${rolComisionId}` : null;
  const grupoKey = vendedor.grupoComision ? normalizeText(vendedor.grupoComision) : null;
  const cantidadVendedoresMensual = vendedor.esJefeComercial
    ? vendedor.vendedoresBono?.length || 0
    : vendedor.vendedoresJunior?.length || 0;
  const subgrupoMensual = cantidadVendedoresMensual
    ? `${cantidadVendedoresMensual} VENDEDORES`
    : null;
  const rolSubgrupoMensualKey = rolKey && subgrupoMensual
    ? `${rolKey}|SUB:${subgrupoMensual}`
    : null;
  const grupoSubgrupoMensualKey = grupoKey && subgrupoMensual
    ? `${grupoKey}|SUB:${subgrupoMensual}`
    : null;
  const monthlyRules =
    (rolSubgrupoMensualKey && monthlyRulesByGroup[rolSubgrupoMensualKey]) ||
    (grupoSubgrupoMensualKey && monthlyRulesByGroup[grupoSubgrupoMensualKey]) ||
    (rolKey && monthlyRulesByGroup[rolKey]) || (grupoKey && monthlyRulesByGroup[grupoKey]) || null;
  const sanctionConfig = resolveSalesSanctionConfig(
    vendedor,
    sanctionsByRole,
  );

  vendedor.resumenMensual = emptyMonthlyValues();

  weeks.forEach((week) => {
    const values = vendedor.semanas[week.startDate];
    const semanaFutura = isFutureCommercialWeek(week);
    const cantidadVendedoresSemana = Number.isFinite(
      Number(values.cantidadVendedores),
    )
      ? Number(values.cantidadVendedores)
      : vendedor.vendedoresJunior?.length || 0;
    const subgrupoSemanal = cantidadVendedoresSemana
      ? `${cantidadVendedoresSemana} VENDEDORES`
      : null;
    const rolSubgrupoSemanalKey = rolKey && subgrupoSemanal
      ? `${rolKey}|SUB:${subgrupoSemanal}`
      : null;
    const grupoSubgrupoSemanalKey = grupoKey && subgrupoSemanal
      ? `${grupoKey}|SUB:${subgrupoSemanal}`
      : null;
    const weeklyRules =
      (rolSubgrupoSemanalKey && weeklyRulesByGroup[rolSubgrupoSemanalKey]) ||
      (grupoSubgrupoSemanalKey && weeklyRulesByGroup[grupoSubgrupoSemanalKey]) ||
      (rolKey && weeklyRulesByGroup[rolKey]) ||
      (grupoKey && weeklyRulesByGroup[grupoKey]) ||
      [];
    const commission = calculateCommission({
      rules: weeklyRules,
      venden: values.venden,
      valorVendido: values.valorVendido,
    });

    values.valorVendido = round(values.valorVendido, 2);
    values.totalComisiones = semanaFutura ? 0 : commission.totalComisiones;
    const semanaLaborada = isActiveDuringWeek({
      fechaIngreso: vendedor.fechaIngreso || vendedor.fechaCreacionUsuario,
      fechaSalida: vendedor.fechaSalida,
      week,
    });
    const semanaCompletaParaDescuento = isActiveFullWeek({
      fechaIngreso: vendedor.fechaIngreso || vendedor.fechaCreacionUsuario,
      fechaSalida: vendedor.fechaSalida,
      week,
    });
    const personalNuevo =
      semanaLaborada &&
      !semanaFutura &&
      isNewPersonnelDuringWeek({
        fechaCreacionUsuario: vendedor.fechaCreacionUsuario,
        week,
      });
    const multaOmitida = penaltyAdjustments.get(
      getPenaltyAdjustmentKey(vendedor.usuarioId, week.startDate),
    );
    const penalty = calculateWeeklyPenalty({
      config: sanctionConfig,
      unidadesVendidas: values.venden,
      aplicaDescuento:
        semanaCompletaParaDescuento && !semanaFutura && !personalNuevo,
      multaOmitida,
    });
    values.noCumpleMetas = penalty.noCumpleMetas;
    values.valorMultaCalculado = penalty.valorMultaCalculado;
    values.valorDescontar = penalty.valorDescontar;
    values.multaOmitida = penalty.multaOmitida;
    values.personalNuevo = personalNuevo;
    values.semanaLaborada = semanaLaborada;
    values.semanaCompletaParaDescuento = semanaCompletaParaDescuento;
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
  const usaBaseEspecialBono =
    vendedor.esJefeComercial &&
    weeks.some((week) =>
      Number.isFinite(
        Number(vendedor.semanas[week.startDate].cantidadVendedoresBono),
      ),
    );
  const totalDispositivosParaBono = usaBaseEspecialBono
    ? weeks.reduce(
        (total, week) =>
          total + toNumber(vendedor.semanas[week.startDate].vendenParaBono),
        0,
      )
    : vendedor.total.venden;
  const totalVendedoresSemanas =
    vendedor.esSupervisorComercial || usaBaseEspecialBono
    ? weeks.reduce(
        (total, week) =>
          total +
          toNumber(
            usaBaseEspecialBono
              ? vendedor.semanas[week.startDate].cantidadVendedoresBono
              : vendedor.semanas[week.startDate].cantidadVendedores,
          ),
        0,
      )
    : null;
  const promedioVentasPorJunior = esLiderComercial
    ? calculateLeaderAverage({
        totalDispositivos: totalDispositivosParaBono,
        cantidadSemanas: weeks.length,
        cantidadJuniors: cantidadVendedoresMensual,
        totalVendedoresSemanas,
      })
    : null;
  const unidadesParaBono = esLiderComercial
    ? promedioVentasPorJunior
    : vendedor.total.venden;
  vendedor.resumenMensual.promedioVentasPorJunior = promedioVentasPorJunior;
  vendedor.resumenMensual.totalVendedoresSemanas = totalVendedoresSemanas;
  vendedor.resumenMensual.ventasConsideradasBono =
    totalDispositivosParaBono;
  vendedor.resumenMensual.vendedoresConsideradosBono =
    vendedor.esJefeComercial ? vendedor.vendedoresBono || [] : null;
  vendedor.resumenMensual.vendedoresExcluidosBono =
    vendedor.esJefeComercial ? vendedor.vendedoresExcluidosBono || [] : null;
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

  const [relaciones, ventas, configs, sanciones, penaltyAdjustmentsRows] = await Promise.all([
    obtenerRelacionesVendedores(),
    obtenerVentasRango({ fechaInicio, fechaFin }),
    ComisionConfiguracion.findAll({
      where: { activo: true },
      order: [["orden", "ASC"]],
    }),
    SancionConfiguracion.findAll({ where: { activo: true, periodo: "SEMANAL" } }),
    PagoComisionMultaAjuste.findAll({
      where: {
        semanaInicio: { [Op.between]: [fechaInicio, fechaFin] },
      },
      attributes: ["usuarioId", "semanaInicio", "omitida"],
    }),
  ]);

  const weeklyRulesByGroup = buildWeeklyRulesByGroup(configs);
  const monthlyRulesByGroup = buildMonthlyRulesByGroup(configs, weeks.length);
  const sanctionsByRole = buildSanctionsByRole(sanciones);
  const penaltyAdjustments = buildPenaltyAdjustmentsMap(penaltyAdjustmentsRows);
  const vendedoresMap = new Map();

  relaciones.forEach((relacion) => {
    const usuarioPayload = getUsuarioPayload(relacion);
    if (
      hasCommissionablePaidPosition(usuarioPayload) &&
      isActiveDuringPeriod({
        fechaIngreso:
          usuarioPayload.fechaIngreso || usuarioPayload.fechaCreacionUsuario,
        fechaSalida: usuarioPayload.fechaSalida,
        fechaInicio,
        fechaFin,
      })
    ) {
      ensureVendedor(vendedoresMap, usuarioPayload, weeks);
    }
  });

  ventas.forEach((venta) => {
    const weekKey = getCommercialWeekKey(venta.fecha);
    if (!weekKeys.has(weekKey)) return;

    const usuarioPayload = getUsuarioPayload(venta.usuarioAgencia);
    if (!hasCommissionablePaidPosition(usuarioPayload)) return;
    if (
      !isActiveDuringPeriod({
        fechaIngreso:
          usuarioPayload.fechaIngreso || usuarioPayload.fechaCreacionUsuario,
        fechaSalida: usuarioPayload.fechaSalida,
        fechaInicio,
        fechaFin,
      })
    ) return;

    const vendedor = ensureVendedor(vendedoresMap, usuarioPayload, weeks);
    if (!vendedor) return;

    const totals = getSaleTotals(venta);
    vendedor.semanas[weekKey].venden += totals.venden;
    vendedor.semanas[weekKey].valorVendido += totals.valorVendido;
  });

  const vendedoresBase = [...vendedoresMap.values()];
  const vendedoresProduccion = vendedoresBase.map((vendedor) => ({
    ...vendedor,
    semanas: Object.fromEntries(
      weeks.map((week) => [
        week.startDate,
        { ...(vendedor.semanas[week.startDate] || emptyWeekValues()) },
      ]),
    ),
  }));
  vendedoresBase.forEach((jefe) => {
    const cargo = normalizeText(jefe.cargoComision || jefe.cargo);
    const esJefe = cargo.includes("JEFE COMERCIAL");
    const esSupervisor = cargo.includes("SUPERVISOR");
    if (!esJefe && !esSupervisor) return;

    const jefeProduccion = vendedoresProduccion.find(
      (vendedor) => Number(vendedor.usuarioId) === Number(jefe.usuarioId),
    );
    const juniors = vendedoresProduccion.filter(
      (vendedor) => Number(
        esJefe ? vendedor.jefeComercialId : vendedor.supervisorComercialId,
      ) === Number(jefe.usuarioId),
    );
    const integrantesEquipo = getLeaderCommissionMembers({
      leader: jefeProduccion,
      juniors,
    });
    const equipoBono = esJefe
      ? getLeaderBonusTeam({ members: integrantesEquipo, weeks })
      : { included: integrantesEquipo, excluded: [] };
    jefe.esJefeComercial = esJefe;
    jefe.esSupervisorComercial = esSupervisor;
    jefe.vendedoresJunior = integrantesEquipo.map(
      ({ usuarioId, nombre, esLiderVendedor }) => ({
        usuarioId,
        nombre,
        esLiderVendedor: Boolean(esLiderVendedor),
      }),
    );
    jefe.vendedoresBono = equipoBono.included.map(
      ({ usuarioId, nombre }) => ({ usuarioId, nombre }),
    );
    jefe.vendedoresExcluidosBono = equipoBono.excluded;
    if (integrantesEquipo.some((member) => member.esLiderVendedor)) {
      jefe.semanasPersonalesVendedor = jefeProduccion.semanas;
    }
    jefe.semanas = buildEmptyWeeks(weeks);
    jefe.total = emptyWeekValues();

    weeks.forEach((week) => {
      const produccion = getCommissionTeamProductionForWeek({
        members: integrantesEquipo,
        week,
        esSupervisor,
      });
      const produccionBono = getCommissionTeamProductionForWeek({
        members: equipoBono.included,
        week,
        esSupervisor,
      });
      const integrantesProduccion = produccion.integrantes;
      jefe.semanas[week.startDate].cantidadVendedores =
        integrantesProduccion.length;
      jefe.semanas[week.startDate].vendedoresActivos =
        produccion.dispositivosPorVendedor;
      jefe.semanas[week.startDate].venden = produccion.venden;
      jefe.semanas[week.startDate].valorVendido = produccion.valorVendido;
      jefe.semanas[week.startDate].cantidadVendedoresBono =
        produccionBono.integrantes.length;
      jefe.semanas[week.startDate].vendenParaBono =
        produccionBono.venden;
    });
  });

  const vendedores = [...vendedoresMap.values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((vendedor) => {
      finalizarVendedor(
        vendedor,
        weeks,
        weeklyRulesByGroup,
        monthlyRulesByGroup,
        sanctionsByRole,
        penaltyAdjustments,
      );
      if (vendedor.semanasPersonalesVendedor) {
        vendedor.ventasPersonalesVendedor = buildPersonalSellerView({
          vendedor,
          weeks,
          semanasPersonales: vendedor.semanasPersonalesVendedor,
        });
        delete vendedor.semanasPersonalesVendedor;
      }
      vendedor.cargosPago = (vendedor.posicionesPago || []).map(
        ({ rolPagoId, cargo, nivel }) => ({ rolPagoId, cargo, nivel }),
      );
      delete vendedor.prioridadCargo;
      delete vendedor.nivelJerarquiaCargo;
      delete vendedor.posicionesPago;
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

const createHttpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseCommercialWeek = (semanaInicio) => {
  const value = String(semanaInicio || "");
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || getCommercialWeekKey(value) !== value) {
    throw createHttpError(
      "La semana debe corresponder a un jueves en formato YYYY-MM-DD",
      400,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const week = getCommercialWeeksByMonth(year, month).find(
    (item) => item.startDate === value,
  );
  if (!week) {
    throw createHttpError("La semana comercial no es valida", 400);
  }

  return { year, month, week };
};

const actualizarOmisionMulta = async ({
  usuarioId,
  semanaInicio,
  omitida,
  actualizadoPorId,
}) => {
  const numericUsuarioId = Number(usuarioId);
  if (!Number.isInteger(numericUsuarioId) || numericUsuarioId <= 0) {
    throw createHttpError("El vendedor no es valido", 400);
  }
  if (typeof omitida !== "boolean") {
    throw createHttpError("Debe indicar si la multa sera omitida", 400);
  }

  const { year, month, week } = parseCommercialWeek(semanaInicio);
  const reporte = await obtenerReportePagosComisiones({ year, month });
  const vendedor = reporte.vendedores.find(
    (item) => Number(item.usuarioId) === numericUsuarioId,
  );
  if (!vendedor) {
    throw createHttpError("Vendedor no encontrado en el reporte seleccionado", 404);
  }

  const values = vendedor.semanas[week.startDate];
  if (!values || values.semanaFutura) {
    throw createHttpError("No se puede modificar una multa de una semana futura", 400);
  }
  if (values.personalNuevo) {
    throw createHttpError(
      "El personal nuevo no genera multa durante sus primeros 30 dias",
      400,
    );
  }
  if (!values.semanaCompletaParaDescuento) {
    throw createHttpError("La semana parcial o no laborada no genera multa", 400);
  }
  if (toNumber(values.valorMultaCalculado) <= 0) {
    throw createHttpError("El vendedor no tiene una multa calculada en esta semana", 400);
  }

  const [ajuste] = await PagoComisionMultaAjuste.findOrCreate({
    where: {
      usuarioId: numericUsuarioId,
      semanaInicio: week.startDate,
    },
    defaults: {
      omitida,
      actualizadoPorId: actualizadoPorId || null,
    },
  });

  await ajuste.update({
    omitida,
    actualizadoPorId: actualizadoPorId || null,
  });

  return {
    message: omitida ? "Multa omitida correctamente" : "Multa restaurada correctamente",
    usuarioId: numericUsuarioId,
    semanaInicio: week.startDate,
    omitida,
  };
};

module.exports = {
  isCargoPagoComisionable,
  buildPersonalSellerView,
  getCommissionablePaidPosition,
  hasCommissionablePaidPosition,
  isIndividualSellerPosition,
  getLeaderCommissionMembers,
  getLeaderBonusExclusionReasons,
  getLeaderBonusTeam,
  getUsuarioPayload,
  buildWeeklyRulesByGroup,
  buildMonthlyRulesByGroup,
  calculateCommission,
  calculateSalesPenalty,
  calculateWeeklyPenalty,
  calculateMonthlyBonus,
  calculateLeaderAverage,
  getActiveTeamMembersForWeek,
  getCommissionTeamMembersForWeek,
  getCommissionTeamProductionForWeek,
  selectHighestPaidPosition,
  getDistinctPaidPositions,
  resolveSalesSanctionConfig,
  isActiveDuringWeek,
  isActiveFullWeek,
  getNewPersonnelPenaltyStartDate,
  isNewPersonnelDuringWeek,
  isActiveDuringPeriod,
  isFutureCommercialWeek,
  obtenerReportePagosComisiones,
  actualizarOmisionMulta,
};
