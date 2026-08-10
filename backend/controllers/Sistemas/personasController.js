const { Op, fn, col, where, literal } = require("sequelize");
const Cliente = require("../../models/Cliente");
const Rol = require("../../models/Rol");
const {
  buscarPersonaExistente,
  limpiarTexto,
  normalizarDatosPersona,
} = require("../../services/personasService");

const includeRol = [
  {
    model: Rol,
    as: "rol",
    attributes: ["id", "nombre", "descripcion"],
    required: false,
  },
];

const contadoresActividad = [
  [
    literal(`(
      SELECT COUNT(*)::integer
      FROM ventas
      WHERE ventas."clienteId" = "Cliente"."id"
    )`),
    "ventasRegistradas",
  ],
  [
    literal(`(
      SELECT COUNT(*)::integer
      FROM entregas
      WHERE entregas."clienteId" = "Cliente"."id"
    )`),
    "entregasRegistradas",
  ],
  [
    literal(`(
      SELECT COUNT(*)::integer
      FROM "gestionesComerciales"
      WHERE "gestionesComerciales"."clienteId" = "Cliente"."id"
    )`),
    "prospectosRegistrados",
  ],
];

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const construirWhere = (query = {}) => {
  const filtros = [];
  const busqueda = limpiarTexto(query.q ?? query.busqueda, 120);

  if (busqueda) {
    filtros.push({
      [Op.or]: ["cliente", "cedula", "telefono", "correo", "direccion"].map(
        (campo) => ({ [campo]: { [Op.iLike]: `%${busqueda}%` } }),
      ),
    });
  }

  if (query.rolId === "sin-rol") {
    filtros.push({ rolId: null });
  } else if (Number(query.rolId) > 0) {
    filtros.push({ rolId: Number(query.rolId) });
  }

  const fuentes = {
    venta: `EXISTS (SELECT 1 FROM ventas WHERE ventas."clienteId" = "Cliente"."id")`,
    entrega: `EXISTS (SELECT 1 FROM entregas WHERE entregas."clienteId" = "Cliente"."id")`,
    prospecto: `EXISTS (
      SELECT 1 FROM "gestionesComerciales"
      WHERE "gestionesComerciales"."clienteId" = "Cliente"."id"
    )`,
  };

  if (fuentes[query.fuente]) filtros.push(literal(fuentes[query.fuente]));

  return filtros.length ? { [Op.and]: filtros } : {};
};

const serializarPersona = (registro) => {
  const persona = registro.get({ plain: true });
  const ventasRegistradas = Number(persona.ventasRegistradas || 0);
  const entregasRegistradas = Number(persona.entregasRegistradas || 0);
  const prospectosRegistrados = Number(persona.prospectosRegistrados || 0);
  const fuentes = [];

  if (ventasRegistradas > 0) fuentes.push("Venta");
  if (entregasRegistradas > 0) fuentes.push("Entrega");
  if (prospectosRegistrados > 0) fuentes.push("Prospecto");

  return {
    ...persona,
    cliente: persona.cliente || "",
    cedula: persona.cedula || "",
    telefono: persona.telefono || "",
    correo: persona.correo || "",
    direccion: persona.direccion || "",
    ventasRegistradas,
    entregasRegistradas,
    prospectosRegistrados,
    fuentes,
  };
};

const normalizarPayload = (payload = {}, parcial = false) => {
  const campos = {
    cliente: 255,
    cedula: 30,
    telefono: 30,
    correo: 255,
    direccion: 255,
  };
  const data = {};

  Object.entries(campos).forEach(([campo, maxLength]) => {
    if (!parcial || Object.prototype.hasOwnProperty.call(payload, campo)) {
      data[campo] = limpiarTexto(payload[campo], maxLength);
    }
  });

  if (data.correo) data.correo = data.correo.toLowerCase();
  if (!parcial || Object.prototype.hasOwnProperty.call(payload, "rolId")) {
    data.rolId = Number(payload.rolId) > 0 ? Number(payload.rolId) : null;
  }

  return data;
};

const validarRol = async (rolId) => {
  if (!rolId) return true;
  return Boolean(
    await Rol.findOne({ where: { id: rolId, activo: true }, attributes: ["id"] }),
  );
};

const validarIdentidadDisponible = async (data, personaId = null) => {
  const campos = data.cedula
    ? ["cedula"]
    : data.telefono
      ? ["telefono"]
      : data.correo
        ? ["correo"]
        : [];

  for (const campo of campos) {
    if (!data[campo]) continue;

    const valor = campo === "correo" ? data[campo].toLowerCase() : data[campo];
    const expresion =
      campo === "correo"
        ? where(fn("LOWER", fn("BTRIM", col(campo))), valor)
        : where(fn("BTRIM", col(campo)), valor);
    const existente = await Cliente.findOne({
      where: {
        [Op.and]: [
          expresion,
          ...(personaId ? [{ id: { [Op.ne]: personaId } }] : []),
        ],
      },
      attributes: ["id"],
    });

    if (existente) return `Ya existe otra persona con el mismo ${campo}`;
  }

  return null;
};

exports.listar = async (req, res) => {
  try {
    const pagina = parsePositiveInt(req.query.pagina ?? req.query.page, 1);
    const limite = parsePositiveInt(req.query.limite ?? req.query.limit, 25, 100);
    const wherePersonas = construirWhere(req.query);

    const { rows, count } = await Cliente.findAndCountAll({
      where: wherePersonas,
      attributes: { include: contadoresActividad },
      include: includeRol,
      distinct: true,
      limit: limite,
      offset: (pagina - 1) * limite,
      order: [["updatedAt", "DESC"], ["id", "DESC"]],
    });

    const [conRol, deVentas, deEntregas, prospectos] = await Promise.all([
      Cliente.count({ where: { [Op.and]: [wherePersonas, { rolId: { [Op.ne]: null } }] } }),
      Cliente.count({
        where: {
          [Op.and]: [
            wherePersonas,
            literal(`EXISTS (SELECT 1 FROM ventas WHERE ventas."clienteId" = "Cliente"."id")`),
          ],
        },
      }),
      Cliente.count({
        where: {
          [Op.and]: [
            wherePersonas,
            literal(`EXISTS (SELECT 1 FROM entregas WHERE entregas."clienteId" = "Cliente"."id")`),
          ],
        },
      }),
      Cliente.count({
        where: {
          [Op.and]: [
            wherePersonas,
            literal(`EXISTS (
              SELECT 1 FROM "gestionesComerciales"
              WHERE "gestionesComerciales"."clienteId" = "Cliente"."id"
            )`),
          ],
        },
      }),
    ]);

    return res.json({
      ok: true,
      personas: rows.map(serializarPersona),
      resumen: { total: count, conRol, deVentas, deEntregas, prospectos },
      paginacion: {
        pagina,
        limite,
        total: count,
        totalPaginas: Math.max(1, Math.ceil(count / limite)),
      },
    });
  } catch (error) {
    console.error("Error listando personas:", error);
    return res.status(500).json({ ok: false, message: "No se pudieron cargar las personas" });
  }
};

exports.catalogos = async (_req, res) => {
  try {
    const roles = await Rol.findAll({
      where: { activo: true },
      attributes: ["id", "nombre", "descripcion"],
      order: [["nombre", "ASC"]],
    });
    return res.json({ ok: true, roles });
  } catch (error) {
    console.error("Error cargando roles de personas:", error);
    return res.status(500).json({ ok: false, message: "No se pudieron cargar los roles" });
  }
};

exports.crear = async (req, res) => {
  try {
    const data = normalizarPayload(req.body);
    if (!data.cliente && !data.cedula && !data.telefono && !data.correo) {
      return res.status(400).json({
        ok: false,
        message: "Ingresa al menos un nombre, cedula, telefono o correo",
      });
    }

    if (!(await validarRol(data.rolId))) {
      return res.status(400).json({ ok: false, message: "El rol seleccionado no es valido" });
    }

    const existente = await buscarPersonaExistente(normalizarDatosPersona(data));
    if (existente) {
      return res.status(409).json({
        ok: false,
        message: "La persona ya existe; buscala en el listado para completar sus datos",
      });
    }

    const creada = await Cliente.create(data);
    const persona = await Cliente.findByPk(creada.id, {
      attributes: { include: contadoresActividad },
      include: includeRol,
    });

    return res.status(201).json({ ok: true, persona: serializarPersona(persona) });
  } catch (error) {
    console.error("Error creando persona:", error);
    return res.status(500).json({ ok: false, message: "No se pudo crear la persona" });
  }
};

exports.actualizar = async (req, res) => {
  try {
    const persona = await Cliente.findByPk(req.params.id);
    if (!persona) {
      return res.status(404).json({ ok: false, message: "Persona no encontrada" });
    }

    const data = normalizarPayload(req.body, true);
    const resultado = { ...persona.get({ plain: true }), ...data };
    if (!resultado.cliente && !resultado.cedula && !resultado.telefono && !resultado.correo) {
      return res.status(400).json({
        ok: false,
        message: "La persona debe conservar al menos un dato de identificacion",
      });
    }

    if (Object.prototype.hasOwnProperty.call(data, "rolId") && !(await validarRol(data.rolId))) {
      return res.status(400).json({ ok: false, message: "El rol seleccionado no es valido" });
    }

    const identidadCambiada = Object.fromEntries(
      ["cedula", "telefono", "correo"]
        .filter(
          (campo) =>
            Object.prototype.hasOwnProperty.call(data, campo) &&
            (data[campo] || null) !== (limpiarTexto(persona[campo], 255) || null),
        )
        .map((campo) => [campo, data[campo]]),
    );
    const conflicto = await validarIdentidadDisponible(
      identidadCambiada,
      persona.id,
    );
    if (conflicto) return res.status(409).json({ ok: false, message: conflicto });

    await persona.update(data);
    const actualizada = await Cliente.findByPk(persona.id, {
      attributes: { include: contadoresActividad },
      include: includeRol,
    });

    return res.json({ ok: true, persona: serializarPersona(actualizada) });
  } catch (error) {
    console.error("Error actualizando persona:", error);
    return res.status(500).json({ ok: false, message: "No se pudo actualizar la persona" });
  }
};
