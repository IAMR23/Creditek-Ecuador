const {
  isCargoPagoComisionable,
  buildPersonalSellerView,
  getCommissionablePaidPosition,
  hasCommissionablePaidPosition,
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
  resolveSalesSanctionConfig,
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

  test("incluye al jefe comercial para calcular la produccion de sus juniors", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 15,
        cargo: "JEFE COMERCIAL DE PISO",
      }),
    ).toBe(true);
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

  test("toda persona con dos cargos queda exenta de sancion por meta", () => {
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
          tieneMultiplesCargos: true,
        },
        sanctionsByRole,
      ),
    ).toBeNull();
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

  test("vista de vendedores muestra solo ventas personales del doble cargo", () => {
    const weeks = [
      { startDate: "2026-07-02", endDate: "2026-07-08" },
      { startDate: "2026-07-09", endDate: "2026-07-15" },
    ];
    const view = buildPersonalSellerView({
      vendedor: {
        fechaCreacionUsuario: "2026-01-01",
        fechaIngreso: "2026-01-01",
      },
      weeks,
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
      valorDescontar: 0,
    });
    expect(view.resumenMensual).toMatchObject({
      ventasTvCelulaMensual: 6,
      valorComisionSemanal: 0,
      valorComisionMensual: 0,
      totalPagar: 0,
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

  test("personal nuevo no genera unidades incumplidas ni valor a descontar", () => {
    const personalNuevo = isNewPersonnelDuringWeek({
      fechaCreacionUsuario: "2026-07-01",
      week: { startDate: "2026-07-23", endDate: "2026-07-29" },
    });

    expect(
      calculateWeeklyPenalty({
        config: { minimoUnidades: 9, valorMultaUnidad: 8 },
        unidadesVendidas: 2,
        aplicaDescuento: !personalNuevo,
        multaOmitida: false,
      }),
    ).toEqual({
      noCumpleMetas: 0,
      valorMultaCalculado: 0,
      valorDescontar: 0,
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
