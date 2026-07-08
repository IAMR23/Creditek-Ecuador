const ComisionConfiguracion = require("../models/ComisionConfiguracion");

const COMISIONES_INICIALES = [
  ["SUPERVISOR CALL CENTER", "2 vendedores", "COMISION_SEMANAL", "20", 1, null, null, null, "20", null],
  ["SUPERVISOR CALL CENTER", "2 vendedores", "COMISION_SEMANAL", "22", 1.5, null, null, null, "33", null],
  ["SUPERVISOR CALL CENTER", "2 vendedores", "COMISION_SEMANAL", "24", 2, null, null, null, "48", null],
  ["SUPERVISOR CALL CENTER", "2 vendedores", "COMISION_SEMANAL", "30", 3, null, null, null, "90", null],
  ["SUPERVISOR CALL CENTER", "2 vendedores", "BONO_MENSUAL", null, null, null, "10", 60, null, null],
  ["SUPERVISOR CALL CENTER", "2 vendedores", "BONO_MENSUAL", null, null, null, "11", 80, null, null],
  ["SUPERVISOR CALL CENTER", "2 vendedores", "BONO_MENSUAL", null, null, null, "13", 100, null, null],

  ["SUPERVISOR CALL CENTER", "3 vendedores", "COMISION_SEMANAL", "30", 1, null, null, null, "30", null],
  ["SUPERVISOR CALL CENTER", "3 vendedores", "COMISION_SEMANAL", "33", 1.5, null, null, null, "49.5", null],
  ["SUPERVISOR CALL CENTER", "3 vendedores", "COMISION_SEMANAL", "36", 2, null, null, null, "72", null],
  ["SUPERVISOR CALL CENTER", "3 vendedores", "COMISION_SEMANAL", "45", 3, null, null, null, "135", null],

  ["SUPERVISOR CALL CENTER", "4 vendedores", "COMISION_SEMANAL", "40", 1, null, null, null, "40", null],
  ["SUPERVISOR CALL CENTER", "4 vendedores", "COMISION_SEMANAL", "44", 1.5, null, null, null, "66", null],
  ["SUPERVISOR CALL CENTER", "4 vendedores", "COMISION_SEMANAL", "48", 2, null, null, null, "96", null],
  ["SUPERVISOR CALL CENTER", "4 vendedores", "COMISION_SEMANAL", "60", 3, null, null, null, "180", null],

  ["SUPERVISOR PISO", "2 vendedores", "COMISION_SEMANAL", "24", 1, null, null, null, "24", null],
  ["SUPERVISOR PISO", "2 vendedores", "COMISION_SEMANAL", "26", 1.5, null, null, null, "39", null],
  ["SUPERVISOR PISO", "2 vendedores", "COMISION_SEMANAL", "28", 2, null, null, null, "56", null],
  ["SUPERVISOR PISO", "2 vendedores", "COMISION_SEMANAL", "32", 3, null, null, null, "96", null],
  ["SUPERVISOR PISO", "2 vendedores", "BONO_MENSUAL", null, null, null, "12", 60, null, null],
  ["SUPERVISOR PISO", "2 vendedores", "BONO_MENSUAL", null, null, null, "13", 80, null, null],
  ["SUPERVISOR PISO", "2 vendedores", "BONO_MENSUAL", null, null, null, "15", 100, null, null],

  ["SUPERVISOR PISO", "3 vendedores", "COMISION_SEMANAL", "36", 1, null, null, null, "36", "12*3"],
  ["SUPERVISOR PISO", "3 vendedores", "COMISION_SEMANAL", "39", 1.5, null, null, null, "58.5", "13*3"],
  ["SUPERVISOR PISO", "3 vendedores", "COMISION_SEMANAL", "42", 2, null, null, null, "84", "14*3"],
  ["SUPERVISOR PISO", "3 vendedores", "COMISION_SEMANAL", "45", 3, null, null, null, "135", "15*3"],

  ["JEFE COMERCIAL PISO", null, "COMISION_SEMANAL", "24", 1, null, null, null, "24", null],
  ["JEFE COMERCIAL PISO", null, "COMISION_SEMANAL", "26", 1.5, null, null, null, "39", null],
  ["JEFE COMERCIAL PISO", null, "COMISION_SEMANAL", "28", 2, null, null, null, "56", null],
  ["JEFE COMERCIAL PISO", null, "COMISION_SEMANAL", "32", 3, null, null, null, "96", null],
  ["JEFE COMERCIAL PISO", null, "BONO_MENSUAL", null, null, null, "12", 60, null, null],
  ["JEFE COMERCIAL PISO", null, "BONO_MENSUAL", null, null, null, "13", 80, null, null],
  ["JEFE COMERCIAL PISO", null, "BONO_MENSUAL", null, null, null, "15", 100, null, null],

  ["VENDEDORES DE PISO Y FURGONETA", null, "COMISION_SEMANAL", "12", null, 0.003, null, null, "8 a 10 usd", null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "COMISION_SEMANAL", "13-15", null, 0.01, null, null, "35 a 65 usd", null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "COMISION_SEMANAL", "16-19", null, 0.018, null, null, "70 a 85 usd", null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "COMISION_SEMANAL", "20-23", null, 0.025, null, null, "130 a 170", null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "COMISION_SEMANAL", "24-27", null, 0.03, null, null, "200 a 240", null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "COMISION_SEMANAL", "28…", null, 0.035, null, null, "280....", null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "BONO_MENSUAL_4_SEMANAS", "48", null, null, null, 60, "SOLO NUEVOS", null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "BONO_MENSUAL_4_SEMANAS", "52", null, null, null, 80, null, null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "BONO_MENSUAL_4_SEMANAS", "60", null, null, null, 100, null, null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "BONO_MENSUAL_4_SEMANAS", "equipo extra", null, null, null, 1.75, "c/u", null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "BONO_MENSUAL_5_SEMANAS", "60", null, null, null, 60, "SOLO NUEVOS", "12*5"],
  ["VENDEDORES DE PISO Y FURGONETA", null, "BONO_MENSUAL_5_SEMANAS", "65", null, null, null, 80, null, "13*5"],
  ["VENDEDORES DE PISO Y FURGONETA", null, "BONO_MENSUAL_5_SEMANAS", "75", null, null, null, 100, null, null],
  ["VENDEDORES DE PISO Y FURGONETA", null, "BONO_MENSUAL_5_SEMANAS", "equipo extra", null, null, null, 1.75, "c/u", null],

  ["VENDEDORES DE CALL CENTER", null, "COMISION_SEMANAL", "10", 1.5, null, null, null, "15 usd", null],
  ["VENDEDORES DE CALL CENTER", null, "COMISION_SEMANAL", "11 a 13", 3, null, null, null, "33 a 39 usd", null],
  ["VENDEDORES DE CALL CENTER", null, "COMISION_SEMANAL", "14 a 16", 4.5, null, null, null, "56 a 76 usd", null],
  ["VENDEDORES DE CALL CENTER", null, "COMISION_SEMANAL", "17 a 20", 5, null, null, null, "85 a 100 usd", null],
  ["VENDEDORES DE CALL CENTER", null, "COMISION_SEMANAL", "21 a 25", 7, null, null, null, "147 a 175 usd", null],
  ["VENDEDORES DE CALL CENTER", null, "COMISION_SEMANAL", "26…", 10, null, null, null, "260 usd", null],
  ["VENDEDORES DE CALL CENTER", null, "BONO_MENSUAL_4_SEMANAS", "40", null, null, null, 60, "SOLO NUEVOS", null],
  ["VENDEDORES DE CALL CENTER", null, "BONO_MENSUAL_4_SEMANAS", "44", null, null, null, 80, null, null],
  ["VENDEDORES DE CALL CENTER", null, "BONO_MENSUAL_4_SEMANAS", "56", null, null, null, 100, null, null],
  ["VENDEDORES DE CALL CENTER", null, "BONO_MENSUAL_4_SEMANAS", "equipo extra", null, null, null, 1.75, "c/u", null],
  ["VENDEDORES DE CALL CENTER", null, "BONO_MENSUAL_5_SEMANAS", "50", null, null, null, 60, "SOLO NUEVOS", "10*5"],
  ["VENDEDORES DE CALL CENTER", null, "BONO_MENSUAL_5_SEMANAS", "55", null, null, null, 80, null, "11*5"],
  ["VENDEDORES DE CALL CENTER", null, "BONO_MENSUAL_5_SEMANAS", "70", null, null, null, 100, null, "14*5"],
  ["VENDEDORES DE CALL CENTER", null, "BONO_MENSUAL_5_SEMANAS", "equipo extra", null, null, null, 1.75, "c/u", null],
];

const toRecord = (row, index) => {
  const [
    grupo,
    subgrupo,
    periodo,
    unidadesVendidas,
    comisionPorEquipo,
    porcentaje,
    promedioPorVendedor,
    bono,
    valorAproximado,
    notas,
  ] = row;

  return {
    grupo,
    subgrupo,
    periodo,
    unidadesVendidas,
    comisionPorEquipo,
    porcentaje,
    promedioPorVendedor,
    bono,
    valorAproximado,
    notas,
    orden: index + 1,
    activo: true,
  };
};

const seedComisionesConfiguracion = async () => {
  const registros = COMISIONES_INICIALES.map(toRecord);

  for (const registro of registros) {
    const existente = await ComisionConfiguracion.findOne({
      where: {
        grupo: registro.grupo,
        periodo: registro.periodo,
        subgrupo: registro.subgrupo,
        unidadesVendidas: registro.unidadesVendidas,
        orden: registro.orden,
      },
    });

    if (existente) {
      await existente.update(registro);
    } else {
      await ComisionConfiguracion.create(registro);
    }
  }
};

module.exports = {
  COMISIONES_INICIALES,
  seedComisionesConfiguracion,
};
