import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/userServices";
import { jwtDecode } from "jwt-decode";

function LoginForm({ setAuth }) {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await loginUser(credentials);
      localStorage.setItem("token", response.token);

      const decodedToken = jwtDecode(response.token);
      const userRole = decodedToken.rol; // 🔹 Extrae el rol del token

      setAuth({ isAuthenticated: true, rol: userRole });

      // 🔹 Redirigir según el rol
      if (userRole === "vendedor") {
        navigate("/vendedor-panel");
      }
      if (userRole === "admin") {
        navigate("/dashboard");
      }
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

    <form onSubmit={handleSubmit} className="flex flex-col justify-center h-full">
      <div className="mb-4">
        <label className="block text-gray-700 font-medium mb-1">Email</label>
        <input
          type="email"
          name="email"
          value={credentials.email}
          onChange={handleChange}
          className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
          required
        />
      </div>

      <div className="mb-6">
        <label className="block text-gray-700 font-medium mb-1">Contraseña</label>
        <input
          type="password"
          name="password"
          value={credentials.password}
          onChange={handleChange}
          className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
          required
        />
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
