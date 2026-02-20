const express = require("express");
const router = express.Router();
const { sequelize } = require("../../config/db");
const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const CierreCajaDetalle = require("../../models/CierreCaja/CierreCajaDetalle");



router.post("/cierre-caja", async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { fecha, usuario, observacion, detalles } = req.body;

    // 🔒 1. Validación básica
    if (!fecha || !usuario || !detalles || detalles.length === 0) {
      throw new Error("Datos incompletos");
    }

    // 🔒 2. Verificar si ya existe cierre
    const cierreExistente = await CierreCaja.findOne({
      where: { fecha },
      transaction: t,
    });

    if (cierreExistente) {
      throw new Error("Ya existe un cierre para esta fecha");
    }

    // 📊 3. Calcular totales del sistema
    const totalEfectivoSistema =
      (await MovimientoCaja.sum("valor", {
        where: {
          fecha,
          formaPago: "EFECTIVO",
          cierreCajaId: null,
        },
        transaction: t,
      })) || 0;

    const totalTransferenciaSistema =
      (await MovimientoCaja.sum("valor", {
        where: {
          fecha,
          formaPago: "TRANSFERENCIA",
          cierreCajaId: null,
        },
        transaction: t,
      })) || 0;

    const totalGeneralSistema =
      Number(totalEfectivoSistema) + Number(totalTransferenciaSistema);

    // 💵 4. Calcular efectivo físico
    let totalEfectivoFisico = 0;

    const detallesProcesados = detalles.map((item) => {
      const total = Number(item.denominacion) * Number(item.cantidad);
      totalEfectivoFisico += total;

      return {
        denominacion: item.denominacion,
        cantidad: item.cantidad,
        total,
      };
    });

    // ⚖️ 5. Diferencia
    const diferencia = totalEfectivoFisico - totalEfectivoSistema;

    // 🧾 6. Crear cierre
    const cierre = await CierreCaja.create(
      {
        fecha,
        totalEfectivoSistema,
        totalTransferenciaSistema,
        totalGeneralSistema,
        totalEfectivoFisico,
        diferencia,
        observacion,
        usuarioCreacion: usuario,
      },
      { transaction: t }
    );

    // 💰 7. Guardar detalle de billetes
    const detallesConFk = detallesProcesados.map((d) => ({
      ...d,
      cierreCajaId: cierre.id,
    }));

    await CierreCajaDetalle.bulkCreate(detallesConFk, {
      transaction: t,
    });

    // 🔗 8. Asociar movimientos al cierre
    await MovimientoCaja.update(
      { cierreCajaId: cierre.id },
      {
        where: {
          fecha,
          cierreCajaId: null,
        },
        transaction: t,
      }
    );

    // ✅ 9. Commit
    await t.commit();

    return res.json({
      ok: true,
      cierre,
      resumen: {
        totalEfectivoSistema,
        totalTransferenciaSistema,
        totalGeneralSistema,
        totalEfectivoFisico,
        diferencia,
      },
    });
  } catch (error) {
    await t.rollback();

    return res.status(400).json({
      ok: false,
      msg: error.message,
    });
  }
});

module.exports = router;
