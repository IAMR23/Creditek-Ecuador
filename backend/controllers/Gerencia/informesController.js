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
const CostoHistorico = require("../../models/CostoHistorico");

const { Op } = require("sequelize");
const DetalleVenta = require("../../models/DetalleVenta");
const { sequelize } = require("../../config/db");
const VentaObsequio = require("../../models/VentaObsequio");
const {
  normalizarFecha,
  seleccionarCostoHistorico,
} = require("../../utils/seleccionarCostoHistorico");

exports.obtenerReporte = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
  vendedorId,
  observacion,
  origenId,
}) => {

  const whereVenta = {
    activo: true,
  };

  // 🔹 Filtro por fecha
  if (fechaInicio && fechaFin) {
    whereVenta.fecha = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    whereVenta.fecha = {
      [Op.gte]: new Date(`${fechaInicio}T00:00:00`),
    };
  } else if (fechaFin) {
    whereVenta.fecha = {
      [Op.lte]: new Date(`${fechaFin}T23:59:59`),
    };
  }

  // 🔹 Filtro por observación (búsqueda parcial, compatible con datalist)
  if (observacion && observacion !== "todas") {
    whereVenta.observacion = {
      [Op.iLike]: `%${observacion}%`, // PostgreSQL
    };
  }

  // 🔹 Filtro por origen
if (origenId && origenId !== "todos") {
  whereVenta.origenId = origenId;
}

  const includeUsuarioAgencia = {
    model: UsuarioAgencia,
    as: "usuarioAgencia",
    attributes: ["id"],
    required: !!agenciaId || !!vendedorId,
    include: [
      {
        model: Usuario,
        as: "usuario",
        attributes: ["id", "nombre"],
        ...(vendedorId &&
          vendedorId !== "todos" && {
            where: { id: vendedorId },
          }),
      },
      {
        model: Agencia,
        as: "agencia",
        attributes: ["nombre"],
        ...(agenciaId &&
          agenciaId !== "todas" && {
            where: { id: agenciaId },
          }),
      },
    ],
  };

  /* ===============================
     QUERY FINAL
  =============================== */
  const ventas = await Venta.findAll({
    where: whereVenta,
    attributes: ["id", "fecha", "validada", "observacion", "activo"],
    order: [["fecha", "ASC"]],
    include: [
      includeUsuarioAgencia,
      {
        model: Cliente,
        as: "cliente",
        attributes: ["cliente", "cedula", "telefono" , "correo" , "direccion"],
      },
      {
        model: Origen,
        as: "origen",
        attributes: ["nombre"],
        ...(origenId &&
    origenId !== "todos" && {
      where: { id: origenId },
      required: true,
    }),
      },
      {
        model: DetalleVenta,
        as: "detalleVenta",
        attributes: [
          "precioVendedor",
          "modeloId",
          "cierreCaja",
        ],
        include: [
          {
            model: Modelo,
            as: "modelo",
            attributes: ["nombre"],
          },
          {
            model: DispositivoMarca,
            as: "dispositivoMarca",
            attributes: ["id"],
            include: [
              {
                model: Dispositivo,
                as: "dispositivo",
                attributes: ["nombre"],
              },
              {
                model: Marca,
                as: "marca",
                attributes: ["nombre"],
              },
            ],
          },
          {
            model: FormaPago,
            as: "formaPago",
            attributes: ["nombre"],
          },
        ],
      },
      {
        model: VentaObsequio,
        as: "obsequiosVenta",
        attributes: ["id"],
        include: [
          {
            model: Obsequio,
            as: "obsequio",
            attributes: ["nombre"],
          },
        ],
      },
    ],
  });

  const ventasReporte = ventas.map((venta) => venta.toJSON());
  const modeloIds = [
    ...new Set(
      ventasReporte.flatMap((venta) =>
        (venta.detalleVenta || [])
          .map((detalle) => Number(detalle.modeloId))
          .filter(Number.isInteger),
      ),
    ),
  ];

  if (!modeloIds.length) return ventasReporte;

  const costosHistoricos = await CostoHistorico.findAll({
    where: {
      modeloId: { [Op.in]: modeloIds },
      ...(fechaFin && { fechaCompra: { [Op.lte]: fechaFin } }),
    },
    attributes: ["id", "modeloId", "fechaCompra", "costo", "margenPorcentual"],
    order: [
      ["modeloId", "ASC"],
      ["fechaCompra", "DESC"],
      ["id", "DESC"],
    ],
    raw: true,
  });

  const costosPorModelo = new Map();
  costosHistoricos.forEach((costoHistorico) => {
    const modeloId = Number(costoHistorico.modeloId);
    const costos = costosPorModelo.get(modeloId) || [];
    costos.push(costoHistorico);
    costosPorModelo.set(modeloId, costos);
  });

  ventasReporte.forEach((venta) => {
    const fechaVenta = normalizarFecha(venta.fecha);

    (venta.detalleVenta || []).forEach((detalle) => {
      const historico = seleccionarCostoHistorico(
        costosPorModelo.get(Number(detalle.modeloId)) || [],
        fechaVenta,
      );

      detalle.costoHistoricoReporte = historico
        ? {
            costo: historico.costo,
            margenPorcentual: historico.margenPorcentual,
          }
        : null;
    });
  });

  return ventasReporte;
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

  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

  return dias[d.getDay()];
};

exports.formatearReporte = (ventas) => {
  const filas = [];

  ventas.forEach((venta) => {
    venta.detalleVenta?.forEach((detalle) => {
      const fechaISO = venta.fecha
        ? new Date(venta.fecha).toISOString().split("T")[0]
        : "";

      filas.push({
        id: venta.id,
        dia: obtenerDiaSemana(new Date(venta.fecha)),
        fecha: fechaISO,
        local: venta.usuarioAgencia?.agencia?.nombre || "",
        origen: venta.origen?.nombre || "",
        nombre: venta.cliente?.cliente || "",
        cedula: venta.cliente?.cedula || "",
        telefono: venta.cliente?.telefono || "",
        correo: venta.cliente?.correo || "",
        direccion: venta.cliente?.direccion || "",

        vendedor: venta.usuarioAgencia?.usuario?.nombre || "",

        tipo: detalle.dispositivoMarca?.dispositivo?.nombre || "",
        marca: detalle.dispositivoMarca?.marca?.nombre || "",
        modelo: detalle.modelo?.nombre || "",
        formaPago: detalle.formaPago?.nombre || "",
  
        precioVendedor: detalle.precioVendedor || "",
        costoProducto: detalle.costoHistoricoReporte?.costo ?? "",
        margenPorcentual:
          detalle.costoHistoricoReporte?.margenPorcentual ?? "",

        cierreCaja: detalle.cierreCaja || "",
        observaciones: venta.observacion || "",
      });
    });
  });

  return filas;
};

