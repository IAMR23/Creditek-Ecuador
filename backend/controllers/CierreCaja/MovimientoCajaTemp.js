// controllers/movimientoCajaTemp.controller.js

const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");


const crearMovimientoTemp = async (req, res) => {
  try {
    const usuarioAgenciaId = req.user?.usuarioAgenciaId ; 
    if (!usuarioAgenciaId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      }); 
    } 

    const { responsable, detalle, valor, formaPago, recibo, observacion } = req.body;

    if (!detalle?.trim() && !observacion?.trim()) {
      return res.status(400).json({
        ok: false,
        message: "Detalle requerido",
      });
    }

    if (!formaPago?.trim() && !observacion?.trim()) {
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar forma de pago o escribir una observación",
      });
    }

    if (!observacion?.trim()) {
      if (!valor || isNaN(valor) || Number(valor) <= 0) {
        return res.status(400).json({
          ok: false,
          message: "Valor inválido",
        });
      }
    }

    const nuevo = await MovimientoCajaTemp.create({
      usuarioAgenciaId,
      responsable,
      detalle: detalle?.trim() || null,
      valor: Number(valor) || 0,
      formaPago: formaPago?.trim() || null,
      recibo,
      observacion,
      estado: "ACTIVO",
    });

    return res.json({
      ok: true,
      data: nuevo,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error al guardar movimiento temporal",
    });
  }
};

const obtenerMovimientosTemp = async (req, res) => {
  try {
    const usuarioAgenciaId = req.user?.usuarioAgenciaId ; 

    const movimientos = await MovimientoCajaTemp.findAll({
      where: {
        usuarioAgenciaId,
        estado: "ACTIVO", 
      },
      order: [["id", "ASC"]],
    });

    return res.json({
      ok: true,
      data: movimientos,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener movimientos",
    });
  }
};

const eliminarMovimientoTemp = async (req, res) => {
  try {
    const { id } = req.params;

    const eliminado = await MovimientoCajaTemp.destroy({
      where: { id },
    });

    if (!eliminado) {
      return res.status(404).json({
        ok: false,
        message: "Movimiento no encontrado",
      });
    }

    return res.json({
      ok: true,
      message: "Movimiento eliminado",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error al eliminar",
    });
  }
};

// ============================
// 🧹 Limpiar movimientos (al cerrar)
// ============================
const limpiarMovimientosTemp = async (usuarioAgenciaId, transaction = null) => {
  return await MovimientoCajaTemp.update(
    { estado: "CERRADO" },
    {
      where: {
        usuarioAgenciaId,
        estado: "ACTIVO",
      },
      transaction,
    },
  );
};

module.exports = {
  crearMovimientoTemp,
  obtenerMovimientosTemp,
  eliminarMovimientoTemp,
  limpiarMovimientosTemp,
};
