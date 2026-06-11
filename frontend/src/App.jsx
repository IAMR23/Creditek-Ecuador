import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import VentasCompletas from "./pages/Admin/VentasCompletas";
import FotoFechaHoraEntrega from "./pages/Vendedores/Entregas/FotoFechaHoraEntrega";
import EntregasPendientes from "./pages/Logistica/EntregasPendientes";
import EntregasAuditoria from "./pages/Auditoria/EntregasAuditoria";
import EntregaAuditoria from "./pages/Auditoria/EntregaAuditoria";
import VentasAuditoria from "./pages/Auditoria/VentasAuditoria";
import MarketingVentasAgencia from "./pages/Marketing/MarketingVentasAgencia";
import Goleadores from "./pages/Marketing/Goleadores";
import CrearVentaCompleta from "./pages/Vendedores/CrearVentaCompleta";
import EditarVentaCompletaAuditoria from "./pages/Vendedores/EditarVentaCompletaAuditoria";
import Postulaciones from "./pages/DesarrolloOrganizacional/Postulaciones";
import EditarVentaCompletaVendedores from "./pages/Vendedores/EditarVentaCompletaVendedores";
import CrearEntregaCompleta from "./pages/Vendedores/CrearEntregaCompleta";
import EditarEntregaCompleta from "./pages/Vendedores/EditarEntregaCompleta";
import Permisos from "./pages/Admin/Permisos";
import AsignarPermisos from "./pages/Admin/AsignarPermisos";
import AsignarPermisosUsuarioAgencia from "./pages/Admin/AsignarPermisosUsuarioAgencia";
import UsuariosConPermisos from "./pages/Admin/UsuariosConPermisos";
import SeleccionarModo from "./pages/SeleccionarModo";
import MisEntregasPendientes from "./pages/Logistica/MisEntregasPendientes";
import MisEntregasRealizadas from "./pages/Logistica/MisEntregasRealizadas";
import CrearTraslado from "./pages/Vendedores/CrearTraslado";
import TrasladosList from "./pages/Vendedores/TrasladosList";
import Gestion from "./pages/Vendedores/Gestion";
import MisGestiones from "./pages/Vendedores/MisGestiones";
import MisGestionesComerciales from "./pages/Vendedores/MisGestionesComerciales";
import RevisionGestiones from "./pages/Admin/RevisionGestiones";
import RevisionGestionesComercial from "./pages/Admin/RevisionGestionesComercial";
import EditarGestion from "./pages/Vendedores/EditarGestion";
import Caja from "./pages/Vendedores/Caja";
import EntregasRepartidoresTabla from "./pages/Logistica/EntregasRepartidoresTabla";
import BDDVentas from "./pages/Admin/BDDVentas";
import Bonos from "./pages/Admin/Bonos";
import RevisarCaja from "./pages/Vendedores/RevisarCaja";
import TasksPage from "./pages/Tareas/TaskPage";
import { initSWWithToken, registerSW } from "./utils/serviceWorker";

import { TaskNotificationProvider } from "./context/TaskNotificationContext";
import { socket } from "./socket/socket";
import CierresCajaTabla from "./pages/Vendedores/CierresCajaTabla";
import CrearGestionComercial from "./pages/Vendedores/CrearGestionComercial";
import Powerbi from "./pages/Admin/PowerBi";
import { ROUTE_PERMISSIONS } from "./config/routePermissions";
import { getDefaultRoute } from "./utils/getDefaultRoute";
function App() {
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    rol: null,
    permisos: null,
    usuario: null,
  });

  const [authLoading, setAuthLoading] = useState(true);

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }


  const validateToken = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    setAuth({
      isAuthenticated: false,
      rol: null,
      permisos: null,
      usuario: null,
    });
    setAuthLoading(false);
    return;
  }

  try {
    const decodedToken = jwtDecode(token);
    const now = Date.now() / 1000;

    if (decodedToken.exp < now) {
      localStorage.removeItem("token");
      localStorage.removeItem("activeMode");

      setAuth({
        isAuthenticated: false,
        rol: null,
        permisos: null,
        usuario: null,
      });
      setAuthLoading(false);
      return;
    }

    setAuth({
      isAuthenticated: true,
      rol: decodedToken.usuario?.rol?.nombre?.toLowerCase() || null,
      permisos: decodedToken.usuario?.permisosAsignados || [],
      usuario: decodedToken.usuario || null,
    });
  } catch (error) {
    console.error("Token inválido", error);

    localStorage.removeItem("token");
    localStorage.removeItem("activeMode");

    setAuth({
      isAuthenticated: false,
      rol: null,
      permisos: null,
      usuario: null,
    });
  } finally {
    setAuthLoading(false);
  }
};

useEffect(() => {
  const token = localStorage.getItem("token");

  if (auth.isAuthenticated && token) {
    socket.auth = { token };

    if (!socket.connected) {
      socket.connect();
    }
  } else {
    socket.disconnect();
  }
}, [auth.isAuthenticated]);


  useEffect(() => {
    validateToken();

    window.addEventListener("storage", validateToken);

    return () => {
      window.removeEventListener("storage", validateToken);
    };
  }, []);

  useEffect(() => {
    registerSW().then(() => {
      initSWWithToken();
    });
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Validando sesión...</p>
      </div>
    );
  }

  const protect = (element, path, allowedRoles = []) => (
    <ProtectedRoute
      isAuthenticated={auth.isAuthenticated}
      rol={auth.rol}
      permisos={auth.permisos || []}
      allowedRoles={allowedRoles}
      permission={ROUTE_PERMISSIONS[path]}
    >
      {element}
    </ProtectedRoute>
  );
  const defaultRoute = getDefaultRoute({
    rol: auth.rol,
    permisos: auth.permisos || [],
    activeMode: localStorage.getItem("activeMode"),
  });

  return (
    <TaskNotificationProvider>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen">
          <Navbar auth={auth} setAuth={setAuth} />

          <main className="flex-grow w-full">
            <Routes>
              <Route
                path="login"
                element={
                  <PublicRoute
                    isAuthenticated={auth.isAuthenticated}
                    rol={auth.rol}
                  >
                    <LoginForm setAuth={setAuth} />
                  </PublicRoute>
                }
              />

              <Route
                path="/"
                element={
                  <ProtectedRoute
                    isAuthenticated={auth.isAuthenticated}
                    rol={auth.rol}
                    permisos={auth.permisos || []}
                  >
                    <SidebarLayout auth={auth} />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to={defaultRoute} replace />} />
                <Route path="dashboard" element={protect(<Dashboard />, "/dashboard")} />
                <Route path="powerbi" element={protect(<Powerbi />, "/powerbi")} />
                <Route path="ventas-completas" element={protect(<VentasCompletas />, "/ventas-completas")} />
                <Route path="usuarios" element={protect(<Usuarios />, "/usuarios")} />
                <Route path="agencias" element={protect(<Agencias />, "/agencias")} />
                <Route
                  path="usuarios-agencias"
                  element={protect(<UsuariosAgencias />, "/usuarios-agencias")}
                />
                <Route path="entregas" element={protect(<Entregas />)} />
                <Route
                  path="revision-gestiones"
                  element={protect(<RevisionGestiones />, "/revision-gestiones")}
                />
                             <Route
                  path="revision-gestiones-comercial"
                  element={protect(<RevisionGestionesComercial />, "/revision-gestiones-comercial")}
                />
                <Route path="bdd-ventas" element={protect(<BDDVentas />, "/bdd-ventas")} />
                <Route path="bonos" element={protect(<Bonos />, "/bonos")} />
                <Route
                  path="entrega-logistica/:id"
                  element={protect(<DetalleEntrega />, "/entrega-logistica")}
                />
   {/*              <Route
                  path="entregas-repartidores"
                  element={<EntregasRepartidores />}
                /> */}
                <Route
                  path="entregas-repartidores-tabla"
                  element={protect(<EntregasRepartidoresTabla />, "/entregas-repartidores-tabla")}
                />
                <Route path="rol" element={protect(<AdminUsuariosRoles />, "/rol")} />
                <Route path="dispositivos" element={protect(<Dispositivos />, "/dispositivos")} />
                <Route path="marcas" element={protect(<MarcasAdmin />, "/marcas")} />
                <Route path="modelos" element={protect(<ModelosAdmin />, "/modelos")} />
                <Route
                  path="dispositivosMarcas"
                  element={protect(<AdminDispositivoMarca />, "/dispositivosMarcas")}
                />
                <Route
                  path="costoHistorico"
                  element={protect(<AdminCostoHistorico />, "/costoHistorico")}
                />

                <Route path="formas-pago" element={protect(<FormasPago />, "/formas-pago")} />
                <Route path="origen" element={protect(<OrigenAdmin />, "/origen")} />
                <Route path="obsequios" element={protect(<AdminObsequios />, "/obsequios")} />
                <Route
                  path="metas-comerciales"
                  element={protect(<MetasComerciales />, "/metas-comerciales")}
                />
                <Route
                  path="entregas-pendientes"
                  element={protect(<EntregasPendientes />, "/entregas-pendientes")}
                />
                <Route path="estado-entrega" element={protect(<EstadoEntrega />, "/estado-entrega")} />
                <Route path="reporte-entregas" element={protect(<ReporteEntregas />, "/reporte-entregas")} />
                <Route
                  path="copa-creditek"
                  element={protect(<MarketingVentasAgencia />, "/copa-creditek")}
                />
                <Route path="goleadores" element={protect(<Goleadores />, "/goleadores")} />
                <Route
                  path="entregas-auditoria"
                  element={protect(<EntregasAuditoria />, "/entregas-auditoria")}
                />
                <Route
                  path="entregas-auditoria/:id"
                  element={protect(<EntregaAuditoria />, "/entregas-auditoria")}
                />
                <Route path="ventas-auditoria" element={protect(<VentasAuditoria />, "/ventas-auditoria")} />
                <Route
                  path="ventas-auditoria/:id"
                  element={protect(<EditarVentaCompletaAuditoria />, "/ventas-auditoria")}
                />
                <Route path="postulaciones" element={protect(<Postulaciones />, "/postulaciones")} />
                <Route path="permisos" element={protect(<Permisos />, "/permisos")} />
                <Route path="asignar-permisos" element={protect(<AsignarPermisos />, "/asignar-permisos")} />
                <Route
                  path="asignar-permisos-usuario-agencia"
                  element={protect(<AsignarPermisosUsuarioAgencia />, "/asignar-permisos-usuario-agencia")}
                />
                <Route
                  path="usuarios-permisos"
                  element={protect(<UsuariosConPermisos />, "/usuarios-permisos")}
                />
                <Route path="revisar-cajas" element={protect(<RevisarCaja />, "/revisar-cajas")} />
                <Route path="revisar-cajas2" element={protect(<CierresCajaTabla />, "/revisar-cajas2")} />
                <Route path="tasks" element={protect(<TasksPage />, "/tasks")} />
              </Route>

              <Route
                path="recuperar-permisos"
                element={
                  <ProtectedRoute
                    isAuthenticated={auth.isAuthenticated}
                    rol={auth.rol}
                    permisos={auth.permisos || []}
                    permission={ROUTE_PERMISSIONS["/recuperar-permisos"]}
                  >
                    <AsignarPermisosUsuarioAgencia />
                  </ProtectedRoute>
                }
              />
              <Route
                path="recuperar-permisos/catalogo"
                element={
                  <ProtectedRoute
                    isAuthenticated={auth.isAuthenticated}
                    rol={auth.rol}
                    permisos={auth.permisos || []}
                    permission={ROUTE_PERMISSIONS["/recuperar-permisos"]}
                  >
                    <Permisos />
                  </ProtectedRoute>
                }
              />

              <Route path="logistica-panel" element={protect(<LogisticaPanel />, "/logistica-panel")} />
              <Route path="vendedor-panel" element={protect(<VendedorPanel />, "/vendedor-panel")} />

              <Route path="mis-ventas" element={protect(<MisVentas />, "/mis-ventas")} />
              <Route
                path="registrar-clientes-venta"
                element={protect(<FormularioClienteVenta />, "/registrar-clientes-venta")}
              />
              <Route path="crear-venta" element={protect(<CrearVenta />, "/crear-venta")} />
              <Route path="ventas/:id/detalles" element={protect(<DetalleVenta />, "/crear-venta")} />
              <Route
                path="ventas/:id/obsequios"
                element={protect(<VentaObsequioPage />, "/crear-venta")}
              />
              <Route path="ventas/:id/validacion" element={protect(<VentaFoto />, "/crear-venta")} />

              <Route
                path="registrar-clientes-entrega"
                element={protect(<FormularioClienteEntrega />, "/crear-entrega-completa")}
              />
              <Route path="crear-entrega" element={protect(<CrearEntrega />, "/crear-entrega-completa")} />
              <Route
                path="entregas/:id/detalles"
                element={protect(<DetalleEntregaVendedores />, "/crear-entrega-completa")}
              />
              <Route
                path="entregas/:id/obsequios"
                element={protect(<EntregaObsequioPage />, "/crear-entrega-completa")}
              />
              <Route
                path="entregas/:id/pre-aprobacion"
                element={protect(<EntregaFoto />, "/crear-entrega-completa")}
              />
              <Route
                path="entregas/:id/fecha-llamada"
                element={protect(<FotoFechaHoraEntrega />, "/crear-entrega-completa")}
              />
              <Route path="mis-entregas" element={protect(<MisEntregas />, "/mis-entregas")} />
              <Route
                path="mis-entregas-pendientes"
                element={protect(<MisEntregasPendientes />, "/mis-entregas-pendientes")}
              />
              <Route
                path="mis-entregas-realizadas"
                element={protect(<MisEntregasRealizadas />, "/mis-entregas-realizadas")}
              />

              <Route path="ventacompleta" element={protect(<CrearVentaCompleta />, "/ventacompleta")} />
              <Route
                path="editar-venta/:id"
                element={protect(<EditarVentaCompletaVendedores />, "/ventacompleta")}
              />

              <Route
                path="crear-entrega-completa"
                element={protect(<CrearEntregaCompleta />, "/crear-entrega-completa")}
              />
              <Route
                path="editar-entrega/:id"
                element={protect(<EditarEntregaCompleta />, "/crear-entrega-completa")}
              />

                            <Route
                path="crear-gestion-comercial"
                element={protect(<CrearGestionComercial />, "/crear-gestion-comercial")}
              />

              <Route path="seleccionar-modo" element={protect(<SeleccionarModo />, "/seleccionar-modo")} />
              <Route path="crear-traslado" element={protect(<CrearTraslado />, "/crear-traslado")} />
              <Route path="mis-traslados" element={protect(<TrasladosList />, "/mis-traslados")} />
              <Route path="gestion" element={protect(<Gestion />, "/gestion")} />
              <Route path="mis-gestiones" element={protect(<MisGestiones />, "/mis-gestiones")} />
              <Route path="mis-gestiones-comerciales" element={protect(<MisGestionesComerciales />, "/mis-gestiones-comerciales")} />
              <Route path="mi-gestion/:id" element={protect(<EditarGestion />, "/mis-gestiones")} />
              <Route path="caja" element={protect(<Caja />, "/caja")} />

              <Route
                path="unauthorized"
                element={
                  <div className="mt-10 text-center">
                    <h1 className="text-2xl font-bold">Sin acceso</h1>
                    <p className="mt-2 text-gray-600">
                      No tienes permisos para ingresar a esta seccion.
                    </p>
                  </div>
                }
              />

              <Route
                path="*"
                element={
                  <h1 className="text-center mt-10">
                    404 - Página no encontrada
                  </h1>
                }
              />
            </Routes>
          </main>

          <Footer />
        </div>
      </BrowserRouter>
    </TaskNotificationProvider>
  );
}

export default App;
