const { Op, fn, col, literal, Transaction } = require("sequelize");
const { sequelize } = require("../config/db");
const Registro = require("../models/LogisticaCombustibleRegistro");
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const {
  esAdministrador,
  esRepartidor,
  errorCombustible,
  validarDecimal,
  validarFecha,
  validarId,
  validarRegistro,
} = require("../utils/logisticaCombustible");

const comprobarAcceso = (user) => {
  if (esRepartidor(user)) return;
  const permisos = (user?.permisos || []).map((valor) =>
    String(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase(),
  );
  if (
    esAdministrador(user) &&
    permisos.some((p) => ["logistica", "administracion"].includes(p))
  )
    return;
  throw errorCombustible(
    403,
    "No tienes acceso a los registros de combustible.",
  );
};

const alcance = (user) => {
  comprobarAcceso(user);
  return esRepartidor(user) ? { userId: validarId(user.id, "Usuario") } : {};
};

const filtros = (user, query = {}) => {
  const where = alcance(user);
  const presente = (valor) => valor !== undefined && valor !== "";
  if (presente(query.userId)) {
    const userId = validarId(query.userId, "Repartidor");
    if (esRepartidor(user) && userId !== Number(user.id)) {
      throw errorCombustible(
        403,
        "Solo puedes consultar tus propios registros.",
      );
    }
    where.userId = userId;
  }
  if (presente(query.desde) || presente(query.hasta)) {
    where.fecha = {};
    if (presente(query.desde))
      where.fecha[Op.gte] = validarFecha(query.desde, "Fecha desde");
    if (presente(query.hasta))
      where.fecha[Op.lte] = validarFecha(query.hasta, "Fecha hasta");
    if (query.desde && query.hasta && query.desde > query.hasta) {
      throw errorCombustible(
        400,
        "La fecha desde no puede ser posterior a la fecha hasta.",
      );
    }
  }
  if (presente(query.kmMin) || presente(query.kmMax)) {
    where.kilometrosRecorridos = {};
    if (presente(query.kmMin))
      where.kilometrosRecorridos[Op.gte] = validarDecimal(
        query.kmMin,
        "Kilómetros mínimos",
      );
    if (presente(query.kmMax))
      where.kilometrosRecorridos[Op.lte] = validarDecimal(
        query.kmMax,
        "Kilómetros máximos",
      );
    if (
      presente(query.kmMin) &&
      presente(query.kmMax) &&
      Number(query.kmMin) > Number(query.kmMax)
    ) {
      throw errorCombustible(
        400,
        "El kilometraje mínimo no puede superar al máximo.",
      );
    }
  }
  return where;
};

const incluirRepartidor = [
  { model: Usuario, as: "repartidor", attributes: ["id", "nombre"] },
];
const medidas = ["kilometrosRecorridos", "costoCombustible"];
const ceros = () => Object.fromEntries(medidas.map((campo) => [campo, 0]));
const sumar = (destino, origen) =>
  medidas.forEach((campo) => {
    destino[campo] =
      (Math.round(destino[campo] * 100) +
        Math.round(Number(origen[campo]) * 100)) /
      100;
  });

const listar = async ({ user, query = {} }) => {
  const where = filtros(user, query);
  const pagina = validarId(query.pagina ?? 1, "Página");
  const limite = validarId(query.limite ?? 20, "Límite");
  if (limite > 100)
    throw errorCombustible(400, "El límite máximo es 100 registros.");
  // Tabla, totales y gráficas comparten filtros y una misma instantánea de datos.
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
    async (transaction) => {
      const { rows, count } = await Registro.findAndCountAll({
        where,
        attributes: { exclude: ["combustibleConsumido"] },
        include: incluirRepartidor,
        order: [
          ["fecha", "DESC"],
          ["id", "DESC"],
        ],
        limit: limite,
        offset: (pagina - 1) * limite,
        transaction,
      });
      const agrupados = await Registro.findAll({
        where,
        attributes: [
          "fecha",
          "userId",
          ...medidas.map((campo) => [fn("SUM", col(campo)), campo]),
        ],
        group: ["fecha", "userId"],
        order: [
          ["fecha", "ASC"],
          ["userId", "ASC"],
        ],
        raw: true,
        transaction,
      });
      const totales = ceros();
      const fechas = new Map();
      const porRepartidor = agrupados.map((fila) => {
        const registro = {
          ...fila,
          ...Object.fromEntries(
            medidas.map((campo) => [campo, Number(fila[campo])]),
          ),
        };
        sumar(totales, registro);
        if (!fechas.has(fila.fecha))
          fechas.set(fila.fecha, { fecha: fila.fecha, ...ceros() });
        sumar(fechas.get(fila.fecha), registro);
        return registro;
      });
      return {
        registros: rows,
        totales,
        porFecha: [...fechas.values()],
        porRepartidor,
        paginacion: {
          pagina,
          limite,
          total: count,
          paginas: Math.max(1, Math.ceil(count / limite)),
        },
      };
    },
  );
};

const obtener = async ({ user, id }) => {
  const registro = await Registro.findOne({
    where: { ...alcance(user), id: validarId(id) },
    attributes: { exclude: ["combustibleConsumido"] },
    include: incluirRepartidor,
  });
  if (!registro)
    throw errorCombustible(
      404,
      "El registro no existe o no está disponible para tu usuario.",
    );
  return registro;
};

const crear = async ({ user, data }) => {
  comprobarAcceso(user);
  if (!esRepartidor(user))
    throw errorCombustible(
      403,
      "Solo un repartidor puede registrar combustible.",
    );
  if (
    data?.userId !== undefined &&
    validarId(data.userId, "Usuario") !== Number(user.id)
  ) {
    throw errorCombustible(
      403,
      "No puedes registrar combustible para otro repartidor.",
    );
  }
  return Registro.create({
    ...validarRegistro(data),
    userId: validarId(user.id, "Usuario"),
  });
};

const actualizar = async ({ user, id, data }) => {
  comprobarAcceso(user);
  if (!esRepartidor(user))
    throw errorCombustible(
      403,
      "Solo un repartidor puede editar sus registros.",
    );
  const registro = await obtener({ user, id });
  if (
    data?.userId !== undefined &&
    validarId(data.userId, "Usuario") !== Number(user.id)
  ) {
    throw errorCombustible(
      403,
      "No puedes cambiar el repartidor del registro.",
    );
  }
  await registro.update(validarRegistro(data));
  return registro;
};

const eliminar = async ({ user, id }) => {
  const registro = await obtener({ user, id });
  await registro.destroy(); // Baja lógica: se conserva el historial en la base.
};

const repartidores = async ({ user }) => {
  comprobarAcceso(user);
  if (!esAdministrador(user))
    throw errorCombustible(403, "Esta consulta requiere un administrador.");
  return Usuario.findAll({
    attributes: ["id", "nombre"],
    include: [{ model: Rol, as: "rol", attributes: [], required: false }],
    where: {
      [Op.or]: [
        sequelize.where(
          fn("LOWER", fn("TRIM", col("rol.nombre"))),
          "repartidor",
        ),
        // Conserva la posibilidad de filtrar datos históricos tras un cambio de rol.
        {
          id: {
            [Op.in]: literal(
              '(SELECT DISTINCT "userId" FROM logistica_combustible_registros WHERE "deletedAt" IS NULL)',
            ),
          },
        },
      ],
    },
    order: [
      ["nombre", "ASC"],
      ["id", "ASC"],
    ],
  });
};

module.exports = { listar, obtener, crear, actualizar, eliminar, repartidores };
