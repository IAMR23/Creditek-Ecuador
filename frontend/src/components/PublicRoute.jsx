import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { getDefaultRoute } from "../utils/getDefaultRoute";

function PublicRoute({ isAuthenticated, children, rol }) {
  if (!isAuthenticated) return children;

  const token = localStorage.getItem("token");
  if (!token) return children;

  const decoded = jwtDecode(token);
  const permisos = decoded.usuario?.permisosAsignados || [];
  const activeMode = localStorage.getItem("activeMode");

  const redirectTo = getDefaultRoute({
    rol,
    permisos,
    activeMode,
  });

  return <Navigate to={redirectTo} replace />;
}

export default PublicRoute;