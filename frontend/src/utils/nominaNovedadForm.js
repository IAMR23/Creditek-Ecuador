export const formularioNovedad = (item) => ({
  tipo: item.tipo,
  fechaInicio: item.fechaInicio,
  fechaFin: item.fechaFin,
  fechaRetorno: item.fechaRetorno || '',
  porcentajeEmpleador: item.porcentajeEmpleador ?? 25,
  porcentajeIess: item.porcentajeIess ?? 75,
  activo: item.activo !== false,
  observacion: item.observacion || '',
});

export const novedadInicial = (registros, periodo, id = null) => {
  if (id != null) return registros.find((item) => String(item.id) === String(id)) || null;
  const delMes = registros.filter((item) => item.fechaInicio.slice(0, 7) <= periodo && item.fechaFin.slice(0, 7) >= periodo);
  return delMes.find((item) => item.activo !== false) || delMes[0] || null;
};
