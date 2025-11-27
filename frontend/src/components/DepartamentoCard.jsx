import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

const DepartamentoCard = () => {
  const { id } = useParams(); // Obtener el ID del departamento desde la URL
  const [departamento, setDepartamento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comentario, setComentario] = useState("");
  const [calificacion, setCalificacion] = useState(5);
  const [enviando, setEnviando] = useState(false);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const fetchDepartamento = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/depas/${id}`);
        setDepartamento(response.data);
      } catch (error) {
        console.error("Error al obtener el departamento:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartamento();

    // Obtener el usuario desde el token
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUsuario(decoded);
      } catch (error) {
        console.error("Error al decodificar el token:", error);
      }
    }
  }, [id]);

  const manejarEnvio = async (e) => {
    e.preventDefault();
    setEnviando(true);

    if (!usuario) {
      alert("Debes iniciar sesión para comentar.");
      setEnviando(false);
      return;
    }

    const nuevoComentario = {
      comentario,
      calificacion,
    };

    try {
      const response = await axios.post(
        `http://localhost:5000/comentario/${id}`,
        nuevoComentario,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      console.log("Comentario enviado:", response.data);

      // Agregar el nuevo comentario a la lista sin recargar la página
      setDepartamento((prev) => ({
        ...prev,
        comentarios: [...prev.comentarios, response.data.comentario],
      }));

      setComentario("");
      setCalificacion(5);
    } catch (error) {
      console.error("Error al enviar comentario:", error);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <p className="text-center text-gray-500">Cargando...</p>;
  if (!departamento)
    return (
      <p className="text-center text-red-500">
        No se encontró el departamento.
      </p>
    );

  return (
    <div className="bg-white shadow-lg rounded-2xl overflow-hidden p-6 border border-gray-200">
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
        {departamento.titulo}
      </h2>
      <p className="text-gray-600 mb-4">{departamento.descripcion}</p>
      <p className="text-lg font-bold text-blue-600">
        ${departamento.precio} / mes
      </p>
      <p className="text-gray-600">Ubicación: {departamento.ubicacion}</p>
      <p className="text-gray-600">Habitaciones: {departamento.habitaciones}</p>
      <p className="text-gray-600">Condiciones: {departamento.condiciones}</p>
      <p className="text-gray-600">
        Publicado el:{" "}
        {new Date(departamento.fechaPublicacion).toLocaleDateString()}
      </p>

      {/* Información del arrendador */}
      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold">Arrendador</h3>
        <p className="text-gray-700">
          Nombre: {departamento.arrendador.nombre}
        </p>
        <p className="text-gray-700">Email: {departamento.arrendador.email}</p>
      </div>

      {/* Sección de comentarios */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold">Comentarios</h3>
        {departamento.comentarios.length > 0 ? (
          departamento.comentarios.map((comentario) => (
            <div
              key={comentario._id}
              className="mt-2 p-3 border border-gray-300 rounded-lg"
            >
              <p className="text-gray-800">{comentario.comentario}</p>
              <p className="text-sm ">
                Calificación: {comentario.calificacion}/5
              </p>
              <p className="text-sm text-gray-500">
                - {comentario.arrendatario.nombre}
              </p>
            </div>
          ))
        ) : (
          <p className="text-gray-500">Aún no hay comentarios.</p>
        )}
      </div>

      {/* Formulario para agregar comentario */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold">Añadir comentario</h3>
        <form onSubmit={manejarEnvio} className="mt-4">
          <textarea
            className="w-full p-2 border rounded-lg focus:ring focus:ring-blue-200"
            placeholder="Escribe tu comentario..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            required
          />
          <div className="mt-2">
            <label className="block text-gray-700">Calificación:</label>
            <select
              className="p-2 border rounded-lg focus:ring focus:ring-blue-200"
              value={calificacion}
              onChange={(e) => setCalificacion(Number(e.target.value))}
            >
              {[5, 4, 3, 2, 1].map((num) => (
                <option key={num} value={num}>
                  {num} ⭐
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={enviando}
          >
            {enviando ? "Enviando..." : "Publicar Comentario"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DepartamentoCard;
