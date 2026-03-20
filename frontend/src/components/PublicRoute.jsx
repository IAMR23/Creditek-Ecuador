import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function PublicRoute({ isAuthenticated, children, rol }) {
  if (!isAuthenticated) return children;

  const token = localStorage.getItem("token");
  if (!token) return children;

  const decoded = jwtDecode(token);
  const permisos = decoded.usuario?.permisosAsignados || [];

  const puedeRepartir = permisos.includes("Repartir");
  const activeMode = localStorage.getItem("activeMode");

  if (rol === "admin" && puedeRepartir) {
    return <Navigate to="/seleccionar-modo" replace />;
  }

  if (rol === "Repartidor") {
    return <Navigate to="/logistica-panel" replace />;
  }


  // Default
  return <Navigate to="/dashboard" replace />;
}

export default PublicRoute;