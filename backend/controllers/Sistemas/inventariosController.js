const { Op } = require("sequelize");
const Agencia = require("../../models/Agencia");
const InventarioSistema = require("../../models/InventarioSistema");
const Usuario = require("../../models/Usuario");
const { sequelize } = require("../../config/db");
const {
  DISPOSITIVOS,
  ESTADOS,
  resolverDispositivo,
  serializarInventario,
  validarInventario,
} = require("../../services/inventarioSistemasService");

const includeInventario = [
  { model: Agencia, as: "agencia", attributes: ["id", "nombre", "ciudad"] },
  { model: Usuario, as: "responsable", attributes: ["id", "nombre"] },
  { model: Usuario, as: "creadoPor", attributes: ["id", "nombre"] },
  { model: Usuario, as: "actualizadoPor", attributes: ["id", "nombre"] },
];

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const construirWhere = (query = {}) => {
  const where = { activo: true };
  const busqueda = String(query.q || query.busqueda || "").trim();

  if (busqueda) {
    where[Op.or] = ["nombre", "marca", "modelo"].map(
      (campo) => ({ [campo]: { [Op.iLike]: `%${busqueda}%` } }),
    );
  }

  if (Number(query.agenciaId) > 0) where.agenciaId = Number(query.agenciaId);
  if (Number(query.responsableId) > 0) {
    where.responsableId = Number(query.responsableId);
  }

  const estado = String(query.estado || "").trim().toUpperCase();
  if (ESTADOS.some((item) => item.value === estado)) where.estado = estado;

  const dispositivo = resolverDispositivo(query.dispositivo);
  if (dispositivo) where.nombre = dispositivo.label;

  return where;
};

const obtenerResumen = (registros) => {
  const responsables = new Set();
  const resumen = {
    items: 0,
    operativos: 0,
    mantenimiento: 0,
    fueraServicio: 0,
    responsables: 0,
  };

  registros.forEach((registro) => {
    const item = registro.get ? registro.get({ plain: true }) : registro;
    resumen.items += 1;
    if (item.estado === "OPERATIVO") resumen.operativos += 1;
    if (item.estado === "EN_MANTENIMIENTO") resumen.mantenimiento += 1;
    if (item.estado === "FUERA_DE_SERVICIO") resumen.fueraServicio += 1;
    if (item.responsableId) responsables.add(Number(item.responsableId));
  });

  resumen.responsables = responsables.size;
  return resumen;
};

const findInventario = (id, options = {}) =>
  InventarioSistema.findOne({
    where: { id, activo: true },
    include: includeInventario,
    ...options,
  });

const validarReferencias = async ({ agenciaId, responsableId }, options = {}) => {
  const [agencia, responsable] = await Promise.all([
    Agencia.findOne({
      where: { id: agenciaId, activo: true },
      attributes: ["id"],
      ...options,
    }),
    Usuario.findOne({
      where: { id: responsableId, activo: true },
      attributes: ["id"],
      ...options,
    }),
  ]);

  if (!agencia) return "La agencia seleccionada no existe o esta inactiva";
  if (!responsable) return "La persona responsable no existe o esta inactiva";
  return null;
};

exports.listar = async (req, res) => {
  try {
    const pagina = parsePositiveInt(req.query.pagina || req.query.page, 1);
    const limite = parsePositiveInt(req.query.limite || req.query.limit, 24, 100);
    const where = construirWhere(req.query);

    const [{ rows, count }, registrosResumen] = await Promise.all([
      InventarioSistema.findAndCountAll({
        where,
        include: includeInventario,
        distinct: true,
        limit: limite,
        offset: (pagina - 1) * limite,
        order: [["updatedAt", "DESC"], ["nombre", "ASC"]],
      }),
      InventarioSistema.findAll({
        where,
        attributes: ["estado", "responsableId"],
      }),
    ]);

    return res.json({
      ok: true,
      inventarios: rows.map(serializarInventario),
      resumen: obtenerResumen(registrosResumen),
      paginacion: {
        pagina,
        limite,
        total: count,
        totalPaginas: Math.max(1, Math.ceil(count / limite)),
      },
    });
  } catch (error) {
    console.error("Error listando inventarios de sistemas:", error);
    return res.status(500).json({ ok: false, message: "No se pudo cargar el inventario" });
  }
};

exports.catalogos = async (_req, res) => {
  try {
    const [agencias, responsables] = await Promise.all([
      Agencia.findAll({
        where: { activo: true },
        attributes: ["id", "nombre", "ciudad"],
        order: [["nombre", "ASC"]],
      }),
      Usuario.findAll({
        where: { activo: true },
        attributes: ["id", "nombre"],
        order: [["nombre", "ASC"]],
      }),
    ]);

    return res.json({
      ok: true,
      agencias,
      responsables,
      dispositivos: DISPOSITIVOS,
      estados: ESTADOS,
    });
  } catch (error) {
    console.error("Error cargando catalogos de inventario:", error);
    return res.status(500).json({ ok: false, message: "No se pudieron cargar los catalogos" });
  }
};

exports.crear = async (req, res) => {
  try {
    const validacion = validarInventario(req.body);
    if (validacion.errores.length) {
      return res.status(400).json({ ok: false, message: validacion.errores[0], errores: validacion.errores });
    }

    const errorReferencias = await validarReferencias(validacion.data);
    if (errorReferencias) return res.status(400).json({ ok: false, message: errorReferencias });

    const creado = await InventarioSistema.create({
      ...validacion.data,
      creadoPorId: req.user?.id || null,
      actualizadoPorId: req.user?.id || null,
      activo: true,
    });
    const inventario = await findInventario(creado.id);

    return res.status(201).json({ ok: true, inventario: serializarInventario(inventario) });
  } catch (error) {
    console.error("Error creando inventario de sistemas:", error);
    return res.status(500).json({ ok: false, message: "No se pudo crear el inventario" });
  }
};

exports.guardarLote = async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const agenciaId = Number(req.body?.agenciaId);
  const responsableId = Number(req.body?.responsableId);

  if (items.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "Agrega al menos un dispositivo a la persona responsable",
    });
  }

  if (items.length > 50) {
    return res.status(400).json({
      ok: false,
      message: "Solo se pueden guardar hasta 50 dispositivos por asignación",
    });
  }

  const validaciones = items.map((item) =>
    validarInventario({
      ...item,
      agenciaId,
      responsableId,
    }),
  );
  const errores = validaciones.flatMap((validacion, index) =>
    validacion.errores.map((error) => `Ítem ${index + 1}: ${error}`),
  );

  if (errores.length > 0) {
    return res.status(400).json({
      ok: false,
      message: errores[0],
      errores,
    });
  }

  const idsEditados = items
    .map((item) => Number(item.id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (new Set(idsEditados).size !== idsEditados.length) {
    return res.status(400).json({
      ok: false,
      message: "No se puede guardar dos veces el mismo ítem",
    });
  }

  try {
    const idsGuardados = await sequelize.transaction(async (transaction) => {
      const errorReferencias = await validarReferencias(validaciones[0].data, {
        transaction,
      });

      if (errorReferencias) {
        const error = new Error(errorReferencias);
        error.status = 400;
        throw error;
      }

      const resultados = [];

      for (let index = 0; index < validaciones.length; index += 1) {
        const itemId = Number(items[index]?.id);
        const data = validaciones[index].data;

        if (Number.isInteger(itemId) && itemId > 0) {
          const inventario = await InventarioSistema.findOne({
            where: { id: itemId, activo: true },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!inventario) {
            const error = new Error(`El ítem ${index + 1} ya no existe`);
            error.status = 404;
            throw error;
          }

          await inventario.update(
            {
              ...data,
              actualizadoPorId: req.user?.id || null,
            },
            { transaction },
          );
          resultados.push(inventario.id);
          continue;
        }

        const creado = await InventarioSistema.create(
          {
            ...data,
            creadoPorId: req.user?.id || null,
            actualizadoPorId: req.user?.id || null,
            activo: true,
          },
          { transaction },
        );
        resultados.push(creado.id);
      }

      return resultados;
    });

    const inventarios = await InventarioSistema.findAll({
      where: { id: idsGuardados, activo: true },
      include: includeInventario,
      order: [["id", "ASC"]],
    });

    return res.status(idsEditados.length === items.length ? 200 : 201).json({
      ok: true,
      inventarios: inventarios.map(serializarInventario),
      total: inventarios.length,
    });
  } catch (error) {
    console.error("Error guardando asignación de inventario:", error);
    return res.status(error.status || 500).json({
      ok: false,
      message: error.status
        ? error.message
        : "No se pudo guardar la asignación de dispositivos",
    });
  }
};

exports.actualizar = async (req, res) => {
  try {
    const inventario = await findInventario(req.params.id);
    if (!inventario) {
      return res.status(404).json({ ok: false, message: "Inventario no encontrado" });
    }

    const validacion = validarInventario({
      ...inventario.get({ plain: true }),
      ...req.body,
    });
    if (validacion.errores.length) {
      return res.status(400).json({ ok: false, message: validacion.errores[0], errores: validacion.errores });
    }

    const errorReferencias = await validarReferencias(validacion.data);
    if (errorReferencias) return res.status(400).json({ ok: false, message: errorReferencias });

    await inventario.update({
      ...validacion.data,
      actualizadoPorId: req.user?.id || null,
    });
    const actualizado = await findInventario(inventario.id);

    return res.json({ ok: true, inventario: serializarInventario(actualizado) });
  } catch (error) {
    console.error("Error actualizando inventario de sistemas:", error);
    return res.status(500).json({ ok: false, message: "No se pudo actualizar el inventario" });
  }
};

exports.eliminar = async (req, res) => {
  try {
    const inventario = await findInventario(req.params.id);
    if (!inventario) {
      return res.status(404).json({ ok: false, message: "Inventario no encontrado" });
    }

    await inventario.update({
      activo: false,
      actualizadoPorId: req.user?.id || null,
    });

    return res.json({ ok: true, message: "Inventario desactivado correctamente" });
  } catch (error) {
    console.error("Error desactivando inventario de sistemas:", error);
    return res.status(500).json({ ok: false, message: "No se pudo desactivar el inventario" });
  }
};
