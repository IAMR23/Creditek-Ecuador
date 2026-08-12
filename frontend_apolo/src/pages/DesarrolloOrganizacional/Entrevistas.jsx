import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, List, Plus, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import InterviewCalendar from "../../components/entrevistas/InterviewCalendar";
import InterviewFilters from "../../components/entrevistas/InterviewFilters";
import InterviewSchedulerDrawer from "../../components/entrevistas/InterviewSchedulerDrawer";
import InterviewSummaryCards from "../../components/entrevistas/InterviewSummaryCards";
import InterviewTable from "../../components/entrevistas/InterviewTable";
import ModalDetalle from "../../components/PostulacionDetalle";
import CreateUserModal from "../../components/usuarios/CreateUserModal";
import {
  getCandidateIdentification,
  getCandidateName,
  getInterviewDateRange,
  INTERVIEW_STATUS,
} from "../../utils/interviews";

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

const getDownloadErrorMessage = async (error) => {
  const responseData = error.response?.data;

  if (responseData instanceof Blob) {
    try {
      const payload = JSON.parse(await responseData.text());
      if (payload?.message) return payload.message;
    } catch {
      // El backend puede responder texto o un cuerpo vacio.
    }
  }

  return responseData?.message || "No se pudo generar el contrato de capacitación.";
};

export default function Entrevistas({ modo = "entrevista" }) {
  const navigate = useNavigate();
  const isSelectedMode = modo === "seleccionado";
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
  const [downloadingContractId, setDownloadingContractId] = useState(null);
  const [createUserCandidate, setCreateUserCandidate] = useState(null);
  const [roles, setRoles] = useState([]);
  const [checkingUserCandidateId, setCheckingUserCandidateId] = useState(null);
  const [userExistsCandidateIds, setUserExistsCandidateIds] = useState(
    () => new Set(),
  );
  const [expandedReferencesId, setExpandedReferencesId] = useState(null);
  const [savingReferenceKey, setSavingReferenceKey] = useState("");
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
              fase: isSelectedMode ? "seleccionado" : "entrevista",
              page: activeView === "calendario" ? 1 : page,
              limit,
              q: filters.q.trim() || undefined,
              estadoEntrevista:
                !isSelectedMode && filters.estadoEntrevista
                  ? filters.estadoEntrevista
                  : undefined,
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
        setError(
          requestError.response?.data?.message ||
            (isSelectedMode
              ? "No se pudieron cargar los postulantes seleccionados."
              : "No se pudieron cargar las entrevistas."),
        );
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
  }, [activeView, filters, isSelectedMode, page, refreshToken]);

  const refresh = () => {
    setRefreshToken((current) => current + 1);
    window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
  };

  const aplicarResumenActualizado = (resumenActualizado) => {
    if (resumenActualizado) {
      setSummary({ ...EMPTY_SUMMARY, ...resumenActualizado });
      setSummaryLoading(false);
    }
    window.dispatchEvent(new CustomEvent(POSTULACIONES_EVENT));
  };

  const quitarEntrevistaVisible = (interviewId, resumenActualizado) => {
    const currentLimit = pagination.limit || EMPTY_PAGINATION.limit;
    const currentTotal = pagination.total || interviews.length;
    const nextTotal = Math.max(currentTotal - 1, 0);
    const nextTotalPages = Math.max(Math.ceil(nextTotal / currentLimit), 1);

    setSelected((current) => (current?.id === interviewId ? null : current));
    setExpandedReferencesId((current) =>
      current === interviewId ? null : current,
    );
    aplicarResumenActualizado(resumenActualizado);

    if (activeView === "lista" && interviews.length === 1 && page > nextTotalPages) {
      setPage(nextTotalPages);
      return;
    }

    setInterviews((current) =>
      current.filter((interview) => interview.id !== interviewId),
    );
    setPagination((current) => ({
      ...current,
      total: nextTotal,
      totalPages: nextTotalPages,
      hasNextPage: page < nextTotalPages,
      hasPrevPage: page > 1,
    }));
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

  const downloadTrainingAgreement = async (interview) => {
    const identification = getCandidateIdentification(interview);

    if (!identification || identification === "-") {
      await Swal.fire({
        icon: "warning",
        title: "Cédula pendiente",
        text: "Registra la cédula del postulante antes de generar el contrato.",
        confirmButtonColor: "#f97316",
      });
      return;
    }

    try {
      setDownloadingContractId(interview.id);
      const response = await api.get(
        `/api/postulaciones/${interview.id}/contrato-capacitacion.pdf`,
        { responseType: "blob" },
      );
      const pdfBlob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: "application/pdf" });
      const objectUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      const safeIdentification = String(identification)
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 30);

      link.href = objectUrl;
      link.download = `acuerdo-capacitacion-${safeIdentification || interview.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
    } catch (requestError) {
      Swal.fire(
        "Error",
        await getDownloadErrorMessage(requestError),
        "error",
      );
    } finally {
      setDownloadingContractId(null);
    }
  };

  const openCreateUserModal = async (interview) => {
    const identification = getCandidateIdentification(interview);

    if (!identification || identification === "-") {
      await Swal.fire({
        icon: "warning",
        title: "Cédula pendiente",
        text: "Registra la cédula del postulante antes de crear el usuario.",
        confirmButtonColor: "#f97316",
      });
      return;
    }

    try {
      setCheckingUserCandidateId(interview.id);
      const [rolesResponse, userResponse] = await Promise.all([
        roles.length ? Promise.resolve({ data: roles }) : api.get("/rol"),
        api.get(
          `/usuarios/por-cedula/${encodeURIComponent(identification)}`,
        ),
      ]);

      if (userResponse.data?.existe) {
        const existingUser = userResponse.data.usuario;
        setUserExistsCandidateIds((current) => {
          const next = new Set(current);
          next.add(interview.id);
          return next;
        });
        await Swal.fire({
          icon: "info",
          title: "Usuario ya registrado",
          text: `${existingUser.nombre || "El postulante"} ya existe en Usuarios y está ${
            existingUser.activo ? "activo" : "inactivo"
          }.`,
          confirmButtonColor: "#f97316",
        });
        return;
      }

      setRoles(rolesResponse.data || []);
      setCreateUserCandidate(interview);
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo verificar el usuario",
        text:
          error.response?.data?.message ||
          "No se pudo consultar si la cédula ya está registrada.",
        confirmButtonColor: "#f97316",
      });
    } finally {
      setCheckingUserCandidateId(null);
    }
  };

  const handleUserCreated = () => {
    if (createUserCandidate?.id) {
      setUserExistsCandidateIds((current) => {
        const next = new Set(current);
        next.add(createUserCandidate.id);
        return next;
      });
    }
    setCreateUserCandidate(null);
    refresh();
  };

  const changeStatus = async (interview, status) => {
    const meta = INTERVIEW_STATUS[status];
    const destructive = ["NO_ASISTIO", "NO_ASISTIO_CAP", "CANCELADA"].includes(status);
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
      const response = await api.patch(`/api/postulaciones/${interview.id}/estado-entrevista`, {
        estadoEntrevista: status,
      });
      const updatedInterview = response.data?.data;
      const selectedStatuses = ["SELECCIONADO", "NO_ASISTIO_CAP"];
      const remainsInCurrentPhase = isSelectedMode
        ? selectedStatuses.includes(status)
        : !selectedStatuses.includes(status);
      const matchesStatusFilter =
        isSelectedMode || !filters.estadoEntrevista || filters.estadoEntrevista === status;

      if (!remainsInCurrentPhase || !matchesStatusFilter) {
        quitarEntrevistaVisible(interview.id, response.data?.resumen);
      } else {
        setInterviews((current) =>
          current.map((item) =>
            item.id === interview.id ? updatedInterview || { ...item, estadoEntrevista: status } : item,
          ),
        );
        setSelected((current) =>
          current?.id === interview.id
            ? updatedInterview || { ...current, estadoEntrevista: status }
            : current,
        );
        aplicarResumenActualizado(response.data?.resumen);
      }
      Swal.fire({
        icon: "success",
        title: status === "SELECCIONADO" ? "Postulante seleccionado" : "Estado actualizado",
        timer: 1300,
        showConfirmButton: false,
      });
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
      const response = await api.patch(`/api/postulaciones/${interview.id}/entrevista`, {
        pasaEntrevista: false,
      });
      quitarEntrevistaVisible(interview.id, response.data?.resumen);
      Swal.fire({ icon: "success", title: "Postulante regresado", timer: 1300, showConfirmButton: false });
    } catch (requestError) {
      Swal.fire("Error", requestError.response?.data?.message || "No se pudo regresar al postulante.", "error");
    }
  };

  const discardCandidate = async (interview, presetReason = "") => {
    const normalizedPresetReason = String(presetReason || "").trim();
    const result = await Swal.fire(
      normalizedPresetReason
        ? {
            icon: "warning",
            title: normalizedPresetReason,
            text: `Deseas enviar a ${getCandidateName(interview)} a Descartados?`,
            showCancelButton: true,
            confirmButtonText: "Si, enviar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#dc2626",
          }
        : {
            icon: "warning",
            title: "Descartar postulante",
            text: `Indica por qué ${getCandidateName(interview)} será enviado a Descartados.`,
            input: "textarea",
            inputLabel: "Motivo del descarte",
            inputPlaceholder: "Escribe el motivo del descarte",
            inputAttributes: { maxlength: "1000" },
            inputValidator: (value) =>
              value?.trim() ? undefined : "Debe ingresar el motivo del descarte",
            showCancelButton: true,
            confirmButtonText: "Sí, descartar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#dc2626",
          },
    );
    if (!result.isConfirmed) return;
    const motivoDescarte =
      normalizedPresetReason || String(result.value || "").trim();

    try {
      const response = await api.patch(`/api/postulaciones/${interview.id}/descartada`, {
        descartada: true,
        motivoDescarte,
      });
      quitarEntrevistaVisible(interview.id, response.data?.resumen);
      Swal.fire({ icon: "success", title: "Enviado a Descartados", timer: 1300, showConfirmButton: false });
    } catch (requestError) {
      Swal.fire("Error", requestError.response?.data?.message || "No se pudo descartar al postulante.", "error");
    }
  };

  const toggleReferences = (interview) => {
    setExpandedReferencesId((current) =>
      current === interview.id ? null : interview.id,
    );
  };

  const updateReferenceLocal = (
    interviewId,
    type,
    referenceIndex,
    changes,
  ) => {
    const collectionKey =
      type === "familiar"
        ? "personas_con_quien_vive"
        : "historial_laboral";

    setInterviews((current) =>
      current.map((interview) => {
        if (interview.id !== interviewId) return interview;

        const formulario = interview.formulario || {};
        const references = Array.isArray(formulario[collectionKey])
          ? formulario[collectionKey].map((reference, index) =>
              index === referenceIndex
                ? { ...reference, ...changes }
                : reference,
            )
          : [];

        return {
          ...interview,
          formulario: {
            ...formulario,
            [collectionKey]: references,
          },
        };
      }),
    );
  };

  const addReference = async (interview, type, reference) => {
    const collectionKey =
      type === "familiar"
        ? "personas_con_quien_vive"
        : "historial_laboral";
    const key = `${interview.id}-${type}-new`;

    try {
      setSavingReferenceKey(key);
      const response = await api.post(
        `/api/postulaciones/${interview.id}/referencias/${type}`,
        reference,
      );
      const savedReference = response.data?.referencia;

      if (!savedReference) {
        throw new Error("El servidor no devolvió la referencia guardada.");
      }

      setInterviews((current) =>
        current.map((item) => {
          if (item.id !== interview.id) return item;

          const formulario = item.formulario || {};
          const references = Array.isArray(formulario[collectionKey])
            ? [...formulario[collectionKey], savedReference]
            : [savedReference];

          return {
            ...item,
            formulario: {
              ...formulario,
              [collectionKey]: references,
            },
          };
        }),
      );

      await Swal.fire({
        icon: "success",
        title: "Referencia agregada",
        text: `La referencia ${type} se guardó correctamente.`,
        timer: 1400,
        showConfirmButton: false,
      });
      return true;
    } catch (requestError) {
      await Swal.fire(
        "Error",
        requestError.response?.data?.message ||
          requestError.message ||
          "No se pudo agregar la referencia.",
        "error",
      );
      return false;
    } finally {
      setSavingReferenceKey("");
    }
  };

  const changeReferenceCalled = async (
    interview,
    type,
    referenceIndex,
    called,
  ) => {
    const collectionKey =
      type === "familiar"
        ? "personas_con_quien_vive"
        : "historial_laboral";
    const previousCalled = Boolean(
      interview.formulario?.[collectionKey]?.[referenceIndex]?.llamado,
    );
    const key = `${interview.id}-${type}-${referenceIndex}`;

    updateReferenceLocal(
      interview.id,
      type,
      referenceIndex,
      { llamado: called },
    );

    try {
      setSavingReferenceKey(key);
      await api.patch(
        `/api/postulaciones/${interview.id}/referencias/${type}/${referenceIndex}/llamado`,
        { llamado: called },
      );
    } catch (requestError) {
      updateReferenceLocal(
        interview.id,
        type,
        referenceIndex,
        { llamado: previousCalled },
      );
      Swal.fire(
        "Error",
        requestError.response?.data?.message ||
          "No se pudo guardar el estado de la llamada.",
        "error",
      );
    } finally {
      setSavingReferenceKey("");
    }
  };

  const changeReferenceObservation = (
    interviewId,
    type,
    referenceIndex,
    observation,
  ) => {
    updateReferenceLocal(interviewId, type, referenceIndex, {
      observacion: observation,
    });
  };

  const saveReferenceObservation = async (
    interview,
    type,
    referenceIndex,
    observation,
  ) => {
    const key = `${interview.id}-${type}-${referenceIndex}`;
    const normalizedObservation = observation.trim();

    updateReferenceLocal(interview.id, type, referenceIndex, {
      observacion: normalizedObservation,
    });

    try {
      setSavingReferenceKey(key);
      await api.patch(
        `/api/postulaciones/${interview.id}/referencias/${type}/${referenceIndex}/llamado`,
        { observacion: normalizedObservation },
      );
    } catch (requestError) {
      refresh();
      Swal.fire(
        "Error",
        requestError.response?.data?.message ||
          "No se pudo guardar la observación de la referencia.",
        "error",
      );
    } finally {
      setSavingReferenceKey("");
    }
  };

  const changeGeneralReferenceObservation = (interviewId, observation) => {
    setInterviews((current) =>
      current.map((interview) => {
        if (interview.id !== interviewId) return interview;

        const formulario = interview.formulario || {};
        return {
          ...interview,
          formulario: {
            ...formulario,
            metadata: {
              ...(formulario.metadata || {}),
              observacion_referencias: observation,
            },
          },
        };
      }),
    );
  };

  const saveGeneralReferenceObservation = async (
    interview,
    observation,
  ) => {
    const key = `${interview.id}-general`;
    const normalizedObservation = observation.trim();

    changeGeneralReferenceObservation(interview.id, normalizedObservation);

    try {
      setSavingReferenceKey(key);
      await api.patch(
        `/api/postulaciones/${interview.id}/referencias/observacion`,
        { observacion: normalizedObservation },
      );
    } catch (requestError) {
      refresh();
      Swal.fire(
        "Error",
        requestError.response?.data?.message ||
          "No se pudo guardar la observación general.",
        "error",
      );
    } finally {
      setSavingReferenceKey("");
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
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
            {isSelectedMode ? "Seleccionados" : "Entrevistas"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSelectedMode
              ? "Consulta los postulantes seleccionados después de su entrevista."
              : "Administra y agenda las entrevistas de los postulantes."}
          </p>
        </div>
        {!isSelectedMode && (
          <button
            type="button"
            onClick={openCandidatePicker}
            disabled={loadingCandidatePicker}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingCandidatePicker ? <RefreshCw className="animate-spin" size={17} /> : <Plus size={18} />}
            Agendar entrevista
          </button>
        )}
      </header>

      {!isSelectedMode && (
        <InterviewSummaryCards summary={summary} loading={summaryLoading} />
      )}

      <section className="mt-6 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!isSelectedMode && (
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
        )}

        <InterviewFilters
          filters={filters}
          onChange={changeFilters}
          onClear={() => changeFilters(EMPTY_FILTERS)}
          showStatus={!isSelectedMode}
        />

        {error && (
          <div className="mx-4 mb-4 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={refresh} className="text-left font-extrabold underline sm:text-right">Reintentar</button>
          </div>
        )}

        {activeView === "lista" || isSelectedMode ? (
          <InterviewTable
            interviews={interviews}
            loading={loading}
            pagination={pagination}
            onPageChange={setPage}
            onSchedule={openDrawerForCandidate}
            onView={viewInterview}
            onDownloadContract={downloadTrainingAgreement}
            downloadingContractId={downloadingContractId}
            onCreateUser={openCreateUserModal}
            onEvaluate={(interview) =>
              navigate(`/seleccionados/${interview.id}/evaluacion-desempeno`)
            }
            checkingUserCandidateId={checkingUserCandidateId}
            userExistsCandidateIds={userExistsCandidateIds}
            onStatusChange={changeStatus}
            onReturn={returnToApplications}
            onDiscard={discardCandidate}
            onToggleReferences={toggleReferences}
            expandedReferencesId={expandedReferencesId}
            savingReferenceKey={savingReferenceKey}
            onCalledChange={changeReferenceCalled}
            onObservationChange={changeReferenceObservation}
            onObservationBlur={saveReferenceObservation}
            onGeneralObservationChange={changeGeneralReferenceObservation}
            onGeneralObservationBlur={saveGeneralReferenceObservation}
            onAddReference={addReference}
            selectedMode={isSelectedMode}
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

      <CreateUserModal
        open={Boolean(createUserCandidate)}
        candidate={createUserCandidate}
        roles={roles}
        agencies={agencies}
        onClose={() => setCreateUserCandidate(null)}
        onCreated={handleUserCreated}
      />
    </div>
  );
}
