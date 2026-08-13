const { Op } = require("sequelize");
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
require("../models/UsuarioRol");

const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const rolesDeUsuario = (usuario) => {
  const item = usuario?.get ? usuario.get({ plain: true }) : usuario;
  return [item?.rol, ...(Array.isArray(item?.roles) ? item.roles : [])].filter(Boolean);
};

const esUsuarioAdmin = (usuario) =>
  rolesDeUsuario(usuario).some((rol) =>
    ["admin", "administrador"].includes(normalizarTexto(rol.nombre)),
  );

const consultarUsuariosAdmin = async ({ ids } = {}) => {
  const where = { activo: true };
  if (ids?.length) where.id = { [Op.in]: ids };

  const usuarios = await Usuario.findAll({
    where,
    attributes: ["id", "nombre", "email"],
    include: [
      {
        model: Rol,
        as: "rol",
        attributes: ["id", "nombre"],
        required: false,
      },
      {
        model: Rol,
        as: "roles",
        attributes: ["id", "nombre"],
        through: { attributes: [], where: { activo: true } },
        required: false,
      },
    ],
    order: [["nombre", "ASC"]],
  });

  return usuarios.filter(esUsuarioAdmin).map((usuario) => {
    const item = usuario.get ? usuario.get({ plain: true }) : usuario;
    return {
      id: item.id,
      nombre: item.nombre || item.email,
      email: item.email,
    };
  });
};

module.exports = {
  consultarUsuariosAdmin,
  esUsuarioAdmin,
  normalizarTexto,
};
