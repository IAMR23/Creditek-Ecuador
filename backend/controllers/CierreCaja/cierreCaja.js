// controllers/contabilidad/cierreCajaController.js

const { sequelize } = require("../../config/db");

const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const Denominacion = require("../../models/CierreCaja/Denominacion");
const RetiroCaja = require("../../models/CierreCaja/RetiroCaja");

const cerrarCaja = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const usuarioAgenciaId = req.user.usuarioAgenciaId;

    const { cierre, denominaciones, retiros } = req.body;

    if (!cierre?.fecha) {
      return res.status(400).json({ message: "Fecha requerida" });
    }

    // 1. Obtener movimientos temporales
    const movimientosTemp = await MovimientoCajaTemp.findAll({
      where: { usuarioAgenciaId },
      transaction: t,
    });

    if (!movimientosTemp.length) {
      return res.status(400).json({
        message: "No existen movimientos para cerrar caja",
      });
    }
  
    // 2. Calcular totales
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalPendiente = 0;

    movimientosTemp.forEach((m) => {
      const valor = Number(m.valor) || 0;

      if (m.formaPago === "EFECTIVO") totalEfectivo += valor;
      if (m.formaPago === "TRANSFERENCIA") totalTransferencia += valor;
      if (m.formaPago === "PENDIENTE") totalPendiente += valor;
    });

    const totalSistema =
      totalEfectivo + totalTransferencia + totalPendiente;

    // 3. Calcular total físico
    let totalFisico = 0;

    denominaciones.forEach((d) => {
      totalFisico += Number(d.denominacion) * Number(d.cantidad);
    });

    // 4. Diferencia
    const diferencia = totalFisico - totalEfectivo;

    const estado = diferencia === 0 ? "CUADRADO" : "DESCUADRADO";

    // 5. Crear cierre
    const cierreCreado = await CierreCaja.create(
      {
        fecha: cierre.fecha,
        usuarioAgenciaId,
        observacion: cierre.observacion || "",
        totalFisico,
        totalEfectivo,
        totalTransferencia,
        totalPendiente,
        totalSistema,
        diferencia,
        estado,
      },
      { transaction: t }
    );

    const cierreId = cierreCreado.id;

    // 6. Guardar denominaciones
    if (denominaciones?.length) {
      const data = denominaciones.map((d) => ({
        cierreId,
        valor: d.denominacion,
        cantidad: d.cantidad,
      }));

      await Denominacion.bulkCreate(data, { transaction: t });
    }

    // 7. Guardar retiros
    if (retiros?.length) {
      const data = retiros.map((r) => ({
        cierreId,
        monto: Number(r.monto),
        motivo: r.motivo,
        autorizadoPor: r.autorizadoPor,
      }));

      await RetiroCaja.bulkCreate(data, { transaction: t });
    }

    // 8. Guardar movimientos definitivos
    const movimientosFinales = movimientosTemp.map((m) => ({
      cierreId,
      responsable: m.responsable,
      detalle: m.detalle,
      entidad: m.entidad,
      valor: m.valor,
      formaPago: m.formaPago,
      recibo: m.recibo,
      observacion: m.observacion,
    }));

    await MovimientoCaja.bulkCreate(movimientosFinales, {
      transaction: t,
    });

    // 9. Limpiar temporales
    await MovimientoCajaTemp.destroy({
      where: { usuarioAgenciaId },
      transaction: t,
    });

    await t.commit();

    return res.json({
      message: "Caja cerrada correctamente",
      cierre: cierreCreado,
    });
  } catch (error) {
    await t.rollback();

    console.error(error);

    return res.status(500).json({
      message: "Error al cerrar caja",
      error: error.message,
    });
  }
};

module.exports = {
  cerrarCaja,
};