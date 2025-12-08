import { Navigate } from "react-router-dom";

export default function PublicRoute({ children, isAuthenticated, rol }) {
  if (isAuthenticated) {
    // Si ya está logueado, redirigir según el rol
    if (rol === "admin") return <Navigate to="/dashboard" replace />;
    if (rol === "Vendedor") return <Navigate to="/vendedor-panel" replace />;
    if (rol === "Repartidor") return <Navigate to="/logistica-panel" replace />;
  }

  // Si NO está autenticado → mostrar el contenido (login)
  return children;
}
