const { Op } = require("sequelize");
const Agencia = require("../../models/Agencia");
const ReporteCajaUsuarioAgencia = require("../../models/ReporteCajaUsuarioAgencia");

const includeAgencia = [
  {
    model: Agencia,
    as: "agencia",
    attributes: ["id", "nombre", "ciudad", "activo"],
  },
];

const serializar = (item) => ({
  id: item.id,
  codigoUsuario: item.codigoUsuario,
  agenciaId: item.agenciaId,
  agencia: item.agencia,
  fechaDesde: item.fechaDesde,
  fechaHasta: item.fechaHasta,
  activo: item.activo,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const validarPayload = async (body = {}) => {
  const codigoUsuario = String(body.codigoUsuario || "").trim().toUpperCase();
  const agenciaId = Number(body.agenciaId);
  const fechaDesde = String(body.fechaDesde || "").trim();
  const fechaHasta = String(body.fechaHasta || "").trim() || null;

  if (!codigoUsuario || !/^\S{1,80}$/.test(codigoUsuario)) {
    return {
      error:
        "El codigo del usuario es obligatorio, no debe tener espacios y admite hasta 80 caracteres.",
    };
  }

  if (!Number.isInteger(agenciaId) || agenciaId < 1) {
    return { error: "Selecciona una agencia valida." };
  }

  const esFechaValida = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const fecha = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === value;
  };

  if (!esFechaValida(fechaDesde)) {
    return { error: "Selecciona una fecha inicial valida." };
  }

  if (fechaHasta && !esFechaValida(fechaHasta)) {
    return { error: "Selecciona una fecha final valida." };
  }

  if (fechaHasta && fechaHasta < fechaDesde) {
    return { error: "La fecha final no puede ser anterior a la fecha inicial." };
  }

  const agencia = await Agencia.findOne({
    where: { id: agenciaId, activo: true },
    attributes: ["id"],
  });
  if (!agencia) return { error: "La agencia seleccionada no existe o esta inactiva." };

  return {
    data: { codigoUsuario, agenciaId, fechaDesde, fechaHasta, activo: true },
  };
};

const existeSolapamiento = async (data, excluirId = null) => {
  const condiciones = [
    data.fechaHasta
      ? { fechaDesde: { [Op.lte]: data.fechaHasta } }
      : {},
    {
      [Op.or]: [
        { fechaHasta: null },
        { fechaHasta: { [Op.gte]: data.fechaDesde } },
      ],
    },
  ];

  return ReporteCajaUsuarioAgencia.findOne({
    where: {
      codigoUsuario: data.codigoUsuario,
      activo: true,
      ...(excluirId ? { id: { [Op.ne]: excluirId } } : {}),
      [Op.and]: condiciones,
    },
    attributes: ["id", "fechaDesde", "fechaHasta"],
  });
};

const responderError = (res, error, mensaje) => {
  if (error?.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      ok: false,
      message: "Ese codigo de usuario ya tiene una asignacion en la misma fecha inicial.",
    });
  }

  console.error(mensaje, error);
  return res.status(500).json({ ok: false, message: mensaje });
};

exports.listar = async (_req, res) => {
  try {
    const [configuraciones, agencias] = await Promise.all([
      ReporteCajaUsuarioAgencia.findAll({
        include: includeAgencia,
        order: [["codigoUsuario", "ASC"], ["fechaDesde", "DESC"]],
      }),
      Agencia.findAll({
        where: { activo: true },
        attributes: ["id", "nombre", "ciudad"],
        order: [["nombre", "ASC"]],
      }),
    ]);

    return res.json({
      ok: true,
      configuraciones: configuraciones.map(serializar),
      agencias,
    });
  } catch (error) {
    return responderError(res, error, "No se pudo cargar la configuracion de reportes de caja.");
  }
};

exports.crear = async (req, res) => {
  try {
    const validacion = await validarPayload(req.body);
    if (validacion.error) {
      return res.status(400).json({ ok: false, message: validacion.error });
    }

    const solapamiento = await existeSolapamiento(validacion.data);
    if (solapamiento) {
      return res.status(409).json({
        ok: false,
        message:
          "El codigo ya tiene una agencia configurada dentro de ese periodo. Cierra o edita la vigencia anterior.",
      });
    }

    const existente = await ReporteCajaUsuarioAgencia.findOne({
      where: {
        codigoUsuario: validacion.data.codigoUsuario,
        fechaDesde: validacion.data.fechaDesde,
        activo: false,
      },
    });
    let registro;
    if (existente) {
      if (existente.activo) {
        return res.status(409).json({
          ok: false,
          message: "Ese codigo ya tiene una asignacion en esa fecha inicial.",
        });
      }
      registro = await existente.update(validacion.data);
    } else {
      registro = await ReporteCajaUsuarioAgencia.create(validacion.data);
    }

    const configuracion = await ReporteCajaUsuarioAgencia.findByPk(registro.id, {
      include: includeAgencia,
    });
    return res.status(201).json({ ok: true, configuracion: serializar(configuracion) });
  } catch (error) {
    return responderError(res, error, "No se pudo crear la configuracion.");
  }
};

exports.actualizar = async (req, res) => {
  try {
    const validacion = await validarPayload(req.body);
    if (validacion.error) {
      return res.status(400).json({ ok: false, message: validacion.error });
    }

    const registro = await ReporteCajaUsuarioAgencia.findOne({
      where: { id: req.params.id, activo: true },
    });
    if (!registro) {
      return res.status(404).json({ ok: false, message: "La configuracion no existe." });
    }

    const solapamiento = await existeSolapamiento(validacion.data, registro.id);
    if (solapamiento) {
      return res.status(409).json({
        ok: false,
        message:
          "El codigo ya tiene otra agencia configurada dentro de ese periodo.",
      });
    }

    await registro.update(validacion.data);
    const configuracion = await ReporteCajaUsuarioAgencia.findByPk(registro.id, {
      include: includeAgencia,
    });
    return res.json({ ok: true, configuracion: serializar(configuracion) });
  } catch (error) {
    return responderError(res, error, "No se pudo actualizar la configuracion.");
  }
};

exports.eliminar = async (req, res) => {
  try {
    const registro = await ReporteCajaUsuarioAgencia.findOne({
      where: { id: req.params.id, activo: true },
    });
    if (!registro) {
      return res.status(404).json({ ok: false, message: "La configuracion no existe." });
    }

    await registro.update({ activo: false });
    return res.json({ ok: true, message: "Configuracion desactivada correctamente." });
  } catch (error) {
    return responderError(res, error, "No se pudo desactivar la configuracion.");
  }
};
