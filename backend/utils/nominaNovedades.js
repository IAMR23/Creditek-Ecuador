const redondear = (value) => Number(Number(value).toFixed(2));
const numero = (value) => Number(String(value ?? 0).replace(',', '.')) || 0;
const errorValidacion = (message) => Object.assign(new Error(message), { statusCode: 400 });
const fechaValida = (value, campo, opcional = false) => {
  if ((value === '' || value == null) && opcional) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw errorValidacion(`${campo}: fecha inválida`);
  }
  return value;
};
const validarPeriodo = ({ anio, mes }) => {
  if (!Number.isInteger(Number(anio)) || Number(anio) < 2000 || Number(anio) > 2100 ||
      !Number.isInteger(Number(mes)) || Number(mes) < 1 || Number(mes) > 12) throw errorValidacion('Período inválido');
  return `${Number(anio)}-${String(Number(mes)).padStart(2, '0')}`;
};
const validarDias = (maternidad, completos) => {
  if (![maternidad, completos].every((value) => Number.isFinite(value) && value >= 0 && value <= 30)) {
    throw errorValidacion('Los días deben estar entre 0 y 30');
  }
  if (maternidad + completos > 30) throw errorValidacion('La suma de días no puede superar 30');
};
const validarNovedad = (data) => {
  const usuarioId = Number(data.usuarioId);
  if (!Number.isInteger(usuarioId) || usuarioId < 1) throw errorValidacion('Empleado inválido');
  if (!['MATERNIDAD', 'LACTANCIA'].includes(data.tipo)) throw errorValidacion('Tipo de novedad inválido');
  const fechaInicio = fechaValida(data.fechaInicio, 'Fecha de inicio');
  const fechaFin = fechaValida(data.fechaFin, 'Fecha final');
  const fechaRetorno = fechaValida(data.fechaRetorno, 'Fecha de retorno', true);
  if (fechaFin < fechaInicio) throw errorValidacion('La fecha final no puede ser anterior al inicio');
  if (fechaRetorno && fechaRetorno < fechaInicio) throw errorValidacion('El retorno no puede ser anterior al inicio');
  const porcentaje = (value, fallback) => {
    const parsed = value == null || value === '' ? fallback : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw errorValidacion('Porcentaje inválido');
    if (Math.abs(parsed - redondear(parsed)) > 0.000001) throw errorValidacion('El porcentaje admite hasta dos decimales');
    return parsed;
  };
  const porcentajeEmpleador = porcentaje(data.porcentajeEmpleador, 25);
  const porcentajeIess = porcentaje(data.porcentajeIess, 75);
  if (Math.abs(porcentajeEmpleador + porcentajeIess - 100) > 0.000001) throw errorValidacion('Los porcentajes deben sumar 100');
  if (data.activo != null && typeof data.activo !== 'boolean') throw errorValidacion('Estado inválido');
  if ([data.diasMaternidad25Manual, data.diasSueldoCompletoManual].some((value) => value != null && value !== '')) {
    throw errorValidacion('Los días se calculan automáticamente por fechas; ya no se admiten días manuales');
  }
  if (String(data.observacion || '').length > 2000) throw errorValidacion('La observación no puede superar 2000 caracteres');
  validarPeriodo(data);
  return { usuarioId, tipo: data.tipo, fechaInicio, fechaFin, fechaRetorno, porcentajeEmpleador, porcentajeIess,
    activo: data.activo ?? true, observacion: String(data.observacion || '').trim(),
    ajustesMensuales: {} };
};

// Mes laboral de 30: el día 31 no añade días y el cierre de febrero completa 30.
const diasEnMes30 = (inicio, fin, periodo) => {
  const key = validarPeriodo(periodo);
  const ultimo = new Date(Date.UTC(Number(periodo.anio), Number(periodo.mes), 0)).toISOString().slice(0, 10);
  const desde = inicio > `${key}-01` ? inicio : `${key}-01`;
  const hasta = fin < ultimo ? fin : ultimo;
  if (desde > hasta) return 0;
  const limiteInicio = Math.min(Number(desde.slice(8)) - 1, 30);
  const limiteFin = hasta === ultimo ? 30 : Math.min(Number(hasta.slice(8)), 30);
  return Math.max(0, limiteFin - limiteInicio);
};
const finMaternidad = (novedad) => {
  if (!novedad.fechaRetorno) return novedad.fechaFin;
  const anterior = new Date(`${novedad.fechaRetorno}T00:00:00Z`);
  anterior.setUTCDate(anterior.getUTCDate() - 1);
  return [novedad.fechaFin, anterior.toISOString().slice(0, 10)].sort()[0];
};
const novedadesDelMes = (novedades, periodo) => {
  const key = validarPeriodo(periodo);
  return novedades.filter((item) => item.activo !== false && item.fechaInicio.slice(0, 7) <= key && item.fechaFin.slice(0, 7) >= key);
};

// Conserva las fórmulas previas para quien no tiene una novedad en el período.
const calcularNominaPeriodo = (row, periodo, novedades = [], sueldoMensual = 482) => {
  if (!Number.isFinite(sueldoMensual) || sueldoMensual < 0) throw errorValidacion('Sueldo mensual inválido');
  const key = validarPeriodo(periodo);
  const vigentes = novedadesDelMes(novedades, periodo);
  const maternidades = vigentes.filter((item) => item.tipo === 'MATERNIDAD' &&
    diasEnMes30(item.fechaInicio, finMaternidad(item), periodo) > 0);
  const lactancias = vigentes.filter((item) => item.tipo === 'LACTANCIA' &&
    diasEnMes30(item.fechaRetorno && item.fechaRetorno > item.fechaInicio ? item.fechaRetorno : item.fechaInicio, item.fechaFin, periodo) > 0);
  const tieneMaternidad = maternidades.length > 0;
  let diasTrabajados = row.fechaIngreso?.slice(0, 7) > key ? 0
    : row.fechaIngreso?.slice(0, 7) === key ? Math.max(0, Math.min(30, 31 - Number(row.fechaIngreso.slice(8, 10)))) : 30;
  let diasMaternidad25 = 0;
  let diasSueldoCompleto = diasTrabajados;
  let sueldoMaternidadEmpresa = 0;
  let subsidioIessInformativo = 0;
  const valorDia = sueldoMensual / 30;
  for (const novedad of maternidades) {
    // Los ajustes manuales antiguos se conservan como historial, pero no intervienen.
    const dias = diasEnMes30(novedad.fechaInicio, finMaternidad(novedad), periodo);
    diasMaternidad25 += dias;
    sueldoMaternidadEmpresa += valorDia * dias * numero(novedad.porcentajeEmpleador ?? 25) / 100;
    subsidioIessInformativo += valorDia * dias * numero(novedad.porcentajeIess ?? 75) / 100;
  }
  if (tieneMaternidad) {
    diasSueldoCompleto = 30 - diasMaternidad25;
    validarDias(diasMaternidad25, diasSueldoCompleto);
    diasTrabajados = diasMaternidad25 + diasSueldoCompleto;
  } else if (lactancias.length) {
    diasTrabajados = 30;
    diasSueldoCompleto = 30;
  }
  sueldoMaternidadEmpresa = redondear(sueldoMaternidadEmpresa);
  subsidioIessInformativo = redondear(subsidioIessInformativo);
  const sueldoCompletoPeriodo = redondear(valorDia * diasSueldoCompleto);
  const sueldoAPagar = redondear(sueldoCompletoPeriodo + sueldoMaternidadEmpresa);
  const sueldosExtras = row.sueldosExtrasManual != null ? numero(row.sueldosExtrasManual) : redondear(numero(row.rolPagoSueldoExtra) * diasTrabajados / 30);
  const fondosReserva = row.fondosReservaManual != null ? redondear(numero(row.fondosReservaManual))
    : row.fondoReservaActivo ? redondear(((tieneMaternidad ? sueldoMensual : sueldoAPagar) + sueldosExtras) / 12) : 0;
  const comisionVenta = numero(row.ingresosComisiones);
  const totalIngresos = redondear(sueldoAPagar + sueldosExtras + fondosReserva + comisionVenta);
  const baseIess = tieneMaternidad ? sueldoMensual : totalIngresos;
  const iess = redondear(baseIess * 0.0945);
  const anticipo = redondear(numero(row.totalAnticipos) - numero(row.descuentosMeta));
  const prestamo = redondear(numero(row.sumanPrestamos) + numero(row.prestamosEgresos));
  const sancionMeta = numero(row.descuentosMetaCalculado);
  const totalEgresos = redondear(iess + anticipo + prestamo + sancionMeta);
  const valorRecibir = redondear(totalIngresos - totalEgresos);
  const aplicables = [...maternidades, ...lactancias];
  return { salario: sueldoMensual, diasTrabajados, diasMaternidad25, diasSueldoCompleto, sueldoCompletoPeriodo,
    sueldoMaternidadEmpresa, subsidioIessInformativo, sueldoAPagar, sueldosExtras, fondosReserva, comisionVenta,
    totalIngresos, totalIngresosEmpresa: totalIngresos, baseIess, iess, anticipo, prestamo, sancionMeta, totalEgresos,
    valorRecibir, valorRecibirEmpresa: valorRecibir, tieneMaternidad,
    tipoNovedad: [...new Set(aplicables.map((item) => item.tipo))].join(' / '),
    observacionNovedad: aplicables.map((item) => item.observacion).filter(Boolean).join('; ') };
};
module.exports = { validarNovedad, validarDias, validarPeriodo, diasEnMes30, novedadesDelMes, calcularNominaPeriodo };
