/* eslint-disable react/prop-types */
import { Navigate } from "react-router-dom";
import { hasRouteAccess, normalizeRole } from "../config/routePermissions";

export default function ProtectedRoute({
  children,
  isAuthenticated,
  rol,
  permisos = [],
  allowedRoles = [],
  permission,
}) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const rolNormalizado = normalizeRole(rol);
  const allowedRolesNormalizados = allowedRoles.map(normalizeRole);
  const roleAllowed =
    allowedRolesNormalizados.length === 0 ||
    allowedRolesNormalizados.includes(rolNormalizado);

  if (!roleAllowed || !hasRouteAccess({ rol, permisos, permission })) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
