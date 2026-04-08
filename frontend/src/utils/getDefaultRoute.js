// utils/getDefaultRoute.js
export function getDefaultRoute({ rol, permisos = [], activeMode }) {
  const rolNormalizado = rol?.trim().toLowerCase();
  const puedeRepartir = permisos.includes("Repartir");

  // Si ya eligió modo, se respeta
  if (activeMode === "ADMIN") return "/dashboard";
  if (activeMode === "REPARTO") return "/logistica-panel";
  if (activeMode === "VENTAS") return "/vendedor-panel";

  // Si es admin y también puede repartir
  if (rolNormalizado === "admin" && puedeRepartir) {
    return "/seleccionar-modo";
  }

  // Admin puro
  if (rolNormalizado === "admin") {
    return "/dashboard";
  }

  // Repartidor
  if (rolNormalizado === "repartidor") {
    return "/logistica-panel";
  }

  // Default: vendedor
  return "/vendedor-panel";
}