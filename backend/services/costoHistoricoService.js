const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const CostoHistorico = require("../models/CostoHistorico");
const DetalleVenta = require("../models/DetalleVenta");
const Venta = require("../models/Venta");
const {
  seleccionarCostoHistorico,
} = require("../utils/seleccionarCostoHistorico");

const crearError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const calcularMargenDetalle = (detalle, costo) =>
  Number(
    (
      Number(detalle.precioVendedor || 0) +
      Number(detalle.alcance || 0) -
      Number(costo || 0)
    ).toFixed(2),
  );

const validarFechaIso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const recalcularDetalles = async ({
  detalles,
  historicosPorModelo,
  transaction,
}) => {
  const recalculos = detalles.map((detalle) => {
    const modeloId = Number(detalle.modeloId);
    const fechaVenta = detalle.venta?.fecha;
    const costoVigente = seleccionarCostoHistorico(
      historicosPorModelo.get(modeloId) || [],
      fechaVenta,
    );

    if (!costoVigente) {
      throw crearError(
        `No existe costo historico aplicable para el modelo ${modeloId} en la fecha ${fechaVenta}.`,
        409,
        "VENTA_SIN_COSTO_HISTORICO",
      );
    }

    const costo = Number(costoVigente.costo);
    return {
      detalle,
      valores: {
        costo,
        margen: calcularMargenDetalle(detalle, costo),
      },
    };
  });

  for (let index = 0; index < recalculos.length; index += 100) {
    const lote = recalculos.slice(index, index + 100);
    await Promise.all(
      lote.map(({ detalle, valores }) =>
        detalle.update(valores, { transaction }),
      ),
    );
  }
};

const agruparHistoricosPorModelo = (historicos) => {
  const porModelo = new Map();
  historicos.forEach((historico) => {
    const modeloId = Number(historico.modeloId);
    const registros = porModelo.get(modeloId) || [];
    registros.push(historico);
    porModelo.set(modeloId, registros);
  });
  return porModelo;
};

const reajustarVentasPorRango = async ({ fechaDesde, fechaHasta }) => {
  if (!validarFechaIso(fechaDesde) || !validarFechaIso(fechaHasta)) {
    throw crearError(
      "Las fechas deben tener formato YYYY-MM-DD.",
      400,
      "RANGO_FECHAS_INVALIDO",
    );
  }
  if (fechaDesde > fechaHasta) {
    throw crearError(
      "La fecha desde no puede ser posterior a la fecha hasta.",
      400,
      "RANGO_FECHAS_INVALIDO",
    );
  }

  return sequelize.transaction(async (transaction) => {
    const detalles = await DetalleVenta.findAll({
      attributes: [
        "id",
        "modeloId",
        "precioVendedor",
        "alcance",
        "costo",
        "margen",
      ],
      include: [
        {
          model: Venta,
          as: "venta",
          attributes: ["fecha"],
          required: true,
          where: {
            activo: true,
            fecha: { [Op.between]: [fechaDesde, fechaHasta] },
          },
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!detalles.length) {
      return {
        fechaDesde,
        fechaHasta,
        ventasRecalculadas: 0,
        modelosReajustados: 0,
      };
    }

    const modeloIds = [...new Set(detalles.map((detalle) => Number(detalle.modeloId)))];
    const historicos = await CostoHistorico.findAll({
      where: {
        modeloId: { [Op.in]: modeloIds },
        fechaCompra: { [Op.lte]: fechaHasta },
      },
      order: [
        ["modeloId", "ASC"],
        ["fechaCompra", "DESC"],
        ["id", "DESC"],
      ],
      transaction,
      lock: transaction.LOCK.SHARE,
    });

    await recalcularDetalles({
      detalles,
      historicosPorModelo: agruparHistoricosPorModelo(historicos),
      transaction,
    });

    return {
      fechaDesde,
      fechaHasta,
      ventasRecalculadas: detalles.length,
      modelosReajustados: modeloIds.length,
    };
  });
};

const eliminarCostoHistoricoConRecalculo = async (costoHistoricoId) =>
  sequelize.transaction(async (transaction) => {
    const costoEliminado = await CostoHistorico.findByPk(costoHistoricoId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!costoEliminado) {
      throw crearError("Costo historico no encontrado", 404, "COSTO_NO_ENCONTRADO");
    }

    const modeloId = Number(costoEliminado.modeloId);
    const fechaDesde = String(costoEliminado.fechaCompra);
    await costoEliminado.destroy({ transaction });

    const historicosRestantes = await CostoHistorico.findAll({
      where: { modeloId },
      order: [
        ["fechaCompra", "DESC"],
        ["id", "DESC"],
      ],
      transaction,
      lock: transaction.LOCK.SHARE,
    });

    const detallesAfectados = await DetalleVenta.findAll({
      where: { modeloId },
      attributes: [
        "id",
        "modeloId",
        "precioVendedor",
        "alcance",
        "costo",
        "margen",
      ],
      include: [
        {
          model: Venta,
          as: "venta",
          attributes: ["fecha"],
          required: true,
          where: { fecha: { [Op.gte]: fechaDesde } },
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    try {
      await recalcularDetalles({
        detalles: detallesAfectados,
        historicosPorModelo: new Map([[modeloId, historicosRestantes]]),
        transaction,
      });
    } catch (error) {
      if (error.code === "VENTA_SIN_COSTO_HISTORICO") {
        throw crearError(
          `No se puede eliminar el costo del ${fechaDesde}: existen ventas posteriores sin otro costo historico aplicable.`,
          409,
          "VENTAS_SIN_COSTO_HISTORICO",
        );
      }
      throw error;
    }

    return {
      costoEliminadoId: Number(costoEliminado.id),
      modeloId,
      fechaDesde,
      ventasRecalculadas: detallesAfectados.length,
    };
  });

module.exports = {
  calcularMargenDetalle,
  eliminarCostoHistoricoConRecalculo,
  reajustarVentasPorRango,
};
