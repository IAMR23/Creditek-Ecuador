import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function SidebarLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />

      {/* CONTENEDOR PRINCIPAL */}
      <div className="flex flex-col flex-1 bg-gray-100">
        {/* CONTENIDO */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
