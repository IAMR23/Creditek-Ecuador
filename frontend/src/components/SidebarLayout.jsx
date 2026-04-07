import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function SidebarLayout() {
  return (
  <div className="flex min-h-screen w-full">
  <Sidebar />

  <div className="flex flex-col flex-1 min-w-0 bg-gray-100">
    <div className="flex-1 overflow-auto">
      <Outlet />
    </div>
  </div>
</div>
  );
}
