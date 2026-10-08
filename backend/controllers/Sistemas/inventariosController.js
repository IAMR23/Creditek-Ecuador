const { Op } = require("sequelize");
const Agencia = require("../../models/Agencia");
const Dispositivo = require("../../models/Dispositivo");
const DispositivoMarca = require("../../models/DispositivoMarca");
const InventarioSistema = require("../../models/InventarioSistema");
const Marca = require("../../models/Marca");
const Modelo = require("../../models/Modelo");
const Usuario = require("../../models/Usuario");
const { sequelize } = require("../../config/db");
const {
  ESTADOS,
  obtenerResumenInventario,
  serializarInventario,
  validarInventario,
} = require("../../services/inventarioSistemasService");

const includeProducto = {
  model: DispositivoMarca,
  as: "dispositivoMarca",
  attributes: ["id", "dispositivoId", "marcaId"],
  include: [
    { model: Dispositivo, as: "dispositivo", attributes: ["id", "nombre"] },
    { model: Marca, as: "marca", attributes: ["id", "nombre"] },
  ],
};

const includeInventario = [
  { model: Agencia, as: "agencia", attributes: ["id", "nombre", "ciudad"] },
  { model: Usuario, as: "responsable", attributes: ["id", "nombre"] },
  { model: Usuario, as: "creadoPor", attributes: ["id", "nombre"] },
  { model: Usuario, as: "actualizadoPor", attributes: ["id", "nombre"] },
  includeProducto,
  { model: Modelo, as: "modeloCatalogo", attributes: ["id", "nombre"] },
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

  const dispositivo = String(query.dispositivo || "").trim();
  if (dispositivo) where.nombre = dispositivo;

  if (Number(query.modeloId) > 0) where.modeloId = Number(query.modeloId);
  if (Number(query.dispositivoMarcaId) > 0) {
    where.dispositivoMarcaId = Number(query.dispositivoMarcaId);
  }

  return where;
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

const resolverProductoCatalogo = async (
  { dispositivoMarcaId, modeloId },
  options = {},
) => {
  const relacionId = Number(dispositivoMarcaId);
  const productoModeloId = Number(modeloId);

  if (
    !Number.isInteger(relacionId) ||
    relacionId < 1 ||
    !Number.isInteger(productoModeloId) ||
    productoModeloId < 1
  ) {
    return { error: "El tipo, la marca y el modelo son obligatorios" };
  }

  const modelo = await Modelo.findOne({
    where: {
      id: productoModeloId,
      dispositivoMarcaId: relacionId,
      activo: true,
    },
    attributes: ["id", "nombre", "dispositivoMarcaId"],
    include: [
      {
        model: DispositivoMarca,
        as: "dispositivoMarca",
        where: { activo: true },
        required: true,
        attributes: ["id", "dispositivoId", "marcaId"],
        include: [
          {
            model: Dispositivo,
            as: "dispositivo",
            where: { activo: true },
            required: true,
            attributes: ["id", "nombre"],
          },
          {
            model: Marca,
            as: "marca",
            where: { activo: true },
            required: true,
            attributes: ["id", "nombre"],
          },
        ],
      },
    ],
    ...options,
  });

  if (!modelo) {
    return {
      error:
        "El modelo seleccionado no pertenece al tipo y marca indicados o está inactivo",
    };
  }

  return {
    data: {
      dispositivoMarcaId: modelo.dispositivoMarcaId,
      modeloId: modelo.id,
      nombre: modelo.dispositivoMarca.dispositivo.nombre,
      marca: modelo.dispositivoMarca.marca.nombre,
      modelo: modelo.nombre,
    },
  };
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
        order: [["fechaIngreso", "DESC"], ["updatedAt", "DESC"]],
      }),
      InventarioSistema.findAll({
        where,
        attributes: [
          "nombre",
          "estado",
          "responsableId",
          "cantidad",
          "dispositivoMarcaId",
        ],
        include: [includeProducto],
      }),
    ]);

    return res.json({
      ok: true,
      inventarios: rows.map(serializarInventario),
      resumen: obtenerResumenInventario(registrosResumen),
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
    const [agencias, responsables, relaciones, modelos] = await Promise.all([
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
      DispositivoMarca.findAll({
        where: { activo: true },
        attributes: ["id", "dispositivoId", "marcaId"],
        include: [
          {
            model: Dispositivo,
            as: "dispositivo",
            where: { activo: true },
            required: true,
            attributes: ["id", "nombre"],
          },
          {
            model: Marca,
            as: "marca",
            where: { activo: true },
            required: true,
            attributes: ["id", "nombre"],
          },
        ],
      }),
      Modelo.findAll({
        where: { activo: true },
        attributes: ["id", "nombre", "dispositivoMarcaId"],
        order: [["nombre", "ASC"]],
      }),
    ]);

    const relacionesActivas = relaciones.map((relacion) => ({
      id: relacion.id,
      dispositivoId: relacion.dispositivoId,
      marcaId: relacion.marcaId,
      dispositivo: relacion.dispositivo,
      marca: relacion.marca,
    }));
    const relacionesIds = new Set(relacionesActivas.map((item) => item.id));
    const dispositivosMap = new Map();
    relacionesActivas.forEach((relacion) => {
      dispositivosMap.set(relacion.dispositivo.id, {
        id: relacion.dispositivo.id,
        nombre: relacion.dispositivo.nombre,
        label: relacion.dispositivo.nombre,
        value: relacion.dispositivo.nombre,
      });
    });
    const dispositivos = Array.from(dispositivosMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    );

    return res.json({
      ok: true,
      agencias,
      responsables,
      dispositivos,
      dispositivoMarcas: relacionesActivas,
      modelos: modelos
        .filter((modelo) => relacionesIds.has(modelo.dispositivoMarcaId))
        .map((modelo) => ({
          id: modelo.id,
          nombre: modelo.nombre,
          dispositivoMarcaId: modelo.dispositivoMarcaId,
        })),
      estados: ESTADOS,
    });
  } catch (error) {
    console.error("Error cargando catalogos de inventario:", error);
    return res.status(500).json({ ok: false, message: "No se pudieron cargar los catalogos" });
  }
};

exports.crear = async (req, res) => {
  try {
    const producto = await resolverProductoCatalogo(req.body);
    if (producto.error) {
      return res.status(400).json({ ok: false, message: producto.error });
    }

    const validacion = validarInventario(
      { ...req.body, ...producto.data },
      { requiereCatalogo: true },
    );
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
    const productos = await Promise.all(
      items.map((item) => resolverProductoCatalogo(item)),
    );
    const erroresCatalogo = productos.flatMap((producto, index) =>
      producto.error ? [`Ítem ${index + 1}: ${producto.error}`] : [],
    );
    if (erroresCatalogo.length > 0) {
      return res.status(400).json({
        ok: false,
        message: erroresCatalogo[0],
        errores: erroresCatalogo,
      });
    }

    const validaciones = items.map((item, index) =>
      validarInventario(
        {
          ...item,
          ...productos[index].data,
          agenciaId,
          responsableId,
        },
        { requiereCatalogo: true },
      ),
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

    const datosActualizados = {
      ...inventario.get({ plain: true }),
      ...req.body,
    };
    const producto = await resolverProductoCatalogo(datosActualizados);
    if (producto.error) {
      return res.status(400).json({ ok: false, message: producto.error });
    }

    const validacion = validarInventario(
      { ...datosActualizados, ...producto.data },
      { requiereCatalogo: true },
    );
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
