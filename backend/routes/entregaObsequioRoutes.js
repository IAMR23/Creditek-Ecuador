const express = require("express");
const router = express.Router();
const controller = require("../controllers/entregaObsequioController");

router.get("/obsequios/:id", controller.obtenerObsequiosEntrega);
router.delete("/obsequios/:id", controller.deleteEntregaObsequio); 
router.post("/", controller.createEntregaObsequio);
router.get("/", controller.getEntregaObsequios);
router.get("/:id", controller.getEntregaObsequio);
router.put("/:id", controller.updateEntregaObsequio);
router.delete("/:id", controller.deleteEntregaObsequio);
  
module.exports = router;
 