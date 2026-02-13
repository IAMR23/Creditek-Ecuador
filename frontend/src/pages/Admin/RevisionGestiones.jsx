import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import {
  FaUser,
  FaBuilding,
  FaDesktop,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaIdCard,
} from "react-icons/fa";

const RevisionGestiones = () => {
  const [gestiones, setGestiones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obtenerGestiones();
  }, []);

  const obtenerGestiones = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/gestion`);
      setGestiones(data);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las gestiones",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString("es-EC", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const badgeSolicitud = (estado) => {
    if (estado === "APROBADO")
      return (
        <span className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-semibold">
          <FaCheckCircle /> {estado}
        </span>
      );

    if (estado === "DENEGADO")
      return (
        <span className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-xs font-semibold">
          <FaTimesCircle /> {estado}
        </span>
      );

    return null;
  };

  const badgeAccion = (accion) => (
    <span className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-xs font-semibold">
      <FaClock /> {accion.replaceAll("_", " ")}
    </span>
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">
          Cargando gestiones...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Dashboard de Gestiones
        </h1>
        <p className="text-gray-500">
          Seguimiento comercial en tiempo real
        </p>
      </div>

      {/* CONTENEDOR */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left">Fecha</th>
              <th className="px-6 py-4 text-left">Usuario</th>
              <th className="px-6 py-4 text-left">Agencia</th>
              <th className="px-6 py-4 text-left">Dispositivo</th>
              <th className="px-6 py-4 text-left">Solicitud</th>
              <th className="px-6 py-4 text-left">Acción</th>
              <th className="px-6 py-4 text-left">Otras Cédulas</th>
            </tr>
          </thead>


<tbody className="divide-y divide-gray-100">
  {gestiones.map((g) => (
    <tr
      key={g.id}
      className="hover:bg-gray-50 transition-all duration-200"
    >
      {/* FECHA */}
      <td className="px-6 py-6">
        <div className="font-semibold text-gray-800">
          {formatDate(g.createdAt)}
        </div>
       
      </td>

      {/* USUARIO */}
      <td className="px-6 py-6">
        <div className="font-medium text-gray-800">
          {g.usuarioAgencia.usuario.nombre}
        </div>
        <div className="text-xs text-gray-400">
          Ext: {g.extension}
        </div>
      </td>

      {/* AGENCIA */}
      <td className="px-6 py-6">
        <div className="font-medium text-gray-800">
          {g.usuarioAgencia.agencia.nombre}
        </div>
        <div className="text-xs text-gray-400">
          Región: {g.region}
        </div>
      </td>

      {/* DISPOSITIVO */}
      <td className="px-6 py-6">
        <div className="font-medium text-gray-700">
          {g.dispositivo.nombre}
        </div>
        <div className="text-xs text-gray-400">
          {g.origen}
        </div>
      </td>

      {/* SOLICITUD */}
      <td className="px-6 py-6">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
            g.solicitud === "APROBADO"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-600"
          }`}
        >
          {g.solicitud}
        </span>
      </td>

      {/* ACCION */}
      <td className="px-6 py-6">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          {g.accion.replaceAll("_", " ")}
        </span>
      </td>

      {/* OTRAS CEDULAS */}
      <td className="px-6 py-6">
        {g.otrasCedulas?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {g.otrasCedulas.map((c, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs rounded-md bg-purple-100 text-purple-700 font-medium"
              >
                {c}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-300 text-sm">—</span>
        )}
      </td>
    </tr>
  ))}
</tbody>

        </table>

      </div>
    </div>
  );
};

export default RevisionGestiones;
