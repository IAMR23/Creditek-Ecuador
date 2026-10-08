const DISPOSITIVOS = [
  { value: "LAPTOP", label: "Laptop" },
  { value: "COMPUTADOR_ESCRITORIO", label: "Computador de escritorio" },
  { value: "AUDIFONOS", label: "Audífonos" },
  { value: "CELULAR", label: "Celular" },
  { value: "CARGADOR_LAPTOP", label: "Cargador de laptop" },
  { value: "CARGADOR_CELULAR", label: "Cargador de celular" },
  { value: "IMPRESORA", label: "Impresora" },
  { value: "REGULADOR_VOLTAJE", label: "Regulador de voltaje" },
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

const normalizarPrecio = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valido: true, valor: null };
  }

  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < 0 || numero > 9999999999.99) {
    return { valido: false, valor: null };
  }

  return { valido: true, valor: Number(numero.toFixed(2)) };
};

const normalizarCantidad = (value) => {
  const numero = Number(value ?? 1);
  if (!Number.isInteger(numero) || numero < 1 || numero > 2147483647) {
    return { valido: false, valor: null };
  }

  return { valido: true, valor: numero };
};

const fechaActualEcuador = () =>
  new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

const normalizarFechaIngreso = (value) => {
  const fecha = String(value || fechaActualEcuador()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { valido: false, valor: null };
  }

  const [anio, mes, dia] = fecha.split("-").map(Number);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  const valido =
    fechaUtc.getUTCFullYear() === anio &&
    fechaUtc.getUTCMonth() === mes - 1 &&
    fechaUtc.getUTCDate() === dia;

  return { valido, valor: valido ? fecha : null };
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

const obtenerResumenInventario = (registros = []) => {
  const responsables = new Set();
  const cantidades = new Map(
    DISPOSITIVOS.map((dispositivo) => [
      dispositivo.value,
      { ...dispositivo, cantidad: 0 },
    ]),
  );
  const resumen = {
    items: 0,
    operativos: 0,
    mantenimiento: 0,
    fueraServicio: 0,
    responsables: 0,
    porDispositivo: [],
  };

  registros.forEach((registro) => {
    const item = registro?.get
      ? registro.get({ plain: true })
      : registro;
    if (!item) return;

    const cantidad = normalizarCantidad(item.cantidad).valor || 1;

    resumen.items += cantidad;
    if (item.estado === "OPERATIVO") resumen.operativos += cantidad;
    if (item.estado === "EN_MANTENIMIENTO") resumen.mantenimiento += cantidad;
    if (item.estado === "FUERA_DE_SERVICIO") resumen.fueraServicio += cantidad;
    if (item.responsableId) responsables.add(Number(item.responsableId));

    const nombreDispositivo =
      item.dispositivoMarca?.dispositivo?.nombre || item.nombre;
    const dispositivo = resolverDispositivo(nombreDispositivo);
    const value = dispositivo?.value || normalizarOpcion(nombreDispositivo);
    if (!value) return;

    const acumulado = cantidades.get(value) || {
      value,
      label: nombreDispositivo,
      cantidad: 0,
    };
    cantidades.set(value, {
      ...acumulado,
      cantidad: acumulado.cantidad + cantidad,
    });
  });

  resumen.responsables = responsables.size;
  resumen.porDispositivo = Array.from(cantidades.values());

  return resumen;
};

const validarInventario = (payload = {}, options = {}) => {
  const dispositivoMarcaId = idPositivo(payload.dispositivoMarcaId);
  const modeloId = idPositivo(payload.modeloId);
  const usaCatalogo = Boolean(dispositivoMarcaId && modeloId);
  const dispositivo = resolverDispositivo(payload.dispositivo ?? payload.nombre);
  const nombreCatalogo = limpiarTexto(payload.nombre ?? payload.dispositivo, 120);
  const estado = normalizarOpcion(payload.estado || "OPERATIVO");
  const agenciaId = idPositivo(payload.agenciaId);
  const responsableId = idPositivo(payload.responsableId);
  const cantidad = normalizarCantidad(payload.cantidad);
  const precio = normalizarPrecio(payload.precio);
  const fechaIngreso = normalizarFechaIngreso(payload.fechaIngreso);
  const errores = [];

  if (options.requiereCatalogo && !usaCatalogo) {
    errores.push("El tipo, la marca y el modelo son obligatorios");
  }
  if (!dispositivo && !(usaCatalogo && nombreCatalogo)) {
    errores.push("El dispositivo seleccionado no es válido");
  }
  if (Boolean(dispositivoMarcaId) !== Boolean(modeloId)) {
    errores.push("La marca y el modelo deben pertenecer al catálogo");
  }
  if (!ESTADOS_VALIDOS.has(estado)) errores.push("El estado no es válido");
  if (!agenciaId) errores.push("La agencia es obligatoria");
  if (!responsableId) errores.push("La persona responsable es obligatoria");
  if (!cantidad.valido) {
    errores.push("La cantidad debe ser un número entero mayor o igual a uno");
  }
  if (!precio.valido) {
    errores.push("El precio debe ser un valor valido mayor o igual a cero");
  }
  if (!fechaIngreso.valido) {
    errores.push("La fecha de ingreso no es válida");
  }

  return {
    errores,
    data: {
      nombre: usaCatalogo
        ? nombreCatalogo
        : dispositivo?.label || nombreCatalogo || null,
      marca: limpiarTexto(payload.marca, 80),
      modelo: limpiarTexto(payload.modelo, 120),
      dispositivoMarcaId,
      modeloId,
      fechaIngreso: fechaIngreso.valor,
      cantidad: cantidad.valor,
      precio: precio.valor,
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

  const nombreDispositivo =
    item.dispositivoMarca?.dispositivo?.nombre || item.nombre;
  const nombreMarca = item.dispositivoMarca?.marca?.nombre || item.marca || "";
  const nombreModelo = item.modeloCatalogo?.nombre || item.modelo || "";
  const dispositivo = resolverDispositivo(nombreDispositivo);

  return {
    id: item.id,
    dispositivo: dispositivo?.label || nombreDispositivo,
    dispositivoValor:
      dispositivo?.value || normalizarOpcion(nombreDispositivo),
    dispositivoId: item.dispositivoMarca?.dispositivo?.id || null,
    dispositivoMarcaId: item.dispositivoMarcaId || null,
    modeloId: item.modeloId || null,
    marca: nombreMarca,
    modelo: nombreModelo,
    fechaIngreso: item.fechaIngreso || null,
    cantidad: normalizarCantidad(item.cantidad).valor || 1,
    precio:
      item.precio === null || item.precio === undefined
        ? null
        : Number(item.precio),
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
  obtenerResumenInventario,
  normalizarFechaIngreso,
  resolverDispositivo,
  serializarInventario,
  validarInventario,
};
