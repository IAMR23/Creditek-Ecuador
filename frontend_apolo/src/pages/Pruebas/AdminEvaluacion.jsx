import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Loader2, RefreshCw, XCircle } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("es-EC", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "-";

export default function AdminEvaluacion() {
  const [attempts, setAttempts] = useState([]);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState("TODAS");
  const [grades, setGrades] = useState({});
  const [generalObservation, setGeneralObservation] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const loadAttempts = async (state = filter) => {
    try {
      setLoading(true);
      const response = await api.get("/api/pruebas/admin/intentos", {
        params: { estado: state },
      });
      setAttempts(response.data?.data || []);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "No se cargaron las evaluaciones",
        text: error.response?.data?.message || "Intenta nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttempts(filter);
  }, [filter]);

  const openAttempt = async (id) => {
    try {
      setWorking(true);
      const response = await api.get(`/api/pruebas/admin/intentos/${id}`);
      const attempt = response.data?.data;
      setDetail(attempt);
      setGeneralObservation(attempt.observacionGeneral || "");
      setGrades(
        Object.fromEntries(
          attempt.respuestas
            .filter((answer) => answer.tipo === "abierta")
            .map((answer) => [
              answer.preguntaId,
              {
                puntaje: answer.puntajeSupervisor ?? "",
                observacion: answer.observacionSupervisor || "",
              },
            ]),
        ),
      );
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "No se abrió la evaluación",
        text: error.response?.data?.message || "Intenta nuevamente.",
      });
    } finally {
      setWorking(false);
    }
  };

  const openAnswers = useMemo(
    () => detail?.respuestas?.filter((answer) => answer.tipo === "abierta") || [],
    [detail],
  );
  const wrongAnswers = useMemo(
    () =>
      detail?.respuestas?.filter(
        (answer) => answer.tipo === "opcion_multiple" && answer.correcta === false,
      ) || [],
    [detail],
  );
  const totalPoints = useMemo(
    () =>
      openAnswers.reduce(
        (total, answer) =>
          total + (Number(grades[answer.preguntaId]?.puntaje) || 0),
        0,
      ),
    [grades, openAnswers],
  );

  const updateGrade = (questionId, field, value) => {
    setGrades((current) => ({
      ...current,
      [questionId]: { ...current[questionId], [field]: value },
    }));
  };

  const submitGrades = async () => {
    const incomplete = openAnswers.some((answer) => {
      const value = grades[answer.preguntaId]?.puntaje;
      const points = Number(value);
      return value === "" || !Number.isFinite(points) || points < 0 || points > 5;
    });
    if (incomplete) {
      await Swal.fire({
        icon: "warning",
        title: "Calificación incompleta",
        text: "Asigna entre 0 y 5 puntos a las siete respuestas abiertas.",
      });
      return;
    }

    const confirmation = await Swal.fire({
      icon: "question",
      title: "¿Finalizar la calificación?",
      text: "La nota final quedará disponible para el participante.",
      showCancelButton: true,
      confirmButtonText: "Finalizar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0f172a",
    });
    if (!confirmation.isConfirmed) return;

    try {
      setWorking(true);
      const response = await api.put(
        `/api/pruebas/admin/intentos/${detail.id}/calificar`,
        {
          calificaciones: openAnswers.map((answer) => ({
            preguntaId: answer.preguntaId,
            puntaje: Number(grades[answer.preguntaId].puntaje),
            observacion: grades[answer.preguntaId].observacion,
          })),
          observacionGeneral: generalObservation,
        },
      );
      const updated = response.data?.data;
      setDetail(updated);
      setAttempts((items) =>
        filter === "PENDIENTE_REVISION"
          ? items.filter((attempt) => attempt.id !== updated.id)
          : items.map((attempt) => (attempt.id === updated.id ? updated : attempt)),
      );
      await Swal.fire({
        icon: "success",
        title: "Evaluación calificada",
        text: `Nota final: ${updated.notaFinal}/100`,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "No se guardó la calificación",
        text: error.response?.data?.message || "Intenta nuevamente.",
      });
    } finally {
      setWorking(false);
    }
  };

  if (detail) {
    const isPending = detail.estado === "PENDIENTE_REVISION";
    return (
      <section className="mx-auto max-w-5xl space-y-5">
        <button
          type="button"
          onClick={() => setDetail(null)}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft size={18} /> Volver a evaluaciones
        </button>

        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
            Detalle de evaluación
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-950">
            {detail.participante?.nombre || "Usuario"}
          </h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Info
              label="Agencia"
              value={
                detail.participante?.agencias
                  ?.map((agency) => agency.nombre)
                  .join(", ") || "Sin agencia"
              }
            />
            <Info label="Modalidad" value={detail.tipoLabel} />
            <Info label="Fecha de envío" value={formatDate(detail.fechaEnvio)} />
            <Info label="Nota automática" value={`${detail.notaAutomatica}/70`} />
          </div>
          {detail.estado === "CALIFICADA" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Nota final" value={`${detail.notaFinal}/100`} />
              <Info label="Resultado" value={detail.aprobado ? "Aprobado" : "No aprobado"} />
            </div>
          )}
        </header>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <XCircle className="text-red-500" size={21} />
            <h2 className="text-lg font-extrabold text-slate-950">
              Preguntas incorrectas ({wrongAnswers.length})
            </h2>
          </div>
          {wrongAnswers.length === 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
              <CheckCircle2 size={18} /> Respondió correctamente las 23 preguntas.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {wrongAnswers.map((answer, index) => (
                <div key={answer.preguntaId} className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                  <p className="text-sm font-extrabold text-slate-900">
                    {index + 1}. {answer.pregunta}
                  </p>
                  <p className="mt-2 text-sm text-red-700">
                    Respondió: <strong>{answer.opcionSeleccionada}. {answer.opciones?.find((option) => option.value === answer.opcionSeleccionada)?.text || ""}</strong>
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Respuesta correcta: <strong>{answer.respuestaCorrecta}. {answer.opciones?.find((option) => option.value === answer.respuestaCorrecta)?.text || ""}</strong>
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <div className="space-y-4">
          {openAnswers.map((answer, index) => (
            <article key={answer.preguntaId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wide text-orange-600">
                Respuesta abierta {index + 1} de 7
              </p>
              <h2 className="mt-2 font-extrabold leading-6 text-slate-950">{answer.pregunta}</h2>
              <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {answer.textoRespuesta}
              </div>
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700">Rúbrica interna</p>
                <p className="mt-1 text-sm leading-6 text-blue-950">{answer.rubrica}</p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[150px_1fr]">
                <label className="text-sm font-bold text-slate-700">
                  Puntaje (0 a 5)
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    disabled={!isPending}
                    value={grades[answer.preguntaId]?.puntaje ?? ""}
                    onChange={(event) => updateGrade(answer.preguntaId, "puntaje", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 p-3 disabled:bg-slate-100"
                  />
                </label>
                <label className="text-sm font-bold text-slate-700">
                  Observación
                  <textarea
                    rows={3}
                    maxLength={3000}
                    disabled={!isPending}
                    value={grades[answer.preguntaId]?.observacion || ""}
                    onChange={(event) => updateGrade(answer.preguntaId, "observacion", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 p-3 disabled:bg-slate-100"
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <footer className="sticky bottom-3 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur">
          <label className="text-sm font-bold text-slate-700">
            Observación general
            <textarea
              rows={2}
              maxLength={5000}
              disabled={!isPending}
              value={generalObservation}
              onChange={(event) => setGeneralObservation(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 disabled:bg-slate-100"
            />
          </label>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Puntos abiertos</p>
              <p className="text-2xl font-extrabold">{totalPoints}/35</p>
            </div>
            {isPending && (
              <button
                type="button"
                disabled={working}
                onClick={submitGrades}
                className="rounded-xl bg-slate-950 px-6 py-3 font-extrabold text-white disabled:opacity-50"
              >
                {working ? "Guardando..." : "Finalizar calificación"}
              </button>
            )}
          </div>
        </footer>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-600">Administración</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Evaluación</h1>
          <p className="mt-2 text-sm text-slate-500">
            Revisa resultados y califica las respuestas abiertas de capacitación.
          </p>
        </div>
        <button type="button" onClick={() => loadAttempts()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">
          <RefreshCw size={16} /> Actualizar
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          ["TODAS", "Todas"],
          ["PENDIENTE_REVISION", "Pendientes"],
          ["CALIFICADA", "Calificadas"],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-bold ${filter === value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={32} /></div>
      ) : attempts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <ClipboardCheck className="mx-auto text-slate-300" size={42} />
          <h2 className="mt-4 text-lg font-extrabold">No hay evaluaciones en este estado</h2>
        </div>
      ) : (
        <div className="grid gap-4">
          {attempts.map((attempt) => {
            const incorrect = attempt.respuestas.filter(
              (answer) => answer.tipo === "opcion_multiple" && answer.correcta === false,
            ).length;
            return (
              <article key={attempt.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold">{attempt.participante?.nombre || "Usuario"}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {attempt.participante?.agencias?.map((agency) => agency.nombre).join(", ") || "Sin agencia"} · {attempt.tipoLabel}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">Enviada: {formatDate(attempt.fechaEnvio)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right"><p className="text-xs font-bold uppercase text-slate-500">Incorrectas</p><p className="text-xl font-extrabold text-red-600">{incorrect}</p></div>
                    <div className="text-right"><p className="text-xs font-bold uppercase text-slate-500">Calificación</p><p className="text-xl font-extrabold">{attempt.notaFinal == null ? `${attempt.notaAutomatica}/70` : `${attempt.notaFinal}/100`}</p></div>
                    <button type="button" disabled={working} onClick={() => openAttempt(attempt.id)} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-extrabold text-white">
                      {attempt.estado === "PENDIENTE_REVISION" ? "Revisar y calificar" : "Ver detalle"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Info({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>;
}
