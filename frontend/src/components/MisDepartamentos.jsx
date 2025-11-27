import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerDepartamentosPorArrendador } from "../services/departamentServices";
import { jwtDecode } from "jwt-decode";

function MisDepartamentos() {
  const [departamentos, setDepartamentos] = useState([]);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUser(decodedToken.userId);
      } catch (error) {
        console.error("Error al decodificar el token", error);
      }
    }
  }, []);

  useEffect(() => {
    const fetchDepartamentos = async () => {
      if (!user) return;
      try {
        const data = await obtenerDepartamentosPorArrendador(user);
        const departamentosConDisponibilidad = data.map((dept) => ({
          ...dept,
          disponible: dept.disponible ? "Sí" : "No",
        }));
        setDepartamentos(departamentosConDisponibilidad);
      } catch (error) {
        setError(error.message || "Error al obtener los departamentos.");
      }
    };
    fetchDepartamentos();
  }, [user]);

  const handleVerDetalles = (id) => {
    navigate(`/misdepartamentos/${id}`);
  };

  const handleCrearDepartamento = () => {
    navigate("/crear/departamento");
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      {error && <p className="text-red-500">{error}</p>}

      {/* Encabezado */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-green-500">Mis Departamentos</h2>
        <button
          onClick={handleCrearDepartamento}
          className="bg-green-600 hover:bg-green-400 text-white py-2 px-4 rounded-lg transition duration-300"
        >
          Crear Departamento
        </button>
      </div>

      {departamentos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {departamentos.map((departamento) => (
            <div
              key={departamento._id}
              className="bg-white rounded-xl shadow-lg overflow-hidden"
            >
              {/* Imagen principal centrada y más grande */}
              <div className="flex justify-center items-center overflow-hidden h-64 bg-gray-200">
                {departamento.fotos && departamento.fotos.length > 0 ? (
                  <img
                    src={departamento.fotos[0]}
                    alt={`Foto de ${departamento.titulo}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <p className="text-gray-500">Sin imágenes</p>
                )}
              </div>

              {/* Información del departamento */}
              <div className="p-6">
                <h3 className="text-2xl font-semibold text-[#7F6DF2] mb-2">
                  {departamento.titulo}
                </h3>
                <p className="text-gray-600 mb-4">{departamento.descripcion}</p>
                <p className="text-green-500 text-xl font-bold mb-4">
                  ${departamento.precio}
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Ubicación:</strong> {departamento.ubicacion}
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Habitaciones:</strong> {departamento.habitaciones}
                </p>

                <p className="text-gray-600 mb-2">
                  <strong>Condiciones:</strong> {departamento.condiciones}
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Fecha de Publicación:</strong>{" "}
                  {departamento.fechaPublicacion
                    ? new Date(departamento.fechaPublicacion).toLocaleDateString()
                    : "No disponible"}
                </p>
                <p className="text-gray-600 mb-2">
                  <strong>Aprobado:</strong>{" "}
                  <span
                    className={`font-semibold ${
                      departamento.aprobado ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {departamento.aprobado ? "Sí" : "No"}
                  </span>
                </p>

                <p className="text-gray-600 mb-4">
                  <strong>Disponible:</strong>{" "}
                  <span
                    className={`font-semibold ${
                      departamento.disponible === "Sí"
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {departamento.disponible}
                  </span>
                </p>

                <button
                  onClick={() => handleVerDetalles(departamento._id)}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-400 transition duration-300 text-lg font-semibold"
                >
                  Ver Detalles
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center">No tienes departamentos publicados.</p>
      )}
    </div>
  );
}

export default MisDepartamentos;
