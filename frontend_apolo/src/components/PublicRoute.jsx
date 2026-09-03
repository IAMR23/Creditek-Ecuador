import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function PublicRoute({ children }) {
  const auth = useContext(AuthContext);
  if (auth?.initializing) return null;
  if (auth?.isAuthenticated) {
    const role = String(auth?.user?.rol?.nombre || "").trim().toUpperCase();
    return <Navigate to={role === "USUARIO" ? "/evaluacion" : "/usuarios"} replace />;
  }
  return children;
}
