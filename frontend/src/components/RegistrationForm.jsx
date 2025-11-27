import { useState } from "react";
import { registerUser } from "../services/userServices";

function RegistrationForm() {
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: "",
    role: "arrendatario",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await registerUser(formData);
      setSuccess("Usuario registrado exitosamente.");
      setFormData({
        nombre: "",
        email: "",
        password: "",
        role: "arrendatario",
      }); // Limpiar formulario
    } catch (error) {
      setError(error.response?.data?.message || "Error al registrar usuario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
        <h2 className="text-3xl font-bold text-green-500 mb-6 text-center">
          Registro de Usuario
        </h2>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        {success && <p className="text-green-500 text-center mb-4">{success}</p>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-1">Nombre</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-1">Contraseña</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-1">Tipo de usuario</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
            >
              <option value="arrendatario">Arrendatario</option>
              <option value="arrendador">Arrendador</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-400 transition duration-300 text-lg font-semibold"
            disabled={loading}
          >
            {loading ? "Registrando..." : "Registrarse"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default RegistrationForm;
