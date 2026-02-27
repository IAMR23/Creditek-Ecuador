import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/userServices";
import { jwtDecode } from "jwt-decode";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";

function LoginForm({ setAuth }) {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

/*   const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await loginUser(credentials);
      localStorage.setItem("token", response.token);

      const decodedToken = jwtDecode(response.token);
      const userRole = decodedToken.usuario?.rol.nombre;

      setAuth({ isAuthenticated: true, rol: userRole });

      if (userRole === "Vendedor") navigate("/vendedor-panel");
      if (userRole === "admin") navigate("/dashboard");
      if (userRole === "Repartidor") navigate("/logistica-panel");
    } catch (error) {
      setError(error.response?.data?.message || "Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };
 */
  
  

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  try {
    const response = await loginUser(credentials);
    localStorage.setItem("token", response.token);

    const decodedToken = jwtDecode(response.token);

    const permisos = decodedToken.usuario?.permisosAsignados || [];
    const rol = decodedToken.usuario?.rol?.nombre;

    setAuth({
      isAuthenticated: true,
      rol,
      permisos,
    });

    const puedeRepartir = permisos.includes("Repartir");

    if (rol === "Repartidor") {
      navigate("/logistica-panel");
      return;
    } else if (rol === "admin") {
      navigate("/dashboard");
      return;
    }
    // 🔥 DECISIÓN DE FLUJO
/*     if (puedeRepartir && rol !== "Repartidor" ) {
      navigate("/seleccionar-modo");
    } */ /* else {
      navigate("/dashboard");
    }  */

  } catch (error) {
    setError(error.response?.data?.message || "Error al iniciar sesión.");
  } finally {
    setLoading(false);
  }
};


  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4">
      <div className="w-full max-w-md h-3/5 bg-white p-8 rounded-2xl shadow-lg flex flex-col justify-center">
        <h2 className="text-3xl font-bold text-green-500 mb-6 text-center">
          Iniciar Sesión
        </h2>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col justify-center h-full"
        >
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={credentials.email}
              onChange={handleChange}
              className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
              required
            />
          </div>


{/* 🔥 Campo contraseña con ojito centrado */}
<div className="mb-6 relative">
  <label className="block text-gray-700 font-medium mb-1">
    Contraseña
  </label>

  <div className="relative">
    <input
      type={showPassword ? "text" : "password"}
      name="password"
      value={credentials.password}
      autoComplete="current-password"
      onChange={handleChange}
      className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none pr-12"
      required
    />

    {/* OJITO CENTRADO */}
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute inset-y-0 right-3 flex items-center justify-center text-gray-600 hover:text-gray-800 transition"
    >
      {showPassword ? (
        <AiFillEyeInvisible size={25} />
      ) : (
        <AiFillEye size={25} />
      )}
    </button>
  </div>
</div>


          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-400 transition duration-300 text-lg font-semibold"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
