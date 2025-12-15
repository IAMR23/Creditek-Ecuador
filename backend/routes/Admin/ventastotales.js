const express = require("express");
const adminVentas = require("../../controllers/Admin/dashboardVentasVentas");
const router = express.Router();

router.get("/agencias", async (req, res) => {
  const { fechaInicio, fechaFin, agenciaId, usuarioId } = req.query;

  const ventas = await adminVentas.getVentasCompletas({
    fechaInicio,
    fechaFin,
    agenciaId,
    usuarioId,
  });

  let ventasPorAgencia = adminVentas.contarPorAgenciaDetalle (ventas);

  // Orden forzado
  const ordenAgencias = [
    "Nueva Aurora",
    "Caupicho",
    "Sangolqui",
    "Chillogallo",
  ];

  // Crear objeto ordenado
  const ventasOrdenadas = {};

  ordenAgencias.forEach((agencia) => {
    if (ventasPorAgencia[agencia] !== undefined) {
      ventasOrdenadas[agencia] = ventasPorAgencia[agencia];
    } else {
      ventasOrdenadas[agencia] = 0; // si no existe, lo dejamos en cero
    }
  });

  return res.json({
    fechaInicio,
    fechaFin,
    ventasPorAgencia: ventasOrdenadas,
  });
});


router.get("/usuarios", async (req, res) => {
  const { fechaInicio, fechaFin } = req.query;

  const ventas = await adminVentas.getVentasCompletas({
    fechaInicio,
    fechaFin,
  });

  const ventasUsuario = await adminVentas.contarPorUsuarioDetalle(ventas);

  return res.json({
    fechaInicio,
    fechaFin,
    ventasUsuario,
  });
});

module.exports = router;
