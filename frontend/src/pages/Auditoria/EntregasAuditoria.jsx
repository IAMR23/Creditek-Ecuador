import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../../../config";

export default function EntregasAuditoria() {
  const [entregas, setEntregas] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    obtenerEntregas(page);
  }, [page]);

  const obtenerEntregas = async (pagina) => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/entregas`, {
        params: { page: pagina },
      });

      setEntregas(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch (error) {
      console.error("Error cargando entregas:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="">
      <h1 className="text-2xl font-bold mb-4 text-orange-600">
        Entregas Auditoria
      </h1>

      {/* TABLA */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-orange-100 text-orange-700">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Origen</th>
              <th className="px-4 py-2 text-left">Fecha Llamada</th>
              <th className="px-4 py-2 text-left">Estado</th>
              <th className="px-4 py-2 text-center">Acción</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-6">
                  Cargando...
                </td>
              </tr>
            ) : entregas.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-6">
                  No hay entregas
                </td>
              </tr>
            ) : (
              entregas.map((e) => (
                <tr
                  key={e.id}
                  className="border-t hover:bg-gray-50"
                >
                  <td className="px-4 py-2">{e.id}</td>

                  <td className="px-4 py-2">
                    {e.cliente?.cliente || "-"}
                  </td>

                  <td className="px-4 py-2">
                    {e.origen?.nombre || "-"}
                  </td>

                  <td className="px-4 py-2">
                    {e.FechaHoraLlamada
                      ? new Date(e.FechaHoraLlamada).toLocaleString("es-EC", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "Sin llamada"}
                  </td>

                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        e.estado === "Urgente"
                          ? "bg-red-100 text-red-700"
                          : e.estado === "Pendiente"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {e.estado}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-center">
                    <Link
                      to={`/entregas-auditoria/${e.id}`}
                      state={{ entrega: e }}
                      className="text-orange-600 hover:underline font-semibold"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN */}
      <div className="flex justify-between items-center mt-4">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          ⬅ Anterior
        </button>

        <span className="text-sm">
          Página {page} de {totalPages}
        </span>

        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Siguiente ➡
        </button>
      </div>
    </div>
  );
}
