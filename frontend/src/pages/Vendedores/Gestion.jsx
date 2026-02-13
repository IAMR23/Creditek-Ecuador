import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import { FaPlus, FaSave, FaTrash } from "react-icons/fa";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

export default function Gestion() {
  const navigate = useNavigate();

  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [dispositivos, setDispositivos] = useState([]);

  const [form, setForm] = useState({
    usuarioAgenciaId: "",
    celularGestionado: "",
    cedulaGestionado: "",
    extension: "",
    dispositivoId: "",
    solicitud: "",
    origen: "",
    region: "",
    accion: "",
    observacion: "",
  });

  const [otrasCedulas, setOtrasCedulas] = useState([""]);

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
        usuarioAgenciaId:
          decoded.usuario?.agenciaPrincipal?.usuarioAgenciaId || "",
      }));
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const obtenerDispositivos = async () => {
      try {
        const res = await axios.get(`${API_URL}/dispositivos`);
        setDispositivos(res.data);
      } catch (error) {
        console.error("Error obteniendo dispositivos:", error);
      }
    };

    obtenerDispositivos();
  }, []);

  /* ==============================
      MANEJO GENERAL
  ============================== */
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  /* ==============================
      MANEJO OTRAS CEDULAS
  ============================== */
  const handleCedulaChange = (index, value) => {
    const nuevas = [...otrasCedulas];
    nuevas[index] = value;
    setOtrasCedulas(nuevas);
  };

  const agregarCedula = () => {
    setOtrasCedulas([...otrasCedulas, ""]);
  };

  const eliminarCedula = (index) => {
    const nuevas = otrasCedulas.filter((_, i) => i !== index);
    setOtrasCedulas(nuevas);
  };

  /* ==============================
      SUBMIT
  ============================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await Swal.fire({
      title: "¿Confirmar gestión?",
      text: "Se registrará la gestión en el sistema.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    });

    if (!result.isConfirmed) return;

    try {
      const payload = {
        ...form,
        usuarioAgenciaId: Number(form.usuarioAgenciaId),
        dispositivoId: form.dispositivoId ? Number(form.dispositivoId) : null,
        otrasCedulas:
          form.accion === "OTRA_CEDULA"
            ? otrasCedulas.filter((c) => c.trim() !== "")
            : null,
      };

      Swal.fire({
        title: "Guardando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await axios.post(`${API_URL}/api/gestion`, payload);

      await Swal.fire({
        icon: "success",
        title: "Gestión creada",
        confirmButtonColor: "#16a34a",
      });

      navigate("/vendedor-panel");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Ocurrió un error al guardar.",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      
            {usuarioInfo && (
        <div className="mb-6 p-5 bg-gradient-to-r from-green-50 to-white border border-green-200 rounded-xl shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Columna izquierda */}
            <div>
              <p className="text-lg font-bold text-green-500">
                {usuarioInfo.nombre}
              </p>
            </div>

            {/* Columna derecha */}
            <div className="md:text-right">
              <p className="text-sm font-medium ">Agencia</p>
              <p className="text-base font-semibold text-green-500">
                {usuarioInfo.agenciaPrincipal?.nombre}
              </p>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
      >
        <h1 className="text-2xl font-bold">Crear Gestión</h1>

        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">
            Información del Cliente
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">
                Celular Gestionado *
              </label>
              <input
                type="text"
                name="celularGestionado"
                value={form.celularGestionado}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-xl px-4 py-2 outline-none transition"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">
                Cédula Gestionado *
              </label>
              <input
                type="text"
                name="cedulaGestionado"
                value={form.cedulaGestionado}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-xl px-4 py-2 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* ================== EXTENSIÓN ================== */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">
            Extensión
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              "8179",
              "1986",
              "7520 (Uphone)",
              "9300",
              "6408",
              "9815",
              "1048",
            ].map((ext) => (
              <label
                key={ext}
                className={`flex items-center justify-center border rounded-xl px-3 py-2 cursor-pointer transition text-sm font-medium
          ${
            form.extension === ext
              ? "border-green-600 bg-green-50 text-green-700"
              : "border-gray-300 hover:border-green-400"
          }`}
              >
                <input
                  type="radio"
                  name="extension"
                  value={ext}
                  checked={form.extension === ext}
                  onChange={handleChange}
                  className="hidden"
                  required
                />
                {ext}
              </label>
            ))}
          </div>
        </div>

        {/* ================== CONFIGURACIÓN ================== */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">
            Configuración
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">
                Dispositivo *
              </label>
              <select
                name="dispositivoId"
                value={form.dispositivoId}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-xl px-4 py-2 outline-none transition"
              >
                <option value="">Seleccionar</option>
                {dispositivos.map((dispositivo) => (
                  <option key={dispositivo.id} value={dispositivo.id}>
                    {dispositivo.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">
                Solicitud *
              </label>
              <select
                name="solicitud"
                value={form.solicitud}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-xl px-4 py-2 outline-none transition"
              >
                <option value="">Seleccionar</option>
                <option value="APROBADO">APROBADO</option>
                <option value="DENEGADO">DENEGADO</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">
                Origen *
              </label>
              <select
                name="origen"
                value={form.origen}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-xl px-4 py-2 outline-none transition"
              >
                <option value="">Seleccionar</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="MESSENGER">MESSENGER</option>
                <option value="DIFUSIONES">DIFUSIONES</option>
                <option value="BASE_DE_DATOS">BASE DE DATOS</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">
                Región *
              </label>
              <select
                name="region"
                value={form.region}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-xl px-4 py-2 outline-none transition"
              >
                <option value="">Seleccionar</option>
                <option value="COSTA">COSTA</option>
                <option value="SIERRA">SIERRA</option>
                <option value="ORIENTE">ORIENTE</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <label className="font-medium text-gray-700">Acción *</label>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { value: "VENTA", label: "VENTA" },
                { value: "ENTREGA", label: "ENTREGA" },
                { value: "VOLVER_A_LLAMAR", label: "VOLVER A LLAMAR" },
                { value: "REGESTION", label: "REGESTIÓN" },
                { value: "NO_CONTESTA", label: "NO CONTESTA" },
                { value: "OTRA_CEDULA", label: "OTRA CÉDULA" },
              ].map((op) => (
                <label
                  key={op.value}
                  className={`flex items-center gap-2 border rounded-xl px-3 py-2 cursor-pointer transition
        ${
          form.accion === op.value
            ? "border-green-600 bg-green-50"
            : "border-gray-300"
        }`}
                >
                  <input
                    type="radio"
                    name="accion"
                    value={op.value}
                    checked={form.accion === op.value}
                    onChange={handleChange}
                    className="accent-green-600"
                    required
                  />
                  <span className="text-sm">{op.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* CAMPO DINÁMICO */}
        {form.accion === "OTRA_CEDULA" && (
          <div className="space-y-4 border p-4 rounded-xl bg-gray-50">
            <p className="font-medium text-gray-700">Agregar otras cédulas</p>

            {otrasCedulas.map((cedula, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={cedula}
                  onChange={(e) => handleCedulaChange(index, e.target.value)}
                  placeholder="Nueva cédula"
                  className="flex-1 border rounded-xl px-4 py-2"
                />

                <button
                  type="button"
                  onClick={agregarCedula}
                  className="bg-green-600 text-white px-3 rounded-xl"
                >
                  <FaPlus />
                </button>

                {otrasCedulas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => eliminarCedula(index)}
                    className="bg-red-500 text-white px-3 rounded-xl"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <textarea
          name="observacion"
          placeholder="Observación"
          onChange={handleChange}
          className="w-full border rounded-xl px-4 py-2"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-3 rounded-xl"
          >
            <FaSave/> 
          </button>
        </div>
      </form>
    </div>
  );
}
