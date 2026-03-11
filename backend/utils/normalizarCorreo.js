export function normalizarCorreo(correo) {
  if (!correo) return correo;

  const correosBloqueados = [
    "sn@gmail.com",
    "creditek.ventas9@gmail.com",
    "sin@gmail.com",
    "facturacion@gmail.com"
  ];

  const correoLimpio = correo.trim().toLowerCase();

  if (correosBloqueados.includes(correoLimpio)) {
    return "facturacion.empresarial.2026@gmail.com";
  }

  return correoLimpio;
}