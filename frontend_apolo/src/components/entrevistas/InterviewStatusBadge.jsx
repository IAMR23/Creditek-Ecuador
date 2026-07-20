import { INTERVIEW_STATUS } from "../../utils/interviews";

export default function InterviewStatusBadge({ status }) {
  const meta = INTERVIEW_STATUS[status] || INTERVIEW_STATUS.PENDIENTE;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

