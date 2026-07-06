const express = require("express");
const { recibirPurchaseWhatsApp } = require("../controllers/Meta/whatsappPurchaseController");

const router = express.Router();

router.post("/whatsapp-purchase", recibirPurchaseWhatsApp);

module.exports = router;
