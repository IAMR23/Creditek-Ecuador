const express = require("express");
const { Op } = require("sequelize");

const Agencia = require("../models/Agencia");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Asistencia = require("../models/Asistencia");
const { sequelize } = require("../config/db");
const {
  sincronizarSalidaUsuarioRve,
} = require("../services/rveSyncService");

const router = express.Router();

const ESTADOS_VALIDOS = new Set([
  "asistencia",
  "falta_justificada",
  "falta_injustificada",
  "atraso",
  "salida",
  "pago",
  "capacitacion",
]);

const parseMesToRange = (mes) => {
  if (!mes || typeof mes !== "string" || !/^\d{4}-\d{2}$/.test(mes)) {
    const err = new Error("El parámetro mes debe tener formato YYYY-MM.");
    err.statusCode = 400;
    throw err;
  }

  const [yearStr, monthStr] = mes.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const start = `${yearStr}-${monthStr}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, end };
};

const normalizarObservacion = (observacion) => {
  if (typeof observacion !== "string") return null;

  const limpia = observacion.trim();
  return limpia ? limpia : null;
};

const validarFechaISO = (fecha) => /^\d{4}-\d{2}-\d{2}$/.test(String(fecha));

const obtenerUsuarioAgenciaIds = async (usuarioId, transaction = null) => {
  const relaciones = await UsuarioAgencia.findAll({
    where: { usuarioId },
    attributes: ["id"],
    transaction,
  });

  return relaciones.map((relacion) => relacion.id);
};

const obtenerContextoAsistenciaUsuario = async ({
  usuarioId,
  usuarioAgenciaIdActivo,
  fecha,
  transaction = null,
}) => {
  const usuarioAgenciaIds = await obtenerUsuarioAgenciaIds(usuarioId, transaction);
  const existente = await Asistencia.findOne({
    where: {
      usuarioAgenciaId: { [Op.in]: usuarioAgenciaIds },
      fecha,
    },
    order: [
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });

  return {
    existente,
    usuarioAgenciaIds,
    usuarioAgenciaIdParaGuardar:
      existente?.usuarioAgenciaId || usuarioAgenciaIdActivo,
  };
};

const normalizarFechaSalida = (fechaSalida) => fechaSalida || null;

const actualizarFechaSalidaUsuario = async ({
  usuarioId,
  fechaSalida,
  transaction,
  sincronizarAunqueNoCambie = false,
}) => {
  const usuario = await Usuario.findByPk(usuarioId, { transaction });

  if (!usuario) {
    console.error(
      `No se pudo actualizar fechaSalida: no existe el usuario ABS ${usuarioId}.`,
    );
    return null;
  }

  const fechaAnterior = normalizarFechaSalida(usuario.fechaSalida);
  const fechaNueva = normalizarFechaSalida(fechaSalida);
  const cambio = fechaAnterior !== fechaNueva;

  if (cambio) {
    usuario.fechaSalida = fechaNueva;
    await usuario.save({ transaction });
  }

  if (!cambio && !sincronizarAunqueNoCambie) return null;

  return {
    usuarioId: usuario.id,
    cedula: usuario.cedula,
    fechaSalida: fechaNueva,
    desactivar: false,
  };
};

const recalcularFechaSalidaUsuario = async ({
  usuarioId,
  fechasSalidaRemovidas,
  transaction,
}) => {
  const usuarioAgenciaIds = await obtenerUsuarioAgenciaIds(usuarioId, transaction);
  const otraSalida = usuarioAgenciaIds.length
    ? await Asistencia.findOne({
        where: {
          usuarioAgenciaId: { [Op.in]: usuarioAgenciaIds },
          estado: "salida",
        },
        order: [
          ["fecha", "ASC"],
          ["id", "ASC"],
        ],
        transaction,
      })
    : null;

  if (otraSalida) {
    return actualizarFechaSalidaUsuario({
      usuarioId,
      fechaSalida: otraSalida.fecha,
      transaction,
    });
  }

  const usuario = await Usuario.findByPk(usuarioId, { transaction });
  if (!usuario) {
    console.error(
      `No se pudo recalcular fechaSalida: no existe el usuario ABS ${usuarioId}.`,
    );
    return null;
  }

  const fechaActual = normalizarFechaSalida(usuario.fechaSalida);
  if (!fechaActual || !fechasSalidaRemovidas.has(fechaActual)) return null;

  usuario.fechaSalida = null;
  await usuario.save({ transaction });

  return {
    usuarioId: usuario.id,
    cedula: usuario.cedula,
    fechaSalida: null,
    desactivar: false,
  };
};

const sincronizarCambiosConRve = async (cambios) => {
  await Promise.all(
    cambios.filter(Boolean).map(async (cambio) => {
      try {
        await sincronizarSalidaUsuarioRve(cambio);
      } catch (error) {
        console.error(
          `No se pudo sincronizar la salida en RVE para el usuario ABS ${cambio.usuarioId}:`,
          error.message,
        );
      }
    }),
  );
};

const obtenerFechasEnRango = (fechaInicio, fechaFin) => {
  const fechas = [];
  const cursor = new Date(`${fechaInicio}T00:00:00`);
  const limite = new Date(`${fechaFin}T00:00:00`);

  while (cursor <= limite) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    fechas.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return fechas;
};

router.get("/agencias", async (req, res) => {
  try {
    const { mes, agenciaId } = req.query;
    const { start, end } = parseMesToRange(mes);

    const whereAgencia = {};
    if (agenciaId) whereAgencia.id = agenciaId;

    const agencias = await Agencia.findAll({
      where: whereAgencia,
      attributes: ["id", "nombre"],
      include: [
        {
          model: Usuario,
          as: "usuarios",
          through: { where: { activo: true }, attributes: ["id"] },
          attributes: ["id", "nombre"],
          required: false,
        },
      ],
      order: [["nombre", "ASC"]],
    });

    const usuarioAgencias = await UsuarioAgencia.findAll({
      where: { activo: true, ...(agenciaId ? { agenciaId } : {}) },
      include: [
        { model: Usuario, as: "usuario", attributes: ["id", "nombre"] },
        { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
      ],
    });

    const usuarioIds = [...new Set(usuarioAgencias.map((ua) => ua.usuarioId))];
    const todasRelacionesUsuarios = usuarioIds.length
      ? await UsuarioAgencia.findAll({
          where: { usuarioId: { [Op.in]: usuarioIds } },
          attributes: ["id", "usuarioId", "activo", "updatedAt"],
        })
      : [];

    const usuarioAgenciaIds = todasRelacionesUsuarios.map((ua) => ua.id);
    const relacionPorId = new Map(todasRelacionesUsuarios.map((ua) => [ua.id, ua]));

    const asistencias = usuarioAgenciaIds.length
      ? await Asistencia.findAll({
          where: {
            usuarioAgenciaId: { [Op.in]: usuarioAgenciaIds },
            fecha: { [Op.gte]: start, [Op.lt]: end },
          },
          attributes: ["usuarioAgenciaId", "fecha", "estado", "observacion"],
        })
      : [];

    const asistenciasPorUsuario = new Map();
    for (const a of asistencias) {
      const relacion = relacionPorId.get(a.usuarioAgenciaId);
      if (!relacion) continue;

      const key = relacion.usuarioId;
      const fecha = a.fecha;
      if (!asistenciasPorUsuario.has(key)) asistenciasPorUsuario.set(key, {});

      const actuales = asistenciasPorUsuario.get(key);
      const existente = actuales[fecha];
      if (existente && existente.activoOrigen && !relacion.activo) continue;

      actuales[fecha] = {
        estado: a.estado || "libre",
        observacion: a.observacion || "",
        activoOrigen: relacion.activo,
      };
    }

    const usuariosPorAgencia = new Map();
    for (const ua of usuarioAgencias) {
      const aId = ua.agenciaId;
      if (!usuariosPorAgencia.has(aId)) usuariosPorAgencia.set(aId, []);

      usuariosPorAgencia.get(aId).push({
        usuarioAgenciaId: ua.id,
        usuarioId: ua.usuarioId,
        nombre: ua.usuario?.nombre || "",
        apellido: "",
        cargo: "",
        asistencias: asistenciasPorUsuario.get(ua.usuarioId) || {},
      });
    }

    const payload = agencias.map((agencia) => ({
      id: agencia.id,
      nombre: agencia.nombre,
      usuarios: usuariosPorAgencia.get(agencia.id) || [],
    }));

    return res.json(payload);
  } catch (error) {
    const status = error.statusCode || 500;
    return res
      .status(status)
      .json({ message: error.message || "Error al cargar asistencias", error });
  }
});

router.post("/", async (req, res) => {
  try {
    const { agenciaId, usuarioAgenciaId, fecha, estado, observacion } = req.body;
    const observacionNormalizada = normalizarObservacion(observacion);
    const estadoNormalizado = !estado || estado === "libre" ? null : estado;

    if (!agenciaId || !usuarioAgenciaId || !fecha) {
      return res
        .status(400)
        .json({ message: "agenciaId, usuarioAgenciaId y fecha son obligatorios." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
      return res.status(400).json({ message: "fecha debe tener formato YYYY-MM-DD." });
    }

    if (estadoNormalizado && !ESTADOS_VALIDOS.has(estadoNormalizado)) {
      return res.status(400).json({ message: "Estado de asistencia inválido." });
    }

    const ua = await UsuarioAgencia.findByPk(usuarioAgenciaId);
    if (!ua || !ua.activo) {
      return res
        .status(400)
        .json({ message: "La relación usuario-agencia no existe o no está activa." });
    }
    if (String(ua.agenciaId) !== String(agenciaId)) {
      return res
        .status(400)
        .json({ message: "El usuarioAgenciaId no pertenece a la agenciaId enviada." });
    }

    let record = null;
    let asistenciaEliminada = false;
    const cambiosRve = [];

    await sequelize.transaction(async (transaction) => {
      const {
        existente,
        usuarioAgenciaIdParaGuardar,
      } = await obtenerContextoAsistenciaUsuario({
        usuarioId: ua.usuarioId,
        usuarioAgenciaIdActivo: usuarioAgenciaId,
        fecha,
        transaction,
      });
      const eraSalida = existente?.estado === "salida";

      if (!estadoNormalizado && !observacionNormalizada) {
        await Asistencia.destroy({
          where: { usuarioAgenciaId: usuarioAgenciaIdParaGuardar, fecha },
          transaction,
        });
        asistenciaEliminada = true;
      } else {
        [record] = await Asistencia.upsert(
          {
            usuarioAgenciaId: usuarioAgenciaIdParaGuardar,
            fecha,
            estado: estadoNormalizado,
            observacion: observacionNormalizada,
          },
          { returning: true, transaction },
        );
      }

      if (estadoNormalizado === "salida") {
        cambiosRve.push(
          await actualizarFechaSalidaUsuario({
            usuarioId: ua.usuarioId,
            fechaSalida: fecha,
            transaction,
            sincronizarAunqueNoCambie: true,
          }),
        );
      } else if (eraSalida) {
        cambiosRve.push(
          await recalcularFechaSalidaUsuario({
            usuarioId: ua.usuarioId,
            fechasSalidaRemovidas: new Set([fecha]),
            transaction,
          }),
        );
      }
    });

    await sincronizarCambiosConRve(cambiosRve);

    if (asistenciaEliminada) {
      return res.json({ ok: true, message: "Asistencia eliminada." });
    }

    return res.status(201).json(record);
  } catch (error) {
    console.error("Error al guardar asistencia en ABS:", error);
    return res.status(500).json({ message: "Error al guardar asistencia", error });
  }
});

router.post("/masivo", async (req, res) => {
  try {
    const {
      agenciaId,
      usuarioAgenciaIds,
      fechaInicio,
      fechaFin,
      estado,
      observacion,
    } = req.body;

    const observacionNormalizada = normalizarObservacion(observacion);
    const estadoNormalizado = !estado || estado === "libre" ? null : estado;

    if (!agenciaId) {
      return res.status(400).json({ message: "agenciaId es obligatorio." });
    }

    if (!Array.isArray(usuarioAgenciaIds) || usuarioAgenciaIds.length === 0) {
      return res
        .status(400)
        .json({ message: "usuarioAgenciaIds debe contener al menos un usuario." });
    }

    if (!validarFechaISO(fechaInicio) || !validarFechaISO(fechaFin)) {
      return res
        .status(400)
        .json({ message: "fechaInicio y fechaFin deben tener formato YYYY-MM-DD." });
    }

    if (fechaInicio > fechaFin) {
      return res
        .status(400)
        .json({ message: "fechaInicio no puede ser mayor que fechaFin." });
    }

    if (estadoNormalizado && !ESTADOS_VALIDOS.has(estadoNormalizado)) {
      return res.status(400).json({ message: "Estado de asistencia inválido." });
    }

    const usuarioAgencias = await UsuarioAgencia.findAll({
      where: {
        id: { [Op.in]: usuarioAgenciaIds },
        agenciaId,
        activo: true,
      },
      attributes: ["id", "usuarioId"],
    });

    if (usuarioAgencias.length !== usuarioAgenciaIds.length) {
      return res.status(400).json({
        message:
          "Uno o más usuarioAgenciaIds no existen, no pertenecen a la agencia o están inactivos.",
      });
    }

    const fechas = obtenerFechasEnRango(fechaInicio, fechaFin);
    const idsValidos = usuarioAgencias.map((ua) => ua.id);
    const usuarioIds = [...new Set(usuarioAgencias.map((ua) => ua.usuarioId))];
    const cambiosRve = [];
    let asistenciasEliminadas = false;

    await sequelize.transaction(async (transaction) => {
      const relacionesUsuarios = await UsuarioAgencia.findAll({
        where: { usuarioId: { [Op.in]: usuarioIds } },
        attributes: ["id", "usuarioId"],
        transaction,
      });
      const idsTodasRelaciones = relacionesUsuarios.map((ua) => ua.id);
      const usuarioIdPorRelacion = new Map(
        relacionesUsuarios.map((ua) => [ua.id, ua.usuarioId]),
      );
      const salidasRemovidasPorUsuario = new Map();

      if (estadoNormalizado !== "salida" && idsTodasRelaciones.length) {
        const salidasPrevias = await Asistencia.findAll({
          where: {
            usuarioAgenciaId: { [Op.in]: idsTodasRelaciones },
            fecha: { [Op.in]: fechas },
            estado: "salida",
          },
          attributes: ["usuarioAgenciaId", "fecha"],
          transaction,
        });

        for (const salida of salidasPrevias) {
          const usuarioId = usuarioIdPorRelacion.get(salida.usuarioAgenciaId);
          if (!usuarioId) continue;

          if (!salidasRemovidasPorUsuario.has(usuarioId)) {
            salidasRemovidasPorUsuario.set(usuarioId, new Set());
          }
          salidasRemovidasPorUsuario.get(usuarioId).add(salida.fecha);
        }
      }

      if (!estadoNormalizado && !observacionNormalizada) {
        await Asistencia.destroy({
          where: {
            usuarioAgenciaId: { [Op.in]: idsTodasRelaciones },
            fecha: { [Op.in]: fechas },
          },
          transaction,
        });
        asistenciasEliminadas = true;
      } else {
        for (const ua of usuarioAgencias) {
          for (const fecha of fechas) {
            const {
              usuarioAgenciaIdParaGuardar,
            } = await obtenerContextoAsistenciaUsuario({
              usuarioId: ua.usuarioId,
              usuarioAgenciaIdActivo: ua.id,
              fecha,
              transaction,
            });

            await Asistencia.upsert(
              {
                usuarioAgenciaId: usuarioAgenciaIdParaGuardar,
                fecha,
                estado: estadoNormalizado,
                observacion: observacionNormalizada,
              },
              { transaction },
            );
          }
        }
      }

      if (estadoNormalizado === "salida") {
        for (const usuarioId of usuarioIds) {
          cambiosRve.push(
            await actualizarFechaSalidaUsuario({
              usuarioId,
              fechaSalida: fechaInicio,
              transaction,
              sincronizarAunqueNoCambie: true,
            }),
          );
        }
      } else {
        for (const [usuarioId, fechasSalidaRemovidas] of salidasRemovidasPorUsuario) {
          cambiosRve.push(
            await recalcularFechaSalidaUsuario({
              usuarioId,
              fechasSalidaRemovidas,
              transaction,
            }),
          );
        }
      }
    });

    await sincronizarCambiosConRve(cambiosRve);

    if (asistenciasEliminadas) {
      return res.json({
        ok: true,
        message: "Asistencias eliminadas correctamente.",
        totalUsuarios: idsValidos.length,
        totalFechas: fechas.length,
      });
    }

    return res.json({
      ok: true,
      message: "Asistencias masivas registradas correctamente.",
      totalUsuarios: idsValidos.length,
      totalFechas: fechas.length,
    });
  } catch (error) {
    console.error("Error al guardar asistencias masivas en ABS:", error);
    return res
      .status(500)
      .json({ message: "Error al guardar asistencias masivas", error });
  }
});

module.exports = router;
