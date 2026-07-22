/* eslint-disable react/prop-types */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/userServices";
import { jwtDecode } from "jwt-decode";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { useTaskNotifications } from "../context/TaskNotificationContext";
import { getDefaultRoute } from "../utils/getDefaultRoute";
import { setAccessToken } from "../api/client";

function LoginForm({ setAuth }) {
  const [credentials, setCredentials] = useState({
    identificador: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [rolesDisponibles, setRolesDisponibles] = useState([]);
  const [rolSeleccionado, setRolSeleccionado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { reloadPendingTasks } = useTaskNotifications();
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
    setRolesDisponibles([]);
    setRolSeleccionado("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await loginUser({
        ...credentials,
        ...(rolSeleccionado ? { rolId: rolSeleccionado } : {}),
      });

      if (response.requiresRoleSelection) {
        setRolesDisponibles(response.roles || []);
        setRolSeleccionado("");
        return;
      }

      const token = response.accessToken || response.token;
      if (!token) {
        throw new Error("El backend no devolvio access token.");
      }

      setAccessToken(token);
      reloadPendingTasks();
      const decodedToken = jwtDecode(token);

      const permisos = decodedToken.usuario?.permisosAsignados || [];
      const rol = decodedToken.usuario?.rol?.nombre;

      setAuth({
        isAuthenticated: true,
        rol,
        permisos,
        usuario: decodedToken.usuario || null,
        token,
      });

      navigate(
        getDefaultRoute({
          rol,
          permisos,
          activeMode: localStorage.getItem("activeMode"),
        }),
        { replace: true },
      );
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
              Correo o usuario
            </label>
            <input
              type="text"
              name="identificador"
              autoComplete="username"
              value={credentials.identificador}
              onChange={handleChange}
              placeholder="correo@empresa.com o usuario"
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

          {rolesDisponibles.length > 0 && (
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-1">
                Rol de ingreso
              </label>
              <select
                value={rolSeleccionado}
                onChange={(e) => setRolSeleccionado(e.target.value)}
                className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
                required
              >
                <option value="">Selecciona un rol</option>
                {rolesDisponibles.map((rol) => (
                  <option key={rol.id} value={rol.id}>
                    {rol.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-400 transition duration-300 text-lg font-semibold"
            disabled={loading}
          >
            {loading
              ? "Ingresando..."
              : rolesDisponibles.length > 0
                ? "Ingresar con rol"
                : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
