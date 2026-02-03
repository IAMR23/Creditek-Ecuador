import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { FaEye } from "react-icons/fa";

export default function EntregasPendientes() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // Función para solicitar permiso para notificaciones
  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // Función para disparar la notificación
  const notificar = (entrega) => {
    if (Notification.permission !== "granted") return;

    new Notification("⚠️ Entrega por vencer", {
      body: `Entrega #${entrega.id} vence en ${entrega.horasRestantes}h ${entrega.minutosRestantes}m`,
      icon: "/warning.png", // opcional
    });
  };

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await axios.get(`${API_URL}/alertas/entregas-pendientes`);
      setFilas(data || []);
    } catch (err) {
      console.error(err);
      setError("Error al cargar las alertas");
    } finally {
      setLoading(false);
    }
  };

  const notificadosRef = useRef(new Set());

  const verificarAlertas = (data) => {
    data.forEach((entrega) => {
      if (entrega.estado !== "Pendiente") return;
      if (notificadosRef.current.has(entrega.id)) return;

      const totalMinutos =
        (entrega.horasRestantes ?? 0) * 60 + (entrega.minutosRestantes ?? 0);

      if (totalMinutos <= 35 * 60 && totalMinutos > 0) {
        notificar(entrega);
        notificadosRef.current.add(entrega.id);
      }
    });
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API_URL}/alertas/entregas-pendientes`);
        setFilas(data);
        verificarAlertas(data);
      } catch (err) {
        console.error(err);
      }
    }, 60000); // cada 1 minuto

    return () => clearInterval(interval); // Limpiar el intervalo cuando el componente se desmonte
  }, []);

  const handleVerEntrega = (id) => {
    navigate(`/entrega-logistica/${id}`);
  };

  const formatFecha = (fechaISO) => {
    if (!fechaISO) return "-";
    return new Date(fechaISO).toLocaleString("es-EC", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const estadoColor = (estado) => {
    switch (estado?.toLowerCase()) {
      case "perdida":
        return "bg-red-300 text-red-700";
      case "pendiente":
        return "bg-yellow-500 text-yellow-900";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Alerta Entregas Pendientes</h1>

      {error && <p className="text-red-500 mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">Caso #</th>
              <th className="p-2 border">Cliente</th>
              <th className="p-2 border">Telefono</th>
                            <th className="p-2 border">Fecha llamada</th>

              <th className="p-2 border">Tiempo restante</th>
              <th className="p-2 border">Fecha límite</th>
                            <th className="p-2 border">Estado</th>

              <th className="p-2 border">Observación</th>
              <th className="p-2 border">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-4 text-center text-gray-500">
                  No hay alertas
                </td>
              </tr>
            ) : (
              filas.map((f) => (
                <tr key={f.id}>
                  <td className="p-2 border">{f.id}</td>
                  <td className="p-2 border">{f.cliente.nombre}</td>
                  <td className="p-2 border">{f.cliente.telefono}</td>

                  
                  <td className="p-2 border">
                    {formatFecha(f.FechaHoraLlamada)}
                  </td>


                

                  

                  <td className="p-2 border">{f.horasRestantes ?? 0} Horas {f.minutosRestantes ?? 0} Minutos </td>
           

                  <td className="p-2 border">{formatFecha(f.fechaLimite)}</td>

  <td className="p-2 border">
                    <span
                      className={`px-2 py-1 rounded font-semibold ${estadoColor(
                        f.estado
                      )}`}
                    >
                      {f.estado}
                    </span>
                  </td>

                  <td className="p-2 border">{f.observacion?.trim() || "-"}</td>

                  <td className="p-2 border">
                    <button
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                      onClick={() => handleVerEntrega(f.id)}
                    >
                      <FaEye />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
