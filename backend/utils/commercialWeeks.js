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

module.exports = {
  MONTH_NAMES,
  addDays,
  getCommercialWeekKey,
  getCommercialWeekStart,
  getCommercialWeeksByMonth,
  parseLocalDateOnly,
  toDateOnly,
};
