import { useCallback, useEffect, useState } from "react";
import { Bell, Clock3, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export default function Notificaciones() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/usuarios/notificaciones-90-dias");
      setUsuarios(response.data?.data || []);
    } catch (requestError) {
      setUsuarios([]);
      setError(
        requestError.response?.data?.message ||
          "No se pudieron cargar las notificaciones.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600">
            Administración
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
            Notificaciones
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Usuarios activos que cumplieron 90 días o más desde su creación.
          </p>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </header>

      <section className="mb-5 flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Bell size={24} />
        </span>
        <div>
          <p className="text-3xl font-extrabold text-slate-950">
            {loading ? "—" : usuarios.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Notificaciones activas por antigüedad
          </p>
        </div>
      </section>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm font-semibold text-slate-500">
            <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
            Cargando notificaciones...
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <Bell size={34} className="text-emerald-500" />
            <p className="mt-3 text-base font-extrabold text-slate-800">
              No hay notificaciones pendientes
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Ningún usuario activo ha cumplido todavía 90 días desde su creación.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-extrabold">Usuario</th>
                  <th className="px-4 py-3 font-extrabold">Rol</th>
                  <th className="px-4 py-3 font-extrabold">Agencia / Departamento</th>
                  <th className="px-4 py-3 font-extrabold">Fecha de creación</th>
                  <th className="px-4 py-3 font-extrabold">Antigüedad</th>
                  <th className="px-5 py-3 text-right font-extrabold">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <p className="font-extrabold text-slate-900">{usuario.nombre || "Sin nombre"}</p>
                      <p className="mt-1 text-xs text-slate-500">{usuario.email}</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                      {usuario.rol?.nombre || "-"}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {(usuario.agencias || []).length
                        ? usuario.agencias.map((agencia) => agencia.nombre).join(", ")
                        : "Sin asignación activa"}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                      {formatDate(usuario.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-800">
                        <Clock3 size={14} />
                        {usuario.diasDesdeCreacion} días
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to="/usuarios"
                        className="inline-flex rounded-lg px-3 py-2 text-xs font-extrabold text-orange-600 transition hover:bg-orange-50"
                      >
                        Ver usuarios
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
