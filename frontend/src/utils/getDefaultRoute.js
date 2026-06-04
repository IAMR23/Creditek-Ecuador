import {
  ROUTE_PERMISSIONS,
  ROUTE_REDIRECT_ORDER,
  hasRouteAccess,
  normalizePermissions,
  normalizeRole,
} from "../config/routePermissions";

export function getDefaultRoute({ rol, permisos = [], activeMode }) {
  const rolNormalizado = normalizeRole(rol);
  const permisosNormalizados = normalizePermissions(permisos);
  const puedeRepartir = permisosNormalizados.includes("Repartir");
  const puedeVender = permisosNormalizados.includes("Ventas");

  if (
    activeMode === "ADMIN" &&
    hasRouteAccess({ rol, permisos: permisosNormalizados, path: "/dashboard" })
  ) {
    return "/dashboard";
  }

  if (
    activeMode === "REPARTO" &&
    hasRouteAccess({ rol, permisos: permisosNormalizados, path: "/logistica-panel" })
  ) {
    return "/logistica-panel";
  }

  if (
    activeMode === "VENTAS" &&
    hasRouteAccess({ rol, permisos: permisosNormalizados, path: "/vendedor-panel" })
  ) {
    return "/vendedor-panel";
  }

  if (
    rolNormalizado === "admin" &&
    puedeRepartir &&
    hasRouteAccess({ rol, permisos: permisosNormalizados, path: "/dashboard" })
  ) {
    return "/seleccionar-modo";
  }

  const primeraRutaPermitida = ROUTE_REDIRECT_ORDER.find((path) =>
    hasRouteAccess({
      rol,
      permisos: permisosNormalizados,
      path,
      permission: ROUTE_PERMISSIONS[path],
    }),
  );

  if (primeraRutaPermitida) return primeraRutaPermitida;

  if (rolNormalizado === "admin") {
    return "/asignar-permisos-usuario-agencia";
  }

  if (rolNormalizado === "repartidor") {
    return "/logistica-panel";
  }

  if (rolNormalizado === "vendedor" || puedeVender) {
    return "/vendedor-panel";
  }

  return "/unauthorized";
}
