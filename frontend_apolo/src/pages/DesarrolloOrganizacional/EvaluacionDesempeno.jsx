import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock3,
  Laptop,
  LoaderCircle,
  Megaphone,
  Printer,
  Save,
  Smartphone,
  Trophy,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import { AuthContext } from "../../context/AuthContext";
import { getCandidateName } from "../../utils/interviews";

const ASPECTS = [
  {
    id: "quiere_hacer",
    number: 1,
    title: "Persona que quiere hacer",
    color: "orange",
    icon: Megaphone,
    criteria: [
      { id: "iniciativa_actitud", text: "Muestra iniciativa y actitud positiva." },
      { id: "ganas_aprender", text: "Tiene ganas de aprender y mejorar." },
      { id: "proactividad", text: "Es proactivo y busca soluciones." },
      { id: "cumplimiento_metas", text: "Demuestra interés por cumplir metas." },
      { id: "disposicion_venta", text: "Tiene buena disposición para vender." },
      {
        id: "volanteo_comunicacion",
        text: "Volantea de manera clara, expresando confianza y emitiendo mensajes breves.",
      },
    ],
  },
  {
    id: "sabe_hacer",
    number: 2,
    title: "Persona que sabe hacer",
    color: "green",
    icon: Laptop,
    criteria: [
      { id: "proceso_venta", text: "Conoce y aplica el proceso de venta." },
      {
        id: "uso_herramientas",
        text: "Usa herramientas (sistemas, catálogos, CRM y calculadora) correctamente.",
      },
      {
        id: "argumentacion_beneficios",
        text: "Comunica y argumenta beneficios de productos de forma efectiva.",
      },
      { id: "manejo_objeciones", text: "Maneja objeciones y cierra ventas." },
      { id: "registro_informacion", text: "Registra correctamente la información." },
    ],
  },
  {
    id: "disciplinada",
    number: 3,
    title: "Persona disciplinada",
    color: "green",
    icon: Clock3,
    criteria: [
      { id: "horarios_normas", text: "Cumple horarios y normas del almacén." },
      { id: "constancia", text: "Es constante en sus actividades diarias." },
      { id: "organizacion_tiempo", text: "Organiza su tiempo y prioridades." },
      { id: "cumplimiento_tareas", text: "Cumple con tareas asignadas." },
      { id: "orden_actitud", text: "Mantiene orden y buena actitud." },
    ],
  },
];

const SCALES = [
  { value: 1, label: "Deficiente" },
  { value: 2, label: "En desarrollo" },
  { value: 3, label: "Aceptable" },
  { value: 4, label: "Bueno" },
  { value: 5, label: "Excelente" },
];

const RECOMMENDATIONS = [
  {
    value: "APROBADO",
    label: "Aprobado",
    detail: "Listo para continuar como vendedor",
  },
  {
    value: "APROBADO_CON_OBSERVACIONES",
    label: "Aprobado con observaciones",
    detail: "Requiere seguimiento",
  },
  {
    value: "NO_APROBADO",
    label: "No aprobado",
    detail: "No cumple con el estándar",
  },
];

const EMPTY_FORM = {
  periodoDesde: "",
  periodoHasta: "",
  evaluador: "",
  fechaEvaluacion: "",
  calificaciones: {},
  observaciones: {
    quiere_hacer: "",
    sabe_hacer: "",
    disciplinada: "",
  },
  ventas: [0, 0, 0, 0, 0, 0],
  comentariosGenerales: "",
  recomendacion: "",
  firmaEvaluador: "",
};

const getGuayaquilDate = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const addDays = (date, days) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const getScores = (form) => {
  const puntajeAspectos = ASPECTS.reduce((total, aspect) => {
    const aspectTotal = aspect.criteria.reduce(
      (sum, criterion) => sum + (Number(form.calificaciones[criterion.id]) || 0),
      0,
    );
    return total + (aspectTotal / aspect.criteria.length) * 5;
  }, 0);
  const totalVentas = form.ventas.reduce(
    (total, value) => total + (Number(value) || 0),
    0,
  );
  const puntajeVentas = Math.min(totalVentas * 5, 25);
  const puntajeTotal = puntajeAspectos + puntajeVentas;

  return {
    puntajeAspectos: Number(puntajeAspectos.toFixed(2)),
    totalVentas,
    puntajeVentas,
    puntajeTotal: Number(puntajeTotal.toFixed(2)),
    metaCumplida: totalVentas >= 4,
    cumpleAprobacion: puntajeTotal >= 60 && totalVentas >= 4,
  };
};

const scoreText = (value) =>
  Number.isInteger(value) ? String(value) : Number(value).toFixed(2);

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function BrandLogo() {
  return (
    <div className="flex min-h-24 items-center justify-center rounded-2xl bg-gradient-to-br from-green-800 to-green-700 px-5 py-4 text-white shadow-sm">
      <div>
        <div className="flex items-center gap-2 text-3xl font-black italic leading-none tracking-tight">
          <span>CREDI</span>
          <span className="text-orange-400">TEK</span>
          <Smartphone size={31} strokeWidth={3} />
        </div>
        <p className="mt-2 text-center text-[10px] font-extrabold uppercase tracking-[0.18em] text-green-100">
          Celulares &amp; televisores
        </p>
      </div>
    </div>
  );
}

function RatingInput({ criterion, scale, value, onChange }) {
  const checked = Number(value) === scale.value;

  return (
    <label
      className={`mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-xs font-black transition ${
        checked
          ? "border-green-700 bg-green-700 text-white shadow-sm"
          : "border-slate-300 bg-white text-slate-400 hover:border-green-500 hover:text-green-700"
      }`}
      title={`${scale.value} - ${scale.label}`}
    >
      <input
        type="radio"
        name={`criterion-${criterion.id}`}
        value={scale.value}
        checked={checked}
        onChange={() => onChange(criterion.id, scale.value)}
        className="sr-only"
      />
      {checked ? <Check size={15} strokeWidth={3.2} /> : scale.value}
    </label>
  );
}

function EvaluationDesktopTable({ form, onRatingChange, onObservationChange }) {
  return (
    <div className="evaluation-desktop-table hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[1050px] table-fixed border-collapse text-left text-xs">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[30%]" />
          {SCALES.map((scale) => <col key={scale.value} className="w-[7.5%]" />)}
          <col className="w-[16.5%]" />
        </colgroup>
        <thead>
          <tr className="text-center text-white">
            <th rowSpan={2} className="border border-white/50 bg-orange-600 px-3 py-3 font-black uppercase">
              Aspecto a evaluar
            </th>
            <th rowSpan={2} className="border border-white/50 bg-orange-600 px-3 py-3 font-black uppercase">
              Criterios de evaluación
            </th>
            <th colSpan={5} className="border border-white/50 bg-green-800 px-3 py-2 text-sm font-black uppercase">
              Escala de calificación
            </th>
            <th rowSpan={2} className="border border-white/50 bg-green-800 px-3 py-3 font-black uppercase">
              Observaciones
            </th>
          </tr>
          <tr className="bg-green-800 text-center text-[10px] text-white">
            {SCALES.map((scale) => (
              <th key={scale.value} className="border border-white/40 px-1 py-2 font-bold">
                <span className="block text-base leading-none">{scale.value}</span>
                <span>{scale.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ASPECTS.flatMap((aspect) =>
            aspect.criteria.map((criterion, index) => {
              const Icon = aspect.icon;
              const orange = aspect.color === "orange";

              return (
                <tr key={criterion.id} className="border-b border-slate-200">
                  {index === 0 && (
                    <td
                      rowSpan={aspect.criteria.length}
                      className="border border-slate-300 bg-white p-3 align-middle"
                    >
                      <div className={`flex items-center gap-3 ${orange ? "text-orange-600" : "text-green-700"}`}>
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-black text-white ${orange ? "bg-orange-600" : "bg-green-700"}`}>
                          {aspect.number}
                        </span>
                        <div>
                          <Icon size={23} className="mb-1" />
                          <p className="font-black uppercase leading-tight">{aspect.title}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="border border-slate-300 px-4 py-2.5 font-semibold leading-5 text-slate-700">
                    <span className={orange ? "text-orange-600" : "text-green-700"}>●</span>{" "}
                    {criterion.text}
                  </td>
                  {SCALES.map((scale) => (
                    <td key={scale.value} className="border border-slate-300 p-1 text-center">
                      <RatingInput
                        criterion={criterion}
                        scale={scale}
                        value={form.calificaciones[criterion.id]}
                        onChange={onRatingChange}
                      />
                    </td>
                  ))}
                  {index === 0 && (
                    <td rowSpan={aspect.criteria.length} className="border border-slate-300 p-2 align-top">
                      <textarea
                        value={form.observaciones[aspect.id] || ""}
                        onChange={(event) => onObservationChange(aspect.id, event.target.value)}
                        maxLength={1500}
                        aria-label={`Observaciones de ${aspect.title}`}
                        placeholder="Escribe observaciones..."
                        className="h-full min-h-32 w-full resize-none rounded-lg border border-transparent bg-slate-50 p-3 text-xs leading-5 outline-none focus:border-green-600 focus:bg-white"
                      />
                    </td>
                  )}
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}

function EvaluationMobileCards({ form, onRatingChange, onObservationChange }) {
  return (
    <div className="evaluation-mobile space-y-4 p-4 lg:hidden">
      {ASPECTS.map((aspect) => {
        const Icon = aspect.icon;
        const orange = aspect.color === "orange";

        return (
          <section key={aspect.id} className="overflow-hidden rounded-xl border border-slate-200">
            <header className={`flex items-center gap-3 px-4 py-3 text-white ${orange ? "bg-orange-600" : "bg-green-800"}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-black">
                {aspect.number}
              </span>
              <Icon size={20} />
              <h2 className="font-black uppercase">{aspect.title}</h2>
            </header>
            <div className="divide-y divide-slate-100">
              {aspect.criteria.map((criterion) => (
                <div key={criterion.id} className="p-4">
                  <p className="text-sm font-semibold leading-5 text-slate-700">{criterion.text}</p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {SCALES.map((scale) => (
                      <label key={scale.value} className={`cursor-pointer rounded-lg border px-1 py-2 text-center text-[10px] font-bold transition ${Number(form.calificaciones[criterion.id]) === scale.value ? "border-green-700 bg-green-700 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        <input
                          type="radio"
                          name={`mobile-criterion-${criterion.id}`}
                          checked={Number(form.calificaciones[criterion.id]) === scale.value}
                          onChange={() => onRatingChange(criterion.id, scale.value)}
                          className="sr-only"
                        />
                        <span className="block text-base font-black">{scale.value}</span>
                        {scale.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <label className="text-xs font-black uppercase tracking-wide text-slate-500">
                Observaciones
                <textarea
                  value={form.observaciones[aspect.id] || ""}
                  onChange={(event) => onObservationChange(aspect.id, event.target.value)}
                  maxLength={1500}
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-green-600"
                />
              </label>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function EvaluacionDesempeno() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const [candidate, setCandidate] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const evaluatorName = auth?.user?.nombre || auth?.user?.email || "";

  useEffect(() => {
    let active = true;

    const loadEvaluation = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await api.get(`/api/postulaciones/${id}/evaluacion-desempeno`);
        if (!active) return;

        const nextCandidate = response.data?.data?.postulacion;
        const savedEvaluation = response.data?.data?.evaluacion;
        const startDate = nextCandidate?.incorporacion?.fechaIngreso || "";
        const defaults = {
          ...EMPTY_FORM,
          periodoDesde: startDate,
          periodoHasta: addDays(startDate, 5),
          evaluador: evaluatorName,
          fechaEvaluacion: getGuayaquilDate(),
          observaciones: { ...EMPTY_FORM.observaciones },
          ventas: [...EMPTY_FORM.ventas],
          calificaciones: {},
        };
        const loadedForm = savedEvaluation
          ? {
              ...defaults,
              ...savedEvaluation,
              calificaciones: { ...(savedEvaluation.calificaciones || {}) },
              observaciones: {
                ...defaults.observaciones,
                ...(savedEvaluation.observaciones || {}),
              },
              ventas:
                Array.isArray(savedEvaluation.ventas) && savedEvaluation.ventas.length === 6
                  ? [...savedEvaluation.ventas]
                  : defaults.ventas,
            }
          : defaults;

        setCandidate(nextCandidate);
        setForm(loadedForm);
        setLastSavedAt(savedEvaluation?.actualizadoAt || "");
        setDirty(false);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError.response?.data?.message ||
            "No se pudo cargar la evaluación de desempeño.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadEvaluation();
    return () => {
      active = false;
    };
  }, [evaluatorName, id]);

  useEffect(() => {
    const warnBeforeLeaving = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirty]);

  const scores = useMemo(() => getScores(form), [form]);
  const completedCriteria = useMemo(
    () =>
      ASPECTS.flatMap((aspect) => aspect.criteria).filter(
        (criterion) => form.calificaciones[criterion.id],
      ).length,
    [form.calificaciones],
  );
  const totalCriteria = ASPECTS.reduce(
    (total, aspect) => total + aspect.criteria.length,
    0,
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
  };

  const updateRating = (criterionId, value) => {
    setForm((current) => ({
      ...current,
      calificaciones: { ...current.calificaciones, [criterionId]: value },
    }));
    setDirty(true);
  };

  const updateObservation = (aspectId, value) => {
    setForm((current) => ({
      ...current,
      observaciones: { ...current.observaciones, [aspectId]: value },
    }));
    setDirty(true);
  };

  const updateSale = (index, value) => {
    const nextValue = value === "" ? "" : Math.max(0, Number.parseInt(value, 10) || 0);
    setForm((current) => ({
      ...current,
      ventas: current.ventas.map((sale, saleIndex) =>
        saleIndex === index ? nextValue : sale,
      ),
    }));
    setDirty(true);
  };

  const handleBack = async () => {
    if (dirty) {
      const result = await Swal.fire({
        icon: "warning",
        title: "Hay cambios sin guardar",
        text: "Si regresas a Seleccionados, estos cambios se perderán.",
        showCancelButton: true,
        confirmButtonText: "Salir sin guardar",
        cancelButtonText: "Continuar editando",
        confirmButtonColor: "#dc2626",
      });
      if (!result.isConfirmed) return;
    }
    navigate("/seleccionados");
  };

  const handleSave = async () => {
    if (form.periodoDesde && form.periodoHasta && form.periodoDesde > form.periodoHasta) {
      await Swal.fire("Periodo no válido", "La fecha inicial no puede ser posterior a la fecha final.", "warning");
      return;
    }

    try {
      setSaving(true);
      const response = await api.put(
        `/api/postulaciones/${id}/evaluacion-desempeno`,
        form,
      );
      const savedEvaluation = response.data?.data;
      if (savedEvaluation) {
        setForm((current) => ({ ...current, ...savedEvaluation }));
        setLastSavedAt(savedEvaluation.actualizadoAt || "");
      }
      setDirty(false);
      await Swal.fire({
        icon: "success",
        title: "Evaluación guardada",
        text: "Los datos y puntajes quedaron asociados al postulante.",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (requestError) {
      await Swal.fire(
        "No se pudo guardar",
        requestError.response?.data?.message || "Intenta nuevamente.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center text-sm font-bold text-slate-500">
        <LoaderCircle className="mr-3 animate-spin text-orange-500" size={24} />
        Cargando evaluación de desempeño...
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-black text-slate-900">No se pudo abrir la evaluación</h1>
        <p className="mt-2 text-sm text-red-700">{error || "Postulante no encontrado."}</p>
        <button type="button" onClick={() => navigate("/seleccionados")} className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">
          Volver a Seleccionados
        </button>
      </div>
    );
  }

  const agencyName = candidate.incorporacion?.agencia?.nombre || "Sin sucursal asignada";

  return (
    <div className="performance-evaluation mx-auto max-w-[1600px]">
      <div className="abs-no-print mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
          <ArrowLeft size={17} /> Volver a Seleccionados
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lastSavedAt && (
            <span className="mr-1 text-xs font-semibold text-slate-500">
              Guardado {new Date(lastSavedAt).toLocaleString("es-EC")}
            </span>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <Printer size={17} /> Imprimir
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
            {saving ? "Guardando..." : "Guardar evaluación"}
          </button>
        </div>
      </div>

      <article className="evaluation-print-sheet overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="grid gap-5 border-b border-slate-200 p-5 lg:grid-cols-[260px_1fr_310px] lg:items-center">
          <BrandLogo />
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase leading-tight tracking-tight text-green-800 xl:text-4xl">
              Evaluación de desempeño
            </h1>
            <p className="mt-1 text-xl font-black uppercase leading-tight text-orange-600 xl:text-3xl">
              Durante la capacitación
            </p>
            <p className="mx-auto mt-3 max-w-xl rounded-full bg-green-800 px-5 py-2 text-xs font-black uppercase tracking-wide text-white xl:text-base">
              Vendedores en almacenes Creditek
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-green-800">
            <p className="bg-green-800 px-3 py-2 text-center text-sm font-black uppercase text-white">
              Periodo de evaluación
            </p>
            <div className="grid grid-cols-2 gap-3 p-3">
              <label className="text-xs font-bold text-slate-600">
                Del
                <input type="date" value={form.periodoDesde} onChange={(event) => updateField("periodoDesde", event.target.value)} className={`${fieldClass} mt-1`} />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Al
                <input type="date" value={form.periodoHasta} min={form.periodoDesde || undefined} onChange={(event) => updateField("periodoHasta", event.target.value)} className={`${fieldClass} mt-1`} />
              </label>
              <label className="col-span-2 text-xs font-bold text-slate-600">
                Evaluador (Senior)
                <input type="text" value={form.evaluador} onChange={(event) => updateField("evaluador", event.target.value)} maxLength={120} className={`${fieldClass} mt-1`} />
              </label>
            </div>
          </div>
        </header>

        <section className="grid gap-4 border-b border-slate-200 px-5 py-4 md:grid-cols-[1.5fr_1fr_220px]">
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            Nombre del aspirante
            <input readOnly value={getCandidateName(candidate)} className={`${fieldClass} mt-1 bg-slate-50`} />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            Almacén / Sucursal
            <input readOnly value={agencyName} className={`${fieldClass} mt-1 bg-slate-50`} />
          </label>
          <label className="text-xs font-black uppercase tracking-wide text-slate-500">
            Fecha
            <input type="date" value={form.fechaEvaluacion} onChange={(event) => updateField("fechaEvaluacion", event.target.value)} className={`${fieldClass} mt-1`} />
          </label>
        </section>

        <EvaluationDesktopTable
          form={form}
          onRatingChange={updateRating}
          onObservationChange={updateObservation}
        />
        <EvaluationMobileCards
          form={form}
          onRatingChange={updateRating}
          onObservationChange={updateObservation}
        />

        <section className="grid border-t border-slate-300 xl:grid-cols-[1.7fr_0.55fr_0.8fr]">
          <div className="border-b border-slate-300 p-4 xl:border-b-0 xl:border-r">
            <div className="mb-3 flex items-center gap-3 text-green-800">
              <BarChart3 size={25} />
              <h2 className="font-black uppercase">Resumen de ventas</h2>
              <span className="ml-auto text-xs font-bold text-slate-500">Meta mínima: 4 ventas en 6 días</span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              {form.ventas.map((sale, index) => (
                <label key={index} className="text-center text-[10px] font-black uppercase text-slate-500">
                  Día {index + 1}
                  <input type="number" min="0" max="999" step="1" value={sale} onChange={(event) => updateSale(index, event.target.value)} className={`${fieldClass} mt-1 text-center text-base`} aria-label={`Ventas del día ${index + 1}`} />
                </label>
              ))}
              <div className="rounded-lg border border-green-700 bg-green-50 p-2 text-center">
                <p className="text-[10px] font-black uppercase text-green-800">Total</p>
                <p className="mt-1 text-xl font-black text-green-900">{scores.totalVentas}</p>
              </div>
            </div>
          </div>
          <div className="border-b border-slate-300 p-4 text-center xl:border-b-0 xl:border-r">
            <h2 className="text-xs font-black uppercase text-green-800">Cumplimiento de meta</h2>
            <p className="mt-2 text-xs font-bold text-slate-600">Mínimo 4 ventas</p>
            <span className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${scores.metaCumplida ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
              {scores.metaCumplida ? <Check size={16} /> : null}
              {scores.metaCumplida ? "SÍ" : "NO"}
            </span>
          </div>
          <label className="p-4 text-xs font-black uppercase text-green-800">
            Comentarios generales
            <textarea value={form.comentariosGenerales} onChange={(event) => updateField("comentariosGenerales", event.target.value)} maxLength={3000} className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm font-medium normal-case text-slate-700 outline-none focus:border-green-600" />
          </label>
        </section>

        <section className="grid border-t border-slate-300 xl:grid-cols-[1.2fr_1fr_0.8fr]">
          <div className="border-b border-slate-300 p-4 xl:border-b-0 xl:border-r">
            <div className="flex items-center gap-3 text-orange-600">
              <Trophy size={31} />
              <h2 className="text-lg font-black uppercase">Resultado final</h2>
              <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {completedCriteria}/{totalCriteria} criterios
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-center">
                <p className="text-[10px] font-black uppercase text-slate-600">Puntaje aspectos</p>
                <p className="mt-1 text-2xl font-black text-orange-700">{scoreText(scores.puntajeAspectos)}<span className="text-sm">/75</span></p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-center">
                <p className="text-[10px] font-black uppercase text-slate-600">Puntaje ventas</p>
                <p className="mt-1 text-2xl font-black text-orange-700">{scoreText(scores.puntajeVentas)}<span className="text-sm">/25</span></p>
              </div>
              <div className={`rounded-xl border p-3 text-center ${scores.cumpleAprobacion ? "border-green-300 bg-green-50" : "border-slate-300 bg-slate-50"}`}>
                <p className="text-[10px] font-black uppercase text-slate-600">Puntaje total</p>
                <p className={`mt-1 text-2xl font-black ${scores.cumpleAprobacion ? "text-green-800" : "text-slate-800"}`}>{scoreText(scores.puntajeTotal)}<span className="text-sm">/100</span></p>
              </div>
            </div>
          </div>

          <fieldset className="border-b border-slate-300 p-4 xl:border-b-0 xl:border-r">
            <legend className="px-1 text-xs font-black uppercase text-green-800">Recomendación del evaluador</legend>
            <div className="mt-2 space-y-2">
              {RECOMMENDATIONS.map((recommendation) => (
                <label key={recommendation.value} className={`flex cursor-pointer gap-3 rounded-lg border p-2.5 transition ${form.recomendacion === recommendation.value ? "border-green-700 bg-green-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <input type="radio" name="recommendation" value={recommendation.value} checked={form.recomendacion === recommendation.value} onChange={(event) => updateField("recomendacion", event.target.value)} className="mt-0.5 accent-green-800" />
                  <span className="text-xs text-slate-600"><strong className="block uppercase text-slate-900">{recommendation.label}</strong>{recommendation.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="p-4">
            <h2 className="text-center text-xs font-black uppercase text-green-800">Firma del evaluador</h2>
            <div className="mt-10 border-b-2 border-slate-500 pb-1">
              <input type="text" value={form.firmaEvaluador} onChange={(event) => updateField("firmaEvaluador", event.target.value)} maxLength={120} placeholder="Nombre o firma" className="w-full bg-transparent text-center text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400" />
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-200 px-5 py-3 text-[11px] font-bold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p><strong>Nota:</strong> Para ser aprobado, el aspirante debe obtener al menos 60/100 puntos y cumplir la meta mínima de 4 ventas.</p>
          <p className="shrink-0 font-black uppercase text-green-700">Disciplina + conocimiento + actitud = resultados</p>
        </footer>
      </article>
    </div>
  );
}
