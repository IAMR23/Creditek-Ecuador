const RUTA_USUARIO_ABS = "/api/integraciones/rve/usuarios/por-cedula";
const TIMEOUT_MS = 5000;

const construirUrlUsuarioAbs = (urlConfigurada, cedula) => {
  const base = String(urlConfigurada || "").trim().replace(/\/+$/, "");
  if (!base) return null;

  const cedulaCodificada = encodeURIComponent(String(cedula || "").trim());
  if (base.endsWith(RUTA_USUARIO_ABS)) {
    return `${base}/${cedulaCodificada}`;
  }

  return `${base}${RUTA_USUARIO_ABS}/${cedulaCodificada}`;
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

const crearErrorConsulta = (message, statusCode, payload = null) =>
  Object.assign(new Error(message), { statusCode, payload });

const consultarUsuarioAbsPorCedula = async (cedula) => {
  const cedulaNormalizada = String(cedula || "").trim();
  if (!cedulaNormalizada) {
    throw crearErrorConsulta("La cedula es obligatoria.", 400);
  }

  const url = construirUrlUsuarioAbs(
    process.env.ABS_SYNC_URL,
    cedulaNormalizada,
  );
  const token = String(process.env.ABS_SYNC_TOKEN || "").trim();

  if (!url || !token) {
    throw crearErrorConsulta(
      "Consulta RVE -> ABS no configurada: faltan ABS_SYNC_URL o ABS_SYNC_TOKEN.",
      503,
    );
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-internal-token": token,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const payload = await leerRespuesta(response);

  if (!response.ok) {
    throw crearErrorConsulta(
      payload?.message || `ABS respondio HTTP ${response.status}.`,
      response.status,
      payload,
    );
  }

  return payload;
};

module.exports = {
  RUTA_USUARIO_ABS,
  construirUrlUsuarioAbs,
  consultarUsuarioAbsPorCedula,
};
