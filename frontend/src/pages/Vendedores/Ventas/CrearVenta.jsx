import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { jwtDecode } from "jwt-decode";

const CrearVenta = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const cliente = location.state?.cliente;

  const hoy =  new Date().toLocaleDateString("en-CA");

  const [formData, setFormData] = useState({
    usuarioAgenciaId: "",
    clienteId: cliente?.id || "",
    origenId: "",
    VentaObsequioId: "",
    observacion: "",
    fecha: hoy, // <-- FECHA
  });

  const [loading, setLoading] = useState(false);
  const [origenes, setOrigenes] = useState([]);
  const [usuarioInfo, setUsuarioInfo] = useState(null);

  // Cargar usuario del token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUsuarioInfo(decoded.usuario);
      } catch (error) {
        console.error("Error decodificando token:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (usuarioInfo?.agenciaPrincipal?.usuarioAgenciaId) {
      setFormData((prev) => ({
        ...prev,
        usuarioAgenciaId: usuarioInfo.agenciaPrincipal.usuarioAgenciaId,
      }));
    }
  }, [usuarioInfo]);

  // Cargar datos iniciales
  useEffect(() => {
    if (!cliente) {
      Swal.fire({
        icon: "warning",
        title: "Cliente no encontrado",
        text: "Debe registrar un cliente primero",
        confirmButtonText: "Volver",
      }).then(() => navigate("/registrar-cliente"));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      clienteId: cliente.id,
    }));

    const cargarOrigenes = async () => {
      try {
        const res = await axios.get(`${API_URL}/origen`);
        setOrigenes(res.data);
      } catch (error) {
        console.error("Error al cargar orígenes:", error);
      }
    };

    cargarOrigenes();
  }, [cliente, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.usuarioAgenciaId) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo identificar la agencia del usuario",
      });
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/ventas`, formData);

      await Swal.fire({
        icon: "success",
        title: "Venta registrada",
       
        confirmButtonText: "Agregar Productos",
      });

      navigate(`/ventas/${res.data.id}/detalles`, {
        state: {
          ventaId: res.data.id,
          cliente: cliente,
        },
      });
    } catch (error) {
      console.error("Error completo:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Error al registrar la venta",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!cliente) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg mt-10 border border-green-100">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-green-600 mb-2 text-center">
          Registrar Nueva Venta
        </h2>

        {/* Información del vendedor */}
        {usuarioInfo && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-gray-500">Vendedor</p>
                <p className="font-semibold text-green-700">
                  {usuarioInfo.nombre} ({usuarioInfo.rol?.nombre})
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Agencia</p>
                <p className="font-semibold text-green-700">
                  {usuarioInfo.agenciaPrincipal?.nombre || "No asignada"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Información del cliente */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <p className="text-gray-700">
            <span className="font-semibold">Cliente:</span> {cliente.cliente}
            {cliente.cedula && (
              <span className="ml-4">
                <span className="font-semibold">Cédula:</span> {cliente.cedula}
              </span>
            )}
            {cliente.telefono && (
              <span className="ml-4">
                <span className="font-semibold">Teléfono:</span> {cliente.telefono}
              </span>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* usuarioAgenciaId */}
        <input type="hidden" name="usuarioAgenciaId" value={formData.usuarioAgenciaId} />

        {/* Fecha */}
        <div>
          <label className="block mb-2 font-semibold text-gray-700">
            Fecha de la venta *
          </label>
          <input
            type="date"
            name="fecha"
            value={formData.fecha}
            onChange={handleChange}
            className="w-full border border-green-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        {/* Origen */}
        <div>
          <label className="block mb-2 font-semibold text-gray-700">
            Origen de la venta *
          </label>
          <select
            name="origenId"
            value={formData.origenId}
            onChange={handleChange}
            className="w-full border border-green-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
            required
          >
            <option value="">Seleccionar origen...</option>
            {origenes.map((origen) => (
              <option key={origen.id} value={origen.id}>
                {origen.nombre || `Origen #${origen.id}`}
              </option>
            ))}
          </select>
        </div>

        {/* Observación */}
        <div>
          <label className="block mb-2 font-semibold text-gray-700">
            Observación (opcional)
          </label>
          <textarea
            name="observacion"
            value={formData.observacion}
            onChange={handleChange}
            className="w-full border border-green-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-500"
            rows="3"
            placeholder="Notas adicionales..."
          />
        </div>

        {/* Botones */}
        <div className="flex gap-4 pt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-300"
          >
            Volver
          </button>

          <button
            type="submit"
            disabled={loading || !formData.usuarioAgenciaId}
            className={`flex-1 bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 ${
              loading || !formData.usuarioAgenciaId ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Registrando..." : "Registrar Venta y Agregar Productos"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CrearVenta;
