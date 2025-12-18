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
  try {
    const { fechaInicio, fechaFin } = req.query;

    const ventas = await adminVentas.getVentasCompletas({
      fechaInicio,
      fechaFin,
    });

    let ventasUsuario = await adminVentas.contarPorUsuarioDetalle(ventas);

    // ORDEN FIJO DE USUARIOS
    const ordenUsuarios = [
      "Fernando",
      "Raul",
      "Damian",
      "Alexander",
      "Mishell",
      "Damaris",
      "Anais",
      "Naomi",
      "Steiveen", // ajusta si en BD está diferente
      "Mateo Hoyos",
      "Andres",
      "Oscar",
      "Wiliam",
    ];

    // ORDENAR SEGÚN EL ORDEN DEFINIDO
    ventasUsuario = ventasUsuario.sort(
      (a, b) =>
        ordenUsuarios.indexOf(a.nombre) -
        ordenUsuarios.indexOf(b.nombre)
    );

    return res.json({
      fechaInicio,
      fechaFin,
      ventasUsuario,
    });
  } catch (error) {
    console.error("Error en /usuarios:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener ventas por usuario",
    });
  }
});


module.exports = router;
