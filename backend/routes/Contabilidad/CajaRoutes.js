const express = require("express");
const router = express.Router();
const { sequelize } = require("../../config/db");

const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const Denominacion = require("../../models/CierreCaja/Denominacion");
const RetiroCaja = require("../../models/CierreCaja/RetiroCaja");

router.post("/cierre-caja", async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { cierre, denominaciones, retiros } = req.body;


    if (!cierre || !denominaciones) {
      await t.rollback();
      return res.status(400).json({
        ok: false,
        message: "Datos incompletos",
      });
    }

    const usuarioId = cierre.usuarioId;

    // ============================
    // 📥 Obtener movimientos TEMP
    // ============================
    const movimientosTemp = await MovimientoCajaTemp.findAll({
      where: {
        usuarioId,
        estado: "ACTIVO",
      },
      transaction: t,
    });

    if (!movimientosTemp.length) {
      await t.rollback();
      return res.status(400).json({
        ok: false,
        message: "No hay movimientos para cerrar",
      });
    }

    // ============================
    // 1. TOTAL FÍSICO
    // ============================
    let totalFisico = 0;

    for (const d of denominaciones) {
      totalFisico += Number(d.valor) * Number(d.cantidad);
    }

    // ============================
    // 2. TOTAL SISTEMA
    // ============================
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalPendiente = 0;

    for (const m of movimientosTemp) {
      const valor = Number(m.valor);

      if (m.formaPago === "EFECTIVO") totalEfectivo += valor;
      else if (m.formaPago === "TRANSFERENCIA")
        totalTransferencia += valor;
      else totalPendiente += valor;
    }

    const totalSistema =
      totalEfectivo + totalTransferencia + totalPendiente;

    const diferencia = totalFisico - totalSistema;

    // ============================
    // 3. Crear cierre
    // ============================
    const nuevoCierre = await CierreCaja.create(
      {
        fecha: cierre.fecha,
        usuarioId,
        observacion: cierre.observacion,

        totalFisico,
        totalEfectivo,
        totalTransferencia,
        totalPendiente,
        totalSistema,
        diferencia,
      },
      { transaction: t }
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
        { transaction: t }
      );
    }

    // ============================
    // 5. Pasar TEMP → DEFINITIVO
    // ============================
    for (const m of movimientosTemp) {
      await MovimientoCaja.create(
        {
          cierreId: nuevoCierre.id,
          responsable: m.responsable,
          detalle: m.detalle,
          valor: m.valor,
          formaPago: m.formaPago,
          recibo: m.recibo,
          observacion: m.observacion,
        },
        { transaction: t }
      );
    }

    // ============================
    // 6. Cerrar movimientos TEMP
    // ============================
    await MovimientoCajaTemp.update(
      { estado: "CERRADO" },
      {
        where: {
          usuarioId,
          estado: "ACTIVO",
        },
        transaction: t,
      }
    );

    // ============================
    // 7. Guardar retiros
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
          { transaction: t }
        );
      }
    }

    // ============================
    // ✅ Commit
    // ============================
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