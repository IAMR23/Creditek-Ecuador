import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, List, Plus, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import InterviewCalendar from "../../components/entrevistas/InterviewCalendar";
import InterviewFilters from "../../components/entrevistas/InterviewFilters";
import InterviewSchedulerDrawer from "../../components/entrevistas/InterviewSchedulerDrawer";
import InterviewSummaryCards from "../../components/entrevistas/InterviewSummaryCards";
import InterviewTable from "../../components/entrevistas/InterviewTable";
import ModalDetalle from "../../components/PostulacionDetalle";
import { getCandidateName, getInterviewDateRange, INTERVIEW_STATUS } from "../../utils/interviews";

const POSTULACIONES_EVENT = "apolo:postulaciones-updated";
const EMPTY_FILTERS = {
  q: "",
  estadoEntrevista: "",
  periodo: "",
  ciudad: "",
};
const EMPTY_PAGINATION = {
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};
const EMPTY_SUMMARY = {
  pendientesAgendar: 0,
  agendadasHoy: 0,
  porConfirmar: 0,
  reprogramaciones: 0,
};

export default function Entrevistas() {
  const [interviews, setInterviews] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [activeView, setActiveView] = useState("lista");
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCandidate, setDrawerCandidate] = useState(null);
  const [drawerCandidates, setDrawerCandidates] = useState([]);
  const [loadingCandidatePicker, setLoadingCandidatePicker] = useState(false);
  const openerRef = useRef(null);

  useEffect(() => {
    let active = true;

    api.get("/agencias")
      .then((agenciesResponse) => {
        if (!active) return;
        setAgencies((agenciesResponse.data || []).filter((agency) => agency.activo !== false));
      })
      .catch(() => {
        if (!active) return;
        setError("No se pudieron cargar las agencias.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      const dateRange = getInterviewDateRange(filters.periodo);
      const limit = activeView === "calendario" ? 100 : 10;

      try {
        setLoading(true);
        setSummaryLoading(true);
        setError("");
        const [listResponse, summaryResponse] = await Promise.all([
          api.get("/api/postulaciones", {
            params: {
              fase: "entrevista",
              page: activeView === "calendario" ? 1 : page,
              limit,
              q: filters.q.trim() || undefined,
              estadoEntrevista: filters.estadoEntrevista || undefined,
              entrevistaPeriodo: filters.periodo || undefined,
              entrevistaFechaDesde: dateRange.desde || undefined,
              entrevistaFechaHasta: dateRange.hasta || undefined,
              ciudad: filters.ciudad.trim() || undefined,
            },
          }),
          api.get("/api/postulaciones/resumen"),
        ]);

        if (!active) return;
        setInterviews(listResponse.data?.data || []);
        setPagination(listResponse.data?.pagination || { ...EMPTY_PAGINATION, limit });
        setSummary({ ...EMPTY_SUMMARY, ...(summaryResponse.data?.data || {}) });
      } catch (requestError) {
        if (!active) return;
        setInterviews([]);
        setError(requestError.response?.data?.message || "No se pudieron cargar las entrevistas.");
      } finally {
        if (active) {
          setLoading(false);
          setSummaryLoading(false);
        }
      }
    }, filters.q ? 350 : 0);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeView, filters, page, refreshToken]);

  const refresh = () => {
    setRefreshToken((current) => current + 1);
    window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
  };

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerCandidate(null);
    setDrawerCandidates([]);
    window.setTimeout(() => openerRef.current?.focus?.(), 0);
  }, []);

  const openDrawerForCandidate = (candidate) => {
    openerRef.current = document.activeElement;
    setDrawerCandidates([candidate]);
    setDrawerCandidate(candidate);
    setDrawerOpen(true);
  };

  const openCandidatePicker = async () => {
    openerRef.current = document.activeElement;
    try {
      setLoadingCandidatePicker(true);
      const response = await api.get("/api/postulaciones", {
        params: {
          fase: "entrevista",
          estadoEntrevista: "PENDIENTE",
          page: 1,
          limit: 100,
        },
      });
      const candidates = (response.data?.data || []).filter((item) => !item.fechaEntrevista);

      if (!candidates.length) {
        await Swal.fire({
          icon: "info",
          title: "Sin entrevistas pendientes",
          text: "No hay postulantes pendientes de agendar.",
          confirmButtonColor: "#f97316",
        });
        return;
      }

      setDrawerCandidates(candidates);
      setDrawerCandidate(null);
      setDrawerOpen(true);
    } catch (requestError) {
      Swal.fire("Error", requestError.response?.data?.message || "No se pudieron cargar los postulantes.", "error");
    } finally {
      setLoadingCandidatePicker(false);
    }
  };

  const saveInterview = async (candidate, payload) => {
    const response = await api.patch(`/api/postulaciones/${candidate.id}/fecha-entrevista`, payload);
    const updated = response.data?.data;
    if (updated) {
      setInterviews((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    }
    refresh();
    await Swal.fire({
      icon: "success",
      title: candidate.fechaEntrevista ? "Entrevista reprogramada" : "Entrevista agendada",
      text: "La agenda fue guardada correctamente.",
      timer: 1600,
      showConfirmButton: false,
    });
  };

  const viewInterview = async (interview) => {
    setSelected(interview);
    if (interview.leida) return;
    try {
      const response = await api.patch(`/api/postulaciones/${interview.id}/leida`);
      const updated = response.data?.data;
      setInterviews((current) =>
        current.map((item) =>
          item.id === interview.id ? { ...item, leida: true, leidaAt: updated?.leidaAt } : item,
        ),
      );
    } catch {
      // El detalle puede abrirse aunque falle el indicador secundario de lectura.
    }
  };

  const changeStatus = async (interview, status) => {
    const meta = INTERVIEW_STATUS[status];
    const destructive = ["NO_ASISTIO", "CANCELADA"].includes(status);
    const result = await Swal.fire({
      icon: destructive ? "warning" : "question",
      title: `Cambiar estado a “${meta?.label || status}”`,
      text: `Se actualizará la entrevista de ${getCandidateName(interview)}.`,
      showCancelButton: true,
      confirmButtonText: "Sí, actualizar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: destructive ? "#dc2626" : "#f97316",
    });
    if (!result.isConfirmed) return;

    try {
      await api.patch(`/api/postulaciones/${interview.id}/estado-entrevista`, {
        estadoEntrevista: status,
      });
      refresh();
      Swal.fire({ icon: "success", title: "Estado actualizado", timer: 1300, showConfirmButton: false });
    } catch (requestError) {
      Swal.fire("Error", requestError.response?.data?.message || "No se pudo actualizar el estado.", "error");
    }
  };

  const returnToApplications = async (interview) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Regresar a postulaciones",
      text: `¿Deseas regresar a ${getCandidateName(interview)} a Postulaciones?`,
      showCancelButton: true,
      confirmButtonText: "Sí, regresar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f97316",
    });
    if (!result.isConfirmed) return;

    try {
      await api.patch(`/api/postulaciones/${interview.id}/entrevista`, { pasaEntrevista: false });
      refresh();
      Swal.fire({ icon: "success", title: "Postulante regresado", timer: 1300, showConfirmButton: false });
    } catch (requestError) {
      Swal.fire("Error", requestError.response?.data?.message || "No se pudo regresar al postulante.", "error");
    }
  };

  const discardCandidate = async (interview) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Descartar postulante",
      text: `¿Deseas enviar a ${getCandidateName(interview)} a Descartados? No se eliminará de la base de datos.`,
      showCancelButton: true,
      confirmButtonText: "Sí, descartar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;

    try {
      await api.patch(`/api/postulaciones/${interview.id}/descartada`, { descartada: true });
      refresh();
      Swal.fire({ icon: "success", title: "Enviado a Descartados", timer: 1300, showConfirmButton: false });
    } catch (requestError) {
      Swal.fire("Error", requestError.response?.data?.message || "No se pudo descartar al postulante.", "error");
    }
  };

  const changeFilters = (nextFilters) => {
    setFilters(nextFilters);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600">
            Desarrollo Organizacional
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Entrevistas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Administra y agenda las entrevistas de los postulantes.
          </p>
        </div>
        <button
          type="button"
          onClick={openCandidatePicker}
          disabled={loadingCandidatePicker}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingCandidatePicker ? <RefreshCw className="animate-spin" size={17} /> : <Plus size={18} />}
          Agendar entrevista
        </button>
      </header>

      <InterviewSummaryCards summary={summary} loading={summaryLoading} />

      <section className="mt-6 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex border-b border-slate-200 px-4 pt-2">
          {[
            { key: "lista", label: "Lista", icon: List },
            { key: "calendario", label: "Calendario", icon: CalendarDays },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveView(key);
                setPage(1);
              }}
              className={`inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-bold transition ${
                activeView === key
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>

        <InterviewFilters
          filters={filters}
          onChange={changeFilters}
          onClear={() => changeFilters(EMPTY_FILTERS)}
        />

        {error && (
          <div className="mx-4 mb-4 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={refresh} className="text-left font-extrabold underline sm:text-right">Reintentar</button>
          </div>
        )}

        {activeView === "lista" ? (
          <InterviewTable
            interviews={interviews}
            loading={loading}
            pagination={pagination}
            onPageChange={setPage}
            onSchedule={openDrawerForCandidate}
            onView={viewInterview}
            onStatusChange={changeStatus}
            onReturn={returnToApplications}
            onDiscard={discardCandidate}
          />
        ) : (
          <InterviewCalendar interviews={interviews} loading={loading} onView={viewInterview} />
        )}
      </section>

      <InterviewSchedulerDrawer
        open={drawerOpen}
        candidate={drawerCandidate}
        candidates={drawerCandidates}
        agencies={agencies}
        onCandidateChange={setDrawerCandidate}
        onClose={closeDrawer}
        onSubmit={saveInterview}
      />

      {selected && <ModalDetalle postulacion={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
