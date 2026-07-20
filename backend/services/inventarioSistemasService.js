const DISPOSITIVOS = [
  { value: "LAPTOP", label: "Laptop" },
  { value: "COMPUTADOR_ESCRITORIO", label: "Computador de escritorio" },
  { value: "AUDIFONOS", label: "Audífonos" },
  { value: "CELULAR", label: "Celular" },
  { value: "CARGADOR_LAPTOP", label: "Cargador de laptop" },
  { value: "CARGADOR_CELULAR", label: "Cargador de celular" },
];

const ESTADOS = [
  { value: "OPERATIVO", label: "Operativo" },
  { value: "EN_MANTENIMIENTO", label: "En mantenimiento" },
  { value: "FUERA_DE_SERVICIO", label: "Fuera de servicio" },
];

const ESTADOS_VALIDOS = new Set(ESTADOS.map((item) => item.value));

const limpiarTexto = (value, maxLength) => {
  const texto = String(value ?? "").trim().replace(/\s+/g, " ");
  return texto ? texto.slice(0, maxLength) : null;
};

const normalizarOpcion = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const idPositivo = (value) => {
  const numero = Number(value);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

const resolverDispositivo = (value) => {
  const opcion = normalizarOpcion(value);
  return (
    DISPOSITIVOS.find(
      (item) =>
        item.value === opcion || normalizarOpcion(item.label) === opcion,
    ) || null
  );
};

const validarInventario = (payload = {}) => {
  const dispositivo = resolverDispositivo(payload.dispositivo ?? payload.nombre);
  const estado = normalizarOpcion(payload.estado || "OPERATIVO");
  const agenciaId = idPositivo(payload.agenciaId);
  const responsableId = idPositivo(payload.responsableId);
  const errores = [];

  if (!dispositivo) errores.push("El dispositivo seleccionado no es válido");
  if (!ESTADOS_VALIDOS.has(estado)) errores.push("El estado no es válido");
  if (!agenciaId) errores.push("La agencia es obligatoria");
  if (!responsableId) errores.push("La persona responsable es obligatoria");

  return {
    errores,
    data: {
      nombre: dispositivo?.label || null,
      marca: limpiarTexto(payload.marca, 80),
      modelo: limpiarTexto(payload.modelo, 120),
      estado,
      observacion: limpiarTexto(payload.observacion, 3000),
      agenciaId,
      responsableId,
    },
  };
};

const serializarInventario = (registro) => {
  const item = registro?.get ? registro.get({ plain: true }) : registro;
  if (!item) return null;

  const dispositivo = resolverDispositivo(item.nombre);

  return {
    id: item.id,
    dispositivo: dispositivo?.label || item.nombre,
    dispositivoValor: dispositivo?.value || normalizarOpcion(item.nombre),
    marca: item.marca || "",
    modelo: item.modelo || "",
    estado: item.estado,
    observacion: item.observacion || "",
    agenciaId: item.agenciaId,
    responsableId: item.responsableId,
    agencia: item.agencia || null,
    responsable: item.responsable || null,
    creadoPor: item.creadoPor || null,
    actualizadoPor: item.actualizadoPor || null,
    activo: Boolean(item.activo),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

module.exports = {
  DISPOSITIVOS,
  ESTADOS,
  resolverDispositivo,
  serializarInventario,
  validarInventario,
};
