import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import { Eye } from "lucide-react";

export default function MisGestiones() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);

  const [gestionSeleccionada, setGestionSeleccionada] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  /* ==============================
      DECODIFICAR TOKEN
  ============================== */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUsuarioInfo(decoded.usuario);
      } catch (error) {
        console.error(error);
      }
    }
  }, []);

  /* ==============================
      FECHAS POR DEFECTO (HOY)
  ============================== */
  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFechaInicio(hoyLocal);
    setFechaFin(hoyLocal);
  }, []);

  /* ==============================
      OBTENER GESTIONES
  ============================== */
  const fetchData = async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const url = `${API_URL}/api/gestion/vendedor/${usuarioInfo.agenciaPrincipal.usuarioAgenciaId}?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      const gestiones = data.gestiones || [];

      const resultado = gestiones.map((g) => ({
        id: g.id,
        Fecha: new Date(g.createdAt).toLocaleDateString(),
        Celular: g.celularGestionado,
        Cedula: g.cedulaGestionado,
        "Otras Cedulas": Array.isArray(g.otrasCedulas)
          ? g.otrasCedulas.join(", ")
          : "",
        Extension: g.extension,
        Producto: g.dispositivo?.nombre || "",
        Solicitud: g.solicitud,
        Origen: g.origen,
        Region: g.region,
        Accion: g.accion,
      }));

      setFilas(resultado);
    } catch (error) {
      console.log(error);
      Swal.fire("Error", "No se pudieron cargar las gestiones", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.agenciaPrincipal?.usuarioAgenciaId) {
      fetchData();
    }
  }, [fechaInicio, fechaFin, usuarioInfo]);

  /* ==============================
      VER DETALLE
  ============================== */
  const handleVerGestion = (id) => {
    const gestion = filas.find((f) => f.id === id);
    setGestionSeleccionada(gestion);
    setModalAbierto(true);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Mis Gestiones</h1>

      {/* FILTROS */}
      <div className="flex gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-medium">Fecha Inicio</label>
          <input
            type="date"
            className="border px-2 py-1 rounded"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Fecha Fin</label>
          <input
            type="date"
            className="border px-2 py-1 rounded"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border mt-4 text-sm">
          <thead className="bg-gray-200">
            <tr>
              {Object.keys(filas[0] || {}).map((key) => (
                <th key={key} className="p-2 border">
                  {key}
                </th>
              ))}
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {Object.values(f).map((val, j) => (
                  <td key={j} className="p-2 border text-center">
                    {val}
                  </td>
                ))}
                <td className="text-center p-2">
                  <button
                    className="bg-green-600 text-white px-2 py-1 rounded"
                    onClick={() => handleVerGestion(f.id)}
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* MODAL DETALLE */}
      {modalAbierto && gestionSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-lg font-bold mb-3">
              Detalle Gestión #{gestionSeleccionada.id}
            </h2>

            {Object.entries(gestionSeleccionada).map(([key, value]) => (
              <p key={key}>
                <b>{key}:</b> {value}
              </p>
            ))}

            <button
              className="mt-4 w-full bg-red-500 text-white py-2 rounded"
              onClick={() => setModalAbierto(false)}
            >
              Cerrar
            </button>
          </div>
        </div> 
      )}
    </div>
  );
}
