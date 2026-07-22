import { ChevronLeft, ChevronRight, EllipsisVertical } from "lucide-react";
import {
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

function InterviewerCell({ interview }) {
  const interviewer = interview.entrevistador;
  if (!interviewer) return <span className="text-sm font-semibold text-slate-400">Sin asignar</span>;

  return (
    <div>
      <p className="font-semibold text-slate-800">{interviewer.nombre || interviewer.email}</p>
      <p className="mt-1 text-xs text-slate-500">{interviewer.rol?.nombre || "Entrevistador"}</p>
    </div>
  );
}

function InterviewActions({ interview, onSchedule, onView, onStatusChange, onReturn, onDiscard }) {
  const scheduled = Boolean(interview.fechaEntrevista);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => onSchedule(interview)}
        className="rounded-lg px-2 py-1.5 text-xs font-extrabold text-orange-600 transition hover:bg-orange-50"
      >
        {scheduled ? "Reprogramar" : "Agendar"}
      </button>
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
        <InterviewDateCell interview={interview} />
        <InterviewerCell interview={interview} />
      </div>
      <InterviewActions {...props} />
    </article>
  );
}

export default function InterviewTable({
  interviews,
  loading,
  pagination,
  onPageChange,
  ...actions
}) {
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm font-semibold text-slate-500">
        <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
        Cargando entrevistas...
      </div>
    );
  }

  if (!interviews.length) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
        <p className="text-base font-bold text-slate-800">No hay entrevistas para mostrar</p>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Ajusta los filtros o pasa un postulante a Entrevistas para comenzar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        {interviews.map((interview) => (
          <MobileCard key={interview.id} interview={interview} {...actions} />
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
              <th className="px-4 py-3 font-bold">Entrevista</th>
              <th className="px-4 py-3 font-bold">Entrevistador</th>
              <th className="px-5 py-3 text-right font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {interviews.map((interview) => {
              const email = getCandidateEmail(interview);
              return (
                <tr key={interview.id} className="align-middle transition hover:bg-slate-50/80">
                  <td className="px-5 py-4 text-sm"><InterviewPhaseDateCell interview={interview} /></td>
                  <td className="max-w-[260px] px-5 py-4"><CandidateCell interview={interview} /></td>
                  <td className="px-4 py-4 text-sm">
                    <p className="font-semibold text-slate-700">{getCandidatePhone(interview)}</p>
                    <p className="mt-1 max-w-44 truncate text-xs text-slate-500">{email || "Sin correo registrado"}</p>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">{getCandidateCity(interview)}</td>
                  <td className="px-4 py-4"><InterviewStatusBadge status={getInterviewStatus(interview)} /></td>
                  <td className="px-4 py-4 text-sm"><InterviewDateCell interview={interview} /></td>
                  <td className="px-4 py-4 text-sm"><InterviewerCell interview={interview} /></td>
                  <td className="px-5 py-4"><InterviewActions interview={interview} {...actions} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Mostrando {interviews.length} de {pagination.total} entrevista{pagination.total === 1 ? "" : "s"}
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
