const Agencia = require("../../models/Agencia");
const Cliente = require("../../models/Cliente");
const DetalleVenta = require("../../models/DetalleVenta");
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
const VentaObsequio = require("../../models/VentaObsequio");

const { Op } = require("sequelize");

exports.obtenerReporte = async ({ fechaInicio, fechaFin }) => {
  const where = {};

  if (fechaInicio && fechaFin) {
    where.createdAt = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    where.createdAt = {
      [Op.gte]: new Date(`${fechaInicio}T00:00:00`),
    };
  } else if (fechaFin) {
    where.createdAt = {
      [Op.lte]: new Date(`${fechaFin}T23:59:59`),
    };
  }

  const ventas = await Venta.findAll({
    where,
    include: [
      {
        model: UsuarioAgencia,
        as: "usuarioAgencia",
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

const obtenerDiaSemana = (fechaISO) => {
  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];
  return dias[new Date(fechaISO).getDay()];
};

exports.formatearReporte = (ventas) => {
  const filas = [];

  ventas.forEach((venta) => {
    venta.detalleVenta.forEach((detalle) => {
      // Convertir fecha a YYYY-MM-DD sin errores
      const fechaISO = venta.createdAt
        ? new Date(venta.createdAt).toISOString().split("T")[0]
        : "";

      filas.push({
        semana: null, // si luego quieres semana ISO lo agrego
        dia: obtenerDiaSemana(venta.createdAt),
        valorAcumulado: null,

        fecha: fechaISO,

        local: venta.usuarioAgencia?.agencia?.nombre || "",
        origen: venta.origen?.nombre || "",
        nombre: venta.cliente?.cliente || "",

        vendedor: venta.usuarioAgencia?.usuario?.nombre || "",

        tipo: detalle.dispositivoMarca?.dispositivo?.nombre || "",
        marca: detalle.dispositivoMarca?.marca?.nombre || "",
        modelo: detalle.modelo?.nombre || "",
        formaPago: detalle.formaPago?.nombre || "", 
        valorCorregido: detalle.precioUnitario || "",
        pvp: detalle.precioUnitario || "",
        margen: null,

        cierreCaja: venta.validada || "",

        entrada: detalle.entrada || "0",
        alcance: detalle.alcance || "0",

        observaciones: venta.observacion || "",
        contrato: detalle.contrato || "",
      });
    });
  });

  return filas;
};


