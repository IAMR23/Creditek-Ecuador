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
const DetalleEntrega = require("../../models/DetalleEntrega");


const obtenerEntregas = async ({ fechaInicio, fechaFin }) => {
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
const obtenerVentas = async ({ fechaInicio, fechaFin, agenciaId }) => {
  const where = {
    validada : true , 
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

  // ----------- FILTRO POR AGENCIA -----------
  if (agenciaId) {
    where["$usuarioAgencia.agencia.id$"] = agenciaId;
  }

  const ventas = await Venta.findAll({
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
      { model: Cliente, as: "cliente", attributes: ["cliente" , "telefono" , "cedula"] },
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
    order: [["createdAt", "ASC"]], 
  });

  return ventas;
};

const normalizarFila = ({
  item,
  detalle,
  tipo, // "VENTA" | "ENTREGA"
}) => {
  const fechaISO = item.createdAt
    ? new Date(item.createdAt).toISOString().split("T")[0]
    : "";

  return {
    tipoRegistro: tipo, // 🔥 CLAVE
    id: item.id,
    dia: obtenerDiaSemana(item.createdAt),
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
    margen: null,

    cierreCaja: item.validada ?? item.estado ?? "",
    entrada: detalle.entrada || "0",
    alcance: detalle.alcance || "0",

    observaciones: item.observacion || "",
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

  if (fechaInicio && fechaFin) {
    filtrosFecha.createdAt = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  }

  if (agenciaId) {
    filtrosFecha["$usuarioAgencia.agencia.id$"] = agenciaId;
  }

  const [ventas, entregas] = await Promise.all([
    obtenerVentas(filtrosFecha),
    obtenerEntregas(filtrosFecha),
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

  filas.sort(
    (a, b) => new Date(a.fecha) - new Date(b.fecha)
  );

  return filas;
};
