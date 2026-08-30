jest.mock("../config/db", () => ({
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock("../models/Cliente", () => ({ findAll: jest.fn() }));
jest.mock("../models/CierreCaja/CierreCaja", () => ({ findAll: jest.fn() }));
jest.mock("../models/CierreCaja/MovimientoCaja", () => ({ findAll: jest.fn() }));
jest.mock("../models/ControlFinancieroCarga", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/ControlFinancieroRegistro", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/ControlFinancieroConciliacionCaja", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
}));

const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Cliente = require("../models/Cliente");
const CierreCaja = require("../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../models/CierreCaja/MovimientoCaja");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const ControlFinancieroConciliacionCaja = require(
  "../models/ControlFinancieroConciliacionCaja",
);
const {
  conciliarCargaCaja,
  construirResultadosConciliacionCaja,
} = require("./conciliacionCuotasCajaService");
const {
  normalizarFechaCalendario,
} = require("./conciliacionFinancieraUtils");

const fecha = "2026-08-25";

const registro = (id, cliente, monto, fechaRegistro = "8/25/26 10:00 AM") => ({
  id,
  tipoRegistro: "CAJA",
  fecha: fechaRegistro,
  cliente,
  pagosCuotas: monto,
  contrato: `C-${id}`,
  agencia: "AGENCIA A",
});

const movimiento = (
  id,
  entidad,
  valor,
  cierreId = 10,
  extra = {},
) => ({
  id,
  cierreId,
  detalle: "CUOTA",
  entidad,
  clienteId: null,
  valor,
  responsable: "CAJERO",
  formaPago: "EFECTIVO",
  ...extra,
});

const calcular = ({
  registros = [],
  movimientos = [],
  cierres = [{ id: 10, fecha, agenciaId: 2, estadoCierre: "CERRADO" }],
  clientes = [],
} = {}) =>
  construirResultadosConciliacionCaja({
    registros,
    movimientos,
    cierres,
    clientes,
  });

describe("conciliacionCuotasCajaService matching deterministico", () => {
  test("normaliza fecha calendario sin desplazar el dia por UTC", () => {
    expect(normalizarFechaCalendario("2026-08-25T23:59:00-05:00")).toBe(
      "2026-08-25",
    );
    expect(normalizarFechaCalendario("25/08/26 10:00 AM")).toBe(
      "2026-08-25",
    );
    expect(
      normalizarFechaCalendario(new Date("2026-08-26T02:00:00.000Z")),
    ).toBe("2026-08-25");
    expect(normalizarFechaCalendario("2026-02-30")).toBeNull();
  });

  test("caso 1: coincide por fecha, cliente y monto", () => {
    const calculo = calcular({
      registros: [registro(1, "JUAN PEREZ", 25)],
      movimientos: [movimiento(101, "JUAN PEREZ", 25)],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "COINCIDE",
        movimientoCajaId: 101,
        fechaReporteRegistro: fecha,
        fechaCierre: fecha,
      }),
    );
  });

  test("caso 2 y 13: nunca usa el mismo cliente y monto de otra fecha", () => {
    const calculo = calcular({
      registros: [registro(1, "JUAN PEREZ", 25)],
      cierres: [
        { id: 9, fecha: "2026-08-24", estadoCierre: "CERRADO" },
        { id: 10, fecha, estadoCierre: "CERRADO" },
      ],
      movimientos: [
        movimiento(100, "JUAN PEREZ", 25, 9),
        movimiento(101, "JUAN PEREZ", 25, 10),
      ],
    });

    expect(calculo.resultados[0].movimientoCajaId).toBe(101);
    expect(calculo.resultados.find((item) => item.movimientoCajaId === 100)).toEqual(
      expect.objectContaining({ estado: "SOLO_EN_CIERRE" }),
    );
  });

  test("caso 3: monto diferente solo para el mismo cliente en la misma fecha", () => {
    const calculo = calcular({
      registros: [registro(1, "JUAN PEREZ", 25)],
      movimientos: [movimiento(101, "JUAN PEREZ", 20)],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "MONTO_DIFERENTE",
        montoReporte: 25,
        montoCierre: 20,
        diferencia: 5,
      }),
    );
  });

  test("casos 4 y 5: cliente diferente o cierre inexistente queda NO_EN_CIERRE", () => {
    const clienteDiferente = calcular({
      registros: [registro(1, "JUAN PEREZ", 25)],
      movimientos: [movimiento(101, "CARLOS PEREZ", 25)],
    });
    const sinCierre = calcular({
      registros: [registro(1, "JUAN PEREZ", 25)],
      cierres: [],
      movimientos: [],
    });

    expect(clienteDiferente.resultados[0].estado).toBe("NO_EN_CIERRE");
    expect(sinCierre.resultados[0].estado).toBe("NO_EN_CIERRE");
  });

  test("caso 6: movimiento CUOTA sin reporte queda SOLO_EN_CIERRE", () => {
    const calculo = calcular({
      movimientos: [movimiento(101, "JUAN PEREZ", 25)],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "SOLO_EN_CIERRE",
        controlFinancieroRegistroId: null,
        diferencia: -25,
      }),
    );
  });

  test("caso 7: un movimiento solamente justifica un registro duplicado", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 20),
      ],
      movimientos: [movimiento(101, "JUAN PEREZ", 20)],
    });

    expect(calculo.resumen.coinciden).toBe(1);
    expect(calculo.resumen.noEnCierre).toBe(1);
  });

  test("agrupa cuotas del mismo cliente cuando un movimiento cubre la suma", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 20),
      ],
      movimientos: [movimiento(101, "JUAN PEREZ", 40)],
    });

    expect(calculo.resumen.coinciden).toBe(2);
    expect(calculo.resumen.noEnCierre).toBe(0);
    expect(calculo.resumen.soloEnCierre).toBe(0);
    expect(calculo.resultados).toEqual([
      expect.objectContaining({
        estado: "COINCIDE",
        movimientoCajaId: 101,
        montoReporte: 20,
        montoCierre: 20,
        diferencia: 0,
        tipoCoincidencia: "NOMBRE_EXACTO_CUOTAS_AGRUPADAS",
        agrupacionCaja: expect.objectContaining({
          movimientoCajaId: 101,
          montoMovimiento: 40,
          montoAsignado: 20,
          registrosAgrupados: [1, 2],
          totalRegistrosAgrupados: 2,
        }),
      }),
      expect.objectContaining({
        estado: "COINCIDE",
        movimientoCajaId: 101,
        montoReporte: 20,
        montoCierre: 20,
        diferencia: 0,
        tipoCoincidencia: "NOMBRE_EXACTO_CUOTAS_AGRUPADAS",
      }),
    ]);
  });

  test("agrupa centavos y dolares del mismo cliente exacto", () => {
    const calculo = calcular({
      registros: [
        registro(1, "ANGELA PATRICIA SANTIN TIPANLUISA", 0.2),
        registro(2, "ANGELA PATRICIA SANTIN TIPANLUISA", 13.8),
      ],
      movimientos: [
        movimiento(101, "ANGELA PATRICIA SANTIN TIPANLUISA", 14),
      ],
    });

    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        coinciden: 2,
        montoDiferente: 0,
        noEnCierre: 0,
        soloEnCierre: 0,
      }),
    );
    expect(calculo.resultados).toEqual([
      expect.objectContaining({
        estado: "COINCIDE",
        tipoCoincidencia: "NOMBRE_EXACTO_CUOTAS_AGRUPADAS",
        montoReporte: 0.2,
        montoCierre: 0.2,
        diferencia: 0,
      }),
      expect.objectContaining({
        estado: "COINCIDE",
        tipoCoincidencia: "NOMBRE_EXACTO_CUOTAS_AGRUPADAS",
        montoReporte: 13.8,
        montoCierre: 13.8,
        diferencia: 0,
      }),
    ]);
  });

  test("agrupa cuotas cuando el nombre del cierre es similar", () => {
    const calculo = calcular({
      registros: [
        registro(1, "ANGELA PATRICIA SANTIN TIPANLUISA", 0.2),
        registro(2, "ANGELA PATRICIA SANTIN TIPANLUISA", 13.8),
      ],
      movimientos: [
        movimiento(101, "ANGELA PATRICIA SANTIN TIPANLUZA", 14),
      ],
    });

    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        coinciden: 2,
        montoDiferente: 0,
        noEnCierre: 0,
        soloEnCierre: 0,
      }),
    );
    expect(calculo.resultados.every((item) => item.estado === "COINCIDE")).toBe(
      true,
    );
    expect(
      calculo.resultados.every(
        (item) => item.tipoCoincidencia === "NOMBRE_SIMILAR_CUOTAS_AGRUPADAS",
      ),
    ).toBe(true);
  });

  test("agrupa cuotas cuando el nombre del reporte esta truncado sin ambiguedad", () => {
    const calculo = calcular({
      registros: [
        registro(1, "GUSTAVO ANDRES CHANAGUANO", 20),
        registro(2, "GUSTAVO ANDRES CHANAGUANO", 20),
      ],
      movimientos: [
        movimiento(101, "GUSTAVO ANDRES CHANAGUANO CHUGCHILAN", 40),
      ],
    });

    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        coinciden: 2,
        montoDiferente: 0,
        noEnCierre: 0,
        soloEnCierre: 0,
      }),
    );
    expect(
      calculo.resultados.every(
        (item) => item.tipoCoincidencia === "NOMBRE_TRUNCADO_CUOTAS_AGRUPADAS",
      ),
    ).toBe(true);
  });

  test("agrupa cuotas cuando el cierre tiene nombre y apellido parciales", () => {
    const calculo = calcular({
      registros: [
        registro(1, "ANGELA PATRICIA SANTIN TIPANLUISA", 0.2),
        registro(2, "ANGELA PATRICIA SANTIN TIPANLUISA", 13.8),
      ],
      movimientos: [movimiento(101, "ANGELA SANTIN", 14)],
    });

    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        coinciden: 2,
        montoDiferente: 0,
        noEnCierre: 0,
        soloEnCierre: 0,
      }),
    );
    expect(
      calculo.resultados.every(
        (item) => item.tipoCoincidencia === "NOMBRE_PARCIAL_CUOTAS_AGRUPADAS",
      ),
    ).toBe(true);
  });

  test("no agrupa automaticamente cuando hay nombres similares ambiguos", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAM PEREZ", 20),
        registro(2, "JUAM PEREZ", 1380),
        registro(3, "JUAN PERES", 20),
        registro(4, "JUAN PERES", 1380),
      ],
      movimientos: [movimiento(101, "JUAN PEREZ", 1400)],
    });

    expect(
      calculo.resultados.some((item) =>
        String(item.tipoCoincidencia || "").includes("CUOTAS_AGRUPADAS"),
      ),
    ).toBe(false);
    expect(calculo.resumen.coinciden).toBe(0);
  });

  test("mantiene monto diferente cuando no existen cuotas compatibles para sumar", () => {
    const calculo = calcular({
      registros: [registro(1, "ANGELA PATRICIA SANTIN TIPANLUISA", 0.2)],
      movimientos: [
        movimiento(101, "ANGELA PATRICIA SANTIN TIPANLUISA", 14),
      ],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "MONTO_DIFERENTE",
        montoReporte: 0.2,
        montoCierre: 14,
        diferencia: -13.8,
      }),
    );
  });

  test("agrupa tres cuotas cuando suman el movimiento de cierre", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 10),
        registro(2, "JUAN PEREZ", 20),
        registro(3, "JUAN PEREZ", 10),
      ],
      movimientos: [movimiento(101, "JUAN PEREZ", 40)],
    });

    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        coinciden: 3,
        montoDiferente: 0,
        noEnCierre: 0,
        soloEnCierre: 0,
      }),
    );
    expect(
      calculo.resultados.every(
        (item) => item.tipoCoincidencia === "NOMBRE_EXACTO_CUOTAS_AGRUPADAS",
      ),
    ).toBe(true);
  });

  test("no reutiliza registros consumidos por un match exacto anterior", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 20),
      ],
      movimientos: [
        movimiento(101, "JUAN PEREZ", 20),
        movimiento(102, "JUAN PEREZ", 40),
      ],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "COINCIDE",
        movimientoCajaId: 101,
        tipoCoincidencia: "NOMBRE_EXACTO",
      }),
    );
    expect(calculo.resultados[1]).toEqual(
      expect.objectContaining({
        estado: "MONTO_DIFERENTE",
        movimientoCajaId: 102,
      }),
    );
    expect(
      calculo.resultados.some((item) =>
        String(item.tipoCoincidencia || "").includes("CUOTAS_AGRUPADAS"),
      ),
    ).toBe(false);
  });

  test("no reutiliza un movimiento ya consumido por una agrupacion", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 1380),
        registro(3, "JUAN PEREZ", 20),
        registro(4, "JUAN PEREZ", 1380),
      ],
      movimientos: [movimiento(101, "JUAN PEREZ", 1400)],
    });

    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        coinciden: 2,
        montoDiferente: 0,
        noEnCierre: 2,
        soloEnCierre: 0,
      }),
    );
    expect(calculo.resultados.filter((item) => item.movimientoCajaId === 101))
      .toHaveLength(2);
  });

  test("no agrupa cuotas con movimientos de otro cliente o fecha", () => {
    const clienteDiferente = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 20),
      ],
      movimientos: [movimiento(101, "CARLOS PEREZ", 40)],
    });
    const fechaDiferente = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 20),
      ],
      cierres: [{ id: 9, fecha: "2026-08-24", estadoCierre: "CERRADO" }],
      movimientos: [movimiento(101, "JUAN PEREZ", 40, 9)],
    });

    expect(clienteDiferente.resumen).toEqual(
      expect.objectContaining({
        coinciden: 0,
        noEnCierre: 2,
        soloEnCierre: 1,
      }),
    );
    expect(fechaDiferente.resumen).toEqual(
      expect.objectContaining({
        coinciden: 0,
        noEnCierre: 2,
        soloEnCierre: 1,
      }),
    );
  });

  test("caso 8: resuelve todos los exactos antes de analizar montos diferentes", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 30),
      ],
      movimientos: [
        movimiento(101, "JUAN PEREZ", 30),
        movimiento(102, "JUAN PEREZ", 20),
      ],
    });

    expect(calculo.resultados.map((item) => item.estado)).toEqual([
      "COINCIDE",
      "COINCIDE",
    ]);
  });

  test("prioriza exactos antes de clasificar un residual", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 30),
      ],
      movimientos: [movimiento(101, "JUAN PEREZ", 30)],
    });

    expect(calculo.resultados[0].estado).toBe("NO_EN_CIERRE");
    expect(calculo.resultados[1].estado).toBe("COINCIDE");
  });

  test("caso 9: normaliza tildes y no confunde nombres distintos", () => {
    const exacto = calcular({
      registros: [registro(1, "Jos\u00e9 Luis P\u00e9rez", 25)],
      movimientos: [movimiento(101, "JOSE   LUIS PEREZ", 25)],
    });
    const nombreMasLargo = calcular({
      registros: [registro(1, "JUAN CARLOS PEREZ", 25)],
      movimientos: [movimiento(101, "JUAN MARCOS PEREZ LOPEZ", 25)],
    });

    expect(exacto.resultados[0].estado).toBe("COINCIDE");
    expect(nombreMasLargo.resultados[0].estado).toBe("NO_EN_CIERRE");
  });

  test("acepta un nombre del reporte truncado al final", () => {
    const calculo = calcular({
      registros: [registro(1, "GUSTAVO ANDRES CHANAGUANO", 25)],
      movimientos: [
        movimiento(101, "GUSTAVO ANDRES CHANAGUANO CHUGCHILAN", 25),
      ],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "COINCIDE",
        tipoCoincidencia: "NOMBRE_TRUNCADO",
        similitudCliente: 1,
        movimientoCajaId: 101,
      }),
    );
  });

  test("no asigna un nombre truncado si el prefijo identifica a dos clientes", () => {
    const calculo = calcular({
      registros: [registro(1, "GUSTAVO ANDRES CHANAGUANO", 25)],
      movimientos: [
        movimiento(101, "GUSTAVO ANDRES CHANAGUANO CHUGCHILAN", 25),
        movimiento(102, "GUSTAVO ANDRES CHANAGUANO LOPEZ", 25),
      ],
    });

    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        coinciden: 0,
        noEnCierre: 1,
        soloEnCierre: 2,
      }),
    );
  });

  test("acepta nombre parcial del cierre con al menos un nombre y un apellido", () => {
    const calculo = calcular({
      registros: [registro(1, "ANGELA PATRICIA SANTIN TIPANLUISA", 25)],
      movimientos: [movimiento(101, "ANGELA SANTIN", 25)],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "COINCIDE",
        tipoCoincidencia: "NOMBRE_PARCIAL",
        similitudCliente: 1,
        movimientoCajaId: 101,
      }),
    );
  });

  test("acepta nombre parcial inicial del cierre frente al nombre completo del reporte", () => {
    const calculo = calcular({
      registros: [registro(1, "YOLANDA CUMBAJIN GUAYASAMIN", 25)],
      movimientos: [movimiento(101, "YOLANDA CUMBAJIN", 25)],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "COINCIDE",
        tipoCoincidencia: "NOMBRE_PARCIAL",
        similitudCliente: 1,
        movimientoCajaId: 101,
      }),
    );
  });

  test("no acepta nombre parcial cuando el cierre solo tiene un nombre", () => {
    const calculo = calcular({
      registros: [registro(1, "ANGELA PATRICIA SANTIN TIPANLUISA", 25)],
      movimientos: [movimiento(101, "ANGELA", 25)],
    });

    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        coinciden: 0,
        noEnCierre: 1,
        soloEnCierre: 1,
      }),
    );
  });

  test("acepta automaticamente nombres con similitud minima del 90%", () => {
    const calculo = calcular({
      registros: [registro(1, "JUAN PEREZ", 25)],
      movimientos: [movimiento(101, "JUAM PEREZ", 25)],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "COINCIDE",
        tipoCoincidencia: "NOMBRE_SIMILAR",
        similitudCliente: 0.9,
        movimientoCajaId: 101,
      }),
    );
  });

  test("el umbral del nombre no reemplaza fecha ni monto", () => {
    const fechaDistinta = calcular({
      registros: [registro(1, "JUAN PEREZ", 25)],
      cierres: [{ id: 9, fecha: "2026-08-24", estadoCierre: "CERRADO" }],
      movimientos: [movimiento(101, "JUAM PEREZ", 25, 9)],
    });
    const montoDistinto = calcular({
      registros: [registro(1, "JUAN PEREZ", 25)],
      movimientos: [movimiento(101, "JUAM PEREZ", 20)],
    });

    expect(fechaDistinta.resultados[0].estado).toBe("NO_EN_CIERRE");
    expect(montoDistinto.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "MONTO_DIFERENTE",
        tipoCoincidencia: "NOMBRE_SIMILAR",
        similitudCliente: 0.9,
      }),
    );
  });

  test("el matching por similitud tambien conserva el consumo uno a uno", () => {
    const calculo = calcular({
      registros: [
        registro(1, "JUAN PEREZ", 20),
        registro(2, "JUAN PEREZ", 20),
      ],
      movimientos: [movimiento(101, "JUAM PEREZ", 20)],
    });

    expect(calculo.resumen.coinciden).toBe(1);
    expect(calculo.resumen.noEnCierre).toBe(1);
  });

  test("caso 10: usa el nombre canonico de Cliente cuando existe clienteId", () => {
    const calculo = calcular({
      registros: [registro(1, "Jos\u00e9 Luis P\u00e9rez", 25)],
      movimientos: [
        movimiento(101, "TEXTO DE AUDITORIA", 25, 10, { clienteId: 42 }),
      ],
      clientes: [{ id: 42, cliente: "JOSE LUIS PEREZ" }],
    });

    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "COINCIDE",
        clienteId: 42,
        clienteCierre: "JOSE LUIS PEREZ",
        entidadCierre: "TEXTO DE AUDITORIA",
      }),
    );
  });

  test("caso 11: usa entidad para el historico sin clienteId", () => {
    const calculo = calcular({
      registros: [registro(1, "Juan P\u00e9rez", 25)],
      movimientos: [movimiento(101, "JUAN PEREZ", 25)],
    });

    expect(calculo.resultados[0].estado).toBe("COINCIDE");
  });

  test("caso 12: la agencia nunca participa en la clave", () => {
    const calculo = calcular({
      registros: [registro(1, "JUAN PEREZ", 20)],
      cierres: [{ id: 10, fecha, agenciaId: 999, estadoCierre: "CERRADO" }],
      movimientos: [movimiento(101, "JUAN PEREZ", 20)],
    });

    expect(calculo.resultados[0].estado).toBe("COINCIDE");
  });

  test("caso 14: concilia cada fila contra su propia fecha", () => {
    const calculo = calcular({
      registros: [
        registro(1, "ANA", 10, "8/23/26 10:00 AM"),
        registro(2, "CARLOS", 20, "8/24/26 10:00 AM"),
        registro(3, "JUAN", 30, "8/25/26 10:00 AM"),
      ],
      cierres: [
        { id: 8, fecha: "2026-08-23", estadoCierre: "CERRADO" },
        { id: 9, fecha: "2026-08-24", estadoCierre: "CERRADO" },
        { id: 10, fecha: "2026-08-25", estadoCierre: "CERRADO" },
      ],
      movimientos: [
        movimiento(101, "ANA", 10, 8),
        movimiento(102, "CARLOS", 20, 9),
        movimiento(103, "JUAN", 30, 10),
      ],
    });

    expect(calculo.fechas).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
    ]);
    expect(calculo.resumen.coinciden).toBe(3);
  });

  test("caso 15: una fecha invalida nunca recibe un match automatico", () => {
    const calculo = calcular({
      registros: [registro(1, "JUAN PEREZ", 20, null)],
      movimientos: [movimiento(101, "JUAN PEREZ", 20)],
    });

    expect(calculo.resultados[0].estado).toBe("FECHA_INVALIDA");
    expect(calculo.resumen.coinciden).toBe(0);
  });

  test("caso 16: compara 39.99 en centavos enteros", () => {
    const calculo = calcular({
      registros: [registro(1, "JUAN PEREZ", "39.99")],
      movimientos: [movimiento(101, "JUAN PEREZ", "39.99")],
    });

    expect(calculo.resultados[0].estado).toBe("COINCIDE");
    expect(calculo.resumen.diferenciaTotal).toBe(0);
  });

  test("solo incluye movimientos cuyo detalle normalizado es CUOTA", () => {
    const calculo = calcular({
      registros: [registro(1, "JUAN PEREZ", 20)],
      movimientos: [
        movimiento(101, "JUAN PEREZ", 20, 10, { detalle: "ENTRADA" }),
        movimiento(102, "JUAN PEREZ", 20, 10, { detalle: " cuota " }),
      ],
    });

    expect(calculo.resultados[0].movimientoCajaId).toBe(102);
    expect(calculo.resumen.totalMovimientosCierre).toBe(1);
  });
});

describe("conciliacionCuotasCajaService persistencia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.query.mockResolvedValue([]);
    sequelize.transaction.mockImplementation(async (callback) =>
      callback({ id: "transaction" }),
    );
    ControlFinancieroCarga.findByPk.mockResolvedValue({
      id: 25,
      fechaReporte: fecha,
      estado: "ACTIVA",
    });
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      registro(1, "JUAN PEREZ", 25),
    ]);
    CierreCaja.findAll.mockResolvedValue([
      { id: 10, fecha, agenciaId: 2, estadoCierre: "CERRADO" },
    ]);
    MovimientoCaja.findAll.mockResolvedValue([
      movimiento(101, "JUAN PEREZ", 25),
    ]);
    Cliente.findAll.mockResolvedValue([]);
    ControlFinancieroConciliacionCaja.create.mockImplementation(
      async (payload) => ({ id: 90, createdAt: new Date(), ...payload }),
    );
  });

  test("consulta en bloque, filtra cierres cerrados y crea historial atomico", async () => {
    const conciliacion = await conciliarCargaCaja({
      cargaId: 25,
      origen: "MANUAL",
      usuarioId: 7,
    });

    expect(ControlFinancieroRegistro.findAll).toHaveBeenCalledTimes(1);
    expect(CierreCaja.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fecha: { [Op.in]: [fecha] },
          estadoCierre: { [Op.in]: ["CERRADO"] },
        }),
      }),
    );
    expect(MovimientoCaja.findAll).toHaveBeenCalledTimes(1);
    expect(Cliente.findAll).not.toHaveBeenCalled();
    expect(ControlFinancieroConciliacionCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cargaId: 25,
        fechas: [fecha],
        origen: "MANUAL",
        ejecutadoPor: 7,
      }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(conciliacion.resumen.coinciden).toBe(1);
  });
});
