import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {jwtDecode} from "jwt-decode";
import { API_URL } from "../../../../config";

export default function VentasPorUsuario() {
  const [user, setUser] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [ventaEdit, setVentaEdit] = useState(null);

  // Decodificar token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded.usuario);
      } catch (error) {
        console.error("Error decodificando token:", error);
      }
    }
  }, []);

  // Cargar ventas
  useEffect(() => {
    const fetchVentas = async () => {
      if (!user?.agenciaPrincipal?.usuarioAgenciaId) return;

      try {
        const resp = await axios.get(
          `${API_URL}/ventas/vendedor/${user.agenciaPrincipal.usuarioAgenciaId}`
        );
        setVentas(resp.data.ventas);
      } catch (err) {
        console.error("Error al obtener ventas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVentas();
  }, [user]);

  const openModal = (venta) => {
    setVentaEdit({ ...venta });
    setShowModal(true);
  };

  if (loading)
    return (
      <p className="text-center py-10 text-gray-500">Cargando ventas...</p>
    );

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-green-600 mb-4">Mis Ventas</h2>

      {ventas.length === 0 ? (
        <p className="text-gray-500">No tienes ventas registradas hoy.</p>
      ) : (
        <div className="overflow-x-auto shadow-lg rounded-lg">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Agencia</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Validada</th>
                <th className="px-4 py-3">Foto</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-b hover:bg-green-50">
                  <td className="px-4 py-3">{v.usuarioAgencia.usuario.nombre}</td>
                  <td className="px-4 py-3">{v.usuarioAgencia.agencia.nombre}</td>
                  <td className="px-4 py-3">{v.origenId}</td>
                  <td className="px-4 py-3">
                    {new Date(v.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{v.validada ? "Sí" : "No"}</td>
                  <td className="px-4 py-3">
                    {v.fotoValidacion ? (
                      <a
                        href={v.fotoValidacion}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Ver foto
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openModal(v)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
