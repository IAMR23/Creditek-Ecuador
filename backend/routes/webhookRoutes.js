const express = require("express");
const { recibirWebhookStevo, recibirWebhookReparto } = require("../controllers/GHL/webhookController");
const router = express.Router();



router.post("/stevo", recibirWebhookStevo); 
router.post("/ghl/reparto", recibirWebhookReparto);

router.get("/test", (req, res) => {
  res.json({
    ok: true,
    message: "Webhook RVE funcionando",
  });
});

module.exports = router;
