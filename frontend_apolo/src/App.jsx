import { useContext } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import Usuarios from "./pages/Admin/Usuarios.jsx";
import ControlAsistencia from "./pages/DesarrolloOrganizacional/ControlAsistencia.jsx";
import Dashboard from "./pages/DesarrolloOrganizacional/Dashboard.jsx";
import Entrevistas from "./pages/DesarrolloOrganizacional/Entrevistas.jsx";
import EvaluacionDesempeno from "./pages/DesarrolloOrganizacional/EvaluacionDesempeno.jsx";
import Postulaciones from "./pages/DesarrolloOrganizacional/Postulaciones.jsx";
import PruebaCapacitacion from "./pages/DesarrolloOrganizacional/PruebaCapacitacion.jsx";
import Agencias from "./pages/Admin/Agencias.jsx";
import Roles from "./pages/Admin/Roles.jsx";
import UsuariosAgencias from "./pages/Admin/UsuariosAgencias.jsx";
import Notificaciones from "./pages/Admin/Notificaciones.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import PublicRoute from "./components/PublicRoute.jsx";
import { AuthContext } from "./context/AuthContext.jsx";
import Pruebas from "./pages/Pruebas/Pruebas.jsx";
import AdminEvaluacion from "./pages/Pruebas/AdminEvaluacion.jsx";

function Evaluacion() {
  const auth = useContext(AuthContext);
  const role = String(auth?.user?.rol?.nombre || "").trim().toUpperCase();
  return role === "ADMIN" ? <AdminEvaluacion /> : <Pruebas />;
}

function HomeRedirect() {
  const auth = useContext(AuthContext);
  const role = String(auth?.user?.rol?.nombre || "").trim().toUpperCase();
  return <Navigate to={role === "USUARIO" ? "/evaluacion" : "/usuarios"} replace />;
}

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
              <main className="flex-1 md:ml-64">
                <div className="p-6 lg:p-10">
                  <Routes>
                    <Route path="/" element={<HomeRedirect />} />
                    <Route
                      path="/evaluacion"
                      element={
                        <ProtectedRoute allowedRoles={["USUARIO", "ADMIN"]}>
                          <Evaluacion />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/usuarios" element={<Usuarios />} />
                    <Route path="/agencias" element={<Agencias />} />
                    <Route path="/roles" element={<Roles />} />
                    <Route path="/usuarios-agencias" element={<UsuariosAgencias />} />
                    <Route path="/notificaciones" element={<Notificaciones />} />
                    <Route path="/control-asistencia" element={<ControlAsistencia />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route
                      path="/postulaciones"
                      element={<Postulaciones key="postulaciones" modo="postulacion" />}
                    />
                    <Route
                      path="/entrevistas"
                      element={<Entrevistas />}
                    />
                    <Route
                      path="/seleccionados"
                      element={<Entrevistas key="seleccionados" modo="seleccionado" />}
                    />
                    <Route
                      path="/capacitacion"
                      element={<Entrevistas key="capacitacion" modo="capacitacion" />}
                    />
                    <Route
                      path="/seleccionados/:id/evaluacion-desempeno"
                      element={<EvaluacionDesempeno />}
                    />
                    <Route
                      path="/capacitacion/:id/evaluacion-desempeno"
                      element={<EvaluacionDesempeno />}
                    />
                    <Route
                      path="/capacitacion/:id/prueba-capacitacion"
                      element={<PruebaCapacitacion />}
                    />
                    <Route
                      path="/descartados"
                      element={<Postulaciones key="descartados" modo="descartado" />}
                    />
                    <Route path="*" element={<HomeRedirect />} />
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
