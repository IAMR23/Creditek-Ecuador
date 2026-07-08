const RolPago = require("../models/RolPago");

const DESCRIPCIONES_NIVEL = {
  ASISTENTE:
    "nivel operativo/sin especializacion ni juniors/su estadistica depende 100% de su produccion individual",
  ENCARGADO:
    "nivel operativo y ciertas tareas ejecutivas/con especializacion en su tarea operativa y capacidad de enseñar a otros, puede o no tener juniors/su estadistica depende de su produccion individual y de la correcta ejecucion de los procesos que enseña y supervisa a otros",
  TÉCNICO:
    "posee un título y conocimiento en un campo especifico que requiere licencia para ejercer/nivel operativo/no tiene juniors/su estadistica depende 100% de su produccion individual",
  SUPERVISOR:
    "nivel ejecutivo, contacto directo a diario con sus juniors a quienes capacita, evalúa y corrige diariamente, alta especializacion, alta capacidad de enseñar y retroalimentar, tiene juniors y su estadística depende al 100% de la producción de ellos.",
  ESPECIALISTA:
    "posee un titulo y conocimiento en un campo especifico/nivel operativo y ciertas tareas ejecutivas/con especialización en su tarea operativa y capacidad de enseñar a otros, puedeo o no tener juniors/su estadistica depende de su produccion individual y de la correcta ejecucion de los procesos que enseña y supervisa a otros",
  JEFE:
    "nivel ejecutivo alto, contacto diario con supervisores y encargados, baja a niveles operativos solo en ausencia de supervisor o encargado, alta especializacion en formación de líderes(encargados y supervisores) su estadistica depende de la producción de los juniors de sus juniors. Su trabajo es analizar la realidad y definir estrategias para cumplir las metas.",
  GERENTE:
    "Alto nivel ejecutivo, 100% estratega, evalua y diseña el plan para alcanzar los objetivos propuestos por el consejo ejecutivo y responde a este/su estadistica depende de los indicadores claves de gestión de su area. Su responsabilidad es la rentabilidad y expansión de su área.",
};

const ROLES_PAGO_INICIALES = [
  {
    nivel: "ASISTENTE",
    cargo: "PROMOTOR",
    sueldoBase: 482,
    sueldoExtra: 0,
    comisiones: "12 o más semanal",
    ingresoMin: 500,
    ingresoMax: 700,
  },
  {
    nivel: "ASISTENTE",
    cargo: "VENDEDOR PISO",
    sueldoBase: 482,
    sueldoExtra: 0,
    comisiones: "12 o más semanal",
    ingresoMin: 500,
    ingresoMax: 700,
  },
  {
    nivel: "ASISTENTE",
    cargo: "VENDEDOR CALL CENTER",
    sueldoBase: 482,
    sueldoExtra: 0,
    comisiones: "10 o más semanal",
    ingresoMin: 500,
    ingresoMax: 700,
  },
  {
    nivel: "ASISTENTE",
    cargo: "ENCARGADO",
    sueldoBase: 482,
    sueldoExtra: 0,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 500,
    ingresoMax: 700,
  },
  {
    nivel: "ENCARGADO",
    cargo: "ENCARGADO DE AGENCIA",
    sueldoBase: 482,
    sueldoExtra: 48,
    comisiones: "24 o mas semanal",
    ingresoMin: 640,
    ingresoMax: 800,
  },
  {
    nivel: "ENCARGADO",
    cargo: "ENCARGADO DE LOGISTICA",
    sueldoBase: 482,
    sueldoExtra: 48,
    comisiones: "SEGÚN TABLA",
    ingresoMin: 640,
    ingresoMax: 800,
  },
  {
    nivel: "TÉCNICO",
    cargo: "CHOFER",
    sueldoBase: 482,
    sueldoExtra: 68,
    comisiones: "1 por entrega",
    ingresoMin: 650,
    ingresoMax: 750,
  },
  {
    nivel: "TÉCNICO",
    cargo: "VIDEO MAKER",
    sueldoBase: 482,
    sueldoExtra: 68,
    comisiones: null,
    ingresoMin: 650,
    ingresoMax: 750,
  },
  {
    nivel: "SUPERVISOR",
    cargo: "SUPERVISOR DE CALL CENTER",
    sueldoBase: 482,
    sueldoExtra: 118,
    comisiones: "SEGÚN TABLA",
    ingresoMin: 700,
    ingresoMax: 980,
  },
  {
    nivel: "SUPERVISOR",
    cargo: "SUPERVISOR DE PISO",
    sueldoBase: 482,
    sueldoExtra: 118,
    comisiones: "SEGÚN TABLA",
    ingresoMin: 700,
    ingresoMax: 980,
  },
  {
    nivel: "SUPERVISOR",
    cargo: "SUPERVISOR DE MKT",
    sueldoBase: 482,
    sueldoExtra: 118,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 700,
    ingresoMax: 980,
  },
  {
    nivel: "ESPECIALISTA",
    cargo: "CONTADOR",
    sueldoBase: 482,
    sueldoExtra: 188,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 670,
    ingresoMax: 750,
  },
  {
    nivel: "ESPECIALISTA",
    cargo: "ESPECIALISTA EN TI",
    sueldoBase: 482,
    sueldoExtra: 188,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 670,
    ingresoMax: 750,
  },
  {
    nivel: "JEFE",
    cargo: "JEFE COMERCIAL DE PISO",
    sueldoBase: 482,
    sueldoExtra: 268,
    comisiones: "SEGÚN TABLA",
    ingresoMin: 1100,
    ingresoMax: 1900,
  },
  {
    nivel: "JEFE",
    cargo: "JEFE COMERCIAL DE CALL CENTER",
    sueldoBase: 482,
    sueldoExtra: 268,
    comisiones: "SEGÚN TABLA",
    ingresoMin: 1100,
    ingresoMax: 1900,
  },
  {
    nivel: "JEFE",
    cargo: "JEFE DE OPERACIONES",
    sueldoBase: 482,
    sueldoExtra: 268,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 1100,
    ingresoMax: 1900,
  },
  {
    nivel: "JEFE",
    cargo: "JEFE DESARROLLO ORGANIZACIONAL",
    sueldoBase: 482,
    sueldoExtra: 268,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 1100,
    ingresoMax: 1900,
  },
  {
    nivel: "JEFE",
    cargo: "JEFE DE CONTABILIDAD",
    sueldoBase: 482,
    sueldoExtra: 268,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 1100,
    ingresoMax: 1900,
  },
  {
    nivel: "JEFE",
    cargo: "JEFE DE SISTEMAS",
    sueldoBase: 482,
    sueldoExtra: 268,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 1100,
    ingresoMax: 1900,
  },
  {
    nivel: "GERENTE",
    cargo: "GERENTE COMERCIAL",
    sueldoBase: 482,
    sueldoExtra: 1018,
    comisiones: "SEGÚN TABLA",
    ingresoMin: 2500,
    ingresoMax: 5000,
  },
  {
    nivel: "GERENTE",
    cargo: "GERENTE FINANCIERO",
    sueldoBase: 482,
    sueldoExtra: 1018,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 2500,
    ingresoMax: 5000,
  },
  {
    nivel: "GERENTE",
    cargo: "GERENTE DE TI",
    sueldoBase: 482,
    sueldoExtra: 1018,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 2500,
    ingresoMax: 5000,
  },
  {
    nivel: "GERENTE",
    cargo: "GERENTE DE MARKETING",
    sueldoBase: 482,
    sueldoExtra: 1018,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 2500,
    ingresoMax: 5000,
  },
  {
    nivel: "GERENTE",
    cargo: "GERENTE DE OPERACIONES",
    sueldoBase: 482,
    sueldoExtra: 1018,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 2500,
    ingresoMax: 5000,
  },
  {
    nivel: "GERENTE",
    cargo: "GERENTE GENERAL",
    sueldoBase: 482,
    sueldoExtra: 1018,
    comisiones: "BONO ESTABLECIDO SEGÚN RESPONSABILIDADES",
    ingresoMin: 2500,
    ingresoMax: 5000,
  },
];

const normalizarRolPago = (rol) => ({
  ...rol,
  descripcion: DESCRIPCIONES_NIVEL[rol.nivel] || null,
  activo: true,
});

const seedRolesPago = async () => {
  for (const rol of ROLES_PAGO_INICIALES.map(normalizarRolPago)) {
    const existente = await RolPago.findOne({ where: { cargo: rol.cargo } });

    if (existente) {
      await existente.update(rol);
    } else {
      await RolPago.create(rol);
    }
  }
};

module.exports = {
  ROLES_PAGO_INICIALES,
  seedRolesPago,
};
