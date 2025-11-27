import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Users,
  Building2,
  UserPlus,
  ShoppingCart,
  PackageCheck,
} from "lucide-react";

export default function Sidebar() {
  const location = useLocation();

  const menuItems = [
    { label: "Usuarios", icon: <Users size={20} />, path: "/usuarios" },
    { label: "Agencias", icon: <Building2 size={20} />, path: "/agencias" },
    {
      label: "Asignar usuarios a agencias",
      icon: <UserPlus size={20} />,
      path: "/usuarios-agencias",
    },
    { label: "Ventas", icon: <ShoppingCart size={20} />, path: "/ventas" },
    { label: "Entregas", icon: <PackageCheck size={20} />, path: "/entregas" },
  ];

  return (
    <div className="w-60 min-h-screen bg-neutral-900 text-white flex flex-col px-4 py-6 shadow-xl border-r border-neutral-800">
      <h1 className="text-xl font-bold mb-6 text-green-400 tracking-wide">
       <Link to={"/dashboard"}> Dashboard</Link>
      </h1>

      <ul className="flex flex-col gap-2 w-full">
        {menuItems.map((item, index) => {
          const active = location.pathname === item.path;

          return (
            <li key={index}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 
                  ${active ? "bg-green-600 text-black" : "hover:bg-neutral-800"}
                `}
              >
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
