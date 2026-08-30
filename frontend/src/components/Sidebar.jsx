/* eslint-disable react/prop-types */
import { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Menu,
  Users,
  Building2,
  UserPlus,
  PackageCheck,
  Boxes,
  ClipboardList,
  CreditCard,
  Tag,
  BarChart3,
  Layers,
  Factory,
  DollarSign,
  Gift,
  ShieldCheck,
  LucideTicketPercent,
  MonitorCog,
  Table2,
  FileCheck2,
  ReceiptText,
  MapPinned,
  FileSpreadsheet,
  Megaphone,
  UsersRound,
  WalletCards,
  Sparkles,
  Settings2,
} from "lucide-react";
import { MdSecurity } from "react-icons/md";
import {
  hasRouteAccess,
  normalizeRole,
  ROUTE_PERMISSIONS,
} from "../config/routePermissions";
import { getDefaultRoute } from "../utils/getDefaultRoute";

export default function Sidebar({ auth }) {
  const location = useLocation();

  // Desktop
  const [collapsed] = useState(false);

  // Mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);

  // Acordeones
  const [open, setOpen] = useState({
    comercial: true,
    ghl: false,
    Marketing: false,
    logistica: false,
    contabilidad:
      location.pathname === "/contabilidad/pagos-comisiones" ||
      location.pathname === "/contabilidad/descuentos-decimos" ||
      location.pathname === "/contabilidad/egresos-creditek" ||
      location.pathname === "/contabilidad/roles-creditek-resumen",
    Auditoria: false,
    DesarrolloOrganizacional: true,
    Sistemas: false,
    supervisores: location.pathname.startsWith("/supervisores"),
    admin: false,
    catalogos: false,
    rolesCreditek:
      location.pathname === "/contabilidad/pagos-comisiones" ||
      location.pathname === "/contabilidad/descuentos-decimos" ||
      location.pathname === "/contabilidad/egresos-creditek" ||
      location.pathname === "/contabilidad/roles-creditek-resumen",
  });

  const toggleSection = (key) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const closeMobileSidebar = () => setMobileOpen(false);

  const sections = useMemo(
    () => ({
      comercial: {
        title: "Gerencia",
        permission: ["Gerencia", "Administracion"],
        items: [
          {
            label: "Metas Comerciales",
            icon: <BarChart3 size={20} />,
            path: "/metas-comerciales",
          },


          {
            label: "Reporte Entregas",
            icon: <BarChart3 size={20} />,
            path: "/reporte-entregas",
          },
          {
            label: "Revisar Gestiones",
            icon: <BarChart3 size={20} />,
            path: "/revision-gestiones",
          },
          {
            label: "Revisar Gestiones Comerciales",
            icon: <BarChart3 size={20} />,
            path: "/revision-gestiones-comercial",
          },
        


          {
            label: "Secretarios Ejecutivos",
            icon: <ClipboardList size={20} />,
            path: "/secretarios-ejecutivos",
          },
          {
            label: "Consejo Ejecutivo",
            icon: <UsersRound size={20} />,
            path: "/consejo-ejecutivo",
          },
/*           {
            label: "Facturas fisicas",
            icon: <ReceiptText size={20} />,
            path: "/gerencia/facturas-fisicas",
          },
          {
            label: "Facturas IA",
            icon: <Sparkles size={20} />,
            path: "/gerencia/facturas-ia",
          }, */
          {
            label: "Ver planes de batalla",
            icon: <FileCheck2 size={20} />,
            path: "/ver-planes-batalla",
          },
/*           { label: "Tareas", icon: <FaTasks size={20} />, path: "/tasks" },
 */          {
            label: "Power BI",
            icon: <BarChart3 size={20} />,
            path: "/powerbi",
          },
          {
            label: "Matriz GHL",
            icon: <Table2 size={20} />,
            path: "/ghl/oportunidades-matriz",
          },
            {
            label: "Rendimiento de pautas",
            icon: <BarChart3 size={20} />,
            path: "/ghl/rendimiento-pautas",
          },
        ],
      },
      Marketing: {
        title: "Marketing",
        permission: "Marketing",
        items: [
          {
            label: "Pautas y Contenido",
            icon: <Megaphone size={20} />,
            path: "/marketing/pautas",
          },
                   {
            label: "Costo por Venta Marketing",
            icon: <DollarSign size={20} />,
            path: "/costo-venta-marketing",
          },
          {
            label: "Copa Creditek 🏆",
            icon: <BarChart3 size={20} />,
            path: "/copa-creditek",
          },
          {
            label: "Goleadores ⚽",
            icon: <BarChart3 size={20} />,
            path: "/goleadores",
          },
 
        ],
      },

      logistica: {
        title: "Logística",
        permission: "Logistica",
        items: [
                    {
            label: "Costo por Entrega",
            icon: <PackageCheck size={20} />,
            path: "/costo-entrega-marketing",
          },

          {
            label: "Entregas Pendientes",
            icon: <PackageCheck size={20} />,
            path: "/entregas-pendientes",
          },
          /*  { label: "Entregas Repartidores", icon: <PackageCheck size={20} />, path: "/entregas-repartidores" }, */
          {
            label: "Informe de Entregas",
            icon: <PackageCheck size={20} />,
            path: "/entregas-repartidores-tabla",
          },
        ],
      },

      contabilidad: {
        title: "Contabilidad",
        permission: "Contabilidad",
        items: [
          {
            label: "Nómina",
            icon: <DollarSign size={20} />,
            path: "/nomina",
          },
          {
            label: "Niveles Jerarquicos",
            icon: <DollarSign size={20} />,
            path: "/contabilidad/roles-pago",
          },
          {
            label: "Configuracion de Comisiones", 
            icon: <LucideTicketPercent size={20} />,
            path: "/contabilidad/comisiones",
          },
              {
            label: "Base de Datos Ventas",
            icon: <BarChart3 size={20} />,
            path: "/bdd-ventas",
          },
          {
            label: "Configuracion de meta minima",
            icon: <ShieldCheck size={20} />,
            path: "/contabilidad/metas-minimas-multas",
          },
          {
            label: "Meta minima sin multa",
            icon: <ShieldCheck size={20} />,
            path: "/contabilidad/meta-minima-sin-multa",
          },
          {
            key: "rolesCreditek",
            label: "Roles Creditek",
            icon: <UsersRound size={20} />,
            items: [
              {
                label: "Pagos comisiones",
                icon: <FileSpreadsheet size={18} />,
                path: "/contabilidad/pagos-comisiones",
              },
              {
                label: "Descuentos décimos",
                icon: <LucideTicketPercent size={18} />,
                path: "/contabilidad/descuentos-decimos",
              },
              {
                label: "Egresos",
                icon: <WalletCards size={18} />,
                path: "/contabilidad/egresos-creditek",
              },
              {
                label: "Resumen roles",
                icon: <FileSpreadsheet size={18} />,
                path: "/contabilidad/roles-creditek-resumen",
              },
            ],
          },
          {
            label: "Cierres de Caja",
            icon: <PackageCheck size={20} />,
            path: "/revisar-cajas",
          },
          {
            label: "Extraccion reportes caja",
            icon: <FileSpreadsheet size={20} />,
            path: "/contabilidad/extraccion-reportes-caja",
          },
          {
            label: "Control financiero",
            icon: <BarChart3 size={20} />,
            path: "/contabilidad/control-financiero",
          },
          {
            label: "Bonos",
            icon: <LucideTicketPercent size={20} />,
            path: "/bonos",
          },
        ],
      },

      Auditoria: {
        title: "Auditoría",
        permission: "Auditoria",
        items: [
          {
            label: "Entregas Auditoría",
            icon: <PackageCheck size={20} />,
            path: "/entregas-auditoria",
          },
          {
            label: "Ventas Auditoría",
            icon: <PackageCheck size={20} />,
            path: "/ventas-auditoria",
          },
        ],
      },

/*       DesarrolloOrganizacional: {
        title: "Desarrollo Organizacional",
        items: [
          {
            label: "Postulaciones",
            icon: <UserPlus size={20} />,
            path: "/postulaciones",
          },
        ],
      }, */

      Sistemas: {
        title: "Sistemas",
        permission: "Sistemas",
        items: [
          {
            label: "Gestion de Tareas",
            icon: <MonitorCog size={20} />,
            path: "/sistemas/tareas",
          },
          {
            label: "Mapa Comercial",
            icon: <MapPinned size={20} />,
            path: "/sistemas/mapa-comercial",
          },
          {
            label: "Inventarios",
            icon: <Boxes size={20} />,
            path: "/sistemas/inventarios",
          },
          {
            label: "Personas",
            icon: <Users size={20} />,
            path: "/sistemas/personas",
          },
          {
            label: "Agencias reportes caja",
            icon: <Settings2 size={20} />,
            path: "/sistemas/reportes-caja-agencias",
          },
          {
            label: "Normalizacion dispositivos",
            icon: <ClipboardList size={20} />,
            path: "/conciliacion-facturas",
          },
        
        ],
      },

      supervisores: {
        title: "Supervisores",
        permission: "Administracion",
        allowedRoles: ["admin", "administrador"],
        items: [
          {
            label: "Dashboard",
            icon: <BarChart3 size={20} />,
            path: "/supervisores",
          },
          {
            label: "Power BI",
            icon: <BarChart3 size={20} />,
            path: "/supervisores/powerbi",
          },
        ],
      },

      admin: {
        title: "Administración",
        permission: "Administracion",
        items: [
          { label: "Usuarios", icon: <Users size={20} />, path: "/usuarios" },
          { label: "Roles", icon: <ShieldCheck size={20} />, path: "/rol" },
          {
            label: "Agencias",
            icon: <Building2 size={20} />,
            path: "/agencias",
          },
          {
            label: "Asignar usuarios a agencias",
            icon: <UserPlus size={20} />,
            path: "/usuarios-agencias",
          },
          {
            label: "Permisos",
            icon: <MdSecurity size={20} />,
            path: "/permisos",
          },
          {
            label: "Configurar sanciones",
            icon: <LucideTicketPercent size={20} />,
            path: "/contabilidad/sanciones-configuracion",
          },
          {
            label: "Reporte de sanciones",
            icon: <FileSpreadsheet size={20} />,
            path: "/contabilidad/sanciones-ventas",
          },
          {
            label: "Permisos de usuarios",
            icon: <MdSecurity size={20} />,
            path: "/asignar-permisos",
          },
        ],
      },

      catalogos: {
        title: "Catálogos",
        permission: "Catalogos",
        items: [
          { label: "Marcas", icon: <Tag size={20} />, path: "/marcas" },
          { label: "Modelos", icon: <Layers size={20} />, path: "/modelos" },
          {
            label: "Dispositivos",
            icon: <Factory size={20} />,
            path: "/dispositivos",
          },
          {
            label: "Dispositivos-Marcas",
            icon: <Boxes size={20} />,
            path: "/dispositivosMarcas",
          },
          {
            label: "Formas de Pago",
            icon: <CreditCard size={20} />,
            path: "/formas-pago",
          },
          { label: "Origen", icon: <Tag size={20} />, path: "/origen" },
          { label: "Obsequios", icon: <Gift size={20} />, path: "/obsequios" },
          {
            label: "Costo Histórico",
            icon: <ClipboardList size={20} />,
            path: "/costoHistorico",
          },
          {
            label: "Lista de precios",
            icon: <DollarSign size={20} />,
            path: "/lista-precios",
          },
        ],
      },
    }),
    [],
  );

  const toggleMobileSidebar = () => setMobileOpen((prev) => !prev);
  const homePath = getDefaultRoute({
    rol: auth?.rol,
    permisos: auth?.permisos || [],
    activeMode: localStorage.getItem("activeMode"),
  });

  const visibleSections = useMemo(() => {
    const rol = auth?.rol;
    const permisos = auth?.permisos || [];

    return Object.fromEntries(
      Object.entries(sections)
        .filter(([, section]) => {
          const rolesPermitidos = (section.allowedRoles || []).map(normalizeRole);
          const rolPermitido =
            rolesPermitidos.length === 0 ||
            rolesPermitidos.includes(normalizeRole(rol));

          return rolPermitido && hasRouteAccess({
            rol,
            permisos,
            permission: section.permission,
          });
        })
        .map(([key, section]) => [
          key,
          {
            ...section,
            items: section.items
              .map((item) => {
                if (!item.items) return item;

                return {
                  ...item,
                  items: item.items.filter((child) =>
                    hasRouteAccess({
                      rol,
                      permisos,
                      path: child.path,
                      permission: ROUTE_PERMISSIONS[child.path],
                    }),
                  ),
                };
              })
              .filter((item) =>
                item.items
                  ? item.items.length > 0
                  : hasRouteAccess({
                      rol,
                      permisos,
                      path: item.path,
                      permission: ROUTE_PERMISSIONS[item.path],
                    }),
              ),
          },
        ])
        .filter(([, section]) => section.items.length > 0),
    );
  }, [auth?.permisos, auth?.rol, sections]);

  const renderSection = (key, section) => {
    const isOpen = open[key];

    return (
      <div key={key} className="mb-3">
        <button
          onClick={() => toggleSection(key)}
          className={`flex w-full items-center rounded-lg px-2 py-2 transition hover:bg-neutral-800 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed ? (
            <>
              <span className="font-semibold">{section.title}</span>
              <ChevronDown
                size={18}
                className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </>
          ) : (
            <ChevronDown
              size={18}
              className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          )}
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? "max-h-[1000px] opacity-100 mt-2" : "max-h-0 opacity-0"
          }`}
        >
          <ul className="flex flex-col gap-1">
            {section.items.map((item) => {
              if (item.items) {
                const nestedOpen = open[item.key];
                const nestedActive = item.items.some(
                  (child) => location.pathname === child.path,
                );

                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => toggleSection(item.key)}
                      className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                        nestedActive
                          ? "bg-neutral-800 text-green-400"
                          : "text-white hover:bg-neutral-800"
                      }`}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {!collapsed && (
                        <>
                          <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                            {item.label}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`shrink-0 transition-transform duration-200 ${
                              nestedOpen ? "rotate-180" : ""
                            }`}
                          />
                        </>
                      )}
                    </button>

                    <div
                      className={`overflow-hidden transition-all duration-200 ease-in-out ${
                        nestedOpen
                          ? "mt-1 max-h-60 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <ul className="ml-5 flex flex-col gap-1 border-l border-neutral-700 pl-2">
                        {item.items.map((child) => {
                          const childActive = location.pathname === child.path;

                          return (
                            <li key={child.path}>
                              <Link
                                to={child.path}
                                onClick={closeMobileSidebar}
                                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                                  childActive
                                    ? "bg-green-600 text-black"
                                    : "text-gray-200 hover:bg-neutral-800 hover:text-white"
                                }`}
                              >
                                <span className="shrink-0">{child.icon}</span>
                                <span className="leading-tight">
                                  {child.label}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                );
              }

              const active = location.pathname === item.path;

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    title={collapsed ? item.label : ""}
                    onClick={closeMobileSidebar}
                    className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                      active
                        ? "bg-green-600 text-black"
                        : "text-white hover:bg-neutral-800"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <span className="text-sm leading-tight">
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* BOTÓN HAMBURGUESA SOLO EN MÓVIL */}
      <button
        onClick={toggleMobileSidebar}
        className="fixed left-4 top-4 z-[60] rounded-lg bg-neutral-900 p-2 text-white shadow-lg md:hidden"
      >
        <Menu size={22} />
      </button>

      {/* OVERLAY MÓVIL */}
      <div
        onClick={closeMobileSidebar}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* SIDEBAR */}
      <aside
        className={`
          bg-neutral-900 text-white border-r border-neutral-800
          flex flex-col
          will-change-transform
          md:sticky md:top-0 md:h-screen md:z-30
          fixed top-0 left-0 z-50 h-screen
          transition-all duration-300 ease-in-out
          ${collapsed ? "md:w-20" : "md:w-64"}
          w-72
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="relative flex items-center justify-start px-4 py-4 border-b border-neutral-800 min-h-[64px]">
          {" "}
          <h1 className="text-xl font-bold text-green-400">
            {!collapsed ? (
              <Link to={homePath} onClick={closeMobileSidebar}>
                Dashboard
              </Link>
            ) : (
              "D"
            )}
          </h1>
        </div>

        {/* contenido */}
        <div className="flex-1 overflow-y-auto px-2 py-4 md:px-3">
          {Object.entries(visibleSections).map(([key, section]) =>
            renderSection(key, section),
          )}
        </div>
      </aside>
    </>
  );
}
