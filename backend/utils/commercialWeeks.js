const MONTH_NAMES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

const THURSDAY = 4;

const pad = (value) => String(value).padStart(2, "0");

const assertValidYearMonth = (year, month) => {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericYear) || numericYear < 1900 || numericYear > 2500) {
    throw new Error("El anio debe ser valido");
  }

  if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12) {
    throw new Error("El mes debe estar entre 1 y 12");
  }

  return { year: numericYear, month: numericMonth };
};

const parseLocalDateOnly = (value) => {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new Error("Fecha invalida. Use formato YYYY-MM-DD");
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const toDateOnly = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date, days) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const buildWeekLabel = (startDate, endDate) => {
  const startMonth = MONTH_NAMES[startDate.getMonth()];
  const endMonth = MONTH_NAMES[endDate.getMonth()];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return `${startDate.getDate()} AL ${endDate.getDate()} DE ${endMonth}`;
  }

  if (startYear === endYear) {
    return `${startDate.getDate()} DE ${startMonth} AL ${endDate.getDate()} DE ${endMonth}`;
  }

  return `${startDate.getDate()} DE ${startMonth} ${startYear} AL ${endDate.getDate()} DE ${endMonth} ${endYear}`;
};

const getFirstThursdayOfYear = (yearInput) => {
  const year = Number(yearInput);
  if (!Number.isInteger(year) || year < 1900 || year > 2500) {
    throw new Error("El anio debe ser valido");
  }

  const firstDay = new Date(year, 0, 1);
  const daysSinceThursday = (firstDay.getDay() - THURSDAY + 7) % 7;
  return addDays(firstDay, -daysSinceThursday);
};

const getRequiredCommercialWeeksForYear = (yearInput) => {
  const startDate = getFirstThursdayOfYear(yearInput);
  const nextStartDate = getFirstThursdayOfYear(Number(yearInput) + 1);
  const days = Math.round((nextStartDate - startDate) / (24 * 60 * 60 * 1000));
  return days / 7;
};

const normalizeMonthWeeksConfiguration = (yearInput, monthsConfig = []) => {
  const year = Number(yearInput);
  if (!Number.isInteger(year) || year < 1900 || year > 2500) {
    throw new Error("El anio debe ser valido");
  }

  const byMonth = new Map();
  monthsConfig.forEach((item) => {
    const mes = Number(item?.mes);
    const cantidadSemanas = Number(item?.cantidadSemanas);

    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new Error("Cada configuracion debe tener mes entre 1 y 12");
    }
    if (![4, 5].includes(cantidadSemanas)) {
      throw new Error("La cantidad de semanas debe ser 4 o 5");
    }
    if (byMonth.has(mes)) {
      throw new Error(`El mes ${mes} esta duplicado en la configuracion`);
    }

    byMonth.set(mes, { mes, cantidadSemanas });
  });

  if (byMonth.size !== 12) {
    throw new Error("Debe configurar los 12 meses del anio");
  }

  return Array.from({ length: 12 }, (_, index) => byMonth.get(index + 1));
};

const validateAnnualCommercialWeeksConfiguration = (yearInput, monthsConfig = []) => {
  const meses = normalizeMonthWeeksConfiguration(yearInput, monthsConfig);
  const semanasConfiguradas = meses.reduce(
    (total, item) => total + item.cantidadSemanas,
    0,
  );
  const semanasRequeridas = getRequiredCommercialWeeksForYear(yearInput);
  const valida = semanasConfiguradas === semanasRequeridas;

  return {
    valida,
    anio: Number(yearInput),
    semanasConfiguradas,
    semanasRequeridas,
    meses,
    message: valida
      ? "Configuracion valida"
      : `La configuracion suma ${semanasConfiguradas} semanas, pero el calendario comercial ${yearInput} requiere ${semanasRequeridas}.`,
  };
};

const getCommercialWeekStart = (value) => {
  const date = parseLocalDateOnly(value);
  const daysSinceThursday = (date.getDay() - THURSDAY + 7) % 7;
  return addDays(date, -daysSinceThursday);
};

const getCommercialWeekKey = (value) => toDateOnly(getCommercialWeekStart(value));

const getCommercialWeeksByMonth = (yearInput, monthInput) => {
  const { year, month } = assertValidYearMonth(yearInput, monthInput);
  const monthIndex = month - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const offsetToThursday = (THURSDAY - firstDay.getDay() + 7) % 7;
  let startDate = addDays(firstDay, offsetToThursday);
  const weeks = [];

  while (startDate.getFullYear() === year && startDate.getMonth() === monthIndex) {
    const endDate = addDays(startDate, 6);
    weeks.push({
      startDate: toDateOnly(startDate),
      endDate: toDateOnly(endDate),
      label: buildWeekLabel(startDate, endDate),
      monthOwner: month,
      yearOwner: year,
    });
    startDate = addDays(startDate, 7);
  }

  return weeks;
};

const generateAnnualCommercialCalendar = ({
  year: yearInput,
  monthsConfig,
  startDate: startDateInput,
  validateTotal = true,
}) => {
  const year = Number(yearInput);
  const meses = normalizeMonthWeeksConfiguration(year, monthsConfig);

  if (validateTotal) {
    const validation = validateAnnualCommercialWeeksConfiguration(year, meses);
    if (!validation.valida) {
      throw new Error(validation.message);
    }
  }

  let startDate = startDateInput
    ? parseLocalDateOnly(startDateInput)
    : getFirstThursdayOfYear(year);
  const weeks = [];

  meses.forEach(({ mes, cantidadSemanas }) => {
    for (let index = 0; index < cantidadSemanas; index += 1) {
      const endDate = addDays(startDate, 6);
      weeks.push({
        startDate: toDateOnly(startDate),
        endDate: toDateOnly(endDate),
        label: buildWeekLabel(startDate, endDate),
        monthOwner: mes,
        yearOwner: year,
      });
      startDate = addDays(startDate, 7);
    }
  });

  return weeks;
};

const getCommercialWeeksByConfiguredMonth = ({ year, month, monthsConfig }) =>
  generateAnnualCommercialCalendar({ year, monthsConfig }).filter(
    (week) => Number(week.monthOwner) === Number(month),
  );

module.exports = {
  MONTH_NAMES,
  addDays,
  generateAnnualCommercialCalendar,
  getCommercialWeekKey,
  getCommercialWeekStart,
  getCommercialWeeksByMonth,
  getCommercialWeeksByConfiguredMonth,
  getFirstThursdayOfYear,
  getRequiredCommercialWeeksForYear,
  parseLocalDateOnly,
  toDateOnly,
  validateAnnualCommercialWeeksConfiguration,
};
