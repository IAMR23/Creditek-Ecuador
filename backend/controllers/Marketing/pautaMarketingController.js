const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const PautaMarketing = require("../../models/Marketing/PautaMarketing");
const { uploadsMarketingDir } = require("../../middleware/uploadMarketing");
const {
  MAX_CONTENIDOS_POR_PAGINA,
  TIPOS_CONTENIDO,
  normalizarBooleano,
  resolverContenidos,
  serializarPautaMarketing,
  validarPautaMarketing,
} = require("../../services/pautaMarketingService");

const CAMPOS_CUMPLIMIENTO = new Set([
  "cumplidoFacebook",
  "cumplidoInstagram",
  "cumplidoTiktok",
]);

const rutaImagen = (file) =>
  file ? `/uploads/marketing/${file.filename}` : null;

const eliminarArchivo = async (imagen) => {
  if (!imagen) return;

  const nombre = path.basename(imagen);
  const archivo = path.resolve(uploadsMarketingDir, nombre);

  if (!archivo.startsWith(`${uploadsMarketingDir}${path.sep}`)) return;

  try {
    await fs.promises.unlink(archivo);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("No se pudo eliminar una imagen de pauta:", error);
    }
  }
};

const construirWhere = (query = {}) => {
  const where = { activo: true };
  const busqueda = String(query.q || "").trim();
  const producto = String(query.producto || "").trim();
  const tipoContenido = String(query.tipoContenido || "").trim();

  if (busqueda) {
    where[Op.or] = ["producto", "nombrePagina", "tipoContenido"].map(
      (campo) => ({ [campo]: { [Op.iLike]: `%${busqueda}%` } }),
    );
  }
  if (producto) where.producto = producto;
  if (tipoContenido) where.tipoContenido = tipoContenido;

  return where;
};

exports.listar = async (req, res) => {
  try {
    const pautas = await PautaMarketing.findAll({
      where: construirWhere(req.query),
      order: [
        ["nombrePagina", "ASC"],
        ["updatedAt", "DESC"],
      ],
    });

    return res.json({
      ok: true,
      pautas: pautas.map(serializarPautaMarketing),
      tiposContenido: TIPOS_CONTENIDO,
    });
  } catch (error) {
    console.error("Error listando pautas de marketing:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron cargar las pautas de marketing",
    });
  }
};

exports.crear = async (req, res) => {
  const nuevaImagen = rutaImagen(req.file);

  try {
    const validacion = validarPautaMarketing(req.body);
    if (!nuevaImagen) validacion.errores.push("La imagen es obligatoria");

    if (validacion.errores.length) {
      await eliminarArchivo(nuevaImagen);
      return res.status(400).json({
        ok: false,
        message: validacion.errores[0],
        errores: validacion.errores,
      });
    }

    const pauta = await PautaMarketing.create({
      ...validacion.data,
      imagen: nuevaImagen,
      creadoPorId: req.user?.id || null,
      actualizadoPorId: req.user?.id || null,
      activo: true,
    });

    return res.status(201).json({
      ok: true,
      pauta: serializarPautaMarketing(pauta),
    });
  } catch (error) {
    await eliminarArchivo(nuevaImagen);
    console.error("Error creando pauta de marketing:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo crear la pauta de marketing",
    });
  }
};

exports.actualizar = async (req, res) => {
  const nuevaImagen = rutaImagen(req.file);

  try {
    const pauta = await PautaMarketing.findOne({
      where: { id: req.params.id, activo: true },
    });

    if (!pauta) {
      await eliminarArchivo(nuevaImagen);
      return res.status(404).json({
        ok: false,
        message: "Pauta de marketing no encontrada",
      });
    }

    const validacion = validarPautaMarketing({
      ...pauta.get({ plain: true }),
      ...req.body,
    });

    if (validacion.errores.length) {
      await eliminarArchivo(nuevaImagen);
      return res.status(400).json({
        ok: false,
        message: validacion.errores[0],
        errores: validacion.errores,
      });
    }

    const imagenAnterior = pauta.imagen;
    await pauta.update({
      ...validacion.data,
      imagen: nuevaImagen || imagenAnterior,
      actualizadoPorId: req.user?.id || null,
    });

    if (nuevaImagen && imagenAnterior !== nuevaImagen) {
      await eliminarArchivo(imagenAnterior);
    }

    return res.json({
      ok: true,
      pauta: serializarPautaMarketing(pauta),
    });
  } catch (error) {
    await eliminarArchivo(nuevaImagen);
    console.error("Error actualizando pauta de marketing:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo actualizar la pauta de marketing",
    });
  }
};

exports.agregarContenido = async (req, res) => {
  try {
    const pauta = await PautaMarketing.findOne({
      where: { id: req.params.id, activo: true },
    });

    if (!pauta) {
      return res.status(404).json({
        ok: false,
        message: "Pauta de marketing no encontrada",
      });
    }

    const contenidosActuales = resolverContenidos({
      contenidos: pauta.contenidos,
      producto: pauta.producto,
      tipoContenido: pauta.tipoContenido,
    }).contenidos;

    if (contenidosActuales.length >= MAX_CONTENIDOS_POR_PAGINA) {
      return res.status(400).json({
        ok: false,
        message: `Solo se permiten ${MAX_CONTENIDOS_POR_PAGINA} contenidos por pagina`,
      });
    }

    const nuevoResultado = resolverContenidos({ contenidos: [req.body] });
    if (nuevoResultado.errores.length) {
      return res.status(400).json({
        ok: false,
        message: nuevoResultado.errores[0],
        errores: nuevoResultado.errores,
      });
    }

    const nuevoContenido = nuevoResultado.contenidos[0];
    if (!nuevoContenido) {
      return res.status(400).json({
        ok: false,
        message: "Ingresa al menos un dato para el nuevo contenido",
      });
    }

    const contenidos = [...contenidosActuales, nuevoContenido];
    const primerContenido = contenidos[0];
    await pauta.update({
      contenidos,
      producto: primerContenido.producto,
      tipoContenido: primerContenido.tipoContenido,
      actualizadoPorId: req.user?.id || null,
    });

    return res.status(201).json({
      ok: true,
      pauta: serializarPautaMarketing(pauta),
    });
  } catch (error) {
    console.error("Error agregando contenido a pauta:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo agregar el contenido",
    });
  }
};

exports.actualizarCumplimiento = async (req, res) => {
  try {
    const campo = String(req.body?.red || "");
    const cumplimiento = normalizarBooleano(req.body?.cumplido);
    const indiceContenido = Number(req.params.indice);

    if (
      !CAMPOS_CUMPLIMIENTO.has(campo) ||
      !cumplimiento.valido ||
      !Number.isSafeInteger(indiceContenido) ||
      indiceContenido < 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "El cumplimiento o el contenido no es valido",
      });
    }

    const pauta = await PautaMarketing.findOne({
      where: { id: req.params.id, activo: true },
    });

    if (!pauta) {
      return res.status(404).json({
        ok: false,
        message: "Pauta de marketing no encontrada",
      });
    }

    const contenidos = resolverContenidos({
      contenidos: pauta.contenidos,
      producto: pauta.producto,
      tipoContenido: pauta.tipoContenido,
    }).contenidos;

    if (!contenidos[indiceContenido]) {
      return res.status(404).json({
        ok: false,
        message: "Contenido de pauta no encontrado",
      });
    }

    contenidos[indiceContenido] = {
      ...contenidos[indiceContenido],
      [campo]: cumplimiento.valor,
    };

    await pauta.update({
      contenidos,
      actualizadoPorId: req.user?.id || null,
    });

    return res.json({
      ok: true,
      pauta: serializarPautaMarketing(pauta),
    });
  } catch (error) {
    console.error("Error actualizando cumplimiento de pauta:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo actualizar el cumplimiento",
    });
  }
};

exports.eliminar = async (req, res) => {
  try {
    const pauta = await PautaMarketing.findOne({
      where: { id: req.params.id, activo: true },
    });

    if (!pauta) {
      return res.status(404).json({
        ok: false,
        message: "Pauta de marketing no encontrada",
      });
    }

    await pauta.update({
      activo: false,
      actualizadoPorId: req.user?.id || null,
    });

    return res.json({
      ok: true,
      message: "Pauta de marketing eliminada correctamente",
    });
  } catch (error) {
    console.error("Error eliminando pauta de marketing:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo eliminar la pauta de marketing",
    });
  }
};
