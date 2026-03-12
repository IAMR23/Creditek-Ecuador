import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
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

export default function Sidebar() {
  const location = useLocation();

  // Estado del sidebar (expandido / colapsado)
  const [collapsed, setCollapsed] = useState(false);

  // Estado de acordeones
  const [open, setOpen] = useState({
    comercial: true,
    Marketing: false,
    logistica: false,
    Auditoria: false,
    admin: false,
    catalogos: false,
  });

  const toggle = (key) => {
    if (collapsed) return;
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sections = {
    comercial: {
      title: "Gerencia",
      items: [
        {
          label: "Metas Comerciales",
          icon: <BarChart3 size={20} />,
          path: "metas-comerciales",
        },
        {
          label: "Reporte Entregas",
          icon: <BarChart3 size={20} />,
          path: "reporte-entregas",
        },
        {
          label: "Revisar Gestiones",
          icon: <BarChart3 size={20} />,
          path: "revision-gestiones",
        },
        {
          label: "Base de Datos Ventas",
          icon: <BarChart3 size={20} />,
          path: "BDD-ventas",
        },

        {
          label: "Bonos",
          icon: <LucideTicketPercent size={20} />,
          path: "bonos",
        },
      ],
    },

    Marketing: {
      title: "Marketing",
      items: [
        {
          label: "Copa Creditek 🏆",
          icon: <BarChart3 size={20} />,
          path: "copa-creditek",
        },
        {
          label: "Goleadores ⚽",
          icon: <BarChart3 size={20} />,
          path: "goleadores",
        },
      ],
    },

    logistica: {
      title: "Logística",
      items: [
        {
          label: "Entregas Pendientes",
          icon: <PackageCheck size={20} />,
          path: "entregas-pendientes",
        },

        {
          label: "Entregas Repartidores",
          icon: <PackageCheck size={20} />,
          path: "entregas-repartidores",
        },

        {
          label: "Informe de Entregas",
          icon: <PackageCheck size={20} />,
          path: "entregas-repartidores-tabla",
        },
      ],
    },

    
    contabilidad: {
      title: "Contabilidad",
      items: [
        {
          label: "Cierres de Caja",
          icon: <PackageCheck size={20} />,
          path: "revisar-cajas",
        },

  
      ],
    },

    Auditoria: {
      title: "Auditoría",
      items: [
        {
          label: "Entregas Auditoría",
          icon: <PackageCheck size={20} />,
          path: "entregas-auditoria",
        },
        {
          label: "Ventas Auditoría",
          icon: <PackageCheck size={20} />,
          path: "ventas-auditoria",
        },
      ],
    },

    admin: {
      title: "Administración",
      items: [
        { label: "Usuarios", icon: <Users size={20} />, path: "usuarios" },
        { label: "Roles", icon: <ShieldCheck size={20} />, path: "rol" },
        { label: "Agencias", icon: <Building2 size={20} />, path: "agencias" },
        {
          label: "Postulaciones",
          icon: <FileText size={20} />,
          path: "postulaciones",
        },
        {
          label: "Asignar usuarios a agencias",
          icon: <UserPlus size={20} />,
          path: "usuarios-agencias",
        },
        {
          label: "Permisos",
          icon: <MdSecurity size={20} />,
          path: "permisos",
        },
        {
          label: "Asignar Permisos",
          icon: <MdSecurity size={20} />,
          path: "asignar-permisos",
        },
        {
          label: "Asignar Permisos Usuario-Agencia",
          icon: <MdSecurity size={20} />,
          path: "asignar-permisos-usuario-agencia",
        },
        {
          label: "Usuarios con Permisos",
          icon: <MdSecurity size={20} />,
          path: "usuarios-permisos",
        },
      ],
    },

    catalogos: {
      title: "Catálogos",
      items: [
        { label: "Marcas", icon: <Tag size={20} />, path: "marcas" },
        { label: "Modelos", icon: <Layers size={20} />, path: "modelos" },
        {
          label: "Dispositivos",
          icon: <Factory size={20} />,
          path: "dispositivos",
        },
        {
          label: "Dispositivos-Marcas",
          icon: <Boxes size={20} />,
          path: "dispositivosMarcas",
        },
        {
          label: "Formas de Pago",
          icon: <CreditCard size={20} />,
          path: "formas-pago",
        },
        { label: "Origen", icon: <Tag size={20} />, path: "origen" },
        { label: "Obsequios", icon: <Gift size={20} />, path: "obsequios" },
        {
          label: "Costo Histórico",
          icon: <ClipboardList size={20} />,
          path: "costoHistorico",
        },
      ],
    },
  };

  return (
    <div
      className={`relative min-h-screen bg-neutral-900 text-white border-r border-neutral-800
        transition-all duration-300
        ${collapsed ? "w-20 px-2" : "w-64 px-4"}
      `}
    >
      {/* Botón colapsar */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 bg-neutral-800 p-1 rounded-full border border-neutral-700 hover:bg-neutral-700"
      >
        <ChevronDown
          size={18}
          className={`transition-transform ${
            collapsed ? "-rotate-90" : "rotate-90"
          }`}
        />
      </button>

      {/* Logo / Dashboard */}
      <h1 className="text-xl font-bold mb-6 text-green-400 text-center">
        {!collapsed && <Link to="/dashboard">Dashboard</Link>}
      </h1>

      {/* Secciones */}
      {Object.entries(sections).map(([key, section]) => (
        <div key={key} className="mb-3">
          {/* Header sección */}
          <button
            onClick={() => toggle(key)}
            className="flex justify-between items-center w-full py-2 px-2 hover:bg-neutral-800 rounded-lg"
          >
            {!collapsed && (
              <span className="font-semibold">{section.title}</span>
            )}
            {!collapsed && (
              <ChevronDown
                size={18}
                className={`transition-transform ${
                  open[key] ? "rotate-180" : ""
                }`}
              />
            )}
          </button>

          {/* Items */}
          <div
            className={`overflow-hidden transition-all duration-300
              ${open[key] && !collapsed ? "max-h-[1000px]" : "max-h-0"}
            `}
          >
            <ul className="flex flex-col gap-1 mt-2">
              {section.items.map((item, i) => {
                const active = location.pathname === item.path;

                return (
                  <li key={i}>
                    <Link
                      to={item.path}
                      title={collapsed ? item.label : ""}
                      className={`flex items-center gap-3 p-3 rounded-lg transition
                        ${
                          active
                            ? "bg-green-600 text-black"
                            : "hover:bg-neutral-800"
                        }
                        ${collapsed ? "justify-center" : ""}
                      `}
                    >
                      {item.icon}
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
