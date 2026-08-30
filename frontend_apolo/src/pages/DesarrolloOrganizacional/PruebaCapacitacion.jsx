import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  RotateCcw,
  Save,
  XCircle,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import { AuthContext } from "../../context/AuthContext";
import { getCandidateName } from "../../utils/interviews";

const PASSING_PERCENTAGE = 70;

const fieldClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const formatScore = (value) =>
  Number.isInteger(value) ? String(value) : Number(value || 0).toFixed(2);

function ScoreBadge({ result }) {
  if (!result) return null;

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-center ${
        result.aprobado
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-orange-300 bg-orange-50 text-orange-800"
      }`}
    >
      <p className="text-[11px] font-black uppercase tracking-wide">
        Calificacion
      </p>
      <p className="mt-1 text-3xl font-black">
        {formatScore(result.porcentaje)}
        <span className="text-base">%</span>
      </p>
      <p className="mt-1 text-xs font-bold">
        {result.correctas}/{result.totalPreguntas} correctas
      </p>
    </div>
  );
}

function ResultSummary({ result }) {
  if (!result) return null;

  return (
    <section className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[220px_1fr]">
      <ScoreBadge result={result} />
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase ${
              result.aprobado
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-700"
            }`}
          >
            {result.aprobado ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {result.aprobado ? "Aprobado" : "No aprobado"}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
            Nota {formatScore(result.notaSobre10)}/10
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
            Minimo {PASSING_PERCENTAGE}%
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Tipo: {result.tipoLabel}
        </p>
        {result.actualizadoAt && (
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Guardado {new Date(result.actualizadoAt).toLocaleString("es-EC")}
          </p>
        )}
      </div>
    </section>
  );
}

function QuestionCard({
  question,
  index,
  selected,
  resultDetail,
  onAnswer,
}) {
  const locked = Boolean(resultDetail);

  return (
    <section className="border-b border-slate-100 p-4 last:border-b-0">
      <div className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-5 text-slate-900">
            {question.question}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {question.options.map((option) => {
              const checked = selected === option.value;
              const isCorrect = resultDetail?.respuestaCorrecta === option.value;
              const isWrongSelection =
                resultDetail?.respuestaSeleccionada === option.value && !isCorrect;

              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm font-semibold transition ${
                    isCorrect
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : isWrongSelection
                        ? "border-red-300 bg-red-50 text-red-800"
                        : checked
                          ? "border-orange-300 bg-orange-50 text-orange-800"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  } ${locked ? "cursor-default" : ""}`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.value}
                    checked={checked}
                    disabled={locked}
                    onChange={() => onAnswer(question.id, option.value)}
                    className="mt-0.5 accent-orange-600"
                  />
                  <span className="shrink-0 font-black">{option.value})</span>
                  <span className="min-w-0">{option.text}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PruebaCapacitacion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const [candidate, setCandidate] = useState(null);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [questionnaire, setQuestionnaire] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const evaluatorName = auth?.user?.nombre || auth?.user?.email || "";

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await api.get(`/api/postulaciones/${id}/prueba-capacitacion`);
        if (!active) return;

        const data = response.data?.data || {};
        setCandidate(data.postulacion || null);
        setTypes(data.tipos || []);
        setResult(data.prueba || null);
        setSelectedType(data.prueba?.tipo || "");
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError.response?.data?.message ||
            "No se pudo cargar la prueba de capacitacion.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInitialData();
    return () => {
      active = false;
    };
  }, [id]);

  const answeredCount = useMemo(
    () =>
      (questionnaire?.preguntas || []).filter((question) => answers[question.id])
        .length,
    [answers, questionnaire],
  );
  const resultByQuestionId = useMemo(
    () =>
      new Map((result?.detalles || []).map((detail) => [detail.id, detail])),
    [result],
  );
  const canSubmit =
    Boolean(questionnaire?.preguntas?.length) &&
    answeredCount === questionnaire.preguntas.length &&
    !result;

  const startTest = async () => {
    if (!selectedType) {
      await Swal.fire(
        "Tipo requerido",
        "Selecciona vendedor de piso o call center antes de empezar.",
        "warning",
      );
      return;
    }

    try {
      setStarting(true);
      setResult(null);
      setAnswers({});
      const response = await api.get(`/api/postulaciones/${id}/prueba-capacitacion`, {
        params: { tipo: selectedType },
      });
      setQuestionnaire(response.data?.data?.cuestionario || null);
      setCandidate(response.data?.data?.postulacion || candidate);
    } catch (requestError) {
      await Swal.fire(
        "No se pudo iniciar",
        requestError.response?.data?.message || "Intenta nuevamente.",
        "error",
      );
    } finally {
      setStarting(false);
    }
  };

  const restartTest = async () => {
    const resultAlert = await Swal.fire({
      icon: "question",
      title: "Reiniciar prueba",
      text: "Se generara un nuevo orden de preguntas.",
      showCancelButton: true,
      confirmButtonText: "Reiniciar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f97316",
    });
    if (resultAlert.isConfirmed) await startTest();
  };

  const updateAnswer = (questionId, value) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const submitTest = async () => {
    if (!canSubmit) return;

    try {
      setSaving(true);
      const response = await api.put(`/api/postulaciones/${id}/prueba-capacitacion`, {
        tipo: questionnaire.tipo,
        evaluador: evaluatorName,
        questionIds: questionnaire.preguntas.map((question) => question.id),
        respuestas: answers,
      });
      const savedResult = response.data?.data;
      setResult(savedResult || null);
      await Swal.fire({
        icon: savedResult?.aprobado ? "success" : "info",
        title: "Prueba finalizada",
        text: `Calificacion: ${formatScore(savedResult?.porcentaje)}%`,
        timer: 1800,
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
        Cargando prueba de capacitacion...
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-black text-slate-900">
          No se pudo abrir la prueba
        </h1>
        <p className="mt-2 text-sm font-semibold text-red-700">
          {error || "Postulante no encontrado."}
        </p>
        <button
          type="button"
          onClick={() => navigate("/capacitacion")}
          className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white"
        >
          Volver a Capacitacion
        </button>
      </div>
    );
  }

  const activeQuestions = questionnaire?.preguntas || result?.detalles || [];

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => navigate("/capacitacion")}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft size={17} /> Volver a Capacitacion
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {questionnaire && !result && (
            <button
              type="button"
              onClick={restartTest}
              disabled={starting || saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw size={17} /> Reiniciar
            </button>
          )}
          {questionnaire && !result && (
            <button
              type="button"
              onClick={submitTest}
              disabled={!canSubmit || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-green-800 px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
              {saving ? "Guardando..." : "Finalizar prueba"}
            </button>
          )}
        </div>
      </div>

      <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="grid gap-4 border-b border-slate-200 p-5 lg:grid-cols-[1fr_330px] lg:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-orange-600">
              Capacitacion
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">
              Prueba de conocimiento
            </h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {getCandidateName(candidate)}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="text-xs font-black uppercase tracking-wide text-slate-500">
              Tipo de prueba
              <select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                disabled={Boolean(questionnaire && !result)}
                className={`${fieldClass} mt-1`}
              >
                <option value="">Seleccionar</option>
                {types.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={startTest}
              disabled={starting || Boolean(questionnaire && !result)}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-black text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-auto"
            >
              {starting ? <LoaderCircle className="animate-spin" size={17} /> : <ClipboardList size={17} />}
              {starting ? "Cargando..." : result ? "Nueva prueba" : "Iniciar prueba"}
            </button>
          </div>
        </header>

        <ResultSummary result={result} />

        {!questionnaire && !result && (
          <div className="flex min-h-64 items-center justify-center px-5 text-center">
            <div>
              <ClipboardList className="mx-auto text-slate-300" size={44} />
              <p className="mt-3 text-base font-black text-slate-800">
                Selecciona el tipo de prueba
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Las preguntas se cargaran en orden aleatorio.
              </p>
            </div>
          </div>
        )}

        {questionnaire && !result && (
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-600">
            Respondidas {answeredCount}/{questionnaire.preguntas.length}
          </div>
        )}

        {activeQuestions.length > 0 && (
          <div>
            {activeQuestions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                selected={answers[question.id] || question.respuestaSeleccionada}
                resultDetail={resultByQuestionId.get(question.id)}
                onAnswer={updateAnswer}
              />
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
