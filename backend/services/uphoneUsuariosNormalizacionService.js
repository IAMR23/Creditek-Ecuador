const { QueryTypes, col, fn, where: sequelizeWhere } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");

const normalizarClave = (valor) => String(valor || "").trim().toUpperCase();

const crearError = (mensaje, statusCode = 400, code = "VALIDATION_ERROR") => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const condicionClaveUphone = (clave) =>
  sequelizeWhere(
    fn("LOWER", fn("BTRIM", col("usuarioUphone"))),
    clave.toLowerCase(),
  );

const listarNormalizaciones = async () => {
  const normalizaciones = await sequelize.query(
    `
      WITH claves_reporte AS (
        SELECT
          UPPER(BTRIM(usuario)) AS clave,
          (
            ARRAY_AGG(
              NULLIF(BTRIM(vendedor), '')
              ORDER BY "fechaSolicitud" DESC NULLS LAST, id DESC
            ) FILTER (WHERE NULLIF(BTRIM(vendedor), '') IS NOT NULL)
          )[1] AS "nombreReportado",
          COUNT(*)::int AS solicitudes,
          MAX("fechaSolicitud") AS "ultimaSolicitud"
        FROM uphone_solicitudes
        WHERE NULLIF(BTRIM(usuario), '') IS NOT NULL
        GROUP BY UPPER(BTRIM(usuario))
      ),
      claves AS (
        SELECT clave FROM claves_reporte
        UNION
        SELECT UPPER(BTRIM("usuarioUphone"))
        FROM usuarios
        WHERE NULLIF(BTRIM("usuarioUphone"), '') IS NOT NULL
      )
      SELECT
        claves.clave AS "usuarioUphone",
        reporte."nombreReportado",
        COALESCE(reporte.solicitudes, 0)::int AS solicitudes,
        reporte."ultimaSolicitud",
        usuario.id AS "usuarioId",
        usuario.nombre AS "usuarioNombre",
        usuario.email AS "usuarioEmail",
        usuario.activo AS "usuarioActivo"
      FROM claves
      LEFT JOIN claves_reporte AS reporte ON reporte.clave = claves.clave
      LEFT JOIN usuarios AS usuario
        ON LOWER(BTRIM(usuario."usuarioUphone")) = LOWER(claves.clave)
      ORDER BY claves.clave ASC
    `,
    { type: QueryTypes.SELECT },
  );

  const usuarios = await Usuario.findAll({
    attributes: ["id", "nombre", "email", "activo", "usuarioUphone"],
    order: [
      ["activo", "DESC"],
      ["nombre", "ASC"],
    ],
    raw: true,
  });

  return {
    normalizaciones: normalizaciones.map((fila) => ({
      usuarioUphone: fila.usuarioUphone,
      nombreReportado: fila.nombreReportado || null,
      solicitudes: Number(fila.solicitudes || 0),
      ultimaSolicitud: fila.ultimaSolicitud || null,
      usuarioRve: fila.usuarioId
        ? {
            id: Number(fila.usuarioId),
            nombre: fila.usuarioNombre,
            email: fila.usuarioEmail,
            activo: Boolean(fila.usuarioActivo),
          }
        : null,
    })),
    usuarios: usuarios.map((usuario) => ({
      ...usuario,
      id: Number(usuario.id),
      usuarioUphone: usuario.usuarioUphone
        ? normalizarClave(usuario.usuarioUphone)
        : null,
    })),
  };
};

const asignarUsuarioUphone = async ({ usuarioUphone, usuarioId }) => {
  const clave = normalizarClave(usuarioUphone);
  if (!clave) {
    throw crearError("La clave de Uphone es obligatoria.");
  }
  if (clave.length > 100) {
    throw crearError("La clave de Uphone no puede superar 100 caracteres.");
  }

  const sinAsignar = usuarioId === null || usuarioId === undefined || usuarioId === "";
  const idDestino = sinAsignar ? null : Number(usuarioId);
  if (!sinAsignar && (!Number.isInteger(idDestino) || idDestino <= 0)) {
    throw crearError("El usuario seleccionado no es válido.");
  }

  return sequelize.transaction(async (transaction) => {
    const propietarioActual = await Usuario.findOne({
      where: condicionClaveUphone(clave),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (sinAsignar) {
      if (propietarioActual) {
        await propietarioActual.update({ usuarioUphone: null }, { transaction });
      }

      return {
        usuarioUphone: clave,
        usuarioRve: null,
        reemplazo: propietarioActual
          ? {
              id: Number(propietarioActual.id),
              nombre: propietarioActual.nombre,
            }
          : null,
      };
    }

    const usuarioDestino = await Usuario.findByPk(idDestino, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!usuarioDestino) {
      throw crearError("El usuario de RVE no existe.", 404, "USER_NOT_FOUND");
    }

    const claveAnterior = usuarioDestino.usuarioUphone
      ? normalizarClave(usuarioDestino.usuarioUphone)
      : null;

    if (propietarioActual && Number(propietarioActual.id) !== idDestino) {
      await propietarioActual.update({ usuarioUphone: null }, { transaction });
    }

    usuarioDestino.usuarioUphone = clave;
    await usuarioDestino.save({ transaction });

    return {
      usuarioUphone: clave,
      usuarioRve: {
        id: Number(usuarioDestino.id),
        nombre: usuarioDestino.nombre,
        email: usuarioDestino.email,
        activo: Boolean(usuarioDestino.activo),
      },
      claveAnterior,
      reemplazo:
        propietarioActual && Number(propietarioActual.id) !== idDestino
          ? {
              id: Number(propietarioActual.id),
              nombre: propietarioActual.nombre,
            }
          : null,
    };
  });
};

module.exports = {
  asignarUsuarioUphone,
  listarNormalizaciones,
  normalizarClave,
};
