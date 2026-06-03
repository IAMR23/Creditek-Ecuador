const express = require("express");
const { Op } = require("sequelize");

const Agencia = require("../models/Agencia");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Asistencia = require("../models/Asistencia");

const router = express.Router();

const ESTADOS_VALIDOS = new Set([
  "asistencia",
  "falta_justificada",
  "falta_injustificada",
  "atraso",
  "salida",
  "pago",
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

    const usuarioAgenciaIds = usuarioAgencias.map((ua) => ua.id);

    const asistencias = usuarioAgenciaIds.length
      ? await Asistencia.findAll({
          where: {
            usuarioAgenciaId: { [Op.in]: usuarioAgenciaIds },
            fecha: { [Op.gte]: start, [Op.lt]: end },
          },
          attributes: ["usuarioAgenciaId", "fecha", "estado"],
        })
      : [];

    const asistenciasPorUA = new Map();
    for (const a of asistencias) {
      const key = a.usuarioAgenciaId;
      const fecha = a.fecha; // YYYY-MM-DD
      if (!asistenciasPorUA.has(key)) asistenciasPorUA.set(key, {});
      asistenciasPorUA.get(key)[fecha] = a.estado;
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
        asistencias: asistenciasPorUA.get(ua.id) || {},
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
    return res.status(status).json({ message: error.message || "Error al cargar asistencias", error });
  }
});

router.post("/", async (req, res) => {
  try {
    const { agenciaId, usuarioAgenciaId, fecha, estado } = req.body;

    if (!agenciaId || !usuarioAgenciaId || !fecha) {
      return res.status(400).json({ message: "agenciaId, usuarioAgenciaId y fecha son obligatorios." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
      return res.status(400).json({ message: "fecha debe tener formato YYYY-MM-DD." });
    }

    const ua = await UsuarioAgencia.findByPk(usuarioAgenciaId);
    if (!ua || !ua.activo) {
      return res.status(400).json({ message: "La relación usuario-agencia no existe o no está activa." });
    }
    if (String(ua.agenciaId) !== String(agenciaId)) {
      return res.status(400).json({ message: "El usuarioAgenciaId no pertenece a la agenciaId enviada." });
    }

    if (!estado || estado === "libre") {
      await Asistencia.destroy({ where: { usuarioAgenciaId, fecha } });
      return res.json({ ok: true, message: "Asistencia eliminada (libre)." });
    }

    if (!ESTADOS_VALIDOS.has(estado)) {
      return res.status(400).json({ message: "Estado de asistencia inválido." });
    }

    const [record] = await Asistencia.upsert(
      { usuarioAgenciaId, fecha, estado },
      { returning: true }
    );

    return res.status(201).json(record);
  } catch (error) {
    return res.status(500).json({ message: "Error al guardar asistencia", error });
  }
});

module.exports = router;
