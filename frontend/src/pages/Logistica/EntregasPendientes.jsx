import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Clock,
  Eye,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import api from "../../api/client";

const ALERTA_MINUTOS = 35 * 60;

const normalizarTexto = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatFecha = (fechaISO) => {
  if (!fechaISO) return "-";

  const date = new Date(fechaISO);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const getMinutosRestantes = (entrega) =>
  (Number(entrega.horasRestantes) || 0) * 60 +
  (Number(entrega.minutosRestantes) || 0);

const formatTiempoRestante = (entrega) => {
  const horas = Number(entrega.horasRestantes) || 0;
  const minutos = Number(entrega.minutosRestantes) || 0;

  if (normalizarTexto(entrega.estado) === "perdida") return "Vencida";
  return `${horas}h ${minutos}m`;
};

const getEstadoClass = (estado) => {
  const valor = normalizarTexto(estado);

  if (valor === "perdida") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (valor === "pendiente") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
};

export default function EntregasPendientes() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const notificadosRef = useRef(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const notificar = (entrega) => {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    new Notification("Entrega por vencer", {
      body: `Entrega #${entrega.id} vence en ${formatTiempoRestante(entrega)}`,
      icon: "/warning.png",
    });
  };

  const verificarAlertas = (data) => {
    data.forEach((entrega) => {
      if (entrega.estado !== "Pendiente") return;
      if (notificadosRef.current.has(entrega.id)) return;

      const totalMinutos = getMinutosRestantes(entrega);

      if (totalMinutos <= ALERTA_MINUTOS && totalMinutos > 0) {
        notificar(entrega);
        notificadosRef.current.add(entrega.id);
      }
    });
  };

  const cargarAlertas = async ({
    notificarPendientes = false,
    silencioso = false,
  } = {}) => {
    if (!silencioso) setLoading(true);
    setError("");

    try {
      const { data } = await api.get("/alertas/entregas-pendientes");
      const entregas = Array.isArray(data) ? data : [];

      setFilas(entregas);
      if (notificarPendientes) verificarAlertas(entregas);
    } catch (err) {
      console.error(err);
      setError("Error al cargar las alertas");
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    cargarAlertas();

    const interval = setInterval(() => {
      cargarAlertas({ notificarPendientes: true, silencioso: true });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const filasFiltradas = useMemo(() => {
    const termino = normalizarTexto(busqueda);
    if (!termino) return filas;

    return filas.filter((entrega) =>
      [
        entrega.id,
        entrega.cliente?.nombre,
        entrega.cliente?.telefono,
        entrega.cliente?.cedula,
        entrega.vendedor,
        entrega.observacion,
      ].some((value) => normalizarTexto(value).includes(termino)),
    );
  }, [busqueda, filas]);

  const resumen = useMemo(() => {
    const perdidas = filas.filter(
      (entrega) => normalizarTexto(entrega.estado) === "perdida",
    ).length;
    const porVencer = filas.filter((entrega) => {
      const minutos = getMinutosRestantes(entrega);
      return minutos > 0 && minutos <= ALERTA_MINUTOS;
    }).length;

    return {
      total: filas.length,
      porVencer,
      perdidas,
      pendientes: filas.length - perdidas,
    };
  }, [filas]);

  const handleVerEntrega = (id) => {
    navigate(`/entrega-logistica/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
      <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Logistica
          </span>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Entregas pendientes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Seguimiento de llamadas pendientes y tiempos limite.
          </p>
        </div>

        <button
          type="button"
          onClick={() => cargarAlertas({ notificarPendientes: true })}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
          Actualizar
        </button>
      </header>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Bell size={18} />} label="Total" value={resumen.total} />
        <Metric
          icon={<Clock size={18} />}
          label="Por vencer"
          value={resumen.porVencer}
          tone="amber"
        />
        <Metric
          icon={<XCircle size={18} />}
          label="Perdidas"
          value={resumen.perdidas}
          tone="red"
        />
        <Metric
          icon={<AlertTriangle size={18} />}
          label="Pendientes"
          value={resumen.pendientes}
          tone="green"
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase text-slate-800">
              Alertas
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {filasFiltradas.length} de {filas.length} registros
            </p>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            <span className="mb-1 block">Buscar</span>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Cliente, telefono, cedula o vendedor"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-96"
              />
            </div>
          </label>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">Caso</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Telefono</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Fecha llamada</th>
                <th className="px-4 py-3">Tiempo restante</th>
                <th className="px-4 py-3">Fecha limite</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Observacion</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading && filas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 animate-spin text-emerald-600" size={24} />
                    Cargando entregas...
                  </td>
                </tr>
              ) : filasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    No hay alertas para mostrar
                  </td>
                </tr>
              ) : (
                filasFiltradas.map((entrega) => (
                  <tr key={entrega.id} className="transition hover:bg-emerald-50/40">
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800">
                      #{entrega.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <UserRound className="shrink-0 text-emerald-600" size={17} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {entrega.cliente?.nombre || "-"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {entrega.cliente?.cedula || "Sin cedula"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <Phone size={15} className="text-slate-400" />
                        {entrega.cliente?.telefono || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                        <Users size={15} className="text-slate-400" />
                        {entrega.vendedor || "-"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatFecha(entrega.FechaHoraLlamada)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-bold tabular-nums text-slate-900">
                        {formatTiempoRestante(entrega)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatFecha(entrega.fechaLimite)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getEstadoClass(
                          entrega.estado,
                        )}`}
                      >
                        {entrega.estado || "-"}
                      </span>
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-slate-600">
                      <span className="line-clamp-2">
                        {entrega.observacion?.trim() || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
                        onClick={() => handleVerEntrega(entrega.id)}
                        title="Ver entrega"
                        aria-label="Ver entrega"
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase opacity-70">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}
