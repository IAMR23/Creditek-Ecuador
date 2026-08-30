const { randomUUID } = require("crypto");
const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Cliente = require("../models/Cliente");
const CierreCaja = require("../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../models/CierreCaja/MovimientoCaja");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const ControlFinancieroConciliacionCaja = require(
  "../models/ControlFinancieroConciliacionCaja",
);
const {
  aCentavos,
  calcularSimilitudNombres,
  desdeCentavos,
  esNombreReportePrefijo,
  normalizarFechaCalendario,
  normalizarNombre,
} = require("./conciliacionFinancieraUtils");

const ESTADOS_CIERRE_CONCILIABLES = ["CERRADO"];
const UMBRAL_SIMILITUD_NOMBRE = 0.9;

const plano = (registro) =>
  registro?.get ? registro.get({ plain: true }) : registro;

const errorServicio = (message, status = 400, code = null) => {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
};

const ordenarNumeros = (values) =>
  [
    ...new Set(
      values
        .filter(
          (value) =>
            value !== null && value !== undefined && String(value) !== "",
        )
        .map(Number)
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  ].sort(
    (a, b) => a - b,
  );

const ordenarTextos = (values) =>
  [...new Set(values.filter(Boolean).map(String))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

const claveExacta = (fecha, cliente, montoCentavos) =>
  `${fecha}|${cliente}|${montoCentavos}`;

const claveClienteFecha = (fecha, cliente) => `${fecha}|${cliente}`;

const obtenerNombreMovimiento = (movimiento, clientesPorId) => {
  const clienteId = Number(movimiento.clienteId) || null;
  if (clienteId) {
    const cliente = clientesPorId.get(clienteId);
    return String(cliente?.cliente || "").trim() || null;
  }

  return String(movimiento.entidad || "").trim() || null;
};

const prepararRegistrosReporte = (registros) =>
  registros
    .map(plano)
    .filter((registro) => registro?.tipoRegistro === "CAJA")
    .map((registro, index) => {
      const clienteReporte = String(registro.cliente || "").trim() || null;
      return {
        ...registro,
        _key: `${registro.id || "sin-id"}-${index}`,
        fechaNormalizada: normalizarFechaCalendario(registro.fecha),
        clienteReporte,
        clienteNormalizado: normalizarNombre(clienteReporte) || null,
        montoReporteCentavos: aCentavos(registro.pagosCuotas),
      };
    });

const prepararMovimientosCierre = ({
  movimientos,
  cierres,
  clientes,
}) => {
  const cierresPorId = new Map(
    cierres.map((item) => {
      const cierre = plano(item);
      return [Number(cierre.id), cierre];
    }),
  );
  const clientesPorId = new Map(
    clientes.map((item) => {
      const cliente = plano(item);
      return [Number(cliente.id), cliente];
    }),
  );

  return movimientos
    .map(plano)
    .filter((movimiento) => normalizarNombre(movimiento.detalle) === "CUOTA")
    .map((movimiento) => {
      const cierre = cierresPorId.get(Number(movimiento.cierreId));
      const clienteCierre = obtenerNombreMovimiento(
        movimiento,
        clientesPorId,
      );
      return {
        ...movimiento,
        cierre,
        fechaNormalizada: normalizarFechaCalendario(cierre?.fecha),
        clienteCierre,
        clienteNormalizado: normalizarNombre(clienteCierre) || null,
        montoCierreCentavos: aCentavos(movimiento.valor),
      };
    });
};

const crearResultado = ({
  registro = null,
  movimiento = null,
  estado,
  tipoCoincidencia = null,
  similitudCliente = null,
  montoCierreAsignadoCentavos = null,
  agrupacionCaja = null,
}) => {
  const montoReporteCentavos = registro?.montoReporteCentavos ?? 0;
  const montoMovimientoCentavos = movimiento?.montoCierreCentavos ?? 0;
  const montoCierreCentavos =
    montoCierreAsignadoCentavos === null
      ? montoMovimientoCentavos
      : montoCierreAsignadoCentavos;
  const diferenciaCentavos = montoReporteCentavos - montoCierreCentavos;

  return {
    id: randomUUID(),
    controlFinancieroRegistroId: registro?.id
      ? Number(registro.id)
      : null,
    movimientoCajaId: movimiento?.id ? Number(movimiento.id) : null,
    cierreId: movimiento?.cierreId ? Number(movimiento.cierreId) : null,
    clienteId: movimiento?.clienteId
      ? Number(movimiento.clienteId)
      : null,
    fechaReporteRegistro: registro?.fechaNormalizada || null,
    fechaReporteOriginal: registro?.fecha || null,
    fechaCierre: movimiento?.fechaNormalizada || null,
    clienteReporte: registro?.clienteReporte || null,
    clienteCierre: movimiento?.clienteCierre || null,
    entidadCierre: movimiento?.entidad || null,
    clienteNormalizado:
      registro?.clienteNormalizado || movimiento?.clienteNormalizado || null,
    montoReporte: desdeCentavos(montoReporteCentavos),
    montoCierre: desdeCentavos(montoCierreCentavos),
    diferencia: desdeCentavos(diferenciaCentavos),
    estado,
    tipoCoincidencia,
    agrupacionCaja: agrupacionCaja
      ? {
          ...agrupacionCaja,
          montoMovimiento: desdeCentavos(montoMovimientoCentavos),
          montoAsignado: desdeCentavos(montoCierreCentavos),
        }
      : null,
    similitudCliente:
      similitudCliente === null
        ? null
        : Number(Number(similitudCliente).toFixed(4)),
    auditoria: {
      reporte: registro
        ? {
            fechaOriginal: registro.fecha || null,
            contrato: registro.contrato || null,
            clienteOriginal: registro.cliente || null,
            pagosCuotas: desdeCentavos(montoReporteCentavos),
            usuarioCobrador: registro.usuarioCobrador || null,
            vendedor: registro.vendedor || null,
            agencia: registro.agencia || null,
            archivoOrigen: registro.archivoOrigen || null,
          }
        : null,
      cierre: movimiento
        ? {
            cierreId: Number(movimiento.cierreId),
            movimientoCajaId: Number(movimiento.id),
            fechaCierre: movimiento.fechaNormalizada,
            clienteId: Number(movimiento.clienteId) || null,
            entidad: movimiento.entidad || null,
            clienteCanonico: movimiento.clienteCierre || null,
            valor: desdeCentavos(montoCierreCentavos),
            valorMovimiento: desdeCentavos(montoMovimientoCentavos),
            esPagoAgrupado: Boolean(agrupacionCaja),
            responsable: movimiento.responsable || null,
            formaPago: movimiento.formaPago || null,
            recibo: movimiento.recibo || null,
            agenciaId: Number(movimiento.cierre?.agenciaId) || null,
          }
        : null,
    },
  };
};

const buscarRegistrosQueSumanMonto = (registros, montoObjetivoCentavos) => {
  const candidatos = registros
    .filter(
      (registro) =>
        Number.isInteger(registro.montoReporteCentavos) &&
        registro.montoReporteCentavos > 0 &&
        registro.montoReporteCentavos < montoObjetivoCentavos,
    )
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

  const seleccionar = (inicio, restante, tamanoRestante, acumulados) => {
    if (restante === 0 && tamanoRestante === 0) {
      return [...acumulados];
    }
    if (restante <= 0 || tamanoRestante <= 0) return null;

    for (let index = inicio; index < candidatos.length; index += 1) {
      const registro = candidatos[index];
      if (registro.montoReporteCentavos > restante) continue;
      acumulados.push(registro);
      const resultado = seleccionar(
        index + 1,
        restante - registro.montoReporteCentavos,
        tamanoRestante - 1,
        acumulados,
      );
      if (resultado) return resultado;
      acumulados.pop();
    }

    return null;
  };

  for (let tamano = 2; tamano <= candidatos.length; tamano += 1) {
    const resultado = seleccionar(0, montoObjetivoCentavos, tamano, []);
    if (resultado) return resultado;
  }

  return [];
};

const construirResultadosConciliacionCaja = ({
  registros = [],
  cierres = [],
  movimientos = [],
  clientes = [],
}) => {
  const registrosReporte = prepararRegistrosReporte(registros);
  const movimientosCierre = prepararMovimientosCierre({
    movimientos,
    cierres,
    clientes,
  });
  const resultadosPorRegistro = new Map();
  const movimientosValidos = new Map();
  const movimientosPendientesRevision = [];

  movimientosCierre.forEach((movimiento) => {
    if (
      !movimiento.fechaNormalizada ||
      !movimiento.clienteNormalizado ||
      movimiento.montoCierreCentavos === null
    ) {
      movimientosPendientesRevision.push(movimiento);
      return;
    }
    movimientosValidos.set(Number(movimiento.id), movimiento);
  });

  const movimientosPorClaveExacta = new Map();
  movimientosValidos.forEach((movimiento) => {
    const key = claveExacta(
      movimiento.fechaNormalizada,
      movimiento.clienteNormalizado,
      movimiento.montoCierreCentavos,
    );
    if (!movimientosPorClaveExacta.has(key)) {
      movimientosPorClaveExacta.set(key, []);
    }
    movimientosPorClaveExacta.get(key).push(movimiento);
  });
  movimientosPorClaveExacta.forEach((items) =>
    items.sort((a, b) => Number(a.id) - Number(b.id)),
  );

  const registrosSinCoincidenciaExacta = [];
  registrosReporte.forEach((registro) => {
    if (!registro.fechaNormalizada) {
      resultadosPorRegistro.set(
        registro._key,
        crearResultado({ registro, estado: "FECHA_INVALIDA" }),
      );
      return;
    }
    if (
      !registro.clienteNormalizado ||
      registro.montoReporteCentavos === null
    ) {
      resultadosPorRegistro.set(
        registro._key,
        crearResultado({ registro, estado: "PENDIENTE_REVISION" }),
      );
      return;
    }

    const key = claveExacta(
      registro.fechaNormalizada,
      registro.clienteNormalizado,
      registro.montoReporteCentavos,
    );
    const disponibles = movimientosPorClaveExacta.get(key) || [];
    const movimiento = disponibles.shift();
    if (!movimiento) {
      registrosSinCoincidenciaExacta.push(registro);
      return;
    }

    movimientosValidos.delete(Number(movimiento.id));
    resultadosPorRegistro.set(
      registro._key,
      crearResultado({
        registro,
        movimiento,
        estado: "COINCIDE",
        tipoCoincidencia: "NOMBRE_EXACTO",
        similitudCliente: 1,
      }),
    );
  });

  const resolverNombresSimilares = ({ registrosPendientes, exigirMonto }) => {
    const candidatos = [];
    const movimientosPorContexto = new Map();

    movimientosValidos.forEach((movimiento) => {
      const contextKey = exigirMonto
        ? `${movimiento.fechaNormalizada}|${movimiento.montoCierreCentavos}`
        : movimiento.fechaNormalizada;
      if (!movimientosPorContexto.has(contextKey)) {
        movimientosPorContexto.set(contextKey, []);
      }
      movimientosPorContexto.get(contextKey).push(movimiento);
    });

    registrosPendientes.forEach((registro, registroIndex) => {
      const contextKey = exigirMonto
        ? `${registro.fechaNormalizada}|${registro.montoReporteCentavos}`
        : registro.fechaNormalizada;
      const posibles = (movimientosPorContexto.get(contextKey) || [])
        .map((movimiento) => {
          const similitud = calcularSimilitudNombres(
            registro.clienteNormalizado,
            movimiento.clienteNormalizado,
          );
          const esPrefijo = esNombreReportePrefijo(
            registro.clienteNormalizado,
            movimiento.clienteNormalizado,
          );
          if (similitud >= UMBRAL_SIMILITUD_NOMBRE) {
            return {
              movimiento,
              similitud,
              tipoCoincidencia: "NOMBRE_SIMILAR",
              esPrefijo,
            };
          }
          if (esPrefijo) {
            return {
              movimiento,
              similitud: 1,
              tipoCoincidencia: "NOMBRE_TRUNCADO",
              esPrefijo,
            };
          }
          return null;
        })
        .filter(Boolean);
      const nombresPrefijo = new Set(
        posibles
          .filter((item) => item.esPrefijo)
          .map((item) => item.movimiento.clienteNormalizado),
      );

      posibles.forEach((posible) => {
        if (posible.esPrefijo && nombresPrefijo.size > 1) {
          return;
        }
        candidatos.push({
          registro,
          registroIndex,
          ...posible,
        });
      });
    });

    candidatos.sort(
      (left, right) =>
        right.similitud - left.similitud ||
        left.registroIndex - right.registroIndex ||
        Number(left.movimiento.id) - Number(right.movimiento.id),
    );
    const registrosConsumidos = new Set();

    candidatos.forEach(
      ({ registro, movimiento, similitud, tipoCoincidencia }) => {
        if (
          registrosConsumidos.has(registro._key) ||
          !movimientosValidos.has(Number(movimiento.id))
        ) {
          return;
        }

        const mismoMonto =
          registro.montoReporteCentavos === movimiento.montoCierreCentavos;
        resultadosPorRegistro.set(
          registro._key,
          crearResultado({
            registro,
            movimiento,
            estado: mismoMonto ? "COINCIDE" : "MONTO_DIFERENTE",
            tipoCoincidencia,
            similitudCliente: similitud,
          }),
        );
        registrosConsumidos.add(registro._key);
        movimientosValidos.delete(Number(movimiento.id));
      },
    );

    return registrosPendientes.filter(
      (registro) => !registrosConsumidos.has(registro._key),
    );
  };

  const registrosSinCoincidenciaDeMonto = resolverNombresSimilares({
    registrosPendientes: registrosSinCoincidenciaExacta,
    exigirMonto: true,
  });

  const conciliarCuotasAgrupadas = (registrosPendientes) => {
    const registrosPorClienteFecha = new Map();
    const registrosConsumidos = new Set();

    registrosPendientes.forEach((registro) => {
      const key = claveClienteFecha(
        registro.fechaNormalizada,
        registro.clienteNormalizado,
      );
      if (!registrosPorClienteFecha.has(key)) {
        registrosPorClienteFecha.set(key, []);
      }
      registrosPorClienteFecha.get(key).push(registro);
    });

    [...movimientosValidos.values()]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((movimiento) => {
        if (!movimientosValidos.has(Number(movimiento.id))) return;

        const key = claveClienteFecha(
          movimiento.fechaNormalizada,
          movimiento.clienteNormalizado,
        );
        const registrosDisponibles = (registrosPorClienteFecha.get(key) || [])
          .filter((registro) => !registrosConsumidos.has(registro._key));
        const registrosAgrupados = buscarRegistrosQueSumanMonto(
          registrosDisponibles,
          movimiento.montoCierreCentavos,
        );

        if (!registrosAgrupados.length) return;

        const idsAgrupados = registrosAgrupados
          .map((registro) => Number(registro.id))
          .filter((id) => Number.isInteger(id) && id > 0);

        registrosAgrupados.forEach((registro) => {
          resultadosPorRegistro.set(
            registro._key,
            crearResultado({
              registro,
              movimiento,
              estado: "COINCIDE",
              tipoCoincidencia: "NOMBRE_EXACTO_CUOTAS_AGRUPADAS",
              similitudCliente: 1,
              montoCierreAsignadoCentavos: registro.montoReporteCentavos,
              agrupacionCaja: {
                movimientoCajaId: Number(movimiento.id),
                registrosAgrupados: idsAgrupados,
                totalRegistrosAgrupados: registrosAgrupados.length,
              },
            }),
          );
          registrosConsumidos.add(registro._key);
        });
        movimientosValidos.delete(Number(movimiento.id));
      });

    return registrosPendientes.filter(
      (registro) => !registrosConsumidos.has(registro._key),
    );
  };

  const registrosSinAgrupacion = conciliarCuotasAgrupadas(
    registrosSinCoincidenciaDeMonto,
  );

  const movimientosPorClienteFecha = new Map();
  movimientosValidos.forEach((movimiento) => {
    const key = claveClienteFecha(
      movimiento.fechaNormalizada,
      movimiento.clienteNormalizado,
    );
    if (!movimientosPorClienteFecha.has(key)) {
      movimientosPorClienteFecha.set(key, []);
    }
    movimientosPorClienteFecha.get(key).push(movimiento);
  });
  movimientosPorClienteFecha.forEach((items) =>
    items.sort((a, b) => Number(a.id) - Number(b.id)),
  );

  const registrosSinClienteExacto = [];
  registrosSinAgrupacion.forEach((registro) => {
    const key = claveClienteFecha(
      registro.fechaNormalizada,
      registro.clienteNormalizado,
    );
    const disponibles = movimientosPorClienteFecha.get(key) || [];
    const movimiento = disponibles.shift();

    if (movimiento) {
      movimientosValidos.delete(Number(movimiento.id));
      resultadosPorRegistro.set(
        registro._key,
        crearResultado({
          registro,
          movimiento,
          estado: "MONTO_DIFERENTE",
          tipoCoincidencia: "NOMBRE_EXACTO",
          similitudCliente: 1,
        }),
      );
      return;
    }

    registrosSinClienteExacto.push(registro);
  });

  const registrosSinClienteSimilar = resolverNombresSimilares({
    registrosPendientes: registrosSinClienteExacto,
    exigirMonto: false,
  });
  registrosSinClienteSimilar.forEach((registro) => {
    resultadosPorRegistro.set(
      registro._key,
      crearResultado({ registro, estado: "NO_EN_CIERRE" }),
    );
  });

  const resultados = registrosReporte.map((registro) =>
    resultadosPorRegistro.get(registro._key),
  );
  movimientosPendientesRevision.forEach((movimiento) => {
    resultados.push(
      crearResultado({ movimiento, estado: "PENDIENTE_REVISION" }),
    );
  });
  [...movimientosValidos.values()]
    .sort((a, b) => Number(a.id) - Number(b.id))
    .forEach((movimiento) => {
      resultados.push(
        crearResultado({ movimiento, estado: "SOLO_EN_CIERRE" }),
      );
    });

  const contar = (estado) =>
    resultados.filter((resultado) => resultado.estado === estado).length;
  const totalReporteCentavos = registrosReporte.reduce(
    (total, registro) => total + (registro.montoReporteCentavos || 0),
    0,
  );
  const totalCierreCentavos = movimientosCierre.reduce(
    (total, movimiento) => total + (movimiento.montoCierreCentavos || 0),
    0,
  );

  return {
    fechas: ordenarTextos(
      registrosReporte.map((registro) => registro.fechaNormalizada),
    ),
    resultados,
    resumen: {
      totalRegistrosReporte: registrosReporte.length,
      totalMovimientosCierre: movimientosCierre.length,
      coinciden: contar("COINCIDE"),
      montoDiferente: contar("MONTO_DIFERENTE"),
      noEnCierre: contar("NO_EN_CIERRE"),
      soloEnCierre: contar("SOLO_EN_CIERRE"),
      pendienteRevision: contar("PENDIENTE_REVISION"),
      fechaInvalida: contar("FECHA_INVALIDA"),
      montoTotalReporte: desdeCentavos(totalReporteCentavos),
      montoTotalCierre: desdeCentavos(totalCierreCentavos),
      diferenciaTotal: desdeCentavos(
        totalReporteCentavos - totalCierreCentavos,
      ),
    },
  };
};

const serializarConciliacionCaja = (registro) => {
  if (!registro) return null;
  const item = plano(registro);
  return {
    ...item,
    id: String(item.id),
    fechas: Array.isArray(item.fechas) ? item.fechas : [],
    cierreIds: Array.isArray(item.cierreIds) ? item.cierreIds : [],
    resultados: Array.isArray(item.resultados) ? item.resultados : [],
    resumen: item.resumen || {},
  };
};

const obtenerUltimaConciliacionCaja = async (cargaId, options = {}) =>
  ControlFinancieroConciliacionCaja.findOne({
    where: { cargaId },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    transaction: options.transaction,
  });

const conciliarCargaCaja = async ({
  cargaId,
  origen = "MANUAL",
  usuarioId = null,
}) => {
  const id = Number(cargaId);
  if (!Number.isInteger(id) || id < 1) {
    throw errorServicio("Carga de control financiero no valida.");
  }

  return sequelize.transaction(async (transaction) => {
    await sequelize.query(
      "SELECT pg_advisory_xact_lock(hashtext('conciliacion_caja'), :cargaId)",
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
    const registros = await ControlFinancieroRegistro.findAll({
      where: { cargaId: id, tipoRegistro: "CAJA" },
      attributes: [
        "id",
        "tipoRegistro",
        "fecha",
        "cliente",
        "pagosCuotas",
        "contrato",
        "vendedor",
        "usuarioCobrador",
        "agencia",
        "archivoOrigen",
      ],
      order: [["id", "ASC"]],
      transaction,
    });
    const fechasRegistros = ordenarTextos(
      registros.map((registro) =>
        normalizarFechaCalendario(plano(registro).fecha),
      ),
    );
    const fechaContexto = normalizarFechaCalendario(carga.fechaReporte);
    const fechasConsulta = fechasRegistros.length
      ? fechasRegistros
      : fechaContexto
        ? [fechaContexto]
        : [];

    const cierres = fechasConsulta.length
      ? await CierreCaja.findAll({
          where: {
            fecha: { [Op.in]: fechasConsulta },
            estadoCierre: { [Op.in]: ESTADOS_CIERRE_CONCILIABLES },
          },
          attributes: ["id", "fecha", "agenciaId", "estadoCierre"],
          order: [["fecha", "ASC"], ["id", "ASC"]],
          transaction,
        })
      : [];
    const cierreIds = ordenarNumeros(
      cierres.map((cierre) => plano(cierre).id),
    );
    const movimientos = cierreIds.length
      ? await MovimientoCaja.findAll({
          where: { cierreId: { [Op.in]: cierreIds } },
          attributes: [
            "id",
            "cierreId",
            "responsable",
            "detalle",
            "entidad",
            "clienteId",
            "valor",
            "formaPago",
            "recibo",
          ],
          order: [["id", "ASC"]],
          transaction,
        })
      : [];
    const clienteIds = ordenarNumeros(
      movimientos.map((movimiento) => plano(movimiento).clienteId),
    );
    const clientes = clienteIds.length
      ? await Cliente.findAll({
          where: { id: { [Op.in]: clienteIds } },
          attributes: ["id", "cliente"],
          order: [["id", "ASC"]],
          transaction,
        })
      : [];
    const calculo = construirResultadosConciliacionCaja({
      registros,
      cierres,
      movimientos,
      clientes,
    });
    const conciliacion = await ControlFinancieroConciliacionCaja.create(
      {
        ejecucionId: randomUUID(),
        cargaId: id,
        fechaReporte: fechaContexto,
        fechas: fechasConsulta,
        cierreIds,
        origen: String(origen || "MANUAL").slice(0, 30),
        resultados: calculo.resultados,
        resumen: calculo.resumen,
        ejecutadoPor: Number(usuarioId) || null,
      },
      { transaction },
    );

    return serializarConciliacionCaja(conciliacion);
  });
};

const obtenerConciliacionCajaCarga = async (cargaId) => {
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
    conciliacion: serializarConciliacionCaja(
      await obtenerUltimaConciliacionCaja(id),
    ),
  };
};

const listarHistorialConciliacionCaja = async (cargaId, limite = 20) => {
  const id = Number(cargaId);
  if (!Number.isInteger(id) || id < 1) {
    throw errorServicio("Carga de control financiero no valida.");
  }
  const limit = Math.min(
    Math.max(Number.parseInt(limite, 10) || 20, 1),
    100,
  );
  const carga = await ControlFinancieroCarga.findByPk(id, {
    attributes: ["id"],
  });
  if (!carga) {
    throw errorServicio(
      "Carga de control financiero no encontrada.",
      404,
      "CARGA_NO_ENCONTRADA",
    );
  }

  const ejecuciones = await ControlFinancieroConciliacionCaja.findAll({
    where: { cargaId: id },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit,
  });
  return ejecuciones.map(serializarConciliacionCaja);
};

const patronesFechaReporte = (fecha) => {
  const [year, month, day] = fecha.split("-");
  const shortYear = year.slice(-2);
  const monthNumber = String(Number(month));
  const dayNumber = String(Number(day));
  return [
    `${fecha}%`,
    `${month}/${day}/${shortYear}%`,
    `${monthNumber}/${dayNumber}/${shortYear}%`,
    `${day}/${month}/${shortYear}%`,
    `${dayNumber}/${monthNumber}/${shortYear}%`,
    `${month}/${day}/${year}%`,
    `${day}/${month}/${year}%`,
  ];
};

const conciliarCargasCajaPorFecha = async ({
  fecha,
  origen,
  usuarioId = null,
}) => {
  const fechaIso = normalizarFechaCalendario(fecha);
  if (!fechaIso || fechaIso !== String(fecha || "").trim()) {
    throw errorServicio("Fecha de cierre no valida para conciliar caja.");
  }

  const candidatosRegistro = await ControlFinancieroRegistro.findAll({
    where: {
      tipoRegistro: "CAJA",
      [Op.or]: patronesFechaReporte(fechaIso).map((pattern) => ({
        fecha: { [Op.like]: pattern },
      })),
    },
    attributes: ["cargaId", "fecha"],
  });
  const cargaIdsRegistro = ordenarNumeros(
    candidatosRegistro
      .filter(
        (registro) =>
          normalizarFechaCalendario(plano(registro).fecha) === fechaIso,
      )
      .map((registro) => plano(registro).cargaId),
  );
  const condicionesCarga = [{ fechaReporte: fechaIso }];
  if (cargaIdsRegistro.length) {
    condicionesCarga.push({ id: { [Op.in]: cargaIdsRegistro } });
  }
  const cargas = await ControlFinancieroCarga.findAll({
    where: { estado: "ACTIVA", [Op.or]: condicionesCarga },
    attributes: ["id"],
    order: [["id", "ASC"]],
  });
  const conciliaciones = [];

  for (const carga of cargas) {
    conciliaciones.push(
      await conciliarCargaCaja({
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

module.exports = {
  ESTADOS_CIERRE_CONCILIABLES,
  UMBRAL_SIMILITUD_NOMBRE,
  conciliarCargaCaja,
  conciliarCargasCajaPorFecha,
  construirResultadosConciliacionCaja,
  listarHistorialConciliacionCaja,
  obtenerConciliacionCajaCarga,
  prepararMovimientosCierre,
  prepararRegistrosReporte,
  serializarConciliacionCaja,
};
