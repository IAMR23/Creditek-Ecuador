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
const { sequelize } = require("../../config/db");


exports.obtenerReporte = async ({ id, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;

  // Filtro por vendedor
  const usuarioAgenciaWhere = id ? { usuarioId: id } : {};

  const entregas = await Entrega.findAndCountAll({
    limit,
    offset,
    order: [["createdAt", "DESC"]], // 🔥 más recientes primero
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

  // Cambiar de 'entregas.forEach' a 'entregas.rows.forEach'
  entregas.rows.forEach((entrega) => {
    // Crear un string con los obsequios
    const obsequios =
      entrega.obsequiosEntrega
        ?.map((o) => `${o.obsequio?.nombre || ""} x${o.cantidad || 1}`)
        .join(", ") || "";

    // Corregido: detalleEntregas (plural)
    entrega.detalleEntregas?.forEach((detalle) => {
      const fechaISO = entrega.fecha
        ? new Date(entrega.fecha).toISOString().split("T")[0]
        : "";

      filas.push({
        id: entrega.id,
        fecha: fechaISO,
        dia: obtenerDiaSemana(entrega.fecha),
        local: entrega.usuarioAgencia?.agencia?.nombre || "",
        vendedor: entrega.usuarioAgencia?.usuario?.nombre || "",
        cliente: entrega.cliente?.cliente || "",
        origen: entrega.origen?.nombre || "",
        tipo: detalle.dispositivoMarca?.dispositivo?.nombre || "",
        marca: detalle.dispositivoMarca?.marca?.nombre || "",
        modelo: detalle.modelo?.nombre || "",
        formaPago: detalle.formaPago?.nombre || "",
        precioUnitario: detalle.precioUnitario || "",
        entrada: detalle.entrada || "0",
        alcance: detalle.alcance || "0",
        contrato: detalle.contrato || "",
        observaciones: entrega.observacion || "",
        obsequios: obsequios,
        cierreCaja: entrega.validada ? "Sí" : "No",
        estado: entrega.estado || "",
        observacionLogistica:
          entrega.observacionLogistica || "Sin observaciones",
      });
    });
  });

  return filas;
};


exports.obtenerEntregaPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const entrega = await Entrega.findByPk(id, {
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
          attributes: ["id", "cliente", "cedula", "telefono"],
        },
        {
          model: Origen,
          as: "origen",
          attributes: ["id", "nombre"],
        },

        {
          model: DetalleEntrega,
          as: "detalleEntregas",
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
          model: EntregaObsequio,
          as: "obsequiosEntrega",
          include: [
            { model: Obsequio, as: "obsequio", attributes: ["id", "nombre"] },
          ],
        },
      ],
    });

    if (!entrega) {
      return res.status(404).json({ ok: false, msg: "Entrega no encontrada" });
    }

    const entregaFormateada = {
      id: entrega.id,
      fecha: entrega.fecha,
      dia: entrega.dia,
      local: entrega.local,
      vendedor: entrega.vendedor,
      contrato: entrega.contrato,
      entrada: entrega.entrada,
      alcance: entrega.alcance,
      pvp: entrega.pvp,
      fotoFechaLlamada: entrega.fotoFechaLlamada,
      FechaHoraLlamada: entrega.FechaHoraLlamada
        ? entrega.FechaHoraLlamada.toLocaleString("sv-SE", {
            timeZone: "America/Guayaquil",
          }).replace("T", " ")
        : null,

      fotoValidacion: entrega.fotoValidacion,
      validada: entrega.validada,
      estado: entrega.estado,
      observacionLogistica: entrega.observacionLogistica,
      observacion : entrega.observacion,

      usuarioAgencia: {
        id: entrega.usuarioAgencia?.id,
        usuario: {
          id: entrega.usuarioAgencia?.usuario?.id,
          nombre: entrega.usuarioAgencia?.usuario?.nombre,
        },
        agencia: {
          id: entrega.usuarioAgencia?.agencia?.id,
          nombre: entrega.usuarioAgencia?.agencia?.nombre,
        },
      },

      cliente: {
        id: entrega.cliente?.id,
        nombre: entrega.cliente?.cliente,
        cedula: entrega.cliente?.cedula,
        telefono: entrega.cliente?.telefono,
      },

      origen: {
        id: entrega.origen?.id,
        nombre: entrega.origen?.nombre,
      },

      detalleEntrega: entrega.detalleEntregas || [],
      obsequiosEntrega: entrega.obsequiosEntrega || [],
    };

    return res.json({ ok: true, entrega: entregaFormateada });
  } catch (error) {
    console.error("Error obteniendo entrega por ID:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};
