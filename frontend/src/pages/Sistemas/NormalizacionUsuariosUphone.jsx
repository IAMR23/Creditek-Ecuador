import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  CheckCircle2,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Search,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { api } from "../../api/client";

const ENDPOINT = "/api/sistemas/uphone-usuarios";

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const formatearFecha = (fecha) => {
  if (!fecha) return "Sin actividad";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
  }).format(new Date(`${String(fecha).slice(0, 10)}T12:00:00`));
};

export default function NormalizacionUsuariosUphone() {
  const [normalizaciones, setNormalizaciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [selecciones, setSelecciones] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(ENDPOINT);
      const filas = data.normalizaciones || [];
      setNormalizaciones(filas);
      setUsuarios(data.usuarios || []);
      setSelecciones(
        Object.fromEntries(
          filas.map((fila) => [
            fila.usuarioUphone,
            fila.usuarioRve?.id ? String(fila.usuarioRve.id) : "",
          ]),
        ),
      );
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo cargar la normalización Uphone."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase("es");
    if (!texto) return normalizaciones;
    return normalizaciones.filter((fila) =>
      [
        fila.usuarioUphone,
        fila.nombreReportado,
        fila.usuarioRve?.nombre,
        fila.usuarioRve?.email,
      ].some((valor) => String(valor || "").toLocaleLowerCase("es").includes(texto)),
    );
  }, [busqueda, normalizaciones]);

  const totales = useMemo(() => {
    const asignadas = normalizaciones.filter((fila) => fila.usuarioRve).length;
    return {
      claves: normalizaciones.length,
      asignadas,
      pendientes: normalizaciones.length - asignadas,
    };
  }, [normalizaciones]);

  const guardar = async (fila) => {
    const valorSeleccionado = selecciones[fila.usuarioUphone] || "";
    const usuarioId = valorSeleccionado ? Number(valorSeleccionado) : null;
    const idActual = fila.usuarioRve?.id || null;
    if (usuarioId === idActual) return;

    const usuarioDestino = usuarios.find((usuario) => usuario.id === usuarioId);
    const impactos = [];
    if (fila.usuarioRve && fila.usuarioRve.id !== usuarioId) {
      impactos.push(`${fila.usuarioRve.nombre} dejará de usar ${fila.usuarioUphone}.`);
    }
    if (
      usuarioDestino?.usuarioUphone &&
      usuarioDestino.usuarioUphone !== fila.usuarioUphone
    ) {
      impactos.push(
        `${usuarioDestino.nombre} dejará sin asignar su clave ${usuarioDestino.usuarioUphone}.`,
      );
    }

    const detalleImpactos = impactos.length ? `\n\n${impactos.join("\n")}` : "";
    const confirmacion = await Swal.fire({
      title: usuarioDestino ? "¿Asignar clave Uphone?" : "¿Dejar clave sin asignar?",
      text: usuarioDestino
        ? `${fila.usuarioUphone} se vinculará con ${usuarioDestino.nombre}.${detalleImpactos}`
        : `${fila.usuarioUphone} quedará disponible para una asignación posterior.${detalleImpactos}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
    });

    if (!confirmacion.isConfirmed) {
      setSelecciones((actual) => ({
        ...actual,
        [fila.usuarioUphone]: idActual ? String(idActual) : "",
      }));
      return;
    }

    setGuardando(fila.usuarioUphone);
    try {
      const { data } = await api.put(
        `${ENDPOINT}/${encodeURIComponent(fila.usuarioUphone)}`,
        { usuarioId },
      );
      await cargar();
      Swal.fire({
        title: "Guardado",
        text: data.message,
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo guardar la asignación."),
        "error",
      );
    } finally {
      setGuardando(null);
    }
  };

  const tarjetas = [
    {
      label: "Claves Uphone",
      value: totales.claves,
      icon: KeyRound,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Normalizadas",
      value: totales.asignadas,
      icon: UserRoundCheck,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Pendientes",
      value: totales.pendientes,
      icon: UserRoundX,
      color: "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Sistemas · Uphone
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Normalización de usuarios Uphone
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              La clave Uphone es el identificador estable. Vincúlala con la persona que
              la usa actualmente en RVE, aunque el reporte conserve el nombre histórico
              del propietario anterior.
            </p>
          </div>
          <button
            type="button"
            onClick={cargar}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {tarjetas.map(({ label, value, icon: Icono, color }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
                </div>
                <div className={`rounded-xl p-3 ${color}`}>
                  <Icono size={24} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <Link2 size={19} className="text-blue-600" />
                Tabla de equivalencias
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Los cambios afectan el nombre mostrado en los reportes; no alteran las solicitudes históricas.
              </p>
            </div>
            <label className="relative block sm:w-80">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar clave, nombre o correo..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-slate-500">
              <Loader2 size={22} className="animate-spin" /> Cargando normalizaciones...
            </div>
          ) : filasFiltradas.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center text-slate-500">
              <CheckCircle2 size={36} className="mb-3 text-slate-300" />
              <p className="font-medium">No hay claves que coincidan con la búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Clave Uphone</th>
                    <th className="px-4 py-3">Nombre en reporte</th>
                    <th className="px-4 py-3">Actividad</th>
                    <th className="min-w-72 px-4 py-3">Persona actual en RVE</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filasFiltradas.map((fila) => {
                    const seleccion = selecciones[fila.usuarioUphone] || "";
                    const modificada = seleccion !== String(fila.usuarioRve?.id || "");
                    const estaGuardando = guardando === fila.usuarioUphone;
                    return (
                      <tr key={fila.usuarioUphone} className="align-middle hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <span className="rounded-md bg-blue-50 px-2.5 py-1 font-mono font-semibold text-blue-700">
                            {fila.usuarioUphone}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-800">
                            {fila.nombreReportado || "Sin nombre reportado"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">Dato histórico de Uphone</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                          <p>{fila.solicitudes} solicitudes</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Última: {formatearFecha(fila.ultimaSolicitud)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={seleccion}
                            onChange={(event) =>
                              setSelecciones((actual) => ({
                                ...actual,
                                [fila.usuarioUphone]: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="">Sin asignar</option>
                            {usuarios.map((usuario) => (
                              <option key={usuario.id} value={usuario.id}>
                                {usuario.nombre} · {usuario.email}
                                {!usuario.activo ? " (inactivo)" : ""}
                                {usuario.usuarioUphone &&
                                usuario.usuarioUphone !== fila.usuarioUphone
                                  ? ` · usa ${usuario.usuarioUphone}`
                                  : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          {fila.usuarioRve ? (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Normalizada
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => guardar(fila)}
                            disabled={!modificada || Boolean(guardando)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {estaGuardando ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Save size={15} />
                            )}
                            Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
