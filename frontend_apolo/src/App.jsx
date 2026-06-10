import { Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import Usuarios from "./pages/Admin/Usuarios.jsx";
import ControlAsistencia from "./pages/DesarrolloOrganizacional/ControlAsistencia.jsx";
import Postulaciones from "./pages/DesarrolloOrganizacional/Postulaciones.jsx";
import Agencias from "./pages/Admin/Agencias.jsx";
import Roles from "./pages/Admin/Roles.jsx";
import UsuariosAgencias from "./pages/Admin/UsuariosAgencias.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PublicRoute from "./components/PublicRoute.jsx";

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="min-h-screen flex flex-col md:flex-row">
              <Sidebar />
              <main className="flex-1">
                <div className="p-6 lg:p-10">
                  <Routes>
                    <Route path="/" element={<Navigate to="/usuarios" replace />} />
                    <Route path="/usuarios" element={<Usuarios />} />
                    <Route path="/agencias" element={<Agencias />} />
                    <Route path="/roles" element={<Roles />} />
                    <Route path="/usuarios-agencias" element={<UsuariosAgencias />} />
                    <Route path="/control-asistencia" element={<ControlAsistencia />} />
                    <Route path="/postulaciones" element={<Postulaciones />} />
                    <Route path="*" element={<Navigate to="/usuarios" replace />} />
                  </Routes>
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
