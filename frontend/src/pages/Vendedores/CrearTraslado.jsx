import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import { FaPlus, FaTrash } from "react-icons/fa";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

export default function CrearTraslado() {
  const [form, setForm] = useState({
    estado: "Pendiente",
    usuario_agencia_id: "",
    agencia_destino_id: "",
    agencia_origen_id: "",
  });

  const [agencias, setAgencias] = useState([]);

  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [dispositivoMarcas, setDispositivoMarcas] = useState([]);

  const [detalles, setDetalles] = useState([
    {
      cantidad: 1,
      dispositivoMarcaId: "",
      modeloId: "",
      modelo: [],
    },
  ]);

  const navigate = useNavigate();
  useEffect(() => {
    obtenerAgencias();
  }, []);

  const obtenerAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const agenciasOrigen = agencias.filter(
    (a) => a.id !== Number(form.agencia_destino_id),
  );

  const agenciasDestino = agencias.filter(
    (a) => a.id !== Number(form.agencia_origen_id),
  );

  useEffect(() => {
    const fetchSelects = async () => {
      try {
        const res = await axios.get(`${API_URL}/dispositivoMarca`);
        setDispositivoMarcas(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchSelects();
  }, []);

  /* ==============================
      DECODIFICAR TOKEN
  ============================== */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      setUsuarioInfo(decoded.usuario);

      setForm((prev) => ({
        ...prev,
        usuario_agencia_id:
          decoded.usuario?.agenciaPrincipal?.usuarioAgenciaId || "",
      }));
    } catch (error) {
      console.error("Error decodificando token:", error);
    }
  }, []);

  /* ==============================
      MANEJO FORM GENERAL
  ============================== */
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleDetalleChange = (index, field, value) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index][field] = value;
    setDetalles(nuevosDetalles);
  };

  const agregarDetalle = () => {
    setDetalles([
      ...detalles,
      {
        cantidad: 1,
        dispositivoMarcaId: "",
         modeloId: "", 
        modelos: [],
      },
    ]);
  };

  const eliminarDetalle = (index) => {
    const nuevosDetalles = detalles.filter((_, i) => i !== index);
    setDetalles(nuevosDetalles);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Confirmación antes de enviar
    const result = await Swal.fire({
      title: "¿Confirmar traslado?",
      text: "Se registrará el traslado entre agencias.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      const payload = {
        ...form,
        usuario_agencia_id: Number(form.usuario_agencia_id),
        agencia_destino_id: Number(form.agencia_destino_id),
        agencia_origen_id: Number(form.agencia_origen_id),
        detalles: detalles.map((d) => ({
          cantidad: Number(d.cantidad),
          dispositivoMarcaId: Number(d.dispositivoMarcaId),
          modeloId: Number(d.modeloId),
        })),
      };

      // Loading modal
      Swal.fire({
        title: "Guardando...",
        text: "Creando traslado en el sistema",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const res = await axios.post(`${API_URL}/api/traslados`, payload);

      await Swal.fire({
        icon: "success",
        title: "Traslado creado",
        text: "El traslado se registró correctamente.",
        confirmButtonColor: "#16a34a",
      });

      console.log(res.data);
      navigate("/vendedor-panel");
    } catch (error) {
      console.error(error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error.response?.data?.message ||
          "Ocurrió un error al crear el traslado.",
        confirmButtonColor: "#dc2626",
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* HEADER USUARIO */}
      {usuarioInfo && (
        <div className="mb-6 p-5 bg-gradient-to-r  to-white border border-green-500 rounded-xl shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Columna izquierda */}
            <div>
              <p className="text-lg font-semibold text-green-600">
                {usuarioInfo.nombre}
              </p>
            </div>

            {/* Columna derecha */}
            <div className="md:text-right">
              <p className="text-sm font-medium ">Agencia</p>
              <p className="text-base font-semibold text-green-600">
                {usuarioInfo.agenciaPrincipal?.nombre}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TITULO */}
      <div>
        <h1 className="text-2xl font-bold ">Crear Traslado</h1>
        <p className="text-sm text-gray-500">
          Registra un traslado entre agencias con sus respectivos dispositivos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

<div className="rounded-2xl border shadow-sm p-6 space-y-6 bg-white">
  <h2 className="text-lg font-semibold text-gray-800">
    Información General
  </h2>

  <div className="grid md:grid-cols-2 gap-6">

    {/* Agencia Origen */}
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-900">
        Agencia Origen <span className="text-red-500">*</span>
      </label>

      <select
        name="agencia_origen_id"
        value={form.agencia_origen_id}
        onChange={handleChange}
        required
        className={`w-full border rounded-xl px-4 py-2 outline-none transition
          ${
            !form.agencia_origen_id
              ? "border-red-300 focus:ring-2 focus:ring-red-500"
              : "border-gray-300 focus:ring-2 focus:ring-green-500"
          }`}
      >
        <option value="">Seleccionar agencia</option>
        {agenciasOrigen?.map((agencia) => (
          <option key={agencia.id} value={agencia.id}>
            {agencia.nombre}
          </option>
        ))}
      </select>

      {!form.agencia_origen_id && (
        <p className="text-xs text-red-500">
          Este campo es obligatorio
        </p>
      )}
    </div>

    {/* Agencia Destino */}
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-900">
        Agencia Destino <span className="text-red-500">*</span>
      </label>

      <select
        name="agencia_destino_id"
        value={form.agencia_destino_id}
        onChange={handleChange}
        required
        className={`w-full border rounded-xl px-4 py-2 outline-none transition
          ${
            !form.agencia_destino_id
              ? "border-red-300 focus:ring-2 focus:ring-red-500"
              : "border-gray-300 focus:ring-2 focus:ring-green-500"
          }`}
      >
        <option value="">Seleccionar agencia</option>
        {agenciasDestino?.map((agencia) => (
          <option key={agencia.id} value={agencia.id}>
            {agencia.nombre}
          </option>
        ))}
      </select>

      {!form.agencia_destino_id && (
        <p className="text-xs text-red-500">
          Este campo es obligatorio
        </p>
      )}
    </div>

  </div>
</div>



        {/* SECCION DETALLES */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              Dispositivos
            </h2>
          </div>

          <div className="space-y-6">
            {detalles?.map((detalle, index) => (
              <div
                key={index}
                className="border rounded-xl p-6 bg-gray-200  space-y-6"
              >
                <div className="grid md:grid-cols-3 gap-6">
                  {/* CANTIDAD */}

                  {/* DISPOSITIVO MARCA */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900">
                      Dispositivo y Marca
                    </label>
                    <select
                      value={detalle.dispositivoMarcaId}
                      onChange={async (e) => {
                        const value = e.target.value;
                        handleDetalleChange(index, "dispositivoMarcaId", value);
                        handleDetalleChange(index, "modeloId", "");

                        if (value) {
                          const res = await axios.get(
                            `${API_URL}/dispositivoMarca/${value}`,
                          );

                          const nuevosDetalles = [...detalles];
                          nuevosDetalles[index].modelos = res.data;
                          setDetalles(nuevosDetalles);
                        } else {
                          const nuevosDetalles = [...detalles];
                          nuevosDetalles[index].modelos = [];
                          setDetalles(nuevosDetalles);
                        }
                      }}
                      className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                      required
                    >
                      <option value="">Seleccionar</option>
                      {dispositivoMarcas?.map((dm) => (
                        <option key={dm.id} value={dm.id}>
                          {dm.dispositivo?.nombre} - {dm.marca?.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* MODELO */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900">
                      Modelo
                    </label>
                    <select
                      value={detalle.modeloId}
                      onChange={(e) =>
                        handleDetalleChange(index, "modeloId", e.target.value)
                      }
                      disabled={!detalle.dispositivoMarcaId}
                      className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100"
                      required
                    >
                      <option value="">Seleccionar</option>
                      {detalle.modelos?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900">
                      Cantidad
                    </label>
                    <div className="space-y-2 flex justify-center items-center">
                      <input
                        type="number"
                        min="1"
                        value={detalle.cantidad}
                        onChange={(e) =>
                          handleDetalleChange(index, "cantidad", e.target.value)
                        }
                        className="w-full border rounded-xl px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none"
                        required
                      />

                      <button
                        type="button"
                        onClick={agregarDetalle}
                        className="p-3 m-3 bg-green-600 text-white rounded-xl text-sm hover:bg-green-700 transition"
                      >
                        <FaPlus />
                      </button>

                      {detalles.length > 1 && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => eliminarDetalle(index)}
                            className="bg-red-500 text-white p-3 rounded-xl text-sm hover:underline"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOTON GUARDAR */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition shadow-sm"
          >
            Crear solicitud de traslado
          </button>
        </div>
      </form>
    </div>
  );
}
