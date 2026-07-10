const SancionConfiguracion = require("../models/SancionConfiguracion");
const INICIALES = [
  { cargoReferencia: "VENDEDOR CALL CENTER", periodo: "SEMANAL", minimoUnidades: 9, valorMultaUnidad: 7, descripcion: "Mínimo semanal para evitar sanción", activo: true },
  { cargoReferencia: "VENDEDOR PISO", periodo: "SEMANAL", minimoUnidades: 11, valorMultaUnidad: 7, descripcion: "Mínimo semanal para evitar sanción", activo: true },
];
const seedSancionesConfiguracion = async () => {
  for (const data of INICIALES) {
    const [row] = await SancionConfiguracion.findOrCreate({ where: { cargoReferencia: data.cargoReferencia, periodo: data.periodo }, defaults: data });
    await row.update(data);
  }
};
module.exports = { INICIALES, seedSancionesConfiguracion };
