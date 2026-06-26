const express = require("express");
const {
  procesarPayload,
  validarFirmaFacebook,
} = require("../services/facebookWebhookService");

const router = express.Router();
const WEBHOOK_LOG_PREFIX = "[Facebook Webhook]";

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const verifyToken = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    process.env.FACEBOOK_VERIFY_TOKEN &&
    verifyToken === process.env.FACEBOOK_VERIFY_TOKEN
  ) {
    console.log(`${WEBHOOK_LOG_PREFIX} webhook verificado`);
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/webhook", (req, res) => {
  const signature = req.get("X-Hub-Signature-256");

  if (!validarFirmaFacebook(req.rawBody, signature)) {
    console.warn(`${WEBHOOK_LOG_PREFIX} firma invalida`);
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  setImmediate(() => {
    procesarPayload(req.body).catch((error) => {
      console.error(`${WEBHOOK_LOG_PREFIX} error procesando webhook`, error);
    });
  });
});

module.exports = router;
