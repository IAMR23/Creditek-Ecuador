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

const listarConfiguracionMeses = async (req, res) => {
  try {
    const resultado = await pagosComisionesService.listarConfiguracionMesesComision({
      year: req.query.year,
    });
    res.json(resultado);
  } catch (error) {
    responderError(res, error);
  }
};

const obtenerConfiguracionMes = async (req, res) => {
  try {
    const resultado = await pagosComisionesService.obtenerConfiguracionMesComision({
      year: req.params.year,
      month: req.params.month,
    });
    res.json(resultado);
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarConfiguracionMes = async (req, res) => {
  try {
    const resultado = await pagosComisionesService.guardarConfiguracionMesComision({
      year: req.params.year,
      month: req.params.month,
      cantidadSemanas: req.body.cantidadSemanas,
      observacion: req.body.observacion,
      usuarioId: req.user.id,
    });
    res.json(resultado);
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarConfiguracionAnual = async (req, res) => {
  try {
    const resultado = await pagosComisionesService.guardarConfiguracionAnualComision({
      year: req.params.year,
      meses: req.body.meses,
      usuarioId: req.user.id,
    });
    res.json(resultado);
  } catch (error) {
    responderError(res, error);
  }
};

const marcarPeriodoPagado = async (req, res) => {
  try {
    const resultado =
      await pagosComisionesService.marcarPeriodoPagosComisionesPagado({
        year: req.params.year,
        month: req.params.month,
        usuarioId: req.user.id,
        observacion: req.body.observacion,
      });
    res.json(resultado);
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

const actualizarOmisionMulta = async (req, res) => {
  try {
    const resultado = await pagosComisionesService.actualizarOmisionMulta({
      usuarioId: req.params.usuarioId,
      semanaInicio: req.params.semanaInicio,
      omitida: req.body.omitida,
      valorDescontar: req.body.valorDescontar,
      restaurarValorCalculado: req.body.restaurarValorCalculado,
      actualizadoPorId: req.user.id,
    });
    return res.json(resultado);
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarValoresMultas = async (req, res) => {
  try {
    const resultado = await pagosComisionesService.actualizarValoresMultas({
      year: req.body.year,
      month: req.body.month,
      ajustes: req.body.ajustes,
      actualizadoPorId: req.user.id,
    });
    return res.json(resultado);
  } catch (error) {
    return responderError(res, error);
  }
};

const guardarEquipoSemanalJefeComercial = async (req, res) => {
  try {
    const resultado =
      await pagosComisionesService.guardarEquipoSemanalJefeComercial({
        jefeComercialId: req.params.jefeComercialId,
        semanaInicio: req.params.semanaInicio,
        vendedorIds: req.body.vendedorIds,
        actualizadoPorId: req.user.id,
      });
    return res.json(resultado);
  } catch (error) {
    return responderError(res, error);
  }
};

const guardarEquipoSemanalSupervisorComercial = async (req, res) => {
  try {
    const resultado =
      await pagosComisionesService.guardarEquipoSemanalSupervisorComercial({
        supervisorComercialId: req.params.supervisorComercialId,
        semanaInicio: req.params.semanaInicio,
        vendedorIds: req.body.vendedorIds,
        actualizadoPorId: req.user.id,
      });
    return res.json(resultado);
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  obtenerReporte,
  listarConfiguracionMeses,
  obtenerConfiguracionMes,
  actualizarConfiguracionMes,
  actualizarConfiguracionAnual,
  marcarPeriodoPagado,
  actualizarJefeComercial,
  actualizarSupervisorComercial,
  guardarEquipoSemanalJefeComercial,
  guardarEquipoSemanalSupervisorComercial,
  actualizarOmisionMulta,
  actualizarValoresMultas,
};
