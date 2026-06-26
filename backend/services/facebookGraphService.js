const axios = require("axios");

const GRAPH_API_VERSION = "v20.0";
const GRAPH_API_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const responderComentario = async (commentId, mensaje) => {
  if (!process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
    throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN no configurado");
  }

  if (!commentId || !mensaje) {
    throw new Error("commentId y mensaje son requeridos para responder");
  }

  const url = `${GRAPH_API_BASE_URL}/${encodeURIComponent(commentId)}/comments`;

  const { data } = await axios.post(url, {
    message: mensaje,
    access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
  });

  return data;
};

module.exports = {
  responderComentario,
};
