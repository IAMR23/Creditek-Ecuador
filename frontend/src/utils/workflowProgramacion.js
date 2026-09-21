export const toggleSelection = (values = [], value) => (
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
);

export const isWorkflowProgramacionValid = (form = {}) => Boolean(
  String(form.nombre || "").trim()
  && form.pipelineId
  && Array.isArray(form.stageIds) && form.stageIds.length
  && form.workflowId
  && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(form.hora || ""))
  && Array.isArray(form.diasSemana) && form.diasSemana.length
  && form.diasSemana.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
);
