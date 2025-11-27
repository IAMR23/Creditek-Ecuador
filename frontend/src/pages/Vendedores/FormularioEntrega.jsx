import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const FormularioEntrega = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Obtenemos el cliente pasado desde navigate
  const cliente = location.state?.cliente;

  // Si no hay cliente (usuario entró directo a /registrar-entregas)
  if (!cliente) {
    navigate("/registrar-clientes");
    return null;
  }

  console.log(cliente);

  // Ahora puedes usar "cliente" como antes
  const [formData, setFormData] = useState({
    contrato: "",
    origen: "",
    valor_entrada: 0,
    valor_alcance: 0,
    ubicacion: "",
    ubicacion_dispositivo: "",
    obsequios: "",
    observacion: "",
    estado: "pendiente",
    clienteId: cliente.id,
    productoId: "",
    usuarioAgenciaId: "",
  });

  const [user, setUser] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Si NO hay token, redirigir aunque el usuario vuelva hacia atrás
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      setUser(decoded);
    }
  }, []);

  useEffect(() => {
    if (user && user.usuarioAgenciaId) {
      setFormData((prev) => ({
        ...prev,
        usuarioAgenciaId: user.usuarioAgenciaId,
      }));
    }
  }, [user]);

  const [loading, setLoading] = useState(false);

  // PRODUCTOS
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loadingProductos, setLoadingProductos] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const buscarProductos = async () => {
    if (!busqueda.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Ingrese un texto",
        text: "Debes escribir algo para realizar la búsqueda.",
        confirmButtonColor: "#f59e0b",
      });
      return;
    }

    setLoadingProductos(true);

    try {
      // Loader mientras busca
      Swal.fire({
        title: "Buscando productos...",
        html: "Espere un momento",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await axios.get(`${API_URL}/productos?filtro=${busqueda}`);
      setProductos(res.data);

      Swal.close(); // Cierra el loader

      if (res.data.length === 0) {
        Swal.fire({
          icon: "info",
          title: "Sin resultados",
          text: "No se encontraron productos con ese filtro.",
          confirmButtonColor: "#3b82f6",
        });
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error al buscar",
        text: "Hubo un problema al obtener los productos.",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setLoadingProductos(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Mostrar loader
      Swal.fire({
        title: "Guardando...",
        text: "Por favor espera un momento",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await axios.post(`${API_URL}/entregas`, formData);

      // Éxito
      await Swal.fire({
        icon: "success",
        title: "Entrega registrada 🎉",
        text: "La entrega se guardó correctamente",
        confirmButtonColor: "#2563eb",
      });

      navigate("/vendedor-panel");
    } catch (error) {
      console.error(error);

      Swal.fire({
        icon: "error",
        title: "Ocurrió un problema",
        text:
          error.response?.data?.message || "No se pudo registrar la entrega.",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-xl mt-10 border border-gray-200">
      {/* HEADER */}
      <h2 className="text-3xl font-extrabold mb-6 bg-gradient-to-r from-green-600 to-indigo-600 text-transparent bg-clip-text">
        Registrar Entrega
      </h2>

      {/* DATOS DEL CLIENTE */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-50 to-indigo-50 border border-green-200 shadow-sm">
        <p className="text-gray-700 font-semibold text-lg mb-1">
          Información del Cliente:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <span className="font-medium text-green-700">
            👤 {cliente.cliente}
          </span>
          <span className="font-medium text-green-700">🪪 {cliente.cedula}</span>
          <span className="font-medium text-green-700">
            📞 {cliente.telefono}
          </span>
        </div>
      </div>

      {/* FORMULARIO */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* BUSCADOR */}
        <div className="col-span-2">
          <label className="font-semibold text-gray-700 text-sm">
            Buscar Producto
          </label>

          <div className="flex gap-3 mt-1">
            <input
              type="text"
              placeholder="Ej: CORBATA"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-green-400"
            />

            <button
              type="button"
              onClick={buscarProductos}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition"
            >
              Buscar
            </button>
          </div>

          {loadingProductos ? (
            <p className="text-sm text-gray-500 mt-2">Buscando productos...</p>
          ) : productos.length > 0 ? (
            <select
              name="productoId"
              value={formData.productoId}
              onChange={handleChange}
              className="w-full border mt-3 rounded-lg px-4 py-2 shadow-sm"
              required
            >
              <option value="">Seleccione un producto</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {p.codigo}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500 mt-2">No hay productos</p>
          )}
        </div>

        {/* RESTO DE CAMPOS (MISMA LÓGICA, MEJOR ESTILO) */}
        {[
          ["Contrato", "contrato"],
          ["Origen", "origen"],
          ["Valor Entrada", "valor_entrada", "number"],
          ["Valor Alcance", "valor_alcance", "number"],
          ["Ubicación", "ubicacion"],
          ["Ubicación Dispositivo", "ubicacion_dispositivo"],
        ].map(([label, name, type = "text"]) => (
          <div key={name}>
            <label className="block mb-1 font-medium text-gray-700">
              {label}
            </label>
            <input
              type={type}
              name={name}
              value={formData[name]}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 shadow-sm focus:ring-2 focus:ring-green-400"
            />
          </div>
        ))}

        {/* OBSEQUIOS */}
        <div className="col-span-2">
          <label className="block mb-1 font-medium text-gray-700">
            Obsequios
          </label>
          <input
            type="text"
            name="obsequios"
            value={formData.obsequios}
            onChange={handleChange}
            className="w-full border rounded-xl px-4 py-2 shadow-sm"
          />
        </div>

        {/* OBSERVACION */}
        <div className="col-span-2">
          <label className="block mb-1 font-medium text-gray-700">
            Observación
          </label>
          <textarea
            name="observacion"
            value={formData.observacion}
            onChange={handleChange}
            rows="3"
            className="w-full border rounded-xl px-4 py-2 shadow-sm"
          ></textarea>
        </div>

        {/* BOTON */}
        <button
          type="submit"
          disabled={loading}
          className={`col-span-2 w-full py-3 rounded-xl font-bold text-white text-lg shadow-lg transition
        bg-gradient-to-r from-green-600 to-indigo-600 hover:from-green-700 hover:to-indigo-700 
        ${loading ? "opacity-60 cursor-not-allowed" : ""}
      `}
        >
          {loading ? "Guardando..." : "Registrar Entrega"}
        </button>
      </form>
    </div>
  );
};

export default FormularioEntrega;
