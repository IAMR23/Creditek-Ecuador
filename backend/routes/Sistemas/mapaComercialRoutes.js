const express = require("express");
const controller = require("../../controllers/Sistemas/mapaComercialController");
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, requirePermission(["Sistemas", "Administracion"]));

router.get("/", controller.dashboard);
router.get("/resumen", controller.resumen);
router.get("/distribucion", controller.distribucion);
router.get("/ranking-dispositivos", controller.rankingDispositivos);
router.get("/ranking-zonas", controller.rankingZonas);
router.get("/zonas-sin-ventas", controller.zonasSinVentas);
router.get("/filtros", controller.filtros);
router.get("/puntos", controller.puntosVentas);
router.get("/ubicaciones-pendientes", controller.ubicacionesPendientes);
router.post("/normalizar", controller.normalizarUbicaciones);
router.patch("/ubicaciones/:id", controller.corregirUbicacion);
router.post("/zonas", controller.crearZona);

module.exports = router;
