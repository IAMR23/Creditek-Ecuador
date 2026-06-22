const SistemaTarea = require("../../models/SistemaTarea");
const Usuario = require("../../models/Usuario");
const { Op } = require("sequelize");

const ESTADOS = {
  pendiente: "pendiente",
  en_progreso: "en_progreso",
  finalizado: "finalizado",
  completada: "finalizado",
};

const ESTADO_LABELS = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  finalizado: "Finalizado",
};

const getUsuarioId = (req) => req.user?.id;

const normalizarEstado = (estado) => {
  const value = String(estado || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return ESTADOS[value] || null;
};

const segundosDesde = (date, now = new Date()) => {
  if (!date) return 0;
  const inicio = new Date(date);
  const diff = Math.floor((now.getTime() - inicio.getTime()) / 1000);
  return Math.max(0, diff);
};

const tiempoActual = (tarea, now = new Date()) => {
  const acumulado = Number(tarea.tiempoAcumuladoSegundos) || 0;
  if (!tarea.cronometroActivo) return acumulado;
  return acumulado + segundosDesde(tarea.ultimoInicioCronometro, now);
};

const serializarTarea = (tarea) => {
  const plain = tarea.get ? tarea.get({ plain: true }) : tarea;

  return {
    id: plain.id,
    titulo: plain.titulo,
    descripcion: plain.descripcion || "",
    fechaInicio: plain.fechaInicio,
    estado: ESTADO_LABELS[plain.estado] || plain.estado,
    status: plain.estado,
    tiempoAcumuladoSegundos: Number(plain.tiempoAcumuladoSegundos) || 0,
    tiempoActualSegundos: tiempoActual(plain),
    cronometroActivo: Boolean(plain.cronometroActivo),
    ultimoInicioCronometro: plain.ultimoInicioCronometro,
    finalizadoEn: plain.finalizadoEn,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    creadoPor: plain.creadoPor || null,
  };
};

const includeUsuarios = [
  {
    model: Usuario,
    as: "creadoPor",
    attributes: ["id", "nombre", "email"],
  },
];

const findTarea = async (id) =>
  SistemaTarea.findByPk(id, {
    include: includeUsuarios,
  });

exports.listarTareas = async (req, res) => {
  try {
    const tareas = await SistemaTarea.findAll({
      include: includeUsuarios,
      order: [
        ["estado", "ASC"],
        ["fechaInicio", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    return res.json({
      ok: true,
      tareas: tareas.map(serializarTarea),
    });
  } catch (error) {
    console.error("Error listando tareas de sistemas:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron obtener las tareas",
    });
  }
};

const formatearFechaLocal = (date) => {
  const fecha = new Date(date);
  if (Number.isNaN(fecha.getTime())) return null;

  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const crearFechaLocal = (fecha) => {
  const [year, month, day] = String(fecha || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const listarRangoFechas = (fechaInicio, fechaFin) => {
  const inicio = crearFechaLocal(fechaInicio);
  const fin = crearFechaLocal(fechaFin);

  if (!inicio || !fin || inicio > fin) return [];

  const fechas = [];
  const cursor = new Date(inicio);

  while (cursor <= fin) {
    fechas.push(formatearFechaLocal(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return fechas;
};

exports.obtenerTareasFinalizadasPorFecha = async ({ fechaInicio, fechaFin }) => {
  const where = {
    estado: "finalizado",
    finalizadoEn: { [Op.ne]: null },
  };

  if (fechaInicio && fechaFin) {
    where.finalizadoEn = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    where.finalizadoEn = { [Op.gte]: new Date(`${fechaInicio}T00:00:00`) };
  } else if (fechaFin) {
    where.finalizadoEn = { [Op.lte]: new Date(`${fechaFin}T23:59:59`) };
  }

  const tareas = await SistemaTarea.findAll({
    where,
    attributes: ["id", "finalizadoEn"],
    order: [["finalizadoEn", "ASC"]],
  });

  const conteo = tareas.reduce((acc, tarea) => {
    const fecha = formatearFechaLocal(tarea.finalizadoEn);
    if (!fecha) return acc;
    acc[fecha] = (acc[fecha] || 0) + 1;
    return acc;
  }, {});

  const fechas = fechaInicio && fechaFin ? listarRangoFechas(fechaInicio, fechaFin) : Object.keys(conteo);

  return fechas.map((fecha) => ({
    fecha,
    tareasFinalizadas: conteo[fecha] || 0,
  }));
};

exports.crearTarea = async (req, res) => {
  try {
    const usuarioId = getUsuarioId(req);
    const titulo = String(req.body.titulo || "").trim();
    const descripcion = req.body.descripcion ?? "";
    const fechaInicio = req.body.fechaInicio;

    if (!usuarioId) {
      return res.status(400).json({ ok: false, message: "Usuario no identificado" });
    }

    if (!titulo) {
      return res.status(400).json({ ok: false, message: "El titulo es obligatorio" });
    }

    if (!fechaInicio) {
      return res.status(400).json({ ok: false, message: "La fecha de inicio es obligatoria" });
    }

    const tarea = await SistemaTarea.create({
      titulo,
      descripcion,
      fechaInicio,
      estado: "pendiente",
      creadoPorId: usuarioId,
      tiempoAcumuladoSegundos: 0,
      cronometroActivo: false,
      ultimoInicioCronometro: null,
    });

    const tareaCompleta = await findTarea(tarea.id);

    return res.status(201).json({
      ok: true,
      tarea: serializarTarea(tareaCompleta),
    });
  } catch (error) {
    console.error("Error creando tarea de sistemas:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo crear la tarea",
    });
  }
};

exports.actualizarTarea = async (req, res) => {
  try {
    const tarea = await findTarea(req.params.id);

    if (!tarea) {
      return res.status(404).json({ ok: false, message: "Tarea no encontrada" });
    }

    const titulo = req.body.titulo;
    const descripcion = req.body.descripcion;
    const fechaInicio = req.body.fechaInicio;

    if (titulo !== undefined && !String(titulo).trim()) {
      return res.status(400).json({ ok: false, message: "El titulo es obligatorio" });
    }

    await tarea.update({
      ...(titulo !== undefined && { titulo: String(titulo).trim() }),
      ...(descripcion !== undefined && { descripcion }),
      ...(fechaInicio !== undefined && { fechaInicio }),
    });

    const tareaActualizada = await findTarea(tarea.id);

    return res.json({
      ok: true,
      tarea: serializarTarea(tareaActualizada),
    });
  } catch (error) {
    console.error("Error actualizando tarea de sistemas:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo actualizar la tarea",
    });
  }
};

exports.eliminarTarea = async (req, res) => {
  try {
    const tarea = await findTarea(req.params.id);

    if (!tarea) {
      return res.status(404).json({ ok: false, message: "Tarea no encontrada" });
    }

    await tarea.destroy();

    return res.json({
      ok: true,
      message: "Tarea eliminada correctamente",
    });
  } catch (error) {
    console.error("Error eliminando tarea de sistemas:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo eliminar la tarea",
    });
  }
};

const iniciarCronometro = async (req, res) => {
  try {
    const tarea = await findTarea(req.params.id);

    if (!tarea) {
      return res.status(404).json({ ok: false, message: "Tarea no encontrada" });
    }

    if (tarea.estado === "finalizado") {
      return res.status(400).json({
        ok: false,
        message: "No se puede iniciar una tarea finalizada",
      });
    }

    if (tarea.cronometroActivo) {
      return res.status(400).json({
        ok: false,
        message: "El cronometro ya esta activo",
      });
    }

    await tarea.update({
      estado: "en_progreso",
      cronometroActivo: true,
      ultimoInicioCronometro: new Date(),
    });

    const tareaActualizada = await findTarea(tarea.id);

    return res.json({
      ok: true,
      tarea: serializarTarea(tareaActualizada),
    });
  } catch (error) {
    console.error("Error iniciando cronometro:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo iniciar el cronometro",
    });
  }
};

exports.iniciarTarea = iniciarCronometro;
exports.continuarTarea = iniciarCronometro;

exports.pausarTarea = async (req, res) => {
  try {
    const tarea = await findTarea(req.params.id);

    if (!tarea) {
      return res.status(404).json({ ok: false, message: "Tarea no encontrada" });
    }

    if (!tarea.cronometroActivo) {
      return res.status(400).json({
        ok: false,
        message: "El cronometro no esta activo",
      });
    }

    await tarea.update({
      tiempoAcumuladoSegundos: tiempoActual(tarea),
      cronometroActivo: false,
      ultimoInicioCronometro: null,
    });

    const tareaActualizada = await findTarea(tarea.id);

    return res.json({
      ok: true,
      tarea: serializarTarea(tareaActualizada),
    });
  } catch (error) {
    console.error("Error pausando cronometro:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo pausar el cronometro",
    });
  }
};

exports.finalizarTarea = async (req, res) => {
  try {
    const tarea = await findTarea(req.params.id);

    if (!tarea) {
      return res.status(404).json({ ok: false, message: "Tarea no encontrada" });
    }

    await tarea.update({
      estado: "finalizado",
      tiempoAcumuladoSegundos: tiempoActual(tarea),
      cronometroActivo: false,
      ultimoInicioCronometro: null,
      finalizadoEn: tarea.finalizadoEn || new Date(),
    });

    const tareaActualizada = await findTarea(tarea.id);

    return res.json({
      ok: true,
      tarea: serializarTarea(tareaActualizada),
    });
  } catch (error) {
    console.error("Error finalizando tarea:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo finalizar la tarea",
    });
  }
};

exports.cambiarEstado = async (req, res) => {
  try {
    const estado = normalizarEstado(req.body.estado || req.body.status);

    if (!estado) {
      return res.status(400).json({ ok: false, message: "Estado no valido" });
    }

    if (estado === "finalizado") {
      return exports.finalizarTarea(req, res);
    }

    if (estado === "en_progreso") {
      return iniciarCronometro(req, res);
    }

    const tarea = await findTarea(req.params.id);

    if (!tarea) {
      return res.status(404).json({ ok: false, message: "Tarea no encontrada" });
    }

    if (tarea.estado === "finalizado") {
      return res.status(400).json({
        ok: false,
        message: "No se puede reabrir una tarea finalizada",
      });
    }

    await tarea.update({
      estado: "pendiente",
      tiempoAcumuladoSegundos: tiempoActual(tarea),
      cronometroActivo: false,
      ultimoInicioCronometro: null,
    });

    const tareaActualizada = await findTarea(tarea.id);

    return res.json({
      ok: true,
      tarea: serializarTarea(tareaActualizada),
    });
  } catch (error) {
    console.error("Error cambiando estado:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo cambiar el estado",
    });
  }
};
