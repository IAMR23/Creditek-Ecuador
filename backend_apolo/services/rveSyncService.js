const RUTA_SALIDA_RVE = "/api/integraciones/abs/usuarios/salida";
const ORIGEN_MOVIMIENTOS_TERMINALES = "ABS_MOVIMIENTOS_TERMINALES";
const TIMEOUT_MS = 5000;

const construirUrlSalidaRve = (urlConfigurada) => {
  const valor = String(urlConfigurada || "").trim();
  if (!valor) return null;

  if (valor.replace(/\/+$/, "").endsWith(RUTA_SALIDA_RVE)) {
    return valor.replace(/\/+$/, "");
  }

  return `${valor.replace(/\/+$/, "")}${RUTA_SALIDA_RVE}`;
};

const leerRespuesta = async (response) => {
  const contenido = await response.text();
  if (!contenido) return {};

  try {
    return JSON.parse(contenido);
  } catch {
    return { message: contenido.slice(0, 300) };
  }
};

const sincronizarSalidaUsuarioRve = async ({
  cedula,
  fechaSalida,
  desactivar = false,
  origen = ORIGEN_MOVIMIENTOS_TERMINALES,
}) => {
  const cedulaNormalizada = String(cedula || "").trim();

  if (!cedulaNormalizada) {
    console.warn(
      "Sincronizacion ABS -> RVE omitida: el usuario ABS no tiene cedula.",
    );
    return {
      ok: false,
      sincronizado: false,
      omitido: true,
      motivo: "CEDULA_VACIA",
    };
  }

  const url = construirUrlSalidaRve(process.env.RVE_SYNC_URL);
  const token = String(process.env.RVE_SYNC_TOKEN || "").trim();

  if (!url || !token) {
    throw new Error(
      "Sincronizacion ABS -> RVE no configurada: faltan RVE_SYNC_URL o RVE_SYNC_TOKEN.",
    );
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-internal-token": token,
    },
    body: JSON.stringify({
      cedula: cedulaNormalizada,
      fechaSalida,
      desactivar: Boolean(desactivar),
      origen,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const payload = await leerRespuesta(response);

  if (!response.ok) {
    const detalle = payload?.message ? ` ${payload.message}` : "";
    throw new Error(
      `RVE respondio HTTP ${response.status} al sincronizar la salida.${detalle}`,
    );
  }

  return payload;
};

module.exports = {
  ORIGEN_MOVIMIENTOS_TERMINALES,
  construirUrlSalidaRve,
  sincronizarSalidaUsuarioRve,
};
