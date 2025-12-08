import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { API_URL } from "../../../../config";
import axios from "axios";
import imageCompression from "browser-image-compression";

export default function VentaFoto() {
  const { id } = useParams(); // id de venta
  const navigate = useNavigate();
  const location = useLocation();
  const cliente = location.state?.cliente;

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // 👉 Capturar foto o archivo
  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // 👉 Subir foto comprimida
  const handleEnviar = async () => {
    if (!foto) {
      setMsg("Selecciona o toma una foto primero");
      return;
    }

    try {
      setLoading(true);
      setMsg("Comprimiendo imagen...");

      // 🔥 Ajustes de compresión
      const options = {
        maxSizeMB: 0.4, // ~400 KB
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };

      // Comprimir imagen
      const imagenComprimida = await imageCompression(foto, options);

      const formData = new FormData();
      formData.append("foto", imagenComprimida);

      setMsg("Subiendo imagen...");

      await axios.put(
        `${API_URL}/ventas/venta/${id}/validar`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setMsg("Venta validada correctamente ✔");

      setTimeout(() => navigate("/ventas"), 1200);
    } catch (err) {
      console.error(err);
      setMsg("❌ Error al enviar la foto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="p-4 mb-6 bg-green-50 border border-green-200 rounded-lg">
        <h1 className="text-2xl font-bold text-green-600">
          Validación de Venta
        </h1>

        {cliente && (
          <p className="text-gray-700 mt-1">
            Cliente: <span className="font-semibold">{cliente.cliente}</span>
          </p>
        )}
      </div>

      {/* PREVIEW */}
      <div className="bg-white p-4 rounded shadow border border-green-500">
        <h2 className="text-lg font-semibold text-green-600 mb-4">
          Toma o selecciona una foto
        </h2>

        {preview ? (
          <img
            src={preview}
            alt="preview"
            className="w-full rounded-lg mb-4 border"
          />
        ) : (
          <div className="w-full h-64 bg-gray-100 rounded-lg flex justify-center items-center text-gray-400 border">
            Vista previa de la imagen
          </div>
        )}

        {/* INPUT FILE - CÁMARA */}
        <label className="block mt-4">
          <span className="text-green-600 font-semibold">Elegir foto:</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFoto}
            className="block mt-2"
          />
          <p className="text-sm text-gray-500">
            (Usa la cámara directamente o selecciona una imagen)
          </p>
        </label>

        {/* BOTÓN VALIDAR */}
        <button
          onClick={handleEnviar}
          disabled={loading}
          className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg"
        >
          {loading ? "Procesando..." : "Validar Venta"}
        </button>

        {msg && (
          <p className="text-center mt-3 text-green-700 font-medium">
            {msg}
          </p>
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
