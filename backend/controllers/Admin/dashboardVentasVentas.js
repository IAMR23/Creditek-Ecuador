const { Op } = require("sequelize");
const Entrega = require("../../models/Entrega");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Agencia = require("../../models/Agencia");
const Usuario = require("../../models/Usuario");
const Cliente = require("../../models/Cliente");
const Origen = require("../../models/Origen");
const DetalleEntrega = require("../../models/DetalleEntrega");
const Modelo = require("../../models/Modelo");
const DispositivoMarca = require("../../models/DispositivoMarca");
const Dispositivo = require("../../models/Dispositivo");
const Marca = require("../../models/Marca");
const FormaPago = require("../../models/FormaPago");
const EntregaObsequio = require("../../models/EntregaObsequio");
const VentaObsequio = require("../../models/VentaObsequio");
const Obsequio = require("../../models/Obsequio");
const Venta = require("../../models/Venta");
const DetalleVenta = require("../../models/DetalleVenta");

exports.getVentasCompletas = async ({
  fechaInicio,
  fechaFin,
  agenciaId,
  usuarioId,
}) => {
  try {
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        message: "Debes enviar fechaInicio y fechaFin en los query params",
      });
    }

    fechaInicio = new Date(fechaInicio);
    fechaFin = new Date(fechaFin);
    fechaFin.setHours(23, 59, 59, 999);

    // ------------------- INCLUDE USUARIO AGENCIA -------------------
    const buildIncludeUsuarioAgencia = () => ({
      model: UsuarioAgencia,
      as: "usuarioAgencia",
      required: !!(usuarioId || agenciaId), // inner join si hay filtro
      where: {}, // se completará según filtros
      include: [
        {
          model: Usuario,
          as: "usuario",
          attributes: ["id", "nombre"],
          ...(usuarioId && { where: { id: usuarioId } }),
        },
        {
          model: Agencia,
          as: "agencia",
          attributes: ["id", "nombre"],
          ...(agenciaId && { where: { id: agenciaId } }),
        },
      ],
    });

    // ------------------- VENTAS DESDE ENTREGAS -------------------
    const ventasDesdeEntregas = await Entrega.findAll({
      where: {
        estado: "Entregado",
        fecha: { [Op.between]: [fechaInicio, fechaFin] },
      },
      include: [
        buildIncludeUsuarioAgencia(),
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

    const ventasEntregasMapeadas = ventasDesdeEntregas.map((v) => ({
      ...v.toJSON(),
      tipo: "Entrega",
    }));

    // ------------------- VENTAS DESDE VENTAS -------------------
    const ventasDesdeVentas = await Venta.findAll({
      where: {
        activo: true,
        fecha: { [Op.between]: [fechaInicio, fechaFin] },
      },
      include: [
        buildIncludeUsuarioAgencia(),
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
          model: VentaObsequio,
          as: "obsequiosVenta",
          include: [
            { model: Obsequio, as: "obsequio", attributes: ["nombre"] },
          ],
        },
      ],
    });

    const ventasVentasMapeadas = ventasDesdeVentas.map((v) => ({
      ...v.toJSON(),
      tipo: "Venta",
    }));

    const todasLasVentas = [...ventasEntregasMapeadas, ...ventasVentasMapeadas];

    return todasLasVentas;
  } catch (error) {
    console.error("Error en getVentasCompletas: ", error);
    throw new Error("Error en el servidor");
  }
};

exports.contarPorAgenciaDetalle = (ventas) => {
  const contador = {};

  ventas.forEach((v) => {
    const agencia = v.usuarioAgencia?.agencia?.nombre || "Sin Agencia";

    const detalles =
      v.detalleVenta?.length ||
      v.detalleEntregas?.length ||
      0;

    contador[agencia] = (contador[agencia] || 0) + detalles;
  });

  return contador;
};


exports.contarPorUsuarioDetalle = (ventas) => {
  const contador = {};

  ventas.forEach((v) => {
    const user = v.usuarioAgencia?.usuario;
    if (!user) return;

    const detalles =
      v.detalleVenta?.length ||
      v.detalleEntregas?.length ||
      0;

    if (!contador[user.id]) {
      contador[user.id] = {
        usuarioId: user.id,
        nombre: user.nombre,
        total: 0,
      };
    }

    contador[user.id].total += detalles;
  });

  return Object.values(contador);
};


exports.contarPorUsuarioDetalle = (ventas) => {
  const contador = {};

  ventas.forEach((v) => {
    const user = v.usuarioAgencia?.usuario;
    if (!user) return;

    const detalles =
      v.detalleVenta?.length ||
      v.detalleEntregas?.length ||
      0;

    if (!contador[user.id]) {
      contador[user.id] = {
        usuarioId: user.id,
        nombre: user.nombre,
        total: 0,
      };
    }

    contador[user.id].total += detalles;
  });

  return Object.values(contador);
};
