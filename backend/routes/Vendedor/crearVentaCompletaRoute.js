const express = require("express");
const { crearVentaCompleta } = require("../../controllers/Vendedores/crearVentaCompleta.js");
const { default: upload } = require("../../middleware/multer.js");
const { editarVentaCompleta, obtenerVentaCompleta } = require("../../controllers/Vendedores/editarVentaCompleta.js");
const { getVentasCompletas } = require("../../controllers/Admin/dashboardVentasVentas.js");

const router = express.Router();

router.post(
  "/ventas-completas",
  upload.single("foto"),
  crearVentaCompleta
);

router.get("/venta-completa/:id", obtenerVentaCompleta) ;

router.put(
  "/venta-completa/:id",
  upload.single("foto"),
  editarVentaCompleta
);

module.exports = router;
  