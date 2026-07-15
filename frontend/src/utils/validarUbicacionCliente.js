export const MENSAJE_UBICACION_CLIENTE_INVALIDA =
  "La ubicación del cliente debe incluir texto; no puede contener solo números.";

export const esUbicacionClienteValida = (valor) => {
  const ubicacion = String(valor ?? "").trim();

  if (!ubicacion) return true;

  return /[a-záéíóúüñ]/i.test(ubicacion);
};
