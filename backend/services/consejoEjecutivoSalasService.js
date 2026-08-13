const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const ConsejoEjecutivoSala = require("../models/ConsejoEjecutivoSala");
const ConsejoEjecutivoSalaParticipante = require("../models/ConsejoEjecutivoSalaParticipante");
const ConsejoEjecutivoPlan = require("../models/ConsejoEjecutivoPlan");
const Usuario = require("../models/Usuario");
const {
  consultarUsuariosAdmin,
} = require("./consejoEjecutivoUsuariosService");

const MAX_PARTICIPANTES = 50;

const crearError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const includeSala = ({ incluirPlanes = false } = {}) => [
  {
    model: Usuario,
    as: "creadoPor",
    attributes: ["id", "nombre", "email"],
  },
  {
    model: Usuario,
    as: "participantes",
    attributes: ["id", "nombre", "email"],
    where: { activo: true },
    through: {
      attributes: ["createdAt"],
      where: { activo: true },
    },
    required: false,
  },
  ...(incluirPlanes
    ? [
        {
          model: ConsejoEjecutivoPlan,
          as: "planes",
          attributes: ["id"],
          required: false,
        },
      ]
    : []),
];

const normalizarSalaId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw crearError("El identificador de la sala no es valido");
  }
  return id;
};

const normalizarDatosSala = (data = {}) => {
  const nombre = String(data.nombre || "").trim();
  const descripcion = String(data.descripcion || "").trim();

  if (!nombre) throw crearError("El nombre de la sala es obligatorio");
  if (nombre.length > 120) throw crearError("El nombre de la sala es demasiado extenso");
  if (descripcion.length > 5000) {
    throw crearError("La descripcion de la sala es demasiado extensa");
  }

  return { nombre, descripcion };
};

const validarParticipantesAdmin = async (participanteIds) => {
  if (!Array.isArray(participanteIds)) {
    throw crearError("Debes seleccionar los participantes de la sala");
  }

  const ids = [
    ...new Set(
      participanteIds
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];

  if (!ids.length) {
    throw crearError("Invita al menos a un participante con rol Admin");
  }
  if (ids.length > MAX_PARTICIPANTES) {
    throw crearError("La sala supera el limite de participantes permitido");
  }

  const administradores = await consultarUsuariosAdmin({ ids });
  if (administradores.length !== ids.length) {
    throw crearError(
      "Todos los participantes deben ser usuarios activos con rol Admin o Administrador",
    );
  }

  return { ids, administradores };
};

const serializarSalas = async (salas, user) => {
  const items = salas.map((sala) =>
    sala?.get ? sala.get({ plain: true }) : sala,
  );
  const idsParticipantes = [
    ...new Set(
      items.flatMap((sala) =>
        (sala.participantes || []).map((participante) => Number(participante.id)),
      ),
    ),
  ];
  const administradores = idsParticipantes.length
    ? await consultarUsuariosAdmin({ ids: idsParticipantes })
    : [];
  const adminsPorId = new Map(
    administradores.map((admin) => [Number(admin.id), admin]),
  );

  return items.map((sala) => {
    const participantes = (sala.participantes || [])
      .map((participante) => adminsPorId.get(Number(participante.id)))
      .filter(Boolean);
    const creadoPorId = Number(sala.creadoPorId || sala.creadoPor?.id);

    return {
      id: sala.id,
      nombre: sala.nombre,
      descripcion: sala.descripcion || "",
      creadoPorId: creadoPorId || null,
      creadoPor: sala.creadoPor || null,
      participantes,
      totalPlanes: Array.isArray(sala.planes) ? sala.planes.length : undefined,
      puedeAdministrar: Number(user?.id) === creadoPorId,
      createdAt: sala.createdAt,
      updatedAt: sala.updatedAt,
    };
  });
};

const obtenerSalaModelo = async (id, { incluirPlanes = false } = {}) => {
  const sala = await ConsejoEjecutivoSala.findOne({
    where: { id: normalizarSalaId(id), activo: true },
    include: includeSala({ incluirPlanes }),
  });
  if (!sala) throw crearError("Sala no encontrada", 404);
  return sala;
};

const obtenerSalaAutorizada = async (id, user, options = {}) => {
  if (!user?.id) throw crearError("Usuario autenticado no valido", 401);
  const salaModelo = await obtenerSalaModelo(id, options);
  const [sala] = await serializarSalas([salaModelo], user);
  const esCreador = Number(sala.creadoPorId) === Number(user.id);
  const esParticipante = sala.participantes.some(
    (participante) => Number(participante.id) === Number(user.id),
  );

  if (!esCreador && !esParticipante) {
    throw crearError("No has sido invitado a esta sala", 403);
  }

  return sala;
};

const listarSalas = async ({ user }) => {
  if (!user?.id) throw crearError("Usuario autenticado no valido", 401);

  const invitaciones = await ConsejoEjecutivoSalaParticipante.findAll({
    where: { usuarioId: user.id, activo: true },
    attributes: ["salaId"],
    raw: true,
  });
  const idsInvitadas = invitaciones.map((item) => Number(item.salaId));
  const salas = await ConsejoEjecutivoSala.findAll({
    where: {
      activo: true,
      [Op.or]: [
        { creadoPorId: user.id },
        ...(idsInvitadas.length ? [{ id: { [Op.in]: idsInvitadas } }] : []),
      ],
    },
    include: includeSala({ incluirPlanes: true }),
    order: [["updatedAt", "DESC"]],
  });

  const serializadas = await serializarSalas(salas, user);
  return serializadas.filter(
    (sala) =>
      Number(sala.creadoPorId) === Number(user.id) ||
      sala.participantes.some(
        (participante) => Number(participante.id) === Number(user.id),
      ),
  );
};

const crearSala = async ({ user, data }) => {
  if (!user?.id) throw crearError("Usuario autenticado no valido", 401);
  const datosSala = normalizarDatosSala(data);
  const { ids } = await validarParticipantesAdmin(data.participanteIds);

  const salaId = await sequelize.transaction(async (transaction) => {
    const sala = await ConsejoEjecutivoSala.create(
      {
        ...datosSala,
        creadoPorId: user.id,
        activo: true,
      },
      { transaction },
    );

    await ConsejoEjecutivoSalaParticipante.bulkCreate(
      ids.map((usuarioId) => ({
        salaId: sala.id,
        usuarioId,
        invitadoPorId: user.id,
        activo: true,
      })),
      { transaction },
    );

    return sala.id;
  });

  return obtenerSalaAutorizada(salaId, user, { incluirPlanes: true });
};

const actualizarSala = async ({ id, user, data }) => {
  const salaAutorizada = await obtenerSalaAutorizada(id, user);
  if (!salaAutorizada.puedeAdministrar) {
    throw crearError("Solo el creador de la sala puede administrar invitaciones", 403);
  }

  const datosSala = normalizarDatosSala(data);
  const { ids } = await validarParticipantesAdmin(data.participanteIds);
  const salaId = normalizarSalaId(id);

  await sequelize.transaction(async (transaction) => {
    await ConsejoEjecutivoSala.update(datosSala, {
      where: { id: salaId, activo: true },
      transaction,
    });
    await ConsejoEjecutivoSalaParticipante.update(
      { activo: false },
      { where: { salaId, activo: true }, transaction },
    );
    await ConsejoEjecutivoSalaParticipante.bulkCreate(
      ids.map((usuarioId) => ({
        salaId,
        usuarioId,
        invitadoPorId: user.id,
        activo: true,
        updatedAt: new Date(),
      })),
      {
        transaction,
        updateOnDuplicate: ["activo", "invitadoPorId", "updatedAt"],
      },
    );
  });

  return obtenerSalaAutorizada(salaId, user, { incluirPlanes: true });
};

const obtenerDestinatarioIds = async (salaId) => {
  const salaModelo = await obtenerSalaModelo(salaId);
  const [sala] = await serializarSalas([salaModelo], null);
  return [
    ...new Set([
      sala.creadoPorId,
      ...sala.participantes.map((participante) => participante.id),
    ].filter(Boolean).map(Number)),
  ];
};

module.exports = {
  actualizarSala,
  crearSala,
  listarSalas,
  obtenerDestinatarioIds,
  obtenerSalaAutorizada,
};
