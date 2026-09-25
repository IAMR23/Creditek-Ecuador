import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Swal from "sweetalert2";
import api from "../../api/client";
import {
  FaBuilding,
  FaChartBar,
  FaCheckCircle,
  FaClock,
  FaFileExcel,
  FaTable,
  FaTimesCircle,
  FaUserTie,
} from "react-icons/fa";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";

const ECUADOR_TIME_ZONE = "America/Guayaquil";
const ECUADOR_HOUR_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: ECUADOR_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

const agruparGestiones = (gestiones, obtenerGrupo) => {
  const grupos = new Map();

  gestiones.forEach((gestion) => {
    const datosGrupo = obtenerGrupo(gestion) || {};
    const nombre = datosGrupo.name || "Sin asignar";
    const clave = datosGrupo.id ? `${datosGrupo.id}:${nombre}` : nombre;
    const grupo = grupos.get(clave) || {
      name: nombre,
      gestiones: 0,
    };

    grupo.gestiones += 1;
    grupos.set(clave, grupo);
  });

  return [...grupos.values()]
    .sort((a, b) => b.gestiones - a.gestiones || a.name.localeCompare(b.name));
};

const agruparGestionesPorHora = (gestiones) => {
  const grupos = new Map();

  gestiones.forEach((gestion) => {
    const fecha = new Date(gestion.createdAt);
    if (Number.isNaN(fecha.getTime())) return;

    const hora = Number(ECUADOR_HOUR_FORMATTER.format(fecha));

    grupos.set(hora, (grupos.get(hora) || 0) + 1);
  });

  return [...grupos.entries()]
    .sort(([horaA], [horaB]) => horaA - horaB)
    .map(([hora, gestiones]) => ({
      name: `${String(hora).padStart(2, "0")}:00`,
      gestiones,
    }));
};

const ResumenCard = ({ icon, label, value, detail, color }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{detail}</p>
      </div>
      <div className={`rounded-xl p-3 text-white ${color}`}>{icon}</div>
    </div>
  </div>
);

ResumenCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  detail: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};

const GraficaGestiones = ({ title, subtitle, data, color, type = "barras" }) => {
  if (!data.length) {
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        <div className="flex h-72 items-center justify-center text-sm text-slate-400">
          No hay datos para mostrar con los filtros seleccionados.
        </div>
      </section>
    );
  }

  const chartWidth = Math.max(620, data.length * 90);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-5 overflow-x-auto">
        <div style={{ height: 380, width: chartWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            {type === "linea" ? (
              <LineChart
                data={data}
                margin={{ top: 12, right: 24, left: 0, bottom: 35 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  height={50}
                  tick={{ fill: "#475569", fontSize: 12 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [value, "Gestiones"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                />
                <Line
                  type="monotone"
                  dataKey="gestiones"
                  name="Gestiones"
                  stroke={color}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : (
              <BarChart
                data={data}
                margin={{ top: 5, right: 24, left: 0, bottom: 75 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={90}
                  tick={{ fill: "#475569", fontSize: 12 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [value, "Gestiones"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                />
                <Bar
                  dataKey="gestiones"
                  name="Gestiones"
                  fill={color}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

GraficaGestiones.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      gestiones: PropTypes.number.isRequired,
    }),
  ).isRequired,
  color: PropTypes.string.isRequired,
  type: PropTypes.oneOf(["barras", "linea"]),
};

const RevisionGestionesComercial = () => {
  const [gestiones, setGestiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pestanaActiva, setPestanaActiva] = useState("tabla");

  const [solicitud, setSolicitud] = useState("");
  const [origen, setOrigen] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [agencias, setAgencias] = useState([]);

  const today = new Date().toISOString().split("T")[0];
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);

  const [origenes, setOrigenes] = useState([]);

  const obtenerOrigenes = async () => {
    try {
      const res = await api.get("/origen");
      setOrigenes(res.data || []);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudieron cargar los orígenes", "error");
    }
  };

  const cargarAgencias = async () => {
    try {
      const res = await api.get("/agencias");
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
    obtenerOrigenes();
    cargarAgencias();
  }, []);

  useEffect(() => {
    obtenerGestiones();
    // La carga inicial usa los filtros por defecto; los cambios se aplican con el botón Filtrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          timeZone: ECUADOR_TIME_ZONE,
        }),
        Hora: fechaObj.toLocaleTimeString("es-EC", {
          timeZone: ECUADOR_TIME_ZONE,
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

      const { data } = await api.get("/api/gestion-comercial", {
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

  const resumen = useMemo(() => {
    const porUsuario = agruparGestiones(
      gestiones,
      (gestion) => ({
        id: gestion.usuarioAgencia?.usuario?.id,
        name: gestion.usuarioAgencia?.usuario?.nombre,
      }),
    );
    const porAgencia = agruparGestiones(
      gestiones,
      (gestion) => ({
        id: gestion.usuarioAgencia?.agencia?.id,
        name: gestion.usuarioAgencia?.agencia?.nombre,
      }),
    );
    const porHora = agruparGestionesPorHora(gestiones);

    return {
      totalGestiones: gestiones.length,
      totalUsuarios: porUsuario.filter((item) => item.name !== "Sin asignar")
        .length,
      totalAgencias: porAgencia.filter((item) => item.name !== "Sin asignar")
        .length,
      porUsuario,
      porAgencia,
      porHora,
    };
  }, [gestiones]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("es-EC", {
      timeZone: ECUADOR_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString("es-EC", {
      timeZone: ECUADOR_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
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

      <div className="mb-5 flex gap-2 border-b border-slate-200 px-2">
        <button
          type="button"
          onClick={() => setPestanaActiva("tabla")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            pestanaActiva === "tabla"
              ? "border-green-600 text-green-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FaTable />
          Tabla de gestiones
        </button>
        <button
          type="button"
          onClick={() => setPestanaActiva("graficas")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            pestanaActiva === "graficas"
              ? "border-green-600 text-green-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FaChartBar />
          Gráficas
        </button>
      </div>

      {pestanaActiva === "tabla" ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-4 text-left">#</th>
              <th className="px-6 py-4 text-left">Fecha de creación</th>
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
                    <div className="mt-1 text-xs text-gray-500">
                      {formatTime(g.createdAt)}
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
      ) : (
        <div className="space-y-6 px-2 pb-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ResumenCard
              icon={<FaChartBar size={20} />}
              label="Total de gestiones"
              value={resumen.totalGestiones}
              detail="Registros ingresados en el período"
              color="bg-sky-600"
            />
            <ResumenCard
              icon={<FaUserTie size={20} />}
              label="Usuarios con gestiones"
              value={resumen.totalUsuarios}
              detail="Gestores que ingresaron información"
              color="bg-violet-600"
            />
            <ResumenCard
              icon={<FaBuilding size={20} />}
              label="Agencias con gestiones"
              value={resumen.totalAgencias}
              detail="Agencias activas en el resultado"
              color="bg-amber-500"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <GraficaGestiones
              title="Gestiones por usuario"
              subtitle="Quién ingresó las gestiones y cuántas registró."
              data={resumen.porUsuario}
              color="#16a34a"
            />
            <GraficaGestiones
              title="Gestiones por agencia"
              subtitle="Cantidad total de gestiones registradas por agencia."
              data={resumen.porAgencia}
              color="#0284c7"
            />
            <div className="xl:col-span-2">
              <GraficaGestiones
                title="Gestiones por hora del día"
                subtitle="Horas en las que se registran más gestiones, según la hora de creación en Ecuador."
                data={resumen.porHora}
                color="#7c3aed"
                type="linea"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Todas las métricas respetan los filtros seleccionados.
          </p>
        </div>
      )}
    </div>
  );
};

export default RevisionGestionesComercial;
