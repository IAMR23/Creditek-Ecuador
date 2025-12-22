const Cliente = require("../../models/Cliente");
const Venta = require("../../models/Venta");
const DetalleVenta = require("../../models/DetalleVenta");
const VentaObsequio = require("../../models/VentaObsequio");
const { sequelize } = require("../../config/db");
const Modelo = require("../../models/Modelo");
const DispositivoMarca = require("../../models/DispositivoMarca");
const Dispositivo = require("../../models/Dispositivo");
const Marca = require("../../models/Marca");
const FormaPago = require("../../models/FormaPago");
const Obsequio = require("../../models/Obsequio");
const Origen = require("../../models/Origen");

const editarVentaCompleta = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    // 🔥 JSON stringeado
    const { ventaId, cliente, venta, detalle, obsequios } = JSON.parse(
      req.body.data
    );

    // 🔥 FOTO nueva (opcional)
    const fotoUrl = req.file ? `/uploads/ventas/${req.file.filename}` : null;

    // 1️⃣ Buscar venta existente
    const ventaDB = await Venta.findByPk(ventaId, { transaction: t });

    if (!ventaDB) {
      await t.rollback();
      return res.status(404).json({
        ok: false,
        message: "Venta no encontrada",
      });
    }

    // 2️⃣ Cliente (actualizar datos)
    const clienteDB = await Cliente.findByPk(ventaDB.clienteId, {
      transaction: t,
    });

    if (!clienteDB) {
      await t.rollback();
      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }

    await clienteDB.update(
      {
        cliente: cliente.cliente,
        cedula: cliente.cedula,
        telefono: cliente.telefono,
      },
      { transaction: t }
    );

    // 3️⃣ Venta
    await ventaDB.update(
      {
        origenId: venta.origenId,
        observacion: venta.observacion,
        fecha: venta.fecha,
        ...(fotoUrl && { fotoValidacion: fotoUrl }),
      },
      { transaction: t }
    );

    // 4️⃣ Detalle
    const detalleDB = await DetalleVenta.findOne({
      where: { ventaId },
      transaction: t,
    });

    if (!detalleDB) {
      await t.rollback();
      return res.status(404).json({
        ok: false,
        message: "Detalle de venta no encontrado",
      });
    }

    await detalleDB.update(
      {
        cantidad: detalle.cantidad,
        precioUnitario: detalle.precioUnitario,
        precioVendedor: detalle.precioVendedor,
        dispositivoMarcaId: detalle.dispositivoMarcaId,
        modeloId: detalle.modeloId,
        formaPagoId: detalle.formaPagoId,
        entrada: detalle.entrada,
        alcance: detalle.alcance,
        contrato: detalle.contrato,
        observacionDetalle: detalle.observacionDetalle,
      },
      { transaction: t }
    );

    // 5️⃣ Obsequios (borramos y recreamos)
    await VentaObsequio.destroy({
      where: { ventaId },
      transaction: t,
    });

    if (obsequios?.length) {
      for (const obs of obsequios) {
        await VentaObsequio.create(
          {
            ventaId,
            obsequioId: obs.obsequioId,
            cantidad: obs.cantidad || 1,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    res.json({
      ok: true,
      message: "Venta actualizada correctamente",
    });
  } catch (error) {
    await t.rollback();
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error al editar la venta",
      error: error.message,
    });
  }
};

const obtenerVentaCompleta = async (req, res) => {
  const { id } = req.params;

  try {
    const venta = await Venta.findOne({
      where: { id },
      include: [
        {
          model: Cliente,
          as: "cliente",
          attributes: ["cliente", "cedula", "telefono"],
        },
        { model: Origen, as: "origen", attributes: ["id", "nombre"] },

        {
          model: DetalleVenta,
          as: "detalleVenta",
          attributes: [
            "cantidad",
            "precioUnitario",
            "precioVendedor",
            "dispositivoMarcaId",
            "modeloId",
            "formaPagoId",
            "entrada",
            "alcance",
            "contrato",
            "observacionDetalle",
          ],
          include: [
            { model: Modelo, as: "modelo", attributes: ["nombre"] },
            {
              model: DispositivoMarca,
              as: "dispositivoMarca",
              include: [
                {
                  model: Dispositivo,
                  as: "dispositivo",
                  attributes: ["nombre"],
                },
                { model: Marca, as: "marca", attributes: ["nombre"] },
              ],
            },
            { model: FormaPago, as: "formaPago", attributes: ["nombre"] },
          ],
        },
        {
          model: VentaObsequio,
          as: "obsequiosVenta",
          include: [
            { model: Obsequio, as: "obsequio", attributes: ["nombre"] },
          ],
        },
      ],
    });

    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    res.json({
      cliente: venta.cliente || { cliente: "", cedula: "", telefono: "" },
      venta: {
        usuarioAgenciaId: venta.usuarioAgenciaId,
        origenId: venta.origenId,
        origen: venta.origen || null,
        observacion: venta.observacion,
        fecha: venta.fecha,
        fotoValidacion: venta.fotoValidacion || null,
      },
      detalle: venta.detalleVenta?.[0] || {
        cantidad: 1,
        precioUnitario: "",
        precioVendedor: "",
        dispositivoMarcaId: "",
        modeloId: "",
        contrato: "",
        formaPagoId: "",
        entrada: "",
        alcance: "",
        observacionDetalle: "",
      },
      obsequios: venta.obsequiosVenta || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener la venta" });
  }
};

module.exports = { editarVentaCompleta, obtenerVentaCompleta };
