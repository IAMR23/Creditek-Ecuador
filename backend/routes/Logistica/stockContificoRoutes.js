const express = require("express");
const controller = require("../../controllers/Logistica/stockContificoController");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, requirePermission("Logistica", "Administracion"));

router.get("/catalogo", controller.catalogo);
router.get("/cobertura-bodegas", controller.coberturaBodegas);
router.get("/productos/:productoId/stock", controller.stockProducto);
router.get("/bodegas/:bodegaId/stock", controller.stockBodega);

module.exports = router;
