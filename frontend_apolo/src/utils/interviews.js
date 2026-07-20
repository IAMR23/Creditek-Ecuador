export const INTERVIEW_STATUS = {
  PENDIENTE: {
    label: "Pendiente de agendar",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    dotClassName: "bg-orange-500",
  },
  AGENDADA: {
    label: "Agendada",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    dotClassName: "bg-blue-500",
  },
  CONFIRMADA: {
    label: "Confirmada",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  REPROGRAMADA: {
    label: "Reprogramada",
    className: "border-violet-200 bg-violet-50 text-violet-700",
    dotClassName: "bg-violet-500",
  },
  REALIZADA: {
    label: "Realizada",
    className: "border-teal-200 bg-teal-50 text-teal-800",
    dotClassName: "bg-teal-600",
  },
  NO_ASISTIO: {
    label: "No asistió",
    className: "border-red-200 bg-red-50 text-red-700",
    dotClassName: "bg-red-500",
  },
  CANCELADA: {
    label: "Cancelada",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    dotClassName: "bg-slate-500",
  },
};

export const getPersonalData = (postulacion) =>
  postulacion?.formulario?.datos_personales || {};

export const getCandidateName = (postulacion) => {
  const datos = getPersonalData(postulacion);
  return datos.nombreCompleto || postulacion?.nombre || `Postulante #${postulacion?.id || ""}`;
};

export const getCandidateIdentification = (postulacion) => {
  const datos = getPersonalData(postulacion);
  return datos.cedula || postulacion?.cedula || "-";
};

export const getCandidatePhone = (postulacion) => {
  const datos = getPersonalData(postulacion);
  return datos.telefono || postulacion?.telefono || "-";
};

export const getCandidateEmail = (postulacion) => {
  const datos = getPersonalData(postulacion);
  return datos.email || datos.correo || datos.correoElectronico || "";
};

export const getCandidateCity = (postulacion) => {
  const datos = getPersonalData(postulacion);
  if (datos.ciudadNacimiento === "Otra") return datos.otraCiudadNacimiento || "Otra";
  return datos.ciudadNacimiento || "-";
};

export const getInitials = (name = "") => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "--";
  return `${words[0]?.[0] || ""}${words[1]?.[0] || ""}`.toUpperCase();
};

export const getInterviewStatus = (postulacion) => {
  if (
    postulacion?.fechaEntrevista &&
    (!postulacion?.estadoEntrevista || postulacion.estadoEntrevista === "PENDIENTE")
  ) {
    return "AGENDADA";
  }
  return postulacion?.estadoEntrevista || "PENDIENTE";
};

const formatParts = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

export const toEcuadorDateInput = (value) => {
  const parts = formatParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
};

export const toEcuadorTimeInput = (value) => {
  const parts = formatParts(value);
  return parts ? `${parts.hour}:${parts.minute}` : "";
};

export const combineEcuadorDateTime = (date, time) =>
  new Date(`${date}T${time}:00-05:00`).toISOString();

export const getTodayEcuador = () =>
  new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const formatInterviewDate = (value) => {
  if (!value) return "Sin agendar";
  return new Date(value).toLocaleDateString("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatInterviewTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-EC", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const getInterviewDateRange = (period) => {
  const today = getTodayEcuador();
  if (period === "hoy") return { desde: today, hasta: today };
  if (period === "7") return { desde: today, hasta: addDays(today, 6) };
  if (period === "30") return { desde: today, hasta: addDays(today, 29) };
  return { desde: "", hasta: "" };
};
