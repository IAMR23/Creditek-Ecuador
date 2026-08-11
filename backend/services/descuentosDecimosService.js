const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const DescuentoDecimo = require("../models/DescuentoDecimo");
const Usuario = require("../models/Usuario");

const MAX_REGISTROS = 1000;

const crearError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validarAnio = (value) => {
  const anio = Number(value);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    throw crearError("El año debe estar entre 2000 y 2100");
  }
  return anio;
};

const validarValor = (value) => {
  const numero = Number(
    typeof value === "string" ? value.trim().replace(",", ".") : value,
  );
  if (!Number.isFinite(numero) || numero < 0 || numero > 9999999999.99) {
    throw crearError("El valor debe ser un número válido mayor o igual a 0");
  }
  return Number(numero.toFixed(2));
};

const validarObservaciones = (value) => {
  const observaciones = String(value || "").trim();
  if (observaciones.length > 5000) {
    throw crearError("Las observaciones no pueden superar 5000 caracteres");
  }
  return observaciones;
};

const obtenerDescuentosDecimos = async (anioValue) => {
  const anio = validarAnio(anioValue);
  const [usuarios, descuentos] = await Promise.all([
    Usuario.findAll({
      attributes: ["id", "nombre", "activo"],
      order: [
        ["nombre", "ASC"],
        ["id", "ASC"],
      ],
    }),
    DescuentoDecimo.findAll({ where: { anio } }),
  ]);

  const descuentosPorUsuario = new Map(
    descuentos.map((descuento) => {
      const plain =
        typeof descuento.toJSON === "function" ? descuento.toJSON() : descuento;
      return [Number(plain.usuarioId), plain];
    }),
  );

  return {
    anio,
    registros: usuarios.map((usuarioValue) => {
      const usuario =
        typeof usuarioValue.toJSON === "function"
          ? usuarioValue.toJSON()
          : usuarioValue;
      const descuento = descuentosPorUsuario.get(Number(usuario.id));

      return {
        id: descuento?.id || null,
        usuarioId: Number(usuario.id),
        nombre: usuario.nombre || `Usuario #${usuario.id}`,
        usuarioActivo: Boolean(usuario.activo),
        valor: descuento ? Number(descuento.valor || 0) : 0,
        decimoCuarto: Boolean(descuento?.decimoCuarto),
        decimoTercero: Boolean(descuento?.decimoTercero),
        vacaciones: Boolean(descuento?.vacaciones),
        observaciones: descuento?.observaciones || "",
        updatedAt: descuento?.updatedAt || null,
      };
    }),
  };
};

const guardarDescuentosDecimos = async ({ anio: anioValue, registros }, usuarioId) => {
  const anio = validarAnio(anioValue);
  if (!Array.isArray(registros) || registros.length === 0) {
    throw crearError("Debe enviar al menos un registro");
  }
  if (registros.length > MAX_REGISTROS) {
    throw crearError(`No se pueden guardar más de ${MAX_REGISTROS} registros`);
  }

  const usuarioIds = registros.map((registro) => Number(registro.usuarioId));
  if (
    usuarioIds.some((id) => !Number.isInteger(id) || id <= 0) ||
    new Set(usuarioIds).size !== usuarioIds.length
  ) {
    throw crearError("Los usuarios enviados son inválidos o están duplicados");
  }

  return sequelize.transaction(async (transaction) => {
    const usuarios = await Usuario.findAll({
      where: { id: { [Op.in]: usuarioIds } },
      attributes: ["id"],
      transaction,
    });
    if (usuarios.length !== usuarioIds.length) {
      throw crearError("Uno o más usuarios no existen");
    }

    const updatedAt = new Date();
    const payload = registros.map((registro) => ({
      usuarioId: Number(registro.usuarioId),
      anio,
      valor: validarValor(registro.valor ?? 0),
      decimoCuarto: registro.decimoCuarto === true,
      decimoTercero: registro.decimoTercero === true,
      vacaciones: registro.vacaciones === true,
      observaciones: validarObservaciones(registro.observaciones),
      actualizadoPorId: usuarioId || null,
      updatedAt,
    }));

    await DescuentoDecimo.bulkCreate(payload, {
      updateOnDuplicate: [
        "valor",
        "decimoCuarto",
        "decimoTercero",
        "vacaciones",
        "observaciones",
        "actualizadoPorId",
        "updatedAt",
      ],
      transaction,
    });

    return { anio, total: payload.length };
  });
};

module.exports = {
  guardarDescuentosDecimos,
  obtenerDescuentosDecimos,
  validarAnio,
};
