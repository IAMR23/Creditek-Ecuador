import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function PublicRoute({ children }) {
  const auth = useContext(AuthContext);
  if (auth?.initializing) return null;
  if (auth?.isAuthenticated) return <Navigate to="/usuarios" replace />;
  return children;
}
