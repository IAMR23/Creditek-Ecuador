const Cliente = require("../../models/Cliente");
const Venta = require("../../models/Venta");
const DetalleVenta = require("../../models/DetalleVenta");
const VentaObsequio = require("../../models/VentaObsequio");
const { sequelize } = require("../../config/db");

const crearVentaCompleta = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    // 🔥 JSON viene stringeado
    const { cliente, venta, detalle, obsequios } = JSON.parse(req.body.data);

    // 🔥 FOTO
    const fotoUrl = req.file ? `/uploads/ventas/${req.file.filename}` : null;

    // 1️⃣ Cliente
    let clienteDB = await Cliente.findOne({
      where: { cedula: cliente.cedula },
      transaction: t,
    });

    if (!clienteDB) {
      clienteDB = await Cliente.create(
        {
          cliente: cliente.cliente,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
        },
        { transaction: t }
      );
    }

    // 2️⃣ Venta
    const ventaDB = await Venta.create(
      {
        usuarioAgenciaId: venta.usuarioAgenciaId,
        clienteId: clienteDB.id,
        origenId: venta.origenId,
        observacion: venta.observacion,
        fecha: venta.fecha ,
        validada: true,
        fotoValidacion: fotoUrl,
      },
      { transaction: t }
    );

    // 3️⃣ Detalle
    const detalleDB = await DetalleVenta.create(
      {
        ventaId: ventaDB.id,
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

    // 4️⃣ Obsequios
    if (obsequios?.length) {
      for (const obs of obsequios) {
        await VentaObsequio.create(
          {
            ventaId: ventaDB.id,
            obsequioId: obs.obsequioId,
            cantidad: obs.cantidad || 1,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    res.status(201).json({
      ok: true,
      message: "Venta creada y validada correctamente",
      cliente: clienteDB,
      venta: ventaDB,
      detalle: detalleDB,
      obsequios,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error al crear la venta completa",
      error: error.message,
    });
  }
};

module.exports = { crearVentaCompleta };
