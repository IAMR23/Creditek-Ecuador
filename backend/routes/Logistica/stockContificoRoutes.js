const express = require("express");
const controller = require("../../controllers/Logistica/stockContificoController");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate);

// El panel de vendedores solo consulta la cobertura por bodega.
const requireCoverageAccess = (req, res, next) => {
  if (String(req.user?.rol || "").trim().toLowerCase() === "vendedor") {
    return next();
  }
  return requirePermission("Vendedor", "Logistica", "Administracion")(req, res, next);
};

router.get("/cobertura-bodegas", requireCoverageAccess, controller.coberturaBodegas);

router.use(requirePermission("Logistica", "Administracion"));

router.get("/catalogo", controller.catalogo);
router.get("/productos/:productoId/stock", controller.stockProducto);
router.get("/bodegas/:bodegaId/stock", controller.stockBodega);

module.exports = router;
