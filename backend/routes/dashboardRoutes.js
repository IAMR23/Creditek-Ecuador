// routes/dashboard.js
const express = require("express");
const router = express.Router();
const { Op, Sequelize } = require("sequelize");
const Venta = require("../models/Venta");
const Entrega = require("../models/Entrega");

// 📌 Función para obtener inicio del día y del mes
function obtenerFechas() {
  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { hoy, inicioDia, inicioMes };
}

router.get("/resumen", async (req, res) => {
  try {
    const { rango, desde, hasta } = req.query;

    // =============================================================
    // GENERADOR DE FILTRO POR FECHAS
    // =============================================================
    const crearFiltroFecha = () => {
      const hoy = new Date();
      const inicioDia = new Date(hoy.setHours(0, 0, 0, 0));

      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      if (rango === "hoy") {
        return { [Op.gte]: inicioDia };
      }

      if (rango === "mes") {
        return { [Op.gte]: inicioMes };
      }

      if (rango === "7dias") {
        const sieteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return { [Op.gte]: sieteDias };
      }

      if (rango === "custom" && desde && hasta) {
        return { [Op.between]: [new Date(desde), new Date(hasta)] };
      }

      // Si no envía nada: últimos 7 días por defecto
      return { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
    };

    const filtroFecha = crearFiltroFecha();

    // =============================================================
    // VENTAS
    // =============================================================
    const ventasHoy = await Venta.count({
      where: { createdAt: crearFiltroFecha("hoy") }
    });

    const ventasMes = await Venta.count({
      where: { createdAt: crearFiltroFecha("mes") }
    });

    const ventasUltimos = await Venta.findAll({
      attributes: [
        [Sequelize.fn("DATE", Sequelize.col("createdAt")), "fecha"],
        [Sequelize.fn("COUNT", Sequelize.col("id")), "total"]
      ],
      where: { createdAt: filtroFecha },
      group: ["fecha"],
      order: [["fecha", "ASC"]]
    });

    // =============================================================
    // ENTREGAS
    // =============================================================
    const entregasHoy = await Entrega.count({
      where: { createdAt: crearFiltroFecha("hoy") }
    });

    const entregasMes = await Entrega.count({
      where: { createdAt: crearFiltroFecha("mes") }
    });

    const entregasUltimos = await Entrega.findAll({
      attributes: [
        [Sequelize.fn("DATE", Sequelize.col("createdAt")), "fecha"],
        [Sequelize.fn("COUNT", Sequelize.col("id")), "total"]
      ],
      where: { createdAt: filtroFecha },
      group: ["fecha"],
      order: [["fecha", "ASC"]]
    });

    // =============================================================
    // RESPUESTA
    // =============================================================
    res.json({
      ventas: {
        hoy: ventasHoy,
        mes: ventasMes,
        rango: ventasUltimos
      },
      entregas: {
        hoy: entregasHoy,
        mes: entregasMes,
        rango: entregasUltimos
      }
    });

  } catch (error) {
    console.error("Error en /dashboard/resumen:", error);
    res.status(500).json({ error: "Error obteniendo el resumen" });
  }
});


module.exports = router;
