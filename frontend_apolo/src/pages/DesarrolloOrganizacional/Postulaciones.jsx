import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Search, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import ModalDetalle from "../../components/PostulacionDetalle";

const dash = "-";

const getDatos = (postulacion) => postulacion?.formulario?.datos_personales || {};
const getVivienda = (postulacion) => postulacion?.formulario?.vivienda_actual || {};

const formatDate = (date) => {
  if (!date) return dash;
  return new Date(date).toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export default function Postulaciones() {
  const [postulaciones, setPostulaciones] = useState([]);
  const [cedula, setCedula] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [selected, setSelected] = useState(null);

  const total = useMemo(() => postulaciones.length, [postulaciones]);

  const fetchPostulaciones = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/postulaciones");
      setPostulaciones(res.data.data || []);
      setCedula("");
    } catch (err) {
      const message = err.response?.data?.message || "Error cargando postulaciones";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setLoading(false);
    }
  };

  const buscarPorCedula = async () => {
    const cedulaLimpia = cedula.trim();

    if (!cedulaLimpia) return fetchPostulaciones();

    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/api/postulaciones/cedula/${encodeURIComponent(cedulaLimpia)}`);
      setPostulaciones(res.data.data ? [res.data.data] : []);
    } catch {
      setPostulaciones([]);
      setError("No se encontro una postulacion con esa cedula");
      Swal.fire("Sin resultados", "No se encontro una postulacion con esa cedula", "info");
    } finally {
      setLoading(false);
    }
  };

  const eliminarPostulacion = async (postulacion) => {
    const datos = getDatos(postulacion);
    const nombre = datos.nombreCompleto || postulacion.nombre || `ID ${postulacion.id}`;
    const { isConfirmed } = await Swal.fire({
      title: "Eliminar postulacion",
      text: `Deseas eliminar la postulacion de ${nombre}? Esta accion no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!isConfirmed) return;

    try {
      setDeletingId(postulacion.id);
      setError("");
      await api.delete(`/api/postulaciones/${postulacion.id}`);
      setPostulaciones((prev) => prev.filter((item) => item.id !== postulacion.id));
      setSelected((prev) => (prev?.id === postulacion.id ? null : prev));
      Swal.fire("Eliminada", "La postulacion fue eliminada correctamente", "success");
    } catch (err) {
      const message = err.response?.data?.message || "No se pudo eliminar la postulacion";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchPostulaciones();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Desarrollo Organizacional
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Postulaciones
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {total} registro{total === 1 ? "" : "s"} disponible{total === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarPorCedula()}
                placeholder="Buscar por cedula"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 sm:w-72"
              />
            </div>

            <button
              onClick={buscarPorCedula}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Search size={17} />
              Buscar
            </button>

            <button
              onClick={fetchPostulaciones}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={17} />
              Ver todos
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm font-medium text-slate-600">
              Cargando postulaciones...
            </div>
          ) : postulaciones.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-base font-semibold text-slate-800">
                No hay postulaciones para mostrar
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Cuando se envie un formulario, aparecera en esta vista.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Aspirante</th>
                    <th className="px-4 py-3">Cedula</th>
                    <th className="px-4 py-3">Edad</th>
                    <th className="px-4 py-3">Ciudad</th>
                    <th className="px-4 py-3">Vivienda</th>
                    <th className="px-4 py-3">Trabajos</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {postulaciones.map((p) => {
                    const datos = getDatos(p);
                    const vivienda = getVivienda(p);
                    const trabajos = p.formulario?.historial_laboral?.length || 0;

                    return (
                      <tr key={p.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">
                            {datos.nombreCompleto || p.nombre || dash}
                          </div>
                          <div className="text-xs text-slate-500">ID #{p.id}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {datos.cedula || p.cedula || dash}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {datos.edadCumplida || dash}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {datos.ciudadNacimiento === "Otra"
                            ? datos.otraCiudadNacimiento || "Otra"
                            : datos.ciudadNacimiento || dash}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {vivienda.tipoVivienda || dash}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{trabajos}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {formatDate(p.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSelected(p)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              <Eye size={16} />
                              Ver
                            </button>
                            <button
                              onClick={() => eliminarPostulacion(p)}
                              disabled={deletingId === p.id}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 size={16} />
                              {deletingId === p.id ? "Eliminando" : "Eliminar"}
                            </button>
                          </div>
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

      {selected && <ModalDetalle postulacion={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
