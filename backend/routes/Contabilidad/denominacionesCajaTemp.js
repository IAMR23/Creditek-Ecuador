const express = require("express");
const {
  guardarDenominacionesTemp,
  obtenerDenominacionesTemp,
} = require("../../controllers/CierreCaja/DenominacionCajaTemp");
const { authenticate } = require("../../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticate, obtenerDenominacionesTemp);
router.put("/", authenticate, guardarDenominacionesTemp);

module.exports = router;
