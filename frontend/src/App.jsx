import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AdminPanel from "./pages/AdminPanel";
import LoginForm from "./components/LoginForm";
import GestionarVentas from "./pages/Vendedores/GestionarVentas";
import FormularioDinamico from "./pages/Vendedores/FormularioDinamico";
import VendedorPanel from "./pages/Vendedores/VendedoresPanel";
import FormularioEntrega from "./pages/Vendedores/FormularioEntrega";
import FormularioCliente from "./pages/Vendedores/FormularioCliente";
import Usuarios from "./pages/Admin/Usuarios";
import SidebarLayout from "./components/SidebarLayout";
import Agencias from "./pages/Admin/Agencias";
import UsuariosAgencias from "./pages/Admin/UsuariosAgencias";
import VentasPage from "./pages/Contabilidad/VentasPage";
import Entregas from "./pages/Logistica/Entregas";
import DetalleEntrega from "./pages/Logistica/DetalleEntrega";
import Dashboard from "./pages/Admin/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";

function App() {
  // 🔹 Estado global de autenticación
  const [auth, setAuth] = useState({ isAuthenticated: false, rol: null });

  useEffect(() => {
    // 🔹 Verificar si hay un token guardado
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        console.log(decodedToken);
        setAuth({ isAuthenticated: true, rol: decodedToken.rol });
      } catch (error) {
        console.error("Error al decodificar el token", error);
        localStorage.removeItem("token"); // Elimina el token si es inválido
        setAuth({ isAuthenticated: false, rol: null });
      }
    }
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <Navbar auth={auth} setAuth={setAuth} />

        <main className="flex-grow w-full">
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute
                  isAuthenticated={auth.isAuthenticated}
                  rol={auth.rol}
                >
                  <LoginForm setAuth={setAuth} />
                </PublicRoute>
              }
            />

            {/* RUTAS PROTEGIDAS */}
            <Route
              path="/"
              element={
                <ProtectedRoute
                  isAuthenticated={auth.isAuthenticated}
                  rol={auth.rol}
                  allowedRoles={["admin"]}
                >
                  <SidebarLayout />
                </ProtectedRoute>
              }
            >
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="agencias" element={<Agencias />} />
              <Route path="usuarios-agencias" element={<UsuariosAgencias />} />
              <Route path="ventas" element={<VentasPage />} />
              <Route path="entregas" element={<Entregas />} />
              <Route path="entregas/:id" element={<DetalleEntrega />} />
              <Route path="dashboard" element={<Dashboard />} />
            </Route>

            {/* PANEL DE VENDEDORES */}
            <Route path="/vendedor-panel" element={<VendedorPanel />} />
            <Route path="/registrar-ventas" element={<FormularioDinamico />} />
            <Route path="/registrar-clientes" element={<FormularioCliente />} />
            <Route path="/registrar-entregas" element={<FormularioEntrega />} />

            {/* ADMIN */}
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}
export default App;
