const { sequelize } = require("../../config/db");

const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const Denominacion = require("../../models/CierreCaja/Denominacion");
const RetiroCaja = require("../../models/CierreCaja/RetiroCaja");
const { Op } = require("sequelize");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Usuario = require("../../models/Usuario");
const Agencia = require("../../models/Agencia");

const cerrarCaja = async (req, res) => {
  const t = await sequelize.transaction();
  const fechaCierre = new Date();
  try {
    const usuarioAgenciaId = req.user.usuarioAgenciaId;
    const { cierre, denominaciones, retiros, movimientosPendientes } = req.body;

    const esMovimientoValido = (m) => {
      return (
        m &&
        typeof m.detalle === "string" &&
        m.detalle.trim() !== "" &&
        Number(m.valor) > 0 &&
        typeof m.formaPago === "string" &&
        m.formaPago.trim() !== ""
      );
    };

    const normalizarMovimiento = (m) => ({
      responsable: m.responsable || "",
      detalle: m.detalle || "",
      entidad: m.entidad || null,
      valor: Number(m.valor) || 0,
      formaPago: m.formaPago || null,
      recibo:
        m.recibo !== null && m.recibo !== undefined && m.recibo !== ""
          ? Number(m.recibo)
          : null,
      observacion: m.observacion || "",
    });

    const crearKeyMovimiento = (m) => {
      return [
        m.responsable || "",
        m.detalle || "",
        m.entidad || "",
        Number(m.valor) || 0,
        m.formaPago || "",
        m.recibo ?? "",
        m.observacion || "",
      ].join("|");
    };

    // 1. Obtener movimientos temporales
    const movimientosTemp = await MovimientoCajaTemp.findAll({
      where: { usuarioAgenciaId },
      transaction: t,
    });

    // 2. Normalizar y filtrar temporales válidos
    const movimientosTempPlain = movimientosTemp
      .map((m) =>
        normalizarMovimiento({
          responsable: m.responsable,
          detalle: m.detalle,
          entidad: m.entidad,
          valor: m.valor,
          formaPago: m.formaPago,
          recibo: m.recibo,
          observacion: m.observacion,
        }),
      )
      .filter(esMovimientoValido);

    // 3. Normalizar y filtrar movimientos pendientes del frontend
    const movimientosFrontend = (movimientosPendientes || [])
      .map(normalizarMovimiento)
      .filter(esMovimientoValido);

    // 4. Evitar duplicados entre temporales y frontend
    const keysTemp = new Set(movimientosTempPlain.map(crearKeyMovimiento));

    const movimientosFrontendUnicos = movimientosFrontend.filter(
      (m) => !keysTemp.has(crearKeyMovimiento(m)),
    );

    // 5. Unificar
    const movimientosUnificados = [
      ...movimientosTempPlain,
      ...movimientosFrontendUnicos,
    ];

    if (!movimientosUnificados.length) {
      await t.rollback();
      return res.status(400).json({
        message: "No existen movimientos válidos para cerrar caja",
      });
    }

    // 6. Calcular totales
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    let totalPendiente = 0;

    movimientosUnificados.forEach((m) => {
      const valor = Number(m.valor) || 0;

      if (m.formaPago === "EFECTIVO") totalEfectivo += valor;
      if (m.formaPago === "TRANSFERENCIA") totalTransferencia += valor;
      if (m.formaPago === "PENDIENTE") totalPendiente += valor;
    });

    const totalSistema = totalEfectivo + totalTransferencia + totalPendiente;

    // 7. Calcular total físico
    let totalFisico = 0;

    (denominaciones || []).forEach((d) => {
      totalFisico += (Number(d.denominacion) || 0) * (Number(d.cantidad) || 0);
    });

    // 8. Diferencia
    const diferencia = totalFisico - totalEfectivo;
    const estado = diferencia === 0 ? "CUADRADO" : "DESCUADRADO";

    // 9. Crear cierre
    const cierreCreado = await CierreCaja.create(
      {
        fecha: fechaCierre,
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
      { transaction: t },
    );

    const cierreId = cierreCreado.id;

    // 10. Guardar denominaciones
    if (Array.isArray(denominaciones) && denominaciones.length) {
      const dataDenominaciones = denominaciones
        .filter((d) => Number(d.cantidad) > 0)
        .map((d) => ({
          cierreId,
          valor: Number(d.denominacion),
          cantidad: Number(d.cantidad),
        }));

      if (dataDenominaciones.length) {
        await Denominacion.bulkCreate(dataDenominaciones, { transaction: t });
      }
    }

    // 11. Guardar retiros
    if (Array.isArray(retiros) && retiros.length) {
      const dataRetiros = retiros
        .filter(
          (r) =>
            Number(r.monto) > 0 ||
            (r.motivo && r.motivo.trim() !== "") ||
            (r.autorizadoPor && r.autorizadoPor.trim() !== ""),
        )
        .map((r) => ({
          cierreId,
          monto: Number(r.monto) || 0,
          motivo: r.motivo || "",
          autorizadoPor: r.autorizadoPor || "",
        }));

      if (dataRetiros.length) {
        await RetiroCaja.bulkCreate(dataRetiros, { transaction: t });
      }
    }

    // 12. Guardar movimientos definitivos
    const movimientosFinales = movimientosUnificados.map((m) => ({
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

    // 13. Limpiar temporales del usuario/agencia
    await MovimientoCajaTemp.destroy({
      where: { usuarioAgenciaId },
      transaction: t,
    });

    await t.commit();

    return res.status(200).json({
      message: "Caja cerrada correctamente",
      cierre: cierreCreado,
      totalMovimientos: movimientosFinales.length,
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

const obtenerCierreCajaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const cierre = await CierreCaja.findByPk(id);

    if (!cierre) {
      return res.status(404).json({
        message: "Cierre de caja no encontrado",
      });
    }

    const [denominaciones, retiros, movimientos] = await Promise.all([
      Denominacion.findAll({
        where: { cierreId: id },
        order: [["valor", "DESC"]],
      }),
      RetiroCaja.findAll({
        where: { cierreId: id },
        order: [["id", "ASC"]],
      }),
      MovimientoCaja.findAll({
        where: { cierreId: id },
        order: [["id", "ASC"]],
      }),
    ]);

    const resumenPorTipo = {
      cuotaEfectivo: 0,
      cuotaTransferencia: 0,
      contadoEfectivo: 0,
      contadoTransferencia: 0,
      entradaEfectivo: 0,
      entradaTransferencia: 0,
      entradaPendiente: 0,
      alcanceEfectivo: 0,
      alcanceTransferencia: 0,
    };

    movimientos.forEach((m) => {
      const detalle = (m.detalle || "").trim().toUpperCase();
      const formaPago = (m.formaPago || "").trim().toUpperCase();
      const valor = Number(m.valor) || 0;

      if (detalle === "CUOTA") {
        if (formaPago === "EFECTIVO") {
          resumenPorTipo.cuotaEfectivo += valor;
        }
        if (formaPago === "TRANSFERENCIA") {
          resumenPorTipo.cuotaTransferencia += valor;
        }
      }

      if (detalle === "CONTADO") {
        if (formaPago === "EFECTIVO") {
          resumenPorTipo.contadoEfectivo += valor;
        }
        if (formaPago === "TRANSFERENCIA") {
          resumenPorTipo.contadoTransferencia += valor;
        }
      }

      if (detalle === "ENTRADA") {
        if (formaPago === "EFECTIVO") {
          resumenPorTipo.entradaEfectivo += valor;
        }
        if (formaPago === "TRANSFERENCIA") {
          resumenPorTipo.entradaTransferencia += valor;
        }
        if (formaPago === "PENDIENTE") {
          resumenPorTipo.entradaPendiente += valor;
        }
      }

      if (detalle === "ALCANCE") {
        if (formaPago === "EFECTIVO") {
          resumenPorTipo.alcanceEfectivo += valor;
        }
        if (formaPago === "TRANSFERENCIA") {
          resumenPorTipo.alcanceTransferencia += valor;
        }
      }
    });

    return res.status(200).json({
      message: "Cierre obtenido correctamente",
      data: {
        cierre,
        denominaciones,
        retiros,
        movimientos,
        resumenPorTipo,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al obtener el cierre de caja",
      error: error.message,
    });
  }
};

const obtenerTodosLosCierresCaja = async (req, res) => {
  try {

     const { fechaInicio, fechaFin, agenciaId } = req.query;
    const where = {};

    // 🔹 Filtro por fecha
    if (fechaInicio && fechaFin) {
      where.fecha = {
        [Op.between]: [
          new Date(`${fechaInicio}T00:00:00`),
          new Date(`${fechaFin}T23:59:59`),
        ],
      };
    } else if (fechaInicio) {
      where.fecha = { [Op.gte]: new Date(`${fechaInicio}T00:00:00`) };
    } else if (fechaFin) {
      where.fecha = { [Op.lte]: new Date(`${fechaFin}T23:59:59`) };
    }

    
    const cierres = await CierreCaja.findAll({
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          attributes: ["id"],
          required: !!agenciaId,
          include: [
            {
              model: Usuario,
              as: "usuario",
              attributes: ["id", "nombre"],
            },
            {
              model: Agencia,
              as: "agencia",
              attributes: ["id", "nombre"],
              ...(agenciaId &&
                agenciaId !== "todas" && {
                  where: { id: agenciaId },
                }),
            },
          ],
        },
      ],
      order: [["id", "DESC"]],
    });

    if (!cierres.length) {
      return res.status(200).json({
        message: "No existen cierres de caja",
        data: [],
      });
    }

    const cierreIds = cierres.map((c) => c.id);

    const [denominaciones, retiros, movimientos] = await Promise.all([
      Denominacion.findAll({
        where: {
          cierreId: {
            [Op.in]: cierreIds,
          },
        },
        order: [["valor", "DESC"]],
      }),
      RetiroCaja.findAll({
        where: {
          cierreId: {
            [Op.in]: cierreIds,
          },
        },
        order: [["id", "ASC"]],
      }),
      MovimientoCaja.findAll({
        where: {
          cierreId: {
            [Op.in]: cierreIds,
          },
        },
        order: [["id", "ASC"]],
      }),
    ]);

    const denominacionesPorCierre = {};
    const retirosPorCierre = {};
    const movimientosPorCierre = {};

    for (const d of denominaciones) {
      if (!denominacionesPorCierre[d.cierreId]) {
        denominacionesPorCierre[d.cierreId] = [];
      }
      denominacionesPorCierre[d.cierreId].push(d);
    }

    for (const r of retiros) {
      if (!retirosPorCierre[r.cierreId]) {
        retirosPorCierre[r.cierreId] = [];
      }
      retirosPorCierre[r.cierreId].push(r);
    }

    for (const m of movimientos) {
      if (!movimientosPorCierre[m.cierreId]) {
        movimientosPorCierre[m.cierreId] = [];
      }
      movimientosPorCierre[m.cierreId].push(m);
    }

    const data = cierres.map((cierre) => {
      const movimientosCierre = movimientosPorCierre[cierre.id] || [];

      const resumenPorTipo = {
        cuotaEfectivo: 0,
        cuotaTransferencia: 0,
        contadoEfectivo: 0,
        contadoTransferencia: 0,
        entradaEfectivo: 0,
        entradaTransferencia: 0,
        entradaPendiente: 0,
        alcanceEfectivo: 0,
        alcanceTransferencia: 0,
      };

      movimientosCierre.forEach((m) => {
        const detalle = (m.detalle || "").trim().toUpperCase();
        const formaPago = (m.formaPago || "").trim().toUpperCase();
        const valor = Number(m.valor) || 0;

        if (detalle === "CUOTA") {
          if (formaPago === "EFECTIVO") {
            resumenPorTipo.cuotaEfectivo += valor;
          }
          if (formaPago === "TRANSFERENCIA") {
            resumenPorTipo.cuotaTransferencia += valor;
          }
        }

        if (detalle === "CONTADO") {
          if (formaPago === "EFECTIVO") {
            resumenPorTipo.contadoEfectivo += valor;
          }
          if (formaPago === "TRANSFERENCIA") {
            resumenPorTipo.contadoTransferencia += valor;
          }
        }

        if (detalle === "ENTRADA") {
          if (formaPago === "EFECTIVO") {
            resumenPorTipo.entradaEfectivo += valor;
          }
          if (formaPago === "TRANSFERENCIA") {
            resumenPorTipo.entradaTransferencia += valor;
          }
          if (formaPago === "PENDIENTE") {
            resumenPorTipo.entradaPendiente += valor;
          }
        }

        if (detalle === "ALCANCE") {
          if (formaPago === "EFECTIVO") {
            resumenPorTipo.alcanceEfectivo += valor;
          }
          if (formaPago === "TRANSFERENCIA") {
            resumenPorTipo.alcanceTransferencia += valor;
          }
        }
      });

      return {
        cierre,
        denominaciones: denominacionesPorCierre[cierre.id] || [],
        retiros: retirosPorCierre[cierre.id] || [],
        movimientos: movimientosCierre,
        resumenPorTipo,
      };
    });

    return res.status(200).json({
      message: "Cierres obtenidos correctamente",
      total: data.length,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al obtener los cierres de caja",
      error: error.message,
    });
  }
};

module.exports = {
  cerrarCaja,
  obtenerCierreCajaPorId,
  obtenerTodosLosCierresCaja,
};
