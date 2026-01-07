const Agencia = require("../../models/Agencia");
const Cliente = require("../../models/Cliente");
const Dispositivo = require("../../models/Dispositivo");
const DispositivoMarca = require("../../models/DispositivoMarca");
const FormaPago = require("../../models/FormaPago");
const Marca = require("../../models/Marca");
const Modelo = require("../../models/Modelo");
const Obsequio = require("../../models/Obsequio");
const Origen = require("../../models/Origen");
const Usuario = require("../../models/Usuario");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Venta = require("../../models/Venta");
const EntregaObsequio = require("../../models/EntregaObsequio");

const { Op } = require("sequelize");
const DetalleVenta = require("../../models/DetalleVenta");
const { sequelize } = require("../../config/db");
const VentaObsequio = require("../../models/VentaObsequio");

exports.obtenerReporte = async ({ id, fechaInicio, fechaFin }) => {
  const where = {};

  // Filtrado por fechas
  if (fechaInicio && fechaFin) {
    where.fecha = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    where.fecha = {
      [Op.gte]: new Date(`${fechaInicio}T00:00:00`),
    };
  } else if (fechaFin) {
    where.fecha = {
      [Op.lte]: new Date(`${fechaFin}T23:59:59`),
    };
  }

  // Filtrado por id del vendedor
  const usuarioAgenciaWhere = id ? { usuarioId: id } : {};

  const ventas = await Venta.findAll({
    where,
    order: [["fecha", "DESC"]],
    include: [
      {
        model: UsuarioAgencia,
        as: "usuarioAgencia",
        where: usuarioAgenciaWhere,
        include: [
          { model: Usuario, as: "usuario", attributes: ["nombre"] },
          { model: Agencia, as: "agencia", attributes: ["nombre"] },
        ],
      },
      { model: Cliente, as: "cliente", attributes: ["cliente"] },
      { model: Origen, as: "origen", attributes: ["nombre"] },
      {
        model: DetalleVenta,
        as: "detalleVenta",
        include: [
          { model: Modelo, as: "modelo", attributes: ["nombre"] },
          {
            model: DispositivoMarca,
            as: "dispositivoMarca",
            include: [
              { model: Dispositivo, as: "dispositivo", attributes: ["nombre"] },
              { model: Marca, as: "marca", attributes: ["nombre"] },
            ],
          },
          { model: FormaPago, as: "formaPago", attributes: ["nombre"] },
        ],
      },
      {
        model: VentaObsequio,
        as: "obsequiosVenta",
        include: [{ model: Obsequio, as: "obsequio", attributes: ["nombre"] }],
      },
    ],
  });

  return ventas;
};


const obtenerDiaSemana = (fecha) => {
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];

  const d = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate()
  );

  return dias[d.getDay()];
};


exports.formatearReporte = (ventas) => {
  const filas = [];

  ventas.forEach((entrega) => {
    entrega.detalleVenta?.forEach((detalle) => {
      const fechaISO = entrega.fecha
        ? entrega.fecha.toISOString().slice(0, 10)
        : "";

      filas.push({
        id: entrega.id,
        semana: null,
        dia: obtenerDiaSemana(entrega.fecha),
        valorAcumulado: null,

        fecha: fechaISO,

        local: entrega.usuarioAgencia?.agencia?.nombre || "",
        origen: entrega.origen?.nombre || "",
        nombre: entrega.cliente?.cliente || "",

        vendedor: entrega.usuarioAgencia?.usuario?.nombre || "",

        tipo: detalle.dispositivoMarca?.dispositivo?.nombre || "",
        marca: detalle.dispositivoMarca?.marca?.nombre || "",
        modelo: detalle.modelo?.nombre || "",
        formaPago: detalle.formaPago?.nombre || "",
        valorCorregido: detalle.precioUnitario || "",
        pvp: detalle.precioUnitario || "",
        
        margen: null,

        cierreCaja: entrega.validada || "",

        entrada: detalle.entrada || "0",
        alcance: detalle.alcance || "0",

        observaciones: entrega.observacion || "",
        contrato: detalle.contrato || "",
        validada: entrega.validada || "",
      });
    });
  });

  return filas;
};

exports.actualizarVentaCompleta = async (req, res) => {
  const { id } = req.params; // id de la venta
  const datosVenta = req.body; // objeto completo con relaciones

  try {
    await sequelize.transaction(async (t) => {
      // 1️⃣ Actualizar datos principales de la venta
      const venta = await Venta.findByPk(id, { transaction: t });
      if (!venta)
        return res.status(404).json({ ok: false, msg: "Venta no encontrada" });

      await venta.update(datosVenta, { transaction: t });

      // 2️⃣ Actualizar detalles de entrega
      if (datosVenta.detalleVentas && datosVenta.detalleVentas.length > 0) {
        for (const detalle of datosVenta.detalleVentas) {
          if (detalle.id) {
            // actualizar si ya existe
            await DetalleVenta.update(detalle, {
              where: { id: detalle.id },
              transaction: t,
            });
          } else {
            // crear si no existe
            await DetalleVenta.create(
              { ...detalle, entregaId: id },
              { transaction: t }
            );
          }
        }
      }

      // 3️⃣ Actualizar obsequios de entrega
      if (datosVenta.obsequiosVenta && datosVenta.obsequiosVenta.length > 0) {
        for (const obsequio of datosVenta.obsequiosVenta) {
          if (obsequio.id) {
            await VentaObsequio.update(obsequio, {
              where: { id: obsequio.id },
              transaction: t,
            });
          } else {
            await VentaObsequio.create(
              { ...obsequio, entregaId: id },
              { transaction: t }
            );
          }
        }
      }
    });

    res.json({ ok: true, msg: "Venta actualizada correctamente" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ ok: false, msg: "Error al actualizar la venta", error });
  }
};

exports.obtenerVentaPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const venta = await Venta.findByPk(id, {
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          include: [
            { model: Usuario, as: "usuario", attributes: ["id", "nombre"] },
            { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
          ],
        },
        {
          model: Cliente,
          as: "cliente",
          attributes: ["id", "cliente", "cedula", "telefono" ,"correo" , "direccion"],
        },
        { model: Origen, as: "origen", attributes: ["id", "nombre"] },
        {
          model: DetalleVenta,
          as: "detalleVenta",
          include: [
            { model: Modelo, as: "modelo", attributes: ["id", "nombre"] },
            {
              model: DispositivoMarca,
              as: "dispositivoMarca",
              include: [
                {
                  model: Dispositivo,
                  as: "dispositivo",
                  attributes: ["id", "nombre"],
                },
                { model: Marca, as: "marca", attributes: ["id", "nombre"] },
              ],
            },
            { model: FormaPago, as: "formaPago", attributes: ["id", "nombre"] },
          ],
        },
        {
          model: VentaObsequio,
          as: "obsequiosVenta",
          include: [
            { model: Obsequio, as: "obsequio", attributes: ["id", "nombre"] },
          ],
        },
      ],
    });

    if (!venta) {
      return res.status(404).json({ ok: false, msg: "Venta no encontrada" });
    }

    // Formateamos para el frontend
    const ventaFormateada = {
      id: venta.id,
      fecha: venta.fecha,
      dia: venta.dia,
      local: venta.local,
      vendedor: venta.vendedor,
      contrato: venta.contrato,
      entrada: venta.entrada,
      alcance: venta.alcance,
      pvp: venta.pvp,
      observacion: venta.observacion,
      validada: venta.validada,
      fotoValidacion: venta.fotoValidacion,
      usuarioAgencia: {
        id: venta.usuarioAgencia?.id,
        usuario: {
          id: venta.usuarioAgencia?.usuario?.id,
          nombre: venta.usuarioAgencia?.usuario?.nombre,
        },
        agencia: {
          id: venta.usuarioAgencia?.agencia?.id,
          nombre: venta.usuarioAgencia?.agencia?.nombre,
        },
      },
      cliente: {
        id: venta.cliente?.id,
        nombre: venta.cliente?.cliente, // atención: en tu include pusiste "cliente" como atributo
        cedula: venta.cliente?.cedula,
        telefono: venta.cliente?.telefono,
        correo: venta.cliente?.correo,
        direccion: venta.cliente?.direccion,
      },
      origen: { id: venta.origen?.id, nombre: venta.origen?.nombre },
      detalleVenta: venta.detalleVenta || [],
      obsequiosVenta: venta.obsequiosVenta || [],
    };

    return res.json({ ok: true, venta });
  } catch (error) {
    console.error("Error obteniendo venta por ID:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};
