import { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { API_URL } from "../../../../config";
import axios from "axios";
import imageCompression from "browser-image-compression";

export default function FotoFechaHoraEntrega() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cliente = location.state?.cliente;

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fechaHora, setFechaHora] = useState(""); // ← NUEVO
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const handlePaste = (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            setFoto(file);
            setPreview(URL.createObjectURL(file));
            setMsg("📋 Imagen pegada desde el portapapeles");
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // 👉 Seleccionar foto
  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // 👉 Enviar datos
  const handleEnviar = async () => {
    if (!foto) {
      setMsg("Selecciona o toma una foto primero");
      return;
    }

    if (!fechaHora) {
      setMsg("Debes ingresar la fecha y hora de la llamada.");
      return;
    }

    try {
      setLoading(true);
      setMsg("Comprimiendo imagen...");

      const options = {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };

      const imagenComprimida = await imageCompression(foto, options);

      const formData = new FormData();
      formData.append("foto", imagenComprimida);
      formData.append("FechaHoraLlamada", fechaHora); // ← SE ENVÍA FECHA + HORA

      setMsg("Subiendo...");

      await axios.put(
        `${API_URL}/entregas/entrega/${id}/fechaRespaldo`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setMsg("Entrega validada correctamente ✔");
      navigate(`/entregas/${id}/obsequios`);
    } catch (err) {
      console.error(err);
      setMsg("❌ Error al enviar los datos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="p-4 mb-6 bg-orange-50 border border-orange-200 rounded-lg">
        <h1 className="text-2xl font-bold text-orange-600">
          Validación de Llamada
        </h1>
        {cliente && (
          <p className="text-gray-700 mt-1">
            Cliente: <span className="font-semibold">{cliente.cliente}</span>
          </p>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow border border-orange-500">
        {/* FECHA Y HORA */}
        <h2 className="text-lg font-semibold text-orange-600 mb-2">
          Fecha y hora de la llamada
        </h2>

        <input
          type="datetime-local"
          value={fechaHora}
          onChange={(e) => setFechaHora(e.target.value)}
          required
          className="w-full mb-6 p-2 border rounded"
        />

        <h2 className="text-lg font-semibold text-orange-600 mb-4">
          Toma o selecciona una foto
        </h2>

        {preview ? (
          <img
            src={preview}
            alt="preview"
            className="w-full rounded-lg mb-4 border"
          />
        ) : (
          <div className="w-full h-64 bg-gray-100 rounded-lg flex flex-col justify-center items-center text-gray-400 border border-dashed border-gray-400 text-center px-4">
            <p className="font-medium">Pega una imagen aquí</p>
            <p className="text-sm mt-1">(Ctrl + V)</p>
          </div>
        )}

        {/* INPUT DE FOTO */}
        <label className="block mt-4">
          <span className="text-orange-600 font-semibold">Elegir foto:</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFoto}
            className="block mt-2"
          />
        </label>

        {/* BOTÓN */}
        <button
          onClick={handleEnviar}
          disabled={loading}
          className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg"
        >
          {loading ? "Procesando..." : "Validar Entrega"}
        </button>

        {msg && (
          <p className="text-center mt-3 text-orange-700 font-medium">{msg}</p>
        )}

        <button
          onClick={() => navigate(-1)}
          className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
