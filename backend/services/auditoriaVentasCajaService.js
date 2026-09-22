const { Op } = require("sequelize");
const Agencia = require("../models/Agencia");
const Cliente = require("../models/Cliente");
const CierreCaja = require("../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../models/CierreCaja/MovimientoCaja");
const {
  aCentavos,
  calcularSimilitudNombres,
  desdeCentavos,
  normalizarFechaCalendario,
  normalizarNombre,
} = require("./conciliacionFinancieraUtils");

const TIPO_PAGO = Object.freeze({
  EFECTIVO: "EFECTIVO",
  TARJETA_CREDITO: "TARJETA_CREDITO",
});
const UMBRAL_SIMILITUD = 0.82;

const plano = (registro) =>
  registro?.get ? registro.get({ plain: true }) : registro;

const clasificarFormaPagoVenta = (formaPago) => {
  const valor = normalizarNombre(formaPago);
  if (valor.includes("TARJ") && valor.includes("CREDITO")) {
    return TIPO_PAGO.TARJETA_CREDITO;
  }
  if (valor.includes("EFECTIVO") || valor === "CONTADO") {
    return TIPO_PAGO.EFECTIVO;
  }
  return null;
};

const esVentaContadoAuditable = (venta) => {
  if (venta?.activo === false) return false;

  const tipoPago = clasificarFormaPagoVenta(venta?.formaPago);
  if (!tipoPago) return false;

  const cierreCaja = normalizarNombre(venta?.cierreCaja);
  return cierreCaja === "CONTADO" || !cierreCaja;
};

const esMovimientoCompatible = (movimiento, tipoPago) => {
  const detalle = normalizarNombre(movimiento?.detalle);
  const formaPago = normalizarNombre(movimiento?.formaPago);

  if (tipoPago === TIPO_PAGO.TARJETA_CREDITO) {
    return detalle.includes("TARJETA") && detalle.includes("CREDITO");
  }

  return detalle === "CONTADO" && formaPago === "EFECTIVO";
};

const tokenizarNombre = (nombre) =>
  normalizarNombre(nombre).split(" ").filter(Boolean);

const esNombreParcialCompatible = (left, right) => {
  const tokensLeft = tokenizarNombre(left);
  const tokensRight = tokenizarNombre(right);
  if (Math.min(tokensLeft.length, tokensRight.length) < 2) return false;

  const [menor, mayor] = tokensLeft.length <= tokensRight.length
    ? [tokensLeft, tokensRight]
    : [tokensRight, tokensLeft];

  return menor.every((token) => mayor.includes(token));
};

const compararNombresClientes = (left, right) => {
  const normalizadoLeft = normalizarNombre(left);
  const normalizadoRight = normalizarNombre(right);
  if (!normalizadoLeft || !normalizadoRight) {
    return { coincide: false, similitud: 0, tipo: null };
  }

  if (normalizadoLeft === normalizadoRight) {
    return { coincide: true, similitud: 1, tipo: "NOMBRE_EXACTO" };
  }

  if (esNombreParcialCompatible(left, right)) {
    return { coincide: true, similitud: 1, tipo: "NOMBRE_PARCIAL" };
  }

  const similitud = calcularSimilitudNombres(left, right);
  return {
    coincide: similitud >= UMBRAL_SIMILITUD,
    similitud,
    tipo: similitud >= UMBRAL_SIMILITUD ? "NOMBRE_SIMILAR" : null,
  };
};

const obtenerNombreMovimiento = (movimiento, clientesPorId) => {
  const cliente = clientesPorId.get(Number(movimiento?.clienteId));
  return String(cliente?.cliente || movimiento?.entidad || "").trim();
};

const prepararMovimientos = ({ movimientos, cierres, clientes, agencias }) => {
  const cierresPorId = new Map(
    cierres.map((item) => [Number(plano(item).id), plano(item)]),
  );
  const clientesPorId = new Map(
    clientes.map((item) => [Number(plano(item).id), plano(item)]),
  );
  const agenciasPorId = new Map(
    agencias.map((item) => [Number(plano(item).id), plano(item)]),
  );

  return movimientos.map(plano).map((movimiento) => {
    const cierre = cierresPorId.get(Number(movimiento.cierreId));
    const agencia = agenciasPorId.get(Number(cierre?.agenciaId));

    return {
      ...movimiento,
      fecha: normalizarFechaCalendario(cierre?.fecha),
      agenciaId: Number(cierre?.agenciaId) || null,
      agencia: agencia?.nombre || "",
      clienteCaja: obtenerNombreMovimiento(movimiento, clientesPorId),
      montoCentavos: aCentavos(movimiento.valor),
    };
  });
};

const prepararVentas = (ventas = []) =>
  ventas
    .map(plano)
    .filter(esVentaContadoAuditable)
    .map((venta, index) => ({
      ...venta,
      _key: `${venta.detalleVentaId || venta.id || "venta"}-${index}`,
      tipoPago: clasificarFormaPagoVenta(venta.formaPago),
      fechaNormalizada: normalizarFechaCalendario(venta.fecha),
      clienteVenta: String(venta.nombre || venta.cliente || "").trim(),
      montoCentavos: aCentavos(venta.precioVendedor ?? venta.precioVenta),
    }))
    .filter((venta) => venta.fechaNormalizada && venta.montoCentavos !== null);

const crearResultadoSinMovimiento = (venta, movimientosCompatibles) => {
  const esTarjeta = venta.tipoPago === TIPO_PAGO.TARJETA_CREDITO;
  const ambiguo = movimientosCompatibles.length > 0;

  return {
    ventaId: Number(venta.id) || null,
    detalleVentaId: Number(venta.detalleVentaId) || null,
    fecha: venta.fechaNormalizada,
    clienteVenta: venta.clienteVenta,
    modelo: [venta.marca, venta.modelo].filter(Boolean).join(" ").trim(),
    formaPagoVenta: venta.formaPago || "",
    tipoPago: venta.tipoPago,
    montoVenta: desdeCentavos(venta.montoCentavos),
    estado: esTarjeta
      ? "REVISAR_EN_BANCOS"
      : ambiguo
        ? "COINCIDENCIA_AMBIGUA_CAJA"
        : "NO_EN_CAJA",
    observacion: esTarjeta
      ? "REVISAR EN BANCOS"
      : ambiguo
        ? "Existen movimientos posibles, pero no hay una coincidencia unica."
        : "La venta en efectivo no aparece en ninguna caja del mismo dia.",
    movimientoCajaId: null,
    cierreId: null,
    agenciaCaja: "",
    clienteCaja: "",
    montoCaja: null,
    diferencia: desdeCentavos(venta.montoCentavos),
    similitudCliente: null,
    tipoCoincidencia: null,
  };
};

const construirAuditoriaVentasCaja = ({
  ventas = [],
  cierres = [],
  movimientos = [],
  clientes = [],
  agencias = [],
} = {}) => {
  const ventasPreparadas = prepararVentas(ventas);
  const movimientosPreparados = prepararMovimientos({
    movimientos,
    cierres,
    clientes,
    agencias,
  });
  const asignados = new Set();
  const resultados = [];

  ventasPreparadas.forEach((venta) => {
    const candidatosDia = movimientosPreparados.filter(
      (movimiento) =>
        movimiento.fecha === venta.fechaNormalizada &&
        esMovimientoCompatible(movimiento, venta.tipoPago),
    );
    const candidatos = candidatosDia
      .filter((movimiento) => !asignados.has(Number(movimiento.id)))
      .map((movimiento) => {
        const montoExacto = movimiento.montoCentavos === venta.montoCentavos;
        const nombres = compararNombresClientes(
          venta.clienteVenta,
          movimiento.clienteCaja,
        );
        const clienteIdExacto = Boolean(
          venta.clienteId &&
          movimiento.clienteId &&
          Number(venta.clienteId) === Number(movimiento.clienteId),
        );

        return {
          movimiento,
          montoExacto,
          nombres,
          clienteIdExacto,
          puntaje:
            (clienteIdExacto ? 500 : 0) +
            (montoExacto ? 250 : 0) +
            (nombres.coincide ? 100 + nombres.similitud * 100 : 0),
        };
      });
    const candidatosConIdentidad = candidatos.filter(
      (item) => item.clienteIdExacto || item.nombres.coincide,
    );
    const candidatosSoloMonto = candidatos.filter((item) => item.montoExacto);
    let mejor = candidatosConIdentidad.sort((a, b) => b.puntaje - a.puntaje)[0];

    if (!mejor && candidatosSoloMonto.length === 1) {
      mejor = candidatosSoloMonto[0];
    }

    if (!mejor) {
      resultados.push(crearResultadoSinMovimiento(venta, candidatos));
      return;
    }

    asignados.add(Number(mejor.movimiento.id));
    const diferenciaCentavos = venta.montoCentavos - mejor.movimiento.montoCentavos;
    const tipoCoincidencia = mejor.clienteIdExacto
      ? mejor.montoExacto
        ? "CLIENTE_ID_Y_MONTO"
        : "CLIENTE_ID"
      : mejor.nombres.coincide
        ? mejor.montoExacto
          ? `${mejor.nombres.tipo}_Y_MONTO`
          : mejor.nombres.tipo
        : "MONTO_UNICO";

    resultados.push({
      ventaId: Number(venta.id) || null,
      detalleVentaId: Number(venta.detalleVentaId) || null,
      fecha: venta.fechaNormalizada,
      clienteVenta: venta.clienteVenta,
      modelo: [venta.marca, venta.modelo].filter(Boolean).join(" ").trim(),
      formaPagoVenta: venta.formaPago || "",
      tipoPago: venta.tipoPago,
      montoVenta: desdeCentavos(venta.montoCentavos),
      estado: diferenciaCentavos === 0 ? "COINCIDE_CAJA" : "MONTO_DIFERENTE_CAJA",
      observacion:
        diferenciaCentavos === 0
          ? "OK"
          : "El cliente aparece en caja, pero el valor es diferente.",
      movimientoCajaId: Number(mejor.movimiento.id) || null,
      cierreId: Number(mejor.movimiento.cierreId) || null,
      agenciaCaja: mejor.movimiento.agencia,
      clienteCaja: mejor.movimiento.clienteCaja,
      montoCaja: desdeCentavos(mejor.movimiento.montoCentavos),
      diferencia: desdeCentavos(diferenciaCentavos),
      similitudCliente: Number((mejor.nombres.similitud * 100).toFixed(2)),
      tipoCoincidencia,
    });
  });

  const resumen = resultados.reduce(
    (acc, resultado) => {
      acc.totalVentasContado += 1;
      acc.totalVenta += Number(resultado.montoVenta) || 0;
      if (resultado.movimientoCajaId) {
        acc.totalCajaCoincidente += Number(resultado.montoCaja) || 0;
      }
      if (resultado.estado === "COINCIDE_CAJA") acc.coincidenCaja += 1;
      if (resultado.estado === "NO_EN_CAJA") acc.sinRegistroCaja += 1;
      if (resultado.estado === "REVISAR_EN_BANCOS") acc.revisarBancos += 1;
      if (resultado.estado === "MONTO_DIFERENTE_CAJA") acc.montoDiferente += 1;
      if (resultado.estado === "COINCIDENCIA_AMBIGUA_CAJA") acc.ambiguas += 1;
      return acc;
    },
    {
      totalVentasContado: 0,
      coincidenCaja: 0,
      sinRegistroCaja: 0,
      revisarBancos: 0,
      montoDiferente: 0,
      ambiguas: 0,
      totalVenta: 0,
      totalCajaCoincidente: 0,
    },
  );
  resumen.totalVenta = Number(resumen.totalVenta.toFixed(2));
  resumen.totalCajaCoincidente = Number(resumen.totalCajaCoincidente.toFixed(2));
  resumen.diferencia = Number(
    (resumen.totalVenta - resumen.totalCajaCoincidente).toFixed(2),
  );

  return { resumen, resultados };
};

const auditarVentasContadoContraCaja = async (
  { ventas = [] } = {},
  dependencies = {},
) => {
  const CierreCajaModel = dependencies.CierreCaja || CierreCaja;
  const MovimientoCajaModel = dependencies.MovimientoCaja || MovimientoCaja;
  const ClienteModel = dependencies.Cliente || Cliente;
  const AgenciaModel = dependencies.Agencia || Agencia;
  const fechas = [
    ...new Set(
      prepararVentas(ventas).map((venta) => venta.fechaNormalizada).filter(Boolean),
    ),
  ];

  if (!fechas.length) return construirAuditoriaVentasCaja({ ventas });

  const cierres = await CierreCajaModel.findAll({
    where: {
      fecha: { [Op.in]: fechas },
      estadoCierre: { [Op.ne]: "ANULADO" },
    },
    attributes: ["id", "fecha", "agenciaId", "estadoCierre"],
    order: [["fecha", "ASC"], ["id", "ASC"]],
  });
  const cierreIds = cierres.map((item) => Number(plano(item).id)).filter(Boolean);
  const movimientos = cierreIds.length
    ? await MovimientoCajaModel.findAll({
        where: { cierreId: { [Op.in]: cierreIds } },
        attributes: [
          "id",
          "cierreId",
          "detalle",
          "entidad",
          "clienteId",
          "valor",
          "formaPago",
          "responsable",
          "recibo",
        ],
        order: [["id", "ASC"]],
      })
    : [];
  const clienteIds = [
    ...new Set(movimientos.map((item) => Number(plano(item).clienteId)).filter(Boolean)),
  ];
  const agenciaIds = [
    ...new Set(cierres.map((item) => Number(plano(item).agenciaId)).filter(Boolean)),
  ];
  const [clientes, agencias] = await Promise.all([
    clienteIds.length
      ? ClienteModel.findAll({
          where: { id: { [Op.in]: clienteIds } },
          attributes: ["id", "cliente"],
        })
      : [],
    agenciaIds.length
      ? AgenciaModel.findAll({
          where: { id: { [Op.in]: agenciaIds } },
          attributes: ["id", "nombre"],
        })
      : [],
  ]);

  return construirAuditoriaVentasCaja({
    ventas,
    cierres,
    movimientos,
    clientes,
    agencias,
  });
};

module.exports = {
  TIPO_PAGO,
  auditarVentasContadoContraCaja,
  clasificarFormaPagoVenta,
  compararNombresClientes,
  construirAuditoriaVentasCaja,
  esMovimientoCompatible,
  esVentaContadoAuditable,
};
