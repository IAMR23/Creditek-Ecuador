import { useContext } from "react";
import { NavLink } from "react-router-dom";
import { Building2, ClipboardList, FileText, Shield, Users, UsersRound } from "lucide-react";
import { AuthContext } from "../context/AuthContext";

export default function Sidebar() {
  const auth = useContext(AuthContext);

  const linkClass = ({ isActive }) =>
    [
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold",
      isActive
        ? "bg-slate-900 text-white shadow-sm"
        : "text-slate-700 hover:bg-white border border-transparent hover:border-slate-200",
    ].join(" ");

  return (
    <aside className="w-full md:w-72 bg-white/80 backdrop-blur border-r border-slate-200 flex flex-col">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-extrabold tracking-tight">
            <span className="text-black">A</span>
            <span className="text-orange-500">B</span>
            <span className="text-black">S</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-orange-200 to-transparent" />
        </div>
        <div className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
          Apolo Business Solutions
        </div>
      </div>

      <nav className="p-3 flex flex-col gap-2">
        <NavLink to="/agencias" className={linkClass}>
          <Building2 size={18} />
          Agencias
        </NavLink>

        <NavLink to="/roles" className={linkClass}>
          <Shield size={18} />
          Roles
        </NavLink>

        <NavLink to="/usuarios" className={linkClass}>
          <Users size={18} />
          Usuarios
        </NavLink>

        <NavLink to="/usuarios-agencias" className={linkClass}>
          <UsersRound size={18} />
          Usuarios/Agencias
        </NavLink>

        <NavLink to="/control-asistencia" className={linkClass}>
          <ClipboardList size={18} />
          Movimientos de Terminales
        </NavLink>

        <NavLink to="/postulaciones" className={linkClass}>
          <FileText size={18} />
          Postulaciones
        </NavLink>
      </nav>

      <div className="mt-auto p-3 border-t border-slate-200">
        <div className="text-xs text-slate-500 px-3 pb-2 truncate">
          {auth?.user?.email || ""}
        </div>
        <button
          type="button"
          onClick={auth?.logout}
          className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 hover:bg-slate-50"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
