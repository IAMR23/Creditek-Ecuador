import React, { useEffect, useState } from "react";
import { API_URL } from "../../../config";

function GestionarVentas() {
  const [arrendadoresPendientes, setArrendadoresPendientes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchArrendadoresPendientes = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "http://localhost:5000/arrendadores/verificacion",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Error al obtener los arrendadores pendientes");
      }

      const data = await response.json();
      setArrendadoresPendientes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArrendadoresPendientes();
  }, []);

  const handleAprobar = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:5000/aprobar/arrendador/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      fetchArrendadoresPendientes();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRechazar = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:5000/desactivar/arrendador/${id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      fetchArrendadoresPendientes();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-blue-500 text-lg font-semibold">Cargando arrendadores pendientes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 text-lg font-semibold">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="p-8 bg-white rounded-xl shadow-lg">
      <h1 className="text-3xl font-bold text-green-500 mb-6 text-center">Gestionar Cuentas</h1>

      <h2 className="text-2xl font-semibold text-[#9D1DF2] mb-4 text-center">
        Arrendadores Pendientes
      </h2>

      {arrendadoresPendientes.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300 shadow-md rounded-lg">
            <thead>
              <tr className="bg-gray-200 text-gray-700">
                <th className="py-3 px-6 border-b text-left">Nombre</th>
                <th className="py-3 px-6 border-b text-left">Email</th>
                <th className="py-3 px-6 border-b text-left">Verificado</th>
                <th className="py-3 px-6 border-b text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {arrendadoresPendientes.map((arrendador, index) => (
                <tr key={arrendador._id} className={`${index % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-gray-100`}>
                  <td className="py-3 px-6 border-b">{arrendador.nombre}</td>
                  <td className="py-3 px-6 border-b">{arrendador.email}</td>
                  <td className="py-3 px-6 border-b">
                    {arrendador.verificado ? (
                      <span className="text-green-500 font-semibold">Sí</span>
                    ) : (
                      <span className="text-red-500 font-semibold">No</span>
                    )}
                  </td>
                  <td className="py-3 px-6 border-b flex justify-center gap-4">
                    <button
                      onClick={() => handleAprobar(arrendador._id)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-400 transition duration-300"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => handleRechazar(arrendador._id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-300"
                    >
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-center text-gray-600 mt-4">No hay arrendadores pendientes.</p>
      )}
    </div>
  );
}

export default GestionarVentas;
