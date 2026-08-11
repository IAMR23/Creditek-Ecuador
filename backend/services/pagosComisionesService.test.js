const {
  isCargoPagoComisionable,
  buildPersonalSellerView,
  getCommissionablePaidPosition,
  hasCommissionablePaidPosition,
  hasCommercialLeadershipPosition,
  isInactiveCommercialLeader,
  getLogisticsProfile,
  buildLogisticsCommissionRows,
  isSellerEligibleForTeam,
  getLeaderCommissionMembers,
  getLeaderBonusTeam,
  getUsuarioPayload,
  calculateSalesPenalty,
  calculateWeeklyPenalty,
  calculateMonthlyBonus,
  isActiveDuringWeek,
  isActiveFullWeek,
  getNewPersonnelPenaltyStartDate,
  isNewPersonnelDuringWeek,
  isFutureCommercialWeek,
  isActiveDuringPeriod,
  buildWeeklyRulesByGroup,
  buildMonthlyRulesByGroup,
  calculateCommission,
  calculateLeaderAverage,
  getActiveTeamMembersForWeek,
  getCommissionTeamMembersForWeek,
  getCommissionTeamProductionForWeek,
  selectHighestPaidPosition,
  getDistinctPaidPositions,
  normalizeWeeklySellerIds,
  buildWeeklyTeamsMap,
  getLeaderMembersForWeek,
  resolveSalesSanctionConfig,
  resolvePersonalSellerSanctionConfig,
  applyPersonalSellerPenaltiesToPrimaryView,
} = require("./pagosComisionesService");

describe("pagosComisionesService", () => {
  test("incluye usuarios con cargo salarial vendedor de piso aunque el nivel no venga como ASISTENTE", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 2,
        cargo: "Vendedor de Piso",
        nivel: "",
      }),
    ).toBe(true);
  });

  test("incluye vendedor de call center y asistente vendedor", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 3,
        cargo: "Vendedor de Call Center",
        nivel: "ASISTENTE",
      }),
    ).toBe(true);

    expect(
      isCargoPagoComisionable({
        rolPagoId: 4,
        cargo: "Asistente Vendedor",
        nivel: "OPERATIVO",
      }),
    ).toBe(true);
  });

  test("permite seleccionar cualquier usuario con rol o cargo de vendedor", () => {
    expect(
      isSellerEligibleForTeam({ rol: "Vendedor", posicionesPago: [] }),
    ).toBe(true);
    expect(
      isSellerEligibleForTeam({
        rol: "Administracion",
        posicionesPago: [{ cargo: "Vendedor de Call Center" }],
      }),
    ).toBe(true);
    expect(
      isSellerEligibleForTeam({
        rol: "Administracion",
        posicionesPago: [{ cargo: "Supervisor de Piso" }],
      }),
    ).toBe(false);
  });

  test("incluye al jefe comercial para calcular la produccion de sus juniors", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 15,
        cargo: "JEFE COMERCIAL DE PISO",
      }),
    ).toBe(true);
  });

  test("excluye de pagos a jefes comerciales y supervisores inactivos", () => {
    const jefeInactivo = {
      activo: false,
      posicionesPago: [{ cargo: "JEFE COMERCIAL DE PISO" }],
    };
    const supervisorInactivo = {
      activo: false,
      posicionesPago: [{ cargo: "SUPERVISOR CALL CENTER" }],
    };

    expect(hasCommercialLeadershipPosition(jefeInactivo)).toBe(true);
    expect(isInactiveCommercialLeader(jefeInactivo)).toBe(true);
    expect(isInactiveCommercialLeader(supervisorInactivo)).toBe(true);
    expect(
      isInactiveCommercialLeader({
        activo: false,
        posicionesPago: [{ cargo: "VENDEDOR DE PISO" }],
      }),
    ).toBe(false);
    expect(
      isInactiveCommercialLeader({
        activo: true,
        posicionesPago: [{ cargo: "JEFE COMERCIAL DE PISO" }],
      }),
    ).toBe(false);
  });

  test("calcula pagos de logistica por entregas realizadas", () => {
    const weeks = [
      { startDate: "2026-07-02", endDate: "2026-07-08" },
      { startDate: "2026-07-09", endDate: "2026-07-15" },
    ];
    const usuarios = [
      {
        usuarioId: 1,
        nombre: "Encargado",
        activo: true,
        agencias: ["Matriz"],
        roles: [],
        posicionesPago: [{ rolPagoId: 10, cargo: "ENCARGADO DE LOGISTICA" }],
      },
      {
        usuarioId: 2,
        nombre: "Chofer",
        activo: true,
        agencias: ["Matriz"],
        roles: [],
        posicionesPago: [{ rolPagoId: 11, cargo: "CHOFER" }],
      },
      {
        usuarioId: 3,
        nombre: "Repartidor",
        activo: true,
        agencias: ["Norte"],
        roles: ["Repartidor"],
        posicionesPago: [],
      },
      {
        usuarioId: 4,
        nombre: "Chofer inactivo",
        activo: false,
        posicionesPago: [{ rolPagoId: 11, cargo: "CHOFER" }],
      },
    ];
    const asignaciones = [
      { usuarioId: 1, entregaId: 10, fecha: "2026-07-03" },
      { usuarioId: 1, entregaId: 11, fecha: "2026-07-10" },
      { usuarioId: 2, entregaId: 20, fecha: "2026-07-03" },
      { usuarioId: 2, entregaId: 20, fecha: "2026-07-03" },
      { usuarioId: 2, entregaId: 21, fecha: "2026-07-10" },
      { usuarioId: 3, entregaId: 30, fecha: "2026-07-10" },
      { usuarioId: 4, entregaId: 40, fecha: "2026-07-10" },
    ];

    const rows = buildLogisticsCommissionRows({ usuarios, asignaciones, weeks });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      usuarioId: 1,
      esEncargadoLogistica: true,
      tarifaPorEntrega: 1,
      resumenMensual: { totalEntregas: 2, totalPagar: 2 },
    });
    expect(rows.find((row) => row.usuarioId === 2)).toMatchObject({
      tarifaPorEntrega: 0.5,
      resumenMensual: { totalEntregas: 2, totalPagar: 1 },
    });
    expect(rows.find((row) => row.usuarioId === 3)).toMatchObject({
      cargo: "REPARTIDOR",
      tarifaPorEntrega: 0.5,
      resumenMensual: { totalEntregas: 1, totalPagar: 0.5 },
    });
  });

  test("prioriza la tarifa del encargado aunque tambien tenga rol repartidor", () => {
    expect(
      getLogisticsProfile({
        rol: "Repartidor",
        posicionesPago: [{ cargo: "Encargado de Logistica" }],
      }),
    ).toEqual({
      tipo: "ENCARGADO",
      cargo: "Encargado de Logistica",
      tarifaPorEntrega: 1,
    });
  });

  test("persona con dos cargos usa el cargo mejor pagado", () => {
    const cargoPrincipal = selectHighestPaidPosition([
      {
        rolPagoId: 2,
        cargo: "VENDEDOR DE PISO",
        nivel: "ASISTENTE",
        remuneracionReferencia: 700,
        nivelJerarquia: 1,
      },
      {
        rolPagoId: 15,
        cargo: "JEFE COMERCIAL DE PISO",
        nivel: "JEFE",
        remuneracionReferencia: 1900,
        nivelJerarquia: 5,
      },
    ]);

    expect(cargoPrincipal).toMatchObject({
      rolPagoId: 15,
      cargo: "JEFE COMERCIAL DE PISO",
    });
    expect(isCargoPagoComisionable(cargoPrincipal)).toBe(true);
  });

  test("si dos cargos pagan igual usa el de mayor jerarquia", () => {
    expect(
      selectHighestPaidPosition([
        {
          rolPagoId: 2,
          cargo: "VENDEDOR DE PISO",
          remuneracionReferencia: 900,
          nivelJerarquia: 1,
        },
        {
          rolPagoId: 16,
          cargo: "SUPERVISOR PISO",
          remuneracionReferencia: 900,
          nivelJerarquia: 4,
        },
      ]),
    ).toMatchObject({ rolPagoId: 16, cargo: "SUPERVISOR PISO" });
  });

  test("detecta solamente cargos distintos aunque se repita una asignacion", () => {
    expect(
      getDistinctPaidPositions([
        {
          rolPagoId: 2,
          cargo: "VENDEDOR DE PISO",
          remuneracionReferencia: 700,
        },
        {
          rolPagoId: 2,
          cargo: "VENDEDOR DE PISO",
          remuneracionReferencia: 700,
        },
        {
          rolPagoId: 8,
          cargo: "ASISTENTE DE INVENTARIO",
          remuneracionReferencia: 900,
        },
      ]),
    ).toHaveLength(2);
  });

  test("usa en comisiones todos los cargos seleccionados desde Usuarios", () => {
    const payload = getUsuarioPayload({
      usuario: {
        id: 40,
        nombre: "Persona con doble cargo",
        activo: true,
        rolPago: {
          id: 2,
          nivel: "ASISTENTE",
          cargo: "VENDEDOR DE PISO",
          sueldoBase: 600,
          sueldoExtra: 0,
          ingresoMax: 900,
        },
        rolesPago: [
          {
            id: 2,
            nivel: "ASISTENTE",
            cargo: "VENDEDOR DE PISO",
            sueldoBase: 600,
            sueldoExtra: 0,
            ingresoMax: 900,
          },
          {
            id: 15,
            nivel: "JEFE",
            cargo: "JEFE COMERCIAL DE PISO",
            sueldoBase: 1200,
            sueldoExtra: 200,
            ingresoMax: 1900,
          },
        ],
      },
    });

    expect(payload).toMatchObject({
      rolPagoId: 15,
      cargo: "JEFE COMERCIAL DE PISO",
      activo: true,
      tieneMultiplesCargos: true,
    });
    expect(payload.posicionesPago).toHaveLength(2);
  });

  test("incluye al usuario si su segundo cargo es comisionable", () => {
    const usuario = {
      rolPagoId: 20,
      cargo: "COORDINADOR ADMINISTRATIVO",
      nivel: "COORDINADOR",
      posicionesPago: [
        {
          rolPagoId: 20,
          cargo: "COORDINADOR ADMINISTRATIVO",
          nivel: "COORDINADOR",
          remuneracionReferencia: 2200,
          nivelJerarquia: 3,
        },
        {
          rolPagoId: 2,
          cargo: "VENDEDOR DE PISO",
          nivel: "ASISTENTE",
          remuneracionReferencia: 900,
          nivelJerarquia: 1,
        },
      ],
    };

    expect(isCargoPagoComisionable(usuario)).toBe(false);
    expect(hasCommissionablePaidPosition(usuario)).toBe(true);
    expect(getCommissionablePaidPosition(usuario)).toMatchObject({
      rolPagoId: 2,
      cargo: "VENDEDOR DE PISO",
    });
  });

  test("doble cargo conserva la sancion del cargo vendedor", () => {
    const sancionVendedor = { minimoUnidades: 9, valorMultaUnidad: 8 };
    const sanctionsByRole = {
      byRole: { 2: sancionVendedor },
      byCargo: { "VENDEDOR DE PISO": sancionVendedor },
    };

    expect(
      resolveSalesSanctionConfig(
        {
          rolPagoId: 2,
          cargo: "VENDEDOR DE PISO",
          rolPagoComisionId: 2,
          cargoComision: "VENDEDOR DE PISO",
          tieneMultiplesCargos: true,
        },
        sanctionsByRole,
      ),
    ).toBe(sancionVendedor);
    expect(
      resolveSalesSanctionConfig(
        { rolPagoId: 15, cargo: "JEFE COMERCIAL DE PISO" },
        sanctionsByRole,
      ),
    ).toBeNull();
    expect(
      resolveSalesSanctionConfig(
        { rolPagoId: 2, cargo: "VENDEDOR DE PISO" },
        sanctionsByRole,
      ),
    ).toBe(sancionVendedor);
    expect(
      resolvePersonalSellerSanctionConfig(
        {
          posicionesPago: [
            { rolPagoId: 15, cargo: "JEFE COMERCIAL DE PISO" },
            { rolPagoId: 2, cargo: "VENDEDOR DE PISO" },
          ],
        },
        sanctionsByRole,
      ),
    ).toBe(sancionVendedor);
  });

  test("jefe comercial usa los escalones semanales configurados", () => {
    const grouped = buildWeeklyRulesByGroup([
      { grupo: "JEFE COMERCIAL PISO", periodo: "COMISION_SEMANAL", unidadesVendidas: "24", comisionPorEquipo: 1, porcentaje: null },
      { grupo: "JEFE COMERCIAL PISO", periodo: "COMISION_SEMANAL", unidadesVendidas: "26", comisionPorEquipo: 1.5, porcentaje: null },
      { grupo: "JEFE COMERCIAL PISO", periodo: "COMISION_SEMANAL", unidadesVendidas: "28", comisionPorEquipo: 2, porcentaje: null },
      { grupo: "JEFE COMERCIAL PISO", periodo: "COMISION_SEMANAL", unidadesVendidas: "32", comisionPorEquipo: 3, porcentaje: null },
    ]);
    const rules = grouped["JEFE COMERCIAL PISO"];

    expect(calculateCommission({ rules, venden: 24, valorVendido: 0 }).totalComisiones).toBe(24);
    expect(calculateCommission({ rules, venden: 27, valorVendido: 0 }).totalComisiones).toBe(40.5);
    expect(calculateCommission({ rules, venden: 30, valorVendido: 0 }).totalComisiones).toBe(60);
    expect(calculateCommission({ rules, venden: 35, valorVendido: 0 }).totalComisiones).toBe(105);
  });

  test("promedio del jefe usa dispositivos de juniors, semanas y cantidad de juniors", () => {
    expect(
      calculateLeaderAverage({
        totalDispositivos: 117,
        cantidadSemanas: 4,
        cantidadJuniors: 2,
      }),
    ).toBe(14.625);
    expect(
      calculateLeaderAverage({
        totalDispositivos: 117,
        cantidadSemanas: 0,
        cantidadJuniors: 2,
      }),
    ).toBe(0);
  });

  test("promedio del supervisor usa la cantidad real de vendedores de cada semana", () => {
    expect(
      calculateLeaderAverage({
        totalDispositivos: 100,
        cantidadSemanas: 4,
        cantidadJuniors: 3,
        totalVendedoresSemanas: 10,
      }),
    ).toBe(10);
  });

  test("bono del jefe usa los limites exactos configurados sin redondear", () => {
    const rules = {
      tiers: [
        { min: 12, bono: 60 },
        { min: 13, bono: 80 },
        { min: 14.5, bono: 100 },
      ],
      extraPorEquipo: 0,
    };

    expect(calculateMonthlyBonus({ rules, venden: 11.99 })).toBe(0);
    expect(calculateMonthlyBonus({ rules, venden: 12 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 12.99 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 13 })).toBe(80);
    expect(calculateMonthlyBonus({ rules, venden: 14.49 })).toBe(80);
    expect(calculateMonthlyBonus({ rules, venden: 14.5 })).toBe(100);
  });

  test("bono del jefe se construye desde promedioPorVendedor de configuracion", () => {
    const grouped = buildMonthlyRulesByGroup([
      { grupo: "JEFE COMERCIAL PISO", periodo: "BONO_MENSUAL", promedioPorVendedor: "12", unidadesVendidas: null, bono: 60 },
      { grupo: "JEFE COMERCIAL PISO", periodo: "BONO_MENSUAL", promedioPorVendedor: "13", unidadesVendidas: null, bono: 80 },
      { grupo: "JEFE COMERCIAL PISO", periodo: "BONO_MENSUAL", promedioPorVendedor: "14.50", unidadesVendidas: null, bono: 100 },
    ], 4);
    const rules = grouped["JEFE COMERCIAL PISO"];

    expect(calculateMonthlyBonus({ rules, venden: 12 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 14.49 })).toBe(80);
    expect(calculateMonthlyBonus({ rules, venden: 14.5 })).toBe(100);
  });

  test("bono mensual prioriza la tabla configurada para 4 o 5 semanas", () => {
    const configs = [
      { grupo: "VENDEDORES DE PISO Y FURGONETA", periodo: "BONO_MENSUAL_4_SEMANAS", unidadesVendidas: "16", bono: 40 },
      { grupo: "VENDEDORES DE PISO Y FURGONETA", periodo: "BONO_MENSUAL_5_SEMANAS", unidadesVendidas: "20", bono: 55 },
      { grupo: "VENDEDORES DE PISO Y FURGONETA", periodo: "BONO_MENSUAL", unidadesVendidas: "18", bono: 45 },
    ];

    const rules4 = buildMonthlyRulesByGroup(configs, 4);
    const rules5 = buildMonthlyRulesByGroup(configs, 5);

    expect(
      calculateMonthlyBonus({
        rules: rules4["VENDEDORES DE PISO Y FURGONETA"],
        venden: 19,
      }),
    ).toBe(40);
    expect(
      calculateMonthlyBonus({
        rules: rules5["VENDEDORES DE PISO Y FURGONETA"],
        venden: 19,
      }),
    ).toBe(0);
    expect(
      calculateMonthlyBonus({
        rules: rules5["VENDEDORES DE PISO Y FURGONETA"],
        venden: 20,
      }),
    ).toBe(55);
  });

  test("supervisor piso y call center usan la misma logica con sus propias configuraciones", () => {
    const grouped = buildMonthlyRulesByGroup([
      { grupo: "SUPERVISOR PISO", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "12", bono: 60 },
      { grupo: "SUPERVISOR PISO", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "13", bono: 80 },
      { grupo: "SUPERVISOR PISO", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "15", bono: 100 },
      { grupo: "SUPERVISOR CALL CENTER", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "10", bono: 60 },
      { grupo: "SUPERVISOR CALL CENTER", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "11", bono: 80 },
      { grupo: "SUPERVISOR CALL CENTER", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "13", bono: 100 },
    ], 4);

    const promedio = calculateLeaderAverage({
      totalDispositivos: 108,
      cantidadSemanas: 4,
      cantidadJuniors: 2,
    });
    expect(promedio).toBe(13.5);

    expect(calculateMonthlyBonus({ rules: grouped["SUPERVISOR PISO"], venden: promedio })).toBe(80);
    expect(calculateMonthlyBonus({ rules: grouped["SUPERVISOR CALL CENTER"], venden: promedio })).toBe(100);
  });

  test("incluye supervisores en su seccion de pagos", () => {
    expect(
      isCargoPagoComisionable({ rolPagoId: 16, cargo: "SUPERVISOR PISO" }),
    ).toBe(true);
  });

  test("excluye usuarios sin rol de pago o con cargo no comisionable", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: null,
        cargo: "Vendedor de Piso",
        nivel: "ASISTENTE",
      }),
    ).toBe(false);

    expect(
      isCargoPagoComisionable({
        rolPagoId: 9,
        cargo: "Supervisor de MKT",
        nivel: "ENCARGADO",
      }),
    ).toBe(false);
  });

  test("no cumple metas usa minimo y valor por unidad de sanciones", () => {
    const config = { minimoUnidades: 9, valorMultaUnidad: 8 };
    expect(calculateSalesPenalty({ config, unidadesVendidas: 7 })).toBe(16);
    expect(calculateSalesPenalty({ config, unidadesVendidas: 9 })).toBe(0);
    expect(calculateSalesPenalty({ config, unidadesVendidas: 12 })).toBe(0);
  });

  test("omitir multa conserva las unidades faltantes y perdona solo el valor a descontar", () => {
    const config = { minimoUnidades: 9, valorMultaUnidad: 8 };

    expect(
      calculateWeeklyPenalty({
        config,
        unidadesVendidas: 7,
        aplicaDescuento: true,
        multaOmitida: true,
      }),
    ).toEqual({
      noCumpleMetas: 2,
      valorMultaCalculado: 16,
      valorDescontar: 0,
      multaOmitida: true,
      descuentoModificado: true,
    });

    expect(
      calculateWeeklyPenalty({
        config,
        unidadesVendidas: 7,
        aplicaDescuento: true,
        multaOmitida: false,
      }),
    ).toEqual({
      noCumpleMetas: 2,
      valorMultaCalculado: 16,
      valorDescontar: 16,
      multaOmitida: false,
      descuentoModificado: false,
    });
  });

  test("permite reemplazar el valor calculado de la sancion", () => {
    expect(
      calculateWeeklyPenalty({
        config: { minimoUnidades: 9, valorMultaUnidad: 8 },
        unidadesVendidas: 7,
        aplicaDescuento: true,
        valorDescontarAjustado: 11.5,
      }),
    ).toEqual({
      noCumpleMetas: 2,
      valorMultaCalculado: 16,
      valorDescontar: 11.5,
      multaOmitida: false,
      descuentoModificado: true,
    });
  });

  test("el bono mensual aplica equipo extra solo despues de la ultima meta", () => {
    const rules = {
      tiers: [
        { min: 48, bono: 60 },
        { min: 52, bono: 81 },
        { min: 60, bono: 100 },
      ],
      extraPorEquipo: 1.75,
    };

    expect(calculateMonthlyBonus({ rules, venden: 47 })).toBe(0);
    expect(calculateMonthlyBonus({ rules, venden: 48 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 51 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 52 })).toBe(81);
    expect(calculateMonthlyBonus({ rules, venden: 59 })).toBe(81);
    expect(calculateMonthlyBonus({ rules, venden: 60 })).toBe(100);
    expect(calculateMonthlyBonus({ rules, venden: 61 })).toBe(101.75);
    expect(calculateMonthlyBonus({ rules, venden: 62 })).toBe(103.5);
  });

  test("no considera semanas anteriores al ingreso ni posteriores a la salida", () => {
    expect(isActiveDuringWeek({ fechaIngreso: "2026-07-24", week: { startDate: "2026-07-02", endDate: "2026-07-08" } })).toBe(false);
    expect(isActiveDuringWeek({ fechaIngreso: "2026-07-24", week: { startDate: "2026-07-23", endDate: "2026-07-29" } })).toBe(true);
    expect(isActiveDuringWeek({ fechaSalida: "2026-07-10", week: { startDate: "2026-07-16", endDate: "2026-07-22" } })).toBe(false);
  });

  test("no aplica descuentos cuando el vendedor ingresa o sale a mitad de semana", () => {
    const week = { startDate: "2026-07-09", endDate: "2026-07-15" };

    expect(isActiveFullWeek({ fechaSalida: "2026-07-12", week })).toBe(false);
    expect(isActiveFullWeek({ fechaIngreso: "2026-07-12", week })).toBe(false);
    expect(
      isActiveFullWeek({
        fechaIngreso: "2026-07-09",
        fechaSalida: "2026-07-15",
        week,
      }),
    ).toBe(true);
  });

  test("supervisor excluye del conteo semanal a quien ingresa tarde o sale esa semana", () => {
    const week = { startDate: "2026-07-09", endDate: "2026-07-15" };
    const members = [
      { usuarioId: 1, fechaIngreso: "2026-06-01", fechaSalida: null },
      { usuarioId: 2, fechaIngreso: "2026-06-01", fechaSalida: "2026-07-12" },
      { usuarioId: 3, fechaIngreso: "2026-06-01", fechaSalida: "2026-07-15" },
      { usuarioId: 4, fechaIngreso: "2026-06-01", fechaSalida: "2026-07-16" },
      { usuarioId: 5, fechaIngreso: "2026-07-10", fechaSalida: null },
      { usuarioId: 6, fechaIngreso: "2026-07-09", fechaSalida: null },
    ];

    expect(
      getActiveTeamMembersForWeek(members, week).map((member) => member.usuarioId),
    ).toEqual([1, 4, 6]);
  });

  test("jefe comercial suma todos sus vendedores aunque sean nuevos o parciales", () => {
    const week = { startDate: "2026-07-09", endDate: "2026-07-15" };
    const members = [
      {
        usuarioId: 1,
        fechaIngreso: "2026-06-01",
        fechaSalida: null,
        semanas: {
          "2026-07-09": { venden: 3, valorVendido: 300 },
        },
      },
      {
        usuarioId: 2,
        fechaIngreso: "2026-07-12",
        fechaSalida: null,
        personalNuevo: true,
        semanas: {
          "2026-07-09": { venden: 1, valorVendido: 100 },
        },
      },
      {
        usuarioId: 3,
        fechaIngreso: "2026-06-01",
        fechaSalida: "2026-07-12",
        semanas: {
          "2026-07-09": { venden: 2, valorVendido: 200 },
        },
      },
      { usuarioId: 4, fechaIngreso: "2026-08-01", fechaSalida: null },
      { usuarioId: 5, fechaIngreso: "2026-06-01", fechaSalida: "2026-07-08" },
    ];

    expect(
      getCommissionTeamMembersForWeek({
        members,
        week,
        esSupervisor: false,
      }).map((member) => member.usuarioId),
    ).toEqual([1, 2, 3]);
    expect(
      getCommissionTeamProductionForWeek({
        members,
        week,
        esSupervisor: false,
      }),
    ).toMatchObject({
      venden: 6,
      valorVendido: 600,
      dispositivosPorVendedor: [
        expect.objectContaining({ usuarioId: 1, venden: 3 }),
        expect.objectContaining({ usuarioId: 2, venden: 1 }),
        expect.objectContaining({ usuarioId: 3, venden: 2 }),
      ],
    });
  });

  test("jefe con doble cargo cuenta sus ventas propias como vendedor", () => {
    const week = { startDate: "2026-07-09", endDate: "2026-07-15" };
    const leader = {
      usuarioId: 10,
      nombre: "Jefe vendedor",
      tieneMultiplesCargos: true,
      posicionesPago: [
        { rolPagoId: 14, cargo: "JEFE COMERCIAL DE PISO" },
        { rolPagoId: 2, cargo: "VENDEDOR PISO" },
      ],
      semanas: {
        "2026-07-09": { venden: 4, valorVendido: 400 },
      },
    };
    const juniors = [
      {
        usuarioId: 11,
        nombre: "Vendedor junior",
        semanas: {
          "2026-07-09": { venden: 2, valorVendido: 200 },
        },
      },
    ];
    const members = getLeaderCommissionMembers({ leader, juniors });
    const production = getCommissionTeamProductionForWeek({
      members,
      week,
      esSupervisor: false,
    });

    expect(members).toHaveLength(2);
    expect(production).toMatchObject({
      venden: 6,
      valorVendido: 600,
      dispositivosPorVendedor: [
        expect.objectContaining({ usuarioId: 11, venden: 2 }),
        expect.objectContaining({
          usuarioId: 10,
          venden: 4,
          esLiderVendedor: true,
        }),
      ],
    });
  });

  test("la seleccion semanal reemplaza la asignacion general del jefe", () => {
    const leader = {
      usuarioId: 10,
      nombre: "Jefe comercial",
      tieneMultiplesCargos: false,
    };
    const sellerOne = { usuarioId: 11, nombre: "Vendedor uno" };
    const sellerTwo = { usuarioId: 12, nombre: "Vendedor dos" };
    const sellersById = new Map([
      [11, sellerOne],
      [12, sellerTwo],
    ]);

    const configured = getLeaderMembersForWeek({
      leader,
      defaultJuniors: [sellerOne],
      weeklyTeam: { vendedorIds: [12] },
      sellersById,
    });
    const emptyConfigured = getLeaderMembersForWeek({
      leader,
      defaultJuniors: [sellerOne],
      weeklyTeam: { vendedorIds: [] },
      sellersById,
    });
    const fallback = getLeaderMembersForWeek({
      leader,
      defaultJuniors: [sellerOne],
      weeklyTeam: null,
      sellersById,
    });

    expect(configured).toMatchObject({
      configured: true,
      selectedSellerIds: [12],
      members: [sellerTwo],
    });
    expect(emptyConfigured).toMatchObject({
      configured: true,
      selectedSellerIds: [],
      members: [],
    });
    expect(fallback).toMatchObject({
      configured: false,
      selectedSellerIds: [11],
      members: [sellerOne],
    });
  });

  test("el supervisor calcula produccion y promedio con su seleccion de cada semana", () => {
    const weeks = [
      { startDate: "2026-07-02", endDate: "2026-07-08" },
      { startDate: "2026-07-09", endDate: "2026-07-15" },
    ];
    const leader = {
      usuarioId: 10,
      nombre: "Supervisor",
      tieneMultiplesCargos: false,
    };
    const sellerOne = {
      usuarioId: 11,
      nombre: "Vendedor uno",
      fechaIngreso: "2025-01-01",
      semanas: {
        "2026-07-02": { venden: 4, valorVendido: 400 },
        "2026-07-09": { venden: 10, valorVendido: 1000 },
      },
    };
    const sellerTwo = {
      usuarioId: 12,
      nombre: "Vendedor dos",
      fechaIngreso: "2025-01-01",
      semanas: {
        "2026-07-02": { venden: 6, valorVendido: 600 },
        "2026-07-09": { venden: 8, valorVendido: 800 },
      },
    };
    const sellersById = new Map([
      [11, sellerOne],
      [12, sellerTwo],
    ]);
    const firstTeam = getLeaderMembersForWeek({
      leader,
      defaultJuniors: [],
      weeklyTeam: { vendedorIds: [11, 12] },
      sellersById,
    });
    const secondTeam = getLeaderMembersForWeek({
      leader,
      defaultJuniors: [],
      weeklyTeam: { vendedorIds: [12] },
      sellersById,
    });
    const firstProduction = getCommissionTeamProductionForWeek({
      members: firstTeam.members,
      week: weeks[0],
      esSupervisor: true,
    });
    const secondProduction = getCommissionTeamProductionForWeek({
      members: secondTeam.members,
      week: weeks[1],
      esSupervisor: true,
    });

    expect(firstProduction.venden).toBe(10);
    expect(firstProduction.integrantes).toHaveLength(2);
    expect(secondProduction.venden).toBe(8);
    expect(secondProduction.integrantes).toHaveLength(1);
    expect(
      calculateLeaderAverage({
        totalDispositivos: firstProduction.venden + secondProduction.venden,
        totalVendedoresSemanas:
          firstProduction.integrantes.length + secondProduction.integrantes.length,
      }),
    ).toBe(6);
  });

  test("normaliza las configuraciones semanales persistidas", () => {
    const map = buildWeeklyTeamsMap([
      {
        id: 1,
        jefeComercialId: 10,
        semanaInicio: "2026-07-09",
        vendedorIds: [12, "11", 12, "invalido"],
      },
    ]);

    expect(normalizeWeeklySellerIds([12, "11", 12, "invalido"])).toEqual([
      12,
      11,
    ]);
    expect(map.get("10:2026-07-09")).toEqual({
      id: 1,
      jefeComercialId: 10,
      semanaInicio: "2026-07-09",
      vendedorIds: [12, 11],
    });
  });

  test("vista de vendedores mantiene ventas personales y aplica multa al doble cargo", () => {
    const weeks = [
      { startDate: "2026-07-02", endDate: "2026-07-08" },
      { startDate: "2026-07-09", endDate: "2026-07-15" },
    ];
    const view = buildPersonalSellerView({
      vendedor: {
        usuarioId: 10,
        fechaCreacionUsuario: "2026-01-01",
        fechaIngreso: "2026-01-01",
      },
      weeks,
      sanctionConfig: { minimoUnidades: 9, valorMultaUnidad: 8 },
      semanasPersonales: {
        "2026-07-02": {
          venden: 2,
          valorVendido: 656,
          totalComisiones: 200,
        },
        "2026-07-09": {
          venden: 4,
          valorVendido: 1486,
          totalComisiones: 300,
        },
      },
    });

    expect(view.total).toMatchObject({
      venden: 6,
      valorVendido: 2142,
      totalComisiones: 0,
      noCumpleMetas: 12,
      valorDescontar: 96,
    });
    expect(view.resumenMensual).toMatchObject({
      ventasTvCelulaMensual: 6,
      valorComisionSemanal: 0,
      valorComisionMensual: 0,
      totalNoCumpleMetas: 12,
      totalValorDescontar: 96,
      totalPagar: -96,
    });
  });

  test("descuenta una sola vez la multa personal del doble cargo en su pago principal", () => {
    const weeks = [{ startDate: "2026-07-02", endDate: "2026-07-08" }];
    const vendedor = {
      semanas: {
        "2026-07-02": {
          noCumpleMetas: 0,
          valorMultaCalculado: 0,
          valorDescontar: 0,
        },
      },
      total: { noCumpleMetas: 0, valorDescontar: 0 },
      resumenMensual: {
        totalComisionesSemanaMensual: 150,
        totalNoCumpleMetas: 0,
        totalValorDescontar: 0,
        totalPagar: 150,
      },
    };
    const personalSellerView = {
      semanas: {
        "2026-07-02": {
          noCumpleMetas: 3,
          valorMultaCalculado: 24,
          valorDescontar: 24,
          multaOmitida: false,
          descuentoModificado: false,
        },
      },
      total: { noCumpleMetas: 3, valorDescontar: 24 },
    };

    applyPersonalSellerPenaltiesToPrimaryView({
      vendedor,
      personalSellerView,
      weeks,
    });

    expect(vendedor.semanas["2026-07-02"]).toMatchObject({
      noCumpleMetas: 3,
      valorMultaCalculado: 24,
      valorDescontar: 24,
    });
    expect(vendedor.resumenMensual).toMatchObject({
      totalValorDescontar: 24,
      totalPagar: 126,
    });
  });

  test("bono del jefe excluye nuevos, personas con salida y doble cargo", () => {
    const weeks = [
      { startDate: "2026-07-02", endDate: "2026-07-08" },
      { startDate: "2026-07-09", endDate: "2026-07-15" },
    ];
    const members = [
      {
        usuarioId: 1,
        nombre: "Vendedor elegible",
        fechaCreacionUsuario: "2026-01-01",
      },
      {
        usuarioId: 2,
        nombre: "Personal nuevo",
        fechaCreacionUsuario: "2026-07-01",
      },
      {
        usuarioId: 3,
        nombre: "Persona con salida",
        fechaCreacionUsuario: "2026-01-01",
        fechaSalida: "2026-07-10",
      },
      {
        usuarioId: 4,
        nombre: "Persona doble cargo",
        fechaCreacionUsuario: "2026-01-01",
        tieneMultiplesCargos: true,
      },
    ];

    expect(getLeaderBonusTeam({ members, weeks })).toEqual({
      included: [members[0]],
      excluded: [
        {
          usuarioId: 2,
          nombre: "Personal nuevo",
          razones: ["Personal nuevo"],
        },
        {
          usuarioId: 3,
          nombre: "Persona con salida",
          razones: ["Fecha de salida"],
        },
        {
          usuarioId: 4,
          nombre: "Persona doble cargo",
          razones: ["Doble cargo"],
        },
      ],
    });
  });

  test("considera personal nuevo durante 30 dias desde la creacion del usuario", () => {
    const fechaCreacionUsuario = "2026-07-01";

    expect(getNewPersonnelPenaltyStartDate(fechaCreacionUsuario)).toBe("2026-07-31");
    expect(
      isNewPersonnelDuringWeek({
        fechaCreacionUsuario,
        week: { startDate: "2026-07-23", endDate: "2026-07-29" },
      }),
    ).toBe(true);
    expect(
      isNewPersonnelDuringWeek({
        fechaCreacionUsuario,
        week: { startDate: "2026-07-30", endDate: "2026-08-05" },
      }),
    ).toBe(true);
    expect(
      isNewPersonnelDuringWeek({
        fechaCreacionUsuario,
        week: { startDate: "2026-08-06", endDate: "2026-08-12" },
      }),
    ).toBe(false);
  });

  test("personal nuevo genera multa desde su primera semana completa", () => {
    const personalNuevo = isNewPersonnelDuringWeek({
      fechaCreacionUsuario: "2026-07-01",
      week: { startDate: "2026-07-23", endDate: "2026-07-29" },
    });

    expect(
      calculateWeeklyPenalty({
        config: { minimoUnidades: 9, valorMultaUnidad: 8 },
        unidadesVendidas: 2,
        aplicaDescuento: personalNuevo,
        multaOmitida: false,
      }),
    ).toEqual({
      noCumpleMetas: 7,
      valorMultaCalculado: 56,
      valorDescontar: 56,
      multaOmitida: false,
      descuentoModificado: false,
    });
  });

  test("muestra el mes de salida y excluye al vendedor desde el siguiente mes", () => {
    const empleado = { fechaIngreso: "2026-01-10", fechaSalida: "2026-07-20" };

    expect(
      isActiveDuringPeriod({
        ...empleado,
        fechaInicio: "2026-07-01",
        fechaFin: "2026-07-31",
      }),
    ).toBe(true);
    expect(
      isActiveDuringPeriod({
        ...empleado,
        fechaInicio: "2026-08-01",
        fechaFin: "2026-08-31",
      }),
    ).toBe(false);
  });

  test("identifica semanas comerciales que aun no han iniciado", () => {
    expect(isFutureCommercialWeek({ startDate: "2026-07-09" }, "2026-07-10")).toBe(false);
    expect(isFutureCommercialWeek({ startDate: "2026-07-16" }, "2026-07-10")).toBe(true);
  });
});
