const Cliente = require("../../models/Cliente");
const Entrega = require("../../models/Entrega");
const { sequelize } = require("../../config/db");
const Modelo = require("../../models/Modelo");
const DispositivoMarca = require("../../models/DispositivoMarca");
const Dispositivo = require("../../models/Dispositivo");
const Marca = require("../../models/Marca");
const FormaPago = require("../../models/FormaPago");
const Obsequio = require("../../models/Obsequio");
const Origen = require("../../models/Origen");
const DetalleEntrega = require("../../models/DetalleEntrega");
const EntregaObsequio = require("../../models/EntregaObsequio");

const editarEntregaCompleta = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    // ✅ ID viene de la URL
    const { id } = req.params;

    // ✅ Data viene stringeada (multipart/form-data)
    const { cliente, entrega, detalle, obsequios } = JSON.parse(req.body.data);

    // ✅ Foto opcional
    const fotoUrl = req.file ? `/uploads/ventas/${req.file.filename}` : null;

    // 1️⃣ Buscar entrega
    const entregaDB = await Entrega.findByPk(id, { transaction: t });

    if (!entregaDB) {
      await t.rollback();
      return res.status(404).json({
        ok: false,
        message: "Entrega no encontrada",
      });
    }

    // 2️⃣ Cliente
    const clienteDB = await Cliente.findByPk(entregaDB.clienteId, {
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
        correo: cliente.correo,
        direccion: cliente.direccion,
      },
      { transaction: t }
    );

    // 3️⃣ Entrega
    await entregaDB.update(
      {
        origenId: entrega.origenId,
        observacion: entrega.observacion,
        fecha: entrega.fecha,
        FechaHoraLlamada: entrega.FechaHoraLlamada,
        ...(fotoUrl && { fotoFechaLlamada: fotoUrl }),
      },
      { transaction: t }
    );

    // 4️⃣ Detalle
    const detalleDB = await DetalleEntrega.findOne({
      where: { entregaId: id },
      transaction: t,
    });

    if (!detalleDB) {
      await t.rollback();
      return res.status(404).json({
        ok: false,
        message: "Detalle de entrega no encontrado",
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

    // 5️⃣ Obsequios (reset)
    await EntregaObsequio.destroy({
      where: { entregaId: id },
      transaction: t,
    });

    if (Array.isArray(obsequios) && obsequios.length > 0) {
      for (const obs of obsequios) {
        await EntregaObsequio.create(
          {
            entregaId: id,
            obsequioId: obs.obsequioId,
            cantidad: obs.cantidad || 1,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    return res.json({
      ok: true,
      message: "Entrega actualizada correctamente",
    });
  } catch (error) {
    await t.rollback();
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error al editar la entrega",
      error: error.message,
    });
  }
};


const obtenerEntregaCompleta = async (req, res) => {
  const { id } = req.params;

  try {
    const entrega = await Entrega.findOne({
      where: { id },
      include: [
        {
          model: Cliente,
          as: "cliente",
          attributes: ["cliente", "cedula", "telefono", "correo", "direccion"],
        },
        { model: Origen, as: "origen", attributes: ["id", "nombre"] },

        {
          model: DetalleEntrega,
          as: "detalleEntregas",
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
            "ubicacionDispositivo",
            "ubicacion",
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
          model: EntregaObsequio,
          as: "obsequiosEntrega",
          include: [
            { model: Obsequio, as: "obsequio", attributes: ["nombre"] },
          ],
        },
      ],
    });

    if (!entrega) {
      return res.status(404).json({ message: "Entrega no encontrada" });
    }

    res.json({
      cliente: entrega.cliente || { cliente: "", cedula: "", telefono: "" },
      entrega: {
        usuarioAgenciaId: entrega.usuarioAgenciaId,
        fotoFechaLlamada: entrega.fotoFechaLlamada || null,
        FechaHoraLlamada: entrega.FechaHoraLlamada || null,
        origenId: entrega.origenId,
        origen: entrega.origen || null,
        observacion: entrega.observacion,
        fecha: entrega.fecha,
        
      },
      detalle: entrega.detalleEntregas?.[0] || {
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
        ubicacion: "",
        ubicacionDispositivo: "",
      },
      obsequios: entrega.obsequiosEntrega || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener la entrega" });
  }
};

module.exports = { editarEntregaCompleta, obtenerEntregaCompleta };
