import { Link, useNavigate } from "react-router-dom";
import { FaBell, FaSign, FaSignOutAlt } from "react-icons/fa";
import NotificacionesModal from "./NotificacionesModal";
import { socket } from "../socket/socket";
import { useTaskNotifications } from "../context/TaskNotificationContext";
import { useState } from "react";

function Navbar({ auth, setAuth }) {
  const navigate = useNavigate();
  const [openNotificaciones, setOpenNotificaciones] = useState(false);

  const { pendingCount, connected, pendingTasks, clearNotifications } =
    useTaskNotifications();

  const handleLogoClick = () => {
    if (!auth.isAuthenticated) {
      navigate("/login");
      return;
    }

    const permiso = localStorage.getItem("activeMode");

    switch (auth.rol) {
      case "admin":
        if (permiso === "REPARTO") {
          navigate("/logistica-panel");
        } else if (permiso === "VENTAS") {
          navigate("/vendedor-panel");
        } else {
          navigate("/dashboard");
        }
        break;

      case "vendedor":
        navigate("/vendedor-panel");
        break;

      case "repartidor":
        navigate("/logistica-panel");
        break;

      default:
        navigate("/login");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    localStorage.removeItem("usuario");
    localStorage.removeItem("activeMode");
    socket.disconnect();

    setAuth({
      isAuthenticated: false,
      rol: null,
      permisos: null,
      usuario: null,
    });

    clearNotifications();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-900 text-white shadow-lg sticky top-0 z-30 w-full">
      <div className="w-full px-3 sm:px-4 md:px-6 py-3">
<div className="relative flex items-center justify-center md:justify-between">          {/* Logo */}
          <div className="flex items-center justify-center md:justify-start min-w-0">
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold text-green-500 hover:text-green-400 transition duration-300 min-w-0"
            >
              <span className="animate-pulse shrink-0">RVE</span>
              <img
                src="./logo.png"
                alt="logo"
                className="w-20 sm:w-24 md:w-28 h-auto object-contain"
              />
            </button>
          </div>

          {/* Acciones */}
<div className="absolute right-0 flex items-center gap-3 sm:gap-4 md:static">            <button
              onClick={() => setOpenNotificaciones(true)}
              className="relative flex flex-col items-center text-green-200 hover:text-green-400 transition shrink-0"
            >
              <div className="relative">
                <FaBell size={20} />
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </div>

              {/*        <span className="text-[10px] sm:text-xs text-gray-400 text-center leading-tight max-w-[70px] sm:max-w-none">
            {connected ? "Tiempo real activo" : "Sin conexión"}
          </span> */}
            </button>

            {!auth.isAuthenticated && (
              <Link
                to="/login"
                className="text-green-200 hover:text-green-400 font-semibold transition duration-300 text-sm sm:text-base"
              >
                Login
              </Link>
            )}

            {auth.isAuthenticated && (
              <button
                onClick={handleLogout}
                className="bg-green-500 hover:bg-green-400 text-white font-semibold px-3 sm:px-4 py-2 rounded-lg shadow-md transition duration-300 text-sm sm:text-base whitespace-nowrap"
              >
                <FaSignOutAlt />
              </button>
            )}
          </div>
        </div>
      </div>

      {openNotificaciones && (
        <NotificacionesModal
          tasks={pendingTasks}
          onClose={() => setOpenNotificaciones(false)}
        />
      )}
    </nav>
  );
}

export default Navbar;
