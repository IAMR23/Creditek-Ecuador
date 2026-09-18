const ESTADOS = ["Solicitado", "Construcción", "Pruebas", "Producción"];

const ESTADOS_KANBAN = ESTADOS;
const ESTADOS_TERMINALES = ["Producción"];
const PRIORIDADES = ["Baja", "Media", "Alta", "Urgente"];
const TIPOS = ["Error", "Mejora", "Nuevo desarrollo", "Soporte", "Reporte"];
const PROYECTOS = [
  "RVE",
  "ABS",
  "GHL",
  "Nómina",
  "Entregas",
  "Ventas",
  "Shortener",
  "Otro",
];

const TRANSICIONES = {
  Solicitado: ["Construcción"],
  Construcción: ["Pruebas"],
  Pruebas: ["Construcción", "Producción"],
  Producción: ["Pruebas", "Construcción"],
};

const normalizar = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const tienePermisoGestion = (user = {}) => {
  const permisos = Array.isArray(user.permisos) ? user.permisos.map(normalizar) : [];
  return permisos.includes("sistemas") || permisos.includes("administracion");
};

const puedeVerTicket = (user, ticket) =>
  Boolean(user?.id && ticket) &&
  (tienePermisoGestion(user) || Number(ticket.solicitanteId) === Number(user.id));

const validarTransicion = ({ estadoActual, estadoNuevo, tieneEvidencia }) => {
  if (!ESTADOS.includes(estadoNuevo)) {
    return "El estado solicitado no es válido";
  }

  if (estadoActual === estadoNuevo) return null;

  if (!(TRANSICIONES[estadoActual] || []).includes(estadoNuevo)) {
    return `No se permite pasar de ${estadoActual} a ${estadoNuevo}`;
  }

  if (estadoNuevo === "Producción" && !tieneEvidencia) {
    return "Para pasar a producción debe adjuntar evidencia o registrar un comentario de pruebas";
  }

  return null;
};

const esFechaISO = (value) => {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const formatearCodigoTicket = (numero) => {
  const consecutivo = Number(numero);
  if (!Number.isInteger(consecutivo) || consecutivo < 1) {
    throw new Error("Consecutivo de ticket no válido");
  }
  return `TI-${String(consecutivo).padStart(4, "0")}`;
};

const ticketEstaRetrasado = (ticket, fechaActual) =>
  Boolean(
    ticket?.fechaEstimada &&
      ticket.fechaEstimada < fechaActual &&
      !ESTADOS_TERMINALES.includes(ticket.estado),
  );

module.exports = {
  ESTADOS,
  ESTADOS_KANBAN,
  ESTADOS_TERMINALES,
  PRIORIDADES,
  TIPOS,
  PROYECTOS,
  TRANSICIONES,
  esFechaISO,
  formatearCodigoTicket,
  normalizar,
  puedeVerTicket,
  tienePermisoGestion,
  ticketEstaRetrasado,
  validarTransicion,
};
