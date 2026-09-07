import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { api } from '../../api/client';
import { formularioNovedad, novedadInicial } from '../../utils/nominaNovedadForm';

const BASE = '/api/contabilidad/roles-creditek-resumen/novedades';
const dinero = (value) => Number(value || 0).toLocaleString('es-EC', { style: 'currency', currency: 'USD' });
export default function NominaNovedadModal({ persona, anio, mes, novedadIdInicial = null, ajustesPendientes = {}, onClose, onSaved }) {
  const periodo = `${anio}-${String(mes).padStart(2, '0')}`;
  const nuevo = () => ({ tipo: 'MATERNIDAD', fechaInicio: `${periodo}-01`,
    fechaFin: new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10), fechaRetorno: '',
    porcentajeEmpleador: 25,
    porcentajeIess: 75, observacion: '', activo: true });
  const [form, setForm] = useState(nuevo);
  const [id, setId] = useState('');
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    const controller = new AbortController();
    api.get(`${BASE}/${persona.usuarioId}`, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (!data.disponible) throw new Error('Primero debe aplicarse la migración de novedades de nómina.');
      const historial = data.registros || [];
      setRegistros(historial);
      const actual = novedadInicial(historial, periodo, novedadIdInicial);
      if (actual) {
        setId(String(actual.id));
        setForm(formularioNovedad(actual));
      }
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.response?.data?.message || err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); element.close(); };
  }, [persona.usuarioId, periodo, novedadIdInicial]);
  const cambiar = (campo, valor) => {
    setForm((actual) => ({ ...actual, [campo]: valor }));
    setPreview(null); setError('');
  };
  const elegir = (valor) => {
    setId(valor); setPreview(null); setError('');
    const item = registros.find((row) => String(row.id) === valor);
    if (!item) { setForm(nuevo()); return; }
    setForm(formularioNovedad(item));
  };
  const payload = () => ({ ...form, usuarioId: persona.usuarioId, anio, mes,
    ajustesNomina: ajustesPendientes, ...(id ? { id: Number(id) } : {}) });
  const previsualizar = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setPreview(null);
    try { const { data } = await api.post(`${BASE}/preview`, payload()); setPreview(data.calculo); }
    catch (err) { setError(err.response?.data?.message || 'No se pudo calcular la vista previa.'); }
    finally { setBusy(false); }
  };
  const guardar = async () => {
    if (!dialog.current.querySelector('form').reportValidity()) return;
    setBusy(true); setError('');
    try {
      // Guardar valida y recalcula también si no se pulsó antes Vista previa.
      const { data } = await api.post(`${BASE}/preview`, payload());
      setPreview(data.calculo);
      if (id) await api.put(`${BASE}/${id}`, payload());
      else await api.post(BASE, payload());
      onSaved();
    } catch (err) { setError(err.response?.data?.message || 'No se pudo guardar la novedad.'); }
    finally { setBusy(false); }
  };
  const campo = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100';
  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className="m-auto max-h-[90vh] w-[min(760px,95vw)] overflow-auto rounded-xl border border-slate-300 bg-white p-0 text-slate-800 shadow-xl backdrop:bg-slate-900/50"
      aria-labelledby="novedad-titulo">
      <header className="flex items-start justify-between border-b border-slate-200 bg-sky-50 p-4">
        <div><h2 id="novedad-titulo" className="text-lg font-bold">{id ? 'Editar novedad de nómina' : 'Nueva novedad de nómina'}</h2>
          <p className="text-sm">{persona.nombre} · Período {periodo}</p></div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar novedad" className="rounded p-2 hover:bg-sky-100"><X size={20} /></button>
      </header>
      <form onSubmit={previsualizar} className="space-y-4 p-4">
        {error && <p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {Object.keys(ajustesPendientes).length > 0 && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">La vista previa incluye tus cambios pendientes de fondos y extras. Se conservarán en Nómina para que puedas guardarlos con Guardar todo.</p>}
        {loading ? <p>Cargando novedades…</p> : (
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-70">
            <label className="block text-sm font-semibold">Novedad que deseas editar
              <select value={id} onChange={(event) => elegir(event.target.value)} className={campo}>
                <option value="">Crear nueva novedad</option>
                {registros.map((item) => <option key={item.id} value={item.id}>{item.tipo} · {item.fechaInicio} a {item.fechaFin}{item.activo ? '' : ' · Inactiva'}</option>)}
              </select>
            </label>
            {id && <p className="rounded bg-sky-50 p-3 text-sm text-sky-900">Estás editando una novedad guardada. Corrige los datos y pulsa Guardar cambios.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Tipo
                <select value={form.tipo} onChange={(event) => cambiar('tipo', event.target.value)} className={campo}>
                  <option value="MATERNIDAD">Maternidad</option><option value="LACTANCIA">Lactancia</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.activo} onChange={(event) => cambiar('activo', event.target.checked)} /> Activa</label>
              {[['fechaInicio', 'Fecha de inicio'], ['fechaFin', 'Fecha final'], ['fechaRetorno', 'Fecha de retorno']].map(([key, label]) => (
                <label key={key} className="text-sm font-semibold">{label}<input type="date" required={key !== 'fechaRetorno'} value={form[key]} min={key !== 'fechaInicio' ? form.fechaInicio : undefined} onChange={(event) => cambiar(key, event.target.value)} className={campo} /></label>
              ))}
            </div>
            {form.tipo === 'MATERNIDAD' ? (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
                <p className="mb-3 text-sm">Los días se calculan con las fechas, sobre un mes laboral de 30 días. Desde la fecha de retorno se paga sueldo completo. La vista previa muestra la distribución calculada.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[['porcentajeEmpleador', '% empleador', 100], ['porcentajeIess', '% IESS informativo', 100]].map(([key, label, max]) => (
                    <label key={key} className="text-sm font-semibold">{label}<input type="number" min="0" max={max} step="0.01" value={form[key]} onChange={(event) => cambiar(key, event.target.value)} className={campo} /></label>
                  ))}
                </div>
              </div>
            ) : <p className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">Lactancia es informativa: 30 días y sueldo completo. No aplica el porcentaje de maternidad.</p>}
            <label className="block text-sm font-semibold">Observación<textarea maxLength={2000} value={form.observacion} onChange={(event) => cambiar('observacion', event.target.value)} className={campo} rows={2} /></label>
            <button type="submit" className="rounded-md border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900">{busy ? 'Procesando…' : 'Calcular vista previa'}</button>
          </fieldset>
        )}
        {preview && <div className="rounded-lg border border-slate-300" aria-live="polite">
          <p className="bg-sky-100 px-3 py-2 font-bold">Vista previa de {periodo}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-sm">
            {[['Sueldo mensual', preview.salario], ['Sueldo completo del período', preview.sueldoCompletoPeriodo], ['Maternidad: paga la empresa', preview.sueldoMaternidadEmpresa], ['Sueldo a pagar', preview.sueldoAPagar], ['Fondos de reserva', preview.fondosReserva], ['Ingresos de la empresa', preview.totalIngresos], ['IESS personal', preview.iess], ['Anticipos', preview.anticipo], ['Préstamos', preview.prestamo], ['Total egresos', preview.totalEgresos], ['A recibir de Creditek', preview.valorRecibir], ['Subsidio IESS (informativo)', preview.subsidioIessInformativo]].map(([label, value]) => <div key={label}><dt className="text-slate-600">{label}</dt><dd className="font-bold tabular-nums">{dinero(value)}</dd></div>)}
          </dl>
          <p className="border-t px-3 py-2 text-xs">{preview.diasSueldoCompleto} días completos · {preview.diasMaternidad25} días de maternidad. El subsidio IESS no se suma al pago de Creditek.</p>
        </div>}
        <footer className="flex justify-end gap-2 border-t pt-4">
          <button type="button" disabled={busy} onClick={onClose} className="rounded border px-4 py-2 text-sm">Cancelar</button>
          <button type="button" disabled={busy || loading} onClick={guardar} className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{id ? 'Guardar cambios' : 'Guardar novedad'}</button>
        </footer>
      </form>
    </dialog>
  );
}
NominaNovedadModal.propTypes = {
  persona: PropTypes.shape({ usuarioId: PropTypes.number.isRequired, nombre: PropTypes.string }).isRequired,
  anio: PropTypes.number.isRequired, mes: PropTypes.number.isRequired,
  novedadIdInicial: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  ajustesPendientes: PropTypes.object,
  onClose: PropTypes.func.isRequired, onSaved: PropTypes.func.isRequired,
};
