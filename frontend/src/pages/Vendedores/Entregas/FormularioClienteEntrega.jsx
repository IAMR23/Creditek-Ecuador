import { useState } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const FormularioClienteEntrega = () => {
  const [formData, setFormData] = useState({
    cliente: "",
    cedula: "",
    telefono: "",
  });

  const [loading, setLoading] = useState(false);
  const [clienteCreado, setClienteCreado] = useState(null); // ⬅️ nuevo estado

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "cliente") {
      const soloTexto = value
        .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "")
        .toUpperCase();

      setFormData((prev) => ({ ...prev, [name]: soloTexto }));
      return;
    }

    // SOLO NUMEROS Y MAX 10 DIGITOS PARA CEDULA Y TELEFONO
    if (name === "cedula" || name === "telefono") {
      const soloNumeros = value.replace(/\D/g, "").slice(0, 10);
      setFormData((prev) => ({ ...prev, [name]: soloNumeros }));
      return;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/clientes`, formData);

      await Swal.fire({
        icon: "success",
        title: "Cliente registrado",
        text: `Cliente registrado: ${res.data.cliente}`,
        confirmButtonText: "Continuar",
      });

      navigate("/crear-entrega", { state: { cliente: res.data } });
    } catch (error) {
      console.error(error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al registrar el cliente",
        confirmButtonText: "Cerrar",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-lg mt-10 border border-orange-100">
      <h2 className="text-3xl font-bold text-orange-600 mb-6 text-center">
        Registrar Cliente
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* NOMBRE */}
        <div>
          <label className="block mb-1 font-semibold text-gray-700">
            Nombre del Cliente
          </label>

          <input
            type="text"
            name="cliente"
            value={formData.cliente}
            onChange={handleChange}
            inputMode="text"
            className="w-full border border-orange-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold text-gray-700">
            Cédula
          </label>

          <input
            type="text"
            name="cedula"
            value={formData.cedula}
            onChange={handleChange}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            className="w-full border border-orange-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
            required
          />
        </div>

        {/* TELEFONO */}
        <div>
          <label className="block mb-1 font-semibold text-gray-700">
            Teléfono
          </label>

          <input
            type="text"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            className="w-full border border-orange-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
            required
          />
        </div>

        {/* BOTON */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-orange-600 text-white font-semibold py-3 rounded-lg shadow-md hover:bg-orange-700 transition active:scale-95 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? "Registrando..." : "Registrar Cliente"}
        </button>
      </form>
    </div>
  );
};

export default FormularioClienteEntrega;
