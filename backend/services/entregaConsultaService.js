const { Op } = require("sequelize");

const ESTADOS_FINALIZADOS = Object.freeze(["Entregado", "No Entregado"]);

const criteriosEntregaVisible = (extra = {}) => ({
  activo: true,
  estado: { [Op.ne]: "Eliminado" },
  ...extra,
});

const criteriosEntregaPendiente = (extra = {}) =>
  criteriosEntregaVisible({ estado: "Transito", ...extra });

const criteriosAsignacionVigente = (extra = {}) => ({
  activo: true,
  ...extra,
});

const responsableRequiereRevision = (entrega, responsable) =>
  entrega?.estado === "Transito" &&
  (!responsable ||
    responsable.activo === false ||
    responsable.usuario?.activo === false);

module.exports = {
  ESTADOS_FINALIZADOS,
  criteriosAsignacionVigente,
  criteriosEntregaPendiente,
  criteriosEntregaVisible,
  responsableRequiereRevision,
};
