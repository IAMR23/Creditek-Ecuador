import { useContext, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Archive,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  GitBranch,
  LayoutDashboard,
  MonitorPlay,
  Settings,
  Shield,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { api } from "../api/client";

const POSTULACIONES_EVENT = "apolo:postulaciones-updated";
const normalizeRole = (value) => String(value || "").trim().toUpperCase();

export default function Sidebar() {
  const auth = useContext(AuthContext);
  const role = normalizeRole(auth?.user?.rol?.nombre);
  const isUser = role === "USUARIO";
  const isAdmin = role === "ADMIN";
  const [simuladorAbierto, setSimuladorAbierto] = useState(false);
  const [administracionAbierta, setAdministracionAbierta] = useState(false);
  const [resumenPostulaciones, setResumenPostulaciones] = useState({
    totalGeneral: 0,
    total: 0,
    noLeidas: 0,
    entrevistas: 0,
    seleccionados: 0,
    capacitacion: 0,
    descartados: 0,
  });

  const linkClass = ({ isActive }) =>
    [
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold",
      isActive
        ? "bg-orange-500 text-white shadow-sm"
        : "border border-transparent text-white hover:border-white/15 hover:bg-white/10",
    ].join(" ");

  const simuladorMenu = (
    <div className="rounded-xl border border-white/15 bg-white/5 p-1">
      <button
        type="button"
        onClick={() => setSimuladorAbierto((current) => !current)}
        aria-expanded={simuladorAbierto}
        aria-controls="simulador-menu"
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-extrabold text-white transition hover:bg-white/10"
      >
        <MonitorPlay size={18} className="text-orange-500" aria-hidden="true" />
        <span className="flex-1 text-left">Simulador</span>
        <ChevronDown
          size={16}
          className={`transition-transform ${simuladorAbierto ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {simuladorAbierto && (
        <div id="simulador-menu" className="mt-1 border-l border-white/20 pl-3">
          <NavLink to="/simulador" className={linkClass}>
            <MonitorPlay size={17} aria-hidden="true" /> Ingreso al sistema
          </NavLink>
        </div>
      )}
    </div>
  );

  const administracionMenu = (
    <div className="rounded-xl border border-white/15 bg-white/5 p-1">
      <button
        type="button"
        onClick={() => setAdministracionAbierta((current) => !current)}
        aria-expanded={administracionAbierta}
        aria-controls="administracion-menu"
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-extrabold text-white transition hover:bg-white/10"
      >
        <Settings size={18} className="text-orange-500" aria-hidden="true" />
        <span className="flex-1 text-left">Administración</span>
        <ChevronDown
          size={16}
          className={`transition-transform ${administracionAbierta ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {administracionAbierta && (
        <div id="administracion-menu" className="mt-1 border-l border-white/20 pl-3">
          <NavLink to="/usuarios" className={linkClass}>
            <Users size={17} aria-hidden="true" /> Usuarios
          </NavLink>
          <NavLink to="/usuarios-agencias" className={linkClass}>
            <UsersRound size={17} aria-hidden="true" /> Usuarios/Agencias
          </NavLink>
          <NavLink to="/agencias" className={linkClass}>
            <Building2 size={17} aria-hidden="true" /> Agencias
          </NavLink>
          <NavLink to="/roles" className={linkClass}>
            <Shield size={17} aria-hidden="true" /> Roles
          </NavLink>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (isUser) return undefined;
    let active = true;
    const cargarResumen = async () => {
      try {
        const res = await api.get("/api/postulaciones/resumen");
        if (active) setResumenPostulaciones((current) => res.data?.data || current);
      } catch {
        // El menú conserva los últimos contadores disponibles.
      }
    };
    cargarResumen();
    const intervalId = window.setInterval(cargarResumen, 30000);
    window.addEventListener(POSTULACIONES_EVENT, cargarResumen);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener(POSTULACIONES_EVENT, cargarResumen);
    };
  }, [isUser]);

  return (
    <aside className="flex w-full flex-col border-r border-white/10 bg-black text-white md:fixed md:inset-y-0 md:left-0 md:z-40 md:h-screen md:w-64 md:overflow-y-auto">
      <div className="border-b border-white/10 p-5">
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">A</span><span className="text-orange-500">B</span><span className="text-white">S</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-orange-200 to-transparent" />
        </div>
        <div className="mt-2 text-xs uppercase tracking-[0.22em] text-white">ABS</div>
      </div>

      <nav className="p-3 flex flex-col gap-2">
        {isUser ? (
          <>
            <NavLink to="/evaluacion" className={linkClass}><ClipboardCheck size={18} /> Evaluación</NavLink>
            {simuladorMenu}
          </>
        ) : (
          <>
            <NavLink to="/dashboard" className={linkClass}><LayoutDashboard size={18} /> Dashboard</NavLink>
            {isAdmin && <NavLink to="/evaluacion" className={linkClass}><ClipboardCheck size={18} /> Evaluación</NavLink>}
            {isAdmin && simuladorMenu}
            {administracionMenu}
            <NavLink to="/control-asistencia" className={linkClass}><ClipboardList size={18} /> Movimientos de Terminales</NavLink>
            {isAdmin && <NavLink to="/vacaciones" className={linkClass}><CalendarDays size={18} /> Vacaciones</NavLink>}
            <NavLink to="/pipeline" className={linkClass}><GitBranch size={18} /> Pipeline</NavLink>
            <NavLink to="/postulaciones" className={linkClass}>
              <FileText size={18} /><span className="flex flex-1 items-center gap-2">Postulaciones{resumenPostulaciones.noLeidas > 0 && <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />}</span>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">{resumenPostulaciones.total}</span>
            </NavLink>
            <NavLink to="/entrevistas" className={linkClass}><UserCheck size={18} /><span className="flex-1">Entrevistas</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{resumenPostulaciones.entrevistas}</span></NavLink>
            <NavLink to="/seleccionados" className={linkClass}><BadgeCheck size={18} /><span className="flex-1">Seleccionados</span><span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700">{resumenPostulaciones.seleccionados || 0}</span></NavLink>
            <NavLink to="/capacitacion" className={linkClass}><GraduationCap size={18} /><span className="flex-1">Capacitación</span><span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">{resumenPostulaciones.capacitacion || 0}</span></NavLink>
            <NavLink to="/descartados" className={linkClass}><Archive size={18} /><span className="flex-1">Descartados</span><span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">{resumenPostulaciones.descartados}</span></NavLink>
          </>
        )}
      </nav>

      <div className="mt-auto border-t border-white/10 p-3">
        <div className="truncate px-3 pb-2 text-xs text-white">{auth?.user?.email || ""}</div>
        <button type="button" onClick={auth?.logout} className="w-full rounded-xl border border-white/20 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Cerrar sesión</button>
      </div>
    </aside>
  );
}
