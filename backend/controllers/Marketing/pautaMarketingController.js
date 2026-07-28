const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const PautaMarketing = require("../../models/Marketing/PautaMarketing");
const { uploadsMarketingDir } = require("../../middleware/uploadMarketing");
const {
  TIPOS_CONTENIDO,
  serializarPautaMarketing,
  validarPautaMarketing,
} = require("../../services/pautaMarketingService");

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
