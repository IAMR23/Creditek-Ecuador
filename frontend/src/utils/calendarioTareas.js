export const crearFechaLocal = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const formatearFechaISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const obtenerMesActual = () => {
  const hoy = new Date();
  return formatearFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
};

export const obtenerRangoMes = (mesReferencia) => {
  const referencia = crearFechaLocal(mesReferencia) || new Date();
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const fin = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);

  return {
    fechaInicio: formatearFechaISO(inicio),
    fechaFin: formatearFechaISO(fin),
  };
};

export const desplazarMes = (mesReferencia, cantidad) => {
  const referencia = crearFechaLocal(mesReferencia) || new Date();
  return formatearFechaISO(
    new Date(referencia.getFullYear(), referencia.getMonth() + cantidad, 1),
  );
};
