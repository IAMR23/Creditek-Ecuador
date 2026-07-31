import { Fragment } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  EllipsisVertical,
  FileDown,
  PhoneCall,
  UserPlus,
} from "lucide-react";
import {
  formatDateOnly,
  formatInterviewDate,
  formatInterviewTime,
  getCandidateCity,
  getCandidateEmail,
  getCandidateIdentification,
  getCandidateName,
  getCandidatePhone,
  getInitials,
  getInterviewStatus,
} from "../../utils/interviews";
import InterviewStatusBadge from "./InterviewStatusBadge";
import InterviewReferencesPanel from "./InterviewReferencesPanel";

const getReferenceCount = (interview) => {
  const familyReferences = interview?.formulario?.personas_con_quien_vive;
  const workReferences = interview?.formulario?.historial_laboral;

  return (
    (Array.isArray(familyReferences) ? familyReferences.length : 0) +
    (Array.isArray(workReferences) ? workReferences.length : 0)
  );
};

function CandidateCell({ interview }) {
  const name = getCandidateName(interview);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-extrabold text-orange-700">
        {getInitials(name)}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-slate-900">{name}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Cédula: {getCandidateIdentification(interview)}
        </p>
        {!interview.leida && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Nueva
          </span>
        )}
      </div>
    </div>
  );
}

function InterviewDateCell({ interview }) {
  if (!interview.fechaEntrevista) {
    return <span className="text-sm font-semibold text-slate-400">Sin agendar</span>;
  }

  return (
    <div>
      <p className="font-semibold text-slate-800">{formatInterviewDate(interview.fechaEntrevista)}</p>
      <p className="mt-1 text-xs text-slate-500">
        {formatInterviewTime(interview.fechaEntrevista)}
      </p>
    </div>
  );
}

function InterviewPhaseDateCell({ interview }) {
  if (!interview.pasaEntrevistaAt) {
    return <span className="text-sm font-semibold text-slate-400">-</span>;
  }

  return (
    <p className="font-semibold text-slate-800">{formatInterviewDate(interview.pasaEntrevistaAt)}</p>
  );
}

function InterviewLocationCell({ interview }) {
  const isVirtual = interview.entrevistaModalidad === "VIRTUAL";
  const location = isVirtual
    ? interview.entrevistaEnlace?.trim()
    : interview.entrevistaLugar?.trim();

  if (!location) {
    return <span className="text-sm font-semibold text-slate-400">Sin definir</span>;
  }

  return (
    <div className="max-w-52">
      <p className="break-words font-semibold text-slate-800">{location}</p>
      <p className="mt-1 text-xs text-slate-500">
        {isVirtual ? "Virtual" : "Presencial"}
      </p>
    </div>
  );
}

function IncorporationDateCell({ interview, showLabel = false }) {
  const incorporation = interview.incorporacion;
  const date = incorporation?.fechaIngreso;
  const text = !incorporation?.usuarioId
    ? "Pendiente de crear usuario"
    : date
      ? formatDateOnly(date)
      : "Sin fecha de ingreso";

  return (
    <div>
      {showLabel && (
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Fecha de ingreso
        </p>
      )}
      <p
        className={`font-semibold ${
          date ? "text-slate-800" : "text-slate-400"
        } ${showLabel ? "mt-1" : ""}`}
      >
        {text}
      </p>
    </div>
  );
}

function IncorporationAgencyCell({ interview, showLabel = false }) {
  const incorporation = interview.incorporacion;
  const agencyName = incorporation?.agencia?.nombre;
  const text = !incorporation?.usuarioId
    ? "Pendiente de crear usuario"
    : agencyName || "Sin agencia activa";

  return (
    <div>
      {showLabel && (
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Agencia
        </p>
      )}
      <p
        className={`font-semibold ${
          agencyName ? "text-slate-800" : "text-slate-400"
        } ${showLabel ? "mt-1" : ""}`}
      >
        {text}
      </p>
    </div>
  );
}

function InterviewActions({
  interview,
  onSchedule,
  onView,
  onDownloadContract,
  downloadingContractId,
  onCreateUser,
  checkingUserCandidateId,
  userExistsCandidateIds,
  onStatusChange,
  onReturn,
  onDiscard,
  onToggleReferences,
  expandedReferencesId,
  selectedMode,
}) {
  const scheduled = Boolean(interview.fechaEntrevista);
  const downloadingContract = downloadingContractId === interview.id;
  const checkingUser = checkingUserCandidateId === interview.id;
  const userExists =
    Boolean(interview.incorporacion?.usuarioId) ||
    userExistsCandidateIds?.has(interview.id);
  const referenceCount = getReferenceCount(interview);
  const referencesExpanded = expandedReferencesId === interview.id;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!selectedMode && (
        <button
          type="button"
          onClick={() => onSchedule(interview)}
          className="rounded-lg px-2 py-1.5 text-xs font-extrabold text-orange-600 transition hover:bg-orange-50"
        >
          {scheduled ? "Reprogramar" : "Agendar"}
        </button>
      )}
      {selectedMode && (
        <>
          <button
            type="button"
            onClick={() => onDownloadContract(interview)}
            disabled={downloadingContract}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Descargar contrato de capacitación de ${getCandidateName(interview)}`}
            title="Descargar contrato de capacitación"
          >
            <FileDown size={14} />
            {downloadingContract ? "Generando..." : "Contrato PDF"}
          </button>
          <button
            type="button"
            onClick={() => onCreateUser(interview)}
            disabled={checkingUser || userExists}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-extrabold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Crear usuario para ${getCandidateName(interview)}`}
            title="Crear usuario desde la postulación"
          >
            <UserPlus size={14} />
            {checkingUser
              ? "Verificando..."
              : userExists
                ? "Usuario existente"
                : "Crear usuario"}
          </button>
        </>
      )}
      {!selectedMode && (
        <button
          type="button"
          onClick={() => onToggleReferences(interview)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-extrabold text-blue-700 transition hover:bg-blue-100"
          aria-expanded={referencesExpanded}
          title={
            referenceCount
              ? "Ver referencias laborales y familiares"
              : "Abrir observaciones de referencias"
          }
        >
          <PhoneCall size={14} />
          Referencias ({referenceCount})
          {referencesExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}
      <button
        type="button"
        onClick={() => onView(interview)}
        className="rounded-lg px-2 py-1.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100"
      >
        Ver
      </button>
      <details className="relative">
        <summary
          className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
          aria-label="Más acciones"
        >
          <EllipsisVertical size={16} />
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
          {scheduled && getInterviewStatus(interview) !== "CONFIRMADA" && (
            <button type="button" onClick={() => onStatusChange(interview, "CONFIRMADA")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              Marcar como confirmada
            </button>
          )}
          {scheduled && getInterviewStatus(interview) !== "REALIZADA" && (
            <button type="button" onClick={() => onStatusChange(interview, "REALIZADA")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Marcar como realizada
            </button>
          )}
          {scheduled && getInterviewStatus(interview) !== "SELECCIONADO" && (
            <button type="button" onClick={() => onStatusChange(interview, "SELECCIONADO")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-teal-700 hover:bg-teal-50">
              Marcar como seleccionado
            </button>
          )}
          {selectedMode && getInterviewStatus(interview) !== "NO_ASISTIO_CAP" && (
            <button type="button" onClick={() => onStatusChange(interview, "NO_ASISTIO_CAP")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50">
              No asistio a la capacitacion
            </button>
          )}
          {scheduled && (
            <button type="button" onClick={() => onStatusChange(interview, "NO_ASISTIO")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50">
              Registrar que no asistió
            </button>
          )}
          {scheduled && (
            <button type="button" onClick={() => onStatusChange(interview, "CANCELADA")} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100">
              Cancelar entrevista
            </button>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button type="button" onClick={() => onReturn(interview)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Regresar a postulaciones
          </button>
          <button type="button" onClick={() => onDiscard(interview)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50">
            Descartar postulante
          </button>
        </div>
      </details>
    </div>
  );
}

function MobileCard(props) {
  const { interview } = props;
  const email = getCandidateEmail(interview);

  return (
    <article className="space-y-4 border-b border-slate-100 p-4 last:border-b-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pase a entrevista</p>
        <div className="mt-1"><InterviewPhaseDateCell interview={interview} /></div>
      </div>
      <CandidateCell interview={interview} />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contacto</p>
          <p className="mt-1 font-semibold text-slate-700">{getCandidatePhone(interview)}</p>
          {email && <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ciudad</p>
          <p className="mt-1 font-semibold text-slate-700">{getCandidateCity(interview)}</p>
        </div>
      </div>
      <InterviewStatusBadge status={getInterviewStatus(interview)} />
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
        {props.selectedMode ? (
          <>
            <IncorporationDateCell interview={interview} showLabel />
            <IncorporationAgencyCell interview={interview} showLabel />
          </>
        ) : (
          <>
            <InterviewDateCell interview={interview} />
            <InterviewLocationCell interview={interview} />
          </>
        )}
      </div>
      <InterviewActions {...props} />
      {!props.selectedMode &&
        props.expandedReferencesId === interview.id && (
          <InterviewReferencesPanel
            interview={interview}
            savingReferenceKey={props.savingReferenceKey}
            onCalledChange={props.onCalledChange}
            onObservationChange={props.onObservationChange}
            onObservationBlur={props.onObservationBlur}
            onGeneralObservationChange={props.onGeneralObservationChange}
            onGeneralObservationBlur={props.onGeneralObservationBlur}
          />
        )}
    </article>
  );
}

export default function InterviewTable({
  interviews,
  loading,
  pagination,
  onPageChange,
  selectedMode = false,
  ...actions
}) {
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm font-semibold text-slate-500">
        <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
        Cargando {selectedMode ? "seleccionados" : "entrevistas"}...
      </div>
    );
  }

  if (!interviews.length) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
        <p className="text-base font-bold text-slate-800">
          {selectedMode ? "No hay postulantes seleccionados" : "No hay entrevistas para mostrar"}
        </p>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          {selectedMode
            ? "Los postulantes marcados como seleccionados aparecerán en esta sección."
            : "Ajusta los filtros o pasa un postulante a Entrevistas para comenzar."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        {interviews.map((interview) => (
          <MobileCard
            key={interview.id}
            interview={interview}
            selectedMode={selectedMode}
            {...actions}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead>
            <tr className="border-y border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-bold">Pase a entrevista</th>
              <th className="px-5 py-3 font-bold">Aspirante</th>
              <th className="px-4 py-3 font-bold">Contacto</th>
              <th className="px-4 py-3 font-bold">Ciudad</th>
              <th className="px-4 py-3 font-bold">Estado</th>
              <th className="px-4 py-3 font-bold">
                {selectedMode ? "Fecha de ingreso" : "Entrevista"}
              </th>
              <th className="px-4 py-3 font-bold">
                {selectedMode ? "Agencia" : "Lugar de la entrevista"}
              </th>
              <th className="px-5 py-3 text-right font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {interviews.map((interview) => {
              const email = getCandidateEmail(interview);
              return (
                <Fragment key={interview.id}>
                <tr className="align-middle transition hover:bg-slate-50/80">
                  <td className="px-5 py-4 text-sm"><InterviewPhaseDateCell interview={interview} /></td>
                  <td className="max-w-[260px] px-5 py-4"><CandidateCell interview={interview} /></td>
                  <td className="px-4 py-4 text-sm">
                    <p className="font-semibold text-slate-700">{getCandidatePhone(interview)}</p>
                    <p className="mt-1 max-w-44 truncate text-xs text-slate-500">{email || "Sin correo registrado"}</p>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">{getCandidateCity(interview)}</td>
                  <td className="px-4 py-4"><InterviewStatusBadge status={getInterviewStatus(interview)} /></td>
                  <td className="px-4 py-4 text-sm">
                    {selectedMode ? (
                      <IncorporationDateCell interview={interview} />
                    ) : (
                      <InterviewDateCell interview={interview} />
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {selectedMode ? (
                      <IncorporationAgencyCell interview={interview} />
                    ) : (
                      <InterviewLocationCell interview={interview} />
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <InterviewActions
                      interview={interview}
                      selectedMode={selectedMode}
                      {...actions}
                    />
                  </td>
                </tr>
                {!selectedMode &&
                  actions.expandedReferencesId === interview.id && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={8} className="px-5 py-4">
                        <InterviewReferencesPanel
                          interview={interview}
                          savingReferenceKey={actions.savingReferenceKey}
                          onCalledChange={actions.onCalledChange}
                          onObservationChange={actions.onObservationChange}
                          onObservationBlur={actions.onObservationBlur}
                          onGeneralObservationChange={actions.onGeneralObservationChange}
                          onGeneralObservationBlur={actions.onGeneralObservationBlur}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Mostrando {interviews.length} de {pagination.total}{" "}
          {selectedMode
            ? `seleccionado${pagination.total === 1 ? "" : "s"}`
            : `entrevista${pagination.total === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!pagination.hasPrevPage}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft size={17} />
          </button>
          <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-orange-300 bg-orange-50 px-3 font-bold text-orange-700">
            {pagination.page}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasNextPage}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Página siguiente"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </>
  );
}
