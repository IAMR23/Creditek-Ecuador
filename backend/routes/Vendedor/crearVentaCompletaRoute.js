const express = require("express");
const { crearVentaCompleta } = require("../../controllers/Vendedores/crearVentaCompleta.js");
const { default: upload } = require("../../middleware/multer.js");

const router = express.Router();

router.post(
  "/ventas-completas",
  upload.single("foto"),
  crearVentaCompleta
);

module.exports = router;
  