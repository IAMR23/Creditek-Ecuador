const fs = require("fs/promises");
const path = require("path");
const { Op, QueryTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const SistemaTicket = require("../models/SistemaTicket");
const SistemaTicketComentario = require("../models/SistemaTicketComentario");
const SistemaTicketArchivo = require("../models/SistemaTicketArchivo");
const SistemaTicketHistorial = require("../models/SistemaTicketHistorial");
const Usuario = require("../models/Usuario");
const {
  ESTADOS,
  ESTADOS_KANBAN,
  ESTADOS_TERMINALES,
  PRIORIDADES,
  PROYECTOS,
  TIPOS,
  esFechaISO,
  formatearCodigoTicket,
  puedeVerTicket,
  tienePermisoGestion,
  ticketEstaRetrasado,
  validarTransicion,
} = require("./ticketTiRules");
const { uploadsTicketsDir } = require("../middleware/uploadTicketsTi");

const crearError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const usuarioAttributes = ["id", "nombre", "email"];
const includeUsuariosResumen = [
  { model: Usuario, as: "solicitante", attributes: usuarioAttributes },
  { model: Usuario, as: "responsable", attributes: usuarioAttributes, required: false },
  { model: Usuario, as: "ultimaModificacionUsuario", attributes: usuarioAttributes },
];

const hoyEcuador = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const rangoMesActualEcuador = () => {
  const [year, month] = hoyEcuador().split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    inicio: new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00-05:00`),
    finExclusivo: new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-05:00`,
    ),
  };
};

const parseEnteroPositivo = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const esRetrasado = (ticket) => ticketEstaRetrasado(ticket, hoyEcuador());

const serializarTicket = (ticket) => {
  const item = ticket?.get ? ticket.get({ plain: true }) : ticket;
  if (!item) return null;
  return {
    ...item,
    retrasado: esRetrasado(item),
  };
};

const serializarArchivo = (archivo) => {
  const item = archivo?.get ? archivo.get({ plain: true }) : archivo;
  return {
    id: item.id,
    nombreOriginal: item.nombreOriginal,
    mimeType: item.mimeType,
    tamano: item.tamano,
    esEvidencia: item.esEvidencia,
    createdAt: item.createdAt,
    usuario: item.usuario || null,
  };
};

const whereAlcance = (user) =>
  tienePermisoGestion(user) ? {} : { solicitanteId: Number(user.id) };

const validarOpcion = (value, opciones, campo) => {
  if (!opciones.includes(value)) {
    throw crearError(400, "VALIDACION", `${campo} no es válido`);
  }
};

const construirWhere = (query, user, { soloKanban = false } = {}) => {
  const where = { ...whereAlcance(user) };
  const q = String(query.q || "").trim();

  if (q) {
    where[Op.or] = [
      { codigo: { [Op.iLike]: `%${q}%` } },
      { titulo: { [Op.iLike]: `%${q}%` } },
      { descripcion: { [Op.iLike]: `%${q}%` } },
      { areaSolicitante: { [Op.iLike]: `%${q}%` } },
    ];
  }

  if (query.estado && ESTADOS.includes(query.estado)) where.estado = query.estado;
  if (query.tipo && TIPOS.includes(query.tipo)) where.tipo = query.tipo;
  if (query.proyecto && PROYECTOS.includes(query.proyecto)) where.proyecto = query.proyecto;
  if (query.prioridad && PRIORIDADES.includes(query.prioridad)) where.prioridad = query.prioridad;
  if (query.responsableId && tienePermisoGestion(user)) {
    where.responsableId = Number(query.responsableId);
  }
  if (query.solicitanteId && tienePermisoGestion(user)) {
    where.solicitanteId = Number(query.solicitanteId);
  }

  if (query.fechaDesde || query.fechaHasta) {
    where.createdAt = {};
    if (query.fechaDesde && esFechaISO(query.fechaDesde)) {
      where.createdAt[Op.gte] = new Date(`${query.fechaDesde}T00:00:00-05:00`);
    }
    if (query.fechaHasta && esFechaISO(query.fechaHasta)) {
      where.createdAt[Op.lt] = new Date(`${query.fechaHasta}T23:59:59.999-05:00`);
    }
  }

  if (String(query.retrasado || "").toLowerCase() === "true") {
    where.fechaEstimada = { [Op.lt]: hoyEcuador() };
    where.estado = { [Op.notIn]: ESTADOS_TERMINALES };
  }

  if (soloKanban) where.estado = { [Op.in]: ESTADOS_KANBAN };
  return where;
};

const obtenerTicketAccesible = async (ticketId, user, options = {}) => {
  const ticket = await SistemaTicket.findByPk(ticketId, options);
  if (!ticket) throw crearError(404, "TICKET_NO_ENCONTRADO", "Ticket no encontrado");
  if (!puedeVerTicket(user, ticket)) {
    throw crearError(403, "TICKET_SIN_ACCESO", "No tiene acceso a este ticket");
  }
  return ticket;
};

const borrarArchivosFisicos = async (files = []) => {
  await Promise.all(
    files.map((file) => fs.unlink(file.path).catch(() => {})),
  );
};

const crearRegistrosArchivos = async ({ ticketId, usuarioId, files, transaction }) => {
  if (!files?.length) return [];
  return SistemaTicketArchivo.bulkCreate(
    files.map((file) => ({
      ticketId,
      usuarioId,
      nombreOriginal: file.originalname,
      nombreAlmacenado: file.filename,
      rutaRelativa: path.posix.join("tickets-ti", file.filename),
      mimeType: file.mimetype,
      tamano: file.size,
      esEvidencia: true,
    })),
    { transaction },
  );
};

const validarResponsable = async (responsableId, transaction) => {
  if (responsableId === null || responsableId === "") return null;
  const id = Number(responsableId);
  if (!Number.isInteger(id) || id < 1) {
    throw crearError(400, "RESPONSABLE_INVALIDO", "El responsable no es válido");
  }

  const [responsable] = await sequelize.query(
    `
      SELECT DISTINCT u.id
      FROM usuarios u
      INNER JOIN usuarios_permisos up ON up.usuario_id = u.id AND up.activo = TRUE
      INNER JOIN permisos p ON p.id = up.permiso_id
      WHERE u.id = :id
        AND u.activo = TRUE
        AND LOWER(p.nombre) IN ('sistemas', 'administracion')
        AND (up.fecha_inicio IS NULL OR up.fecha_inicio <= NOW())
        AND (up.fecha_fin IS NULL OR up.fecha_fin >= NOW())
      LIMIT 1
    `,
    { replacements: { id }, type: QueryTypes.SELECT, transaction },
  );

  if (!responsable) {
    throw crearError(
      400,
      "RESPONSABLE_INVALIDO",
      "El responsable debe ser un usuario activo de Sistemas o Administración",
    );
  }
  return id;
};

const validarDatosCreacion = (data) => {
  const titulo = String(data.titulo || "").trim();
  const descripcion = String(data.descripcion || "").trim();
  const areaSolicitante = String(data.areaSolicitante || "").trim();
  if (!titulo || titulo.length > 180) {
    throw crearError(400, "VALIDACION", "El título es obligatorio y admite hasta 180 caracteres");
  }
  if (!descripcion) throw crearError(400, "VALIDACION", "La descripción es obligatoria");
  if (!areaSolicitante || areaSolicitante.length > 100) {
    throw crearError(400, "VALIDACION", "El área solicitante es obligatoria");
  }
  validarOpcion(data.tipo, TIPOS, "El tipo");
  validarOpcion(data.proyecto, PROYECTOS, "El proyecto");
  validarOpcion(data.prioridad || "Media", PRIORIDADES, "La prioridad");
  if (!data.fechaInicio || !esFechaISO(data.fechaInicio)) {
    throw crearError(400, "VALIDACION", "La fecha de inicio de la solicitud es obligatoria");
  }
  if (!data.fechaEstimada || !esFechaISO(data.fechaEstimada)) {
    throw crearError(400, "VALIDACION", "La fecha tentativa de cierre es obligatoria");
  }
  if (data.fechaEstimada < data.fechaInicio) {
    throw crearError(
      400,
      "VALIDACION",
      "La fecha tentativa de cierre no puede ser anterior a la fecha de inicio",
    );
  }
  return {
    titulo,
    descripcion,
    areaSolicitante,
    fechaInicio: data.fechaInicio,
    fechaEstimada: data.fechaEstimada,
  };
};

const listar = async ({ query, user }) => {
  const pagina = parseEnteroPositivo(query.pagina || query.page, 1, 100000);
  const limite = parseEnteroPositivo(query.limite || query.limit, 20, 100);
  const where = construirWhere(query, user);
  const { rows, count } = await SistemaTicket.findAndCountAll({
    where,
    include: includeUsuariosResumen,
    distinct: true,
    limit: limite,
    offset: (pagina - 1) * limite,
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });

  return {
    tickets: rows.map(serializarTicket),
    paginacion: {
      pagina,
      limite,
      total: count,
      totalPaginas: Math.max(1, Math.ceil(count / limite)),
    },
    puedeGestionar: tienePermisoGestion(user),
  };
};

const listarKanban = async ({ query, user }) => {
  const limitePorEstado = parseEnteroPositivo(query.limitePorEstado, 30, 50);
  const whereBase = construirWhere(query, user);
  delete whereBase.estado;

  const resultados = await Promise.all(
    ESTADOS_KANBAN.map((estado) =>
      SistemaTicket.findAll({
        where: { ...whereBase, estado },
        include: includeUsuariosResumen,
        limit: limitePorEstado,
        order: [["prioridad", "DESC"], ["createdAt", "ASC"]],
      }),
    ),
  );

  return {
    columnas: Object.fromEntries(
      ESTADOS_KANBAN.map((estado, index) => [
        estado,
        resultados[index].map(serializarTicket),
      ]),
    ),
    limitePorEstado,
    puedeGestionar: tienePermisoGestion(user),
  };
};

const obtenerDashboard = async ({ user }) => {
  const where = whereAlcance(user);
  const rangoMes = rangoMesActualEcuador();
  const [porEstado, retrasados, total, produccionMesActual] = await Promise.all([
    SistemaTicket.findAll({
      attributes: ["estado", [sequelize.fn("COUNT", sequelize.col("id")), "total"]],
      where,
      group: ["estado"],
      raw: true,
    }),
    SistemaTicket.count({
      where: {
        ...where,
        fechaEstimada: { [Op.lt]: hoyEcuador() },
        estado: { [Op.notIn]: ESTADOS_TERMINALES },
      },
    }),
    SistemaTicket.count({ where }),
    SistemaTicket.count({
      where: {
        ...where,
        estado: "Producción",
        fechaFinalizacion: {
          [Op.gte]: rangoMes.inicio,
          [Op.lt]: rangoMes.finExclusivo,
        },
      },
    }),
  ]);

  const aMapa = (rows, key) =>
    Object.fromEntries(rows.map((row) => [row[key], Number(row.total)]));
  const conteosEstado = aMapa(porEstado, "estado");
  const abiertos = ESTADOS_KANBAN.filter((estado) => estado !== "Producción").reduce(
    (suma, estado) => suma + Number(conteosEstado[estado] || 0),
    0,
  );
  return {
    total,
    abiertos,
    retrasados,
    produccionMesActual,
    porEstado: conteosEstado,
    puedeGestionar: tienePermisoGestion(user),
  };
};

const crear = async ({ data, files, user }) => {
  try {
    const validados = validarDatosCreacion(data);
    return await sequelize.transaction(async (transaction) => {
      const [{ numero }] = await sequelize.query(
        `SELECT nextval('sistemas_tickets_codigo_seq') AS numero`,
        { type: QueryTypes.SELECT, transaction },
      );
      const codigo = formatearCodigoTicket(numero);
      const ticket = await SistemaTicket.create(
        {
          codigo,
          ...validados,
          tipo: data.tipo,
          proyecto: data.proyecto,
          prioridad: data.prioridad || "Media",
          estado: "Solicitado",
          solicitanteId: user.id,
          ultimaModificacionUsuarioId: user.id,
        },
        { transaction },
      );

      await crearRegistrosArchivos({
        ticketId: ticket.id,
        usuarioId: user.id,
        files,
        transaction,
      });
      await SistemaTicketHistorial.create(
        {
          ticketId: ticket.id,
          usuarioId: user.id,
          accion: "CREACION",
          cambios: { estado: { anterior: null, nuevo: "Solicitado" } },
        },
        { transaction },
      );
      return serializarTicket(
        await SistemaTicket.findByPk(ticket.id, {
          include: includeUsuariosResumen,
          transaction,
        }),
      );
    });
  } catch (error) {
    await borrarArchivosFisicos(files);
    throw error;
  }
};

const obtenerDetalle = async ({ ticketId, user }) => {
  const ticket = await obtenerTicketAccesible(ticketId, user, {
    include: [
      ...includeUsuariosResumen,
      {
        model: SistemaTicketComentario,
        as: "comentarios",
        separate: true,
        order: [["createdAt", "ASC"]],
        include: [{ model: Usuario, as: "usuario", attributes: usuarioAttributes }],
      },
      {
        model: SistemaTicketArchivo,
        as: "archivos",
        separate: true,
        order: [["createdAt", "DESC"]],
        include: [{ model: Usuario, as: "usuario", attributes: usuarioAttributes }],
      },
      {
        model: SistemaTicketHistorial,
        as: "historial",
        separate: true,
        order: [["createdAt", "ASC"]],
        include: [{ model: Usuario, as: "usuario", attributes: usuarioAttributes }],
      },
    ],
  });
  const resultado = serializarTicket(ticket);
  resultado.archivos = (resultado.archivos || []).map(serializarArchivo);
  return { ticket: resultado, puedeGestionar: tienePermisoGestion(user) };
};

const actualizar = async ({ ticketId, data, user }) => {
  if (!tienePermisoGestion(user)) {
    throw crearError(403, "GESTION_NO_AUTORIZADA", "No tiene permisos para gestionar tickets");
  }

  await sequelize.transaction(async (transaction) => {
    const ticket = await SistemaTicket.findByPk(ticketId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!ticket) throw crearError(404, "TICKET_NO_ENCONTRADO", "Ticket no encontrado");

    const valores = {};
    const cambios = {};
    const asignar = (campo, nuevo) => {
      const anterior = ticket[campo] ?? null;
      const normalizadoNuevo = nuevo ?? null;
      if (String(anterior ?? "") !== String(normalizadoNuevo ?? "")) {
        valores[campo] = normalizadoNuevo;
        cambios[campo] = { anterior, nuevo: normalizadoNuevo };
      }
    };

    if (data.titulo !== undefined) {
      const titulo = String(data.titulo || "").trim();
      if (!titulo || titulo.length > 180) throw crearError(400, "VALIDACION", "Título no válido");
      asignar("titulo", titulo);
    }
    if (data.descripcion !== undefined) {
      const descripcion = String(data.descripcion || "").trim();
      if (!descripcion) throw crearError(400, "VALIDACION", "La descripción es obligatoria");
      asignar("descripcion", descripcion);
    }
    if (data.areaSolicitante !== undefined) {
      const area = String(data.areaSolicitante || "").trim();
      if (!area || area.length > 100) throw crearError(400, "VALIDACION", "Área no válida");
      asignar("areaSolicitante", area);
    }
    if (data.tipo !== undefined) {
      validarOpcion(data.tipo, TIPOS, "El tipo");
      asignar("tipo", data.tipo);
    }
    if (data.proyecto !== undefined) {
      validarOpcion(data.proyecto, PROYECTOS, "El proyecto");
      asignar("proyecto", data.proyecto);
    }
    if (data.prioridad !== undefined) {
      validarOpcion(data.prioridad, PRIORIDADES, "La prioridad");
      asignar("prioridad", data.prioridad);
    }
    if (data.fechaEstimada !== undefined) {
      const fecha = data.fechaEstimada || null;
      if (!fecha || !esFechaISO(fecha)) {
        throw crearError(400, "VALIDACION", "La fecha tentativa de cierre es obligatoria");
      }
      asignar("fechaEstimada", fecha);
    }
    if (data.fechaInicio !== undefined) {
      const fecha = data.fechaInicio || null;
      if (!fecha || !esFechaISO(fecha)) {
        throw crearError(400, "VALIDACION", "Fecha de inicio no válida");
      }
      asignar("fechaInicio", fecha);
    }
    const fechaInicioFinal = valores.fechaInicio ?? ticket.fechaInicio;
    const fechaEstimadaFinal = valores.fechaEstimada ?? ticket.fechaEstimada;
    if (fechaEstimadaFinal && fechaInicioFinal && fechaEstimadaFinal < fechaInicioFinal) {
      throw crearError(
        400,
        "VALIDACION",
        "La fecha tentativa de cierre no puede ser anterior a la fecha de inicio",
      );
    }
    if (data.responsableId !== undefined) {
      asignar("responsableId", await validarResponsable(data.responsableId, transaction));
    }

    const estadoNuevo = data.estado;
    if (estadoNuevo !== undefined && estadoNuevo !== ticket.estado) {
      const [archivos, comentariosPruebas] = await Promise.all([
        SistemaTicketArchivo.count({ where: { ticketId: ticket.id }, transaction }),
        SistemaTicketComentario.count({
          where: { ticketId: ticket.id, esEvidenciaPruebas: true },
          transaction,
        }),
      ]);
      const errorTransicion = validarTransicion({
        estadoActual: ticket.estado,
        estadoNuevo,
        tieneEvidencia: archivos > 0 || comentariosPruebas > 0,
      });
      if (errorTransicion) throw crearError(409, "TRANSICION_INVALIDA", errorTransicion);

      asignar("estado", estadoNuevo);
      asignar("motivoEstado", null);
      if (estadoNuevo === "Producción") asignar("fechaFinalizacion", new Date());
      if (ticket.estado === "Producción" && estadoNuevo !== "Producción") {
        asignar("fechaFinalizacion", null);
      }
    }

    if (!Object.keys(cambios).length) return;
    valores.ultimaModificacionUsuarioId = user.id;
    valores.version = ticket.version + 1;
    await ticket.update(valores, { transaction });

    const esReapertura =
      cambios.estado?.anterior === "Producción" &&
      cambios.estado?.nuevo !== "Producción";
    await SistemaTicketHistorial.create(
      {
        ticketId: ticket.id,
        usuarioId: user.id,
        accion: esReapertura
          ? "REAPERTURA"
          : cambios.estado
            ? "CAMBIO_ESTADO"
            : "ACTUALIZACION",
        cambios,
      },
      { transaction },
    );
  });

  return obtenerDetalle({ ticketId, user });
};

const agregarComentario = async ({ ticketId, data, user }) => {
  const contenido = String(data.contenido || "").trim();
  if (!contenido || contenido.length > 5000) {
    throw crearError(400, "VALIDACION", "El comentario es obligatorio y admite hasta 5000 caracteres");
  }

  await sequelize.transaction(async (transaction) => {
    const ticket = await obtenerTicketAccesible(ticketId, user, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const comentario = await SistemaTicketComentario.create(
      {
        ticketId: ticket.id,
        usuarioId: user.id,
        contenido,
        esEvidenciaPruebas: Boolean(data.esEvidenciaPruebas),
      },
      { transaction },
    );
    await ticket.update(
      {
        ultimaModificacionUsuarioId: user.id,
        version: ticket.version + 1,
      },
      { transaction },
    );
    await SistemaTicketHistorial.create(
      {
        ticketId: ticket.id,
        usuarioId: user.id,
        accion: "COMENTARIO",
        cambios: {
          comentarioId: comentario.id,
          esEvidenciaPruebas: comentario.esEvidenciaPruebas,
        },
      },
      { transaction },
    );
  });
  return obtenerDetalle({ ticketId, user });
};

const agregarArchivos = async ({ ticketId, files, user }) => {
  if (!files?.length) throw crearError(400, "ARCHIVOS_REQUERIDOS", "Seleccione al menos un archivo");
  try {
    await sequelize.transaction(async (transaction) => {
      const ticket = await obtenerTicketAccesible(ticketId, user, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const archivos = await crearRegistrosArchivos({
        ticketId: ticket.id,
        usuarioId: user.id,
        files,
        transaction,
      });
      await ticket.update(
        { ultimaModificacionUsuarioId: user.id, version: ticket.version + 1 },
        { transaction },
      );
      await SistemaTicketHistorial.create(
        {
          ticketId: ticket.id,
          usuarioId: user.id,
          accion: "ARCHIVOS_ADJUNTADOS",
          cambios: {
            archivos: archivos.map((archivo) => ({
              id: archivo.id,
              nombre: archivo.nombreOriginal,
            })),
          },
        },
        { transaction },
      );
    });
  } catch (error) {
    await borrarArchivosFisicos(files);
    throw error;
  }
  return obtenerDetalle({ ticketId, user });
};

const obtenerArchivoDescarga = async ({ ticketId, archivoId, user }) => {
  await obtenerTicketAccesible(ticketId, user);
  const archivo = await SistemaTicketArchivo.findOne({
    where: { id: archivoId, ticketId },
  });
  if (!archivo) throw crearError(404, "ARCHIVO_NO_ENCONTRADO", "Archivo no encontrado");

  const ruta = path.resolve(uploadsTicketsDir, archivo.nombreAlmacenado);
  const prefijoSeguro = `${uploadsTicketsDir}${path.sep}`;
  if (!ruta.startsWith(prefijoSeguro)) {
    throw crearError(400, "RUTA_ARCHIVO_INVALIDA", "Ruta de archivo no válida");
  }
  await fs.access(ruta).catch(() => {
    throw crearError(404, "ARCHIVO_NO_DISPONIBLE", "El archivo ya no está disponible");
  });
  return { ruta, nombre: archivo.nombreOriginal, mimeType: archivo.mimeType };
};

const listarResponsables = async ({ user }) => {
  if (!tienePermisoGestion(user)) {
    throw crearError(403, "GESTION_NO_AUTORIZADA", "No tiene permisos para consultar responsables");
  }
  return sequelize.query(
    `
      SELECT DISTINCT u.id, u.nombre, u.email
      FROM usuarios u
      INNER JOIN usuarios_permisos up ON up.usuario_id = u.id AND up.activo = TRUE
      INNER JOIN permisos p ON p.id = up.permiso_id
      WHERE u.activo = TRUE
        AND LOWER(p.nombre) IN ('sistemas', 'administracion')
        AND (up.fecha_inicio IS NULL OR up.fecha_inicio <= NOW())
        AND (up.fecha_fin IS NULL OR up.fecha_fin >= NOW())
      ORDER BY u.nombre ASC
    `,
    { type: QueryTypes.SELECT },
  );
};

module.exports = {
  actualizar,
  agregarArchivos,
  agregarComentario,
  crear,
  crearError,
  listar,
  listarKanban,
  listarResponsables,
  obtenerArchivoDescarga,
  obtenerDashboard,
  obtenerDetalle,
};
