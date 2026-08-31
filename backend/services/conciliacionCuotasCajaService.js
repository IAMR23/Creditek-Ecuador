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
const ControlFinancieroConciliacionManualCaja = require(
  "../models/ControlFinancieroConciliacionManualCaja",
);
const ControlFinancieroConciliacionManualCajaDetalle = require(
  "../models/ControlFinancieroConciliacionManualCajaDetalle",
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
const MAX_OBSERVACION_MANUAL = 1000;

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

const serializarConciliacionManual = (conciliacion) => {
  if (!conciliacion) return null;
  const item = plano(conciliacion);
  return {
    id: item.id ? String(item.id) : null,
    cargaId: Number(item.cargaId) || null,
    observacion: item.observacion || null,
    activo: item.activo !== false,
    relacionadoPor: Number(item.relacionadoPor) || null,
    relacionadoEn: item.relacionadoEn || null,
    deshechoPor: Number(item.deshechoPor) || null,
    deshechoEn: item.deshechoEn || null,
    motivoDeshacer: item.motivoDeshacer || null,
    detalles: Array.isArray(item.detalles) ? item.detalles.map(plano) : [],
  };
};

const esNombreCierreParcialCompatible = (clienteReporte, clienteCierre) => {
  const tokensReporte = normalizarNombre(clienteReporte)
    .split(" ")
    .filter(Boolean);
  const tokensCierre = normalizarNombre(clienteCierre)
    .split(" ")
    .filter(Boolean);

  if (tokensCierre.length < 2 || tokensReporte.length <= tokensCierre.length) {
    return false;
  }

  const cierreEsPrefijoDelReporte = tokensCierre.every(
    (token, index) => token === tokensReporte[index],
  );
  if (cierreEsPrefijoDelReporte) return true;

  const todosLosTokensExisten = tokensCierre.every((token) =>
    tokensReporte.includes(token),
  );
  if (!todosLosTokensExisten) return false;

  const limiteNombres = Math.ceil(tokensReporte.length / 2);
  const tokensNombre = tokensReporte.slice(0, limiteNombres);
  const tokensApellido = tokensReporte.slice(limiteNombres);

  return (
    tokensCierre.some((token) => tokensNombre.includes(token)) &&
    tokensCierre.some((token) => tokensApellido.includes(token))
  );
};

const obtenerCoincidenciaNombreCompatible = (clienteReporte, clienteCierre) => {
  const similitud = calcularSimilitudNombres(clienteReporte, clienteCierre);
  const esPrefijo = esNombreReportePrefijo(clienteReporte, clienteCierre);
  const esParcial = esNombreCierreParcialCompatible(
    clienteReporte,
    clienteCierre,
  );

  if (similitud >= UMBRAL_SIMILITUD_NOMBRE) {
    return {
      similitud,
      tipoCoincidencia: "NOMBRE_SIMILAR",
      esPrefijo,
      requiereCoincidenciaUnica: esPrefijo,
    };
  }

  if (esPrefijo) {
    return {
      similitud: 1,
      tipoCoincidencia: "NOMBRE_TRUNCADO",
      esPrefijo,
      requiereCoincidenciaUnica: true,
    };
  }

  if (esParcial) {
    return {
      similitud: 1,
      tipoCoincidencia: "NOMBRE_PARCIAL",
      esPrefijo: false,
      requiereCoincidenciaUnica: true,
    };
  }

  return null;
};

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
  conciliacionManual = null,
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
    conciliacionManual: conciliacionManual
      ? serializarConciliacionManual(conciliacionManual)
      : null,
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

const serializarRegistroReporteManual = (registro) => ({
  registroReporteId: Number(registro.id),
  fecha: registro.fechaNormalizada || null,
  fechaOriginal: registro.fecha || null,
  cliente: registro.clienteReporte || null,
  clienteOriginal: registro.cliente || null,
  clienteNormalizado: registro.clienteNormalizado || null,
  monto: desdeCentavos(registro.montoReporteCentavos || 0),
  contrato: registro.contrato || null,
  usuarioCobrador: registro.usuarioCobrador || null,
  vendedor: registro.vendedor || null,
  agencia: registro.agencia || null,
  archivoOrigen: registro.archivoOrigen || null,
});

const serializarMovimientoCierreManual = (movimiento) => ({
  movimientoCajaId: Number(movimiento.id),
  cierreId: Number(movimiento.cierreId) || null,
  fecha: movimiento.fechaNormalizada || null,
  clienteId: Number(movimiento.clienteId) || null,
  cliente: movimiento.clienteCierre || movimiento.entidad || null,
  entidad: movimiento.entidad || null,
  clienteNormalizado: movimiento.clienteNormalizado || null,
  monto: desdeCentavos(movimiento.montoCierreCentavos || 0),
  responsable: movimiento.responsable || null,
  formaPago: movimiento.formaPago || null,
  recibo: movimiento.recibo || null,
  agenciaId: Number(movimiento.cierre?.agenciaId) || null,
});

const crearResultadoConciliacionManualGrupo = ({
  conciliacionManual,
  registrosReporte,
  movimientosCierre,
}) => {
  const totalReporteCentavos = registrosReporte.reduce(
    (total, registro) => total + (registro.montoReporteCentavos || 0),
    0,
  );
  const totalCierreCentavos = movimientosCierre.reduce(
    (total, movimiento) => total + (movimiento.montoCierreCentavos || 0),
    0,
  );
  const tieneMontos =
    registrosReporte.every((registro) =>
      Number.isInteger(registro.montoReporteCentavos),
    ) &&
    movimientosCierre.every((movimiento) =>
      Number.isInteger(movimiento.montoCierreCentavos),
    );
  const diferenciaCentavos = totalReporteCentavos - totalCierreCentavos;
  const primerRegistro = registrosReporte[0] || null;
  const primerMovimiento = movimientosCierre[0] || null;

  return {
    id: randomUUID(),
    controlFinancieroRegistroId: primerRegistro?.id
      ? Number(primerRegistro.id)
      : null,
    movimientoCajaId: primerMovimiento?.id ? Number(primerMovimiento.id) : null,
    cierreId: primerMovimiento?.cierreId
      ? Number(primerMovimiento.cierreId)
      : null,
    clienteId: primerMovimiento?.clienteId
      ? Number(primerMovimiento.clienteId)
      : null,
    fechaReporteRegistro: primerRegistro?.fechaNormalizada || null,
    fechaReporteOriginal: primerRegistro?.fecha || null,
    fechaCierre: primerMovimiento?.fechaNormalizada || null,
    clienteReporte: primerRegistro?.clienteReporte || null,
    clienteCierre: primerMovimiento?.clienteCierre || null,
    entidadCierre: primerMovimiento?.entidad || null,
    clienteNormalizado:
      primerRegistro?.clienteNormalizado ||
      primerMovimiento?.clienteNormalizado ||
      null,
    montoReporte: desdeCentavos(totalReporteCentavos),
    montoCierre: desdeCentavos(totalCierreCentavos),
    totalReporte: desdeCentavos(totalReporteCentavos),
    totalCierre: desdeCentavos(totalCierreCentavos),
    diferencia: desdeCentavos(diferenciaCentavos),
    estado: tieneMontos
      ? diferenciaCentavos === 0
        ? "COINCIDE"
        : "MONTO_DIFERENTE"
      : "PENDIENTE_REVISION",
    tipoCoincidencia: "MANUAL",
    conciliacionManualId: String(plano(conciliacionManual).id),
    conciliacionManual: serializarConciliacionManual(conciliacionManual),
    registrosReporte: registrosReporte.map(serializarRegistroReporteManual),
    movimientosCierre: movimientosCierre.map(serializarMovimientoCierreManual),
    similitudCliente:
      primerRegistro && primerMovimiento
        ? Number(
            calcularSimilitudNombres(
              primerRegistro.clienteReporte,
              primerMovimiento.clienteCierre,
            ).toFixed(4),
          )
        : null,
    auditoria: {
      reporte: primerRegistro
        ? {
            fechaOriginal: primerRegistro.fecha || null,
            contrato: primerRegistro.contrato || null,
            clienteOriginal: primerRegistro.cliente || null,
            pagosCuotas: desdeCentavos(totalReporteCentavos),
            usuarioCobrador: primerRegistro.usuarioCobrador || null,
            vendedor: primerRegistro.vendedor || null,
            agencia: primerRegistro.agencia || null,
            archivoOrigen: primerRegistro.archivoOrigen || null,
          }
        : null,
      cierre: primerMovimiento
        ? {
            cierreId: Number(primerMovimiento.cierreId),
            movimientoCajaId: Number(primerMovimiento.id),
            fechaCierre: primerMovimiento.fechaNormalizada,
            clienteId: Number(primerMovimiento.clienteId) || null,
            entidad: primerMovimiento.entidad || null,
            clienteCanonico: primerMovimiento.clienteCierre || null,
            valor: desdeCentavos(totalCierreCentavos),
            valorMovimiento: desdeCentavos(
              primerMovimiento.montoCierreCentavos || 0,
            ),
            esPagoAgrupado: movimientosCierre.length > 1,
            responsable: primerMovimiento.responsable || null,
            formaPago: primerMovimiento.formaPago || null,
            recibo: primerMovimiento.recibo || null,
            agenciaId: Number(primerMovimiento.cierre?.agenciaId) || null,
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
  relacionesManuales = [],
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
  const registrosPorId = new Map(
    registrosReporte
      .filter((registro) => Number.isInteger(Number(registro.id)))
      .map((registro) => [Number(registro.id), registro]),
  );
  const movimientosPorId = new Map(
    movimientosCierre
      .filter((movimiento) => Number.isInteger(Number(movimiento.id)))
      .map((movimiento) => [Number(movimiento.id), movimiento]),
  );
  const registrosConsumidosManual = new Set();
  const movimientosConsumidosManual = new Set();
  const resultadosManuales = [];

  relacionesManuales.map(plano).forEach((conciliacionManual) => {
    if (!conciliacionManual || conciliacionManual.activo === false) return;
    const detalles = Array.isArray(conciliacionManual.detalles)
      ? conciliacionManual.detalles.map(plano)
      : [];
    const registrosGrupo = detalles
      .filter((detalle) => detalle.tipo === "REPORTE")
      .map((detalle) => registrosPorId.get(Number(detalle.registroReporteId)))
      .filter(Boolean);
    const movimientosGrupo = detalles
      .filter((detalle) => detalle.tipo === "CIERRE")
      .map((detalle) => movimientosPorId.get(Number(detalle.movimientoCajaId)))
      .filter(Boolean);

    if (
      !registrosGrupo.length ||
      !movimientosGrupo.length ||
      registrosGrupo.some((registro) =>
        registrosConsumidosManual.has(registro._key),
      ) ||
      movimientosGrupo.some((movimiento) =>
        movimientosConsumidosManual.has(Number(movimiento.id)),
      )
    ) {
      return;
    }

    registrosGrupo.forEach((registro) =>
      registrosConsumidosManual.add(registro._key),
    );
    movimientosGrupo.forEach((movimiento) =>
      movimientosConsumidosManual.add(Number(movimiento.id)),
    );
    resultadosManuales.push(
      crearResultadoConciliacionManualGrupo({
        conciliacionManual,
        registrosReporte: registrosGrupo,
        movimientosCierre: movimientosGrupo,
      }),
    );
  });

  movimientosCierre.forEach((movimiento) => {
    if (movimientosConsumidosManual.has(Number(movimiento.id))) {
      return;
    }
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
    if (registrosConsumidosManual.has(registro._key)) {
      return;
    }
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
    const candidatosPreliminares = [];
    const clientesRestringidosPorMovimiento = new Map();
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
          const coincidencia = obtenerCoincidenciaNombreCompatible(
            registro.clienteNormalizado,
            movimiento.clienteNormalizado,
          );
          return coincidencia ? { movimiento, ...coincidencia } : null;
        })
        .filter(Boolean);
      const nombresConCoincidenciaRestringida = new Set(
        posibles
          .filter((item) => item.requiereCoincidenciaUnica)
          .map((item) => item.movimiento.clienteNormalizado),
      );

      posibles.forEach((posible) => {
        if (
          posible.requiereCoincidenciaUnica &&
          nombresConCoincidenciaRestringida.size > 1
        ) {
          return;
        }
        const candidato = {
          registro,
          registroIndex,
          ...posible,
        };
        candidatosPreliminares.push(candidato);

        if (posible.requiereCoincidenciaUnica) {
          const movimientoId = Number(posible.movimiento.id);
          if (!clientesRestringidosPorMovimiento.has(movimientoId)) {
            clientesRestringidosPorMovimiento.set(movimientoId, new Set());
          }
          clientesRestringidosPorMovimiento
            .get(movimientoId)
            .add(registro.clienteNormalizado);
        }
      });
    });

    const candidatos = candidatosPreliminares.filter((candidato) => {
      if (!candidato.requiereCoincidenciaUnica) return true;
      const clientesCompatibles = clientesRestringidosPorMovimiento.get(
        Number(candidato.movimiento.id),
      );
      return (clientesCompatibles?.size || 0) <= 1;
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

    const registrarAgrupacion = ({
      movimiento,
      registrosAgrupados,
      tipoCoincidencia,
      similitudCliente,
    }) => {
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
            tipoCoincidencia,
            similitudCliente,
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
    };

    const buscarAgrupacionCompatible = (movimiento, tipoObjetivo) => {
      const grupos = new Map();

      registrosPendientes.forEach((registro) => {
        if (
          registrosConsumidos.has(registro._key) ||
          registro.fechaNormalizada !== movimiento.fechaNormalizada ||
          !registro.clienteNormalizado ||
          registro.clienteNormalizado === movimiento.clienteNormalizado
        ) {
          return;
        }

        const coincidencia = obtenerCoincidenciaNombreCompatible(
          registro.clienteNormalizado,
          movimiento.clienteNormalizado,
        );
        if (!coincidencia || coincidencia.tipoCoincidencia !== tipoObjetivo) {
          return;
        }

        if (!grupos.has(registro.clienteNormalizado)) {
          grupos.set(registro.clienteNormalizado, {
            ...coincidencia,
            registros: [],
          });
        }
        grupos.get(registro.clienteNormalizado).registros.push(registro);
      });

      const agrupaciones = [...grupos.values()]
        .map((grupo) => ({
          ...grupo,
          registrosAgrupados: buscarRegistrosQueSumanMonto(
            grupo.registros,
            movimiento.montoCierreCentavos,
          ),
        }))
        .filter((grupo) => grupo.registrosAgrupados.length);

      return agrupaciones.length === 1 ? agrupaciones[0] : null;
    };

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

        if (registrosAgrupados.length) {
          registrarAgrupacion({
            movimiento,
            registrosAgrupados,
            tipoCoincidencia: "NOMBRE_EXACTO_CUOTAS_AGRUPADAS",
            similitudCliente: 1,
          });
          return;
        }

        const agrupacionSimilar = buscarAgrupacionCompatible(
          movimiento,
          "NOMBRE_SIMILAR",
        );
        if (agrupacionSimilar) {
          registrarAgrupacion({
            movimiento,
            registrosAgrupados: agrupacionSimilar.registrosAgrupados,
            tipoCoincidencia: "NOMBRE_SIMILAR_CUOTAS_AGRUPADAS",
            similitudCliente: agrupacionSimilar.similitud,
          });
          return;
        }

        const agrupacionTruncada = buscarAgrupacionCompatible(
          movimiento,
          "NOMBRE_TRUNCADO",
        );
        if (agrupacionTruncada) {
          registrarAgrupacion({
            movimiento,
            registrosAgrupados: agrupacionTruncada.registrosAgrupados,
            tipoCoincidencia: "NOMBRE_TRUNCADO_CUOTAS_AGRUPADAS",
            similitudCliente: agrupacionTruncada.similitud,
          });
          return;
        }

        const agrupacionParcial = buscarAgrupacionCompatible(
          movimiento,
          "NOMBRE_PARCIAL",
        );
        if (agrupacionParcial) {
          registrarAgrupacion({
            movimiento,
            registrosAgrupados: agrupacionParcial.registrosAgrupados,
            tipoCoincidencia: "NOMBRE_PARCIAL_CUOTAS_AGRUPADAS",
            similitudCliente: agrupacionParcial.similitud,
          });
        }
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

  const resultados = [
    ...resultadosManuales,
    ...registrosReporte
      .filter((registro) => !registrosConsumidosManual.has(registro._key))
      .map((registro) => resultadosPorRegistro.get(registro._key))
      .filter(Boolean),
  ];
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

const listarConciliacionesManualesActivas = (cargaId, options = {}) =>
  ControlFinancieroConciliacionManualCaja.findAll({
    where: { cargaId, activo: true },
    include: [
      {
        model: ControlFinancieroConciliacionManualCajaDetalle,
        as: "detalles",
        where: { activo: true },
        required: false,
      },
    ],
    order: [["id", "ASC"]],
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
    const relacionesManuales = await listarConciliacionesManualesActivas(id, {
      transaction,
    });
    const calculo = construirResultadosConciliacionCaja({
      registros,
      cierres,
      movimientos,
      clientes,
      relacionesManuales,
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

const assertPositiveId = (value, message) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw errorServicio(message);
  }
  return id;
};

const limpiarObservacion = (value, label = "La observacion") => {
  const observacion = String(value || "").trim();
  if (observacion.length > MAX_OBSERVACION_MANUAL) {
    throw errorServicio(`${label} no puede superar 1000 caracteres.`);
  }
  return observacion;
};

const obtenerItemReporte = (resultado) => ({
  origen: "REPORTE",
  registroReporteId: Number(resultado.controlFinancieroRegistroId) || null,
  movimientoCajaId: null,
  cliente: resultado.clienteReporte || "-",
  monto: Number(resultado.montoReporte || 0),
  fecha: resultado.fechaReporteRegistro || null,
  tipo: "Reporte",
  contrato: resultado.auditoria?.reporte?.contrato || null,
  cobrador: resultado.auditoria?.reporte?.usuarioCobrador || null,
  vendedor: resultado.auditoria?.reporte?.vendedor || null,
  agencia: resultado.auditoria?.reporte?.agencia || null,
  archivoOrigen: resultado.auditoria?.reporte?.archivoOrigen || null,
});

const obtenerItemCierre = (resultado) => ({
  origen: "CIERRE",
  registroReporteId: null,
  movimientoCajaId: Number(resultado.movimientoCajaId) || null,
  cliente: resultado.clienteCierre || resultado.entidadCierre || "-",
  monto: Number(resultado.montoCierre || 0),
  fecha: resultado.fechaCierre || null,
  tipo: "Cierre",
  cierreId: Number(resultado.cierreId) || null,
  clienteId: Number(resultado.clienteId) || null,
  entidad: resultado.entidadCierre || null,
  responsable: resultado.auditoria?.cierre?.responsable || null,
  formaPago: resultado.auditoria?.cierre?.formaPago || null,
  recibo: resultado.auditoria?.cierre?.recibo || null,
  agenciaId: Number(resultado.auditoria?.cierre?.agenciaId) || null,
});

const textoBusquedaManual = (item) =>
  [
    item.cliente,
    item.monto,
    item.fecha,
    item.recibo,
    item.cierreId,
    item.contrato,
    item.agencia,
    item.agenciaId,
    item.formaPago,
    item.responsable,
    item.archivoOrigen,
  ]
    .map((value) => String(value || "").toLocaleLowerCase("es"))
    .join(" ");

const puntuarSugerenciaManual = (seleccionado, candidato) => {
  const similitudNombre = calcularSimilitudNombres(
    seleccionado.cliente,
    candidato.cliente,
  );
  const mismoMonto =
    aCentavos(seleccionado.monto) !== null &&
    aCentavos(seleccionado.monto) === aCentavos(candidato.monto);
  const mismaFecha =
    Boolean(seleccionado.fecha) && seleccionado.fecha === candidato.fecha;
  const mismoCierre =
    Boolean(seleccionado.cierreId) &&
    Number(seleccionado.cierreId) === Number(candidato.cierreId);
  const mismaAgencia =
    Boolean(seleccionado.agencia || seleccionado.agenciaId) &&
    normalizarNombre(seleccionado.agencia || seleccionado.agenciaId) ===
      normalizarNombre(candidato.agencia || candidato.agenciaId);
  const mismaFormaPago =
    Boolean(seleccionado.formaPago) &&
    seleccionado.formaPago === candidato.formaPago;
  const mismoRecibo =
    Boolean(seleccionado.recibo) && seleccionado.recibo === candidato.recibo;

  return {
    mismoMonto,
    similitudNombre,
    mismaFecha,
    mismoCierre,
    mismaAgencia,
    mismaFormaPago,
    mismoRecibo,
  };
};

const ordenarSugerenciasManual = (seleccionado, candidatos) =>
  candidatos
    .map((candidato) => ({
      ...candidato,
      score: puntuarSugerenciaManual(seleccionado, candidato),
    }))
    .sort((left, right) => {
      const puntajeBooleano = (item) =>
        Number(item.score.mismoMonto) * 1000 +
        Number(item.score.mismaFecha) * 100 +
        Number(item.score.mismoCierre) * 20 +
        Number(item.score.mismaAgencia) * 10 +
        Number(item.score.mismaFormaPago) * 5 +
        Number(item.score.mismoRecibo) * 3;
      return (
        puntajeBooleano(right) - puntajeBooleano(left) ||
        right.score.similitudNombre - left.score.similitudNombre ||
        String(left.cliente || "").localeCompare(String(right.cliente || ""), "es") ||
        Number(left.registroReporteId || left.movimientoCajaId || 0) -
          Number(right.registroReporteId || right.movimientoCajaId || 0)
      );
    });

const obtenerItemsDisponiblesManual = (resultados) => ({
  registrosReporte: resultados
    .filter(
      (resultado) =>
        resultado.estado === "NO_EN_CIERRE" &&
        resultado.controlFinancieroRegistroId,
    )
    .map(obtenerItemReporte),
  movimientosCierre: resultados
    .filter(
      (resultado) =>
        resultado.estado === "SOLO_EN_CIERRE" && resultado.movimientoCajaId,
    )
    .map(obtenerItemCierre),
});

const normalizarIdsSeleccionados = (values, message) => {
  const fuente = Array.isArray(values)
    ? values
    : values === null || values === undefined
      ? []
      : [values];
  const ids = ordenarNumeros(fuente);
  if (!ids.length) {
    throw errorServicio(message);
  }
  return ids;
};

const buscarCombinacionesPorMonto = ({
  seleccionado,
  candidatos,
  montoObjetivoCentavos,
  maxElementos = 3,
  maxCandidatos = 30,
}) => {
  if (!Number.isInteger(montoObjetivoCentavos) || montoObjetivoCentavos <= 0) {
    return [];
  }

  const candidatosOrdenados = ordenarSugerenciasManual(
    seleccionado,
    candidatos,
  )
    .filter((item) => {
      const monto = aCentavos(item.monto);
      return Number.isInteger(monto) && monto > 0 && monto <= montoObjetivoCentavos;
    })
    .slice(0, maxCandidatos);
  const combinaciones = [];

  const buscar = (inicio, acumulados, totalCentavos) => {
    if (totalCentavos === montoObjetivoCentavos && acumulados.length > 1) {
      combinaciones.push([...acumulados]);
      return combinaciones.length >= 5;
    }
    if (
      totalCentavos >= montoObjetivoCentavos ||
      acumulados.length >= maxElementos
    ) {
      return false;
    }

    for (let index = inicio; index < candidatosOrdenados.length; index += 1) {
      const candidato = candidatosOrdenados[index];
      const monto = aCentavos(candidato.monto);
      acumulados.push(candidato);
      const detener = buscar(index + 1, acumulados, totalCentavos + monto);
      acumulados.pop();
      if (detener) return true;
    }
    return false;
  };

  buscar(0, [], 0);

  return combinaciones.map((items) => ({
    lado: items[0]?.origen || null,
    total: desdeCentavos(montoObjetivoCentavos),
    items,
  }));
};

const listarSugerenciasConciliacionCajaManual = async ({
  cargaId,
  origen,
  registroReporteId,
  movimientoCajaId,
  busqueda,
}) => {
  const id = assertPositiveId(cargaId, "Carga de control financiero no valida.");
  const origenNormalizado = String(origen || "").trim().toUpperCase();
  const ultima = await obtenerUltimaConciliacionCaja(id);
  if (!ultima) {
    throw errorServicio(
      "La carga aun no tiene una conciliacion de caja.",
      409,
      "CONCILIACION_CAJA_NO_EXISTE",
    );
  }

  const conciliacion = serializarConciliacionCaja(ultima);
  const resultados = conciliacion.resultados || [];
  const esReporte = origenNormalizado === "REPORTE";
  const esCierre = origenNormalizado === "CIERRE";
  if (!esReporte && !esCierre) {
    throw errorServicio("El origen de la conciliacion manual no es valido.");
  }

  const disponibles = obtenerItemsDisponiblesManual(resultados);
  const seleccionado = esReporte
    ? disponibles.registrosReporte.find(
        (item) => Number(item.registroReporteId) === Number(registroReporteId),
      )
    : disponibles.movimientosCierre.find(
        (item) => Number(item.movimientoCajaId) === Number(movimientoCajaId),
      );

  if (!seleccionado) {
    throw errorServicio(
      "El registro seleccionado ya no esta disponible para conciliacion manual.",
      409,
      "REGISTRO_NO_DISPONIBLE",
    );
  }

  const termino = String(busqueda || "").trim().toLocaleLowerCase("es");
  const filtrar = (items) =>
    termino ? items.filter((item) => textoBusquedaManual(item).includes(termino)) : items;
  const registrosReporte = filtrar(disponibles.registrosReporte);
  const movimientosCierre = filtrar(disponibles.movimientosCierre);
  const montoObjetivoCentavos = aCentavos(seleccionado.monto);
  const sugerenciasCombinaciones = buscarCombinacionesPorMonto({
    seleccionado,
    candidatos: esReporte ? movimientosCierre : registrosReporte,
    montoObjetivoCentavos,
  });

  return {
    conciliacionId: conciliacion.id,
    origen: origenNormalizado,
    seleccionado,
    seleccionInicial: {
      registroReporteIds: esReporte ? [Number(seleccionado.registroReporteId)] : [],
      movimientoCajaIds: esCierre ? [Number(seleccionado.movimientoCajaId)] : [],
    },
    registrosReporte: ordenarSugerenciasManual(seleccionado, registrosReporte),
    movimientosCierre: ordenarSugerenciasManual(seleccionado, movimientosCierre),
    sugerenciasCombinaciones,
  };
};

const validarDisponibilidadEnUltimaConciliacion = async ({
  cargaId,
  registroReporteIds,
  movimientoCajaIds,
  transaction,
}) => {
  const ultima = await obtenerUltimaConciliacionCaja(cargaId, { transaction });
  if (!ultima) {
    throw errorServicio(
      "Ejecuta primero la conciliacion de caja antes de conciliar manualmente.",
      409,
      "CONCILIACION_CAJA_NO_EXISTE",
    );
  }

  const { registrosReporte, movimientosCierre } = obtenerItemsDisponiblesManual(
    serializarConciliacionCaja(ultima).resultados || [],
  );
  const reportesDisponibles = new Set(
    registrosReporte.map((item) => Number(item.registroReporteId)),
  );
  const movimientosDisponibles = new Set(
    movimientosCierre.map((item) => Number(item.movimientoCajaId)),
  );
  const faltaReporte = registroReporteIds.some(
    (registroId) => !reportesDisponibles.has(registroId),
  );
  const faltaMovimiento = movimientoCajaIds.some(
    (movimientoId) => !movimientosDisponibles.has(movimientoId),
  );

  if (faltaReporte || faltaMovimiento) {
    throw errorServicio(
      "Los registros seleccionados ya no estan disponibles para conciliacion manual.",
      409,
      "REGISTROS_NO_DISPONIBLES",
    );
  }
};

const crearConciliacionManualCaja = async ({
  cargaId,
  registroReporteIds,
  movimientoCajaIds,
  registroReporteId,
  movimientoCajaId,
  observacion,
  usuarioId,
}) => {
  const id = assertPositiveId(cargaId, "Carga de control financiero no valida.");
  const reporteIds = normalizarIdsSeleccionados(
    registroReporteIds || registroReporteId,
    "Selecciona al menos un registro del reporte.",
  );
  const movimientoIds = normalizarIdsSeleccionados(
    movimientoCajaIds || movimientoCajaId,
    "Selecciona al menos un movimiento del cierre.",
  );
  const usuario = assertPositiveId(
    usuarioId,
    "No se pudo identificar al usuario que concilia manualmente.",
  );
  const observacionLimpia = limpiarObservacion(observacion);

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      "SELECT pg_advisory_xact_lock(hashtext('conciliacion_caja'), :cargaId)",
      { replacements: { cargaId: id }, transaction },
    );

    const carga = await ControlFinancieroCarga.findByPk(id, {
      attributes: ["id", "estado"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!carga) {
      throw errorServicio(
        "Carga de control financiero no encontrada.",
        404,
        "CARGA_NO_ENCONTRADA",
      );
    }
    if (plano(carga).estado !== "ACTIVA") {
      throw errorServicio(
        "Solo se pueden crear conciliaciones manuales en cargas activas.",
        409,
        "CARGA_NO_ACTIVA",
      );
    }

    const registros = await ControlFinancieroRegistro.findAll({
      where: { id: { [Op.in]: reporteIds } },
      attributes: ["id", "cargaId", "tipoRegistro", "pagosCuotas"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (registros.length !== reporteIds.length) {
      throw errorServicio(
        "Uno o mas registros del reporte no existen.",
        404,
        "REGISTRO_REPORTE_NO_ENCONTRADO",
      );
    }
    registros.map(plano).forEach((registro) => {
      if (Number(registro.cargaId) !== id) {
        throw errorServicio(
          "Todos los registros del reporte deben pertenecer a la carga seleccionada.",
          404,
          "REGISTRO_REPORTE_NO_ENCONTRADO",
        );
      }
      if (registro.tipoRegistro !== "CAJA") {
        throw errorServicio(
          "La conciliacion manual de caja solo aplica a registros CAJA.",
          400,
          "REGISTRO_REPORTE_INVALIDO",
        );
      }
    });

    const movimientos = await MovimientoCaja.findAll({
      where: { id: { [Op.in]: movimientoIds } },
      attributes: ["id", "cierreId", "detalle", "valor"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (movimientos.length !== movimientoIds.length) {
      throw errorServicio(
        "Uno o mas movimientos de cierre no existen.",
        404,
        "MOVIMIENTO_CAJA_NO_ENCONTRADO",
      );
    }
    movimientos.map(plano).forEach((movimiento) => {
      if (normalizarNombre(movimiento.detalle) !== "CUOTA") {
        throw errorServicio(
          "La conciliacion manual de caja solo aplica a movimientos CUOTA.",
          400,
          "MOVIMIENTO_CAJA_INVALIDO",
        );
      }
    });

    const cierreIds = ordenarNumeros(
      movimientos.map((movimiento) => plano(movimiento).cierreId),
    );
    const cierres = await CierreCaja.findAll({
      where: { id: { [Op.in]: cierreIds } },
      attributes: ["id", "estadoCierre"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      cierres.length !== cierreIds.length ||
      cierres
        .map(plano)
        .some(
          (cierre) =>
            !ESTADOS_CIERRE_CONCILIABLES.includes(cierre.estadoCierre),
        )
    ) {
      throw errorServicio(
        "Todos los movimientos deben pertenecer a cierres cerrados.",
        409,
        "CIERRE_NO_CONCILIABLE",
      );
    }

    const existente = await ControlFinancieroConciliacionManualCajaDetalle.findOne({
      where: {
        activo: true,
        [Op.or]: [
          { tipo: "REPORTE", registroReporteId: { [Op.in]: reporteIds } },
          { tipo: "CIERRE", movimientoCajaId: { [Op.in]: movimientoIds } },
        ],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existente) {
      throw errorServicio(
        "Uno de los registros ya tiene una conciliacion manual activa.",
        409,
        "CONCILIACION_MANUAL_DUPLICADA",
      );
    }

    await validarDisponibilidadEnUltimaConciliacion({
      cargaId: id,
      registroReporteIds: reporteIds,
      movimientoCajaIds: movimientoIds,
      transaction,
    });

    const conciliacionManual = await ControlFinancieroConciliacionManualCaja.create(
      {
        cargaId: id,
        observacion: observacionLimpia || null,
        activo: true,
        relacionadoPor: usuario,
        relacionadoEn: new Date(),
      },
      { transaction },
    );
    const conciliacionManualId = plano(conciliacionManual).id;
    const registrosPorId = new Map(
      registros.map((registro) => [Number(plano(registro).id), plano(registro)]),
    );
    const movimientosPorId = new Map(
      movimientos.map((movimiento) => [
        Number(plano(movimiento).id),
        plano(movimiento),
      ]),
    );

    await ControlFinancieroConciliacionManualCajaDetalle.bulkCreate(
      [
        ...reporteIds.map((registroId) => ({
          conciliacionManualId,
          tipo: "REPORTE",
          registroReporteId: registroId,
          movimientoCajaId: null,
          monto: desdeCentavos(
            aCentavos(registrosPorId.get(registroId)?.pagosCuotas) || 0,
          ),
          activo: true,
        })),
        ...movimientoIds.map((movimientoId) => ({
          conciliacionManualId,
          tipo: "CIERRE",
          registroReporteId: null,
          movimientoCajaId: movimientoId,
          monto: desdeCentavos(
            aCentavos(movimientosPorId.get(movimientoId)?.valor) || 0,
          ),
          activo: true,
        })),
      ],
      { transaction },
    );
  });

  return {
    conciliacion: await conciliarCargaCaja({
      cargaId: id,
      origen: "CONCILIACION_MANUAL",
      usuarioId: usuario,
    }),
  };
};

const deshacerConciliacionManualCaja = async ({
  cargaId,
  conciliacionManualId,
  motivoDeshacer,
  usuarioId,
}) => {
  const id = assertPositiveId(cargaId, "Carga de control financiero no valida.");
  const conciliacionPk = assertPositiveId(
    conciliacionManualId,
    "La conciliacion manual no es valida.",
  );
  const usuario = assertPositiveId(
    usuarioId,
    "No se pudo identificar al usuario que deshace la conciliacion manual.",
  );
  const motivo = limpiarObservacion(motivoDeshacer, "El motivo de deshacer");
  if (!motivo) {
    throw errorServicio("El motivo de deshacer es obligatorio.");
  }

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      "SELECT pg_advisory_xact_lock(hashtext('conciliacion_caja'), :cargaId)",
      { replacements: { cargaId: id }, transaction },
    );

    const conciliacionManual =
      await ControlFinancieroConciliacionManualCaja.findByPk(conciliacionPk, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    if (
      !conciliacionManual ||
      Number(plano(conciliacionManual).cargaId) !== id
    ) {
      throw errorServicio(
        "Conciliacion manual no encontrada.",
        404,
        "CONCILIACION_MANUAL_NO_ENCONTRADA",
      );
    }
    if (plano(conciliacionManual).activo === false) {
      throw errorServicio(
        "La conciliacion manual ya fue deshecha.",
        409,
        "CONCILIACION_MANUAL_INACTIVA",
      );
    }

    await conciliacionManual.update(
      {
        activo: false,
        deshechoPor: usuario,
        deshechoEn: new Date(),
        motivoDeshacer: motivo,
      },
      { transaction },
    );
    await ControlFinancieroConciliacionManualCajaDetalle.update(
      { activo: false },
      {
        where: { conciliacionManualId: conciliacionPk },
        transaction,
      },
    );
  });

  return {
    conciliacion: await conciliarCargaCaja({
      cargaId: id,
      origen: "DESHACER_CONCILIACION_MANUAL",
      usuarioId: usuario,
    }),
  };
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
  crearConciliacionManualCaja,
  deshacerConciliacionManualCaja,
  listarHistorialConciliacionCaja,
  listarSugerenciasConciliacionCajaManual,
  obtenerConciliacionCajaCarga,
  prepararMovimientosCierre,
  prepararRegistrosReporte,
  serializarConciliacionCaja,
};
