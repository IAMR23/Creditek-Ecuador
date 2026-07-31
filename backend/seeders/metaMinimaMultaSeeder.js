const RolPago = require("../models/RolPago");
const MetaMinimaMultaConfiguracion = require("../models/MetaMinimaMultaConfiguracion");
const {
  isVendedorCallCenterCargo,
  isVendedorPisoCargo,
} = require("../services/metaMinimaMultaService");

const seedRoleConfigs = async ({ roles, matcher, minimoUnidades, valorMultaUnidad, descripcion }) => {
  const matches = roles.filter((rolPago) => matcher(rolPago.cargo));
  if (!matches.length) {
    console.warn(`[meta-minima] No se encontro rol para ${descripcion}`);
    return;
  }

  for (const rolPago of matches) {
    const [config, created] = await MetaMinimaMultaConfiguracion.findOrCreate({
      where: { rolPagoId: rolPago.id },
      defaults: {
        cargoReferencia: rolPago.cargo,
        minimoUnidades,
        valorMultaUnidad,
        descripcion,
        activo: true,
      },
    });

    if (!created && !config.activo) {
      await config.update({
        cargoReferencia: rolPago.cargo,
        minimoUnidades,
        valorMultaUnidad,
        descripcion,
        activo: true,
      });
    }
  }
};

const seedMetaMinimaMultaConfiguracion = async () => {
  const roles = await RolPago.findAll({ where: { activo: true } });

  await seedRoleConfigs({
    roles,
    matcher: isVendedorPisoCargo,
    minimoUnidades: 11,
    valorMultaUnidad: 7,
    descripcion: "Meta minima semanal sin multa para vendedor de piso",
  });

  await seedRoleConfigs({
    roles,
    matcher: isVendedorCallCenterCargo,
    minimoUnidades: 9,
    valorMultaUnidad: 7,
    descripcion: "Meta minima semanal sin multa para vendedor call center",
  });
};

module.exports = { seedMetaMinimaMultaConfiguracion };
