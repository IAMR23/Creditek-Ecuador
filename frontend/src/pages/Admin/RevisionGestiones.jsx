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
  FaFileExcel,
  FaBeer,
} from "react-icons/fa";
import * as XLSX from "xlsx";

const RevisionGestiones = () => {
  const [gestiones, setGestiones] = useState([]);
  const [loading, setLoading] = useState(true);

  const [solicitud, setSolicitud] = useState("");
  const [origen, setOrigen] = useState("");
  const [region, setRegion] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [agencias, setAgencias] = useState([]);

  const today = new Date().toISOString().split("T")[0];

  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);

   const [origenes, setOrigenes] = useState([]);
  
    // 🔽 Obtener lista
    const obtenerOrigenes = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/gestion/origen-callcenter`);
        setOrigenes(res.data);
      } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudieron cargar los orígenes", "error");
      }
    };
  
    useEffect(() => {
      obtenerOrigenes();
    }, []);

  useEffect(() => {
    obtenerGestiones();
  }, []);

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
    cargarAgencias();
  }, []);

  const descargarExcel = () => {
    if (!gestiones || gestiones.length === 0) {
      Swal.fire("Atención", "No hay datos para exportar", "warning");
      return;
    }

    // 🔹 1. Detectar máximo número de otras cédulas
    const maxOtras = Math.max(
      ...gestiones.map((g) =>
        Array.isArray(g.otrasCedulas) ? g.otrasCedulas.length : 0,
      ),
    );

    const data = gestiones.map((g) => {
      const fechaObj = new Date(g.createdAt);

      const fila = {
        Fecha: fechaObj.toISOString().split("T")[0], // YYYY-MM-DD
        Hora: fechaObj.toLocaleTimeString("es-EC", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        Gestor: g.usuarioAgencia?.usuario?.nombre || "",
        Extension: g.extension || "",
        Celular: g.celularGestionado || "",
        Cedula_Principal: g.cedulaGestionado || "",
        Agencia: g.usuarioAgencia?.agencia?.nombre || "",
        Region: g.region || "",
        Dispositivo: g.dispositivo?.nombre || "",
        Origen: g.origen || "",
        Solicitud_Principal: g.solicitud || "",
        Accion: g.accion?.replaceAll("_", " ") || "",
        Observacion: g.observacion || "",
      };

      // 🔹 Columnas dinámicas
      for (let i = 0; i < maxOtras; i++) {
        const cedulaObj =
          Array.isArray(g.otrasCedulas) && g.otrasCedulas[i]
            ? g.otrasCedulas[i]
            : null;

        fila[`Cedula_${i + 1}`] = cedulaObj?.cedula || "";
        fila[`Solicitud_${i + 1}`] = cedulaObj?.solicitud || "";
      }

      return fila;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Gestiones");

    const nombreArchivo = `Reporte_Gestiones_${new Date()
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
      if (region) params.region = region;
      if (agenciaId) params.agenciaId = agenciaId;

      const { data } = await axios.get(`${API_URL}/api/gestion`, {
        params,
      });

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
        <div className="text-gray-500 animate-pulse">Cargando gestiones...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-2">
      <div className="flex justify-between items-center ">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Dashboard de Gestiones
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
              <option value="APROBADO">APROBADO</option>
              <option value="DENEGADO">DENEGADO</option>
            </select>

            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="border px-3 py-2 rounded"
            >
              <option value="">Todas Regiones</option>
              <option value="SIN_ESPECIFICAR">SIN ESPECIFICAR</option>
              <option value="COSTA">COSTA </option>
              <option value="COSTA_APLICA">COSTA ✅</option>
              <option value="COSTA_NO_APLICA">COSTA ❌</option>
              <option value="SIERRA">SIERRA</option>
              <option value="ORIENTE">ORIENTE</option>
              <option value="ORIENTE_APLICA">ORIENTE ✅</option>
              <option value="ORIENTE_NO_APLICA">ORIENTE ❌</option>
            </select>

    
    
              <select
                name="origen"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                required
                className="border px-3 py-2 rounded"
              >
                <option value="">Todos los Origenes</option>

                {origenes.map((o) => (
                  <option key={o.id} value={o.nombre}>
                    {o.nombre}
                  </option>
                ))}
              </select>

            <select
              className="border px-2 py-1 rounded"
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

      {/* CONTENEDOR */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left">#</th>
              <th className="px-6 py-4 text-left">Fecha</th>
              <th className="px-6 py-4 text-left">Gestor</th>
              <th className="px-6 py-4 text-left">Celular Gestionado</th>
              <th className="px-6 py-4 text-left">Cedula Gestionada</th>
              <th className="px-6 py-4 text-left">Agencia</th>
              <th className="px-6 py-4 text-left">Dispositivo</th>
              <th className="px-6 py-4 text-left">Solicitud</th>
              <th className="px-6 py-4 text-left">Acción</th>
              <th className="px-6 py-4 text-left">Otras Cédulas</th>
              <th className="px-6 py-4 text-left">Observacion</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {gestiones.map((g, h) => (
              <tr
                key={g.id}
                className="hover:bg-gray-50 transition-all duration-200"
              >
                <td className="px-6 py-6">
                  <div className="font-semibold text-gray-800">{h + 1}</div>
                </td>

                {/* FECHA */}
                <td className="px-6 py-6">
                  <div className="font-semibold text-gray-800">
                    {formatDate(g.createdAt)}
                  </div>
                </td>

                {/* USUARIO */}
                <td className="px-6 py-6">
                  <div className="font-medium text-gray-800">
                    {g.usuarioAgencia?.usuario?.nombre}
                  </div>
                  <div className="text-xs text-gray-400">
                    Ext: {g.extension}
                  </div>
                </td>

                <td className="px-6 py-6">
                  <div className="font-medium text-gray-800">
                    {g.celularGestionado}
                  </div>
                </td>

                <td className="px-6 py-6">
                  <div className="font-medium text-gray-800">
                    {g.cedulaGestionado}
                  </div>
                </td>

                {/* AGENCIA */}
                <td className="px-6 py-6">
                  <div className="font-medium text-gray-800">
                    {g.usuarioAgencia?.agencia?.nombre}
                  </div>
                  <div className="text-xs text-gray-400">
                    Región: {g.region}
                  </div>
                </td>

                {/* DISPOSITIVO */}
                <td className="px-6 py-6">
                  <div className="font-medium text-gray-700">
                    {g.dispositivo?.nombre}
                  </div>
                  <div className="text-xs text-gray-400">{g.origen}</div>
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
                  {Array.isArray(g.otrasCedulas) &&
                  g.otrasCedulas.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {g.otrasCedulas.map((c, i) => (
                        <span
                          key={i}
                          className={`px-2 py-1 text-xs rounded-md font-medium ${
                            c.solicitud === "APROBADO"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {c.cedula} - {c.solicitud}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-300 text-sm">—</span>
                  )}
                </td>

                <td className="px-6 py-6">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ">
                    {g.observacion}
                  </span>
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
