exports.calcularEstadoEntrega = (fechaHoraLlamada) => {
  // Si viene como string (por seguridad), lo convertimos
  const fechaLlamada =
    fechaHoraLlamada instanceof Date
      ? fechaHoraLlamada
      : new Date(fechaHoraLlamada);

  const fechaLimite = new Date(fechaLlamada);
  fechaLimite.setHours(fechaLimite.getHours() + 72);

  const ahora = new Date();

  const diffMs = fechaLimite - ahora;

  const totalMinutos = Math.floor(diffMs / (1000 * 60));
  const horas = Math.floor(Math.max(totalMinutos, 0) / 60);
  const minutos = Math.max(totalMinutos, 0) % 60;

  let estado;

  if (totalMinutos <= 0) {
    estado = "Perdida";
  } else if (totalMinutos <= 12 * 60) {
    estado = "Urgente";
  } else {
    estado = "Pendiente";
  }

  return {
    fechaLlamada,
    fechaLimite,
    horasRestantes: horas,
    minutosRestantes: minutos,
    estado,
  };
};
