const express = require("express");
const router = express.Router();
const { sequelize } = require("../../config/db");
const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const CierreCajaDetalle = require("../../models/CierreCaja/CierreCajaDetalle");

router.post("/cierre-caja", async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { cierre, denominaciones, movimientos, retiros } = req.body;

    // 🔎 Validaciones básicas
    if (!cierre || !denominaciones || !movimientos) {
      await t.rollback();
      return res.status(400).json({
        ok: false,
        message: "Datos incompletos",
      });
    }

    // ============================
    // 1. Calcular TOTAL FÍSICO
    // ============================
    let totalFisico = 0;

    denominaciones.forEach((d) => {
      totalFisico += Number(d.valor) * Number(d.cantidad);
    });

    // ============================
    // 2. Calcular TOTALES SISTEMA
    // ============================
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalPendiente = 0;

    movimientos.forEach((m) => {
      const valor = Number(m.valor);

      if (m.formaPago === "EFECTIVO") totalEfectivo += valor;
      else if (m.formaPago === "TRANSFERENCIA") totalTransferencia += valor;
      else totalPendiente += valor;
    });

    const totalSistema = totalEfectivo + totalTransferencia + totalPendiente;

    const diferencia = totalFisico - totalSistema;

    // ============================
    // 3. Crear cierre
    // ============================
    const nuevoCierre = await CierreCaja.create(
      {
        fecha: cierre.fecha,
        usuarioId: cierre.usuarioId,
        observacion: cierre.observacion,

        totalFisico,
        totalEfectivo,
        totalTransferencia,
        totalPendiente,
        totalSistema,
        diferencia,
      },
      { transaction: t },
    );

    // ============================
    // 4. Guardar denominaciones
    // ============================
    for (const d of denominaciones) {
      await Denominacion.create(
        {
          cierreId: nuevoCierre.id,
          valor: d.valor,
          cantidad: d.cantidad,
        },
        { transaction: t },
      );
    }

    // ============================
    // 5. Guardar movimientos
    // ============================
    for (const m of movimientos) {
      await MovimientoCaja.create(
        {
          cierreId: nuevoCierre.id,
          responsable: m.responsable,
          detalle: m.detalle,
          entidad: m.entidad,
          valor: m.valor,
          formaPago: m.formaPago,
          recibo: m.recibo,
          observacion: m.observacion,
        },
        { transaction: t },
      );
    }

    // ============================
    // 6. Guardar retiros (opcional)
    // ============================
    if (retiros && retiros.length > 0) {
      for (const r of retiros) {
        await RetiroCaja.create(
          {
            cierreId: nuevoCierre.id,
            monto: r.monto,
            motivo: r.motivo,
            autorizadoPor: r.autorizadoPor,
          },
          { transaction: t },
        );
      }
    }

    await t.commit();

    return res.json({
      ok: true,
      message: "Cierre de caja registrado correctamente",
      data: nuevoCierre,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error al crear cierre de caja",
      error: error.message,
    });
  }
});
module.exports = router;
