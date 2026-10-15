import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Database,
  Eye,
  Factory,
  FileText,
  GraduationCap,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import ModalDetalle from "../../components/PostulacionDetalle";

const POSTULACIONES_EVENT = "apolo:postulaciones-updated";
const PAGE_SIZE = 100;

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

const buildFilterParams = (filters, fase, page) => ({
  q: filters.q.trim() || undefined,
  fechaDesde: filters.fechaDesde || undefined,
  fechaHasta: filters.fechaHasta || undefined,
  estado: filters.estado || undefined,
  edadDesde: filters.edadDesde || undefined,
  edadHasta: filters.edadHasta || undefined,
  ciudad: filters.ciudad.trim() || undefined,
  tituloTercerNivel: filters.tituloTercerNivel || undefined,
  estudiaActualmente: filters.estudiaActualmente || undefined,
  fase,
  page,
  limit: PAGE_SIZE,
});

const STAGES = [
  {
    key: "postulacion",
    label: "Postulación",
    description: "Ingreso inicial de postulantes",
    icon: FileText,
    headerClass: "border-orange-200 bg-orange-50 text-orange-800",
    countClass: "bg-orange-100 text-orange-700",
  },
  {
    key: "entrevista",
    label: "Entrevista",
    description: "Postulantes en proceso de entrevista",
    icon: UserCheck,
    headerClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    countClass: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "data",
    label: "Data",
    description: "Postulantes seleccionados para continuar",
    icon: Database,
    headerClass: "border-sky-200 bg-sky-50 text-sky-800",
    countClass: "bg-sky-100 text-sky-700",
  },
  {
    key: "capacitacion",
    label: "Capacitación",
    description: "Postulantes en proceso de capacitación",
    icon: GraduationCap,
    headerClass: "border-violet-200 bg-violet-50 text-violet-800",
    countClass: "bg-violet-100 text-violet-700",
  },
  {
    key: "produccion",
    label: "Producción",
    description: "Personal incorporado con fecha de ingreso",
    icon: Factory,
    headerClass: "border-green-200 bg-green-50 text-green-800",
    countClass: "bg-green-100 text-green-700",
  },
  {
    key: "descarte",
    label: "Descarte",
    description: "Postulantes descartados del proceso",
    icon: Archive,
    headerClass: "border-slate-300 bg-slate-100 text-slate-800",
    countClass: "bg-slate-200 text-slate-700",
  },
];

const STAGE_SOURCES = [
  { key: "postulacion", fase: "postulacion" },
  { key: "entrevista", fase: "entrevista" },
  { key: "data", fase: "seleccionado" },
  { key: "capacitacion", fase: "capacitacion" },
  { key: "produccion", fase: "produccion" },
  { key: "descarte", fase: "descartado" },
];

const getCandidateName = (postulacion) =>
  postulacion?.formulario?.datos_personales?.nombreCompleto ||
  postulacion?.nombre ||
  "Sin nombre";

const getCandidateCedula = (postulacion) =>
  postulacion?.formulario?.datos_personales?.cedula ||
  postulacion?.cedula ||
  "Sin cédula";

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fetchStage = async (fase, filters) => {
  const items = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await api.get("/api/postulaciones", {
      params: buildFilterParams(filters, fase, currentPage),
    });
    const pageItems = response.data?.data || [];
    const pagination = response.data?.pagination || {};
    items.push(...pageItems);
    hasNextPage = Boolean(pagination.hasNextPage);
    currentPage += 1;
  }

  return items;
};

export default function Pipeline() {
  const [filters, setFilters] = useState(createEmptyFilters);
  const [stages, setStages] = useState({
    postulacion: [],
    entrevista: [],
    data: [],
    capacitacion: [],
    produccion: [],
    descarte: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ nombre: "", cedula: "" });
  const [creating, setCreating] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [draggedCandidate, setDraggedCandidate] = useState(null);
  const [dragOverStage, setDragOverStage] = useState("");
  const requestIdRef = useRef(0);

  const total = useMemo(
    () => Object.values(stages).reduce((sum, items) => sum + items.length, 0),
    [stages],
  );

  const fetchPipeline = async (filtersToUse = filters) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      setError("");
      const results = await Promise.all(
        STAGE_SOURCES.map((source) => fetchStage(source.fase, filtersToUse)),
      );

      if (requestId !== requestIdRef.current) return;
      const resultsByStage = Object.fromEntries(
        STAGE_SOURCES.map((source, index) => [source.key, results[index]]),
      );
      setStages({
        postulacion: resultsByStage.postulacion || [],
        entrevista: resultsByStage.entrevista || [],
        data: resultsByStage.data || [],
        capacitacion: resultsByStage.capacitacion || [],
        produccion: resultsByStage.produccion || [],
        descarte: resultsByStage.descarte || [],
      });
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      setError(
        requestError.response?.data?.message ||
          "No se pudo cargar el pipeline de postulantes.",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchPipeline(filters);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters]);

  const closeCreateModal = () => {
    if (creating) return;
    setShowCreateModal(false);
    setCreateForm({ nombre: "", cedula: "" });
  };

  const createCandidate = async (event) => {
    event.preventDefault();
    const nombre = createForm.nombre.trim();
    const cedula = createForm.cedula.replace(/\D/g, "");

    if (!nombre) {
      await Swal.fire("Nombre requerido", "Ingresa el nombre del postulante.", "info");
      return;
    }

    if (!/^\d{10}$/.test(cedula)) {
      await Swal.fire(
        "Cédula inválida",
        "La cédula debe contener exactamente 10 dígitos.",
        "info",
      );
      return;
    }

    try {
      setCreating(true);
      await api.post("/api/postulaciones/pipeline", { nombre, cedula });
      setShowCreateModal(false);
      setCreateForm({ nombre: "", cedula: "" });
      await fetchPipeline(filters);
      window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
      await Swal.fire({
        icon: "success",
        title: "Postulante creado",
        text: "El postulante fue agregado a la etapa Postulación.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (createError) {
      await Swal.fire(
        "No se pudo crear el postulante",
        createError.response?.data?.message || "Ocurrió un error al guardar los datos.",
        "error",
      );
    } finally {
      setCreating(false);
    }
  };

  const moveCandidate = async (candidate, sourceStage, targetStage) => {
    if (!candidate || sourceStage === targetStage || movingId) return;

    let motivoDescarte = "";
    if (targetStage === "descarte") {
      const result = await Swal.fire({
        icon: "warning",
        title: "Mover a Descarte",
        text: `Indica por qué se descarta a ${getCandidateName(candidate)}.`,
        input: "textarea",
        inputPlaceholder: "Motivo del descarte",
        inputAttributes: { maxlength: "1000" },
        showCancelButton: true,
        confirmButtonText: "Mover a Descarte",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#475569",
        inputValidator: (value) =>
          value?.trim() ? undefined : "Debes ingresar el motivo del descarte.",
      });

      if (!result.isConfirmed) return;
      motivoDescarte = result.value.trim();
    }

    setMovingId(candidate.id);
    setStages((current) => {
      const next = Object.fromEntries(
        Object.entries(current).map(([key, candidates]) => [
          key,
          candidates.filter((item) => item.id !== candidate.id),
        ]),
      );
      next[targetStage] = [candidate, ...(next[targetStage] || [])];
      return next;
    });

    try {
      await api.patch(`/api/postulaciones/${candidate.id}/pipeline-etapa`, {
        etapa: targetStage.toUpperCase(),
        ...(motivoDescarte ? { motivoDescarte } : {}),
      });
      await fetchPipeline(filters);
      window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
    } catch (moveError) {
      await fetchPipeline(filters);
      await Swal.fire(
        "No se pudo mover el postulante",
        moveError.response?.data?.message ||
          "Ocurrió un error al actualizar la etapa.",
        "error",
      );
    } finally {
      setMovingId(null);
    }
  };

  const handleDragStart = (event, candidate, sourceStage) => {
    if (movingId) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(candidate.id));
    setDraggedCandidate({ candidate, sourceStage });
  };

  const handleDrop = (event, targetStage) => {
    event.preventDefault();
    setDragOverStage("");

    if (!draggedCandidate) return;
    const { candidate, sourceStage } = draggedCandidate;
    setDraggedCandidate(null);
    moveCandidate(candidate, sourceStage, targetStage);
  };

  const handleDragEnd = () => {
    setDraggedCandidate(null);
    setDragOverStage("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
              Desarrollo Organizacional
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Pipeline</h2>
            <p className="mt-1 text-sm text-slate-600">
              {total} postulante{total === 1 ? "" : "s"} en las etapas visibles.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-600"
          >
            <Plus size={18} />
            Crear postulante
          </button>
        </header>

        <section className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
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
                onChange={(event) =>
                  setFilters((current) => ({ ...current, q: event.target.value }))
                }
                placeholder="Nombre, teléfono, cédula o correo"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Fecha desde
            </label>
            <input
              type="date"
              value={filters.fechaDesde}
              max={filters.fechaHasta || undefined}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  fechaDesde: event.target.value,
                }))
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Fecha hasta
            </label>
            <input
              type="date"
              value={filters.fechaHasta}
              min={filters.fechaDesde || undefined}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  fechaHasta: event.target.value,
                }))
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
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
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  edadDesde: event.target.value,
                }))
              }
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
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  edadHasta: event.target.value,
                }))
              }
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
              onChange={(event) =>
                setFilters((current) => ({ ...current, ciudad: event.target.value }))
              }
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
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  tituloTercerNivel: event.target.value,
                }))
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
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  estudiaActualmente: event.target.value,
                }))
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
              onChange={(event) =>
                setFilters((current) => ({ ...current, estado: event.target.value }))
              }
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            >
              <option value="">Todas</option>
              <option value="leidas">Leídas</option>
              <option value="no-leidas">No leídas</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFilters(createEmptyFilters())}
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={17} />
              Limpiar
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
                Etapas del pipeline
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Arrastra cada tarjeta con el mouse y suéltala en la etapa deseada.
              </p>
            </div>
            {loading && <span className="text-sm font-medium text-slate-500">Actualizando...</span>}
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-3 2xl:grid-cols-6">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              const candidates = stages[stage.key] || [];

              return (
                <article
                  key={stage.key}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverStage(stage.key);
                  }}
                  onDrop={(event) => handleDrop(event, stage.key)}
                  className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                    dragOverStage === stage.key &&
                    draggedCandidate?.sourceStage !== stage.key
                      ? "border-orange-400 ring-4 ring-orange-100"
                      : "border-slate-200"
                  }`}
                >
                  <header className={`border-b p-4 ${stage.headerClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Icon size={20} className="mt-0.5 shrink-0" />
                        <div>
                          <h4 className="font-extrabold">{stage.label}</h4>
                          <p className="mt-0.5 text-xs opacity-80">{stage.description}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${stage.countClass}`}
                      >
                        {candidates.length}
                      </span>
                    </div>
                  </header>

                  <div className="max-h-[62vh] space-y-3 overflow-y-auto bg-slate-50/70 p-3">
                    {!loading && candidates.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                        No hay postulantes en esta etapa con los filtros actuales.
                      </div>
                    ) : (
                      candidates.map((candidate) => (
                        <div
                          key={candidate.id}
                          draggable={!movingId}
                          onDragStart={(event) =>
                            handleDragStart(event, candidate, stage.key)
                          }
                          onDragEnd={handleDragEnd}
                          aria-grabbed={draggedCandidate?.candidate.id === candidate.id}
                          className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-orange-200 hover:shadow active:cursor-grabbing ${
                            movingId === candidate.id ||
                            draggedCandidate?.candidate.id === candidate.id
                              ? "opacity-50"
                              : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-1">
                              <GripVertical
                                size={16}
                                className="mt-0.5 shrink-0 text-slate-400"
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                              <p className="break-words text-sm font-extrabold text-slate-900">
                                {getCandidateName(candidate)}
                              </p>
                              <p className="mt-1 text-xs font-medium text-slate-600">
                                C.I. {getCandidateCedula(candidate)}
                              </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelected(candidate)}
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                              aria-label={`Ver detalle de ${getCandidateName(candidate)}`}
                              title="Ver detalle"
                            >
                              <Eye size={16} />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                            <span>Registro: {formatDate(candidate.createdAt)}</span>
                            {candidate.formulario?.metadata?.origen === "pipeline" && (
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 font-bold text-orange-700">
                                Registro rápido
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreateModal();
          }}
        >
          <form
            onSubmit={createCandidate}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-orange-600">
                  Etapa Postulación
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                  Crear postulante
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Registra únicamente el nombre y la cédula.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Nombre completo
                </label>
                <input
                  autoFocus
                  type="text"
                  maxLength={150}
                  required
                  value={createForm.nombre}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                  placeholder="Ej. Ana Pérez"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-slate-700">
                  Cédula
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={createForm.cedula}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      cedula: event.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  placeholder="10 dígitos"
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="h-11 rounded-lg border border-slate-300 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 text-sm font-extrabold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={17} />
                {creating ? "Guardando..." : "Crear en Postulación"}
              </button>
            </div>
          </form>
        </div>
      )}

      {selected && (
        <ModalDetalle postulacion={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
