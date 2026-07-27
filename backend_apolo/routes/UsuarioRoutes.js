const express = require("express");
const bcrypt = require("bcryptjs");
const {
  Op,
  Transaction,
  col,
  fn,
  where: sequelizeWhere,
} = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const Agencia = require("../models/Agencia");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const rveSyncService = require("../services/rveSyncService");
const {
  normalizarFechaSalida,
  sincronizarFechaSalidaEnMovimientos,
} = require("../services/fechaSalidaMovimientosService");
const {
  condicionCampoNormalizado,
  crearBaseUsuarioDesdeEmail,
  esUsuarioValido,
  normalizarUsuario,
} = require("../utils/usuarioLogin");

const router = express.Router();

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
const fechaIsoRegex = /^\d{4}-\d{2}-\d{2}$/;
const normalizeText = (value) => String(value ?? "").trim();
const normalizeOptionalText = (value) => normalizeText(value) || null;
const buildCedulaWhere = (cedula) =>
  sequelizeWhere(fn("BTRIM", col("cedula")), cedula);
const buildEmailWhere = (email) =>
  sequelizeWhere(
    fn("LOWER", fn("BTRIM", col("email"))),
    email.toLowerCase(),
  );
const buildUsuarioWhere = (usuario) =>
  condicionCampoNormalizado("usuario", usuario);
const httpError = (statusCode, code, message) =>
  Object.assign(new Error(message), { statusCode, code });

const findUsuarioByUsername = (usuario, transaction) =>
  Usuario.findOne({
    where: buildUsuarioWhere(usuario),
    transaction,
  });

const generarUsuarioDisponible = async (email, transaction) => {
  const base = crearBaseUsuarioDesdeEmail(email);
  let candidate = base;
  let suffix = 2;

  while (await findUsuarioByUsername(candidate, transaction)) {
    const suffixText = `_${suffix}`;
    candidate = `${base.slice(0, 50 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  return candidate;
};

const sincronizarFechaSalidaConRveSinBloquear = async ({
  usuario,
  fechaSalida,
  desactivar = false,
}) => {
  try {
    await rveSyncService.sincronizarSalidaUsuarioRve({
      cedula: usuario.cedula,
      fechaSalida: normalizarFechaSalida(fechaSalida),
      desactivar,
      origen: "ABS_USUARIOS",
    });
  } catch (error) {
    console.error(
      `No se pudo sincronizar fechaSalida con RVE para el usuario ABS ${usuario.id}:`,
      error.message,
    );
  }
};

router.post("/", async (req, res) => {
  try {
    const {
      nombre,
      cedula,
      email,
      usuario: nombreUsuario,
      password,
      rolId,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      direccion,
      telefono,
      agenciaId,
    } = req.body;
    const nombreNormalizado = normalizeText(nombre);
    const cedulaNormalizada = normalizeText(cedula);
    const emailNormalizado = normalizeText(email).toLowerCase();
    const usuarioSolicitado = normalizarUsuario(nombreUsuario);
    const fechaSalidaNormalizada = normalizarFechaSalida(fechaSalida);

    if (!nombreNormalizado) {
      return res.status(400).json({
        code: "NOMBRE_REQUERIDO",
        message: "El nombre es obligatorio.",
      });
    }

    if (!cedulaNormalizada) {
      return res.status(400).json({
        code: "CEDULA_REQUERIDA",
        message: "La cédula es obligatoria.",
      });
    }

    if (!emailNormalizado) {
      return res.status(400).json({
        code: "EMAIL_REQUERIDO",
        message: "El email es obligatorio.",
      });
    }

    if (usuarioSolicitado && !esUsuarioValido(usuarioSolicitado)) {
      return res.status(400).json({
        code: "USUARIO_INVALIDO",
        message:
          "El usuario debe tener entre 3 y 50 caracteres y usar solo letras, números, punto, guion o guion bajo.",
      });
    }

    if (!passwordRegex.test(password || "")) {
      return res.status(400).json({
        message: "La contraseña debe tener mínimo 6 caracteres e incluir letras y números.",
      });
    }

    if (!rolId) {
      return res.status(400).json({ message: "El campo rolId es obligatorio." });
    }

    if (!agenciaId) {
      return res.status(400).json({
        code: "AGENCIA_REQUERIDA",
        message: "La agencia es obligatoria.",
      });
    }

    if (
      fechaSalidaNormalizada &&
      !fechaIsoRegex.test(String(fechaSalidaNormalizada))
    ) {
      return res.status(400).json({
        code: "FECHA_SALIDA_INVALIDA",
        message: "La fecha de salida debe tener formato YYYY-MM-DD.",
      });
    }

    const nuevoUsuario = await sequelize.transaction(
      {
        isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE,
      },
      async (transaction) => {
        const [
          usuarioConCedula,
          usuarioConEmail,
          usuarioConNombre,
          existeRol,
          existeAgencia,
        ] = await Promise.all([
          Usuario.findOne({
            where: buildCedulaWhere(cedulaNormalizada),
            transaction,
          }),
          Usuario.findOne({
            where: buildEmailWhere(emailNormalizado),
            transaction,
          }),
          usuarioSolicitado
            ? findUsuarioByUsername(usuarioSolicitado, transaction)
            : Promise.resolve(null),
          Rol.findByPk(rolId, { transaction }),
          Agencia.findByPk(agenciaId, { transaction }),
        ]);

        if (usuarioConCedula) {
          throw httpError(
            409,
            "CEDULA_DUPLICADA",
            "Ya existe un usuario registrado con esta cédula.",
          );
        }

        if (usuarioConEmail) {
          throw httpError(
            409,
            "EMAIL_DUPLICADO",
            "El email ya está registrado.",
          );
        }

        if (usuarioConNombre) {
          throw httpError(
            409,
            "USUARIO_DUPLICADO",
            "El nombre de usuario ya está registrado.",
          );
        }

        if (!existeRol) {
          throw httpError(
            400,
            "ROL_INVALIDO",
            "El rol especificado no existe.",
          );
        }

        if (!existeAgencia) {
          throw httpError(
            400,
            "AGENCIA_INVALIDA",
            "La agencia especificada no existe.",
          );
        }

        const usuarioNormalizado =
          usuarioSolicitado ||
          (await generarUsuarioDisponible(emailNormalizado, transaction));
        const hashedPassword = await bcrypt.hash(password, 10);
        const usuarioCreado = await Usuario.create(
          {
            nombre: nombreNormalizado,
            cedula: cedulaNormalizada,
            email: emailNormalizado,
            usuario: usuarioNormalizado,
            password: hashedPassword,
            rolId,
            fechaIngreso: fechaIngreso || null,
            fechaSalida: fechaSalidaNormalizada,
            numeroCuenta: normalizeOptionalText(numeroCuenta),
            direccion: normalizeOptionalText(direccion),
            telefono: normalizeOptionalText(telefono),
            activo: true,
          },
          { transaction },
        );

        const relacionCreada = await UsuarioAgencia.create(
          {
            usuarioId: usuarioCreado.id,
            agenciaId,
            activo: true,
          },
          { transaction },
        );

        if (fechaSalidaNormalizada) {
          await sincronizarFechaSalidaEnMovimientos({
            usuarioId: usuarioCreado.id,
            fechaAnterior: null,
            fechaNueva: fechaSalidaNormalizada,
            usuarioAgenciaIdPreferido: relacionCreada.id,
            transaction,
          });
        }

        return usuarioCreado;
      },
    );

    if (fechaSalidaNormalizada) {
      await sincronizarFechaSalidaConRveSinBloquear({
        usuario: nuevoUsuario,
        fechaSalida: fechaSalidaNormalizada,
      });
    }

    const { password: _pw, ...usuarioSinPassword } = nuevoUsuario.toJSON();
    return res.status(201).json(usuarioSinPassword);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
      });
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        code: "USUARIO_DUPLICADO",
        message:
          "Ya existe un usuario con la cédula, email o nombre de usuario ingresado.",
      });
    }

    const databaseCode = error.original?.code || error.parent?.code;
    if (databaseCode === "40001") {
      return res.status(409).json({
        code: "CREACION_CONCURRENTE",
        message:
          "Otro proceso modificó los usuarios al mismo tiempo. Verifica la cédula e intenta nuevamente.",
      });
    }

    console.error("Error al crear el usuario:", error);
    return res.status(500).json({ message: "Error al crear el usuario" });
  }
});

router.get("/", async (req, res) => {
  try {
    const includeInactive =
      String(req.query.includeInactive || "").toLowerCase() === "true";

    const usuarios = await Usuario.findAll({
      where: includeInactive ? undefined : { activo: true },
      attributes: { exclude: ["password"] },
      include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
      order: [["nombre", "ASC"]],
    });
    return res.json(usuarios);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener usuarios", error });
  }
});

router.get("/por-cedula/:cedula", async (req, res) => {
  try {
    const cedula = normalizeText(req.params.cedula);

    if (!cedula) {
      return res.status(400).json({
        code: "CEDULA_REQUERIDA",
        message: "La cédula es obligatoria.",
      });
    }

    const usuarios = await Usuario.findAll({
      where: buildCedulaWhere(cedula),
      attributes: { exclude: ["password"] },
      include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
      order: [["id", "ASC"]],
      limit: 2,
    });

    if (usuarios.length > 1) {
      return res.status(409).json({
        code: "CEDULA_DUPLICADA_MULTIPLE",
        message:
          "Existe más de un usuario con esta cédula. Corrige la duplicidad antes de continuar.",
      });
    }

    return res.json({
      ok: true,
      existe: usuarios.length === 1,
      usuario: usuarios[0] || null,
    });
  } catch (error) {
    console.error("Error consultando usuario por cédula:", error);
    return res.status(500).json({
      message: "Error al consultar el usuario por cédula",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
    });
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });
    return res.json(usuario);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener usuario", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });
    const fechaSalidaAnterior = normalizarFechaSalida(usuario.fechaSalida);

    const {
      nombre,
      cedula,
      email,
      usuario: nombreUsuario,
      password,
      rolId,
      activo,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      direccion,
      telefono,
    } = req.body;
    const fechaSalidaNormalizada =
      fechaSalida === undefined
        ? fechaSalidaAnterior
        : normalizarFechaSalida(fechaSalida);

    if (
      fechaSalida !== undefined &&
      fechaSalidaNormalizada &&
      !fechaIsoRegex.test(String(fechaSalidaNormalizada))
    ) {
      return res.status(400).json({
        code: "FECHA_SALIDA_INVALIDA",
        message: "La fecha de salida debe tener formato YYYY-MM-DD.",
      });
    }

    if (email !== undefined) {
      const emailNormalizado = normalizeText(email).toLowerCase();
      if (!emailNormalizado) {
        return res.status(400).json({ message: "El email es obligatorio." });
      }

      const existeEmail = await Usuario.findOne({
        where: {
          [Op.and]: [
            buildEmailWhere(emailNormalizado),
            { id: { [Op.ne]: usuario.id } },
          ],
        },
      });
      if (existeEmail) {
        return res.status(409).json({
          code: "EMAIL_DUPLICADO",
          message: "El email ya está en uso.",
        });
      }
      usuario.email = emailNormalizado;
    }

    if (nombreUsuario !== undefined) {
      const usuarioNormalizado = normalizarUsuario(nombreUsuario);

      if (!esUsuarioValido(usuarioNormalizado)) {
        return res.status(400).json({
          code: "USUARIO_INVALIDO",
          message:
            "El usuario debe tener entre 3 y 50 caracteres y usar solo letras, números, punto, guion o guion bajo.",
        });
      }

      const existeUsuario = await Usuario.findOne({
        where: {
          [Op.and]: [
            buildUsuarioWhere(usuarioNormalizado),
            { id: { [Op.ne]: usuario.id } },
          ],
        },
      });

      if (existeUsuario) {
        return res.status(409).json({
          code: "USUARIO_DUPLICADO",
          message: "El nombre de usuario ya está en uso.",
        });
      }

      usuario.usuario = usuarioNormalizado;
    }

    if (password) {
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          message: "La contraseña debe tener mínimo 6 caracteres e incluir letras y números.",
        });
      }
      usuario.password = await bcrypt.hash(password, 10);
    }

    if (rolId !== undefined) {
      const existeRol = await Rol.findByPk(rolId);
      if (!existeRol) {
        return res.status(400).json({ message: "El rol especificado no existe." });
      }
      usuario.rolId = rolId;
    }
    if (nombre !== undefined) usuario.nombre = normalizeText(nombre);
    if (cedula !== undefined) {
      const cedulaNormalizada = normalizeText(cedula);
      if (!cedulaNormalizada) {
        return res.status(400).json({ message: "La cédula es obligatoria." });
      }

      const existeCedula = await Usuario.findOne({
        where: {
          [Op.and]: [
            buildCedulaWhere(cedulaNormalizada),
            { id: { [Op.ne]: usuario.id } },
          ],
        },
      });
      if (existeCedula) {
        return res.status(409).json({
          code: "CEDULA_DUPLICADA",
          message: "Ya existe otro usuario con esta cédula.",
        });
      }
      usuario.cedula = cedulaNormalizada;
    }
    if (activo !== undefined) usuario.activo = activo;
    if (fechaIngreso !== undefined) usuario.fechaIngreso = fechaIngreso;
    if (fechaSalida !== undefined) usuario.fechaSalida = fechaSalidaNormalizada;
    if (numeroCuenta !== undefined) usuario.numeroCuenta = numeroCuenta;
    if (direccion !== undefined) usuario.direccion = direccion;
    if (telefono !== undefined) usuario.telefono = telefono;

    await sequelize.transaction({}, async (transaction) => {
      await usuario.save({ transaction });

      if (fechaSalida !== undefined) {
        await sincronizarFechaSalidaEnMovimientos({
          usuarioId: usuario.id,
          fechaAnterior: fechaSalidaAnterior,
          fechaNueva: fechaSalidaNormalizada,
          transaction,
        });
      }
    });

    if (activo === false) {
      await UsuarioAgencia.update(
        { activo: false },
        { where: { usuarioId: usuario.id, activo: true } }
      );
    }

    if (fechaSalida !== undefined) {
      await sincronizarFechaSalidaConRveSinBloquear({
        usuario,
        fechaSalida: fechaSalidaNormalizada,
        desactivar: activo === false,
      });
    }

    const { password: _pw, ...usuarioSinPassword } = usuario.toJSON();
    return res.json(usuarioSinPassword);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        code: "USUARIO_DUPLICADO",
        message:
          "Ya existe un usuario con la cédula, email o nombre de usuario ingresado.",
      });
    }

    return res.status(500).json({ message: "Error al actualizar usuario", error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    usuario.activo = false;
    await usuario.save();

    await UsuarioAgencia.update(
      { activo: false },
      { where: { usuarioId: usuario.id, activo: true } }
    );

    return res.json({ message: "Usuario desactivado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar usuario", error });
  }
});

module.exports = router;
