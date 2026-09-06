const DIA_MS = 24 * 60 * 60 * 1000;

const fechaCivilUTC = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [anio, mes, dia] = match.slice(1).map(Number);
  const time = Date.UTC(anio, mes - 1, dia);
  const date = new Date(time);
  return date.getUTCFullYear() === anio && date.getUTCMonth() === mes - 1 && date.getUTCDate() === dia ? time : null;
};

// Mas de 15 dias cumplidos desde la fecha de ingreso (no fecha de creacion).
const superaQuinceDiasIngreso = (fechaIngreso, fechaReferencia) => {
  const ingreso = fechaCivilUTC(fechaIngreso);
  const referencia = fechaCivilUTC(fechaReferencia);
  return ingreso !== null && referencia !== null && (referencia - ingreso) / DIA_MS > 15;
};

const ventaCuentaParaPromedio = ({ fechaIngreso, fechaSalida, activo, fechaVenta, hoy }) => {
  // Quien permanece en la empresa y supera 15 dias aporta tambien sus ventas iniciales.
  const referencia = !fechaSalida && activo !== false ? hoy : fechaVenta;
  return superaQuinceDiasIngreso(fechaIngreso, referencia);
};

module.exports = { superaQuinceDiasIngreso, ventaCuentaParaPromedio };
