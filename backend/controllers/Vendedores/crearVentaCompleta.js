const Cliente = require("../../models/Cliente");
const Venta = require("../../models/Venta");
const DetalleVenta = require("../../models/DetalleVenta");
const VentaObsequio = require("../../models/VentaObsequio");
const { sequelize } = require("../../config/db");
const { validarCedulaEC } = require("../../middleware/validacionCedula");
const DispositivoMarca = require("../../models/DispositivoMarca");
const Modelo = require("../../models/Modelo");

const crearVentaCompleta = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 🔥 JSON viene stringeado
    const { cliente, venta, detalle, obsequios } = JSON.parse(req.body.data);

    /*     if (!validarCedulaEC(cliente.cedula)) {
      await t.rollback();
      return res.status(400).json({
        ok: false,
        message: "Cédula inválida según validación oficial del Ecuador",
      });
    } */

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
          correo: cliente.correo,
          direccion: cliente.direccion,
        },
        { transaction: t },
      );
    } else {
      await clienteDB.update(
        {
          telefono: cliente.telefono,
          correo: cliente.correo,
          direccion: cliente.direccion ,
        },
        { transaction: t },
      );
    }

    // 2️⃣ Venta
    const ventaDB = await Venta.create(
      {
        usuarioAgenciaId: venta.usuarioAgenciaId,
        clienteId: clienteDB.id,
        origenId: venta.origenId,
        observacion: venta.observacion,
        fecha: venta.fecha,
        validada: true,
        fotoValidacion: fotoUrl,
      },
      { transaction: t },
    );

    // 🔹 Obtener el dispositivo (TV o CELULAR) desde dispositivoMarcas
    const dispositivoMarca = await DispositivoMarca.findByPk(
      detalle.dispositivoMarcaId,
      { transaction: t },
    );

    if (!dispositivoMarca) {
      throw new Error("DispositivoMarca no existe");
    }

    const dispositivoId = dispositivoMarca.dispositivoId;
    // 🔹 Calcular cierreCaj  a
    let cierreCaja = "CONTADO"; // valor por defecto
    if (detalle.formaPagoId === 1) {
      // crédito
      if (dispositivoId === 1) {
        cierreCaja = "CREDITV";
      } else if (dispositivoId === 2) {
        cierreCaja = "UPHONE";
      }
    }

    // 🔹 Obtener modelo y PVP1
    const modeloDB = await Modelo.findByPk(detalle.modeloId, {
      attributes: ["id", "PVP1"],
      transaction: t,
    });

    if (!modeloDB) {
      throw new Error("Modelo no existe");
    }


    const pvp1 = modeloDB.PVP1;

    const margen = Number((detalle.precioVendedor  + detalle.alcance - pvp1).toFixed(2));

    // 3️⃣ Detalle
    const detalleDB = await DetalleVenta.create(  
      {
        ventaId: ventaDB.id,
        cantidad: detalle.cantidad,
        precioUnitario: detalle.precioUnitario,
        precioVendedor: detalle.precioVendedor,
        margen: margen,
        dispositivoMarcaId: detalle.dispositivoMarcaId,
        modeloId: detalle.modeloId,
        formaPagoId: detalle.formaPagoId,
        cierreCaja: cierreCaja,
        entrada: detalle.entrada,
        alcance: detalle.alcance,
        contrato: detalle.contrato,
        observacionDetalle: detalle.observacionDetalle,
      },
      { transaction: t },
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
          { transaction: t },
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
