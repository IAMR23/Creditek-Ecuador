const express = require("express");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const { authenticate } = require("../../middleware/authMiddleware");
const router = express.Router();


router.post("/", authenticate, async (req, res) => {
  try {
    let {
      responsable,
      detalle,
      valor,
      formaPago,
      nroRecibo,
      observacion,
    } = req.body;

    const agenciaId = req.user.agenciaId;
    const usuario = req.user.id;


    valor = Number(valor);
    nroRecibo = nroRecibo ? Number(nroRecibo) : null;

    if (isNaN(valor) ) {
      return res.status(400).json({
        ok: false,
      });
    }

    // 🧾 Crear movimiento
    const movimiento = await MovimientoCaja.create({
      responsable: responsable || null,
      detalle: detalle || null,
      valor,
      formaPago: formaPago || "EFECTIVO",
      nroRecibo,
      observacion: observacion || null,
      agenciaId,
      fecha : new Date(),    
      usuarioCreacion: usuario,
      cierreCajaId: null,
    });

    return res.json({
      ok: true,
      movimiento,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      msg: error.message,
    });
  }
});



router.post("/iniciar", async (req, res) => {
  const { agenciaId, usuarioId } = req.body;
  const hoy = new Date().toISOString().split("T")[0];

  const sesionActiva = await CajaSesion.findOne({
    where: {
      agenciaId,
      fecha: hoy,
      activa: true,
    },
  });

  if (sesionActiva && sesionActiva.usuarioId !== usuarioId) {
    return res.status(409).json({
      msg: "Caja en uso por otro usuario",
      usuarioId: sesionActiva.usuarioId,
    });
  }

  const sesion = await CajaSesion.create({
    agenciaId,
    usuarioId,
    fecha: hoy,
  });

  res.json(sesion);
});

router.post("/cerrar", async (req, res) => {
  const { agenciaId, usuarioId } = req.body;

  await CajaSesion.update(
    { activa: false },
    {
      where: {
        agenciaId,
        usuarioId,
        activa: true,
      },
    },
  );

  res.json({ msg: "Sesión cerrada" });
});

module.exports = router;
