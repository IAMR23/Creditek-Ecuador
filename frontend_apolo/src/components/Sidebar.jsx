import { useContext, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  FileText,
  Shield,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { api } from "../api/client";

const POSTULACIONES_EVENT = "apolo:postulaciones-updated";

export default function Sidebar() {
  const auth = useContext(AuthContext);
  const [resumenPostulaciones, setResumenPostulaciones] = useState({
    totalGeneral: 0,
    total: 0,
    noLeidas: 0,
    entrevistas: 0,
  });

  const linkClass = ({ isActive }) =>
    [
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold",
      isActive
        ? "bg-slate-900 text-white shadow-sm"
        : "text-slate-700 hover:bg-white border border-transparent hover:border-slate-200",
    ].join(" ");

  useEffect(() => {
    let active = true;

    const cargarResumen = async () => {
      try {
        const res = await api.get("/api/postulaciones/resumen");
        if (!active) return;
        setResumenPostulaciones(
          res.data?.data || {
            totalGeneral: 0,
            total: 0,
            noLeidas: 0,
            entrevistas: 0,
          }
        );
      } catch {
        if (!active) return;
      }
    };

    cargarResumen();

    const intervalId = window.setInterval(cargarResumen, 30000);
    const onUpdated = () => cargarResumen();
    window.addEventListener(POSTULACIONES_EVENT, onUpdated);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener(POSTULACIONES_EVENT, onUpdated);
    };
  }, []);

  return (
    <aside className="w-full bg-white/80 backdrop-blur border-r border-slate-200 flex flex-col md:fixed md:inset-y-0 md:left-0 md:z-40 md:h-screen md:w-64 md:overflow-y-auto">
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
          ABS
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
          <span className="flex flex-1 items-center gap-2">
            Postulaciones
            {resumenPostulaciones.noLeidas > 0 ? (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            ) : null}
          </span>
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
            {resumenPostulaciones.total}
          </span>
        </NavLink>

        <NavLink to="/entrevistas" className={linkClass}>
          <UserCheck size={18} />
          <span className="flex-1">Entrevistas</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
            {resumenPostulaciones.entrevistas}
          </span>
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
