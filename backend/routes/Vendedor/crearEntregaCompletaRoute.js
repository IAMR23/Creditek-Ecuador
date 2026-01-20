const express = require("express");
const { crearVentaCompleta } = require("../../controllers/Vendedores/crearVentaCompleta.js");
const { default: upload } = require("../../middleware/multer.js");
const { editarVentaCompleta, obtenerVentaCompleta } = require("../../controllers/Vendedores/editarVentaCompleta.js");
const { getVentasCompletas } = require("../../controllers/Admin/dashboardVentasVentas.js");
const { crearEntregaCompleta } = require("../../controllers/Logistica/crearEntregaCompleta.js");

const router = express.Router();
 
router.post(
  "/entrega-completa",
  upload.single("foto"),
  crearEntregaCompleta
);

/* router.get("/entrega-completa/:id", obtenerVentaCompleta) ;

router.put(
  "/entrega-completa/:id",
  upload.single("foto"),
  editarVentaCompleta
); */

module.exports = router;
  