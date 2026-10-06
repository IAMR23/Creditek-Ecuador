export const VEHICULOS_COMBUSTIBLE = [
  "MOTO ROJA",
  "FURGONETA",
  "CARRO HAVAL",
  "MOTO AZUL",
];

export const fechaLocalHoy = () => {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
};

export const formularioVacio = () => ({
  fecha: fechaLocalHoy(),
  vehiculo: "",
  kilometrajeInicial: "",
  kilometrajeFinal: "",
  costoCombustible: "",
  observacion: "",
});

export const kilometrosCalculados = (inicial, final) => {
  if (
    inicial === "" ||
    final === "" ||
    !Number.isFinite(Number(inicial)) ||
    !Number.isFinite(Number(final))
  )
    return null;
  return (
    (Math.round(Number(final) * 100) - Math.round(Number(inicial) * 100)) / 100
  );
};

export const validarFormularioCombustible = (form) => {
  const fecha = new Date(`${form.fecha}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(form.fecha) ||
    form.fecha < "1900-01-01" ||
    form.fecha > "9999-12-31" ||
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== form.fecha
  ) {
    throw new Error("Selecciona una fecha válida.");
  }
  const campos = {
    kilometrajeInicial: "Kilometraje inicial",
    kilometrajeFinal: "Kilometraje final",
    costoCombustible: "Gasto de combustible",
  };
  if (!VEHICULOS_COMBUSTIBLE.includes(form.vehiculo)) {
    throw new Error("Selecciona uno de los vehículos disponibles.");
  }
  const datos = {
    fecha: form.fecha,
    vehiculo: form.vehiculo,
    observacion: form.observacion.trim(),
  };
  for (const [campo, nombre] of Object.entries(campos)) {
    if (
      !/^\d+(\.\d{1,2})?$/.test(String(form[campo])) ||
      Number(form[campo]) > 99999999.99
    ) {
      throw new Error(
        `${nombre}: ingresa un número entre 0 y 99999999.99 con máximo dos decimales.`,
      );
    }
    datos[campo] = Number(form[campo]);
  }
  if (datos.kilometrajeFinal < datos.kilometrajeInicial)
    throw new Error("El kilometraje final debe ser mayor o igual al inicial.");
  if (datos.observacion.length > 2000)
    throw new Error("La observación no puede superar 2000 caracteres.");
  return datos;
};

export const compararRepartidores = (registros) => {
  const gastos = new Map();
  for (const fila of registros)
    gastos.set(
      fila.userId,
      (gastos.get(fila.userId) || 0) + fila.costoCombustible,
    );
  const ids = [...gastos]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);
  const fechas = new Map();
  for (const fila of registros) {
    if (!fechas.has(fila.fecha))
      fechas.set(fila.fecha, {
        fecha: fila.fecha,
        ...Object.fromEntries(ids.map((id) => [`repartidor_${id}`, 0])),
      });
    if (ids.includes(fila.userId))
      fechas.get(fila.fecha)[`repartidor_${fila.userId}`] =
        fila.costoCombustible;
  }
  return {
    ids,
    datos: [...fechas.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    total: gastos.size,
  };
};
