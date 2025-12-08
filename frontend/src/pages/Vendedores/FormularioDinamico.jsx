import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { API_URL } from "../../../config";
import axios from "axios";

export default function FormularioDinamico() {
  const [user, setUser] = useState([]);
  const navigate = useNavigate();

  // PRODUCTOS
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loadingProductos, setLoadingProductos] = useState(false);

  // FORM DATA
  const [formData, setFormData] = useState({
    productoId: "",
  });

  // CAMPOS DE VENTA
  const [entrada, setEntrada] = useState(0);
  const [alcance, setAlcance] = useState(0);
  const [origen, setOrigen] = useState("");
  const [obsequios, setObsequios] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const buscarProductos = async () => {
    if (!busqueda.trim()) {
      alert("Ingrese un texto para buscar");
      return;
    }

    setLoadingProductos(true);

    try {
      const res = await axios.get(`${API_URL}/productos?filtro=${busqueda}`);
      setProductos(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingProductos(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        usuarioAgenciaId: user.usuarioAgenciaId,

        // PRODUCTO SELECCIONADO
        productoId: formData.productoId,

        entrada: parseFloat(entrada) || 0,
        alcance: parseFloat(alcance) || 0,
        origen,
        obsequios,
        activo: true,
      };

      const res = await fetch(`${API_URL}/venta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.message || "Error al registrar la venta",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Venta creada 🎉",
        text: "La venta fue registrada correctamente",
        confirmButtonColor: "#2563eb",
      });

      // RESET DEL FORMULARIO
      setFormData({ productoId: "" });
      setProductos([]);
      setBusqueda("");

      setEntrada(0);
      setAlcance(0);
      setOrigen("");
      setObsequios("");

      navigate("/vendedor-panel");
    } catch (error) {
      console.error("Error al enviar venta:", error);

      Swal.fire({
        icon: "error",
        title: "Error inesperado",
        text: "No se pudo enviar la venta. Revisa la consola.",
      });
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto mt-8 p-6 bg-white rounded-xl shadow-lg border">
      <h2 className="text-2xl font-bold text-center mb-6">
        Gestiona tu Venta
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="col-span-2">
          <label className="block mb-1 font-medium">Producto</label>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Honor"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="flex-1 border rounded px-3 py-2"
            />

            <button
              type="button"
              onClick={buscarProductos}
              className="bg-green-600 text-white px-4 rounded hover:bg-green-700"
            >
              Buscar
            </button>
          </div>

          {loadingProductos ? (
            <p className="text-sm text-gray-500">Buscando productos...</p>
          ) : productos.length > 0 ? (
            <select
              name="productoId"
              value={formData.productoId}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2"
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
            <p className="text-sm text-gray-500">No hay productos</p>
          )}
        </div>

        {/* CAMPOS */}
        <div className="space-y-4 animate-fadeIn">
          <div>
            <label className="block mb-1 font-medium">Entrada</label>
            <input
              type="number"
              step="0.01"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              className="w-full p-3 border rounded-lg"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Alcance</label>
            <input
              type="number"
              step="0.01"
              value={alcance}
              onChange={(e) => setAlcance(e.target.value)}
              className="w-full p-3 border rounded-lg"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Origen</label>
            <input
              type="text"
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="w-full p-3 border rounded-lg"
              placeholder="Origen del producto"
              required
            />
          </div>

          <div>
            <label className="block mb-1 font-medium">Obsequios</label>
            <input
              type="text"
              value={obsequios}
              onChange={(e) => setObsequios(e.target.value)}
              className="w-full p-3 border rounded-lg"
              placeholder="Obsequios incluidos"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 mt-4"
          >
            Enviar Formulario
          </button>
        </div>

        <div className="p-4 mt-4 bg-green-50 border border-green-300 rounded-lg animate-fadeIn">
          <h3 className="font-semibold mb-2">Resumen Seleccionado</h3>

          {/* PRODUCTO */}
          {productos.length > 0 &&
            formData.productoId &&
            (() => {
              const prod = productos.find((p) => p.id == formData.productoId);
              return prod ? (
                <p>
                  📦 <b>Producto:</b> {prod.nombre} — {prod.codigo}
                </p>
              ) : null;
            })()}

          <p>
            📌 <b>Entrada:</b> {entrada}
          </p>
          <p>
            📌 <b>Alcance:</b> {alcance}
          </p>
          <p>
            📌 <b>Origen:</b> {origen}
          </p>
          <p>
            📌 <b>Obsequios:</b> {obsequios}
          </p>
        </div>
      </form>
    </div>
  );
}
