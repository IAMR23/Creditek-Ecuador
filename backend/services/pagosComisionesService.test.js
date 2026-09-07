const {
  finalizarVendedor,
  normalizarCantidadVendedoresComision,
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
  isAvailableForTeamWeek,
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
  normalizeChiefAverageSellerIds,
  normalizeSupervisorAverageSellerIds,
  buildWeeklyTeamsMap,
  buildChiefAverageSelectionsMap,
  buildSupervisorAverageSelectionsMap,
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

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      usuarioId: 1,
      esEncargadoLogistica: true,
      tarifaPorEntrega: 1,
      tarifaBonoJunior: 0.5,
      resumenMensual: {
        totalEntregas: 2,
        totalEntregasJuniors: 2,
        totalComisionEntregasPropias: 2,
        totalEntregasParaBono: 4,
        totalBonoJuniors: 2,
        totalPagar: 4,
      },
    });
    expect(rows.find((row) => row.usuarioId === 2)).toMatchObject({
      tarifaPorEntrega: 1,
      resumenMensual: { totalEntregas: 2, totalPagar: 2 },
    });
    expect(rows.find((row) => row.usuarioId === 3)).toBeUndefined();
    expect(rows[0].semanas["2026-07-02"]).toMatchObject({
      entregas: 1,
      entregasJuniors: 1,
      comisionEntregasPropias: 1,
      entregasParaBono: 2,
      bonoJuniors: 1,
      totalComisiones: 2,
    });
    expect(rows[0].semanas["2026-07-09"]).toMatchObject({
      entregas: 1,
      entregasJuniors: 1,
      comisionEntregasPropias: 1,
      entregasParaBono: 2,
      bonoJuniors: 1,
      totalComisiones: 2,
    });
  });

  test("el bono usa la suma de entregas por chofer sin duplicar asignaciones del mismo usuario", () => {
    const rows = buildLogisticsCommissionRows({
      usuarios: [
        {
          usuarioId: 1,
          nombre: "Encargado",
          activo: true,
          posicionesPago: [{ cargo: "ENCARGADO DE LOGISTICA" }],
        },
        {
          usuarioId: 2,
          nombre: "Junior uno",
          activo: true,
          roles: ["Repartidor"],
          posicionesPago: [{ cargo: "CHOFER" }],
        },
        {
          usuarioId: 3,
          nombre: "Junior dos",
          activo: true,
          posicionesPago: [{ cargo: "CHOFER" }],
        },
      ],
      asignaciones: [
        { usuarioId: 2, entregaId: 50, fecha: "2026-07-03" },
        { usuarioId: 2, entregaId: 50, fecha: "2026-07-03" },
        { usuarioId: 3, entregaId: 50, fecha: "2026-07-03" },
      ],
      weeks: [{ startDate: "2026-07-02", endDate: "2026-07-08" }],
    });

    expect(rows[0].resumenMensual).toMatchObject({
      totalEntregas: 0,
      totalEntregasJuniors: 1,
      totalEntregasParaBono: 2,
      totalBonoJuniors: 1,
      totalPagar: 1,
    });
    expect(rows.find((row) => row.usuarioId === 2).resumenMensual.totalPagar).toBe(1);
    expect(rows.find((row) => row.usuarioId === 3).resumenMensual.totalPagar).toBe(1);
  });

  test("213 entregas generan bono de 106.50 y pago de 142.50 con 36 entregas propias", () => {
    const usuarios = [
      { usuarioId: 1, nombre: "Encargado", activo: true, posicionesPago: [{ cargo: "JEFE LOGISTICA" }] },
      { usuarioId: 2, nombre: "Chofer uno", activo: true, posicionesPago: [{ cargo: "CHOFER" }] },
      { usuarioId: 3, nombre: "Chofer dos", activo: true, posicionesPago: [{ cargo: "CHOFER" }] },
    ];
    const asignaciones = [36, 95, 82].flatMap((cantidad, index) =>
      Array.from({ length: cantidad }, (_, numero) => ({
        usuarioId: index + 1, entregaId: (index + 1) * 1000 + numero,
        fecha: numero % 2 === 0 ? "2026-08-07" : "2026-08-14",
      })),
    );
    const weeks = [
      { startDate: "2026-08-06", endDate: "2026-08-12" },
      { startDate: "2026-08-13", endDate: "2026-08-19" },
    ];
    const rows = buildLogisticsCommissionRows({ usuarios, asignaciones, weeks });
    const encargado = rows.find(row => row.usuarioId === 1);
    expect(encargado.resumenMensual).toMatchObject({
      totalEntregas: 36, totalEntregasParaBono: 213,
      totalComisionEntregasPropias: 36, totalBonoJuniors: 106.5, totalPagar: 142.5,
    });
    expect(rows.find(row => row.usuarioId === 2).resumenMensual.totalPagar).toBe(95);
    expect(rows.find(row => row.usuarioId === 3).resumenMensual.totalPagar).toBe(82);
    expect(weeks.reduce((sum, week) => sum + encargado.semanas[week.startDate].bonoJuniors, 0)).toBe(106.5);
    expect(weeks.reduce((sum, week) => sum + encargado.semanas[week.startDate].totalComisiones, 0)).toBe(142.5);
  });

  test("cada encargado suma sus entregas propias a las de choferes, con cero si no hay entregas", () => {
    const usuarios = [
      { usuarioId: 1, nombre: "Encargado uno", activo: true, posicionesPago: [{ cargo: "JEFE LOGISTICA" }] },
      { usuarioId: 2, nombre: "Encargado dos", activo: true, posicionesPago: [{ cargo: "ENCARGADO LOGISTICA" }] },
      { usuarioId: 3, nombre: "Chofer", activo: true, posicionesPago: [{ cargo: "CHOFER" }] },
    ];
    const weeks = [{ startDate: "2026-08-06", endDate: "2026-08-12" }];
    const rows = buildLogisticsCommissionRows({ usuarios, weeks, asignaciones: [
      { usuarioId: 1, entregaId: 10, fecha: "2026-08-07" },
      { usuarioId: 3, entregaId: 20, fecha: "2026-08-07" },
    ] });
    expect(rows.find(row => row.usuarioId === 1).resumenMensual).toMatchObject({ totalEntregasParaBono: 2, totalBonoJuniors: 1 });
    expect(rows.find(row => row.usuarioId === 2).resumenMensual).toMatchObject({ totalEntregasParaBono: 1, totalBonoJuniors: 0.5 });
    expect(buildLogisticsCommissionRows({ usuarios, weeks }).every(row => row.resumenMensual.totalPagar === 0)).toBe(true);
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

  test.each(["REPARTIDOR CHOFER", "CHOFER"])(
    "identifica logistica por cargo %s aunque no tenga rol repartidor",
    (cargo) => {
      expect(getLogisticsProfile({
        rol: "Logistica",
        posicionesPago: [{ cargo }],
      })).toMatchObject({ tipo: "JUNIOR", cargo });
    },
  );

  test.each([
    { cargo: "REPARTIDOR" },
    { rol: "Repartidor", posicionesPago: [] },
    { roles: ["Repartidor"], posicionesPago: [{ cargo: "VENDEDOR" }] },
    { rol: "Chofer", posicionesPago: [] },
  ])("excluye personal sin cargo de chofer aunque tenga rol de reparto: %j", (usuario) => {
    expect(getLogisticsProfile(usuario)).toBeNull();
  });

  test("reconoce al jefe de logistica entre varios cargos y prioriza su cargo", () => {
    expect(getLogisticsProfile({ posicionesPago: [
      { cargo: "REPARTIDOR CHOFER" },
      { cargo: "Jefe de Logística" },
    ] })).toMatchObject({ tipo: "ENCARGADO", cargo: "Jefe de Logística" });
    expect(getLogisticsProfile({ cargo: "JEFE COMERCIAL" })).toBeNull();
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

  test("supervisor mantiene en la semana al vendedor que ingresa o sale durante esa semana", () => {
    const week = { startDate: "2026-07-09", endDate: "2026-07-15" };
    const members = [
      { usuarioId: 1, fechaIngreso: "2026-06-01", fechaSalida: null },
      { usuarioId: 2, fechaIngreso: "2026-06-01", fechaSalida: "2026-07-12" },
      { usuarioId: 3, fechaIngreso: "2026-06-01", fechaSalida: "2026-07-15" },
      { usuarioId: 4, fechaIngreso: "2026-06-01", fechaSalida: "2026-07-08" },
      { usuarioId: 5, fechaIngreso: "2026-07-16", fechaSalida: null },
      { usuarioId: 6, fechaIngreso: "2026-07-10", fechaSalida: null },
    ];

    expect(isAvailableForTeamWeek(members[1], week)).toBe(true);
    expect(
      getActiveTeamMembersForWeek(members, week).map((member) => member.usuarioId),
    ).toEqual([1, 2, 3, 6]);
    expect(
      getCommissionTeamMembersForWeek({
        members,
        week,
        esSupervisor: true,
      }).map((member) => member.usuarioId),
    ).toEqual([1, 2, 3, 6]);
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
      cantidadVendedoresComision: null,
      id: 1,
      jefeComercialId: 10,
      semanaInicio: "2026-07-09",
      vendedorIds: [12, 11],
    });
  });

  test("normaliza la seleccion mensual de vendedores para promedio de supervisor", () => {
    const map = buildSupervisorAverageSelectionsMap([
      {
        id: 1,
        supervisorComercialId: 20,
        anio: 2026,
        mes: 9,
        vendedorIds: [31, "32", 31, "invalido"],
      },
    ]);

    expect(normalizeSupervisorAverageSellerIds([31, "32", 31, "invalido"])).toEqual([
      31,
      32,
    ]);
    expect(map.get("20:2026:9")).toEqual({
      id: 1,
      supervisorComercialId: 20,
      year: 2026,
      month: 9,
      vendedorIds: [31, 32],
    });
  });

  test("normaliza la seleccion mensual de vendedores para promedio de jefe comercial", () => {
    const map = buildChiefAverageSelectionsMap([
      {
        id: 1,
        jefeComercialId: 40,
        anio: 2026,
        mes: 9,
        vendedorIds: [51, "52", 51, "invalido"],
      },
    ]);

    expect(normalizeChiefAverageSellerIds([51, "52", 51, "invalido"])).toEqual([
      51,
      52,
    ]);
    expect(map.get("40:2026:9")).toEqual({
      id: 1,
      jefeComercialId: 40,
      year: 2026,
      month: 9,
      vendedorIds: [51, 52],
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

describe("bono mensual del jefe comercial", () => {
  const calcular = (cantidad, configurado = true, supervisor = false, ventasSemanales = [50, 50, 50, 50]) => {
    const weeks = [5, 12, 19, 26].map(day => ({
      startDate: "2026-01-" + String(day).padStart(2, "0"),
      endDate: day === 26 ? "2026-02-01" : "2026-01-" + String(day + 6).padStart(2, "0"),
    }));
    if (ventasSemanales.length === 5) weeks.push({ startDate: "2026-02-02", endDate: "2026-02-08" });
    const jefe = {
      usuarioId: 1, grupoComision: supervisor ? "SUPERVISOR CALL CENTER" : "JEFE COMERCIAL",
      esJefeComercial: !supervisor, esSupervisorComercial: supervisor,
      cantidadVendedoresPromedioJefe: cantidad,
      cantidadVendedoresPromedioSupervisor: cantidad,
      promedioJefeMensualConfigurado: configurado,
      promedioSupervisorMensualConfigurado: configurado,
      semanas: Object.fromEntries(weeks.map((week, index) => [week.startDate, {
        venden: ventasSemanales[index], ventasParaPromedioAntiguedad: ventasSemanales[index], valorVendido: 1000, vendenParaBono: 10,
        cantidadVendedoresBono: index + 1, cantidadVendedores: index + 1,
      }])),
      total: { venden: 0, valorVendido: 0, totalComisiones: 0, noCumpleMetas: 0, valorDescontar: 0 },
    };
    const rules = buildMonthlyRulesByGroup([
      { grupo: "JEFE COMERCIAL", periodo: "BONO_MENSUAL", promedioPorVendedor: 10, bono: 100 },
      { grupo: "JEFE COMERCIAL", periodo: "BONO_MENSUAL", promedioPorVendedor: 20, bono: 200 },
    ], 4);
    const reglasSupervisor = buildMonthlyRulesByGroup([
      { grupo: "SUPERVISOR CALL CENTER", periodo: "BONO_MENSUAL", promedioPorVendedor: 10, bono: 60 },
      { grupo: "SUPERVISOR CALL CENTER", periodo: "BONO_MENSUAL", promedioPorVendedor: 20, bono: 80 },
    ], weeks.length);
    const reglasSemanales = buildWeeklyRulesByGroup([
      { grupo: "SUPERVISOR CALL CENTER", periodo: "COMISION_SEMANAL", unidadesVendidas: "1 EN ADELANTE", comisionPorEquipo: 2, porcentaje: null },
      { grupo: "JEFE COMERCIAL", periodo: "COMISION_SEMANAL", unidadesVendidas: "1 EN ADELANTE", comisionPorEquipo: 3, porcentaje: null },
    ]);
    finalizarVendedor(jefe, weeks, supervisor ? reglasSemanales : {}, { ...rules, ...reglasSupervisor }, { byRole: {}, byCargo: {} }, new Map());
    return jefe.resumenMensual;
  };
  test.each([true, false])("suma ventas de equipos semanales y usa divisor mensual con seleccion configurada %s", configurado => {
    expect(calcular(5, configurado)).toMatchObject({
      ventasConsideradasBono: 200,
      promedioVentasPorJunior: 10,
      totalVendedoresSemanas: null,
      valorComisionMensual: 100,
    });
  });
  test("suma 221 ventas de cinco equipos semanales y divide entre cinco semanas y tres vendedores", () => {
    expect(calcular(3, true, false, [40, 50, 30, 60, 41])).toMatchObject({
      ventasTvCelulaMensual: 221,
      ventasConsideradasBono: 221,
      promedioVentasPorJunior: 14.733,
      cantidadVendedoresPromedioJefe: 3,
    });
  });
  test("una semana sin ventas aporta cero sin reducir el numero de semanas", () => {
    expect(calcular(3, true, false, [0, 50, 50, 50])).toMatchObject({
      ventasTvCelulaMensual: 150,
      ventasConsideradasBono: 150,
      promedioVentasPorJunior: 12.5,
    });
  });
  test("cambiar cantidad seleccionada cambia divisor pero conserva ventas", () => {
    expect(calcular(2)).toMatchObject({ ventasConsideradasBono: 200, promedioVentasPorJunior: 25, valorComisionMensual: 200 });
  });
  test("sin vendedores seleccionados el promedio y bono son cero", () => {
    expect(calcular(0)).toMatchObject({ promedioVentasPorJunior: 0, valorComisionMensual: 0 });
  });
  test.each([true, false])("supervisor usa divisor mensual y tarifas de Call Center con seleccion configurada %s", configurado => {
    expect(calcular(5, configurado, true)).toMatchObject({
      totalVendedoresSemanas: null, promedioVentasPorJunior: 10,
      valorComisionSemanal: 400, valorComisionMensual: 60,
      totalComisionesSemanaMensual: 460,
    });
  });
  test("supervisor divide ventas semanales entre cinco semanas y tres vendedores", () => {
    expect(calcular(3, true, true, [40, 50, 30, 60, 41])).toMatchObject({
      ventasConsideradasBono: 221, promedioVentasPorJunior: 14.733,
      valorComisionMensual: 60,
    });
  });
  test("supervisor sin seleccionados no genera bono mensual", () => {
    expect(calcular(0, true, true)).toMatchObject({
      promedioVentasPorJunior: 0, valorComisionMensual: 0,
    });
  });
});

describe("cantidad para comision semanal", () => {
  test.each([1, 2, 3, 4, 5])("valida cantidad %s", cantidad => {
    expect(normalizarCantidadVendedoresComision(String(cantidad))).toBe(cantidad);
  });
  test.each([0, 6, -1, 1.5, "abc", true])("rechaza cantidad %s", cantidad => {
    expect(() => normalizarCantidadVendedoresComision(cantidad)).toThrow();
  });
  test("automatico y recuperacion de seleccion persistida", () => {
    expect(normalizarCantidadVendedoresComision(null)).toBeNull();
    const map = buildWeeklyTeamsMap([{ jefeComercialId: 1, semanaInicio: "2026-01-05", vendedorIds: [2, 3], cantidadVendedoresComision: 5 }]);
    expect([...map.values()][0]).toMatchObject({ vendedorIds: [2, 3], cantidadVendedoresComision: 5 });
  });
  test.each([false, true])("seleccion semanal usa tarifa del cargo sin alterar equipo ni promedio; supervisor %s", supervisor => {
    const grupo = supervisor ? "SUPERVISOR CALL CENTER" : "JEFE COMERCIAL";
    const weeks = [{ startDate: "2026-01-05", endDate: "2026-01-11" }, { startDate: "2026-01-12", endDate: "2026-01-18" }];
    const lider = {
      usuarioId: 1, grupoComision: grupo,
      esJefeComercial: !supervisor, esSupervisorComercial: supervisor,
      cantidadVendedoresPromedioJefe: 3, cantidadVendedoresPromedioSupervisor: 3,
      semanas: Object.fromEntries(weeks.map((week, i) => [week.startDate, {
        venden: 30, ventasParaPromedioAntiguedad: 30, valorVendido: 100, cantidadVendedores: 4,
        cantidadVendedoresComision: i === 0 ? 2 : 5,
      }])),
      total: { venden: 0, valorVendido: 0, totalComisiones: 0, noCumpleMetas: 0, valorDescontar: 0 },
    };
    const rules = buildWeeklyRulesByGroup(
      ["JEFE COMERCIAL", "SUPERVISOR CALL CENTER"].flatMap(cargo => [2, 4, 5].map(cantidad => ({
        grupo: cargo, subgrupo: cantidad + " VENDEDORES", periodo: "COMISION_SEMANAL",
        unidadesVendidas: "1 EN ADELANTE", comisionPorEquipo: cantidad * (cargo === "SUPERVISOR CALL CENTER" ? 2 : 1), porcentaje: null,
      }))),
    );
    finalizarVendedor(lider, weeks, rules, {}, { byRole: {}, byCargo: {} }, new Map());
    expect(lider.semanas[weeks[0].startDate].totalComisiones).toBe(supervisor ? 120 : 60);
    expect(lider.semanas[weeks[1].startDate].totalComisiones).toBe(supervisor ? 300 : 150);
    expect(lider.semanas[weeks[0].startDate].cantidadVendedores).toBe(4);
    expect(lider.resumenMensual.promedioVentasPorJunior).toBe(10);
    expect(lider.total.venden).toBe(60);
  });
});

test.each([false, true])("antiguedad afecta solo bono mensual del lider; supervisor %s", supervisor => {
  const grupo = supervisor ? "SUPERVISOR CALL CENTER" : "JEFE COMERCIAL";
  const weeks = [{ startDate: "2026-08-06", endDate: "2026-08-12" }];
  const crear = elegibles => ({
    usuarioId: 1, grupoComision: grupo, esJefeComercial: !supervisor, esSupervisorComercial: supervisor,
    cantidadVendedoresPromedioJefe: 2, cantidadVendedoresPromedioSupervisor: 2,
    semanas: { "2026-08-06": { venden: 40, ventasParaPromedioAntiguedad: elegibles, valorVendido: 1000, cantidadVendedores: 4, cantidadVendedoresComision: 3 } },
    total: { venden: 0, valorVendido: 0, totalComisiones: 0, noCumpleMetas: 0, valorDescontar: 0 },
  });
  const semanal = buildWeeklyRulesByGroup([{ grupo, subgrupo: "3 VENDEDORES", periodo: "COMISION_SEMANAL", unidadesVendidas: "1 EN ADELANTE", comisionPorEquipo: 2, porcentaje: null }]);
  const mensual = buildMonthlyRulesByGroup([{ grupo, periodo: "BONO_MENSUAL", promedioPorVendedor: 15, bono: 100 }], 1);
  const antes = crear(40);
  const despues = crear(20);
  for (const lider of [antes, despues]) finalizarVendedor(lider, weeks, semanal, mensual, { byRole: {}, byCargo: {} }, new Map());
  expect(despues.total).toEqual(antes.total);
  expect(despues.semanas["2026-08-06"].totalComisiones).toBe(80);
  expect(despues.resumenMensual).toMatchObject({ ventasTvCelulaMensual: 40, ventasConsideradasBono: 20, promedioVentasPorJunior: 10, valorComisionSemanal: 80, valorComisionMensual: 0 });
  expect(antes.resumenMensual.valorComisionMensual).toBe(100);
});
