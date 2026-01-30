import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";

export default function UsuariosConPermisos() {
  const [data, setData] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/api/usuario-agencia-permisos/usuarios-permisos`
      );
      setData(res.data);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los usuarios", "error");
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-green-500 mb-6">
        Usuarios y Permisos
      </h1>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="min-w-full border border-gray-200">
          <thead className="bg-green-100">
            <tr>
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Agencia</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Permisos</th>
            </tr>
          </thead>

          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center py-6 text-gray-500">
                  No hay registros
                </td>
              </tr>
            )}

            {data.map((ua) => (
              <tr
                key={ua.id}
                className="border-t border-gray-200 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium">
                  {ua.usuario.nombre}
                </td>

                <td className="px-4 py-3 text-sm text-gray-600">
                  {ua.usuario.email}
                </td>

                <td className="px-4 py-3">
                  {ua.agencia.nombre}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded font-semibold ${
                      ua.activo
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {ua.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {ua.permisosAsignados.length === 0 ? (
                    <span className="text-gray-400 italic">
                      Sin permisos
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ua.permisosAsignados.map((p) => (
                        <span
                          key={p.id}
                          className="bg-green-500 text-white text-xs px-2 py-1 rounded"
                        >
                          {p.permiso.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
