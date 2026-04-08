import React, { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
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
  Gift,
  ShieldCheck,
  FileText,
  LucideTicketPercent,
} from "lucide-react";
import { MdSecurity } from "react-icons/md";
import { FaTasks } from "react-icons/fa";

export default function Sidebar() {
  const location = useLocation();

  // Desktop
  const [collapsed, setCollapsed] = useState(false);

  // Mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);

  // Acordeones
  const [open, setOpen] = useState({
    comercial: true,
    Marketing: false,
    logistica: false,
    contabilidad: false,
    Auditoria: false,
    admin: false,
    catalogos: false,
  });

  const toggleSection = (key) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const closeMobileSidebar = () => setMobileOpen(false);

  const sections = useMemo(
    () => ({
      comercial: {
        title: "Gerencia",
        items: [
          { label: "Metas Comerciales", icon: <BarChart3 size={20} />, path: "/metas-comerciales" },
          { label: "Reporte Entregas", icon: <BarChart3 size={20} />, path: "/reporte-entregas" },
          { label: "Revisar Gestiones", icon: <BarChart3 size={20} />, path: "/revision-gestiones" },
          { label: "Base de Datos Ventas", icon: <BarChart3 size={20} />, path: "/BDD-ventas" },
          { label: "Bonos", icon: <LucideTicketPercent size={20} />, path: "/bonos" },
          { label: "Tareas", icon: <FaTasks size={20} />, path: "/tasks" },
          { label: "Power BI", icon: <BarChart3 size={20} />, path: "/powerbi" },
        ],
      },

      Marketing: {
        title: "Marketing",
        items: [
          { label: "Copa Creditek 🏆", icon: <BarChart3 size={20} />, path: "/copa-creditek" },
          { label: "Goleadores ⚽", icon: <BarChart3 size={20} />, path: "/goleadores" },
        ],
      },

      logistica: {
        title: "Logística",
        items: [
          { label: "Entregas Pendientes", icon: <PackageCheck size={20} />, path: "/entregas-pendientes" },
          { label: "Entregas Repartidores", icon: <PackageCheck size={20} />, path: "/entregas-repartidores" },
          { label: "Informe de Entregas", icon: <PackageCheck size={20} />, path: "/entregas-repartidores-tabla" },
        ],
      },

      contabilidad: {
        title: "Contabilidad",
        items: [
          { label: "Cierres de Caja", icon: <PackageCheck size={20} />, path: "/revisar-cajas" },
        ],
      },

      Auditoria: {
        title: "Auditoría",
        items: [
          { label: "Entregas Auditoría", icon: <PackageCheck size={20} />, path: "/entregas-auditoria" },
          { label: "Ventas Auditoría", icon: <PackageCheck size={20} />, path: "/ventas-auditoria" },
        ],
      },

      admin: {
        title: "Administración",
        items: [
          { label: "Usuarios", icon: <Users size={20} />, path: "/usuarios" },
          { label: "Roles", icon: <ShieldCheck size={20} />, path: "/rol" },
          { label: "Agencias", icon: <Building2 size={20} />, path: "/agencias" },
          { label: "Postulaciones", icon: <FileText size={20} />, path: "/postulaciones" },
          { label: "Asignar usuarios a agencias", icon: <UserPlus size={20} />, path: "/usuarios-agencias" },
          { label: "Permisos", icon: <MdSecurity size={20} />, path: "/permisos" },
          { label: "Asignar Permisos", icon: <MdSecurity size={20} />, path: "/asignar-permisos" },
          {
            label: "Asignar Permisos Usuario-Agencia",
            icon: <MdSecurity size={20} />,
            path: "/asignar-permisos-usuario-agencia",
          },
          { label: "Usuarios con Permisos", icon: <MdSecurity size={20} />, path: "/usuarios-permisos" },
        ],
      },

      catalogos: {
        title: "Catálogos",
        items: [
          { label: "Marcas", icon: <Tag size={20} />, path: "/marcas" },
          { label: "Modelos", icon: <Layers size={20} />, path: "/modelos" },
          { label: "Dispositivos", icon: <Factory size={20} />, path: "/dispositivos" },
          { label: "Dispositivos-Marcas", icon: <Boxes size={20} />, path: "/dispositivosMarcas" },
          { label: "Formas de Pago", icon: <CreditCard size={20} />, path: "/formas-pago" },
          { label: "Origen", icon: <Tag size={20} />, path: "/origen" },
          { label: "Obsequios", icon: <Gift size={20} />, path: "/obsequios" },
          { label: "Costo Histórico", icon: <ClipboardList size={20} />, path: "/costoHistorico" },
        ],
      },
    }),
    []
  );

  const toggleMobileSidebar = () => setMobileOpen((prev) => !prev);


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
            {section.items.map((item, i) => {
              const active = location.pathname === item.path;

              return (
                <li key={i}>
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
                      <span className="text-sm leading-tight">{item.label}</span>
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
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
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
<div className="relative flex items-center justify-start px-4 py-4 border-b border-neutral-800 min-h-[64px]">          <h1 className="text-xl font-bold text-green-400">
            {!collapsed ? <Link to="/dashboard" onClick={closeMobileSidebar}>Dashboard</Link> : "D"}
          </h1>

        </div>

        {/* contenido */}
        <div className="flex-1 overflow-y-auto px-2 py-4 md:px-3">
          {Object.entries(sections).map(([key, section]) => renderSection(key, section))}
        </div>
      </aside>
    </>
  );
}