const { Op } = require("sequelize");

const ESTADOS_FINALIZADOS = Object.freeze(["Entregado", "No Entregado"]);
const CLASIFICACIONES_INFORME_ENTREGA = Object.freeze([
  "Entrega",
  "Envio",
  "ProcesoCompleto",
]);

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

const criteriosClasificacionInformeEntrega = (clasificacion) => {
  if (!clasificacion || clasificacion === "todos") return {};

  if (["Entrega", "Envio"].includes(clasificacion)) {
    return { tipoEntrega: clasificacion };
  }

  if (clasificacion === "ProcesoCompleto") {
    return {
      [Op.and]: [
        { FechaHoraLlamada: null },
        {
          [Op.or]: [{ fotoFechaLlamada: null }, { fotoFechaLlamada: "" }],
        },
      ],
    };
  }

  throw new RangeError("Clasificacion de entrega no permitida");
};

const responsableRequiereRevision = (entrega, responsable) =>
  entrega?.estado === "Transito" &&
  (!responsable ||
    responsable.activo === false ||
    responsable.usuario?.activo === false);

module.exports = {
  CLASIFICACIONES_INFORME_ENTREGA,
  ESTADOS_FINALIZADOS,
  criteriosAsignacionVigente,
  criteriosClasificacionInformeEntrega,
  criteriosEntregaPendiente,
  criteriosEntregaVisible,
  responsableRequiereRevision,
};
