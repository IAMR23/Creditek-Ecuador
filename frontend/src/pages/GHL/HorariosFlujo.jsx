import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  Info,
  Pencil,
  Plus,
  Save,
  Settings2,
  UserMinus,
  UserPlus,
  UsersRound,
  Workflow,
  X,
} from "lucide-react";
import api from "../../api/client";
import {
  buildScheduleRange,
  layoutScheduleBlocks,
  timeToMinutes,
} from "../../utils/flowScheduleCalendar";

const DAYS = [
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
];

const FLOW_LEVELS = [
  { value: 1, label: "1 · Inicial", description: "Para asesores nuevos o en capacitación. Recibe la participación más baja para aprender sin saturarse.", example: "1 participación" },
  { value: 2, label: "2 · Bajo", description: "Para asesores que ya gestionan solos, pero todavía necesitan un volumen controlado.", example: "2 participaciones" },
  { value: 3, label: "3 · Medio", description: "Nivel estándar para asesores con experiencia y desempeño estable.", example: "3 participaciones" },
  { value: 4, label: "4 · Alto", description: "Para asesores consolidados que pueden atender una carga superior de oportunidades.", example: "4 participaciones" },
  { value: 5, label: "5 · Experto", description: "Para asesores de mayor experiencia, capacidad y seguimiento. Recibe la participación más alta.", example: "5 participaciones" },
];

const emptyConfiguration = {
  pipelineId: "",
  stageIds: [],
  maxPendientesPorAsesor: 2,
  horariosFlujoActivo: false,
  horariosFlujo: [],
  nivelesFlujo: {},
  repartoActivo: false,
};

const HOUR_HEIGHT = 72;

const messageOf = (error) =>
  error.response?.data?.message || error.message || "No se pudo guardar el horario";

const isoDate = (date) => date.toISOString().slice(0, 10);
const addUtcDays = (date, amount) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
};
const operationalWeek = (now = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now).filter((part) => part.type !== "literal")
    .map((part) => [part.type, part.value]));
  const today = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const daysSinceThursday = (today.getUTCDay() - 4 + 7) % 7;
  const start = addUtcDays(today, -daysSinceThursday);
  const todayDate = isoDate(today);
  return DAYS.map((day, index) => {
    const date = addUtcDays(start, index);
    return {
      ...day,
      date: isoDate(date),
      isToday: isoDate(date) === todayDate,
      dateLabel: new Intl.DateTimeFormat("es-EC", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date),
    };
  });
};

const newBlock = (day) => ({
  id: `bloque-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  diaSemana: day.value,
  fecha: day.date,
  horaInicio: "08:00",
  horaFin: "18:00",
  usuariosGhl: [],
});

export default function HorariosFlujo() {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [configuration, setConfiguration] = useState(emptyConfiguration);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showLevelManual, setShowLevelManual] = useState(false);
  const [assignmentEditor, setAssignmentEditor] = useState(null);
  const [assignmentCreator, setAssignmentCreator] = useState(null);
  const week = useMemo(() => operationalWeek(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pipelineResponse, userResponse, scheduleResponse] = await Promise.all([
        api.get("/api/ghl/repartos/catalogos/pipelines"),
        api.get("/api/ghl/repartos/catalogos/users"),
        api.get("/api/ghl/repartos/horarios-flujo"),
      ]);
      setPipelines(pipelineResponse.data.pipelines || []);
      setUsers(userResponse.data.users || []);
      const receivedBlocks = scheduleResponse.data.configuracion?.horariosFlujo || [];
      const currentDates = new Set(week.map((day) => day.date));
      const currentBlocks = receivedBlocks.flatMap((block) => {
        if (block.fecha) return currentDates.has(block.fecha) ? [block] : [];
        const day = week.find((item) => item.value === Number(block.diaSemana));
        return day ? [{ ...block, fecha: day.date }] : [];
      });
      setConfiguration({
        ...emptyConfiguration,
        ...(scheduleResponse.data.configuracion || {}),
        stageIds: scheduleResponse.data.configuracion?.stageIds || [],
        horariosFlujo: currentBlocks,
        nivelesFlujo: scheduleResponse.data.configuracion?.nivelesFlujo || {},
      });
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!configuration.pipelineId) {
      setStages([]);
      return;
    }
    api.get(`/api/ghl/repartos/catalogos/pipelines/${encodeURIComponent(configuration.pipelineId)}/stages`)
      .then((response) => setStages(response.data.stages || []))
      .catch((requestError) => setError(messageOf(requestError)));
  }, [configuration.pipelineId]);

  const setField = (key, value) => {
    setConfiguration((current) => ({ ...current, [key]: value }));
    setSuccess("");
  };

  const removeUser = (block, userId) => {
    setConfiguration((current) => ({
      ...current,
      horariosFlujo: block.usuariosGhl.length <= 1
        ? current.horariosFlujo.filter((currentBlock) => currentBlock.id !== block.id)
        : current.horariosFlujo.map((currentBlock) =>
          currentBlock.id === block.id
            ? {
              ...currentBlock,
              usuariosGhl: currentBlock.usuariosGhl.filter(
                (currentId) => String(currentId) !== String(userId),
              ),
            }
            : currentBlock),
    }));
    setSuccess("");
  };

  const toggleStage = (stageId) => setField(
    "stageIds",
    configuration.stageIds.includes(stageId)
      ? configuration.stageIds.filter((id) => id !== stageId)
      : [...configuration.stageIds, stageId],
  );

  const validationMessage = useMemo(() => {
    if (!configuration.pipelineId) return "Seleccione un pipeline.";
    if (!Number.isInteger(Number(configuration.maxPendientesPorAsesor))
      || Number(configuration.maxPendientesPorAsesor) < 1
      || Number(configuration.maxPendientesPorAsesor) > 1000) {
      return "El limite pendiente por asesor debe ser un entero entre 1 y 1000.";
    }
    if (configuration.horariosFlujoActivo && !configuration.stageIds.length) {
      return "Seleccione al menos una etapa.";
    }
    if (configuration.horariosFlujoActivo && !configuration.horariosFlujo.length) {
      return "Agregue al menos un bloque semanal.";
    }
    const invalidBlock = configuration.horariosFlujo.find((block) =>
      !block.usuariosGhl.length || !block.horaInicio || !block.horaFin || block.horaInicio >= block.horaFin);
    return invalidBlock
      ? "Cada bloque necesita usuarios y una hora inicial anterior a la final."
      : "";
  }, [configuration]);

  const save = async () => {
    if (saving || validationMessage) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.put("/api/ghl/repartos/horarios-flujo", configuration);
      const saved = response.data.configuracion || {};
      setConfiguration((current) => ({
        ...current,
        ...saved,
        repartoActivo: saved.activo === true,
        stageIds: saved.stageIds || [],
        horariosFlujo: saved.horariosFlujo || [],
      }));
      setSuccess(response.data.message || "Horario guardado correctamente");
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setSaving(false);
    }
  };

  const userById = useMemo(
    () => new Map(users.map((user) => [String(user.id), user])),
    [users],
  );
  const blocksByDate = useMemo(() => new Map(week.map((day) => [
    day.date,
    configuration.horariosFlujo
      .filter((block) => block.fecha === day.date)
      .sort((left, right) => String(left.horaInicio || "").localeCompare(String(right.horaInicio || ""))
        || String(left.id || "").localeCompare(String(right.id || ""))),
  ])), [configuration.horariosFlujo, week]);
  const calendarRange = useMemo(
    () => buildScheduleRange(configuration.horariosFlujo),
    [configuration.horariosFlujo],
  );
  const calendarLayouts = useMemo(
    () => new Map(week.map((day) => [
      day.date,
      layoutScheduleBlocks(blocksByDate.get(day.date) || []),
    ])),
    [blocksByDate, week],
  );
  const weekSummary = useMemo(() => ({
    scheduledDays: week.filter((day) => (blocksByDate.get(day.date) || []).length > 0).length,
    shifts: configuration.horariosFlujo.length,
    advisors: new Set(configuration.horariosFlujo.flatMap((block) => block.usuariosGhl)).size,
  }), [blocksByDate, configuration.horariosFlujo, week]);

  const openAssignmentCreator = (day = week.find((item) => item.isToday) || week[0]) => {
    setAssignmentCreator({
      date: day.date,
      horaInicio: "08:00",
      horaFin: "18:00",
      userId: "",
      nivel: 3,
    });
    setError("");
  };

  const applyAssignmentCreate = () => {
    if (!assignmentCreator?.userId) {
      setError("Seleccione un asesor para agregar al horario.");
      return;
    }
    if (
      !assignmentCreator.horaInicio
      || !assignmentCreator.horaFin
      || assignmentCreator.horaInicio >= assignmentCreator.horaFin
    ) {
      setError("La hora inicial debe ser anterior a la hora final.");
      return;
    }

    const userId = String(assignmentCreator.userId);
    const startMinute = timeToMinutes(assignmentCreator.horaInicio);
    const endMinute = timeToMinutes(assignmentCreator.horaFin);
    const overlappingAssignment = configuration.horariosFlujo.some((block) => (
      block.fecha === assignmentCreator.date
      && block.usuariosGhl.map(String).includes(userId)
      && startMinute < timeToMinutes(block.horaFin)
      && endMinute > timeToMinutes(block.horaInicio)
    ));
    if (overlappingAssignment) {
      setError("Ese asesor ya tiene un horario que se cruza con las horas seleccionadas.");
      return;
    }

    const day = week.find((item) => item.date === assignmentCreator.date);
    if (!day) {
      setError("Seleccione un día de la semana actual.");
      return;
    }

    setConfiguration((current) => {
      const matchingBlock = current.horariosFlujo.find((block) => (
        block.fecha === assignmentCreator.date
        && block.horaInicio === assignmentCreator.horaInicio
        && block.horaFin === assignmentCreator.horaFin
      ));
      const horariosFlujo = matchingBlock
        ? current.horariosFlujo.map((block) => (
          block.id === matchingBlock.id
            ? { ...block, usuariosGhl: [...block.usuariosGhl, userId] }
            : block
        ))
        : [
          ...current.horariosFlujo,
          {
            ...newBlock(day),
            horaInicio: assignmentCreator.horaInicio,
            horaFin: assignmentCreator.horaFin,
            usuariosGhl: [userId],
          },
        ];

      return {
        ...current,
        horariosFlujo,
        nivelesFlujo: {
          ...current.nivelesFlujo,
          [userId]: Number(assignmentCreator.nivel),
        },
      };
    });
    setAssignmentCreator(null);
    setError("");
    setSuccess("");
  };

  const openAssignmentEditor = (block, userId) => {
    const day = week.find((item) => item.date === block.fecha);
    const user = userById.get(String(userId));
    setAssignmentEditor({
      blockId: block.id,
      userId,
      userName: user?.name || String(userId),
      dayLabel: day ? `${day.label} ${day.dateLabel}` : "Día programado",
      horaInicio: block.horaInicio,
      horaFin: block.horaFin,
      nivel: configuration.nivelesFlujo[userId] || 3,
    });
  };

  const applyAssignmentEdit = () => {
    if (
      !assignmentEditor?.horaInicio
      || !assignmentEditor?.horaFin
      || assignmentEditor.horaInicio >= assignmentEditor.horaFin
    ) {
      setError("La hora inicial debe ser anterior a la hora final.");
      return;
    }

    const sourceBlock = configuration.horariosFlujo.find(
      (block) => block.id === assignmentEditor.blockId,
    );
    const editedStartMinute = timeToMinutes(assignmentEditor.horaInicio);
    const editedEndMinute = timeToMinutes(assignmentEditor.horaFin);
    const overlappingAssignment = sourceBlock && configuration.horariosFlujo.some((block) => (
      block.id !== sourceBlock.id
      && block.fecha === sourceBlock.fecha
      && block.usuariosGhl.map(String).includes(String(assignmentEditor.userId))
      && editedStartMinute < timeToMinutes(block.horaFin)
      && editedEndMinute > timeToMinutes(block.horaInicio)
    ));
    if (overlappingAssignment) {
      setError("Ese asesor ya tiene otro horario que se cruza con las horas seleccionadas.");
      return;
    }

    setConfiguration((current) => {
      const source = current.horariosFlujo.find(
        (block) => block.id === assignmentEditor.blockId,
      );
      if (!source) return current;

      const timeChanged = source.horaInicio !== assignmentEditor.horaInicio
        || source.horaFin !== assignmentEditor.horaFin;
      let horariosFlujo;
      if (timeChanged && source.usuariosGhl.length > 1) {
        horariosFlujo = [
          ...current.horariosFlujo.map((block) =>
            block.id === source.id
              ? {
                ...block,
                usuariosGhl: block.usuariosGhl.filter(
                  (userId) => String(userId) !== String(assignmentEditor.userId),
                ),
              }
              : block),
          {
            ...source,
            id: `bloque-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            horaInicio: assignmentEditor.horaInicio,
            horaFin: assignmentEditor.horaFin,
            usuariosGhl: [assignmentEditor.userId],
          },
        ];
      } else {
        horariosFlujo = current.horariosFlujo.map((block) =>
          block.id === source.id
            ? {
              ...block,
              horaInicio: assignmentEditor.horaInicio,
              horaFin: assignmentEditor.horaFin,
            }
            : block);
      }

      return {
        ...current,
        horariosFlujo,
        nivelesFlujo: {
          ...current.nivelesFlujo,
          [assignmentEditor.userId]: Number(assignmentEditor.nivel),
        },
      };
    });
    setError("");
    setSuccess("");
    setAssignmentEditor(null);
  };

  const removeAssignment = () => {
    if (!assignmentEditor) return;
    const block = configuration.horariosFlujo.find(
      (item) => item.id === assignmentEditor.blockId,
    );
    if (block) removeUser(block, assignmentEditor.userId);
    setAssignmentEditor(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-6 md:px-7">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><Workflow size={14} /> Sistemas · GoHighLevel</div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Horarios de flujo</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Programa la recepción automática de oportunidades para la semana operativa actual.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"><CalendarClock size={17} className="text-emerald-600" />{week[0].dateLabel} — {week.at(-1).dateLabel}</div>
          </div>
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${configuration.horariosFlujoActivo ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <span><span className="block text-sm font-bold text-slate-800">Flujo automático</span><span className="block text-xs text-slate-500">{configuration.horariosFlujoActivo ? "Activo esta semana" : "Programación inactiva"}</span></span>
            <span className={`relative h-6 w-11 rounded-full transition ${configuration.horariosFlujoActivo ? "bg-emerald-500" : "bg-slate-300"}`}>
              <input type="checkbox" checked={configuration.horariosFlujoActivo} onChange={(event) => setField("horariosFlujoActivo", event.target.checked)} className="sr-only" />
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${configuration.horariosFlujoActivo ? "left-6" : "left-1"}`} />
            </span>
          </label>
        </div>
        <div className="grid border-t border-slate-200 bg-slate-50/70 sm:grid-cols-3">
          {[
            { icon: CalendarClock, value: `${weekSummary.scheduledDays}/7`, label: "Días configurados" },
            { icon: Clock3, value: weekSummary.shifts, label: "Turnos programados" },
            { icon: UsersRound, value: weekSummary.advisors, label: "Asesores incluidos" },
          ].map((item) => <div key={item.label} className="flex items-center gap-3 border-slate-200 px-5 py-4 sm:border-r last:border-r-0"><span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><item.icon size={18} /></span><span><b className="block text-lg leading-none text-slate-900">{item.value}</b><span className="text-xs text-slate-500">{item.label}</span></span></div>)}
        </div>
      </header>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 shadow-sm"><AlertTriangle size={18} />{error}</div>}
      {success && <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm"><span className="flex items-center gap-2"><CheckCircle2 size={18} />{success}</span><button type="button" onClick={() => setSuccess("")} className="rounded p-1 hover:bg-emerald-100"><X size={16} /></button></div>}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950 shadow-sm">
        <div className="flex min-w-0 flex-1 items-start gap-3"><span className="rounded-lg bg-indigo-100 p-2 text-indigo-700"><Gauge size={18} /></span><p><b>Distribución inteligente.</b> Al iniciar un turno, los clientes pendientes se nivelan por partes iguales entre los asesores activos. Después, los clientes nuevos se entregan progresivamente según el nivel de flujo; quien ingresa más tarde recibe prioridad hasta recuperar su proporción diaria, siempre respetando el límite de pendientes.</p></div>
        <button type="button" onClick={() => setShowLevelManual(true)} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-100"><BookOpen size={16} />Manual de niveles</button>
      </section>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><span className="rounded-lg bg-slate-100 p-2 text-slate-700"><Settings2 size={19} /></span><div><h2 className="font-bold text-slate-900">Origen de oportunidades</h2><p className="text-sm text-slate-500">Selecciona el pipeline y las etapas que alimentarán esta programación.</p></div></div>
        <label className="block text-sm font-semibold text-gray-700">
          Pipeline de GHL
          <select
            value={configuration.pipelineId || ""}
            onChange={(event) => setConfiguration((current) => ({ ...current, pipelineId: event.target.value, stageIds: [] }))}
            className="mt-1 h-11 w-full rounded border border-gray-300 bg-white px-3 md:max-w-xl"
            disabled={loading}
          >
            <option value="">Seleccione...</option>
            {pipelines.map((pipeline) => <option key={pipeline.id || pipeline._id} value={pipeline.id || pipeline._id}>{pipeline.name || pipeline.title}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-gray-700 md:max-w-sm">
          Máximo de clientes pendientes por asesor
          <input
            type="number"
            min="1"
            max="1000"
            step="1"
            value={configuration.maxPendientesPorAsesor}
            onChange={(event) => setField(
              "maxPendientesPorAsesor",
              event.target.value === "" ? "" : Number(event.target.value),
            )}
            className="mt-1 h-11 w-full rounded border border-gray-300 bg-white px-3"
            disabled={loading}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Para repartir 30 pendientes entre 3 asesores, configure al menos 10.
          </span>
        </label>
        <div>
          <div className="mb-2 text-sm font-semibold text-gray-700">Etapas (por ejemplo, WhatsApp y Facebook)</div>
          <div className="grid max-h-60 gap-2 overflow-auto rounded border p-3 sm:grid-cols-2 lg:grid-cols-3">
            {!configuration.pipelineId && <span className="text-sm text-gray-500">Seleccione un pipeline.</span>}
            {configuration.pipelineId && !stages.length && <span className="text-sm text-gray-500">No hay etapas disponibles.</span>}
            {stages.map((stage) => {
              const stageId = String(stage.id || stage._id || "");
              return <label key={stageId} className="flex items-center gap-2 rounded p-2 hover:bg-green-50"><input type="checkbox" checked={configuration.stageIds.includes(stageId)} onChange={() => toggleStage(stageId)} className="h-4 w-4 accent-green-600" /><span className="text-sm">{stage.name || stage.title || "Etapa sin nombre"}</span></label>;
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-700"><CalendarClock size={19} /></span>
            <div>
              <h2 className="font-bold text-slate-900">Horario semanal por persona</h2>
              <p className="text-sm text-slate-500">
                Vista tipo horario de clases. Usa el lápiz para cambiar horas o nivel, o quita a una persona del turno.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800">
              Los cambios se aplican al presionar Guardar programación
            </div>
            <button
              type="button"
              onClick={() => openAssignmentCreator()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <UserPlus size={15} /> Agregar asesor
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1220px]">
            <div
              className="grid border-b border-slate-200 bg-slate-50"
              style={{ gridTemplateColumns: "72px repeat(7, minmax(160px, 1fr))" }}
            >
              <div className="flex items-center justify-center border-r border-slate-200 px-2 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Hora
              </div>
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`border-r border-slate-200 px-3 py-3 text-center last:border-r-0 ${day.isToday ? "bg-emerald-50" : ""}`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">{day.label}</span>
                    {day.isToday && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white">Hoy</span>}
                    <button
                      type="button"
                      title={`Agregar asesor el ${day.label}`}
                      aria-label={`Agregar asesor el ${day.label}`}
                      onClick={() => openAssignmentCreator(day)}
                      className="rounded-md border border-indigo-200 bg-white p-1 text-indigo-600 shadow-sm hover:bg-indigo-50"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{day.dateLabel}</p>
                </div>
              ))}
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: "72px repeat(7, minmax(160px, 1fr))" }}
            >
              <div
                className="relative border-r border-slate-200 bg-slate-50"
                style={{
                  height: `${((calendarRange.endMinute - calendarRange.startMinute) / 60) * HOUR_HEIGHT}px`,
                }}
              >
                {calendarRange.hours.map((minute, index) => (
                  <span
                    key={minute}
                    className="absolute right-2 text-[11px] font-semibold text-slate-500"
                    style={{
                      top: `${((minute - calendarRange.startMinute) / 60) * HOUR_HEIGHT}px`,
                      transform: index === 0 ? "translateY(2px)" : "translateY(-50%)",
                    }}
                  >
                    {String(Math.floor(minute / 60)).padStart(2, "0")}:00
                  </span>
                ))}
              </div>

              {week.map((day) => {
                const layout = calendarLayouts.get(day.date) || [];
                return (
                  <div
                    key={day.date}
                    className={`relative border-r border-slate-200 last:border-r-0 ${day.isToday ? "bg-emerald-50/30" : "bg-white"}`}
                    style={{
                      height: `${((calendarRange.endMinute - calendarRange.startMinute) / 60) * HOUR_HEIGHT}px`,
                    }}
                  >
                    {calendarRange.hours.map((minute) => (
                      <div
                        key={minute}
                        className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                        style={{
                          top: `${((minute - calendarRange.startMinute) / 60) * HOUR_HEIGHT}px`,
                        }}
                      />
                    ))}

                    {layout.map(({ block, startMinute, endMinute, lane, laneCount }) => {
                      const top = ((startMinute - calendarRange.startMinute) / 60) * HOUR_HEIGHT;
                      const height = Math.max(56, ((endMinute - startMinute) / 60) * HOUR_HEIGHT - 4);
                      const width = 100 / laneCount;
                      return (
                        <article
                          key={block.id}
                          className="absolute overflow-hidden rounded-lg border border-indigo-200 bg-indigo-50 shadow-sm"
                          style={{
                            top: `${top + 2}px`,
                            height: `${height}px`,
                            left: `calc(${lane * width}% + 3px)`,
                            width: `calc(${width}% - 6px)`,
                          }}
                        >
                          <div className="border-b border-indigo-200 bg-indigo-100/80 px-2 py-1 text-[10px] font-bold text-indigo-900">
                            {block.horaInicio}–{block.horaFin}
                          </div>
                          <div className="h-[calc(100%_-_25px)] space-y-1 overflow-y-auto p-1.5">
                            {block.usuariosGhl.map((userId) => {
                              const user = userById.get(String(userId));
                              return (
                                <div key={userId} className="rounded-md bg-white px-1.5 py-1 shadow-sm ring-1 ring-indigo-100">
                                  <div className="flex items-center gap-1">
                                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-800" title={user?.name || userId}>
                                      {user?.name || userId}
                                    </span>
                                    <button
                                      type="button"
                                      title="Editar horario de la persona"
                                      aria-label={`Editar horario de ${user?.name || userId}`}
                                      onClick={() => openAssignmentEditor(block, userId)}
                                      className="rounded p-0.5 text-indigo-600 hover:bg-indigo-100"
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Quitar persona del turno"
                                      aria-label={`Quitar a ${user?.name || userId} del turno`}
                                      onClick={() => removeUser(block, userId)}
                                      className="rounded p-0.5 text-rose-600 hover:bg-rose-50"
                                    >
                                      <UserMinus size={11} />
                                    </button>
                                  </div>
                                  <p className="mt-0.5 text-[9px] font-semibold text-indigo-600">
                                    Nivel {configuration.nivelesFlujo[userId] || 3}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-300/40 backdrop-blur">
        <div className={`flex items-center gap-2 text-sm font-semibold ${validationMessage ? "text-amber-700" : "text-emerald-700"}`}>{validationMessage ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}{validationMessage || "La programación está lista para publicarse."}</div>
        <button type="button" disabled={saving || loading || Boolean(validationMessage)} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Save size={17} />{saving ? "Guardando..." : "Guardar programación"}</button>
      </div>

      {assignmentCreator && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
          onClick={() => setAssignmentCreator(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-creator-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Horario semanal</p>
                <h2 id="assignment-creator-title" className="mt-1 text-lg font-bold text-slate-900">
                  Agregar asesor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAssignmentCreator(null)}
                aria-label="Cerrar formulario"
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </header>

            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-slate-700">
                Día
                <select
                  value={assignmentCreator.date}
                  onChange={(event) => setAssignmentCreator((current) => ({
                    ...current,
                    date: event.target.value,
                  }))}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {week.map((day) => (
                    <option key={day.date} value={day.date}>{day.label} · {day.dateLabel}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  Desde
                  <input
                    type="time"
                    value={assignmentCreator.horaInicio}
                    onChange={(event) => setAssignmentCreator((current) => ({
                      ...current,
                      horaInicio: event.target.value,
                    }))}
                    className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Hasta
                  <input
                    type="time"
                    value={assignmentCreator.horaFin}
                    onChange={(event) => setAssignmentCreator((current) => ({
                      ...current,
                      horaFin: event.target.value,
                    }))}
                    className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Asesor
                <select
                  value={assignmentCreator.userId}
                  onChange={(event) => setAssignmentCreator((current) => ({
                    ...current,
                    userId: event.target.value,
                  }))}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Seleccione...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || "Sin nombre"}{user.email ? ` · ${user.email}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Nivel de flujo
                <select
                  value={assignmentCreator.nivel}
                  onChange={(event) => setAssignmentCreator((current) => ({
                    ...current,
                    nivel: Number(event.target.value),
                  }))}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {FLOW_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setAssignmentCreator(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyAssignmentCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
              >
                <UserPlus size={16} /> Agregar al horario
              </button>
            </footer>
          </section>
        </div>
      )}

      {assignmentEditor && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
          onClick={() => setAssignmentEditor(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-editor-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{assignmentEditor.dayLabel}</p>
                <h2 id="assignment-editor-title" className="mt-1 text-lg font-bold text-slate-900">
                  Editar a {assignmentEditor.userName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAssignmentEditor(null)}
                aria-label="Cerrar edición"
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </header>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-semibold text-slate-700">
                  Desde
                  <input
                    type="time"
                    value={assignmentEditor.horaInicio}
                    onChange={(event) => setAssignmentEditor((current) => ({
                      ...current,
                      horaInicio: event.target.value,
                    }))}
                    className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Hasta
                  <input
                    type="time"
                    value={assignmentEditor.horaFin}
                    onChange={(event) => setAssignmentEditor((current) => ({
                      ...current,
                      horaFin: event.target.value,
                    }))}
                    className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Nivel de flujo
                <select
                  value={assignmentEditor.nivel}
                  onChange={(event) => setAssignmentEditor((current) => ({
                    ...current,
                    nivel: Number(event.target.value),
                  }))}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {FLOW_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>{level.label}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-slate-500">
                  El nivel se aplica a esta persona en todos sus turnos.
                </span>
              </label>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={removeAssignment}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
              >
                <UserMinus size={16} /> Quitar del horario
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentEditor(null)}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={applyAssignmentEdit}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  <Pencil size={15} /> Aplicar cambio
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {showLevelManual && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-200/80 p-4 backdrop-blur-sm" onClick={() => setShowLevelManual(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="level-manual-title" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-start gap-3"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-700"><BookOpen size={20} /></span><div><h2 id="level-manual-title" className="text-lg font-bold text-slate-900">Manual de niveles de flujo</h2><p className="text-sm text-slate-500">Cómo definir cuánto flujo debe recibir cada asesor.</p></div></div>
              <button type="button" onClick={() => setShowLevelManual(false)} aria-label="Cerrar manual" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={18} /></button>
            </header>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                {FLOW_LEVELS.map((level) => (
                  <article key={level.value} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-900">{level.label}</h3><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{level.example}</span></div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{level.description}</p>
                  </article>
                ))}
              </div>

              <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="flex items-center gap-2 font-bold text-emerald-900"><Info size={18} />Ejemplo práctico</h3>
                <p className="mt-2 text-sm leading-6 text-emerald-900">Si tres asesores comienzan al mismo tiempo y existen 30 clientes sin propietario, cada uno recibe 10 de inmediato, siempre que su límite de pendientes lo permita. Desde el siguiente cliente nuevo se aplica progresivamente el nivel de flujo configurado.</p>
              </section>

              <section>
                <h3 className="font-bold text-slate-900">Reglas importantes</h3>
                <ul className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  <li className="rounded-lg bg-slate-50 p-3">El inventario pendiente se reparte primero por partes iguales.</li>
                  <li className="rounded-lg bg-slate-50 p-3">Solo participan asesores dentro de su turno programado.</li>
                  <li className="rounded-lg bg-slate-50 p-3">Ningún nivel supera el límite máximo de clientes pendientes.</li>
                  <li className="rounded-lg bg-slate-50 p-3">Quien entra más tarde recibe prioridad hasta recuperar la proporción diaria correspondiente a su nivel.</li>
                  <li className="rounded-lg bg-slate-50 p-3">Los clientes que ya tienen propietario no se reasignan.</li>
                  <li className="rounded-lg bg-slate-50 p-3">Los asesores no necesitan activar Play ni realizar acciones manuales.</li>
                </ul>
              </section>
            </div>
          </section>
        </div>
      )}
      </div>
    </div>
  );
}
