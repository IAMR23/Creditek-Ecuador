import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Users,
  Building2,
  UserPlus,
  ShoppingCart,
  Package,
  PackageCheck,
  Boxes,
  ClipboardList,
  CreditCard,
  Tag,
  BarChart3,
  Layers,
  Factory,
  Gift,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  const [open, setOpen] = useState({
    comercial: true,
    logistica: false,
    admin: false,
    catalogos: false,
  });

  const toggle = (key) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sections = {
    comercial: {
      title: "Gerencia",
      items: [
                {
          label: "Power Bi",
          icon: <BarChart3 size={20} />,
          path: "dashboard-powerbi",
        },

        {
          label: "Metas Comerciales",
          icon: <BarChart3 size={20} />,
          path: "metas-comerciales",
        },
        /*         { label: "Metas Comerciales Gráficas", icon: <BarChart3 size={20} />, path: "metas-comerciales-graficas" },
         */ {
          label: "Reporte Entregas",
          icon: <BarChart3 size={20} />,
          path: "reporte-entregas",
        },
        /*         { label: "Ventas Completas", icon: <BarChart3 size={20} />, path: "ventas-completas" },
         */
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
          label: "Entregas en Transito",
          icon: <PackageCheck size={20} />,
          path: "entregas-transito",
        },
      ],
    },

    Auditoria: {
      title: "Auditoria",
      items: [
        {
          label: "Entregas Auditoria",
          icon: <PackageCheck size={20} />,
          path: "entregas-auditoria",
        },
        {
          label: "Ventas Auditoria",
          icon: <PackageCheck size={20} />,
          path: "ventas-auditoria",
        },
        
      ],
    },

    admin: {
      title: "Administración",
      items: [
        { label: "Usuarios", icon: <Users size={20} />, path: "usuarios" },
        { label: "Roles", icon: <Users size={20} />, path: "rol" },
        { label: "Agencias", icon: <Building2 size={20} />, path: "agencias" },
        { label: "Postulaciones", icon: <Building2 size={20} />, path: "postulaciones" },
        
        {
          label: "Asignar usuarios a agencias",
          icon: <UserPlus size={20} />,
          path: "usuarios-agencias",
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
    <div className="w-64 min-h-screen bg-neutral-900 text-white px-4 py-6 border-r border-neutral-800">
      <h1 className="text-xl font-bold mb-6 text-green-400">
        <Link to="/dashboard">Dashboard</Link>
      </h1>

      {Object.entries(sections).map(([key, section]) => (
        <div key={key} className="mb-3">
          {/* Botón del acordeón */}
          <button
            onClick={() => toggle(key)}
            className="flex justify-between items-center w-full py-2 px-2 text-left hover:bg-neutral-800 rounded-lg"
          >
            <span className="font-semibold">{section.title}</span>
            <ChevronDown
              size={18}
              className={`transition-transform ${
                open[key] ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Contenido */}
          <div
            className={`overflow-hidden transition-all duration-300 ${
              open[key] ? "max-h-[1000px]" : "max-h-0"
            }`}
          >
            <ul className="flex flex-col gap-1 mt-2">
              {section.items.map((item, i) => {
                const active = location.pathname === item.path;
                return (
                  <li key={i}>
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 p-3 rounded-lg transition
                        ${
                          active
                            ? "bg-green-600 text-black"
                            : "hover:bg-neutral-800"
                        }
                      `}
                    >
                      {item.icon}
                      <span>{item.label}</span>
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
