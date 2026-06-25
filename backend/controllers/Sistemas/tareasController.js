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
    fechaFin: plain.fechaFin,
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

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const buildWhereListadoTareas = ({ estado, fechaInicio, fechaFin }) => {
  const where = {};
  const estadoNormalizado = normalizarEstado(estado);

  if (estadoNormalizado) {
    where.estado = estadoNormalizado;
  }

  if (fechaInicio && fechaFin) {
    where.fechaInicio = { [Op.between]: [fechaInicio, fechaFin] };
  } else if (fechaInicio) {
    where.fechaInicio = { [Op.gte]: fechaInicio };
  } else if (fechaFin) {
    where.fechaInicio = { [Op.lte]: fechaFin };
  }

  return where;
};

const obtenerResumenTareas = async (where) => {
  const whereBase = { ...where };
  delete whereBase.estado;

  const [total, pendientes, enProgreso, finalizadas] = await Promise.all([
    SistemaTarea.count({ where: whereBase }),
    SistemaTarea.count({ where: { ...whereBase, estado: "pendiente" } }),
    SistemaTarea.count({ where: { ...whereBase, estado: "en_progreso" } }),
    SistemaTarea.count({ where: { ...whereBase, estado: "finalizado" } }),
  ]);

  return {
    total,
    pendientes,
    enProgreso,
    finalizadas,
  };
};

exports.listarTareas = async (req, res) => {
  try {
    const pagina = parsePositiveInt(req.query.page || req.query.pagina, 1);
    const limite = parsePositiveInt(req.query.limit || req.query.limite, 10, 100);
    const offset = (pagina - 1) * limite;
    const where = buildWhereListadoTareas(req.query);

    const [{ rows: tareas, count }, resumen] = await Promise.all([
      SistemaTarea.findAndCountAll({
        where,
        include: includeUsuarios,
        limit: limite,
        offset,
        distinct: true,
        order: [
          ["estado", "ASC"],
          ["fechaInicio", "DESC"],
          ["createdAt", "DESC"],
        ],
      }),
      obtenerResumenTareas(where),
    ]);

    const totalPaginas = Math.max(1, Math.ceil(count / limite));

    return res.json({
      ok: true,
      tareas: tareas.map(serializarTarea),
      resumen,
      paginacion: {
        pagina,
        limite,
        total: count,
        totalPaginas,
      },
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
  if (fecha instanceof Date) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  }

  const soloFecha = String(fecha || "").split("T")[0];
  const [year, month, day] = soloFecha.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const getInicioSemanaJueves = (fechaInput) => {
  const fecha =
    crearFechaLocal(fechaInput) || new Date(new Date().getFullYear(), 0, 1);
  const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

  while (inicio.getDay() !== 4) {
    inicio.setDate(inicio.getDate() - 1);
  }

  return inicio;
};

const sumarDias = (fecha, dias) => {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
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

const listarRangoSemanas = (fechaInicio, fechaFin) => {
  const fin = crearFechaLocal(fechaFin);

  if (!fechaInicio || !fin) return [];

  const inicio = getInicioSemanaJueves(fechaInicio);

  if (inicio > fin) return [];

  const semanas = [];
  const cursor = new Date(inicio);
  let semanaNumero = 1;

  while (cursor <= fin) {
    const inicioSemana = new Date(cursor);
    const finSemana = sumarDias(inicioSemana, 6);

    semanas.push({
      semana: `Semana ${semanaNumero}`,
      semanaNumero,
      fechaInicio: formatearFechaLocal(inicioSemana),
      fechaFin: formatearFechaLocal(finSemana),
    });

    cursor.setDate(cursor.getDate() + 7);
    semanaNumero += 1;
  }

  return semanas;
};

const getSemanaComercial = (fechaInput, fechaInicio) => {
  const fecha = crearFechaLocal(formatearFechaLocal(fechaInput));
  if (!fecha) return null;

  const inicioSemanas = getInicioSemanaJueves(fechaInicio || fecha);
  const msPorDia = 24 * 60 * 60 * 1000;
  const diferenciaDias = Math.floor((fecha - inicioSemanas) / msPorDia);

  if (diferenciaDias < 0) return null;

  return Math.floor(diferenciaDias / 7) + 1;
};

const buildWhereTareasFinalizadas = ({ fechaInicio, fechaFin }) => {
  const where = {
    estado: "finalizado",
    fechaFin: { [Op.ne]: null },
  };

  if (fechaInicio && fechaFin) {
    where.fechaFin = { [Op.between]: [fechaInicio, fechaFin] };
  } else if (fechaInicio) {
    where.fechaFin = { [Op.gte]: fechaInicio };
  } else if (fechaFin) {
    where.fechaFin = { [Op.lte]: fechaFin };
  }

  return where;
};

exports.obtenerTareasFinalizadasPorFecha = async ({ fechaInicio, fechaFin }) => {
  const where = buildWhereTareasFinalizadas({ fechaInicio, fechaFin });

  const tareas = await SistemaTarea.findAll({
    where,
    attributes: ["id", "fechaFin"],
    order: [["fechaFin", "ASC"]],
  });

  const conteo = tareas.reduce((acc, tarea) => {
    const fecha = tarea.fechaFin;
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

exports.obtenerTareasFinalizadasPorSemana = async ({ fechaInicio, fechaFin }) => {
  const where = buildWhereTareasFinalizadas({ fechaInicio, fechaFin });

  const tareas = await SistemaTarea.findAll({
    where,
    attributes: ["id", "fechaFin"],
    order: [["fechaFin", "ASC"]],
  });

  const conteo = tareas.reduce((acc, tarea) => {
    const semanaNumero = getSemanaComercial(
      tarea.fechaFin,
      fechaInicio || tarea.fechaFin,
    );

    if (!semanaNumero) return acc;

    const key = `Semana ${semanaNumero}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const semanas =
    fechaInicio && fechaFin
      ? listarRangoSemanas(fechaInicio, fechaFin)
      : Object.keys(conteo)
          .map((semana) => {
            const semanaNumero = Number(String(semana).replace(/\D/g, ""));
            const inicioSemana = getInicioSemanaJueves(fechaInicio || new Date());
            inicioSemana.setDate(inicioSemana.getDate() + (semanaNumero - 1) * 7);

            return {
              semana,
              semanaNumero,
              fechaInicio: formatearFechaLocal(inicioSemana),
              fechaFin: formatearFechaLocal(sumarDias(inicioSemana, 6)),
            };
          })
          .sort((a, b) => a.semanaNumero - b.semanaNumero);

  return semanas.map((semana) => ({
    ...semana,
    tareasFinalizadas: conteo[semana.semana] || 0,
  }));
};

exports.crearTarea = async (req, res) => {
  try {
    const usuarioId = getUsuarioId(req);
    const titulo = String(req.body.titulo || "").trim();
    const descripcion = req.body.descripcion ?? "";
    const fechaInicio = req.body.fechaInicio;
    const fechaFin = req.body.fechaFin || null;

    if (!usuarioId) {
      return res.status(400).json({ ok: false, message: "Usuario no identificado" });
    }

    if (!titulo) {
      return res.status(400).json({ ok: false, message: "El titulo es obligatorio" });
    }

    if (!fechaInicio) {
      return res.status(400).json({ ok: false, message: "La fecha de inicio es obligatoria" });
    }

    if (fechaFin && fechaFin < fechaInicio) {
      return res.status(400).json({ ok: false, message: "La fecha fin no puede ser menor que la fecha de inicio" });
    }

    const tarea = await SistemaTarea.create({
      titulo,
      descripcion,
      fechaInicio,
      fechaFin,
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
    const fechaFin = req.body.fechaFin;

    if (titulo !== undefined && !String(titulo).trim()) {
      return res.status(400).json({ ok: false, message: "El titulo es obligatorio" });
    }

    const fechaInicioValidacion = fechaInicio !== undefined ? fechaInicio : tarea.fechaInicio;
    const fechaFinValidacion = fechaFin !== undefined ? fechaFin || null : tarea.fechaFin;

    if (fechaFinValidacion && fechaInicioValidacion && fechaFinValidacion < fechaInicioValidacion) {
      return res.status(400).json({ ok: false, message: "La fecha fin no puede ser menor que la fecha de inicio" });
    }

    await tarea.update({
      ...(titulo !== undefined && { titulo: String(titulo).trim() }),
      ...(descripcion !== undefined && { descripcion }),
      ...(fechaInicio !== undefined && { fechaInicio }),
      ...(fechaFin !== undefined && { fechaFin: fechaFin || null }),
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
      fechaFin: tarea.fechaFin || formatearFechaLocal(new Date()),
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
