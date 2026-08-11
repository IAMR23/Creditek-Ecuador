const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const PRECIO_CARGA = "precioCarga";
const PRECIO_CONTADO = "precioContado";
const PRECIO_TARJETA_CREDITO = "precioTarjetaCredito";

const obtenerTipoPrecioFormaPago = (formaPago) => {
  if (Number(formaPago?.id ?? formaPago?.formaPagoId) === 1) {
    return PRECIO_CARGA;
  }

  const nombre = normalizarTexto(formaPago?.nombre ?? formaPago?.formaPago);

  if (nombre.includes("tarjeta")) {
    return PRECIO_TARJETA_CREDITO;
  }

  if (nombre.includes("credito")) {
    return PRECIO_CARGA;
  }

  return PRECIO_CONTADO;
};

const seleccionarPrecioCostoHistorico = (costoHistorico, formaPago) => {
  const tipoPrecioSolicitado = obtenerTipoPrecioFormaPago(formaPago);
  let tipoPrecio = tipoPrecioSolicitado;
  let precio = costoHistorico?.[tipoPrecioSolicitado];

  if (
    tipoPrecioSolicitado === PRECIO_TARJETA_CREDITO &&
    (precio === null || precio === undefined || precio === "")
  ) {
    tipoPrecio = PRECIO_CONTADO;
    precio = costoHistorico?.[PRECIO_CONTADO];
  }

  return {
    tipoPrecio,
    tipoPrecioSolicitado,
    precio:
      precio === null || precio === undefined || precio === ""
        ? null
        : Number(precio),
  };
};

const obtenerEtiquetaTipoPrecio = (tipoPrecio) => {
  if (tipoPrecio === PRECIO_CARGA) return "precio carga";
  if (tipoPrecio === PRECIO_TARJETA_CREDITO) {
    return "precio tarjeta de credito";
  }
  return "precio contado";
};

module.exports = {
  PRECIO_CARGA,
  PRECIO_CONTADO,
  PRECIO_TARJETA_CREDITO,
  obtenerEtiquetaTipoPrecio,
  obtenerTipoPrecioFormaPago,
  seleccionarPrecioCostoHistorico,
};
