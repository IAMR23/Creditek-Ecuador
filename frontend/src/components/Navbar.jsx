import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { jwtDecode } from "jwt-decode";

function Navbar({ auth, setAuth }) {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setAuth({ isAuthenticated: true, role: decodedToken.role });
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

    switch (auth.rol) {
      case "admin":
        navigate("/dashboard");
        break;

      case "vendedor":
        navigate("/vendedor-panel");
        break;

      case "logistica":
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
    setAuth({ isAuthenticated: false, role: null });
    navigate("/");
  };

  return (
    <nav className="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center px-6 py-4">
        {/* Logo */}
        <button
          onClick={handleLogoClick}
          className="text-3xl font-extrabold text-green-500 hover:text-green-400 transition duration-300"
        >
          <span className="animate-pulse">RVE</span>
        </button>

        {/* Links y botones */}
        <div className="flex items-center space-x-4">
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
              className="bg-green-500 hover:bg-green-400 text-white font-semibold px-4 py-2 rounded-lg shadow-md transition duration-300 transform hover:-translate-y-0.5 hover:scale-105"
            >
              Cerrar Sesión
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
