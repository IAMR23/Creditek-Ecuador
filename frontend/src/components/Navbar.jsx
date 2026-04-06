import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { FaBell } from "react-icons/fa";
import NotificacionesModal from "./NotificacionesModal";
import Swal from "sweetalert2";
import axios from "axios";
import { API_URL } from "../../config";


function Navbar({ auth, setAuth }) {
  const navigate = useNavigate();

  const [openNotificaciones, setOpenNotificaciones] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // ✅ Validar expiración del token
  const isTokenValid = (token) => {
    try {
      const decoded = jwtDecode(token);
      return decoded.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  };

  // ✅ Obtener tareas SOLO si está autenticado correctamente
  useEffect(() => {
    if (isAuthLoading || !auth.isAuthenticated) return;

    const token = localStorage.getItem("token");
    if (!token) return;

    const fetchTasks = async () => {
      try {
        setLoading(true);

        const res = await axios.get(`${API_URL}/tasks/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setTasks(res.data.data);
      } catch (error) {
        console.error(error);

        // ❗ Evita alertas innecesarias en errores de auth
        if (error.response?.status !== 401) {
          Swal.fire("Error", "No se pudieron cargar las tareas", "error");
        } else {
          // Token inválido → cerrar sesión
          handleLogout();
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [auth.isAuthenticated, isAuthLoading]);

  // ✅ Navegación por rol
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

  // ✅ Logout limpio
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    localStorage.removeItem("usuario");
    localStorage.removeItem("activeMode");

    setAuth({ isAuthenticated: false, rol: null });
    navigate("/login");
  };

  return (
    <nav className="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center px-6 py-4">
        
        {/* Logo */}
        <div className="flex justify-center">
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-2 text-3xl font-extrabold text-green-500 hover:text-green-400 transition duration-300"
          >
            <span className="animate-pulse">RVE</span>
            <img src="./logo.png" alt="logo" width={112} />
          </button>
        </div>

        {/* Acciones */}
        <div className="flex items-center space-x-4">

          <button
            onClick={() => setOpenNotificaciones(true)}
            className="relative text-green-200 hover:text-green-400 transition"
          >
            <FaBell size={20} />

            <span className="absolute -top-1 -right-2 bg-red-500 text-xs px-1 rounded-full">
              {tasks.length}
            </span>
          </button>

          {/* Admin */}
          {auth.isAuthenticated && auth.rol === "admin" && (
            <Link
              to="/admin"
              className="text-green-200 hover:text-green-400 font-semibold transition duration-300"
            >
              Admin
            </Link>
          )}

          {/* No autenticado */}
          {!auth.isAuthenticated && (
            <Link
              to="/login"
              className="text-green-200 hover:text-green-400 font-semibold transition duration-300"
            >
              Login
            </Link>
          )}

          {/* Logout */}
          {auth.isAuthenticated && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition duration-300"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </div>

      {/* Modal */}
      {openNotificaciones && (
        <NotificacionesModal
          tasks={tasks}
          onClose={() => setOpenNotificaciones(false)}
        />
      )}
    </nav>
  );
}

export default Navbar;