const pagosComisionesService = require("../../services/pagosComisionesService");
const Usuario = require("../../models/Usuario");
const RolPago = require("../../models/RolPago");

const responderError = (res, error) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || "Error al procesar pagos de comisiones",
  });
};

const obtenerReporte = async (req, res) => {
  try {
    const reporte = await pagosComisionesService.obtenerReportePagosComisiones(req.query);
    res.json(reporte);
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarJefeComercial = async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuarioId);
    const jefeComercialId = req.body.jefeComercialId
      ? Number(req.body.jefeComercialId)
      : null;

    const usuario = await Usuario.findByPk(usuarioId, {
      include: [{ model: RolPago, as: "rolPago", attributes: ["cargo"] }],
    });
    if (!usuario) return res.status(404).json({ message: "Vendedor no encontrado" });

    if (jefeComercialId === usuarioId) {
      return res.status(400).json({ message: "Un usuario no puede ser su propio jefe" });
    }

    if (jefeComercialId) {
      const jefe = await Usuario.findByPk(jefeComercialId, {
        include: [{ model: RolPago, as: "rolPago", attributes: ["cargo"] }],
      });
      const cargoJefe = String(jefe?.rolPago?.cargo || "").toUpperCase();
      if (!jefe || !jefe.activo || !cargoJefe.includes("JEFE COMERCIAL")) {
        return res.status(400).json({ message: "Debe seleccionar un jefe comercial activo" });
      }
    }

    await usuario.update({ jefeComercialId });
    return res.json({
      message: jefeComercialId ? "Jefe comercial asignado" : "Asignacion eliminada",
      usuarioId,
      jefeComercialId,
    });
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarSupervisorComercial = async (req, res) => {
  try {
    const usuarioId = Number(req.params.usuarioId);
    const supervisorComercialId = req.body.supervisorComercialId
      ? Number(req.body.supervisorComercialId)
      : null;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) return res.status(404).json({ message: "Vendedor no encontrado" });

    if (supervisorComercialId === usuarioId) {
      return res.status(400).json({ message: "Un usuario no puede ser su propio supervisor" });
    }

    if (supervisorComercialId) {
      const supervisor = await Usuario.findByPk(supervisorComercialId, {
        include: [{ model: RolPago, as: "rolPago", attributes: ["cargo"] }],
      });
      const cargo = String(supervisor?.rolPago?.cargo || "").toUpperCase();
      const esSupervisorComercial =
        cargo.includes("SUPERVISOR") &&
        (cargo.includes("PISO") || cargo.includes("CALL CENTER"));
      if (!supervisor || !supervisor.activo || !esSupervisorComercial) {
        return res.status(400).json({ message: "Debe seleccionar un supervisor comercial activo" });
      }
    }

    await usuario.update({ supervisorComercialId });
    return res.json({
      message: supervisorComercialId ? "Supervisor asignado" : "Asignacion eliminada",
      usuarioId,
      supervisorComercialId,
    });
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = {
  obtenerReporte,
  actualizarJefeComercial,
  actualizarSupervisorComercial,
};
