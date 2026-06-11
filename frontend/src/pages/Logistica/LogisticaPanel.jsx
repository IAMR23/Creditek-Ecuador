import { jwtDecode } from "jwt-decode";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdPointOfSale,
} from "react-icons/md";
import { hasRouteAccess, ROUTE_PERMISSIONS } from "../../config/routePermissions";

function LogisticaPanel() {
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
      label: "Logística",
      title: "Revisa tus entregas pendientes",
      icon: <MdPointOfSale className="w-10 h-10 text-green-600" />,
      path: "/mis-entregas-pendientes",
    }, {
      label: "Logística",
      title: "Revisa tus entregas realizadas",
      icon: <MdPointOfSale className="w-10 h-10 text-green-600" />,
      path: "/mis-entregas-realizadas",
    },
  ];

  const usuario = user?.usuario;
  const rol = usuario?.rol?.nombre;
  const permisos = usuario?.permisosAsignados || [];
  const visibleOptions = options.filter((item) =>
    hasRouteAccess({
      rol,
      permisos,
      path: item.path,
      permission: ROUTE_PERMISSIONS[item.path],
    }),
  );


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
        {visibleOptions.map((item, i) => (
          <Card key={i} {...item} />
        ))}
      </div>

      {visibleOptions.length === 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          No tienes permisos asignados para este panel.
        </div>
      )}
    </div>
  );
}

export default LogisticaPanel;
