import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { obtenerDepartamento, updateDepartament } from "../services/departamentServices";

function DetallesDepartamento() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    titulo: "",
    descripcion: "",
    precio: "",
    ubicacion: "",
    habitaciones: "",
    caracteristicas: "",
    condiciones: "",
    disponibilidad: false,
  });

  const [fotos, setFotos] = useState([]); 
  const [nuevasFotos, setNuevasFotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      obtenerDepartamento(id)
        .then((response) => {
          const dept = response.data;
          setFormData({
            titulo: dept.titulo,
            descripcion: dept.descripcion,
            precio: dept.precio,
            ubicacion: dept.ubicacion,
            habitaciones: dept.habitaciones,
            caracteristicas: dept.caracteristicas.join(", "),
            condiciones: dept.condiciones,
            disponibilidad: dept.disponible || false,
          });

          setFotos(dept.fotos || []);
          setIsLoading(false);
        })
        .catch(() => {
          setError("Error al cargar los detalles del departamento");
          setIsLoading(false);
        });
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "disponibilidad" ? value === "Sí" : value,
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setNuevasFotos(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key === "disponibilidad" ? "disponible" : key, value);
      });

      if (nuevasFotos.length > 0) {
        nuevasFotos.forEach((file) => {
          formDataToSend.append("fotos", file);
        });
      }

      const updatedDepartamento = await updateDepartament(id, formDataToSend);
      setFotos(updatedDepartamento.fotos);
      navigate("/dashboard");
    } catch (error) {
      setError(error.response?.data?.message || "Error al actualizar el departamento.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg">
      <h2 className="text-3xl font-bold text-green-500 mb-6 text-center">Detalles del Departamento</h2>

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      <form onSubmit={handleSubmit}>
        {/* Campos del formulario */}
        {[
          { label: "Título", name: "titulo", type: "text" },
          { label: "Descripción", name: "descripcion", type: "textarea" },
          { label: "Precio", name: "precio", type: "number" },
          { label: "Ubicación", name: "ubicacion", type: "text" },
          { label: "Número de Habitaciones", name: "habitaciones", type: "number" },
          { label: "Características", name: "caracteristicas", type: "text" },
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

        {/* Disponibilidad */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-1">Disponibilidad</label>
          <select
            name="disponibilidad"
            value={formData.disponibilidad ? "Sí" : "No"}
            onChange={handleChange}
            className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
            required
          >
            <option value="Sí">Sí</option>
            <option value="No">No</option>
          </select>
        </div>

        {/* Vista previa de imágenes */}
        {fotos.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-[#383673]">Imágenes Actuales:</h3>
            <div className="flex justify-center gap-4 mt-2">
              {fotos.map((foto, index) => (
                <img key={index} src={foto} alt={`Foto ${index + 1}`} className="w-40 h-40 object-cover rounded-lg shadow-md" />
              ))}
            </div>
          </div>
        )}

        {/* Subir nuevas imágenes */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-1">Subir Nuevas Fotos (JPG)</label>
          <input
            type="file"
            accept="image/jpeg"
            multiple
            onChange={handleFileChange}
            className="w-full border border-[#7F6DF2] rounded-lg p-3 focus:ring-2 focus:ring-[#9D1DF2] outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-400 transition duration-300 text-lg font-semibold"
          disabled={isLoading}
        >
          {isLoading ? "Actualizando..." : "Actualizar"}
        </button>
      </form>
    </div>
  );
}

export default DetallesDepartamento;
