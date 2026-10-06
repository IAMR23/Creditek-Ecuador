const normalizar = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();
const esRepartidor = (user) => normalizar(user?.rol) === "repartidor";
const esAdministrador = (user) =>
  ["admin", "administrador"].includes(normalizar(user?.rol));
const VEHICULOS_COMBUSTIBLE = [
  "MOTO ROJA",
  "FURGONETA",
  "CARRO HAVAL",
  "MOTO AZUL",
];

const errorCombustible = (status, message) =>
  Object.assign(new Error(message), {
    status,
    code: "COMBUSTIBLE_ERROR",
  });

const validarId = (valor, nombre = "id") => {
  if (!/^[1-9]\d*$/.test(String(valor)) || Number(valor) > 2147483647) {
    throw errorCombustible(
      400,
      `${nombre} debe ser un entero positivo válido.`,
    );
  }
  return Number(valor);
};

const validarFecha = (valor, nombre = "Fecha") => {
  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor) ||
    valor < "1900-01-01" ||
    valor > "9999-12-31"
  ) {
    throw errorCombustible(
      400,
      `${nombre} es obligatoria y debe usar el formato AAAA-MM-DD.`,
    );
  }
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== valor
  ) {
    throw errorCombustible(400, `${nombre} no es una fecha válida.`);
  }
  return valor;
};

const validarDecimal = (valor, nombre) => {
  if (
    !["string", "number"].includes(typeof valor) ||
    !/^\d+(\.\d{1,2})?$/.test(String(valor)) ||
    !Number.isFinite(Number(valor)) ||
    Number(valor) > 99999999.99
  ) {
    throw errorCombustible(
      400,
      `${nombre} debe ser un número entre 0 y 99999999.99, con máximo dos decimales.`,
    );
  }
  return Number(valor);
};

const validarRegistro = (data = {}) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw errorCombustible(400, "El registro no es válido.");
  }
  const fecha = validarFecha(data.fecha);
  if (!VEHICULOS_COMBUSTIBLE.includes(data.vehiculo)) {
    throw errorCombustible(
      400,
      "Selecciona un vehículo válido: MOTO ROJA, FURGONETA, CARRO HAVAL o MOTO AZUL.",
    );
  }
  const vehiculo = data.vehiculo;
  const kilometrajeInicial = validarDecimal(
    data.kilometrajeInicial,
    "Kilometraje inicial",
  );
  const kilometrajeFinal = validarDecimal(
    data.kilometrajeFinal,
    "Kilometraje final",
  );
  if (kilometrajeFinal < kilometrajeInicial) {
    throw errorCombustible(
      400,
      "El kilometraje final debe ser mayor o igual al inicial.",
    );
  }
  const costoCombustible = validarDecimal(
    data.costoCombustible,
    "Costo de combustible",
  );
  if (data.observacion != null && typeof data.observacion !== "string") {
    throw errorCombustible(400, "La observación debe ser texto.");
  }
  const observacion = (data.observacion || "").trim();
  if (observacion.length > 2000) {
    throw errorCombustible(
      400,
      "La observación no puede superar 2000 caracteres.",
    );
  }
  return {
    fecha,
    vehiculo,
    kilometrajeInicial,
    kilometrajeFinal,
    kilometrosRecorridos:
      (Math.round(kilometrajeFinal * 100) -
        Math.round(kilometrajeInicial * 100)) /
      100,
    costoCombustible,
    observacion,
  };
};

module.exports = {
  VEHICULOS_COMBUSTIBLE,
  esAdministrador,
  esRepartidor,
  errorCombustible,
  validarDecimal,
  validarFecha,
  validarId,
  validarRegistro,
};
