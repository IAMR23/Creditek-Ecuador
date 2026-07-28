/* eslint-disable react/prop-types */
import { Link, useNavigate } from "react-router-dom";
import { FaBell, FaSignOutAlt, FaUserClock } from "react-icons/fa";
import NotificacionesModal from "./NotificacionesModal";
import AlertasPersonalModal from "./AlertasPersonalModal";
import { socket } from "../socket/socket";
import { useTaskNotifications } from "../context/TaskNotificationContext";
import { useCallback, useEffect, useState } from "react";
import { getDefaultRoute } from "../utils/getDefaultRoute";
import api, { logoutSession } from "../api/client";
import { hasRouteAccess } from "../config/routePermissions";

const PERMISOS_ALERTAS_PERSONAL = [
  "Administracion",
  "Desarrollo Organizacional",
  "Gerencia",
];

function Navbar({ auth, setAuth }) {
  const navigate = useNavigate();
  const [openNotificaciones, setOpenNotificaciones] = useState(false);
  const [openAlertasPersonal, setOpenAlertasPersonal] = useState(false);
  const [alertasPersonal, setAlertasPersonal] = useState([]);
  const [totalAlertasPersonal, setTotalAlertasPersonal] = useState(0);
  const [noLeidasAlertasPersonal, setNoLeidasAlertasPersonal] = useState(0);
  const [hayMasAlertasPersonal, setHayMasAlertasPersonal] = useState(false);
  const [cargandoAlertasPersonal, setCargandoAlertasPersonal] = useState(false);
  const [cargandoMasAlertasPersonal, setCargandoMasAlertasPersonal] =
    useState(false);
  const [errorAlertasPersonal, setErrorAlertasPersonal] = useState("");

  const { pendingCount, pendingTasks, clearNotifications } =
    useTaskNotifications();

  const puedeVerAlertasPersonal =
    auth.isAuthenticated &&
    hasRouteAccess({
      rol: auth.rol,
      permisos: auth.permisos || [],
      permission: PERMISOS_ALERTAS_PERSONAL,
    });

  const cargarAlertasPersonal = useCallback(
    async ({ offset = 0, agregar = false, silencioso = false } = {}) => {
      if (!puedeVerAlertasPersonal) return;

      if (agregar) {
        setCargandoMasAlertasPersonal(true);
      } else if (!silencioso) {
        setCargandoAlertasPersonal(true);
      }

      try {
        const { data } = await api.get("/api/alertas-personal", {
          params: { limit: 50, offset },
        });
        const nuevasAlertas = Array.isArray(data?.alertas) ? data.alertas : [];

        setAlertasPersonal((actuales) => {
          if (!agregar) return nuevasAlertas;

          const idsExistentes = new Set(
            actuales.map((alerta) => Number(alerta.id)),
          );
          return [
            ...actuales,
            ...nuevasAlertas.filter(
              (alerta) => !idsExistentes.has(Number(alerta.id)),
            ),
          ];
        });
        setTotalAlertasPersonal(Number(data?.total) || 0);
        setNoLeidasAlertasPersonal(Number(data?.noLeidas) || 0);
        setHayMasAlertasPersonal(Boolean(data?.hayMas));
        setErrorAlertasPersonal("");
      } catch (error) {
        console.error("No se pudieron cargar las alertas de personal:", error);
        setErrorAlertasPersonal(
          "No se pudieron consultar las notificaciones de personal.",
        );
      } finally {
        setCargandoAlertasPersonal(false);
        setCargandoMasAlertasPersonal(false);
      }
    },
    [puedeVerAlertasPersonal],
  );

  useEffect(() => {
    if (!puedeVerAlertasPersonal) {
      setAlertasPersonal([]);
      setTotalAlertasPersonal(0);
      setNoLeidasAlertasPersonal(0);
      setHayMasAlertasPersonal(false);
      setErrorAlertasPersonal("");
      setOpenAlertasPersonal(false);
      return undefined;
    }

    const actualizarSilenciosamente = () =>
      cargarAlertasPersonal({ silencioso: true });

    cargarAlertasPersonal();
    const intervalo = window.setInterval(
      actualizarSilenciosamente,
      30 * 60 * 1000,
    );
    socket.on("novedades-personal:actualizar", actualizarSilenciosamente);

    return () => {
      window.clearInterval(intervalo);
      socket.off("novedades-personal:actualizar", actualizarSilenciosamente);
    };
  }, [cargarAlertasPersonal, puedeVerAlertasPersonal]);

  const cambiarLecturaAlertaPersonal = async (notificacionId, leida) => {
    try {
      const { data } = await api.patch(
        `/api/alertas-personal/${notificacionId}/lectura`,
        { leida },
      );

      setAlertasPersonal((actuales) =>
        actuales.map((alerta) =>
          Number(alerta.id) === Number(notificacionId)
            ? {
                ...alerta,
                leida: data?.leida ?? leida,
                leidaAt: data?.leidaAt || null,
              }
            : alerta,
        ),
      );
      setNoLeidasAlertasPersonal((actual) =>
        Math.max(actual + (leida ? -1 : 1), 0),
      );
    } catch (error) {
      console.error("No se pudo cambiar la lectura de la notificación:", error);
      setErrorAlertasPersonal(
        "No se pudo actualizar el estado de la notificación.",
      );
    }
  };

  const marcarTodasAlertasPersonalLeidas = async () => {
    try {
      await api.patch("/api/alertas-personal/leidas/todas");
      const leidaAt = new Date().toISOString();
      setAlertasPersonal((actuales) =>
        actuales.map((alerta) => ({ ...alerta, leida: true, leidaAt })),
      );
      setNoLeidasAlertasPersonal(0);
    } catch (error) {
      console.error("No se pudieron marcar las notificaciones:", error);
      setErrorAlertasPersonal(
        "No se pudieron marcar todas las notificaciones como leídas.",
      );
    }
  };

  const handleLogoClick = () => {
    if (!auth.isAuthenticated) {
      navigate("/login");
      return;
    }

    const activeMode = localStorage.getItem("activeMode");

    const redirectTo = getDefaultRoute({
      rol: auth.rol,
      permisos: auth.permisos || [],
      activeMode,
    });

    navigate(redirectTo);
  };

  const handleLogout = async () => {
    await logoutSession();
    localStorage.removeItem("rol");
    localStorage.removeItem("usuario");
    localStorage.removeItem("activeMode");
    socket.disconnect();

    setAuth({
      isAuthenticated: false,
      rol: null,
      permisos: null,
      usuario: null,
      token: null,
    });

    clearNotifications();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-900 text-white shadow-lg sticky top-0 z-30 w-full">
      <div className="w-full px-3 sm:px-4 md:px-6 py-3">
        <div className="relative flex items-center justify-center md:justify-between">
          {/* Logo */}
          <div className="flex items-center justify-center md:justify-start min-w-0">
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold text-green-500 hover:text-green-400 transition duration-300 min-w-0"
            >
              <span className="animate-pulse shrink-0">RVE</span>
              <img
                src="/logo.png"
                alt="logo"
                className="w-20 sm:w-24 md:w-28 h-auto object-contain"
              />
            </button>
          </div>

          {/* Acciones */}
          <div className="absolute right-0 flex items-center gap-2 sm:gap-4 md:static">
            <button
              onClick={() => setOpenNotificaciones(true)}
              type="button"
              aria-label="Abrir notificaciones de tareas"
              title="Notificaciones de tareas"
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

            {puedeVerAlertasPersonal && (
              <button
                onClick={() => setOpenAlertasPersonal(true)}
                type="button"
                aria-label="Abrir novedades de personal"
                title="Novedades de personal"
                className="relative flex shrink-0 flex-col items-center text-amber-200 transition hover:text-amber-400"
              >
                <div className="relative">
                  <FaUserClock size={21} />
                  {noLeidasAlertasPersonal > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">
                      {noLeidasAlertasPersonal > 99
                        ? "99+"
                        : noLeidasAlertasPersonal}
                    </span>
                  )}
                </div>
              </button>
            )}

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

      {openAlertasPersonal && (
        <AlertasPersonalModal
          alertas={alertasPersonal}
          cargando={cargandoAlertasPersonal}
          cargandoMas={cargandoMasAlertasPersonal}
          error={errorAlertasPersonal}
          total={totalAlertasPersonal}
          noLeidas={noLeidasAlertasPersonal}
          hayMas={hayMasAlertasPersonal}
          onCargarMas={() =>
            cargarAlertasPersonal({
              offset: alertasPersonal.length,
              agregar: true,
              silencioso: true,
            })
          }
          onCambiarLectura={cambiarLecturaAlertaPersonal}
          onMarcarTodasLeidas={marcarTodasAlertasPersonalLeidas}
          onClose={() => setOpenAlertasPersonal(false)}
        />
      )}
    </nav>
  );
}

export default Navbar;
