const EgresoCreditekEntrada = require("../models/EgresoCreditekEntrada");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const Usuario = require("../models/Usuario");
const { Op } = require("sequelize");

const MAX_VALOR = 9999999999.99;
const SECCIONES = ["ENTRADAS", "CAJAS", "TRANSFERENCIAS", "DESCUENTOS"];
const TIPOS_VENTA_CONTROL_FINANCIERO = ["VENTA_TV", "VENTA_CELULAR"];

const crearError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizarId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw crearError(`${label} no es valido`);
  }
  return id;
};

const normalizarValor = (value) => {
  const valor = Number(
    typeof value === "string" ? value.trim().replace(",", ".") : value,
  );
  if (!Number.isFinite(valor) || valor <= 0 || valor > MAX_VALOR) {
    throw crearError("El valor debe ser un numero mayor a 0");
  }
  return Number(valor.toFixed(2));
};

const normalizarObservacion = (value) => {
  const observacion = String(value || "").trim();
  if (observacion.length > 1000) {
    throw crearError("La observacion no puede superar 1000 caracteres");
  }
  return observacion;
};

const normalizarSeccion = (value) => {
  const seccion = String(value || "").trim().toUpperCase();
  if (!SECCIONES.includes(seccion)) {
    throw crearError("La seccion solicitada no es valida");
  }
  return seccion;
};

const serializarEntrada = (value) => {
  const entrada = typeof value?.toJSON === "function" ? value.toJSON() : value;
  return {
    ...entrada,
    origen: entrada.origen || "MANUAL",
    valor: Number(entrada.valor || 0),
    observacion: entrada.observacion || "",
  };
};

const serializarEntradaControlFinanciero = (value) => {
  const registro = typeof value?.toJSON === "function" ? value.toJSON() : value;
  const tipoProductoEntrada =
    registro.tipoRegistro === "VENTA_TV" ? "TV" : "CELULAR";

  return {
    id: `control-financiero-${registro.id}`,
    origen: "CONTROL_FINANCIERO",
    controlFinancieroRegistroId: registro.id,
    usuarioId: registro.responsablePagoEntradaId || null,
    usuario: registro.responsablePagoEntrada || null,
    valor: Number(registro.entradas || 0),
    observacion: registro.observacionPagoEntrada || "",
    seccion: "ENTRADAS",
    activo: true,
    ultimaAccion: "CONTROL_FINANCIERO",
    estadoPagoEntrada: registro.estadoPagoEntrada || "PENDIENTE",
    tipoProductoEntrada,
    contrato: registro.contrato || "",
    cliente: registro.cliente || "",
    vendedor: registro.vendedor || "",
    modelo: registro.modelo || "",
    imei: registro.imei || "",
    fecha: registro.fecha || "",
    cargaId: registro.cargaId,
    carga: registro.carga || null,
    registradoPor: registro.carga?.usuario || null,
    actualizadoPor: registro.responsablePagoEntrada || null,
    createdAt: registro.createdAt,
    updatedAt: registro.updatedAt,
  };
};

const ordenarPorActividad = (a, b) => {
  const tiempoA = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const tiempoB = new Date(b.updatedAt || b.createdAt || 0).getTime();
  const fechaA = Number.isNaN(tiempoA) ? 0 : tiempoA;
  const fechaB = Number.isNaN(tiempoB) ? 0 : tiempoB;
  if (fechaA !== fechaB) return fechaB - fechaA;
  return String(b.id).localeCompare(String(a.id), "es", { numeric: true });
};

const includeUsuarios = [
  {
    model: Usuario,
    as: "usuario",
    attributes: ["id", "nombre", "activo"],
  },
  {
    model: Usuario,
    as: "registradoPor",
    attributes: ["id", "nombre"],
  },
  {
    model: Usuario,
    as: "actualizadoPor",
    attributes: ["id", "nombre"],
  },
];

const obtenerRegistroDeSeccion = async (seccion, idValue) => {
  const id = normalizarId(idValue, "El registro");
  const registro = await EgresoCreditekEntrada.findOne({
    where: { id, seccion },
  });
  if (!registro) {
    throw crearError("El registro solicitado no existe", 404);
  }
  return registro;
};

const obtenerRegistroCompleto = async (registro) => {
  const registroCompleto = await EgresoCreditekEntrada.findByPk(registro.id, {
    include: includeUsuarios,
  });
  return serializarEntrada(registroCompleto || registro);
};

const obtenerRegistros = async (seccionValue) => {
  const seccion = normalizarSeccion(seccionValue);
  const incluirControlFinanciero = seccion === "ENTRADAS";
  const [usuarios, registrosValues, registrosControlFinanciero] =
    await Promise.all([
      Usuario.findAll({
        where: { activo: true },
        attributes: ["id", "nombre"],
        order: [["nombre", "ASC"], ["id", "ASC"]],
      }),
      EgresoCreditekEntrada.findAll({
        where: { seccion },
        include: includeUsuarios,
        order: [["createdAt", "DESC"], ["id", "DESC"]],
      }),
      incluirControlFinanciero
        ? ControlFinancieroRegistro.findAll({
            where: {
              tipoRegistro: { [Op.in]: TIPOS_VENTA_CONTROL_FINANCIERO },
              entradas: { [Op.gt]: 0 },
            },
            include: [
              {
                model: Usuario,
                as: "responsablePagoEntrada",
                attributes: ["id", "nombre", "activo"],
                required: false,
              },
              {
                model: ControlFinancieroCarga,
                as: "carga",
                attributes: [
                  "id",
                  "fechaReporte",
                  "archivoGenerado",
                  "estado",
                  "usuarioId",
                ],
                where: { estado: "ACTIVA" },
                required: true,
                include: [
                  {
                    model: Usuario,
                    as: "usuario",
                    attributes: ["id", "nombre"],
                    required: false,
                  },
                ],
              },
            ],
            order: [["updatedAt", "DESC"], ["id", "DESC"]],
          })
        : Promise.resolve([]),
    ]);
  const registros = [
    ...registrosValues.map(serializarEntrada),
    ...registrosControlFinanciero.map(serializarEntradaControlFinanciero),
  ].sort(ordenarPorActividad);

  return {
    seccion,
    usuarios: usuarios.map((usuario) =>
      typeof usuario.toJSON === "function" ? usuario.toJSON() : usuario,
    ),
    registros,
    total: Number(
      registros
        .filter((registro) => registro.activo !== false)
        .reduce((suma, registro) => suma + registro.valor, 0)
        .toFixed(2),
    ),
  };
};

const crearRegistro = async (
  seccionValue,
  { usuarioId: usuarioIdValue, valor, observacion },
  registradoPor,
) => {
  const seccion = normalizarSeccion(seccionValue);
  const usuarioId = normalizarId(usuarioIdValue, "El usuario");
  const registradoPorId = normalizarId(registradoPor, "El usuario registrador");
  const valorNormalizado = normalizarValor(valor);
  const observacionNormalizada = normalizarObservacion(observacion);

  const usuario = await Usuario.findOne({
    where: { id: usuarioId, activo: true },
    attributes: ["id"],
  });
  if (!usuario) {
    throw crearError("El usuario seleccionado no existe o esta inactivo");
  }

  const entrada = await EgresoCreditekEntrada.create({
    usuarioId,
    valor: valorNormalizado,
    observacion: observacionNormalizada || null,
    seccion,
    registradoPorId,
  });
  return obtenerRegistroCompleto(entrada);
};

const actualizarRegistro = async (
  seccionValue,
  idValue,
  { usuarioId: usuarioIdValue, valor, observacion },
  actualizadoPor,
) => {
  const seccion = normalizarSeccion(seccionValue);
  const registro = await obtenerRegistroDeSeccion(seccion, idValue);
  const usuarioId = normalizarId(usuarioIdValue, "El usuario");
  const actualizadoPorId = normalizarId(
    actualizadoPor,
    "El usuario actualizador",
  );
  const valorNormalizado = normalizarValor(valor);
  const observacionNormalizada = normalizarObservacion(observacion);

  if (Number(registro.usuarioId) !== usuarioId) {
    const usuario = await Usuario.findOne({
      where: { id: usuarioId, activo: true },
      attributes: ["id"],
    });
    if (!usuario) {
      throw crearError("El usuario seleccionado no existe o esta inactivo");
    }
  }

  await registro.update({
    usuarioId,
    valor: valorNormalizado,
    observacion: observacionNormalizada || null,
    actualizadoPorId,
    ultimaAccion: "EDITADO",
  });

  return obtenerRegistroCompleto(registro);
};

const cambiarEstadoRegistro = async (
  seccionValue,
  idValue,
  activoValue,
  actualizadoPor,
) => {
  const seccion = normalizarSeccion(seccionValue);
  const registro = await obtenerRegistroDeSeccion(seccion, idValue);
  const actualizadoPorId = normalizarId(
    actualizadoPor,
    "El usuario actualizador",
  );
  if (typeof activoValue !== "boolean") {
    throw crearError("El estado del registro no es valido");
  }

  await registro.update({
    activo: activoValue,
    actualizadoPorId,
    ultimaAccion: activoValue ? "REACTIVADO" : "DESACTIVADO",
  });

  return obtenerRegistroCompleto(registro);
};

const obtenerEntradas = async () => {
  const { usuarios, registros, total } = await obtenerRegistros("ENTRADAS");
  return { usuarios, entradas: registros, total };
};

const crearEntrada = (payload, registradoPor) =>
  crearRegistro("ENTRADAS", payload, registradoPor);

module.exports = {
  actualizarRegistro,
  cambiarEstadoRegistro,
  crearEntrada,
  crearRegistro,
  normalizarObservacion,
  normalizarSeccion,
  normalizarValor,
  obtenerEntradas,
  obtenerRegistros,
};
