import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function SidebarLayout() {
  return (
      <div className="flex w-full min-h-screen">
        <Sidebar />
        <div className="flex-1 p-6 bg-gray-100">
          <Outlet />
        </div>
    </div>
  );
}