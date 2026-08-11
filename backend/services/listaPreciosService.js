const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const CostoHistorico = require("../models/CostoHistorico");
const Dispositivo = require("../models/Dispositivo");
const DispositivoMarca = require("../models/DispositivoMarca");
const Marca = require("../models/Marca");
const Modelo = require("../models/Modelo");
const {
  calcularIndicadoresCostoHistorico,
} = require("../utils/calcularIndicadoresCostoHistorico");

const MAX_PRECIOS_POR_SOLICITUD = 500;

const getHoyLocal = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });

const toPlain = (value) => {
  if (!value) return value;
  if (typeof value.toJSON === "function") return value.toJSON();
  if (typeof value.get === "function") return value.get({ plain: true });
  return value;
};

const validarFecha = (value) => {
  const fecha = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;

  const parsed = new Date(`${fecha}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== fecha
    ? null
    : fecha;
};

const parsePrecio = (value, field, { required = false } = {}) => {
  if (value === null || value === undefined || value === "") {
    if (required) {
      const error = new Error(`${field} es obligatorio`);
      error.statusCode = 400;
      throw error;
    }
    return null;
  }

  const numero = Number(typeof value === "string" ? value.replace(",", ".") : value);
  if (!Number.isFinite(numero) || numero <= 0) {
    const error = new Error(`${field} debe ser mayor a 0`);
    error.statusCode = 400;
    throw error;
  }

  const redondeado = Number(numero.toFixed(2));
  if (Math.abs(numero - redondeado) > Number.EPSILON) {
    const error = new Error(`${field} solo puede tener hasta 2 decimales`);
    error.statusCode = 400;
    throw error;
  }

  return redondeado;
};

const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const esTelevisor = (modelo) => {
  const dispositivo = normalizarTexto(
    modelo?.dispositivoMarca?.dispositivo?.nombre,
  );
  return (
    dispositivo === "tv" ||
    dispositivo.includes("televisor") ||
    dispositivo.includes("television")
  );
};

const modeloInclude = [
  {
    model: DispositivoMarca,
    as: "dispositivoMarca",
    attributes: ["id"],
    where: { activo: true },
    required: true,
    include: [
      {
        model: Marca,
        as: "marca",
        attributes: ["id", "nombre"],
        where: { activo: true },
        required: true,
      },
      {
        model: Dispositivo,
        as: "dispositivo",
        attributes: ["id", "nombre"],
        where: { activo: true },
        required: true,
      },
    ],
  },
];

const obtenerModelos = (modeloIds = null, transaction = null) =>
  Modelo.findAll({
    where: {
      activo: true,
      ...(modeloIds && { id: { [Op.in]: modeloIds } }),
    },
    attributes: ["id", "nombre", "activo"],
    include: modeloInclude,
    order: [["nombre", "ASC"]],
    ...(transaction && { transaction }),
  });

const obtenerHistoricosHasta = (modeloIds, fechaVigencia, transaction = null) =>
  CostoHistorico.findAll({
    where: {
      modeloId: { [Op.in]: modeloIds },
      fechaCompra: { [Op.lte]: fechaVigencia },
    },
    order: [
      ["modeloId", "ASC"],
      ["fechaCompra", "DESC"],
      ["id", "DESC"],
    ],
    ...(transaction && { transaction }),
  });

const indexarHistoricos = (historicos) => {
  const vigentes = new Map();
  const exactos = new Map();

  historicos.map(toPlain).forEach((historico) => {
    const modeloId = Number(historico.modeloId);
    if (!vigentes.has(modeloId)) vigentes.set(modeloId, historico);
    if (!exactos.has(`${modeloId}:${historico.fechaCompra}`)) {
      exactos.set(`${modeloId}:${historico.fechaCompra}`, historico);
    }
  });

  return { vigentes, exactos };
};

const serializarFila = (modeloValue, historicoValue) => {
  const modelo = toPlain(modeloValue);
  const historico = toPlain(historicoValue);

  return {
    modeloId: modelo.id,
    activo: modelo.activo === true,
    marca: modelo.dispositivoMarca?.marca?.nombre || "",
    nombre: modelo.nombre || "",
    dispositivo: modelo.dispositivoMarca?.dispositivo?.nombre || "",
    tipo: esTelevisor(modelo) ? "TV" : "MOVIL",
    costoHistoricoId: historico?.id || null,
    fechaVigencia: historico?.fechaCompra || null,
    precioCarga: historico?.precioCarga == null ? null : Number(historico.precioCarga),
    precioContado:
      historico?.precioContado == null ? null : Number(historico.precioContado),
    precioTarjetaCredito:
      historico?.precioTarjetaCredito == null
        ? historico?.precioContado == null
          ? null
          : Number(historico.precioContado)
        : Number(historico.precioTarjetaCredito),
  };
};

const obtenerListaPrecios = async ({ fechaVigencia = getHoyLocal() } = {}) => {
  const fecha = validarFecha(fechaVigencia);
  if (!fecha) {
    const error = new Error("Fecha de vigencia invalida");
    error.statusCode = 400;
    throw error;
  }

  const modelos = await obtenerModelos();
  const modeloIds = modelos.map((modelo) => Number(modelo.id));
  const historicos = modeloIds.length
    ? await obtenerHistoricosHasta(modeloIds, fecha)
    : [];
  const { vigentes } = indexarHistoricos(historicos);

  return {
    fechaVigencia: fecha,
    precios: modelos
      .map((modelo) => serializarFila(modelo, vigentes.get(Number(modelo.id))))
      .sort((a, b) =>
        `${a.tipo}|${a.marca}|${a.nombre}`.localeCompare(
          `${b.tipo}|${b.marca}|${b.nombre}`,
          "es",
        ),
      ),
  };
};

const guardarListaPrecios = async ({ fechaVigencia, precios }) => {
  const fecha = validarFecha(fechaVigencia);
  if (!fecha) {
    const error = new Error("Fecha de vigencia invalida");
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(precios) || !precios.length) {
    const error = new Error("Debe enviar al menos un precio");
    error.statusCode = 400;
    throw error;
  }

  if (precios.length > MAX_PRECIOS_POR_SOLICITUD) {
    const error = new Error("La solicitud supera el maximo de 500 precios");
    error.statusCode = 400;
    throw error;
  }

  const modeloIds = precios.map((precio) => Number(precio.modeloId));
  if (
    modeloIds.some((modeloId) => !Number.isInteger(modeloId) || modeloId <= 0) ||
    new Set(modeloIds).size !== modeloIds.length
  ) {
    const error = new Error("Los modelos enviados son invalidos o estan duplicados");
    error.statusCode = 400;
    throw error;
  }

  return sequelize.transaction(async (transaction) => {
    const modelos = await obtenerModelos(modeloIds, transaction);
    if (modelos.length !== modeloIds.length) {
      const error = new Error("Uno o mas modelos no existen o estan inactivos");
      error.statusCode = 400;
      throw error;
    }

    const modelosPorId = new Map(
      modelos.map((modelo) => [Number(modelo.id), toPlain(modelo)]),
    );
    const historicos = await obtenerHistoricosHasta(
      modeloIds,
      fecha,
      transaction,
    );
    const { vigentes, exactos } = indexarHistoricos(historicos);
    let creados = 0;
    let actualizados = 0;

    for (const precio of precios) {
      const modeloId = Number(precio.modeloId);
      const modelo = modelosPorId.get(modeloId);
      const televisor = esTelevisor(modelo);
      const precioCarga = parsePrecio(precio.precioCarga, "PVP credito", {
        required: true,
      });
      const precioContado = parsePrecio(precio.precioContado, "PVP contado", {
        required: !televisor,
      });
      const precioTarjetaCredito =
        !televisor &&
        (precio.precioTarjetaCredito === null ||
          precio.precioTarjetaCredito === undefined ||
          precio.precioTarjetaCredito === "")
          ? precioContado
          : parsePrecio(precio.precioTarjetaCredito, "PVP tarjeta credito", {
              required: !televisor,
            });
      const vigente = vigentes.get(modeloId);
      const exacto = exactos.get(`${modeloId}:${fecha}`);

      if (!vigente) {
        const nombreModelo = [
          modelo.dispositivoMarca?.marca?.nombre,
          modelo.nombre,
        ]
          .filter(Boolean)
          .join(" ");
        const error = new Error(
          `No existe costo historico para ${nombreModelo}`,
        );
        error.statusCode = 400;
        throw error;
      }

      const indicadores = calcularIndicadoresCostoHistorico(
        precioCarga,
        vigente.costo,
      );
      const payload = {
        precioCarga,
        precioContado,
        precioTarjetaCredito,
        margen: indicadores.margen,
        margenPorcentual: indicadores.margenPorcentual,
        utilidadSobreCosto: indicadores.utilidadSobreCosto,
        rentabilidad: indicadores.rentabilidad,
      };

      if (exacto) {
        await CostoHistorico.update(payload, {
          where: { id: exacto.id },
          transaction,
        });
        actualizados += 1;
      } else {
        await CostoHistorico.create(
          {
            ...payload,
            modeloId,
            costo: Number(vigente.costo),
            fechaCompra: fecha,
            nota: "Actualizacion desde lista de precios",
          },
          { transaction },
        );
        creados += 1;
      }
    }

    return { fechaVigencia: fecha, total: precios.length, creados, actualizados };
  });
};

module.exports = {
  esTelevisor,
  guardarListaPrecios,
  obtenerListaPrecios,
  validarFecha,
};
