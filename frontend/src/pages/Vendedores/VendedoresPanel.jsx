import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function VendedorPanel() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const handleNavigate = (path) => {
    navigate(path);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded);
      } catch (error) {
        console.error("Error al decodificar el token", error);
        localStorage.removeItem("token");
      }
    }
  }, []);

return (
  <div className="p-8 bg-gradient-to-br from-green-50 to-gray-100 min-h-screen">
    <h1 className="text-4xl font-extrabold text-gray-900 mb-6 tracking-tight">
      Bienvenido, <span className="text-green-600">{user?.nombre || "Vendedor"}</span>
    </h1>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">

      {/* CARD REGISTRAR VENTAS */}
      <div
        onClick={() => handleNavigate("/registrar-ventas")}
        className="relative bg-white p-8 rounded-2xl shadow-md cursor-pointer border border-green-100 
                   hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
      >
        <div className="absolute top-3 right-3 bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-medium">
          Ventas
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-green-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth="2"
                 viewBox="0 0 24 24">
              <path d="M3 3v18h18" />
              <path d="M7 14l3-3 2 2 4-4" />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-green-600 mb-1 group-hover:text-green-700">
            Registrar Ventas
          </h2>
          <p className="text-gray-600">Ingresa tus ventas del día</p>
        </div>
      </div>

      {/* CARD REGISTRAR ENTREGAS */}
      <div
        onClick={() => handleNavigate("/registrar-clientes")}
        className="relative bg-white p-8 rounded-2xl shadow-md cursor-pointer border border-green-100
                   hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
      >
        <div className="absolute top-3 right-3 bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-medium">
          Logística
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-green-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth="2"
                 viewBox="0 0 24 24">
              <path d="M3 7h18" />
              <path d="M6 7v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold text-green-600 mb-1 group-hover:text-green-700">
            Registrar Entregas
          </h2>
          <p className="text-gray-600">Registra envíos y entregas</p>
        </div>
      </div>
    </div>
  </div>
);

}

export default VendedorPanel;
