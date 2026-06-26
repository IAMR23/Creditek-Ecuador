const crypto = require("crypto");
const FacebookComentario = require("../models/FacebookComentario");
const { responderComentario } = require("./facebookGraphService");

const WEBHOOK_LOG_PREFIX = "[Facebook Webhook]";

const validarFirmaFacebook = (rawBody, signatureHeader) => {
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appSecret) return true;
  if (!rawBody || !signatureHeader) return false;

  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const expectedHeader = `sha256=${expectedSignature}`;

  const received = Buffer.from(signatureHeader, "utf8");
  const expected = Buffer.from(expectedHeader, "utf8");

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
};

const normalizarCreatedTime = (createdTime) => {
  if (!createdTime) return null;

  if (typeof createdTime === "number") {
    return new Date(createdTime * 1000);
  }

  const numericCreatedTime = Number(createdTime);
  if (!Number.isNaN(numericCreatedTime)) {
    return new Date(numericCreatedTime * 1000);
  }

  const date = new Date(createdTime);
  return Number.isNaN(date.getTime()) ? null : date;
};

const esCambioDeComentario = (change) => {
  const value = change?.value || {};
  return change?.field === "feed" && value.item === "comment" && Boolean(value.comment_id);
};

const extraerComentario = (entry, change) => {
  const value = change.value || {};

  return {
    pageId: String(value.page_id || entry.id || ""),
    postId: value.post_id ? String(value.post_id) : null,
    commentId: value.comment_id ? String(value.comment_id) : null,
    parentId: value.parent_id ? String(value.parent_id) : null,
    autorId: value.from?.id ? String(value.from.id) : null,
    autorNombre: value.from?.name || null,
    mensaje: value.message || null,
    createdAt: normalizarCreatedTime(value.created_time),
    rawPayload: {
      entryId: entry.id,
      entryTime: entry.time,
      field: change.field,
      value,
    },
  };
};

const guardarComentario = async (comentario) => {
  if (!comentario.pageId || !comentario.commentId) {
    console.warn(`${WEBHOOK_LOG_PREFIX} comentario ignorado por datos incompletos`, {
      pageId: comentario.pageId,
      commentId: comentario.commentId,
    });
    return { guardado: false, duplicado: false };
  }

  const defaults = {
    pageId: comentario.pageId,
    postId: comentario.postId,
    parentId: comentario.parentId,
    autorId: comentario.autorId,
    autorNombre: comentario.autorNombre,
    mensaje: comentario.mensaje,
    rawPayload: comentario.rawPayload,
    estado: "PENDIENTE",
  };

  if (comentario.createdAt) {
    defaults.createdAt = comentario.createdAt;
  }

  const [registro, created] = await FacebookComentario.findOrCreate({
    where: { commentId: comentario.commentId },
    defaults: {
      commentId: comentario.commentId,
      ...defaults,
    },
  });

  if (!created) {
    console.log(`${WEBHOOK_LOG_PREFIX} comentario duplicado`, {
      commentId: comentario.commentId,
      pageId: comentario.pageId,
    });
    return { guardado: false, duplicado: true, registro };
  }

  console.log(`${WEBHOOK_LOG_PREFIX} comentario guardado`, {
    id: registro.id,
    commentId: registro.commentId,
    pageId: registro.pageId,
    postId: registro.postId,
  });

  return { guardado: true, duplicado: false, registro };
};

const procesarPayload = async (payload) => {
  console.log(`${WEBHOOK_LOG_PREFIX} evento recibido`, JSON.stringify(payload));

  if (payload?.object !== "page") {
    console.log(`${WEBHOOK_LOG_PREFIX} objeto ignorado`, { object: payload?.object });
    return { procesados: 0, guardados: 0, duplicados: 0 };
  }

  let procesados = 0;
  let guardados = 0;
  let duplicados = 0;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (!esCambioDeComentario(change)) continue;

      procesados += 1;
      const comentario = extraerComentario(entry, change);
      const resultado = await guardarComentario(comentario);

      if (resultado.guardado) guardados += 1;
      if (resultado.duplicado) duplicados += 1;
    }
  }

  return { procesados, guardados, duplicados };
};

const generarRespuestaPlantillaBasica = (comentario) => {
  const nombre = comentario?.autorNombre ? ` ${comentario.autorNombre}` : "";
  return `Hola${nombre}, gracias por escribirnos. En breve nuestro equipo te respondera.`;
};

const responderAutomaticamenteConPlantilla = async (comentario) => {
  const mensaje = generarRespuestaPlantillaBasica(comentario);
  const respuesta = await responderComentario(comentario.commentId, mensaje);

  await comentario.update({
    estado: "RESPONDIDO",
    respuestaGenerada: mensaje,
    respuestaEnviada: mensaje,
    errorMensaje: null,
  });

  return respuesta;
};

module.exports = {
  validarFirmaFacebook,
  procesarPayload,
  generarRespuestaPlantillaBasica,
  responderAutomaticamenteConPlantilla,
};
