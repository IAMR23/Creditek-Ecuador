export const nombreCortoPersona = (nombreCompleto = "") => {
  const partes = String(nombreCompleto)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (partes.length <= 2) return partes.join(" ");
  return [partes[0], partes[2] || partes[1]].filter(Boolean).join(" ");
};

export const nombreCortoUsuario = (usuario = {}) =>
  nombreCortoPersona(usuario.nombre || usuario.usuario?.nombre || "");
