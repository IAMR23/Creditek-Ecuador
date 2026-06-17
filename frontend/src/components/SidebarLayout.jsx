/* eslint-disable react/prop-types */
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function SidebarLayout({ auth }) {
  return (
  <div className="flex min-h-screen w-full">
  <Sidebar auth={auth} />

  <div className="flex flex-col flex-1 min-w-0 bg-gray-100">
    <div className="min-w-0 flex-1 overflow-visible">
      <Outlet />
    </div>
  </div>
</div>
  );
}
