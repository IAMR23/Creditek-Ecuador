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

const { Op } = require("sequelize");
const DetalleVenta = require("../../models/DetalleVenta");
const { sequelize } = require("../../config/db");
const VentaObsequio = require("../../models/VentaObsequio");

exports.obtenerReporteAuditoria = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
  vendedorId,
}) => {
  const whereVenta = {};

  // 🔹 Filtro por fecha
  if (fechaInicio && fechaFin) {
    whereVenta.fecha = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    whereVenta.fecha = { [Op.gte]: new Date(`${fechaInicio}T00:00:00`) };
  } else if (fechaFin) {
    whereVenta.fecha = { [Op.lte]: new Date(`${fechaFin}T23:59:59`) };
  }

  const includeUsuarioAgencia = {
    model: UsuarioAgencia,
    as: "usuarioAgencia",
    attributes: ["id"],
    required: !!agenciaId || !!vendedorId, // INNER JOIN si hay filtro
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

  return await Venta.findAll({
    where: whereVenta,
    attributes: ["id", "fecha", "validada", "observacion", "activo"],
    order: [["fecha", "ASC"]],
    include: [
      includeUsuarioAgencia,
      {
        model: Cliente,
        as: "cliente",
        attributes: ["cedula", "cliente"],
      },
      {
        model: Origen,
        as: "origen",
        attributes: ["nombre"],
      },
      {
        model: DetalleVenta,
        as: "detalleVenta",
        attributes: [
          "precioUnitario",
          "precioVendedor",
          "entrada",
          "margen",
          "alcance",
          "contrato",
          "cierreCaja",
        ],
        include: [
          { model: Modelo, as: "modelo", attributes: ["nombre"] },
          {
            model: DispositivoMarca,
            as: "dispositivoMarca",
            attributes: ["id"],
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
        attributes: ["id"],
        include: [{ model: Obsequio, as: "obsequio", attributes: ["nombre"] }],
      },
    ],
  });
};

exports.obtenerReporte = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
  vendedorId,
  observacion,
}) => {
  /* ===============================
     WHERE VENTA
  =============================== */
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

  /* ===============================
     INCLUDE USUARIO-AGENCIA
  =============================== */
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
  return await Venta.findAll({
    where: whereVenta,
    attributes: ["id", "fecha", "validada", "observacion", "activo"],
    order: [["fecha", "ASC"]],
    include: [
      includeUsuarioAgencia,
      {
        model: Cliente,
        as: "cliente",
        attributes: ["cliente"],
      },
      {
        model: Origen,
        as: "origen",
        attributes: ["nombre"],
      },
      {
        model: DetalleVenta,
        as: "detalleVenta",
        attributes: [
          "precioUnitario",
          "precioVendedor",
          "entrada",
          "margen",
          "costo" ,
          "alcance",
          "contrato",
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
};

exports.obtenerReporteGerencia = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
  vendedorId,
  cierreCaja,
}) => {
  const whereVenta = {
    activo: true,
  };

  if (fechaInicio && fechaFin) {
    whereVenta.fecha = {
      [Op.between]: [
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`),
      ],
    };
  } else if (fechaInicio) {
    whereVenta.fecha = { [Op.gte]: new Date(`${fechaInicio}T00:00:00`) };
  } else if (fechaFin) {
    whereVenta.fecha = { [Op.lte]: new Date(`${fechaFin}T23:59:59`) };
  }

  const whereDetalleVenta = {};

  if (cierreCaja && cierreCaja !== "todos") {
    whereDetalleVenta.cierreCaja = cierreCaja;
  }

  const agenciasIds = normalizarIds(agenciaId);
  const vendedoresIds = normalizarIds(vendedorId);

  const includeUsuarioAgencia = {
    model: UsuarioAgencia,
    as: "usuarioAgencia",
    attributes: ["id"],
    required: !!agenciasIds || !!vendedoresIds,
    include: [
      {
        model: Usuario,
        as: "usuario",
        attributes: ["id", "nombre"],
        ...(vendedoresIds && {
          where: {
            id: {
              [Op.in]: vendedoresIds,
            },
          },
        }),
      },
      {
        model: Agencia,
        as: "agencia",
        attributes: ["id", "nombre"],
        ...(agenciasIds && {
          where: {
            id: {
              [Op.in]: agenciasIds,
            },
          },
        }),
      },
    ],
  };

  return await Venta.findAll({
    where: whereVenta,
    attributes: ["id", "fecha", "validada", "observacion", "activo", "semana"],
    order: [["fecha", "ASC"]],
    include: [
      includeUsuarioAgencia,
      {
        model: Cliente,
        as: "cliente",
        attributes: ["cliente"],
      },
      {
        model: Origen,
        as: "origen",
        attributes: ["nombre"],
      },
      {
        model: DetalleVenta,
        as: "detalleVenta",
        attributes: [
          "precioUnitario",
          "precioVendedor",
          "entrada",
          "alcance",
          "contrato",
          "cierreCaja",
          "margen",
        ],
        ...(Object.keys(whereDetalleVenta).length > 0 && {
          where: whereDetalleVenta,
          required: true,
        }),
        include: [
          { model: Modelo, as: "modelo", attributes: ["nombre"] },
          {
            model: DispositivoMarca,
            as: "dispositivoMarca",
            attributes: ["id"],
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
        attributes: ["id"],
        include: [{ model: Obsequio, as: "obsequio", attributes: ["nombre"] }],
      },
    ],
  });
};

const normalizarIds = (valor) => {
  if (!valor || valor === "todas" || valor === "todos") return null;

  if (Array.isArray(valor)) {
    return valor.map(Number).filter(Boolean);
  }

  return String(valor)
    .split(",")
    .map(Number)
    .filter(Boolean);
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
  // console.log(ventas)
  const filas = [];

  ventas.forEach((venta) => {
    venta.detalleVenta?.forEach((detalle) => {
      const fechaISO = venta.fecha
        ? new Date(venta.fecha).toISOString().split("T")[0]
        : "";

      filas.push({
        id: venta.id,
        activo: venta.activo,
        semana: venta.semana || null,
        dia: obtenerDiaSemana(new Date(venta.fecha)),
        valorAcumulado: null,

        fecha: fechaISO,

        local: venta.usuarioAgencia?.agencia?.nombre || "",
        origen: venta.origen?.nombre || "",
        nombre: venta.cliente?.cliente || "",
        cedula: venta.cliente?.cedula || "",

        vendedor: venta.usuarioAgencia?.usuario?.nombre || "",

        tipo: detalle.dispositivoMarca?.dispositivo?.nombre || "",
        marca: detalle.dispositivoMarca?.marca?.nombre || "",
        modelo: detalle.modelo?.nombre || "",
        formaPago: detalle.formaPago?.nombre || "",
        valorCorregido: detalle.precioUnitario || "",
        precioSistema: detalle.precioUnitario || "",
        precioVendedor: detalle.precioVendedor || "",
        margen: detalle.margen || "",
        costo : detalle.costo || "" , 

        cierreCaja: detalle.cierreCaja || "",

        entrada: detalle.entrada || "0",
        alcance: detalle.alcance || "0",

        observaciones: venta.observacion || "",
        contrato: detalle.contrato || "",
        validada: venta.validada || "",
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

      // 2️⃣ Actualizar detalles de venta
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
              { transaction: t },
            );
          }
        }
      }

      // 3️⃣ Actualizar obsequios de venta
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
              { transaction: t },
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
          attributes: ["id", "cliente", "cedula", "telefono"],
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
      },
      origen: { id: venta.origen?.id, nombre: venta.origen?.nombre },
      detalleVenta: venta.detalleVenta || [],
      obsequiosVenta: venta.obsequiosVenta || [],
    };

    return res.json({ ok: true, venta: ventaFormateada });
  } catch (error) {
    console.error("Error obteniendo venta por ID:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};
