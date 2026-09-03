const express = require("express");
const { Op } = require("sequelize");

const auth = require("../middleware/auth");
const { sequelize } = require("../config/db");
const Agencia = require("../models/Agencia");
const PruebaIntento = require("../models/PruebaIntento");
const PruebaRespuesta = require("../models/PruebaRespuesta");
const Usuario = require("../models/Usuario");
const {
  TEST_TYPES,
  buildAttemptQuestions,
  calculateAutomaticScore,
  calculateFinalScore,
  calculateSupervisorScore,
  normalizeRoleName,
  normalizeTestType,
  sanitizeSnapshotForParticipant,
  validateAttemptComposition,
} = require("../services/pruebasService");

const router = express.Router();

const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const requireRoles = (...allowedRoles) => {
  const allowed = new Set(allowedRoles.map(normalizeRoleName));
  return (req, res, next) => {
    if (!allowed.has(normalizeRoleName(req.user?.rol?.nombre))) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para realizar esta acción.",
      });
    }
    return next();
  };
};

const ensureAttemptOwner = (attempt, user) => {
  if (!attempt || Number(attempt.usuarioId) !== Number(user?.id)) {
    throw httpError(404, "Intento no encontrado.");
  }
  return true;
};

const ensureAttemptEditable = (attempt) => {
  if (attempt.estado !== "EN_PROGRESO") {
    throw httpError(409, "No se puede modificar un intento finalizado.");
  }
  return true;
};

const findAttemptForUpdate = async (id, transaction) => {
  const attempt = await PruebaIntento.findByPk(id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!attempt) return null;

  attempt.respuestas = await PruebaRespuesta.findAll({
    where: { intentoId: id },
    transaction,
    lock: transaction.LOCK.UPDATE,
    order: [["id", "ASC"]],
  });
  return attempt;
};

const orderedResponses = (attempt) => {
  const order = new Map(
    (attempt.preguntasSnapshot || []).map((question, index) => [question.id, index]),
  );
  return [...(attempt.respuestas || [])].sort(
    (a, b) => (order.get(a.preguntaId) ?? 999) - (order.get(b.preguntaId) ?? 999),
  );
};

const participantAttemptDto = (attempt) => {
  return {
    id: attempt.id,
    tipo: attempt.tipo,
    tipoLabel: TEST_TYPES[attempt.tipo],
    estado: attempt.estado,
    notaAutomatica:
      attempt.notaAutomatica == null ? null : Number(attempt.notaAutomatica),
    notaSupervisor:
      attempt.notaSupervisor == null ? null : Number(attempt.notaSupervisor),
    notaFinal: attempt.notaFinal == null ? null : Number(attempt.notaFinal),
    aprobado: attempt.estado === "CALIFICADA" ? attempt.aprobado : null,
    fechaInicio: attempt.fechaInicio,
    fechaEnvio: attempt.fechaEnvio,
    fechaCalificacion: attempt.fechaCalificacion,
    observacionGeneral:
      attempt.estado === "CALIFICADA" ? attempt.observacionGeneral : null,
    preguntas: sanitizeSnapshotForParticipant(attempt.preguntasSnapshot || []),
    respuestas: orderedResponses(attempt).map((response) => ({
      preguntaId: response.preguntaId,
      tipo: response.tipo,
      opcionSeleccionada: response.opcionSeleccionada,
      textoRespuesta: response.textoRespuesta,
    })),
  };
};

const adminAttemptDto = (attempt) => {
  const snapshot = new Map(
    (attempt.preguntasSnapshot || []).map((question) => [question.id, question]),
  );
  return {
    id: attempt.id,
    tipo: attempt.tipo,
    tipoLabel: TEST_TYPES[attempt.tipo],
    estado: attempt.estado,
    notaAutomatica: Number(attempt.notaAutomatica || 0),
    notaSupervisor:
      attempt.notaSupervisor == null ? null : Number(attempt.notaSupervisor),
    notaFinal: attempt.notaFinal == null ? null : Number(attempt.notaFinal),
    aprobado: attempt.estado === "CALIFICADA" ? attempt.aprobado : null,
    fechaEnvio: attempt.fechaEnvio,
    fechaCalificacion: attempt.fechaCalificacion,
    observacionGeneral: attempt.observacionGeneral,
    participante: attempt.participante
      ? {
          id: attempt.participante.id,
          nombre: attempt.participante.nombre,
          email: attempt.participante.email,
          agencias: (attempt.participante.agencias || []).map((agency) => ({
            id: agency.id,
            nombre: agency.nombre,
          })),
        }
      : null,
    respuestas: orderedResponses(attempt).map((response) => ({
      preguntaId: response.preguntaId,
      tipo: response.tipo,
      pregunta: response.pregunta,
      opciones: response.opciones,
      opcionSeleccionada: response.opcionSeleccionada,
      textoRespuesta: response.textoRespuesta,
      respuestaCorrecta: response.respuestaCorrecta,
      correcta: response.correcta,
      puntajeSupervisor:
        response.puntajeSupervisor == null
          ? null
          : Number(response.puntajeSupervisor),
      observacionSupervisor: response.observacionSupervisor,
      rubrica: snapshot.get(response.preguntaId)?.rubric || null,
    })),
  };
};

const attemptIncludes = [
  { model: PruebaRespuesta, as: "respuestas" },
];

const adminIncludes = [
  { model: PruebaRespuesta, as: "respuestas" },
  {
    model: Usuario,
    as: "participante",
    attributes: ["id", "nombre", "email"],
    include: [{ model: Agencia, as: "agencias", attributes: ["id", "nombre"] }],
  },
];

router.use(auth);

router.get("/configuracion", requireRoles("USUARIO"), (_req, res) => {
  return res.json({
    ok: true,
    data: {
      tipos: Object.entries(TEST_TYPES).map(([value, label]) => ({ value, label })),
      totalPreguntas: 30,
      preguntasOpcionMultiple: 23,
      preguntasAbiertas: 7,
      notaMinima: 70,
    },
  });
});

router.post("/intentos", requireRoles("USUARIO"), async (req, res, next) => {
  try {
    const existing = await PruebaIntento.findOne({
      where: { usuarioId: req.user.id, estado: "EN_PROGRESO" },
      include: attemptIncludes,
      order: [[{ model: PruebaRespuesta, as: "respuestas" }, "id", "ASC"]],
    });
    if (existing) {
      return res.json({ ok: true, reanudado: true, data: participantAttemptDto(existing) });
    }

    const type = normalizeTestType(req.body?.tipo);
    const questions = buildAttemptQuestions(type);
    const attempt = await sequelize.transaction(async (transaction) => {
      const created = await PruebaIntento.create(
        {
          usuarioId: req.user.id,
          tipo: type,
          estado: "EN_PROGRESO",
          fechaInicio: new Date(),
          preguntasSnapshot: questions,
        },
        { transaction },
      );
      await PruebaRespuesta.bulkCreate(
        questions.map((question) => ({
          intentoId: created.id,
          preguntaId: question.id,
          tipo: question.tipo,
          pregunta: question.question,
          opciones: question.options,
          respuestaCorrecta: question.answer,
        })),
        { transaction },
      );
      return created;
    });
    const completeAttempt = await PruebaIntento.findByPk(attempt.id, {
      include: attemptIncludes,
    });
    return res.status(201).json({
      ok: true,
      reanudado: false,
      data: participantAttemptDto(completeAttempt),
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      const existing = await PruebaIntento.findOne({
        where: { usuarioId: req.user.id, estado: "EN_PROGRESO" },
        include: attemptIncludes,
      });
      if (existing) {
        return res.json({ ok: true, reanudado: true, data: participantAttemptDto(existing) });
      }
    }
    return next(error);
  }
});

router.get("/mis-intentos", requireRoles("USUARIO"), async (req, res, next) => {
  try {
    const attempts = await PruebaIntento.findAll({
      where: { usuarioId: req.user.id },
      include: attemptIncludes,
      order: [["createdAt", "DESC"]],
    });
    return res.json({ ok: true, data: attempts.map(participantAttemptDto) });
  } catch (error) {
    return next(error);
  }
});

router.get("/intentos/:id", requireRoles("USUARIO"), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) throw httpError(400, "El id del intento no es válido.");
    const attempt = await PruebaIntento.findByPk(id, { include: attemptIncludes });
    ensureAttemptOwner(attempt, req.user);
    return res.json({ ok: true, data: participantAttemptDto(attempt) });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/intentos/:id/respuestas",
  requireRoles("USUARIO"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) throw httpError(400, "El id del intento no es válido.");
      const answers = req.body?.respuestas;
      if (!Array.isArray(answers) || !answers.length) {
        throw httpError(400, "Debe enviar al menos una respuesta.");
      }

      await sequelize.transaction(async (transaction) => {
        const attempt = await PruebaIntento.findByPk(id, { transaction });
        ensureAttemptOwner(attempt, req.user);
        ensureAttemptEditable(attempt);
        const stored = await PruebaRespuesta.findAll({
          where: { intentoId: id },
          transaction,
        });
        const byQuestion = new Map(stored.map((answer) => [answer.preguntaId, answer]));
        const seen = new Set();

        for (const incoming of answers) {
          const questionId = String(incoming?.preguntaId || "").trim();
          const answer = byQuestion.get(questionId);
          if (!answer || seen.has(questionId)) {
            throw httpError(400, "La solicitud contiene una pregunta inválida o repetida.");
          }
          seen.add(questionId);

          if (answer.tipo === "opcion_multiple") {
            const selected = String(incoming.opcionSeleccionada || "").toUpperCase();
            if (!answer.opciones.some((option) => option.value === selected)) {
              throw httpError(400, "La opción seleccionada no es válida.");
            }
            answer.opcionSeleccionada = selected;
          } else {
            const text = String(incoming.textoRespuesta || "").trim();
            if (text.length > 5000) {
              throw httpError(400, "La respuesta abierta supera los 5000 caracteres.");
            }
            answer.textoRespuesta = text || null;
          }
          await answer.save({ transaction });
        }
      });

      const updated = await PruebaIntento.findByPk(id, { include: attemptIncludes });
      return res.json({ ok: true, message: "Avance guardado.", data: participantAttemptDto(updated) });
    } catch (error) {
      return next(error);
    }
  },
);

router.post(
  "/intentos/:id/finalizar",
  requireRoles("USUARIO"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) throw httpError(400, "El id del intento no es válido.");

      await sequelize.transaction(async (transaction) => {
        const attempt = await findAttemptForUpdate(id, transaction);
        ensureAttemptOwner(attempt, req.user);
        ensureAttemptEditable(attempt);
        validateAttemptComposition(attempt.preguntasSnapshot || [], attempt.tipo);

        const responses = attempt.respuestas || [];
        if (responses.length !== 30) {
          throw httpError(409, "El intento no contiene sus 30 respuestas registradas.");
        }
        const multiple = responses.filter((answer) => answer.tipo === "opcion_multiple");
        const open = responses.filter((answer) => answer.tipo === "abierta");
        if (
          multiple.length !== 23 ||
          multiple.some((answer) => !answer.opcionSeleccionada) ||
          open.length !== 7 ||
          open.some((answer) => !String(answer.textoRespuesta || "").trim())
        ) {
          throw httpError(400, "Debe responder las 30 preguntas antes de finalizar.");
        }

        let correct = 0;
        for (const answer of multiple) {
          answer.correcta = answer.opcionSeleccionada === answer.respuestaCorrecta;
          answer.puntajeAutomatico = answer.correcta ? 70 / 23 : 0;
          if (answer.correcta) correct += 1;
          await answer.save({ transaction });
        }

        attempt.notaAutomatica = calculateAutomaticScore(correct);
        attempt.estado = "PENDIENTE_REVISION";
        attempt.fechaEnvio = new Date();
        attempt.aprobado = null;
        await attempt.save({ transaction });
      });

      const updated = await PruebaIntento.findByPk(id, { include: attemptIncludes });
      return res.json({
        ok: true,
        message: "Prueba enviada. La revisión del supervisor está pendiente.",
        data: participantAttemptDto(updated),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/admin/intentos",
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const requestedState = String(req.query.estado || "TODAS").toUpperCase();
      const states =
        requestedState === "TODAS"
          ? ["PENDIENTE_REVISION", "CALIFICADA"]
          : [requestedState];
      if (
        states.some(
          (state) => !["PENDIENTE_REVISION", "CALIFICADA"].includes(state),
        )
      ) {
        throw httpError(400, "El estado solicitado no es válido.");
      }
      const attempts = await PruebaIntento.findAll({
        where: { estado: { [Op.in]: states } },
        include: adminIncludes,
        order: [["fechaEnvio", "DESC"]],
      });
      return res.json({ ok: true, data: attempts.map(adminAttemptDto) });
    } catch (error) {
      return next(error);
    }
  },
);

router.get(
  "/admin/intentos/:id",
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) throw httpError(400, "El id del intento no es válido.");
      const attempt = await PruebaIntento.findByPk(id, { include: adminIncludes });
      if (!attempt || attempt.estado === "EN_PROGRESO") {
        throw httpError(404, "Evaluación enviada no encontrada.");
      }
      return res.json({ ok: true, data: adminAttemptDto(attempt) });
    } catch (error) {
      return next(error);
    }
  },
);

router.put(
  "/admin/intentos/:id/calificar",
  requireRoles("ADMIN"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) throw httpError(400, "El id del intento no es válido.");
      const grades = req.body?.calificaciones;
      if (!Array.isArray(grades) || grades.length !== 7) {
        throw httpError(400, "Debe calificar las siete respuestas abiertas.");
      }

      await sequelize.transaction(async (transaction) => {
        const attempt = await findAttemptForUpdate(id, transaction);
        if (!attempt) throw httpError(404, "Evaluación no encontrada.");
        if (attempt.estado !== "PENDIENTE_REVISION") {
          throw httpError(409, "La evaluación ya no está pendiente de revisión.");
        }

        const openAnswers = (attempt.respuestas || []).filter(
          (answer) => answer.tipo === "abierta",
        );
        const byQuestion = new Map(
          openAnswers.map((answer) => [answer.preguntaId, answer]),
        );
        if (openAnswers.length !== 7) {
          throw httpError(409, "La evaluación no contiene siete respuestas abiertas.");
        }

        const seen = new Set();
        let totalPoints = 0;
        for (const grade of grades) {
          const questionId = String(grade?.preguntaId || "").trim();
          const answer = byQuestion.get(questionId);
          const points = Number(grade?.puntaje);
          if (
            !answer ||
            seen.has(questionId) ||
            !Number.isFinite(points) ||
            points < 0 ||
            points > 5
          ) {
            throw httpError(
              400,
              "Cada respuesta abierta debe tener un puntaje entre 0 y 5.",
            );
          }
          seen.add(questionId);
          totalPoints += points;
          answer.puntajeSupervisor = points;
          answer.observacionSupervisor =
            String(grade.observacion || "").trim().slice(0, 3000) || null;
          await answer.save({ transaction });
        }
        if (seen.size !== 7) {
          throw httpError(400, "Falta calificar una o más respuestas abiertas.");
        }

        attempt.notaSupervisor = calculateSupervisorScore(totalPoints);
        attempt.notaFinal = calculateFinalScore(
          attempt.notaAutomatica,
          attempt.notaSupervisor,
        );
        attempt.aprobado = attempt.notaFinal >= 70;
        attempt.supervisorId = req.user.id;
        attempt.fechaCalificacion = new Date();
        attempt.observacionGeneral =
          String(req.body?.observacionGeneral || "").trim().slice(0, 5000) || null;
        attempt.estado = "CALIFICADA";
        await attempt.save({ transaction });
      });

      const updated = await PruebaIntento.findByPk(id, { include: adminIncludes });
      return res.json({
        ok: true,
        message: "Calificación final guardada.",
        data: adminAttemptDto(updated),
      });
    } catch (error) {
      return next(error);
    }
  },
);

router.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  if (status === 500) console.error("Error en pruebas:", error);
  return res.status(status).json({
    ok: false,
    message: status === 500 ? "Error interno al procesar la prueba." : error.message,
  });
});

module.exports = router;
module.exports.ensureAttemptEditable = ensureAttemptEditable;
module.exports.ensureAttemptOwner = ensureAttemptOwner;
module.exports.findAttemptForUpdate = findAttemptForUpdate;
module.exports.adminAttemptDto = adminAttemptDto;
module.exports.participantAttemptDto = participantAttemptDto;
module.exports.requireRoles = requireRoles;
