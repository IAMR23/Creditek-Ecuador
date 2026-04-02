import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { FaBell } from "react-icons/fa";
import NotificacionesModal from "./NotificacionesModal";
import Swal from "sweetalert2";
function Navbar({ auth, setAuth }) {
  const navigate = useNavigate();
  const [openNotificaciones, setOpenNotificaciones] = useState(false);

  const token = localStorage.getItem("token");
  const user = token ? jwtDecode(token) : null;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/tasks/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTasks(res.data.data);
      } catch (error) {
        Swal.fire("Error", "No se pudieron cargar las tareas", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setAuth({
          isAuthenticated: true,
          role: decodedToken.role,
          permisos: decodedToken.usuario?.permisosAsignados || [],
        });
      } catch (error) {
        console.error("Error al decodificar el token", error);
        localStorage.removeItem("token");
        setAuth({ isAuthenticated: false, role: null });
      }
    }
  }, [setAuth]);

  const handleLogoClick = () => {
    if (!auth.isAuthenticated) {
      navigate("/login");
      return;
    }

    const permiso = localStorage.getItem("activeMode");

    switch (auth.rol) {
      case "admin":
        if (auth.rol === "admin" && permiso === "REPARTO") {
          navigate("/logistica-panel");
        } else if (auth.rol === "admin" && permiso === "VENTAS") {
          navigate("/vendedor-panel");
        } else {
          navigate("/dashboard");
        }
        break;
      case "vendedor":
        navigate("/vendedor-panel");
        break;

      case "repartidor":
        navigate("/logistica-panel"); // Ajusta si tu ruta es distinta
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
    setAuth({ isAuthenticated: false, role: null });
    navigate("/");
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
            <img src="./logo.png" alt="" width={112} />
          </button>
        </div>

        {/* Links y botones */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setOpenNotificaciones(true)}
            className="relative text-green-200 hover:text-green-400 transition"
          >
            <FaBell size={20} />

            {/* Badge opcional */}
            <span className="absolute -top-1 -right-2 bg-red-500 text-xs px-1 rounded-full">
              {tasks.length > 0 ? tasks.length : "3"}
            </span>
          </button>

          {auth.isAuthenticated && auth.role === "admin" && (
            <Link
              to="/admin"
              className="text-green-200 hover:text-green-400 font-semibold transition duration-300"
            >
              Admin
            </Link>
          )}

          {!auth.isAuthenticated && (
            <>
              <Link
                to="/login"
                className="text-green-200 hover:text-green-400 font-semibold transition duration-300"
              >
                Login
              </Link>
              {/* 
              <Link 
                to="/registro" 
                className="text-green-200 hover:text-green-400 font-semibold transition duration-300"
              >
                Registro
              </Link> 
              */}
            </>
          )}

          {auth.isAuthenticated && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition duration-300 transform hover:-translate-y-0.5 hover:scale-105"
            >
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      </div>

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
