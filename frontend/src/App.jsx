import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import VendedorPanel from "./pages/Vendedores/VendedoresPanel";
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
import AdminUsuariosRoles from "./pages/Admin/Rol";
import Dispositivos from "./pages/Admin/Dispositivos";
import MarcasAdmin from "./pages/Admin/MarcasAdmin";
import ModelosAdmin from "./pages/Admin/ModelosAdmin";
import AdminDispositivoMarca from "./pages/Admin/AdminDispositivoMarca";
import AdminCostoHistorico from "./pages/Admin/AdminCostoHistorico";
import FormasPago from "./pages/Admin/FormasPago";
import OrigenAdmin from "./pages/Admin/OrigenAdmin";
import AdminObsequios from "./pages/Admin/AdminObsequios";

import MetasComerciales from "./pages/Admin/MetasComerciales";

/* VENDEDORES */
import FormularioClienteVenta from "./pages/Vendedores/Ventas/FormularioClienteVenta";
import CrearVenta from "./pages/Vendedores/Ventas/CrearVenta";
import DetalleVenta from "./pages/Vendedores/Ventas/DetalleVenta";
import VentaObsequioPage from "./pages/Vendedores/Ventas/VentaObsequio";
import VentaFoto from "./pages/Vendedores/Ventas/VentaFoto";

/* ENTREGAS */
import FormularioClienteEntrega from "./pages/Vendedores/Entregas/FormularioClienteEntrega";
import CrearEntrega from "./pages/Vendedores/Entregas/CrearEntrega";
import EntregaObsequioPage from "./pages/Vendedores/Entregas/EntregaObsequio";
import EntregaFoto from "./pages/Vendedores/Entregas/EntregaFoto";
import DetalleEntregaVendedores from "./pages/Vendedores/Entregas/DetalleEntregaVendedores";
import EstadoEntrega from "./pages/Admin/EstadoEntrega";
import MisVentas from "./pages/Vendedores/Ventas/MisVentas";
import MisEntregas from "./pages/Vendedores/Entregas/MisEntregas";

import ReporteEntregas from "./pages/Admin/ReporteEntregas";
import LogisticaPanel from "./pages/Logistica/LogisticaPanel";
import MetasComercialesGraficas from "./pages/Admin/MetasComercialesGraficas";
import VentasCompletas from "./pages/Admin/VentasCompletas";
import FotoFechaHoraEntrega from "./pages/Vendedores/Entregas/FotoFechaHoraEntrega";
import EntregasPendientes from "./pages/Logistica/EntregasPendientes";
import EntregasTransito from "./pages/Logistica/EntregasTransito";
import EntregasAuditoria from "./pages/Auditoria/EntregasAuditoria";
import EntregaAuditoria from "./pages/Auditoria/EntregaAuditoria";
import VentasAuditoria from "./pages/Auditoria/VentasAuditoria";
import VentaAuditoria from "./pages/Auditoria/VentaAuditoria";
import MarketingVentasAgencia from "./pages/Marketing/MarketingVentasAgencia";
import Goleadores from "./pages/Marketing/Goleadores";
import CrearVentaCompleta from "./pages/Vendedores/CrearVentaCompleta";
import EditarVentaCompleta from "./pages/Vendedores/EditarVentaCompleta";
function App() {
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    rol: null,
  });

  // 🔹 Validar token y rol al cargar la app
  const validateToken = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAuth({ isAuthenticated: false, rol: null });
      return;
    }

    try {
      const decodedToken = jwtDecode(token);

      // 🔥 Validar expiración del token
      const now = Date.now() / 1000;
      if (decodedToken.exp < now) {
        console.warn("Token expirado");
        localStorage.removeItem("token");
        setAuth({ isAuthenticated: false, rol: null });
        return;
      }

      setAuth({
        isAuthenticated: true,
        rol: decodedToken.usuario?.rol?.nombre || null, // admin / vendedor / etc.
        usuario: decodedToken.usuario,
      });
    } catch (error) {
      console.error("Token inválido", error);
      localStorage.removeItem("token");
      setAuth({ isAuthenticated: false, rol: null });
    }
  };

  useEffect(() => {
    validateToken();

    // 🔹 Escuchar cambios entre pestañas
    window.addEventListener("storage", validateToken);

    return () => {
      window.removeEventListener("storage", validateToken);
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        <Navbar auth={auth} setAuth={setAuth} />

        <main className="flex-grow w-full">
          <Routes>
            {/* LOGIN */}
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

            {/* ADMIN */}
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
              <Route path="ventas-completas" element={<VentasCompletas />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="agencias" element={<Agencias />} />
              <Route path="usuarios-agencias" element={<UsuariosAgencias />} />
              <Route path="ventas" element={<VentasPage />} />
              <Route path="entregas" element={<Entregas />} />
              <Route
                path="entrega-logistica/:id"
                element={<DetalleEntrega />}
              />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="rol" element={<AdminUsuariosRoles />} />
              <Route path="dispositivos" element={<Dispositivos />} />
              <Route path="marcas" element={<MarcasAdmin />} />
              <Route path="modelos" element={<ModelosAdmin />} />
              <Route
                path="dispositivosMarcas"
                element={<AdminDispositivoMarca />}
              />
              <Route path="costoHistorico" element={<AdminCostoHistorico />} />
              <Route path="formas-pago" element={<FormasPago />} />
              <Route path="origen" element={<OrigenAdmin />} />
              <Route path="obsequios" element={<AdminObsequios />} />
              <Route path="metas-comerciales" element={<MetasComerciales />} />
              <Route
                path="metas-comerciales-graficas"
                element={<MetasComercialesGraficas />}
              />
              <Route
                path="entregas-pendientes"
                element={<EntregasPendientes />}
              />
              <Route path="entregas-transito" element={<EntregasTransito />} />
              <Route path="estado-entrega" element={<EstadoEntrega />} />
              <Route path="reporte-entregas" element={<ReporteEntregas />} />

              {/* MARKETING */}
              <Route
                path="copa-creditek"
                element={<MarketingVentasAgencia />}
              />
              <Route path="goleadores" element={<Goleadores />} />

              {/* AUDITORIAS */}
              <Route
                path="entregas-auditoria"
                element={<EntregasAuditoria />}
              />
              <Route
                path="entregas-auditoria/:id"
                element={<EntregaAuditoria />}
              />
              <Route path="ventas-auditoria" element={<VentasAuditoria />} />
             {/*  <Route path="ventas-auditoria/:id" element={<VentaAuditoria />} /> */}
              <Route
                path="/ventas-auditoria/:id"
                element={<EditarVentaCompleta />}
              />
            </Route>

            {/* REPARTIDORES */}
            <Route path="/logistica-panel" element={<LogisticaPanel />} />
            <Route path="/vendedor-panel" element={<VendedorPanel />} />

            <Route path="/mis-ventas" element={<MisVentas />} />
            <Route
              path="/registrar-clientes-venta"
              element={<FormularioClienteVenta />}
            />
            <Route path="/crear-venta" element={<CrearVenta />} />
            <Route path="/ventas/:id/detalles" element={<DetalleVenta />} />
            <Route
              path="/ventas/:id/obsequios"
              element={<VentaObsequioPage />}
            />
            <Route
              path="/ventas/:id/validacion"
              element={<VentaFoto Unitario aFoto />}
            />

            {/* ENTREGAS */}

            <Route
              path="/registrar-clientes-entrega"
              element={<FormularioClienteEntrega />}
            />
            <Route path="/crear-entrega" element={<CrearEntrega />} />
            <Route
              path="/entregas/:id/detalles"
              element={<DetalleEntregaVendedores />}
            />
            <Route
              path="/entregas/:id/obsequios"
              element={<EntregaObsequioPage />}
            />
            <Route
              path="/entregas/:id/pre-aprobacion"
              element={<EntregaFoto />}
            />
            <Route
              path="/entregas/:id/fecha-llamada"
              element={<FotoFechaHoraEntrega />}
            />
            <Route path="/mis-entregas" element={<MisEntregas />} />

            {/* EXPERIMENTAL */}
            <Route path="/ventacompleta" element={<CrearVentaCompleta />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
