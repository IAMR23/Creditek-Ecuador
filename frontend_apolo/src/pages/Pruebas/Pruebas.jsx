import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, Save } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const stateLabel = {
  EN_PROGRESO: "En progreso",
  PENDIENTE_REVISION: "Pendiente de revisión",
  CALIFICADA: "Calificada",
};

const formatDate = (value) =>
  value ? new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";

const isAnswered = (answer) =>
  answer?.tipo === "abierta"
    ? Boolean(String(answer.textoRespuesta || "").trim())
    : Boolean(answer?.opcionSeleccionada);

export default function Pruebas() {
  const [config, setConfig] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [current, setCurrent] = useState(null);
  const [selectedType, setSelectedType] = useState("piso");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [saveState, setSaveState] = useState("Guardado");
  const saveTimers = useRef(new Map());

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/api/pruebas/configuracion"), api.get("/api/pruebas/mis-intentos")])
      .then(([configuration, history]) => {
        if (!active) return;
        const loadedAttempts = history.data?.data || [];
        setConfig(configuration.data?.data || null);
        setAttempts(loadedAttempts);
        setCurrent(loadedAttempts.find((attempt) => attempt.estado === "EN_PROGRESO") || null);
      })
      .catch((error) => {
        Swal.fire({ icon: "error", title: "No se pudieron cargar las pruebas", text: error.response?.data?.message || "Intenta nuevamente." });
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      saveTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const answersById = useMemo(
    () => new Map((current?.respuestas || []).map((answer) => [answer.preguntaId, answer])),
    [current],
  );
  const answeredCount = useMemo(
    () => (current?.respuestas || []).filter(isAnswered).length,
    [current],
  );
  const question = current?.preguntas?.[questionIndex];
  const currentAnswer = question ? answersById.get(question.id) : null;

  const startAttempt = async () => {
    try {
      setWorking(true);
      const response = await api.post("/api/pruebas/intentos", { tipo: selectedType });
      const attempt = response.data?.data;
      setCurrent(attempt);
      setQuestionIndex(0);
      setAttempts((items) => [attempt, ...items.filter((item) => item.id !== attempt.id)]);
      if (response.data?.reanudado) {
        Swal.fire({ icon: "info", title: "Prueba reanudada", text: "Continuarás desde el avance guardado." });
      }
    } catch (error) {
      Swal.fire({ icon: "error", title: "No se pudo iniciar", text: error.response?.data?.message || "Intenta nuevamente." });
    } finally {
      setWorking(false);
    }
  };

  const persistAnswer = async (answer) => {
    try {
      setSaveState("Guardando...");
      await api.patch(`/api/pruebas/intentos/${current.id}/respuestas`, { respuestas: [answer] });
      setSaveState("Guardado");
    } catch (error) {
      setSaveState("Error al guardar");
      Swal.fire({ icon: "error", title: "No se guardó la respuesta", text: error.response?.data?.message || "Revisa tu conexión." });
    }
  };

  const updateAnswer = (questionToUpdate, value) => {
    const patch = questionToUpdate.tipo === "abierta"
      ? { preguntaId: questionToUpdate.id, tipo: "abierta", textoRespuesta: value }
      : { preguntaId: questionToUpdate.id, tipo: "opcion_multiple", opcionSeleccionada: value };
    setCurrent((attempt) => ({
      ...attempt,
      respuestas: attempt.respuestas.map((answer) =>
        answer.preguntaId === questionToUpdate.id ? { ...answer, ...patch } : answer,
      ),
    }));
    const previous = saveTimers.current.get(questionToUpdate.id);
    if (previous) window.clearTimeout(previous);
    if (questionToUpdate.tipo === "opcion_multiple") {
      persistAnswer(patch);
    } else {
      setSaveState("Cambios pendientes");
      saveTimers.current.set(
        questionToUpdate.id,
        window.setTimeout(() => {
          persistAnswer(patch);
          saveTimers.current.delete(questionToUpdate.id);
        }, 700),
      );
    }
  };

  const finishAttempt = async () => {
    if (answeredCount !== 30) {
      const firstMissing = current.preguntas.findIndex((item) => !isAnswered(answersById.get(item.id)));
      setQuestionIndex(firstMissing < 0 ? 0 : firstMissing);
      await Swal.fire({ icon: "warning", title: "Prueba incompleta", text: `Has respondido ${answeredCount} de 30 preguntas.` });
      return;
    }
    const confirmation = await Swal.fire({
      icon: "question",
      title: "¿Finalizar la prueba?",
      text: "Después de enviarla no podrás cambiar tus respuestas.",
      showCancelButton: true,
      confirmButtonText: "Sí, finalizar",
      cancelButtonText: "Revisar respuestas",
      confirmButtonColor: "#0f172a",
    });
    if (!confirmation.isConfirmed) return;

    try {
      setWorking(true);
      saveTimers.current.forEach((timer) => window.clearTimeout(timer));
      saveTimers.current.clear();
      const allAnswers = current.respuestas.map((answer) =>
        answer.tipo === "abierta"
          ? { preguntaId: answer.preguntaId, textoRespuesta: answer.textoRespuesta }
          : { preguntaId: answer.preguntaId, opcionSeleccionada: answer.opcionSeleccionada },
      );
      await api.patch(`/api/pruebas/intentos/${current.id}/respuestas`, { respuestas: allAnswers });
      const response = await api.post(`/api/pruebas/intentos/${current.id}/finalizar`);
      const finished = response.data?.data;
      setCurrent(finished);
      setAttempts((items) => items.map((item) => (item.id === finished.id ? finished : item)));
      await Swal.fire({ icon: "success", title: "Prueba enviada", text: "Tu nota automática está lista. Falta la revisión del supervisor." });
    } catch (error) {
      Swal.fire({ icon: "error", title: "No se pudo finalizar", text: error.response?.data?.message || "Intenta nuevamente." });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={32} /></div>;

  if (current?.estado === "EN_PROGRESO" && question) {
    const progress = Math.round((answeredCount / 30) * 100);
    return (
      <section className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Prueba · {current.tipoLabel}</p><h1 className="mt-1 text-2xl font-extrabold text-slate-950">Cuestionario de capacitación</h1></div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Save size={16} /> {saveState}</div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-700"><span>Respondidas {answeredCount}/30</span><span>{progress}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} /></div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-extrabold text-slate-900">Preguntas</p>
            <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
              {current.preguntas.map((item, index) => {
                const answered = isAnswered(answersById.get(item.id));
                return <button key={item.id} type="button" onClick={() => setQuestionIndex(index)} className={`h-9 rounded-lg text-xs font-bold ${index === questionIndex ? "bg-slate-950 text-white" : answered ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{index + 1}</button>;
              })}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Las preguntas 24 a 30 son abiertas y deben responderse por escrito.</p>
          </aside>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center justify-between"><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-extrabold text-orange-700">Pregunta {questionIndex + 1} de 30</span><span className="text-xs font-bold uppercase tracking-wide text-slate-400">{question.tipo === "abierta" ? "Manejo de objeciones" : "Opción múltiple"}</span></div>
            <h2 className="mt-5 text-lg font-extrabold leading-7 text-slate-950">{question.question}</h2>
            {question.tipo === "abierta" ? (
              <textarea rows={8} maxLength={5000} value={currentAnswer?.textoRespuesta || ""} onChange={(event) => updateAnswer(question, event.target.value)} placeholder="Escribe una respuesta completa..." className="mt-5 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
            ) : (
              <div className="mt-5 grid gap-3">
                {question.options.map((option) => <label key={option.value} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${currentAnswer?.opcionSeleccionada === option.value ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:bg-slate-50"}`}><input type="radio" name={question.id} value={option.value} checked={currentAnswer?.opcionSeleccionada === option.value} onChange={() => updateAnswer(question, option.value)} className="mt-1 accent-orange-500" /><span className="text-sm font-semibold text-slate-700"><strong className="mr-2 text-slate-950">{option.value}.</strong>{option.text}</span></label>)}
              </div>
            )}
            <div className="mt-7 flex flex-wrap justify-between gap-3">
              <button type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => index - 1)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold disabled:opacity-40">Anterior</button>
              {questionIndex < 29 ? <button type="button" onClick={() => setQuestionIndex((index) => index + 1)} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">Siguiente</button> : <button type="button" disabled={working} onClick={finishAttempt} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50">Finalizar prueba</button>}
            </div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header><p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Capacitación Creditek</p><h1 className="mt-1 text-3xl font-extrabold text-slate-950">Evaluación</h1><p className="mt-2 text-sm text-slate-500">Evalúa tus conocimientos de productos, procesos de venta y manejo de objeciones.</p></header>

      {current && current.estado !== "EN_PROGRESO" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-emerald-500" /><div><h2 className="text-xl font-extrabold">{stateLabel[current.estado]}</h2><p className="mt-1 text-sm text-slate-500">{current.estado === "PENDIENTE_REVISION" ? "La parte escrita todavía debe ser revisada por un supervisor." : "La calificación final ya está disponible."}</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Score label="Nota automática" value={`${current.notaAutomatica ?? 0}/70`} />
            <Score label="Nota del supervisor" value={current.notaSupervisor == null ? "Pendiente" : `${current.notaSupervisor}/30`} />
            <Score label="Nota final" value={current.notaFinal == null ? "Pendiente" : `${current.notaFinal}/100`} />
          </div>
          {current.estado === "CALIFICADA" && <div className={`mt-4 rounded-xl p-4 text-center font-extrabold ${current.aprobado ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{current.aprobado ? "Aprobado" : "No aprobado"}</div>}
          <button type="button" onClick={() => setCurrent(null)} className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Volver al historial</button>
        </div>
      )}

      {!current && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><ClipboardCheck className="text-orange-500" /><div><h2 className="text-lg font-extrabold">Iniciar evaluación de capacitación</h2><p className="text-sm text-slate-500">30 preguntas · sin límite de tiempo · avance automático</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{(config?.tipos || []).map((type) => <button key={type.value} type="button" onClick={() => setSelectedType(type.value)} className={`rounded-xl border p-5 text-left ${selectedType === type.value ? "border-orange-400 bg-orange-50" : "border-slate-200"}`}><span className="font-extrabold text-slate-950">{type.label}</span><span className="mt-1 block text-sm text-slate-500">Incluye cinco preguntas específicas.</span></button>)}</div>
          <button type="button" disabled={working} onClick={startAttempt} className="mt-5 w-full rounded-xl bg-slate-950 px-5 py-3 font-extrabold text-white disabled:opacity-50">{working ? "Iniciando..." : "Iniciar prueba"}</button>
        </div>
      )}

      {!current && attempts.length > 0 && <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-extrabold">Historial de intentos</h2><div className="mt-4 divide-y divide-slate-100">{attempts.map((attempt) => <button key={attempt.id} type="button" onClick={() => setCurrent(attempt)} className="flex w-full flex-col gap-2 py-4 text-left sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">{attempt.tipoLabel}</p><p className="text-xs text-slate-500">{formatDate(attempt.fechaInicio)}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{stateLabel[attempt.estado]}</span>{attempt.notaFinal != null && <strong>{attempt.notaFinal}/100</strong>}</div></button>)}</div></div>}
    </section>
  );
}

function Score({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-950">{value}</p></div>;
}
