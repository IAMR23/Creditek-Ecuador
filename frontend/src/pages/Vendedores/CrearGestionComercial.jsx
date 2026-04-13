import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import { FaSave } from "react-icons/fa";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

export default function CrearGestionComercial() {
  const navigate = useNavigate();

  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [dispositivos, setDispositivos] = useState([]);
  const [origenes, setOrigenes] = useState([]);

  const [form, setForm] = useState({
    usuarioAgenciaId: "",
    celularGestionado: "",
    cedulaGestionado: "",
    dispositivoId: "",
    solicitud: "NINGUNA",
    origen: "",
    observacion: "",
  });

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
      console.error("Error decodificando token:", error);
    }
  }, []);

  useEffect(() => {
    const obtenerDispositivos = async () => {
      try {
        const res = await axios.get(`${API_URL}/dispositivos`);
        setDispositivos(res.data);
      } catch (error) {
        console.error("Error obteniendo dispositivos:", error);
        Swal.fire("Error", "No se pudieron cargar los dispositivos", "error");
      }
    };

    obtenerDispositivos();
  }, []);

  useEffect(() => {
    const obtenerOrigenes = async () => {
      try {
        const res = await axios.get(`${API_URL}/origen`);
        setOrigenes(res.data);
      } catch (error) {
        console.error("Error obteniendo orígenes:", error);
        Swal.fire("Error", "No se pudieron cargar los orígenes", "error");
      }
    };

    obtenerOrigenes();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    const numericValue = value.replace(/\D/g, "");

    if (numericValue.length <= 10) {
      setForm((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.usuarioAgenciaId) {
      return Swal.fire({
        icon: "warning",
        title: "Usuario inválido",
        text: "No se pudo identificar el usuario agencia.",
      });
    }

    if (form.celularGestionado.length !== 10) {
      return Swal.fire({
        icon: "warning",
        title: "Celular inválido",
        text: "El celular debe tener exactamente 10 dígitos numéricos.",
      });
    }

    if (form.cedulaGestionado && form.cedulaGestionado.length !== 10) {
      return Swal.fire({
        icon: "warning",
        title: "Cédula inválida",
        text: "La cédula debe tener exactamente 10 dígitos numéricos.",
      });
    }

    if (!form.dispositivoId) {
      return Swal.fire({
        icon: "warning",
        title: "Dispositivo requerido",
        text: "Debe seleccionar un dispositivo.",
      });
    }

    if (!form.origen) {
      return Swal.fire({
        icon: "warning",
        title: "Origen requerido",
        text: "Debe seleccionar un origen.",
      });
    }

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
        usuarioAgenciaId: Number(form.usuarioAgenciaId),
        celularGestionado: form.celularGestionado,
        cedulaGestionado: form.cedulaGestionado || null,
        dispositivoId: form.dispositivoId ? Number(form.dispositivoId) : null,
        solicitud: form.solicitud || "NINGUNA",
        origen: form.origen,
        observacion: form.observacion || null,
      };

      Swal.fire({
        title: "Guardando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await axios.post(`${API_URL}/api/gestion-comercial`, payload);

      await Swal.fire({
        icon: "success",
        title: "Gestión creada",
        confirmButtonColor: "#16a34a",
      });

      navigate("/vendedor-panel");
    } catch (error) {
      console.error("Error guardando gestión:", error);

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
            <div>
              <p className="text-lg font-bold text-green-500">
                {usuarioInfo.nombre}
              </p>
            </div>

            <div className="md:text-right">
              <p className="text-sm font-medium">Agencia</p>
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
        <h1 className="text-2xl font-bold">Crear Gestión Comercial</h1>

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
                onChange={handleNumericChange}
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                required
                className="w-full border border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-xl px-4 py-2 outline-none transition"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">
                Cédula Gestionado
              </label>

              <input
                type="text"
                name="cedulaGestionado"
                value={form.cedulaGestionado}
                onChange={handleNumericChange}
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                className="w-full border border-gray-300 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-xl px-4 py-2 outline-none transition"
              />
            </div>
          </div>
        </div>

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
                <option value="NINGUNA">NINGUNA</option>
                <option value="APROBADO">APROBADO</option>
                <option value="DENEGADO">DENEGADO</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
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
                {origenes.map((o) => (
                  <option key={o.id} value={o.nombre}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600">
            Observación
          </label>

          <textarea
            name="observacion"
            value={form.observacion}
            onChange={handleChange}
            placeholder="Observación"
            rows={4}
            className="w-full border border-gray-300 rounded-xl px-4 py-2 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 transition"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-green-700 transition"
          >
            <FaSave />
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}