// routes/movimientosTemp.routes.js

const express = require("express");
const {
  actualizarMovimientoTemp,
  crearMovimientoTemp,
  obtenerMovimientosTemp,
  eliminarMovimientoTemp,
} = require("../../controllers/CierreCaja/MovimientoCajaTemp");
const { authenticate } = require("../../middleware/authMiddleware");
const router = express.Router();


router.post("/", authenticate, crearMovimientoTemp);
router.get("/", authenticate, obtenerMovimientosTemp);
router.put("/:id", authenticate, actualizarMovimientoTemp);
router.delete("/:id", authenticate, eliminarMovimientoTemp);

module.exports = router;
