import { Navigate, useLocation } from "react-router-dom";
export default function ProtectedRoute({ children, isAuthenticated , rol  , allowedRoles = []}) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }


  if (!allowedRoles.includes(rol)) {
    return <Navigate to="/unauthorized" replace />;
  }



  return children;
}
