const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroConciliacionCaja = require(
  "../models/ControlFinancieroConciliacionCaja",
);
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const EgresoCreditekEntrada = require("../models/EgresoCreditekEntrada");
const RolCreditekAjuste = require("../models/RolCreditekAjuste");
const Usuario = require("../models/Usuario");
const pagosComisionesService = require("./pagosComisionesService");

const CAMPOS_MANUALES = [
  "adelantosTransfer",
  "deudaJimena",
  "atrasos",
  "diasNoLaborables",
  "multasFacturacion",
  "planmovi",
  "prestamo",
  "mecanica",
  "pagosLentes",
];
const CAMPOS_CALCULADOS = [
  "descuentosMeta",
  "cajaGeneral",
  "entradas",
  "descuentos",
];
const CAMPOS_CALCULADOS_MANUALES = CAMPOS_CALCULADOS.map(
  (campo) => `${campo}Manual`,
);
const CAMPOS_PRESTAMOS = ["planmovi", "prestamo", "mecanica", "pagosLentes"];
const CAMPOS_INGRESOS = ["ingresosComisiones"];
const CAMPOS_NOMINA_MANUALES = ["sueldo"];
const CAMPOS_ANTICIPOS = [
  "adelantosTransfer",
  "descuentosMeta",
  "cajaGeneral",
  "entradas",
  "descuentos",
  "deudaJimena",
  "atrasos",
  "diasNoLaborables",
  "multasFacturacion",
];
const MAX_VALOR = 9999999999.99;

const crearError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const redondear = (value) => Number((Number(value) || 0).toFixed(2));

const normalizarPeriodo = ({ anio, mes }) => {
  const anioNumero = Number(anio);
  const mesNumero = Number(mes);
  if (!Number.isInteger(anioNumero) || anioNumero < 2000 || anioNumero > 2100) {
    throw crearError("El anio del periodo no es valido");
  }
  if (!Number.isInteger(mesNumero) || mesNumero < 1 || mesNumero > 12) {
    throw crearError("El mes del periodo no es valido");
  }
  return { anio: anioNumero, mes: mesNumero };
};

const normalizarId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw crearError(`${label} no es valido`);
  return id;
};

const normalizarValor = (value, label) => {
  const numero = Number(
    typeof value === "string" ? value.trim().replace(",", ".") : value,
  );
  if (!Number.isFinite(numero) || numero < 0 || numero > MAX_VALOR) {
    throw crearError(`${label} debe ser un numero mayor o igual a cero`);
  }
  return redondear(numero);
};

const normalizarValorOpcional = (value, label) => {
  if (value === null || value === undefined || value === "") return null;
  return normalizarValor(value, label);
};

const limitesMes = ({ anio, mes }) => {
  const inicio = new Date(Date.UTC(anio, mes - 1, 1, 5, 0, 0));
  const fin = new Date(Date.UTC(anio, mes, 1, 5, 0, 0));
  const fechaInicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fechaFin = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  return { inicio, fin, fechaInicio, fechaFin };
};

const acumular = (mapa, usuarioIdValue, campo, valor) => {
  const usuarioId = Number(usuarioIdValue);
  if (!Number.isInteger(usuarioId) || usuarioId < 1) return;
  if (!mapa.has(usuarioId)) mapa.set(usuarioId, {});
  const actual = mapa.get(usuarioId);
  actual[campo] = redondear((actual[campo] || 0) + Number(valor || 0));
};

const obtenerValorIngresoComision = (persona, tipo) => {
  if (tipo === "logistica") {
    return (
      persona?.resumenMensual?.totalPagar ??
      persona?.total?.totalComisiones ??
      0
    );
  }
  return (
    persona?.resumenMensual?.totalComisionesSemanaMensual ??
    persona?.total?.totalComisiones ??
    0
  );
};

const acumularIngresoComision = (mapa, persona, tipo) => {
  const usuarioId = Number(persona?.usuarioId);
  if (!Number.isInteger(usuarioId) || usuarioId < 1) return;
  if (!mapa.has(usuarioId)) {
    mapa.set(usuarioId, {
      usuarioId,
      nombre: persona?.nombre || `Usuario #${usuarioId}`,
      cargo: persona?.cargoComision || persona?.cargo || "",
      ingresosComisiones: 0,
      tiposIngreso: new Set(),
    });
  }

  const actual = mapa.get(usuarioId);
  if (!actual.cargo && (persona?.cargoComision || persona?.cargo)) {
    actual.cargo = persona.cargoComision || persona.cargo;
  }
  actual.ingresosComisiones = redondear(
    actual.ingresosComisiones + Number(obtenerValorIngresoComision(persona, tipo) || 0),
  );
  actual.tiposIngreso.add(tipo);
};

const construirIngresosComisiones = (reporteComisiones) => {
  const ingresosPorUsuario = new Map();
  (reporteComisiones?.vendedores || []).forEach((vendedor) => {
    acumularIngresoComision(ingresosPorUsuario, vendedor, "comercial");
  });
  (reporteComisiones?.logistica || []).forEach((persona) => {
    acumularIngresoComision(ingresosPorUsuario, persona, "logistica");
  });

  return [...ingresosPorUsuario.values()]
    .map((item) => ({
      ...item,
      tiposIngreso: [...item.tiposIngreso].sort(),
    }))
    .sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
};

const serializarAjuste = (row) => {
  const value = typeof row?.toJSON === "function" ? row.toJSON() : row || {};
  return {
    ...Object.fromEntries(
      CAMPOS_MANUALES.map((campo) => [campo, redondear(value[campo])]),
    ),
    ...Object.fromEntries(
      CAMPOS_NOMINA_MANUALES.map((campo) => [campo, redondear(value[campo])]),
    ),
    ...Object.fromEntries(
      CAMPOS_CALCULADOS_MANUALES.map((campo) => [
        campo,
        value[campo] === null || value[campo] === undefined
          ? null
          : redondear(value[campo]),
      ]),
    ),
  };
};

const obtenerUltimasConciliacionesCajaPorCarga = async (cargaIds) => {
  const ids = [
    ...new Set(
      cargaIds.map((id) => Number(id)).filter((id) => Number.isInteger(id)),
    ),
  ];
  if (!ids.length) return new Map();

  const conciliaciones = await ControlFinancieroConciliacionCaja.findAll({
    where: { cargaId: { [Op.in]: ids } },
    attributes: ["id", "cargaId", "resultados", "createdAt"],
    order: [["cargaId", "ASC"], ["createdAt", "DESC"], ["id", "DESC"]],
  });

  const porCarga = new Map();
  conciliaciones.forEach((item) => {
    const conciliacion =
      typeof item?.toJSON === "function" ? item.toJSON() : item;
    const cargaId = Number(conciliacion?.cargaId);
    if (!porCarga.has(cargaId)) porCarga.set(cargaId, conciliacion);
  });
  return porCarga;
};

const filtrarCajasNoEnCierre = async (registros) => {
  if (!registros.length) return [];

  const conciliacionesPorCarga = await obtenerUltimasConciliacionesCajaPorCarga(
    registros.map((registro) => {
      const item =
        typeof registro?.toJSON === "function" ? registro.toJSON() : registro;
      return item?.cargaId;
    }),
  );

  return registros.filter((registro) => {
    const item =
      typeof registro?.toJSON === "function" ? registro.toJSON() : registro;
    const conciliacion = conciliacionesPorCarga.get(Number(item.cargaId));
    return Array.isArray(conciliacion?.resultados)
      ? conciliacion.resultados.some(
          (resultado) =>
            Number(resultado?.controlFinancieroRegistroId) ===
              Number(item.id) && resultado?.estado === "NO_EN_CIERRE",
        )
      : false;
  });
};

const obtenerResumen = async (periodoValue) => {
  const periodo = normalizarPeriodo(periodoValue);
  const { inicio, fin, fechaInicio, fechaFin } = limitesMes(periodo);

  const [
    usuarios,
    egresos,
    entradasControl,
    cajasControlValues,
    ajustes,
    reporteComisiones,
  ] =
    await Promise.all([
      Usuario.findAll({
        where: { activo: true },
        attributes: ["id", "nombre", "activo"],
        order: [["nombre", "ASC"], ["id", "ASC"]],
      }),
      EgresoCreditekEntrada.findAll({
        where: {
          activo: true,
          createdAt: { [Op.gte]: inicio, [Op.lt]: fin },
        },
        attributes: ["usuarioId", "seccion", "valor"],
      }),
      ControlFinancieroRegistro.findAll({
        where: {
          tipoRegistro: { [Op.in]: ["VENTA_TV", "VENTA_CELULAR"] },
          entradas: { [Op.gt]: 0 },
          responsablePagoEntradaId: { [Op.ne]: null },
          fecha: { [Op.between]: [fechaInicio, fechaFin] },
        },
        attributes: ["responsablePagoEntradaId", "entradas"],
        include: [
          {
            model: ControlFinancieroCarga,
            as: "carga",
            attributes: [],
            where: { estado: "ACTIVA" },
            required: true,
          },
        ],
      }),
      ControlFinancieroRegistro.findAll({
        where: {
          tipoRegistro: "CAJA",
          pagosCuotas: { [Op.gt]: 0 },
          responsablePagoEntradaId: { [Op.ne]: null },
        },
        attributes: ["id", "cargaId", "responsablePagoEntradaId", "pagosCuotas"],
        include: [
          {
            model: ControlFinancieroCarga,
            as: "carga",
            attributes: [],
            where: {
              estado: "ACTIVA",
              fechaReporte: { [Op.between]: [fechaInicio, fechaFin] },
            },
            required: true,
          },
        ],
      }),
      RolCreditekAjuste.findAll({ where: periodo }),
      pagosComisionesService.obtenerReportePagosComisiones({
        year: periodo.anio,
        month: periodo.mes,
      }),
    ]);

  const valoresPorUsuario = new Map();
  const camposSeccion = {
    CAJAS: "cajaGeneral",
    ENTRADAS: "entradas",
    DESCUENTOS: "descuentos",
  };
  egresos.forEach((row) => {
    const campo = camposSeccion[String(row.seccion || "").toUpperCase()];
    if (campo) acumular(valoresPorUsuario, row.usuarioId, campo, row.valor);
  });
  entradasControl.forEach((row) =>
    acumular(
      valoresPorUsuario,
      row.responsablePagoEntradaId,
      "entradas",
      row.entradas,
    ),
  );
  const cajasControl = await filtrarCajasNoEnCierre(cajasControlValues);
  cajasControl.forEach((row) => {
    const item = typeof row?.toJSON === "function" ? row.toJSON() : row;
    acumular(
      valoresPorUsuario,
      item.responsablePagoEntradaId,
      "cajaGeneral",
      item.pagosCuotas,
    );
  });
  (reporteComisiones?.vendedores || []).forEach((vendedor) => {
    acumular(
      valoresPorUsuario,
      vendedor.usuarioId,
      "descuentosMeta",
      vendedor.total?.valorDescontar ??
        vendedor.resumenMensual?.totalValorDescontar,
    );
  });
  const ingresos = construirIngresosComisiones(reporteComisiones);
  ingresos.forEach((row) => {
    acumular(
      valoresPorUsuario,
      row.usuarioId,
      "ingresosComisiones",
      row.ingresosComisiones,
    );
  });

  const ajustesPorUsuario = new Map(
    ajustes.map((row) => [Number(row.usuarioId), serializarAjuste(row)]),
  );

  const registros = usuarios.map((usuarioValue) => {
    const usuario =
      typeof usuarioValue?.toJSON === "function"
        ? usuarioValue.toJSON()
        : usuarioValue;
    const automaticos = valoresPorUsuario.get(Number(usuario.id)) || {};
    const manuales = ajustesPorUsuario.get(Number(usuario.id)) ||
      serializarAjuste();
    const valoresCalculados = {
      ingresosComisiones: redondear(automaticos.ingresosComisiones),
      descuentosMeta: redondear(automaticos.descuentosMeta),
      cajaGeneral: redondear(automaticos.cajaGeneral),
      entradas: redondear(automaticos.entradas),
      descuentos: redondear(automaticos.descuentos),
    };
    const valores = {
      ...valoresCalculados,
      ...Object.fromEntries(
        CAMPOS_CALCULADOS.map((campo) => {
          const campoManual = `${campo}Manual`;
          return [
            campo,
            manuales[campoManual] === null || manuales[campoManual] === undefined
              ? valoresCalculados[campo]
              : manuales[campoManual],
          ];
        }),
      ),
      ...manuales,
    };
    const totalAnticipos = redondear(
      CAMPOS_ANTICIPOS.reduce(
        (total, campo) => total + Number(valores[campo] || 0),
        0,
      ),
    );
    const sumanPrestamos = redondear(
      CAMPOS_PRESTAMOS.reduce(
        (total, campo) => total + Number(valores[campo] || 0),
        0,
      ),
    );
    const totalDescuentos = redondear(totalAnticipos + sumanPrestamos);
    const totalNomina = redondear(
      Number(valores.ingresosComisiones || 0) - totalDescuentos,
    );
    const totalPagarNomina = redondear(
      totalNomina + Number(valores.sueldo || 0),
    );
    return {
      usuarioId: Number(usuario.id),
      nombre: usuario.nombre || `Usuario #${usuario.id}`,
      usuarioActivo: usuario.activo !== false,
      ...valores,
      ...Object.fromEntries(
        CAMPOS_CALCULADOS.map((campo) => [
          `${campo}Calculado`,
          valoresCalculados[campo],
        ]),
      ),
      totalAnticipos,
      sumanPrestamos,
      totalDescuentos,
      totalNomina,
      totalPagarNomina,
    };
  });

  const totales = registros.reduce(
    (resultado, row) => {
      Object.keys(resultado).forEach((campo) => {
        resultado[campo] = redondear(resultado[campo] + Number(row[campo] || 0));
      });
      return resultado;
    },
    {
      adelantosTransfer: 0,
      descuentosMeta: 0,
      cajaGeneral: 0,
      entradas: 0,
      descuentos: 0,
      deudaJimena: 0,
      atrasos: 0,
      diasNoLaborables: 0,
      multasFacturacion: 0,
      planmovi: 0,
      prestamo: 0,
      mecanica: 0,
      pagosLentes: 0,
      sueldo: 0,
      ingresosComisiones: 0,
      totalAnticipos: 0,
      sumanPrestamos: 0,
      totalDescuentos: 0,
      totalNomina: 0,
      totalPagarNomina: 0,
    },
  );
  totales.ingresosComisiones = redondear(
    ingresos.reduce(
      (total, row) => total + Number(row.ingresosComisiones || 0),
      0,
    ),
  );

  return {
    ...periodo,
    fechaInicio,
    fechaFin,
    registros,
    ingresos,
    totales,
  };
};

const guardarAjustes = async ({ anio, mes, registros }, actualizadoPorValue) => {
  const periodo = normalizarPeriodo({ anio, mes });
  const actualizadoPorId = normalizarId(
    actualizadoPorValue,
    "El usuario actualizador",
  );
  if (!Array.isArray(registros) || registros.length < 1) {
    throw crearError("Debe enviar al menos un registro");
  }
  if (registros.length > 500) {
    throw crearError("Solo se pueden guardar hasta 500 registros por operacion");
  }

  const vistos = new Set();
  const valores = registros.map((registro, index) => {
    try {
      const usuarioId = normalizarId(registro.usuarioId, "El usuario");
      if (vistos.has(usuarioId)) throw crearError("El usuario esta repetido");
      vistos.add(usuarioId);
      return {
        usuarioId,
        ...periodo,
        ...Object.fromEntries(
          CAMPOS_MANUALES.map((campo) => [
            campo,
            normalizarValor(registro[campo] ?? 0, campo),
          ]),
        ),
        ...Object.fromEntries(
          CAMPOS_NOMINA_MANUALES.map((campo) => [
            campo,
            normalizarValor(registro[campo] ?? 0, campo),
          ]),
        ),
        ...Object.fromEntries(
          CAMPOS_CALCULADOS_MANUALES.map((campo) => [
            campo,
            normalizarValorOpcional(registro[campo], campo),
          ]),
        ),
        actualizadoPorId,
      };
    } catch (error) {
      error.message = `Registro ${index + 1}: ${error.message}`;
      throw error;
    }
  });

  const usuariosValidos = await Usuario.count({
    where: { id: { [Op.in]: valores.map((item) => item.usuarioId) } },
  });
  if (usuariosValidos !== valores.length) {
    throw crearError("Uno o mas usuarios no existen");
  }

  await sequelize.transaction(async (transaction) => {
    for (const value of valores) {
      const [ajuste] = await RolCreditekAjuste.findOrCreate({
        where: {
          usuarioId: value.usuarioId,
          anio: value.anio,
          mes: value.mes,
        },
        defaults: value,
        transaction,
      });
      await ajuste.update(value, { transaction });
    }
  });

  return { message: "Ajustes guardados correctamente", total: valores.length };
};

module.exports = {
  CAMPOS_MANUALES,
  guardarAjustes,
  normalizarPeriodo,
  normalizarValor,
  obtenerResumen,
};
