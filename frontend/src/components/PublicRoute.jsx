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

  // 1. Si ya eligió modo, respetarlo
  if (activeMode === "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  if (activeMode === "REPARTO") {
    return <Navigate to="/logistica-panel" replace />;
  }

  if (activeMode === "VENTAS") {
    return <Navigate to="/vendedor-panel" replace />;
  }


  if (rol === "admin" && puedeRepartir) {
    return <Navigate to="/seleccionar-modo" replace />;
  }

  // 3. Si solo es admin
  if (rol === "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  // 4. Si es repartidor
  if (rol === "repartidor") {
    return <Navigate to="/logistica-panel" replace />;
  }

  // 5. Default: ventas
  return <Navigate to="/vendedor-panel" replace />;
}

export default PublicRoute;