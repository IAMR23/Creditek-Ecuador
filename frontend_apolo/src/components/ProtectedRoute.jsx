import { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const normalizeRole = (value) => String(value || "").trim().toUpperCase();

export default function ProtectedRoute({ children, allowedRoles }) {
  const auth = useContext(AuthContext);
  const location = useLocation();
  if (auth?.initializing) return null;
  if (!auth?.isAuthenticated) return <Navigate to="/login" replace />;

  const role = normalizeRole(auth?.user?.rol?.nombre);
  if (role === "USUARIO" && location.pathname !== "/evaluacion") {
    return <Navigate to="/evaluacion" replace />;
  }

  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.map(normalizeRole).includes(role)
  ) {
    return <Navigate to={role === "USUARIO" ? "/evaluacion" : "/usuarios"} replace />;
  }
  return children;
}
