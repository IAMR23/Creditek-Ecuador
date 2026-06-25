const { Op } = require("sequelize");
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const Agencia = require("../models/Agencia");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const NominaEmpleado = require("../models/NominaEmpleado");
const { NominaBeneficio, TIPOS_BENEFICIO_NOMINA } = require("../models/NominaBeneficio");
 
const ESTADOS_NOMINA = ["ACTIVO", "PASIVO"];

const normalizarEstado = (estado) => {
  if (!estado) return undefined;
  const estadoNormalizado = String(estado).trim().toUpperCase();
  if (!ESTADOS_NOMINA.includes(estadoNormalizado)) {
    throw new Error("Estado de nomina no valido");
  }
  return estadoNormalizado;
};

const formatoBeneficio = (tipo) =>
  String(tipo || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

const calcularTiempoTrabajado = (fechaIngreso, fechaSalida) => {
  if (!fechaIngreso) return "";

  const inicio = new Date(`${fechaIngreso}T00:00:00`);
  const fin = fechaSalida ? new Date(`${fechaSalida}T00:00:00`) : new Date();

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin < inicio) {
    return "";
  }

  let anios = fin.getFullYear() - inicio.getFullYear();
  let meses = fin.getMonth() - inicio.getMonth();
  let dias = fin.getDate() - inicio.getDate();

  if (dias < 0) {
    meses -= 1;
    const ultimoDiaMesAnterior = new Date(fin.getFullYear(), fin.getMonth(), 0).getDate();
    dias += ultimoDiaMesAnterior;
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  const partes = [];
  if (anios) partes.push(`${anios} ${anios === 1 ? "anio" : "anios"}`);
  if (meses) partes.push(`${meses} ${meses === 1 ? "mes" : "meses"}`);
  if (dias || !partes.length) partes.push(`${dias} ${dias === 1 ? "dia" : "dias"}`);

  return partes.join(", ");
};

const asegurarBeneficios = async (nominaEmpleadoId) => {
  const beneficios = [];

  for (const tipoBeneficio of TIPOS_BENEFICIO_NOMINA) {
    const [beneficio] = await NominaBeneficio.findOrCreate({
      where: { nominaEmpleadoId, tipoBeneficio },
      defaults: { activo: false, observacion: null },
    });
    beneficios.push(beneficio);
  }

  return beneficios;
};

const asegurarNominaRelacion = async (relacion) => {
  const [nomina] = await NominaEmpleado.findOrCreate({
    where: { usuarioAgenciaId: relacion.id },
    defaults: {
      usuarioId: relacion.usuarioId,
      usuarioAgenciaId: relacion.id,
      estado: relacion.usuario?.activo === false || relacion.activo === false ? "PASIVO" : "ACTIVO",
      sueldo: 0,
      cargo: null,
      observaciones: null,
    },
  });

  await asegurarBeneficios(nomina.id);
  return nomina;
};

const obtenerNominaCompleta = async (id) =>
  NominaEmpleado.findByPk(id, {
    include: [
      {
        model: UsuarioAgencia,
        as: "usuarioAgencia",
        include: [
          {
            model: Usuario,
            as: "usuario",
            include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
          },
          { model: Agencia, as: "agencia" },
        ],
      },
      { model: NominaBeneficio, as: "beneficios" },
    ],
  });

const serializarNomina = (nomina, relacionFallback = null) => {
  const relacion = nomina.usuarioAgencia || relacionFallback;
  const usuario = relacion?.usuario || {};
  const agencia = relacion?.agencia || {};
  const beneficios = Array.isArray(nomina.beneficios) ? nomina.beneficios : [];

  return {
    id: nomina.id,
    usuarioId: nomina.usuarioId,
    usuarioAgenciaId: nomina.usuarioAgenciaId,
    agenciaId: relacion?.agenciaId || agencia.id || null,
    agencia: agencia.nombre || "",
    nombre: usuario.nombre || "",
    fechaIngreso: usuario.fechaIngreso || null,
    fechaSalida: usuario.fechaSalida || null,
    tiempoTrabajado: calcularTiempoTrabajado(usuario.fechaIngreso, usuario.fechaSalida),
    cargo: nomina.cargo || "",
    sueldo: Number(nomina.sueldo || 0),
    cedula: usuario.cedula || "",
    correo: usuario.email || "",
    cuentaBancaria: usuario.numeroCuenta || "",
    entidadBancaria: usuario.entidadFinanciera || "",
    direccion: usuario.direccion || "",
    telefono: usuario.telefono || "",
    estado: nomina.estado,
    beneficios: TIPOS_BENEFICIO_NOMINA.map((tipoBeneficio) => {
      const beneficio = beneficios.find((item) => item.tipoBeneficio === tipoBeneficio);
      return {
        id: beneficio?.id || null,
        tipoBeneficio,
        activo: Boolean(beneficio?.activo),
        observacion: beneficio?.observacion || "",
      };
    }),
    observaciones: nomina.observaciones || "",
    createdAt: nomina.createdAt,
    updatedAt: nomina.updatedAt,
  };
};

const listarNomina = async ({ agenciaId, estado, nombre, usuarioId } = {}) => {
  const estadoNormalizado = normalizarEstado(estado);
  const whereRelacion = { activo: true };
  const whereUsuario = { activo: true };

  if (agenciaId) whereRelacion.agenciaId = agenciaId;
  if (usuarioId) whereRelacion.usuarioId = usuarioId;
  if (nombre) whereUsuario.nombre = { [Op.iLike]: `%${String(nombre).trim()}%` };

  const relaciones = await UsuarioAgencia.findAll({
    where: whereRelacion,
    include: [
      {
        model: Usuario,
        as: "usuario",
        where: whereUsuario,
        include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
      },
      { model: Agencia, as: "agencia" },
    ],
    order: [
      [{ model: Agencia, as: "agencia" }, "nombre", "ASC"],
      [{ model: Usuario, as: "usuario" }, "nombre", "ASC"],
    ],
  });

  const registros = [];

  for (const relacion of relaciones) {
    const nomina = await asegurarNominaRelacion(relacion);
    const nominaCompleta = await obtenerNominaCompleta(nomina.id);

    if (!estadoNormalizado || nominaCompleta.estado === estadoNormalizado) {
      registros.push(serializarNomina(nominaCompleta, relacion));
    }
  }

  return registros;
};

const obtenerNominaPorUsuario = async (usuarioId) => {
  const relaciones = await UsuarioAgencia.findAll({
    where: { usuarioId },
    include: [
      {
        model: Usuario,
        as: "usuario",
        include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
      },
      { model: Agencia, as: "agencia" },
    ],
  });

  const registros = [];

  for (const relacion of relaciones) {
    const nomina = await asegurarNominaRelacion(relacion);
    registros.push(serializarNomina(await obtenerNominaCompleta(nomina.id), relacion));
  }

  return registros;
};

const crearSiNoExiste = async (usuarioAgenciaId) => {
  const relacion = await UsuarioAgencia.findByPk(usuarioAgenciaId, {
    include: [
      {
        model: Usuario,
        as: "usuario",
        include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
      },
      { model: Agencia, as: "agencia" },
    ],
  });

  if (!relacion) {
    const error = new Error("Relacion usuario-agencia no encontrada");
    error.statusCode = 404;
    throw error;
  }

  const nomina = await asegurarNominaRelacion(relacion);
  return serializarNomina(await obtenerNominaCompleta(nomina.id), relacion);
};

const actualizarBeneficios = async (nominaEmpleadoId, beneficios = []) => {
  await asegurarBeneficios(nominaEmpleadoId);

  for (const beneficioPayload of beneficios) {
    const tipoBeneficio = formatoBeneficio(beneficioPayload.tipoBeneficio);
    if (!TIPOS_BENEFICIO_NOMINA.includes(tipoBeneficio)) continue;

    const beneficio = await NominaBeneficio.findOne({
      where: { nominaEmpleadoId, tipoBeneficio },
    });

    if (beneficio) {
      await beneficio.update({
        activo: Boolean(beneficioPayload.activo),
        observacion: beneficioPayload.observacion ?? beneficio.observacion,
      });
    }
  }
};

const actualizarNomina = async (id, payload = {}) => {
  const nomina = await NominaEmpleado.findByPk(id);
  if (!nomina) {
    const error = new Error("Registro de nomina no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const cambios = {};
  if (payload.sueldo !== undefined) cambios.sueldo = Number(payload.sueldo) || 0;
  if (payload.cargo !== undefined) cambios.cargo = payload.cargo || null;
  if (payload.estado !== undefined) cambios.estado = normalizarEstado(payload.estado);
  if (payload.observaciones !== undefined) cambios.observaciones = payload.observaciones;

  if (Object.keys(cambios).length) {
    await nomina.update(cambios);
  }

  if (Array.isArray(payload.beneficios)) {
    await actualizarBeneficios(nomina.id, payload.beneficios);
  }

  return serializarNomina(await obtenerNominaCompleta(nomina.id));
};

module.exports = {
  TIPOS_BENEFICIO_NOMINA,
  listarNomina,
  obtenerNominaPorUsuario,
  crearSiNoExiste,
  actualizarNomina,
};
