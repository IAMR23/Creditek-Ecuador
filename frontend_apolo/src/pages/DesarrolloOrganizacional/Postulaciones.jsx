import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Undo2,
  UserCheck,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import ModalDetalle from "../../components/PostulacionDetalle";

const dash = "-";
const POSTULACIONES_EVENT = "apolo:postulaciones-updated";
const PAGE_SIZE = 10;
const createEmptyFilters = () => ({
  q: "",
  fechaDesde: "",
  fechaHasta: "",
  estado: "",
  edadDesde: "",
  edadHasta: "",
  ciudad: "",
  tituloTercerNivel: "",
});

const createInitialFilters = (modo) => ({
  ...createEmptyFilters(),
  edadDesde: modo === "postulacion" ? "18" : "",
  edadHasta: modo === "postulacion" ? "35" : "",
  tituloTercerNivel: modo === "postulacion" ? "no" : "",
});

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

export default function Postulaciones({ modo = "postulacion" }) {
  const esEntrevistas = modo === "entrevista";
  const [postulaciones, setPostulaciones] = useState([]);
  const [filters, setFilters] = useState(() => createInitialFilters(modo));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [resumen, setResumen] = useState({
    totalGeneral: 0,
    total: 0,
    noLeidas: 0,
    entrevistas: 0,
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [observacionesDraft, setObservacionesDraft] = useState({});
  const [savingObservationId, setSavingObservationId] = useState(null);
  const [editingObservationId, setEditingObservationId] = useState(null);
  const [updatingStageId, setUpdatingStageId] = useState(null);
  const requestIdRef = useRef(0);

  const total = useMemo(() => pagination.total || postulaciones.length, [pagination.total, postulaciones.length]);

  const syncObservacionesDraft = (items = []) => {
    setObservacionesDraft(
      Object.fromEntries(items.map((item) => [item.id, item.observacion || ""]))
    );
  };

  const actualizarResumen = async () => {
    try {
      const res = await api.get("/api/postulaciones/resumen");
      setResumen(
        res.data?.data || {
          totalGeneral: 0,
          total: 0,
          noLeidas: 0,
          entrevistas: 0,
        },
      );
    } catch {
      // La vista principal puede seguir funcionando aunque falle el resumen.
    }
  };

  const fetchPostulaciones = async (pageToLoad = page, filtersToUse = filters) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      setError("");
      const res = await api.get("/api/postulaciones", {
        params: {
          page: pageToLoad,
          limit: PAGE_SIZE,
          q: filtersToUse.q.trim() || undefined,
          fechaDesde: filtersToUse.fechaDesde || undefined,
          fechaHasta: filtersToUse.fechaHasta || undefined,
          estado: filtersToUse.estado || undefined,
          edadDesde: filtersToUse.edadDesde || undefined,
          edadHasta: filtersToUse.edadHasta || undefined,
          ciudad: filtersToUse.ciudad.trim() || undefined,
          tituloTercerNivel: filtersToUse.tituloTercerNivel || undefined,
          fase: modo,
        },
      });
      const items = res.data.data || [];
      const paginationData = res.data.pagination || {
        total: items.length,
        page: pageToLoad,
        limit: PAGE_SIZE,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: pageToLoad > 1,
      };

      if (requestId !== requestIdRef.current) return;

      setPostulaciones(items);
      syncObservacionesDraft(items);
      setPagination(paginationData);
      setPage(paginationData.page || pageToLoad);
      await actualizarResumen();
      window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = err.response?.data?.message || "Error cargando postulaciones";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFilters(createEmptyFilters());
  };

  const irPagina = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.totalPages || loading) return;
    fetchPostulaciones(nextPage, filters);
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

  const guardarObservacion = async (postulacion) => {
    const observacion = observacionesDraft[postulacion.id] || "";

    try {
      setSavingObservationId(postulacion.id);
      setError("");
      const res = await api.patch(`/api/postulaciones/${postulacion.id}/observacion`, {
        observacion,
      });
      const postulacionActualizada = res.data?.data;

      setPostulaciones((prev) =>
        prev.map((item) =>
          item.id === postulacion.id
            ? { ...item, observacion: postulacionActualizada?.observacion || "" }
            : item
        )
      );
      setSelected((prev) =>
        prev?.id === postulacion.id
          ? { ...prev, observacion: postulacionActualizada?.observacion || "" }
          : prev
      );
      setEditingObservationId(null);
      Swal.fire("Guardado", "La observacion fue guardada correctamente", "success");
    } catch (err) {
      const message = err.response?.data?.message || "No se pudo guardar la observacion";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setSavingObservationId(null);
    }
  };

  const actualizarObservacionDraft = (postulacionId, value) => {
    setObservacionesDraft((prev) => ({ ...prev, [postulacionId]: value }));
  };

  const editarObservacion = (postulacion) => {
    setObservacionesDraft((prev) => ({
      ...prev,
      [postulacion.id]: prev[postulacion.id] ?? postulacion.observacion ?? "",
    }));
    setEditingObservationId(postulacion.id);
  };

  const cancelarEdicionObservacion = (postulacion) => {
    setObservacionesDraft((prev) => ({
      ...prev,
      [postulacion.id]: postulacion.observacion || "",
    }));
    setEditingObservationId(null);
  };

  const actualizarFaseEntrevista = async (postulacion, pasaEntrevista) => {
    const datos = getDatos(postulacion);
    const nombre = datos.nombreCompleto || postulacion.nombre || `ID ${postulacion.id}`;
    const accion = pasaEntrevista ? "pasar a entrevista" : "devolver a postulaciones";
    const { isConfirmed } = await Swal.fire({
      title: pasaEntrevista ? "Pasar a entrevista" : "Volver a postulaciones",
      text: `¿Deseas ${accion} a ${nombre}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: pasaEntrevista ? "#059669" : "#ea580c",
      cancelButtonColor: "#64748b",
      confirmButtonText: pasaEntrevista ? "Sí, pasar" : "Sí, devolver",
      cancelButtonText: "Cancelar",
    });

    if (!isConfirmed) return;

    try {
      setUpdatingStageId(postulacion.id);
      setError("");
      await api.patch(`/api/postulaciones/${postulacion.id}/entrevista`, {
        pasaEntrevista,
      });

      setSelected((prev) => (prev?.id === postulacion.id ? null : prev));
      const nextPage = postulaciones.length === 1 && page > 1 ? page - 1 : page;
      await fetchPostulaciones(nextPage, filters);

      Swal.fire(
        "Actualizado",
        pasaEntrevista
          ? "El postulante ahora se encuentra en la sección Entrevistas."
          : "El postulante regresó a la sección Postulaciones.",
        "success",
      );
    } catch (err) {
      const message =
        err.response?.data?.message || "No se pudo actualizar la fase del postulante";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setUpdatingStageId(null);
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
      setSelected((prev) => (prev?.id === postulacion.id ? null : prev));
      const nextPage = postulaciones.length === 1 && page > 1 ? page - 1 : page;
      await fetchPostulaciones(nextPage, filters);
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
    const timeoutId = setTimeout(() => {
      fetchPostulaciones(1, filters);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Desarrollo Organizacional
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {esEntrevistas ? "Entrevistas" : "Postulaciones"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {total} postulante{total === 1 ? "" : "s"} en esta fase.
            </p>
            {!esEntrevistas && (
              <p className="mt-1 text-sm font-medium text-red-600">
                {resumen.noLeidas} no leida{resumen.noLeidas === 1 ? "" : "s"}.
              </p>
            )}
          </div>

          <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <div className="xl:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Buscar
              </label>
              <div className="relative">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={filters.q}
                  onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                  placeholder="Nombre, telefono o cedula"
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Edad desde
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={filters.edadDesde}
                onChange={(e) => setFilters((prev) => ({ ...prev, edadDesde: e.target.value }))}
                placeholder="Mínima"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Edad hasta
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={filters.edadHasta}
                onChange={(e) => setFilters((prev) => ({ ...prev, edadHasta: e.target.value }))}
                placeholder="Máxima"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Ciudad
              </label>
              <input
                type="text"
                value={filters.ciudad}
                onChange={(e) => setFilters((prev) => ({ ...prev, ciudad: e.target.value }))}
                placeholder="Escriba una ciudad"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Título de tercer nivel
              </label>
              <select
                value={filters.tituloTercerNivel}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, tituloTercerNivel: e.target.value }))
                }
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                <option value="">Todos</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Estado
              </label>
              <select
                value={filters.estado}
                onChange={(e) => setFilters((prev) => ({ ...prev, estado: e.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                <option value="">Todas</option>
                <option value="leidas">Leidas</option>
                <option value="no-leidas">No leidas</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={limpiarFiltros}
                disabled={loading}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={17} />
                Limpiar
              </button>
            </div>
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
                {esEntrevistas
                  ? "Los postulantes que pasen a entrevista aparecerán en esta vista."
                  : "Cuando se envíe un formulario compatible con los filtros, aparecerá aquí."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-left text-[10px] leading-tight lg:text-xs">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[7%]" />
                  <col className="w-[7%]" />
                  <col className="w-[4%]" />
                  <col className="w-[4%]" />
                  <col className="w-[7%]" />
                  <col className="w-[6%]" />
                  <col className="w-[10%]" />
                  <col className="w-[6%]" />
                  <col className="w-[4%]" />
                  <col className="w-[6%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
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
                    <th className={thClass}>
                      {esEntrevistas ? "Pase a entrevista" : "Fecha"}
                    </th>
                    <th className={thClass}>Observacion</th>
                    <th className={`${thClass} text-right`}>Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {postulaciones.map((p) => {
                    const datos = getDatos(p);
                    const vivienda = getVivienda(p);
                    const trabajos = p.formulario?.historial_laboral?.length || 0;

                    const editingObservation = editingObservationId === p.id;

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
                          {formatDate(esEntrevistas ? p.pasaEntrevistaAt : p.createdAt)}
                        </td>
                        <td className={tdClass}>
                          {editingObservation ? (
                            <div className="space-y-1">
                              <textarea
                                id={`observacion-${p.id}`}
                                value={observacionesDraft[p.id] ?? ""}
                                onChange={(e) => actualizarObservacionDraft(p.id, e.target.value)}
                                rows={2}
                                placeholder="Observacion"
                                className="min-h-14 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                              />
                              <div className="flex flex-wrap gap-1">
                                <button
                                  onClick={() => guardarObservacion(p)}
                                  disabled={savingObservationId === p.id}
                                  className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-orange-500 px-2 text-[10px] font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Save size={12} />
                                  {savingObservationId === p.id ? "..." : "Guardar"}
                                </button>
                                <button
                                  onClick={() => cancelarEdicionObservacion(p)}
                                  disabled={savingObservationId === p.id}
                                  className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <X size={12} />
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="whitespace-pre-wrap break-words text-slate-700">
                                {p.observacion || "Sin observacion"}
                              </p>
                             
                            </div>
                          )}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <div className="flex flex-wrap justify-end gap-1">
                            <button
                              onClick={() => actualizarFaseEntrevista(p, !esEntrevistas)}
                              disabled={updatingStageId === p.id}
                              className={`inline-flex h-7 items-center justify-center gap-1 rounded-md px-2 text-[10px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                esEntrevistas
                                  ? "bg-orange-500 hover:bg-orange-600"
                                  : "bg-emerald-600 hover:bg-emerald-700"
                              }`}
                              aria-label={
                                esEntrevistas
                                  ? "Devolver a postulaciones"
                                  : "Pasar a entrevista"
                              }
                              title={
                                updatingStageId === p.id
                                  ? "Actualizando"
                                  : esEntrevistas
                                    ? "Devolver a postulaciones"
                                    : "Pasar a entrevista"
                              }
                            >
                              {esEntrevistas ? <Undo2 size={14} /> : <UserCheck size={14} />}
                              {esEntrevistas ? "Regresar" : "Pasar a entrevista"}
                            </button>
                             <button
                                onClick={() => editarObservacion(p)}
                                className="inline-flex h-7 w-7 items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                <Pencil size={12} />
                                
                              </button>
                            <button
                              onClick={() => verPostulacion(p)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white transition px-2 hover:bg-slate-700"
                              aria-label="Ver postulacion"
                              title="Ver"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => eliminarPostulacion(p)}
                              disabled={deletingId === p.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600 px-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Pagina {pagination.page} de {pagination.totalPages} · {pagination.total} registro
                  {pagination.total === 1 ? "" : "s"}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => irPagina(page - 1)}
                    disabled={!pagination.hasPrevPage || loading}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>

                  <button
                    onClick={() => irPagina(page + 1)}
                    disabled={!pagination.hasNextPage || loading}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && <ModalDetalle postulacion={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
