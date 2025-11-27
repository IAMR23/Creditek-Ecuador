import { useState } from "react";
import { createDepartamento } from "../services/departamentServices";

function DepartamentoForm() {
  const [formData, setFormData] = useState({
    titulo: "",
    descripcion: "",
    precio: "",
    ubicacion: "",
    habitaciones: "",
    caracteristicas: "",
    condiciones: "",
  });

  const [fotos, setFotos] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);

    if (files.length + fotos.length > 3) {
      setError("Solo puedes subir un máximo de 3 imágenes.");
      return;
    }

    setFotos((prevFotos) => [...prevFotos, ...files]);
    setPreviewUrls((prevUrls) => [
      ...prevUrls,
      ...files.map((file) => URL.createObjectURL(file)),
    ]);
    setError(null);
  };

  const handleRemoveImage = (index) => {
    setFotos((prevFotos) => prevFotos.filter((_, i) => i !== index));
    setPreviewUrls((prevUrls) => prevUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value);
      });

      fotos.forEach((file) => {
        formDataToSend.append("fotos", file);
      });

      await createDepartamento(formDataToSend);
      setSuccess("Departamento registrado exitosamente.");

      setFormData({
        titulo: "",
        descripcion: "",
        precio: "",
        ubicacion: "",
        habitaciones: "",
        caracteristicas: "",
        condiciones: "",
      });
      setFotos([]);
      setPreviewUrls([]);
    } catch (error) {
      setError(
        error.response?.data?.message || "Error al registrar el departamento."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold text-green-500 mb-6 text-center">Registrar Departamento</h2>
      
      {error && <p className="text-red-500 text-center mb-4">{error}</p>}
      {success && <p className="text-green-500 text-center mb-4">{success}</p>}

      <form onSubmit={handleSubmit}>
        {[
          { label: "Título", name: "titulo", type: "text" },
          { label: "Descripción", name: "descripcion", type: "textarea" },
          { label: "Precio", name: "precio", type: "number" },
          { label: "Ubicación", name: "ubicacion", type: "text" },
          { label: "Número de Habitaciones", name: "habitaciones", type: "number" },
          { label: "Características (separadas por coma)", name: "caracteristicas", type: "text" },
        ].map(({ label, name, type }) => (
          <div key={name} className="mb-4">
            <label className="block text-gray-700 font-medium mb-1">{label}</label>
            {type === "textarea" ? (
              <textarea
                name={name}
                value={formData[name]}
                onChange={handleChange}
                className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
                required
              />
            ) : (
              <input
                type={type}
                name={name}
                value={formData[name]}
                onChange={handleChange}
                className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
                required
              />
            )}
          </div>
        ))}

        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-1">Condiciones</label>
          <textarea
            name="condiciones"
            value={formData.condiciones}
            onChange={handleChange}
            className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
            required
          />
        </div>

        {/* Input de archivos */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-1">Subir Fotos (Máx: 3 JPG)</label>
          <input
            type="file"
            accept="image/jpeg"
            multiple
            onChange={handleFileChange}
            className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
          />
        </div>

        {/* Vista previa de imágenes */}
        {previewUrls.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#383673]">Vista previa:</h3>
            <div className="flex justify-center gap-4 mt-2">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Vista previa ${index + 1}`}
                    className="w-40 h-40 object-cover rounded-lg shadow-md"
                  />
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full text-xs hover:bg-red-700 transition"
                    onClick={() => handleRemoveImage(index)}
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-400 transition duration-300 text-lg font-semibold"
          disabled={loading}
        >
          {loading ? "Registrando..." : "Registrar"}
        </button>
      </form>
    </div>
  );
}

export default DepartamentoForm;
