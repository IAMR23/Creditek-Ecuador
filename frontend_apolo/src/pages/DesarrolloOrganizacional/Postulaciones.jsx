import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Search, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import ModalDetalle from "../../components/PostulacionDetalle";

const dash = "-";
const POSTULACIONES_EVENT = "apolo:postulaciones-updated";

const getDatos = (postulacion) => postulacion?.formulario?.datos_personales || {};
const getVivienda = (postulacion) => postulacion?.formulario?.vivienda_actual || {};

const formatDate = (date) => {
  if (!date) return dash;
  return new Date(date).toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const thClass = "px-1.5 py-2 text-[10px] font-bold leading-tight md:px-2 lg:text-xs";
const tdClass = "min-w-0 break-words px-1.5 py-2 text-[10px] leading-tight text-slate-700 md:px-2 lg:text-xs";

export default function Postulaciones() {
  const [postulaciones, setPostulaciones] = useState([]);
  const [cedula, setCedula] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [resumen, setResumen] = useState({ total: 0, noLeidas: 0 });

  const total = useMemo(() => postulaciones.length, [postulaciones]);

  const actualizarResumen = async () => {
    try {
      const res = await api.get("/api/postulaciones/resumen");
      setResumen(res.data?.data || { total: 0, noLeidas: 0 });
    } catch {
      // La vista principal puede seguir funcionando aunque falle el resumen.
    }
  };

  const fetchPostulaciones = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/postulaciones");
      setPostulaciones(res.data.data || []);
      setCedula("");
      await actualizarResumen();
      window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
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
      await actualizarResumen();
    } catch {
      setPostulaciones([]);
      setError("No se encontro una postulacion con esa cedula");
      Swal.fire("Sin resultados", "No se encontro una postulacion con esa cedula", "info");
    } finally {
      setLoading(false);
    }
  };

  const verPostulacion = async (postulacion) => {
    setSelected(postulacion);

    if (postulacion.leida) return;

    try {
      const res = await api.patch(`/api/postulaciones/${postulacion.id}/leida`);
      const postulacionActualizada = res.data?.data;
      const resumenActualizado = res.data?.resumen;

      setPostulaciones((prev) =>
        prev.map((item) =>
          item.id === postulacion.id
            ? {
                ...item,
                leida: true,
                leidaAt: postulacionActualizada?.leidaAt || new Date().toISOString(),
              }
            : item
        )
      );

      if (selected?.id === postulacion.id) {
        setSelected((prev) =>
          prev
            ? {
                ...prev,
                leida: true,
                leidaAt: postulacionActualizada?.leidaAt || new Date().toISOString(),
              }
            : prev
        );
      }

      if (resumenActualizado) setResumen(resumenActualizado);
      window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
    } catch {
      // Si falla el marcado, igual permitimos ver el detalle.
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
      await actualizarResumen();
      window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
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
            <p className="mt-1 text-sm font-medium text-red-600">
              {resumen.noLeidas} no leida{resumen.noLeidas === 1 ? "" : "s"}.
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
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-left text-[10px] leading-tight lg:text-xs">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[4%]" />
                  <col className="w-[4%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[13%]" />
                  <col className="w-[7%]" />
                  <col className="w-[5%]" />
                  <col className="w-[7%]" />
                  <col className="w-[9%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead className="border-b border-slate-200 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className={thClass}>Aspirante</th>
                    <th className={thClass}>Cedula</th>
                    <th className={thClass}>Telefono</th>
                    <th className={thClass}>Edad</th>
                    <th className={thClass}>Hijos</th>
                    <th className={thClass}>Estado civil</th>
                    <th className={thClass}>Ciudad</th>
                    <th className={thClass}>Direccion</th>
                    <th className={thClass}>Vivienda</th>
                    <th className={thClass}>Trab.</th>
                    <th className={thClass}>Estado</th>
                    <th className={thClass}>Fecha</th>
                    <th className={`${thClass} text-right`}>Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {postulaciones.map((p) => {
                    const datos = getDatos(p);
                    const vivienda = getVivienda(p);
                    const trabajos = p.formulario?.historial_laboral?.length || 0;

                    return (
                      <tr key={p.id} className="transition hover:bg-slate-50">
                        <td className={tdClass}>
                          <div className="min-w-0 break-words font-semibold text-slate-900">
                            {datos.nombreCompleto || p.nombre || dash}
                          </div>
                          <div className="text-xs text-slate-500">ID #{p.id}</div>
                        </td>
                        <td className={tdClass}>
                          {datos.cedula || p.cedula || dash}
                        </td>
                        <td className={tdClass}>
                          {datos.telefono || p.telefono || dash}
                        </td>
                        <td className={tdClass}>
                          {datos.edadCumplida || dash}
                        </td>
                        <td className={tdClass}>
                          {datos.numeroHijos || dash}
                        </td>
                        <td className={tdClass}>
                          {datos.estadoCivil || dash}
                        </td>
                        <td className={tdClass}>
                          {datos.ciudadNacimiento === "Otra"
                            ? datos.otraCiudadNacimiento || "Otra"
                            : datos.ciudadNacimiento || dash}
                        </td>
                        <td className={tdClass}>
                          {datos.direccion || dash}
                        </td>
                        <td className={tdClass}>
                          {vivienda.tipoVivienda || dash}
                        </td>
                        <td className={tdClass}>{trabajos}</td>
                        <td className={tdClass}>
                          <span
                            className={`inline-block rounded-full px-1.5 py-1 text-[10px] font-bold leading-none ${
                              p.leida
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {p.leida ? "Leida" : "No leida"}
                          </span>
                        </td>
                        <td className={tdClass}>
                          {formatDate(p.createdAt)}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => verPostulacion(p)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white transition hover:bg-slate-700"
                              aria-label="Ver postulacion"
                              title="Ver"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => eliminarPostulacion(p)}
                              disabled={deletingId === p.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Eliminar postulacion"
                              title={deletingId === p.id ? "Eliminando" : "Eliminar"}
                            >
                              <Trash2 size={14} />
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
