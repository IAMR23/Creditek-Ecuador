const express = require("express");
const { default: upload } = require("../../middleware/multer.js");
const { editarVentaCompleta, obtenerVentaCompleta } = require("../../controllers/Vendedores/editarVentaCompleta.js");
const { crearEntregaCompleta } = require("../../controllers/Logistica/crearEntregaCompleta.js");
const { obtenerEntregaCompleta, editarEntregaCompleta } = require("../../controllers/Vendedores/editarEntregaCompleta.js");

const router = express.Router();
 
router.post(
  "/entrega-completa",
  upload.single("foto"),
  crearEntregaCompleta
);

router.get("/entrega-completa/:id", obtenerEntregaCompleta) ;

router.put(
  "/entrega-completa/:id",
  upload.single("foto"),
  editarEntregaCompleta
); 
module.exports = router;
  