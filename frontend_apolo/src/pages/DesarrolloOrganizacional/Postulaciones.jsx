import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Undo2,
  Upload,
  UserCheck,
  Users,
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
  estudiaActualmente: "",
});

const createInitialFilters = (modo) => ({
  ...createEmptyFilters(),
  edadDesde: modo === "postulacion" ? "18" : "",
  edadHasta: modo === "postulacion" ? "35" : "",
  tituloTercerNivel: modo === "postulacion" ? "no" : "",
});

const getDatos = (postulacion) => postulacion?.formulario?.datos_personales || {};
const getVivienda = (postulacion) => postulacion?.formulario?.vivienda_actual || {};
const getTitularTxt = (postulacion) =>
  postulacion?.formulario?.titular_postulante ||
  postulacion?.formulario?.importacion_familiares_txt?.titular ||
  null;
const getFamiliaresTxt = (postulacion) => postulacion?.formulario?.familiares_postulante || [];

const formatDate = (date) => {
  if (!date) return dash;
  return new Date(date).toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const toDateTimeLocal = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const thClass = "px-1.5 py-2 text-[10px] font-bold leading-tight md:px-2 lg:text-xs";
const tdClass = "min-w-0 break-words px-1.5 py-2 text-[10px] leading-tight text-slate-700 md:px-2 lg:text-xs";

export default function Postulaciones({ modo = "postulacion" }) {
  const esEntrevistas = modo === "entrevista";
  const esDescartados = modo === "descartado";
  const [postulaciones, setPostulaciones] = useState([]);
  const [filters, setFilters] = useState(() => createInitialFilters(modo));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatingDiscardId, setUpdatingDiscardId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [resumen, setResumen] = useState({
    totalGeneral: 0,
    total: 0,
    noLeidas: 0,
    entrevistas: 0,
    descartados: 0,
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
  const [entrevistaDrafts, setEntrevistaDrafts] = useState({});
  const [savingInterviewDateId, setSavingInterviewDateId] = useState(null);
  const [importingFamilyTxtId, setImportingFamilyTxtId] = useState(null);
  const [expandedFamilyId, setExpandedFamilyId] = useState(null);
  const [savingFamilyReviewKey, setSavingFamilyReviewKey] = useState("");
  const requestIdRef = useRef(0);
  const familyTxtInputRef = useRef(null);
  const familyTxtTargetRef = useRef(null);

  const total = useMemo(() => pagination.total || postulaciones.length, [pagination.total, postulaciones.length]);

  const syncObservacionesDraft = (items = []) => {
    setObservacionesDraft(
      Object.fromEntries(items.map((item) => [item.id, item.observacion || ""]))
    );
  };

  const syncEntrevistaDrafts = (items = []) => {
    setEntrevistaDrafts(
      Object.fromEntries(
        items.map((item) => [item.id, toDateTimeLocal(item.fechaEntrevista)]),
      ),
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
          descartados: 0,
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
          estudiaActualmente: filtersToUse.estudiaActualmente || undefined,
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
      syncEntrevistaDrafts(items);
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

  const guardarFechaEntrevista = async (postulacion) => {
    const draft = entrevistaDrafts[postulacion.id] || "";
    const parsedDate = draft ? new Date(draft) : null;

    if (parsedDate && Number.isNaN(parsedDate.getTime())) {
      Swal.fire("Fecha no valida", "Ingresa una fecha y hora validas.", "warning");
      return;
    }

    try {
      setSavingInterviewDateId(postulacion.id);
      setError("");
      const res = await api.patch(
        `/api/postulaciones/${postulacion.id}/fecha-entrevista`,
        {
          fechaEntrevista: parsedDate ? parsedDate.toISOString() : null,
        },
      );
      const postulacionActualizada = res.data?.data;

      setPostulaciones((prev) =>
        prev.map((item) =>
          item.id === postulacion.id
            ? {
                ...item,
                fechaEntrevista: postulacionActualizada?.fechaEntrevista || null,
              }
            : item,
        ),
      );
      setEntrevistaDrafts((prev) => ({
        ...prev,
        [postulacion.id]: toDateTimeLocal(postulacionActualizada?.fechaEntrevista),
      }));

      Swal.fire(
        "Guardado",
        parsedDate
          ? "La fecha y hora de la entrevista fueron guardadas."
          : "La fecha y hora de la entrevista fueron eliminadas.",
        "success",
      );
    } catch (err) {
      const message =
        err.response?.data?.message || "No se pudo guardar la fecha de la entrevista";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setSavingInterviewDateId(null);
    }
  };

  const actualizarDescarte = async (postulacion, descartada) => {
    const datos = getDatos(postulacion);
    const nombre = datos.nombreCompleto || postulacion.nombre || `ID ${postulacion.id}`;
    const seccionRestaurada = postulacion.pasaEntrevista ? "Entrevistas" : "Postulaciones";
    const { isConfirmed } = await Swal.fire({
      title: descartada ? "Descartar postulante" : "Restaurar postulante",
      text: descartada
        ? `¿Deseas mover a ${nombre} a la sección Descartados? El registro no se eliminará de la base de datos.`
        : `¿Deseas restaurar a ${nombre} en la sección ${seccionRestaurada}?`,
      icon: descartada ? "warning" : "question",
      showCancelButton: true,
      confirmButtonColor: descartada ? "#dc2626" : "#059669",
      cancelButtonColor: "#64748b",
      confirmButtonText: descartada ? "Sí, descartar" : "Sí, restaurar",
      cancelButtonText: "Cancelar",
    });

    if (!isConfirmed) return;

    try {
      setUpdatingDiscardId(postulacion.id);
      setError("");
      await api.patch(`/api/postulaciones/${postulacion.id}/descartada`, {
        descartada,
      });
      setSelected((prev) => (prev?.id === postulacion.id ? null : prev));
      const nextPage = postulaciones.length === 1 && page > 1 ? page - 1 : page;
      await fetchPostulaciones(nextPage, filters);
      window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
      Swal.fire(
        "Actualizado",
        descartada
          ? "El postulante fue enviado a Descartados sin eliminarlo de la base de datos."
          : `El postulante fue restaurado en ${seccionRestaurada}.`,
        "success",
      );
    } catch (err) {
      const message =
        err.response?.data?.message || "No se pudo actualizar el estado del postulante";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setUpdatingDiscardId(null);
    }
  };

  const seleccionarTxtFamiliares = (postulacion) => {
    familyTxtTargetRef.current = postulacion;
    if (familyTxtInputRef.current) {
      familyTxtInputRef.current.value = "";
      familyTxtInputRef.current.click();
    }
  };

  const alternarFamiliares = (postulacion) => {
    setExpandedFamilyId((prev) => (prev === postulacion.id ? null : postulacion.id));
  };

  const actualizarFamiliarLocal = (postulacionId, familiarIndex, changes) => {
    const updateItem = (item) => {
      if (item.id !== postulacionId) return item;

      const formulario = item.formulario || {};
      const familiares = Array.isArray(formulario.familiares_postulante)
        ? formulario.familiares_postulante.map((familiar, index) =>
            index === familiarIndex ? { ...familiar, ...changes } : familiar,
          )
        : [];

      return {
        ...item,
        formulario: {
          ...formulario,
          familiares_postulante: familiares,
        },
      };
    };

    setPostulaciones((prev) => prev.map(updateItem));
    setSelected((prev) => (prev ? updateItem(prev) : prev));
  };

  const actualizarTitularLocal = (postulacionId, changes) => {
    const updateItem = (item) => {
      if (item.id !== postulacionId) return item;

      const formulario = item.formulario || {};
      const titular =
        formulario.titular_postulante || formulario.importacion_familiares_txt?.titular || {};
      const titularActualizado = { ...titular, ...changes };

      return {
        ...item,
        formulario: {
          ...formulario,
          titular_postulante: titularActualizado,
          importacion_familiares_txt: {
            ...(formulario.importacion_familiares_txt || {}),
            titular: titularActualizado,
          },
        },
      };
    };

    setPostulaciones((prev) => prev.map(updateItem));
    setSelected((prev) => (prev ? updateItem(prev) : prev));
  };

  const guardarRevisionTitular = async (postulacion, changes) => {
    const key = `${postulacion.id}-titular`;

    try {
      setSavingFamilyReviewKey(key);
      setError("");
      const res = await api.patch(`/api/postulaciones/${postulacion.id}/titular-txt`, changes);
      const postulacionActualizada = res.data?.data;

      if (postulacionActualizada) {
        setPostulaciones((prev) =>
          prev.map((item) =>
            item.id === postulacion.id ? postulacionActualizada : item,
          ),
        );
        setSelected((prev) =>
          prev?.id === postulacion.id ? postulacionActualizada : prev,
        );
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "No se pudo guardar la revision del titular";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setSavingFamilyReviewKey("");
    }
  };

  const guardarRevisionFamiliar = async (postulacion, familiarIndex, changes) => {
    const key = `${postulacion.id}-${familiarIndex}`;

    try {
      setSavingFamilyReviewKey(key);
      setError("");
      const res = await api.patch(
        `/api/postulaciones/${postulacion.id}/familiares/${familiarIndex}`,
        changes,
      );
      const postulacionActualizada = res.data?.data;

      if (postulacionActualizada) {
        setPostulaciones((prev) =>
          prev.map((item) =>
            item.id === postulacion.id ? postulacionActualizada : item,
          ),
        );
        setSelected((prev) =>
          prev?.id === postulacion.id ? postulacionActualizada : prev,
        );
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "No se pudo guardar la revision del familiar";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setSavingFamilyReviewKey("");
    }
  };

  const cambiarLimpioFamiliar = (postulacion, familiarIndex, limpio) => {
    actualizarFamiliarLocal(postulacion.id, familiarIndex, { limpio });
    guardarRevisionFamiliar(postulacion, familiarIndex, { limpio });
  };

  const cambiarObservacionFamiliar = (postulacion, familiarIndex, observacion) => {
    actualizarFamiliarLocal(postulacion.id, familiarIndex, { observacion });
  };

  const cambiarLimpioTitular = (postulacion, limpio) => {
    actualizarTitularLocal(postulacion.id, { limpio });
    guardarRevisionTitular(postulacion, { limpio });
  };

  const cambiarObservacionTitular = (postulacion, observacion) => {
    actualizarTitularLocal(postulacion.id, { observacion });
  };

  const importarTxtFamiliares = async (event) => {
    const file = event.target.files?.[0];
    const postulacion = familyTxtTargetRef.current;

    if (!file || !postulacion) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
      Swal.fire("Archivo no valido", "Selecciona un archivo .txt.", "warning");
      event.target.value = "";
      return;
    }

    try {
      setImportingFamilyTxtId(postulacion.id);
      setError("");
      const contenido = await file.text();
      const res = await api.patch(`/api/postulaciones/${postulacion.id}/familiares-txt`, {
        contenido,
        nombreArchivo: file.name,
      });
      const postulacionActualizada = res.data?.data;
      const totalFamiliares = res.data?.parsed?.familiares?.length || 0;

      if (postulacionActualizada) {
        setPostulaciones((prev) =>
          prev.map((item) =>
            item.id === postulacion.id ? postulacionActualizada : item,
          ),
        );
        setSelected((prev) =>
          prev?.id === postulacion.id ? postulacionActualizada : prev,
        );
        setExpandedFamilyId(postulacion.id);
      }

      Swal.fire(
        "Importado",
        `Se guardaron ${totalFamiliares} familiar${totalFamiliares === 1 ? "" : "es"} en el postulante.`,
        "success",
      );
    } catch (err) {
      const message =
        err.response?.data?.message || "No se pudo importar el archivo TXT";
      setError(message);
      Swal.fire("Error", message, "error");
    } finally {
      setImportingFamilyTxtId(null);
      familyTxtTargetRef.current = null;
      event.target.value = "";
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPostulaciones(1, filters);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [filters, modo]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <input
        ref={familyTxtInputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={importarTxtFamiliares}
      />
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Desarrollo Organizacional
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {esDescartados ? "Descartados" : esEntrevistas ? "Entrevistas" : "Postulaciones"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {total} postulante{total === 1 ? "" : "s"} en esta sección.
            </p>
            {!esEntrevistas && !esDescartados && (
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
                Estudia actualmente
              </label>
              <select
                value={filters.estudiaActualmente}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, estudiaActualmente: e.target.value }))
                }
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                <option value="">Todos</option>
                <option value="si">Si</option>
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
                {esDescartados
                  ? "Los postulantes descartados aparecerán en esta vista y podrán restaurarse."
                  : esEntrevistas
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
                  <col className={esEntrevistas ? "w-[14%]" : "w-[8%]"} />
                  <col className="w-[8%]" />
                  <col className={esEntrevistas ? "w-[10%]" : "w-[12%]"} />
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
                      {esDescartados
                        ? "Fecha de descarte"
                        : esEntrevistas
                          ? "Fecha y hora de entrevista"
                          : "Fecha"}
                    </th>
                    <th className={thClass}>Observacion</th>
                    <th className={`${thClass} text-right`}>Accion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {postulaciones.map((p) => {
                    const datos = getDatos(p);
                    const vivienda = getVivienda(p);
                    const titularTxt = getTitularTxt(p);
                    const familiaresTxt = getFamiliaresTxt(p);
                    const totalRegistrosTxt = familiaresTxt.length + (titularTxt ? 1 : 0);
                    const trabajos = p.formulario?.historial_laboral?.length || 0;

                    const editingObservation = editingObservationId === p.id;

                    return (
                      <Fragment key={p.id}>
                      <tr className="transition hover:bg-slate-50">
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
                          {esEntrevistas ? (
                            <div className="space-y-1.5">
                              <input
                                type="datetime-local"
                                value={entrevistaDrafts[p.id] ?? ""}
                                onChange={(e) =>
                                  setEntrevistaDrafts((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                aria-label={`Fecha y hora de entrevista para ${
                                  datos.nombreCompleto || p.nombre || `postulante ${p.id}`
                                }`}
                                className="h-8 w-full rounded-md border border-slate-300 bg-white px-1.5 text-[10px] text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                              />
                              <button
                                onClick={() => guardarFechaEntrevista(p)}
                                disabled={savingInterviewDateId === p.id}
                                className="inline-flex h-7 w-full items-center justify-center gap-1 rounded-md bg-orange-500 px-2 text-[10px] font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <CalendarClock size={12} />
                                {savingInterviewDateId === p.id ? "Guardando..." : "Guardar"}
                              </button>
                              <p className="text-[9px] leading-tight text-slate-500">
                                Pasó a entrevista: {formatDate(p.pasaEntrevistaAt)}
                              </p>
                            </div>
                          ) : formatDate(esDescartados ? p.descartadaAt : p.createdAt)}
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
                            {esDescartados ? (
                              <button
                                onClick={() => actualizarDescarte(p, false)}
                                disabled={updatingDiscardId === p.id}
                                className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 text-[10px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Restaurar postulante"
                                title={
                                  updatingDiscardId === p.id ? "Restaurando" : "Restaurar"
                                }
                              >
                                <Undo2 size={14} />
                                Restaurar
                              </button>
                            ) : (
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
                            )}
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
                              onClick={() => seleccionarTxtFamiliares(p)}
                              disabled={importingFamilyTxtId === p.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Importar TXT familiar"
                              title={
                                importingFamilyTxtId === p.id
                                  ? "Importando"
                                  : "Importar TXT familiar"
                              }
                            >
                              <Upload size={14} />
                            </button>
                            <button
                              onClick={() => alternarFamiliares(p)}
                              disabled={!totalRegistrosTxt}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Ver familiares importados"
                              title={
                                totalRegistrosTxt
                                  ? "Ver datos importados"
                                  : "Sin datos importados"
                              }
                            >
                              {expandedFamilyId === p.id ? (
                                <ChevronUp size={14} />
                              ) : (
                                <Users size={14} />
                              )}
                            </button>
                            {!esDescartados && (
                              <button
                                onClick={() => actualizarDescarte(p, true)}
                                disabled={updatingDiscardId === p.id}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600 px-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Descartar postulante"
                                title={
                                  updatingDiscardId === p.id ? "Descartando" : "Descartar"
                                }
                              >
                                <Archive size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedFamilyId === p.id && totalRegistrosTxt > 0 && (
                        <tr className="bg-slate-50">
                          <td colSpan={14} className="px-3 py-3">
                            <div className="rounded-lg border border-orange-200 bg-white p-4 shadow-sm">
                              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wide text-orange-600">
                                    Datos importados
                                  </p>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {totalRegistrosTxt} registro
                                    {totalRegistrosTxt === 1 ? "" : "s"} importado
                                    {totalRegistrosTxt === 1 ? "" : "s"} desde el TXT
                                  </p>
                                </div>
                                <button
                                  onClick={() => setExpandedFamilyId(null)}
                                  className="inline-flex h-8 w-8 items-center justify-center self-start rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:self-auto"
                                  aria-label="Cerrar familiares"
                                  title="Cerrar"
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {titularTxt && (
                                  <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">
                                          Titular
                                        </p>
                                        <p className="break-words text-sm font-bold text-slate-900">
                                          {titularTxt.nombre || datos.nombreCompleto || p.nombre || dash}
                                        </p>
                                      </div>
                                      <span className="shrink-0 rounded-full bg-orange-600 px-2 py-1 text-[10px] font-bold text-white">
                                        Postulante
                                      </span>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                                      <div>
                                        <dt className="font-semibold uppercase text-slate-500">Cedula</dt>
                                        <dd className="break-words text-slate-800">
                                          {titularTxt.cedula || datos.cedula || p.cedula || dash}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="font-semibold uppercase text-slate-500">Edad</dt>
                                        <dd className="break-words text-slate-800">
                                          {titularTxt.edad || datos.edadCumplida || dash}
                                        </dd>
                                      </div>
                                      <div className="col-span-2">
                                        <dt className="font-semibold uppercase text-slate-500">
                                          Lugar de nacimiento
                                        </dt>
                                        <dd className="break-words text-slate-800">
                                          {titularTxt.lugarNacimiento || datos.lugarNacimiento || dash}
                                        </dd>
                                      </div>
                                      <div className="col-span-2">
                                        <dt className="font-semibold uppercase text-slate-500">
                                          Nivel de estudio
                                        </dt>
                                        <dd className="break-words text-slate-800">
                                          {titularTxt.nivelEstudio || datos.nivelEstudio || dash}
                                        </dd>
                                      </div>
                                    </dl>
                                    <div className="mt-3 border-t border-orange-200 pt-3">
                                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(titularTxt.limpio)}
                                          onChange={(event) =>
                                            cambiarLimpioTitular(p, event.target.checked)
                                          }
                                          disabled={savingFamilyReviewKey === `${p.id}-titular`}
                                          className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                        Limpio
                                      </label>
                                      <label className="mt-2 block text-[11px] font-semibold uppercase text-slate-500">
                                        Observacion
                                      </label>
                                      <input
                                        type="text"
                                        value={titularTxt.observacion || ""}
                                        onChange={(event) =>
                                          cambiarObservacionTitular(p, event.target.value)
                                        }
                                        onBlur={(event) =>
                                          guardarRevisionTitular(p, {
                                            observacion: event.target.value,
                                          })
                                        }
                                        maxLength={1000}
                                        placeholder="Escribe una observacion"
                                        disabled={savingFamilyReviewKey === `${p.id}-titular`}
                                        className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      />
                                      {savingFamilyReviewKey === `${p.id}-titular` && (
                                        <p className="mt-1 text-[10px] font-semibold text-orange-600">
                                          Guardando...
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {familiaresTxt.map((familiar, index) => (
                                  <div
                                    key={`${p.id}-familiar-${index}`}
                                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                                  >
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                          {familiar.relacion || familiar.tipo || `Familiar ${index + 1}`}
                                        </p>
                                        <p className="break-words text-sm font-bold text-slate-900">
                                          {familiar.nombre || dash}
                                        </p>
                                      </div>
                                      <span className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700">
                                        #{index + 1}
                                      </span>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                                      <div>
                                        <dt className="font-semibold uppercase text-slate-500">Cedula</dt>
                                        <dd className="break-words text-slate-800">{familiar.cedula || dash}</dd>
                                      </div>
                                      <div>
                                        <dt className="font-semibold uppercase text-slate-500">Edad</dt>
                                        <dd className="break-words text-slate-800">{familiar.edad || dash}</dd>
                                      </div>
                                      <div className="col-span-2">
                                        <dt className="font-semibold uppercase text-slate-500">
                                          Lugar de nacimiento
                                        </dt>
                                        <dd className="break-words text-slate-800">
                                          {familiar.lugarNacimiento || dash}
                                        </dd>
                                      </div>
                                      <div className="col-span-2">
                                        <dt className="font-semibold uppercase text-slate-500">
                                          Nivel de estudio
                                        </dt>
                                        <dd className="break-words text-slate-800">
                                          {familiar.nivelEstudio || dash}
                                        </dd>
                                      </div>
                                      {familiar.detalle && (
                                        <div className="col-span-2">
                                          <dt className="font-semibold uppercase text-slate-500">
                                            Detalle
                                          </dt>
                                          <dd className="break-words text-slate-800">
                                            {familiar.detalle}
                                          </dd>
                                        </div>
                                      )}
                                    </dl>
                                    <div className="mt-3 border-t border-slate-200 pt-3">
                                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(familiar.limpio)}
                                          onChange={(event) =>
                                            cambiarLimpioFamiliar(p, index, event.target.checked)
                                          }
                                          disabled={savingFamilyReviewKey === `${p.id}-${index}`}
                                          className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                                        />
                                        Limpio
                                      </label>
                                      <label className="mt-2 block text-[11px] font-semibold uppercase text-slate-500">
                                        Observacion
                                      </label>
                                      <input
                                        type="text"
                                        value={familiar.observacion || ""}
                                        onChange={(event) =>
                                          cambiarObservacionFamiliar(p, index, event.target.value)
                                        }
                                        onBlur={(event) =>
                                          guardarRevisionFamiliar(p, index, {
                                            observacion: event.target.value,
                                          })
                                        }
                                        maxLength={1000}
                                        placeholder="Escribe una observacion"
                                        disabled={savingFamilyReviewKey === `${p.id}-${index}`}
                                        className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      />
                                      {savingFamilyReviewKey === `${p.id}-${index}` && (
                                        <p className="mt-1 text-[10px] font-semibold text-orange-600">
                                          Guardando...
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
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
