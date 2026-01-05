import { useEffect, useState } from "react";
import axios from "axios";
import ModalDetalle from "../../components/PostulacionDetalle";
import { API_URL } from "../../../config";


export default function Postulaciones() {
  const [postulaciones, setPostulaciones] = useState([]);
  const [cedula, setCedula] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null); // 👈 modal

  const fetchPostulaciones = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${API_URL}/api/postulaciones`);
      setPostulaciones(res.data.data);
    } catch {
      setError("Error cargando postulaciones");
    } finally {
      setLoading(false);
    }
  };

  const buscarPorCedula = async () => {
    if (!cedula.trim()) return fetchPostulaciones();

    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${API_URL}/api/postulaciones/cedula/${cedula}`);
      setPostulaciones([res.data.data]);
    } catch {
      setPostulaciones([]);
      setError("No se encontró la postulación");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostulaciones();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Postulaciones</h2>

      {/* 🔍 Buscador */}
      <div className="flex gap-2 mb-4">
        <input
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          placeholder="Buscar por cédula"
          className="border px-3 py-2 rounded w-64"
        />
        <button
          onClick={buscarPorCedula}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Buscar
        </button>
        <button
          onClick={fetchPostulaciones}
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          Ver todos
        </button>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {/* 📊 Tabla */}
      {!loading && postulaciones.length > 0 && (
        <table className="w-full border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2">ID</th>
              <th className="border p-2">Nombre</th>
              <th className="border p-2">Cédula</th>
              <th className="border p-2">Teléfono</th>
              <th className="border p-2">Fecha</th>
              <th className="border p-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {postulaciones.map((p) => (
              <tr key={p.id}>
                <td className="border p-2">{p.id}</td>
                <td className="border p-2">{p.nombre}</td>
                <td className="border p-2">{p.cedula ?? "—"}</td>
                <td className="border p-2">{p.telefono ?? "—"}</td>
                <td className="border p-2">
                  {new Date(p.createdAt).toLocaleString()}
                </td>
                <td className="border p-2">
                  <button
                    onClick={() => setSelected(p)}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 🪟 MODAL */}
      {selected && (
        <ModalDetalle postulacion={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
