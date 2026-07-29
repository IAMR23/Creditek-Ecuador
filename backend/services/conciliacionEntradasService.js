const { randomUUID } = require("crypto");
const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const CierreCaja = require("../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../models/CierreCaja/MovimientoCaja");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const ControlFinancieroConciliacionEntrada = require(
  "../models/ControlFinancieroConciliacionEntrada",
);

const TOLERANCIA_CENTAVOS = 1;
const TIPOS_VENTA = ["VENTA_TV", "VENTA_CELULAR"];
const ESTADOS_REVISION_MANUAL = [
  "PENDIENTE_REVISION",
  "COINCIDENCIA_AMBIGUA",
];
const PALABRAS_NOMBRE_IGNORADAS = new Set([
  "DE",
  "DEL",
  "EL",
  "LA",
  "LAS",
  "LOS",
  "Y",
]);

const errorServicio = (message, status = 400, code = null) => {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
};

const plano = (registro) =>
  registro?.get ? registro.get({ plain: true }) : registro;

const numero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const aCentavos = (value) => Math.round(numero(value) * 100);
const desdeCentavos = (value) => Number((Number(value || 0) / 100).toFixed(2));

const normalizarNombre = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const tokensNombre = (value) =>
  normalizarNombre(value)
    .split(" ")
    .filter(
      (token) =>
        token.length >= 2 && !PALABRAS_NOMBRE_IGNORADAS.has(token),
    );

const puntuarCoincidenciaParcial = (nombreCaja, nombreControl) => {
  const caja = normalizarNombre(nombreCaja);
  const control = normalizarNombre(nombreControl);
  if (!caja || !control || caja === control) return 0;

  const tokensCaja = new Set(tokensNombre(caja));
  const tokensControl = new Set(tokensNombre(control));
  if (tokensCaja.size < 2 || tokensControl.size < 2) return 0;

  const coincidencias = [...tokensCaja].filter((token) =>
    tokensControl.has(token),
  ).length;
  if (coincidencias < 2) return 0;

  const coberturaCorta =
    coincidencias / Math.min(tokensCaja.size, tokensControl.size);
  if (coberturaCorta < 0.6) return 0;

  const coberturaLarga =
    coincidencias / Math.max(tokensCaja.size, tokensControl.size);
  return Number((coberturaCorta * 0.7 + coberturaLarga * 0.3).toFixed(4));
};

const crearGrupoCaja = (movimiento, cierreId) => {
  const cliente = String(movimiento.entidad || "").trim() || null;
  const clienteNormalizado = normalizarNombre(cliente);
  return {
    key: clienteNormalizado || `__SIN_CLIENTE_CAJA__${movimiento.id}`,
    cliente,
    clienteNormalizado: clienteNormalizado || null,
    cierreIds: new Set([Number(cierreId)]),
    movimientoIds: [Number(movimiento.id)],
    entradaCentavos: aCentavos(movimiento.valor),
  };
};

const agruparMovimientosCaja = (movimientos = [], cierres = []) => {
  const cierresPorId = new Map(
    cierres.map((cierre) => {
      const item = plano(cierre);
      return [Number(item.id), item];
    }),
  );
  const grupos = new Map();

  movimientos.forEach((registro) => {
    const movimiento = plano(registro);
    const cierre = cierresPorId.get(Number(movimiento.cierreId));
    if (!cierre || normalizarNombre(movimiento.detalle) !== "ENTRADA") return;

    const nuevoGrupo = crearGrupoCaja(movimiento, movimiento.cierreId);
    const existente = grupos.get(nuevoGrupo.key);
    if (!existente) {
      grupos.set(nuevoGrupo.key, nuevoGrupo);
      return;
    }

    existente.movimientoIds.push(Number(movimiento.id));
    existente.cierreIds.add(Number(movimiento.cierreId));
    existente.entradaCentavos += aCentavos(movimiento.valor);
    if (!existente.cliente && nuevoGrupo.cliente) {
      existente.cliente = nuevoGrupo.cliente;
    }
  });

  return grupos;
};

const crearGrupoControl = (registro) => {
  const cliente = String(registro.cliente || "").trim() || null;
  const clienteNormalizado = normalizarNombre(cliente);
  return {
    key: clienteNormalizado || `__SIN_CLIENTE_CONTROL__${registro.id}`,
    cliente,
    clienteNormalizado: clienteNormalizado || null,
    contratos: new Set(
      registro.contrato ? [String(registro.contrato).trim()] : [],
    ),
    registroFinancieroIds: [Number(registro.id)],
    entradaCentavos: aCentavos(registro.entradas),
  };
};

const agruparRegistrosControl = (registros = []) => {
  const grupos = new Map();

  registros.forEach((item) => {
    const registro = plano(item);
    if (
      !TIPOS_VENTA.includes(registro.tipoRegistro) ||
      aCentavos(registro.entradas) <= 0
    ) {
      return;
    }

    const nuevoGrupo = crearGrupoControl(registro);
    const existente = grupos.get(nuevoGrupo.key);
    if (!existente) {
      grupos.set(nuevoGrupo.key, nuevoGrupo);
      return;
    }

    existente.registroFinancieroIds.push(Number(registro.id));
    nuevoGrupo.contratos.forEach((contrato) =>
      existente.contratos.add(contrato),
    );
    existente.entradaCentavos += aCentavos(registro.entradas);
    if (!existente.cliente && nuevoGrupo.cliente) {
      existente.cliente = nuevoGrupo.cliente;
    }
  });

  return grupos;
};

const ordenarNumeros = (values) =>
  [...new Set(values.map(Number).filter(Number.isFinite))].sort(
    (a, b) => a - b,
  );

const ordenarTextos = (values) =>
  [...new Set(values.filter(Boolean).map(String))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

const estadoPorDiferencia = (diferenciaCentavos) =>
  Math.abs(diferenciaCentavos) <= TOLERANCIA_CENTAVOS
    ? "CUADRADO"
    : "DIFERENCIA";

const crearResultado = ({
  fecha,
  grupoCaja = null,
  grupoControl = null,
  estado,
  tipoCoincidencia,
  candidatosControl = [],
  confirmacionManual = null,
  entradaRealCentavos = null,
  contratos = null,
  incluirReferenciasControl = true,
}) => {
  const cajaCentavos = grupoCaja?.entradaCentavos || 0;
  const controlCentavos =
    entradaRealCentavos ?? grupoControl?.entradaCentavos ?? 0;
  const cierreIds = ordenarNumeros(
    grupoCaja ? [...grupoCaja.cierreIds] : [],
  );

  return {
    id: randomUUID(),
    fecha,
    cierreId: cierreIds.length === 1 ? cierreIds[0] : null,
    cierreIds,
    clienteCaja: grupoCaja?.cliente || null,
    clienteCajaNormalizado: grupoCaja?.clienteNormalizado || null,
    clienteControl: grupoControl?.cliente || null,
    clienteControlNormalizado:
      grupoControl?.clienteNormalizado || null,
    contratos: ordenarTextos(
      contratos || (grupoControl ? [...grupoControl.contratos] : []),
    ),
    movimientoIds: ordenarNumeros(grupoCaja?.movimientoIds || []),
    registroFinancieroIds: ordenarNumeros(
      incluirReferenciasControl
        ? grupoControl?.registroFinancieroIds || []
        : [],
    ),
    candidatosControl,
    entradaCaja: desdeCentavos(cajaCentavos),
    entradaReal: desdeCentavos(controlCentavos),
    diferencia: desdeCentavos(cajaCentavos - controlCentavos),
    estado,
    tipoCoincidencia,
    confirmadaManualmente: Boolean(confirmacionManual),
    confirmadoPor: confirmacionManual?.confirmadoPor || null,
    confirmadoEn: confirmacionManual?.confirmadoEn || null,
    observacionRevision: confirmacionManual?.observacion || null,
  };
};

const serializarCandidato = (grupo, score) => ({
  clienteControl: grupo.cliente,
  clienteControlNormalizado: grupo.clienteNormalizado,
  contratos: ordenarTextos([...grupo.contratos]),
  registroFinancieroIds: ordenarNumeros(grupo.registroFinancieroIds),
  entradaReal: desdeCentavos(grupo.entradaCentavos),
  score,
});

const construirResultadosConciliacion = ({
  fecha,
  cierres = [],
  movimientos = [],
  registros = [],
  reglasManuales = [],
}) => {
  const gruposCaja = agruparMovimientosCaja(movimientos, cierres);
  const gruposControl = agruparRegistrosControl(registros);
  const cajaConsumida = new Set();
  const controlConsumido = new Set();
  const resultados = [];

  reglasManuales.forEach((regla) => {
    const claveCaja = normalizarNombre(regla.clienteCajaNormalizado);
    const claveControl = normalizarNombre(regla.clienteControlNormalizado);
    const grupoCaja = gruposCaja.get(claveCaja);
    const grupoControl = gruposControl.get(claveControl);

    if (
      !grupoCaja ||
      !grupoControl ||
      cajaConsumida.has(claveCaja) ||
      controlConsumido.has(claveControl)
    ) {
      return;
    }

    const diferencia =
      grupoCaja.entradaCentavos - grupoControl.entradaCentavos;
    resultados.push(
      crearResultado({
        fecha,
        grupoCaja,
        grupoControl,
        estado: estadoPorDiferencia(diferencia),
        tipoCoincidencia: "MANUAL",
        confirmacionManual: regla,
      }),
    );
    cajaConsumida.add(claveCaja);
    controlConsumido.add(claveControl);
  });

  gruposCaja.forEach((grupoCaja, claveCaja) => {
    if (
      cajaConsumida.has(claveCaja) ||
      !grupoCaja.clienteNormalizado ||
      !gruposControl.has(claveCaja) ||
      controlConsumido.has(claveCaja)
    ) {
      return;
    }

    const grupoControl = gruposControl.get(claveCaja);
    const diferencia =
      grupoCaja.entradaCentavos - grupoControl.entradaCentavos;
    resultados.push(
      crearResultado({
        fecha,
        grupoCaja,
        grupoControl,
        estado: estadoPorDiferencia(diferencia),
        tipoCoincidencia: "EXACTA",
      }),
    );
    cajaConsumida.add(claveCaja);
    controlConsumido.add(claveCaja);
  });

  const cajasPendientes = [...gruposCaja.entries()].filter(
    ([key]) => !cajaConsumida.has(key),
  );
  const controlesPendientes = [...gruposControl.entries()].filter(
    ([key]) => !controlConsumido.has(key),
  );
  const candidatosPorCaja = new Map();
  const cajasPorControl = new Map();

  cajasPendientes.forEach(([claveCaja, grupoCaja]) => {
    const candidatos = controlesPendientes
      .map(([claveControl, grupoControl]) => ({
        claveControl,
        grupoControl,
        score: puntuarCoincidenciaParcial(
          grupoCaja.clienteNormalizado,
          grupoControl.clienteNormalizado,
        ),
      }))
      .filter((candidato) => candidato.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          String(a.grupoControl.cliente || "").localeCompare(
            String(b.grupoControl.cliente || ""),
            "es",
          ),
      );

    candidatosPorCaja.set(claveCaja, candidatos);
    candidatos.forEach(({ claveControl }) => {
      if (!cajasPorControl.has(claveControl)) {
        cajasPorControl.set(claveControl, new Set());
      }
      cajasPorControl.get(claveControl).add(claveCaja);
    });
  });

  cajasPendientes.forEach(([claveCaja, grupoCaja]) => {
    const candidatos = candidatosPorCaja.get(claveCaja) || [];
    if (!candidatos.length) {
      resultados.push(
        crearResultado({
          fecha,
          grupoCaja,
          estado: "SOLO_EN_CAJA",
          tipoCoincidencia: "SIN_COINCIDENCIA",
        }),
      );
      return;
    }

    const esUnicoMutuo =
      candidatos.length === 1 &&
      cajasPorControl.get(candidatos[0].claveControl)?.size === 1;
    const candidatosSerializados = candidatos.map(
      ({ grupoControl, score }) =>
        serializarCandidato(grupoControl, score),
    );
    const entradaCandidataCentavos = candidatos.reduce(
      (total, candidato) => total + candidato.grupoControl.entradaCentavos,
      0,
    );
    const contratosCandidatos = candidatos.flatMap(({ grupoControl }) => [
      ...grupoControl.contratos,
    ]);

    resultados.push(
      crearResultado({
        fecha,
        grupoCaja,
        grupoControl: esUnicoMutuo ? candidatos[0].grupoControl : null,
        estado: esUnicoMutuo
          ? "PENDIENTE_REVISION"
          : "COINCIDENCIA_AMBIGUA",
        tipoCoincidencia: "PARCIAL_NO_CONFIRMADA",
        candidatosControl: candidatosSerializados,
        entradaRealCentavos: entradaCandidataCentavos,
        contratos: contratosCandidatos,
        incluirReferenciasControl: false,
      }),
    );
  });

  controlesPendientes.forEach(([claveControl, grupoControl]) => {
    if (cajasPorControl.has(claveControl)) return;
    resultados.push(
      crearResultado({
        fecha,
        grupoControl,
        estado: "SOLO_EN_CONTROL",
        tipoCoincidencia: "SIN_COINCIDENCIA",
      }),
    );
  });

  const totalCajaCentavos = [...gruposCaja.values()].reduce(
    (total, grupo) => total + grupo.entradaCentavos,
    0,
  );
  const totalControlCentavos = [...gruposControl.values()].reduce(
    (total, grupo) => total + grupo.entradaCentavos,
    0,
  );
  const contar = (estado) =>
    resultados.filter((resultado) => resultado.estado === estado).length;

  return {
    resultados,
    resumen: {
      totalDeclarado: desdeCentavos(totalCajaCentavos),
      totalReal: desdeCentavos(totalControlCentavos),
      diferenciaTotal: desdeCentavos(
        totalCajaCentavos - totalControlCentavos,
      ),
      cuadrados: contar("CUADRADO"),
      diferencias: contar("DIFERENCIA"),
      soloCaja: contar("SOLO_EN_CAJA"),
      soloControl: contar("SOLO_EN_CONTROL"),
      coincidenciasAmbiguas: contar("COINCIDENCIA_AMBIGUA"),
      pendientesRevision: contar("PENDIENTE_REVISION"),
      totalResultados: resultados.length,
    },
  };
};

const serializarConciliacion = (registro) => {
  if (!registro) return null;
  const item = plano(registro);
  return {
    ...item,
    id: String(item.id),
    resultados: Array.isArray(item.resultados) ? item.resultados : [],
    resumen: item.resumen || {},
    reglasManuales: Array.isArray(item.reglasManuales)
      ? item.reglasManuales
      : [],
    cierreIds: Array.isArray(item.cierreIds) ? item.cierreIds : [],
  };
};

const obtenerUltimaConciliacion = async (cargaId, options = {}) =>
  ControlFinancieroConciliacionEntrada.findOne({
    where: { cargaId },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    transaction: options.transaction,
  });

const combinarReglaManual = (reglas, reglaAdicional) => {
  if (!reglaAdicional) return reglas;

  const conflicto = reglas.find(
    (regla) =>
      regla.clienteControlNormalizado ===
        reglaAdicional.clienteControlNormalizado &&
      regla.clienteCajaNormalizado !==
        reglaAdicional.clienteCajaNormalizado,
  );
  if (conflicto) {
    throw errorServicio(
      "El cliente de Control Financiero ya tiene una coincidencia manual confirmada.",
      409,
      "CONTROL_YA_CONFIRMADO",
    );
  }

  return [
    ...reglas.filter(
      (regla) =>
        regla.clienteCajaNormalizado !==
        reglaAdicional.clienteCajaNormalizado,
    ),
    reglaAdicional,
  ];
};

const conciliarCarga = async ({
  cargaId,
  origen = "MANUAL",
  usuarioId = null,
  reglaManualAdicional = null,
}) => {
  const id = Number(cargaId);
  if (!Number.isInteger(id) || id < 1) {
    throw errorServicio("Carga de control financiero no valida.");
  }

  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      "SELECT pg_advisory_xact_lock(hashtext('conciliacion_entradas'), :cargaId)",
      { replacements: { cargaId: id }, transaction },
    );

    const cargaRegistro = await ControlFinancieroCarga.findByPk(id, {
      transaction,
    });
    if (!cargaRegistro) {
      throw errorServicio(
        "Carga de control financiero no encontrada.",
        404,
        "CARGA_NO_ENCONTRADA",
      );
    }

    const carga = plano(cargaRegistro);
    if (!carga.fechaReporte) {
      throw errorServicio(
        "La carga no tiene una fecha de reporte valida para conciliar.",
        409,
      );
    }

    const cierres = await CierreCaja.findAll({
      where: {
        fecha: carga.fechaReporte,
        estadoCierre: "CERRADO",
      },
      attributes: ["id", "fecha"],
      order: [["id", "ASC"]],
      transaction,
    });
    const cierreIds = cierres.map((cierre) => Number(plano(cierre).id));
    const movimientos = cierreIds.length
      ? await MovimientoCaja.findAll({
          where: { cierreId: { [Op.in]: cierreIds } },
          attributes: ["id", "cierreId", "detalle", "entidad", "valor"],
          order: [["id", "ASC"]],
          transaction,
        })
      : [];
    const registros = await ControlFinancieroRegistro.findAll({
      where: {
        cargaId: id,
        tipoRegistro: { [Op.in]: TIPOS_VENTA },
        entradas: { [Op.gt]: 0 },
      },
      attributes: [
        "id",
        "tipoRegistro",
        "cliente",
        "contrato",
        "entradas",
      ],
      order: [["id", "ASC"]],
      transaction,
    });
    const ultima = await obtenerUltimaConciliacion(id, { transaction });
    const reglasPrevias = Array.isArray(plano(ultima)?.reglasManuales)
      ? plano(ultima).reglasManuales
      : [];
    const reglasManuales = combinarReglaManual(
      reglasPrevias,
      reglaManualAdicional,
    );
    const calculo = construirResultadosConciliacion({
      fecha: carga.fechaReporte,
      cierres,
      movimientos,
      registros,
      reglasManuales,
    });
    const idsCierre = ordenarNumeros(cierreIds);
    const conciliacion = await ControlFinancieroConciliacionEntrada.create(
      {
        ejecucionId: randomUUID(),
        cargaId: id,
        fecha: carga.fechaReporte,
        cierreId: idsCierre.length === 1 ? idsCierre[0] : null,
        cierreIds: idsCierre,
        origen: String(origen || "MANUAL").slice(0, 30),
        resultados: calculo.resultados,
        resumen: calculo.resumen,
        reglasManuales,
        ejecutadoPor: Number(usuarioId) || null,
      },
      { transaction },
    );

    return serializarConciliacion(conciliacion);
  });
};

const conciliarCargasPorFecha = async ({
  fecha,
  origen,
  usuarioId = null,
}) => {
  const fechaIso = String(fecha || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) {
    throw errorServicio("Fecha de cierre no valida para conciliar.");
  }

  const cargas = await ControlFinancieroCarga.findAll({
    where: { fechaReporte: fechaIso, estado: "ACTIVA" },
    attributes: ["id"],
    order: [["id", "ASC"]],
  });
  const conciliaciones = [];

  for (const carga of cargas) {
    conciliaciones.push(
      await conciliarCarga({
        cargaId: plano(carga).id,
        origen,
        usuarioId,
      }),
    );
  }

  return {
    fecha: fechaIso,
    cargasProcesadas: conciliaciones.length,
    conciliaciones,
  };
};

const obtenerConciliacionCarga = async (cargaId) => {
  const id = Number(cargaId);
  if (!Number.isInteger(id) || id < 1) {
    throw errorServicio("Carga de control financiero no valida.");
  }

  const carga = await ControlFinancieroCarga.findByPk(id, {
    attributes: ["id", "fechaReporte", "estado"],
  });
  if (!carga) {
    throw errorServicio(
      "Carga de control financiero no encontrada.",
      404,
      "CARGA_NO_ENCONTRADA",
    );
  }

  return {
    carga: plano(carga),
    conciliacion: serializarConciliacion(
      await obtenerUltimaConciliacion(id),
    ),
  };
};

const confirmarCoincidenciaManual = async ({
  cargaId,
  resultadoId,
  clienteControlNormalizado,
  observacion,
  usuarioId,
}) => {
  const id = Number(cargaId);
  const usuario = Number(usuarioId);
  if (!Number.isInteger(id) || id < 1) {
    throw errorServicio("Carga de control financiero no valida.");
  }
  if (!resultadoId || !normalizarNombre(clienteControlNormalizado)) {
    throw errorServicio("Debe seleccionar una coincidencia para confirmar.");
  }
  if (!Number.isInteger(usuario) || usuario < 1) {
    throw errorServicio(
      "No se pudo identificar al usuario que confirma la coincidencia.",
      401,
    );
  }

  const ultima = await obtenerUltimaConciliacion(id);
  if (!ultima) {
    throw errorServicio(
      "La carga aun no tiene una conciliacion de entradas.",
      409,
    );
  }

  const datos = plano(ultima);
  const resultado = (datos.resultados || []).find(
    (item) => item.id === resultadoId,
  );
  if (!resultado) {
    throw errorServicio(
      "El resultado de conciliacion ya no esta disponible.",
      404,
    );
  }
  if (!ESTADOS_REVISION_MANUAL.includes(resultado.estado)) {
    throw errorServicio(
      "Este resultado no requiere una confirmacion manual.",
      409,
    );
  }

  const claveControl = normalizarNombre(clienteControlNormalizado);
  const candidato = (resultado.candidatosControl || []).find(
    (item) =>
      normalizarNombre(item.clienteControlNormalizado) === claveControl,
  );
  if (!candidato || !resultado.clienteCajaNormalizado) {
    throw errorServicio(
      "La coincidencia seleccionada no pertenece a los candidatos vigentes.",
      409,
    );
  }

  const observacionLimpia = String(observacion || "").trim();
  if (observacionLimpia.length > 1000) {
    throw errorServicio(
      "La observacion no puede superar 1000 caracteres.",
    );
  }

  return conciliarCarga({
    cargaId: id,
    origen: "CONFIRMACION_MANUAL",
    usuarioId: usuario,
    reglaManualAdicional: {
      id: randomUUID(),
      fecha: datos.fecha,
      clienteCajaNormalizado: normalizarNombre(
        resultado.clienteCajaNormalizado,
      ),
      clienteControlNormalizado: claveControl,
      confirmadoPor: usuario,
      confirmadoEn: new Date().toISOString(),
      observacion: observacionLimpia || null,
    },
  });
};

module.exports = {
  ESTADOS_REVISION_MANUAL,
  TOLERANCIA_CENTAVOS,
  TIPOS_VENTA,
  construirResultadosConciliacion,
  conciliarCarga,
  conciliarCargasPorFecha,
  confirmarCoincidenciaManual,
  normalizarNombre,
  obtenerConciliacionCarga,
  puntuarCoincidenciaParcial,
  serializarConciliacion,
};
