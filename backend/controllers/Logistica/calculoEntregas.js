exports.calcularEstadoEntrega = (fechaHoraLlamada) => {
  // 🚨 Si no hay fecha, no se puede calcular
  if (!fechaHoraLlamada) {
    return {
      fechaLlamada: null,
      fechaLimite: null,
      horasRestantes: null,
      minutosRestantes: null,
      estado: "Sin llamada",
    };
  }

  let fechaLlamada;

  if (fechaHoraLlamada instanceof Date) {
    fechaLlamada = fechaHoraLlamada;
  } else if (typeof fechaHoraLlamada === "string") {
    // Acepta "YYYY-MM-DD HH:mm" o "YYYY-MM-DDTHH:mm"
    const normalizada = fechaHoraLlamada.replace("T", " ");
    const [fecha, hora] = normalizada.split(" ");

    if (!fecha || !hora) {
      throw new Error(`Formato inválido: ${fechaHoraLlamada}`);
    }

    const [year, month, day] = fecha.split("-").map(Number);
    const [hour, minute] = hora.split(":").map(Number);

    fechaLlamada = new Date(year, month - 1, day, hour, minute);
  } else {
    throw new Error("Formato de FechaHoraLlamada no soportado");
  }

  const fechaLimite = new Date(fechaLlamada);
  fechaLimite.setHours(fechaLimite.getHours() + 72);

  const ahora = new Date();

  const diffMs = fechaLimite - ahora;
  const totalMinutos = Math.floor(diffMs / (1000 * 60));
  const minutosSeguros = Math.max(totalMinutos, 0);

  let estado;
  if (minutosSeguros <= 0) {
    estado = "Perdida";
  } else if (minutosSeguros <= 12 * 60) {
    estado = "Urgente";
  } else {
    estado = "Pendiente";
  }

  return {
    fechaLlamada,
    fechaLimite,
    horasRestantes: Math.floor(minutosSeguros / 60),
    minutosRestantes: minutosSeguros % 60,
    estado,
  };
};
