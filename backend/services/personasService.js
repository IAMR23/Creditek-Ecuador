const { Op, fn, col, where } = require("sequelize");
const Cliente = require("../models/Cliente");

const limpiarTexto = (value, maxLength = 255) => {
  const texto = String(value ?? "").trim().replace(/\s+/g, " ");
  return texto ? texto.slice(0, maxLength) : null;
};

const normalizarDatosPersona = (payload = {}) => ({
  cliente: limpiarTexto(payload.cliente ?? payload.nombre, 255),
  cedula: limpiarTexto(payload.cedula ?? payload.cedulaGestionado, 30),
  telefono: limpiarTexto(payload.telefono ?? payload.celularGestionado, 30),
  correo: limpiarTexto(payload.correo, 255)?.toLowerCase() || null,
  direccion: limpiarTexto(payload.direccion, 255),
});

const buscarPorCampoNormalizado = async (campo, valor, options = {}) => {
  if (!valor) return null;

  return Cliente.findOne({
    where: where(fn("BTRIM", col(campo)), valor),
    order: [["id", "ASC"]],
    ...options,
  });
};

const buscarPersonaPorCedula = async (cedula, options = {}) => {
  const cedulaNormalizada = limpiarTexto(cedula, 30);
  return buscarPorCampoNormalizado("cedula", cedulaNormalizada, options);
};

const buscarPersonaExistente = async (datos, options = {}) => {
  if (datos.cedula) {
    const porCedula = await buscarPorCampoNormalizado(
      "cedula",
      datos.cedula,
      options,
    );
    if (porCedula) return porCedula;

    if (datos.telefono) {
      return Cliente.findOne({
        where: {
          [Op.and]: [
            where(fn("BTRIM", col("telefono")), datos.telefono),
            {
              [Op.or]: [
                { cedula: null },
                where(fn("BTRIM", col("cedula")), ""),
              ],
            },
          ],
        },
        order: [["id", "ASC"]],
        ...options,
      });
    }
  }

  if (datos.telefono) {
    return buscarPorCampoNormalizado("telefono", datos.telefono, options);
  }

  if (datos.correo) {
    return Cliente.findOne({
      where: where(fn("LOWER", fn("BTRIM", col("correo"))), datos.correo),
      order: [["id", "ASC"]],
      ...options,
    });
  }

  return null;
};

const registrarPersona = async (payload = {}, options = {}) => {
  const datos = normalizarDatosPersona(payload);
  const persona = await buscarPersonaExistente(datos, options);

  if (!persona) {
    return Cliente.create(datos, options);
  }

  const cambios = Object.fromEntries(
    Object.entries(datos).filter(([, value]) => value !== null),
  );

  if (Object.keys(cambios).length > 0) {
    await persona.update(cambios, options);
  }

  return persona;
};

module.exports = {
  buscarPersonaPorCedula,
  buscarPersonaExistente,
  limpiarTexto,
  normalizarDatosPersona,
  registrarPersona,
};
