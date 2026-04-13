import { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaFileExcel,
} from "react-icons/fa";
import * as XLSX from "xlsx";

const RevisionGestionesComercial = () => {
  const [gestiones, setGestiones] = useState([]);
  const [loading, setLoading] = useState(true);

  const [solicitud, setSolicitud] = useState("");
  const [origen, setOrigen] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [agencias, setAgencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioAgenciaId, setUsuarioAgenciaId] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);

  const [origenes, setOrigenes] = useState([]);

  const obtenerOrigenes = async () => {
    try {
      const res = await axios.get(`${API_URL}/origen`);
      setOrigenes(res.data || []);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los orígenes", "error");
    }
  };

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    }
  };

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data || []);
    } catch (error) {
      console.error("Error cargando agencias:", error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las agencias.",
      });

      setAgencias([]);
    }
  };

  useEffect(() => {
    cargarUsuarios();
    obtenerOrigenes();
    cargarAgencias();
  }, []);

  useEffect(() => {
    obtenerGestiones();
  }, []);

  const descargarExcel = () => {
    if (!gestiones || gestiones.length === 0) {
      Swal.fire("Atención", "No hay datos para exportar", "warning");
      return;
    }

    const data = gestiones.map((g) => {
      const fechaObj = new Date(g.createdAt);

      return {
        Fecha: fechaObj.toLocaleDateString("es-EC", {
          timeZone: "America/Guayaquil",
        }),
        Hora: fechaObj.toLocaleTimeString("es-EC", {
          timeZone: "America/Guayaquil",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        Gestor: g.usuarioAgencia?.usuario?.nombre || "",
        Agencia: g.usuarioAgencia?.agencia?.nombre || "",
        Celular: g.celularGestionado || "",
        Cedula_Gestionada: g.cedulaGestionado || "",
        Dispositivo: g.dispositivo?.nombre || "",
        Origen: g.origen || "",
        Solicitud: g.solicitud || "",
        Observacion: g.observacion || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Gestiones");

    const nombreArchivo = `Reporte_Gestiones_Comerciales_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    XLSX.writeFile(workbook, nombreArchivo);
  };

  const obtenerGestiones = async () => {
    try {
      setLoading(true);

      const params = {};

      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;
      if (solicitud) params.solicitud = solicitud;
      if (origen) params.origen = origen;
      if (agenciaId) params.agenciaId = agenciaId;
      if (usuarioAgenciaId) params.usuarioAgenciaId = usuarioAgenciaId;

      const { data } = await axios.get(`${API_URL}/api/gestion-comercial`, {
        params,
      });

      setGestiones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error obteniendo gestiones:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las gestiones",
      });
      setGestiones([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString("es-EC", {
      timeZone: "America/Guayaquil",
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const badgeSolicitud = (estado) => {
    if (estado === "APROBADO") {
      return (
        <span className="inline-flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-semibold">
          <FaCheckCircle /> {estado}
        </span>
      );
    }

    if (estado === "DENEGADO") {
      return (
        <span className="inline-flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-full text-xs font-semibold">
          <FaTimesCircle /> {estado}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold">
        <FaClock /> {estado || "NINGUNA"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-gray-500 animate-pulse">Cargando gestiones...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-2">
      <div className="flex justify-between items-center">
        <div className="m-2 w-full">
          <h1 className="text-3xl font-bold text-gray-800">
            Dashboard de Gestiones Comerciales
          </h1>
          <p className="text-gray-500">Seguimiento comercial en tiempo real</p>

          <div className="bg-gray-200 p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="border px-3 py-2 rounded"
            />

            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="border px-3 py-2 rounded"
            />

            <select
              value={solicitud}
              onChange={(e) => setSolicitud(e.target.value)}
              className="border px-3 py-2 rounded"
            >
              <option value="">Todas Solicitudes</option>
              <option value="NINGUNA">NINGUNA</option>
              <option value="APROBADO">APROBADO</option>
              <option value="DENEGADO">DENEGADO</option>
            </select>

            <select
              name="origen"
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="border px-3 py-2 rounded"
            >
              <option value="">Todos los Orígenes</option>
              {origenes.map((o) => (
                <option key={o.id} value={o.nombre}>
                  {o.nombre}
                </option>
              ))}
            </select>

            <select
              className="border px-3 py-2 rounded"
              value={agenciaId}
              onChange={(e) => setAgenciaId(e.target.value)}
            >
              <option value="">Todas las agencias</option>
              {agencias.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
{/* 
            <select
              className="border px-3 py-2 rounded"
              value={usuarioAgenciaId}
              onChange={(e) => setUsuarioAgenciaId(e.target.value)}
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map((u) => (
                <option
                  key={u.id}
                  value={u.agenciaPrincipal?.usuarioAgenciaId || ""}
                >
                  {u.nombre}
                </option>
              ))}
            </select> */}

            <button
              onClick={obtenerGestiones}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Filtrar
            </button>

            <button
              onClick={descargarExcel}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-3 rounded"
            >
              <FaFileExcel size={25} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left">#</th>
              <th className="px-6 py-4 text-left">Fecha</th>
              <th className="px-6 py-4 text-left">Gestor</th>
              <th className="px-6 py-4 text-left">Celular Gestionado</th>
              <th className="px-6 py-4 text-left">Cédula Gestionada</th>
              <th className="px-6 py-4 text-left">Agencia</th>
              <th className="px-6 py-4 text-left">Dispositivo</th>
              <th className="px-6 py-4 text-left">Origen</th>
              <th className="px-6 py-4 text-left">Solicitud</th>
              <th className="px-6 py-4 text-left">Observación</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {gestiones.length > 0 ? (
              gestiones.map((g, h) => (
                <tr
                  key={g.id}
                  className="hover:bg-gray-50 transition-all duration-200"
                >
                  <td className="px-6 py-6">
                    <div className="font-semibold text-gray-800">{h + 1}</div>
                  </td>

                  <td className="px-6 py-6">
                    <div className="font-semibold text-gray-800">
                      {formatDate(g.createdAt)}
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    <div className="font-medium text-gray-800">
                      {g.usuarioAgencia?.usuario?.nombre || "—"}
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    <div className="font-medium text-gray-800">
                      {g.celularGestionado || "—"}
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    <div className="font-medium text-gray-800">
                      {g.cedulaGestionado || "—"}
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    <div className="font-medium text-gray-800">
                      {g.usuarioAgencia?.agencia?.nombre || "—"}
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    <div className="font-medium text-gray-700">
                      {g.dispositivo?.nombre || "—"}
                    </div>
                  </td>

                  <td className="px-6 py-6">
                    <div className="font-medium text-gray-700">
                      {g.origen || "—"}
                    </div>
                  </td>

                  <td className="px-6 py-6">{badgeSolicitud(g.solicitud)}</td>

                  <td className="px-6 py-6">
                    <span className="text-sm text-gray-700">
                      {g.observacion || "—"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={10}
                  className="px-6 py-10 text-center text-gray-400"
                >
                  No hay gestiones para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RevisionGestionesComercial;