import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarClock, Mail, MapPin, Phone, UserRound, X } from "lucide-react";
import {
  combineEcuadorDateTime,
  getCandidateCity,
  getCandidateEmail,
  getCandidateIdentification,
  getCandidateName,
  getCandidatePhone,
  getInitials,
  getTodayEcuador,
  toEcuadorDateInput,
  toEcuadorTimeInput,
} from "../../utils/interviews";

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const createForm = (candidate) => ({
  fecha: toEcuadorDateInput(candidate?.fechaEntrevista),
  hora: toEcuadorTimeInput(candidate?.fechaEntrevista),
  duracionMinutos: String(candidate?.entrevistaDuracionMinutos || 45),
  modalidad: candidate?.entrevistaModalidad || "PRESENCIAL",
  lugar: candidate?.entrevistaLugar || "",
  enlace: candidate?.entrevistaEnlace || "",
  observaciones: candidate?.entrevistaObservaciones || "",
});

function CandidateSummary({ candidate }) {
  const name = getCandidateName(candidate);
  const email = getCandidateEmail(candidate);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
        Aspirante seleccionado
      </p>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-extrabold text-orange-700">
          {getInitials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-snug text-slate-900">{name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Cédula: {getCandidateIdentification(candidate)}
          </p>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600">
            <p className="flex items-center gap-2"><Phone size={14} /> {getCandidatePhone(candidate)}</p>
            <p className="flex min-w-0 items-center gap-2"><Mail size={14} /> <span className="truncate">{email || "Sin correo registrado"}</span></p>
            <p className="flex items-center gap-2"><MapPin size={14} /> {getCandidateCity(candidate)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function InterviewSchedulerDrawer({
  open,
  candidate,
  candidates,
  agencies,
  onCandidateChange,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => createForm(candidate));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const firstFieldRef = useRef(null);
  const savingRef = useRef(false);
  const reprogramming = Boolean(candidate?.fechaEntrevista);
  const today = getTodayEcuador();

  const agencyOptions = useMemo(
    () =>
      agencies
        .filter((agency) => agency.activo !== false)
        .map((agency) =>
          [agency.nombre, agency.ciudad, agency.direccion].filter(Boolean).join(" - "),
        ),
    [agencies],
  );

  useEffect(() => {
    setForm(createForm(candidate));
    setErrors({});
  }, [candidate?.id]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !savingRef.current) onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: "", general: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!candidate) nextErrors.candidate = "Selecciona un aspirante.";
    if (!form.fecha) nextErrors.fecha = "La fecha es obligatoria.";
    if (!form.hora) nextErrors.hora = "La hora es obligatoria.";
    if (!form.duracionMinutos) nextErrors.duracionMinutos = "Selecciona una duración.";
    if (!form.modalidad) nextErrors.modalidad = "Selecciona una modalidad.";
    if (form.fecha && form.fecha < today) nextErrors.fecha = "La fecha no puede ser anterior a hoy.";
    if (form.modalidad === "PRESENCIAL" && !form.lugar.trim()) {
      nextErrors.lugar = "El lugar es obligatorio.";
    }
    if (form.modalidad === "VIRTUAL") {
      try {
        const url = new URL(form.enlace);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        nextErrors.enlace = "Ingresa un enlace válido.";
      }
    }
    if (form.observaciones.length > 1000) {
      nextErrors.observaciones = "Máximo 1000 caracteres.";
    }

    if (form.fecha && form.hora) {
      const scheduledAt = new Date(combineEcuadorDateTime(form.fecha, form.hora));
      if (scheduledAt.getTime() < Date.now() - 60 * 1000) {
        nextErrors.hora = "La fecha y hora deben ser futuras.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !validate()) return;

    try {
      setSaving(true);
      setErrors({});
      await onSubmit(candidate, {
        fechaEntrevista: combineEcuadorDateTime(form.fecha, form.hora),
        duracionMinutos: Number(form.duracionMinutos),
        modalidad: form.modalidad,
        lugar: form.modalidad === "PRESENCIAL" ? form.lugar.trim() : null,
        enlace: form.modalidad === "VIRTUAL" ? form.enlace.trim() : null,
        observaciones: form.observaciones.trim(),
      });
      onClose();
    } catch (error) {
      setErrors({
        general:
          error.response?.data?.message || "No se pudo guardar la entrevista. Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35" role="presentation">
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="interview-drawer-title"
        className="ml-auto flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Entrevistas</p>
            <h2 id="interview-drawer-title" className="mt-1 text-xl font-extrabold text-slate-950">
              {reprogramming ? "Reprogramar entrevista" : "Agendar entrevista"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            aria-label="Cerrar panel"
          >
            <X size={22} />
          </button>
        </header>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {!candidate ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Aspirante *</span>
                <select
                  ref={firstFieldRef}
                  value=""
                  onChange={(event) => {
                    const selected = candidates.find((item) => String(item.id) === event.target.value);
                    onCandidateChange(selected || null);
                  }}
                  className={fieldClass}
                >
                  <option value="">Selecciona un postulante</option>
                  {candidates.map((item) => (
                    <option key={item.id} value={item.id}>{getCandidateName(item)}</option>
                  ))}
                </select>
                {errors.candidate && <p className="mt-1 text-xs font-semibold text-red-600">{errors.candidate}</p>}
              </label>
            ) : (
              <div ref={firstFieldRef} tabIndex={-1} className="outline-none">
                <CandidateSummary candidate={candidate} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Fecha *</span>
                <input type="date" min={today} value={form.fecha} onChange={update("fecha")} className={fieldClass} />
                {errors.fecha && <p className="mt-1 text-xs font-semibold text-red-600">{errors.fecha}</p>}
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Hora *</span>
                <input type="time" value={form.hora} onChange={update("hora")} className={fieldClass} />
                {errors.hora && <p className="mt-1 text-xs font-semibold text-red-600">{errors.hora}</p>}
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-700">Duración *</span>
              <select value={form.duracionMinutos} onChange={update("duracionMinutos")} className={fieldClass}>
                {[15, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
              </select>
              {errors.duracionMinutos && <p className="mt-1 text-xs font-semibold text-red-600">{errors.duracionMinutos}</p>}
            </label>

            <fieldset>
              <legend className="mb-2 text-xs font-bold text-slate-700">Modalidad *</legend>
              <div className="flex gap-5">
                {["PRESENCIAL", "VIRTUAL"].map((option) => (
                  <label key={option} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="radio" name="modalidad" value={option} checked={form.modalidad === option} onChange={update("modalidad")} className="h-4 w-4 accent-orange-500" />
                    {option === "PRESENCIAL" ? "Presencial" : "Virtual"}
                  </label>
                ))}
              </div>
            </fieldset>

            {form.modalidad === "PRESENCIAL" ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Lugar *</span>
                <input list="interview-agencies" value={form.lugar} onChange={update("lugar")} placeholder="Selecciona una agencia o escribe una dirección" className={fieldClass} />
                <datalist id="interview-agencies">
                  {agencyOptions.map((option) => <option key={option} value={option} />)}
                </datalist>
                {errors.lugar && <p className="mt-1 text-xs font-semibold text-red-600">{errors.lugar}</p>}
              </label>
            ) : (
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">Enlace de reunión *</span>
                <input type="url" value={form.enlace} onChange={update("enlace")} placeholder="https://meet.example.com/..." className={fieldClass} />
                {errors.enlace && <p className="mt-1 text-xs font-semibold text-red-600">{errors.enlace}</p>}
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Observaciones</span>
                <span className="font-medium text-slate-400">{form.observaciones.length}/1000</span>
              </span>
              <textarea value={form.observaciones} onChange={update("observaciones")} rows={4} maxLength={1000} placeholder="Agrega información útil para la entrevista" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
              {errors.observaciones && <p className="mt-1 text-xs font-semibold text-red-600">{errors.observaciones}</p>}
            </label>

            <section className="space-y-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <label className="flex items-start gap-3 text-sm text-slate-500">
                <input type="checkbox" disabled className="mt-0.5 h-4 w-4" />
                <span><strong className="block text-slate-600">Enviar confirmación al aspirante</strong>Requiere integración de correo o mensajería.</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-500">
                <input type="checkbox" disabled className="mt-0.5 h-4 w-4" />
                <span><strong className="block text-slate-600">Enviar recordatorio 24 horas antes</strong>Automatización pendiente de configurar.</span>
              </label>
            </section>

            {errors.general && (
              <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                <AlertCircle className="mt-0.5 shrink-0" size={17} />
                {errors.general}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !candidate} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
              <CalendarClock size={17} />
              {saving ? "Guardando..." : reprogramming ? "Guardar nueva fecha" : "Agendar entrevista"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}
