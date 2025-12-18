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
const Entrega = require("../../models/Entrega");
const EntregaObsequio = require("../../models/EntregaObsequio");

const { Op } = require("sequelize");
const { fn, col, where: whereFn } = require("sequelize");

const DetalleEntrega = require("../../models/DetalleEntrega");

const obtenerEntregas = async ({ fechaInicio, fechaFin }) => {
  const where = {
    estado: "Entregado",
  };

  if (fechaInicio && fechaFin) {
    where[Op.and] = [
      whereFn(fn("DATE", col("fecha")), {
        [Op.between]: [fechaInicio, fechaFin],
      }),
    ];
  }

return Entrega.findAll({
  where,
  include: [
    {
      model: UsuarioAgencia,
      as: "usuarioAgencia",
      include: [
        { model: Usuario, as: "usuario", attributes: ["nombre"] },
        { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
      ],
    },
    { model: Cliente, as: "cliente" },
    {
      model: DetalleEntrega,
      as: "detalleEntregas",
      include: [
        {
          model: DispositivoMarca,
          as: "dispositivoMarca",
          include: [
            { model: Dispositivo, as: "dispositivo" },
            { model: Marca, as: "marca" },
          ],
        },
        { model: Modelo, as: "modelo" },
        { model: FormaPago, as: "formaPago" },
      ],
    },
  ],
  order: [["fecha", "ASC"]],
  subQuery: false,
});

};

const obtenerVentas = async ({ fechaInicio, fechaFin, agenciaId }) => {
  const where = {
    activo: true,
  };

  if (fechaInicio && fechaFin) {
    where[Op.and] = [
      whereFn(fn("DATE", col("fecha")), {
        [Op.between]: [fechaInicio, fechaFin],
      }),
    ];
  }

  if (agenciaId) {
    where["$usuarioAgencia.agencia.id$"] = agenciaId;
  }


  return Venta.findAll({
  where,
  include: [
    {
      model: UsuarioAgencia,
      as: "usuarioAgencia",
      include: [
        { model: Usuario, as: "usuario", attributes: ["nombre"] },
        { model: Agencia, as: "agencia", attributes: ["id", "nombre"] },
      ],
    },
    { model: Cliente, as: "cliente" },
    { model: Origen, as: "origen" },
    {
      model: DetalleVenta,
      as: "detalleVenta",
      include: [
        {
          model: DispositivoMarca,
          as: "dispositivoMarca",
          include: [
            { model: Dispositivo, as: "dispositivo" },
            { model: Marca, as: "marca" },
          ],
        },
        { model: Modelo, as: "modelo" },
        { model: FormaPago, as: "formaPago" },
      ],
    },
  ],
  order: [["fecha", "ASC"]],
  subQuery: false,
});


};

const normalizarFila = ({
  item,
  detalle,
  tipo, // "VENTA" | "ENTREGA"
}) => {
  const fechaISO = item.fecha
    ? new Date(item.fecha).toISOString().split("T")[0]
    : "";

  return {
    tipoRegistro: tipo, // 🔥 CLAVE
    id: item.id,
    dia: obtenerDiaSemana(item.fecha),
    fecha: fechaISO,

    local: item.usuarioAgencia?.agencia?.nombre || "",
    origen: item.origen?.nombre || "",
    nombre: item.cliente?.cliente || "",
    vendedor: item.usuarioAgencia?.usuario?.nombre || "",

    tipoProducto: detalle.dispositivoMarca?.dispositivo?.nombre || "",
    marca: detalle.dispositivoMarca?.marca?.nombre || "",
    modelo: detalle.modelo?.nombre || "",
    formaPago: detalle.formaPago?.nombre || "",

    valor: detalle.precioUnitario || "",
    pvp: detalle.precioUnitario || "",
    precioVendedor : detalle.precioVendedor || "",
    margen: null,

    cierreCaja: item.validada ?? item.estado ?? "",
    entrada: detalle.entrada || "0",
    alcance: detalle.alcance || "0",

    observaciones: item.observacion || "SN",
    contrato: detalle.contrato || "",
    estado: item.estado || (item.validada ? "Validada" : ""),
  };
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

exports.obtenerReporteGeneral = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
}) => {
  const filtrosFecha = {};

  const where = {};

  if (fechaInicio && fechaFin) {
    where[Op.and] = [
      whereFn(fn("DATE", col("fecha")), {
        [Op.between]: [fechaInicio, fechaFin],
      }),
    ];
  }

  if (agenciaId) {
    filtrosFecha["$usuarioAgencia.agencia.id$"] = agenciaId;
  }

  const [ventas, entregas] = await Promise.all([
    obtenerVentas({ fechaInicio, fechaFin, agenciaId }),
    obtenerEntregas({ fechaInicio, fechaFin }),
  ]);
  const filas = [];

  ventas.forEach((venta) => {
    venta.detalleVenta.forEach((detalle) => {
      filas.push(
        normalizarFila({
          item: venta,
          detalle,
          tipo: "VENTA",
        })
      );
    });
  });

  entregas.forEach((entrega) => {
    entrega.detalleEntregas.forEach((detalle) => {
      filas.push(
        normalizarFila({
          item: entrega,
          detalle,
          tipo: "ENTREGA",
        })
      );
    });
  });

  filas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  return filas;
};
