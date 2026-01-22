import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdShoppingCart,
  MdLocalShipping,
  MdList,
  MdPointOfSale,
} from "react-icons/md";

function VendedorPanel() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        setUser(jwtDecode(token));
      } catch (error) {
        console.error("Error al decodificar token", error);
        localStorage.removeItem("token");
      }
    }
  }, []);

  const options = [
    {
      label: "Comercial",
      title: "Registrar Ventas",
      desc: "Ingresa tus ventas del dia",
      icon: <MdShoppingCart className="w-10 h-10 text-green-600" />,
      path: "/ventacompleta",
    },

    /*     {
      label: "Ventas",
      title: "Registrar Ventas",
      desc: "Ingresa tus ventas del día",
      icon: <MdPointOfSale className="w-10 h-10 text-green-600" />,
      path: "/registrar-clientes-venta",
    }, */
        {
      label: "Logistica",
      title: "Registrar Entregas",
      desc: "Ingresa tus entregas del dia",
      icon: <MdShoppingCart className="w-10 h-10 text-green-600" />,
      path: "/crear-entrega-completa",
    },
    {
      label: "Ventas",
      title: "Mis ventas",
      desc: "Revisa tus ventas del día",
      icon: <MdList className="w-10 h-10 text-green-600" />,
      path: "/mis-ventas",
    },
    {
      label: "Logística",
      title: "Entregas generales",
      desc: "Consulta todas tus entregas",
      icon: <MdShoppingCart className="w-10 h-10 text-green-600" />,
      path: "/mis-entregas",
    },


  ];

  const Card = ({ label, title, desc, icon, path }) => (
    <div
      onClick={() => navigate(path)}
      className="relative bg-white p-8 rounded-2xl shadow-md cursor-pointer border border-green-100 
                 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
    >
      <div className="absolute top-3 right-3 bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-medium">
        {label}
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-green-200 flex items-center justify-center">
          {icon}
        </div>

        <h2 className="text-2xl font-semibold text-green-600 mb-1 group-hover:text-green-700">
          {title}
        </h2>

        <p className="text-gray-600">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="p-8 bg-gradient-to-br from-green-50 to-gray-100 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-6 tracking-tight">
        Bienvenido{" "}
        <span className="text-green-600">
          {user?.usuario.nombre || "Vendedor"}
        </span>
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
        {options.map((item, i) => (
          <Card key={i} {...item} />
        ))}
      </div>
    </div>
  );
}

export default VendedorPanel;
