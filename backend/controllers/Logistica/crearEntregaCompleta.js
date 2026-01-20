const Cliente = require("../../models/Cliente");
const { sequelize } = require("../../config/db");
const { validarCedulaEC } = require("../../middleware/validacionCedula");
const DispositivoMarca = require("../../models/DispositivoMarca");
const Entrega = require("../../models/Entrega");
const DetalleEntrega = require("../../models/DetalleEntrega");
const EntregaObsequio = require("../../models/EntregaObsequio");

const crearEntregaCompleta = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 🔥 JSON viene stringeado
    const { cliente, entrega, detalle, obsequios } = JSON.parse(req.body.data);

    if (!validarCedulaEC(cliente.cedula)) {
      await t.rollback();
      return res.status(400).json({
        ok: false,
        message: "Cédula inválida según validación oficial del Ecuador",
      });
    }

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
          cliente: cliente.cliente,
          telefono: cliente.telefono,
          correo: cliente.correo,
          direccion: cliente.direccion,
        },
        { transaction: t },
      );
    }

    const entregaDB = await Entrega.create(
      {
        usuarioAgenciaId: entrega.usuarioAgenciaId,
        clienteId: clienteDB.id,
        origenId: entrega.origenId,
        observacion: entrega.observacion,
        fecha: entrega.fecha,
        FechaHoraLlamada : entrega.FechaHoraLlamada,
        validada: true,
        estado  :entrega.estado,
        fotoFechaLlamada: fotoUrl,
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

    // 3️⃣ Detalle
    const detalleDB = await DetalleEntrega.create(
      {
        entregaId: entregaDB.id,
        cantidad: detalle.cantidad,
        precioUnitario: detalle.precioUnitario,
        precioVendedor: detalle.precioVendedor,
        dispositivoMarcaId: detalle.dispositivoMarcaId,
        modeloId: detalle.modeloId,
        formaPagoId: detalle.formaPagoId,
        cierreCaja: cierreCaja,
        entrada: detalle.entrada,
        alcance: detalle.alcance,
        contrato: detalle.contrato,
        observacionDetalle: detalle.observacionDetalle,
        ubicacion: detalle.ubicacion,
        ubicacionDispositivo: detalle.ubicacionDispositivo,
      },
      { transaction: t },
    );

    // 4️⃣ Obsequios
    if (obsequios?.length) {
      for (const obs of obsequios) {
        await EntregaObsequio.create(
          {
            entregaId: entregaDB.id,
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
      message: "Entrega creada y validada correctamente",
      cliente: clienteDB,
      entrega: entregaDB,
      detalle: detalleDB,
      obsequios,
    });
  } catch (error) {
    await t.rollback();
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "Error al crear la entrega completa",
      error: error.message,
    });
  }
};

module.exports = { crearEntregaCompleta };
