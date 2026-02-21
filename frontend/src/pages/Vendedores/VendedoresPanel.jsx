import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdShoppingCart,
  MdLocalShipping,
  MdList,
  MdPointOfSale,
  MdSwapHoriz,
  MdAssignment,
  MdAnalytics,
  MdSupportAgent,
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
    }else {
      navigate("/login");
    }
  }, []);

  const colorMap = {
    green: "bg-green-100 text-green-600 group-hover:bg-green-200",
    blue: "bg-blue-100 text-blue-600 group-hover:bg-blue-200",
    purple: "bg-purple-100 text-purple-600 group-hover:bg-purple-200",
    orange: "bg-orange-100 text-orange-600 group-hover:bg-orange-200",
  };

  const options = [
    {
      category: "Comercial",
      color: "green",
      items: [
        {
          title: "Registrar Ventas",
          desc: "Ingresa tus ventas del día",
          icon: <MdShoppingCart />,
          path: "/ventacompleta",
        },
        {
          title: "Mis ventas",
          desc: "Revisa tus ventas registradas",
          icon: <MdAnalytics />,
          path: "/mis-ventas",
        },
      ],
    },
    {
      category: "Logística",
      color: "blue",
      items: [
        {
          title: "Registrar Entregas",
          desc: "Ingresa entregas realizadas",
          icon: <MdLocalShipping />,
          path: "/crear-entrega-completa",
        },
        {
          title: "Entregas generales",
          desc: "Consulta todas tus entregas",
          icon: <MdList />,
          path: "/mis-entregas",
        },
        {
          title: "Crear Traslado",
          desc: "Traslados entre agencias",
          icon: <MdSwapHoriz />,
          path: "/crear-traslado",
        },
        {
          title: "Mis Traslados",
          desc: "Historial de traslados",
          icon: <MdAssignment />,
          path: "/mis-traslados",
        },
      ],
    },
    {
      category: "Call Center",
      color: "purple",
      items: [
        {
          title: "Registrar Prospectos",
          desc: "Crea nuevas gestiones",
          icon: <MdSupportAgent />,
          path: "/gestion",
        },
        {
          title: "Mis Gestiones",
          desc: "Revisa tus gestiones",
          icon: <MdList />,
          path: "/mis-gestiones",
        },
      ],
    },
 /*    {
      category: "Caja",
      color: "orange",
      items: [
        {
          title: "Cierre de Caja",
          desc: "Cerrar operaciones del día",
          icon: <MdPointOfSale />,
          path: "/caja",
        },
      ],
    }, */
  ];

  const Card = ({ title, desc, icon, path, color }) => (
    <div
      onClick={() => navigate(path)}
      className="group aspect-square bg-white rounded-2xl 
                 shadow-sm border border-gray-100 
                 flex flex-col items-center justify-center text-center p-6
                 cursor-pointer
                 transition-all duration-300 ease-in-out
                 hover:shadow-xl hover:-translate-y-2 hover:scale-[1.03]
                 active:scale-95"
    >
      {/* Icono */}
      <div
        className={`flex items-center justify-center rounded-xl mb-4 text-3xl 
        transition-all duration-300 ease-in-out 
        group-hover:rotate-6 group-hover:scale-110
        ${colorMap[color]}`}
      >
        {icon}
      </div>

      <h2 className="text-base font-semibold text-gray-800 transition-colors duration-300 group-hover:text-black">
        {title}
      </h2>

      <p className="text-xs text-gray-500 mt-2">
        {desc}
      </p>
    </div>
  );

  return (
    <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">
          Panel de Vendedor
        </h1>
        <p className="text-gray-500 mt-1">
          Bienvenido {user?.usuario?.nombre || "Vendedor"}
        </p>
      </div>

      {/* Secciones */}
      {options.map((section, i) => (
        <div key={i} className="mb-10">
          <h2 className="text-lg font-semibold text-gray-700 mb-5">
            {section.category}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {section.items.map((item, j) => (
              <Card key={j} {...item} color={section.color} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default VendedorPanel;
