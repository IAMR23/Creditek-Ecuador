import React from "react";
import { useNavigate } from "react-router-dom";

function AdminPanel() {
  const navigate = useNavigate();

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold text-black mb-4">Bienvenido</h1>
      <h2 className="text-2xl font-semibold text-green-600 mb-8">
        Panel Administrativo
      </h2>

      <div className="flex space-x-4">
        <div
          className="w-1/2 bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 border border-gray-200 text-center"
          onClick={() => handleNavigate("/gestionar-ventas")}
        >
          <h2 className="text-2xl font-semibold text-green-500 mb-2">
            Gestionar Ventas
          </h2>
          <p className="">Administra tus ventas</p>
        </div>
        <div
          className="w-1/2 bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 border border-gray-200 text-center"
          onClick={() => handleNavigate("/gestionar-departamentos")}
        >
          <h2 className="text-2xl font-semibold text-green-500 mb-2">
            Gestionar Entregas
          </h2>
          <p className="">Administra tus envios</p>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
