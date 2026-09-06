const TIPOS_PRESTAMO = ["PLAN_MOVISTAR", "MECANICA", "LENTES", "PRESTAMO_EMPRESARIAL", "CUOTAS_TELEFONO", "OTROS"];
const cuotaPrestamoDelMes = (registro, { anio, mes }) => {
  if (registro.activo === false || registro.seccion !== "PRESTAMOS") return 0;
  const periodo = `${anio}-${String(mes).padStart(2, "0")}`;
  const creado = registro.createdAt instanceof Date
    ? new Date(registro.createdAt.getTime() - 5 * 60 * 60 * 1000).toISOString()
    : registro.createdAt;
  const inicio = String(registro.fecha || creado || "").slice(0, 7);
  const fin = String(registro.fechaFin || "").slice(0, 7);
  return inicio && inicio <= periodo && (!fin || periodo <= fin) ? Number(registro.valor || 0) : 0;
};
module.exports = { TIPOS_PRESTAMO, cuotaPrestamoDelMes };
