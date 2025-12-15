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
const Entrega = require("../../models/Entrega");
const EntregaObsequio = require("../../models/EntregaObsequio");

const { Op } = require("sequelize");
const DetalleEntrega = require("../../models/DetalleEntrega");

exports.obtenerReporte = async ({ fechaInicio, fechaFin }) => {
  const where = {
    estado: "Entregado",
  };

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

  const entregas = await Entrega.findAll({
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
      { model: Cliente, as: "cliente", attributes: ["cliente", "cedula"] },
      { model: Origen, as: "origen", attributes: ["nombre"] },
      {
        model: DetalleEntrega,
        as: "detalleEntregas",
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
        model: EntregaObsequio,
        as: "obsequiosEntrega",
        include: [{ model: Obsequio, as: "obsequio", attributes: ["nombre"] }],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  return entregas;
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

exports.formatearReporte = (entregas) => {
  const filas = [];

  entregas.forEach((entrega) => {
    entrega.detalleEntregas?.forEach((detalle) => {
      const fechaISO = entrega.createdAt
        ? new Date(entrega.createdAt).toISOString().split("T")[0]
        : "";

      filas.push({
        id: entrega.id,
        dia: obtenerDiaSemana(entrega.createdAt),
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
        estado: entrega.estado || "",
      });
    });
  });

  return filas;
};
