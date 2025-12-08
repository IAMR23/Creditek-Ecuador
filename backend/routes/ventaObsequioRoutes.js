const express = require("express");
const router = express.Router();
const controller = require("../controllers/ventaObsequioController");

router.get("/obsequios/:id", controller.obtenerObsequiosVenta);
router.delete("/obsequios/:id", controller.deleteVentaObsequio );
router.post("/", controller.createVentaObsequio);
router.get("/", controller.getVentaObsequios);
router.get("/:id", controller.getVentaObsequio);
router.put("/:id", controller.updateVentaObsequio);
router.delete("/:id", controller.deleteVentaObsequio);

module.exports = router;
 