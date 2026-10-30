import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
const money = (value) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value || 0));
const number = (value) => Number(value || 0).toFixed(2);
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const buttonClass = "rounded-xl bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50";
const errorText = (error) => error.response?.data?.message || error.message || "No se pudo completar la operación.";

const addDays = (date, days) => {
  const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};
const inclusiveDays = (start, end) => start && end ? Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1 : 0;

function Card({ title, children, className = "" }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}><h2 className="mb-4 text-lg font-black text-slate-900">{title}</h2>{children}</section>;
}

function Status({ value }) {
  const colors = { PENDIENTE: "bg-amber-100 text-amber-800", APROBADA: "bg-emerald-100 text-emerald-800", RECHAZADA: "bg-red-100 text-red-800", CANCELADA: "bg-slate-200 text-slate-700", PAGADO: "bg-emerald-100 text-emerald-800", PENDIENTE_PAGO: "bg-amber-100 text-amber-800", ANULADO: "bg-slate-200 text-slate-700" };
  return <span className={`rounded-full px-2 py-1 text-xs font-extrabold ${colors[value] || "bg-blue-100 text-blue-800"}`}>{String(value || "").replaceAll("_", " ")}</span>;
}

export default function Vacaciones() {
  const [tab, setTab] = useState("resumen");
  const [catalogos, setCatalogos] = useState({ usuarios: [], agencias: [] });
  const [usuarioId, setUsuarioId] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState(`${today().slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(addDays(`${today().slice(0, 7)}-01`, 41));
  const [periodos, setPeriodos] = useState([]);
  const [periodosPropuestos, setPeriodosPropuestos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodoForm, setPeriodoForm] = useState({ fechaInicio: "", fechaFin: "", fechaCorte: today(), diasOrdinarios: 15, diasAdicionales: 0, diasDisfrutadosHistoricos: 0, motivoHistorico: "", observacion: "" });
  const [solicitudForm, setSolicitudForm] = useState({ fechaInicio: "", fechaFin: "", fechaReincorporacion: "", observacion: "", reemplazoUsuarioId: "", motivoPrioridad: "" });
  const [asignaciones, setAsignaciones] = useState({});
  const [pagoForm, setPagoForm] = useState({ concepto: "REMUNERACION_DESCANSO", fundamento: "", dias: 0, baseCalculo: "", monto: "", fechaPago: "", medio: "", referencia: "", soporte: "" });

  const usuario = catalogos.usuarios.find((item) => String(item.id) === String(usuarioId));
  const agenciasUsuario = usuario?.agencias || [];
  const diasSolicitud = inclusiveDays(solicitudForm.fechaInicio, solicitudForm.fechaFin);
  const disponibles = periodos.reduce((sum, item) => sum + Number(item.disponibles || 0), 0);
  const saldoTotal = useMemo(() => periodos.reduce((acc, item) => {
    for (const key of ["reconocidos", "disfrutados", "comprometidos", "reservadosCompensacion", "compensados", "disponibles"]) acc[key] += Number(item[key] || 0);
    return acc;
  }, { reconocidos: 0, disfrutados: 0, comprometidos: 0, reservadosCompensacion: 0, compensados: 0, disponibles: 0 }), [periodos]);

  const request = async (callback, success) => {
    setLoading(true);
    try { const result = await callback(); if (success) await Swal.fire({ icon: "success", title: success, timer: 1300, showConfirmButton: false }); return result; }
    catch (error) { await Swal.fire("Error", errorText(error), "error"); return null; }
    finally { setLoading(false); }
  };

  const loadCatalogs = async () => {
    const { data } = await api.get("/api/vacaciones/catalogos"); setCatalogos(data);
    if (!usuarioId && data.usuarios?.length) setUsuarioId(String(data.usuarios[0].id));
  };
  const loadData = async () => {
    setLoading(true);
    try {
      await api.post("/api/vacaciones/procesar-consumos", { usuarioId: usuarioId || undefined });
      if (usuarioId) {
        const balanceResponse = await api.get(`/api/vacaciones/saldos/${usuarioId}`);
        setPeriodos(balanceResponse.data || []);
      }
      const params = { usuarioId: usuarioId || undefined, agenciaId: agenciaId || undefined, estado: estado || undefined, desde, hasta };
      const [requests, calendar, paymentList] = await Promise.all([
        api.get("/api/vacaciones/solicitudes", { params }),
        api.get("/api/vacaciones/calendario", { params: { usuarioId: usuarioId || undefined, agenciaId: agenciaId || undefined, desde, hasta } }),
        api.get("/api/vacaciones/pagos", { params: { usuarioId: usuarioId || undefined } }),
      ]);
      setSolicitudes(requests.data || []); setCalendario(calendar.data || []); setPagos(paymentList.data || []);
    } catch (error) { Swal.fire("Error", errorText(error), "error"); } finally { setLoading(false); }
  };
  const loadBalances = async () => {
    if (!usuarioId) { setPeriodos([]); setPeriodosPropuestos([]); return; }
    try {
      const [balances, proposals] = await Promise.all([
        api.get(`/api/vacaciones/saldos/${usuarioId}`),
        api.get(`/api/vacaciones/periodos-propuestos/${usuarioId}`),
      ]);
      setPeriodos(balances.data || []);
      setPeriodosPropuestos(proposals.data?.propuestas || []);
      const primeraPendiente = proposals.data?.propuestas?.find((item) => !item.registrado);
      if (primeraPendiente) setPeriodoForm((current) => ({
        ...current,
        fechaInicio: primeraPendiente.fechaInicio,
        fechaFin: primeraPendiente.fechaFin,
        diasOrdinarios: primeraPendiente.diasOrdinariosSugeridos,
        diasAdicionales: primeraPendiente.diasAdicionalesMaximos,
      }));
    }
    catch (error) { Swal.fire("Error", errorText(error), "error"); }
  };

  const selectProposedPeriod = (value) => {
    const proposal = periodosPropuestos.find((item) => `${item.fechaInicio}:${item.fechaFin}` === value);
    if (!proposal) return;
    setPeriodoForm((current) => ({
      ...current,
      fechaInicio: proposal.fechaInicio,
      fechaFin: proposal.fechaFin,
      diasOrdinarios: proposal.diasOrdinariosSugeridos,
      diasAdicionales: proposal.diasAdicionalesMaximos,
    }));
  };

  useEffect(() => { loadCatalogs().catch((error) => Swal.fire("Error", errorText(error), "error")); }, []);
  useEffect(() => { loadBalances(); }, [usuarioId]);
  useEffect(() => { if (catalogos.usuarios.length) loadData(); }, [usuarioId, agenciaId, estado, desde, hasta, catalogos.usuarios.length]);
  useEffect(() => {
    if (agenciasUsuario.length && !agenciasUsuario.some((item) => String(item.id) === String(agenciaId))) setAgenciaId(String(agenciasUsuario[0].id));
  }, [usuarioId, catalogos.usuarios]);
  useEffect(() => {
    if (solicitudForm.fechaFin) setSolicitudForm((current) => ({ ...current, fechaReincorporacion: addDays(current.fechaFin, 1) }));
  }, [solicitudForm.fechaFin]);

  const proposeAllocation = () => {
    let remaining = diasSolicitud; const next = {};
    for (const item of [...periodos].filter((p) => p.estado === "CUMPLIDO" && Number(p.disponibles) > 0).sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))) {
      const take = Math.min(remaining, Number(item.disponibles)); if (take > 0) next[item.id] = take; remaining -= take;
    }
    setAsignaciones(next);
    if (remaining > 0) Swal.fire("Saldo insuficiente", `Faltan ${remaining} día(s) por distribuir.`, "warning");
  };

  const savePeriod = async (event) => {
    event.preventDefault();
    const result = await request(() => api.post("/api/vacaciones/periodos", { ...periodoForm, usuarioId: Number(usuarioId) }), "Período registrado");
    if (result) { await loadBalances(); setPeriodoForm((f) => ({ ...f, fechaInicio: "", fechaFin: "", diasDisfrutadosHistoricos: 0, motivoHistorico: "", observacion: "" })); }
  };

  const saveRequest = async (event) => {
    event.preventDefault();
    const origins = Object.entries(asignaciones).filter(([, days]) => Number(days) > 0).map(([periodoId, days]) => ({ periodoId: Number(periodoId), dias: Number(days) }));
    const result = await request(() => api.post("/api/vacaciones/solicitudes", {
      ...solicitudForm, usuarioId: Number(usuarioId), agenciaId: Number(agenciaId), cantidadDias: diasSolicitud,
      reemplazoUsuarioId: solicitudForm.reemplazoUsuarioId ? Number(solicitudForm.reemplazoUsuarioId) : null,
      periodos: origins, idempotenciaKey: crypto.randomUUID(),
    }), "Solicitud registrada");
    if (result) {
      if (result.data?.advertencias?.length) await Swal.fire("Revisar cobertura", result.data.advertencias.join("\n"), "warning");
      setSolicitudForm({ fechaInicio: "", fechaFin: "", fechaReincorporacion: "", observacion: "", reemplazoUsuarioId: "", motivoPrioridad: "" }); setAsignaciones({}); await Promise.all([loadData(), loadBalances()]);
    }
  };

  const adjustPeriod = async (periodo) => {
    const result = await Swal.fire({
      title: "Registrar ajuste auditable",
      html: `<select id="vac-ajuste-categoria" class="swal2-select !m-0 !w-full"><option value="RECONOCIDO_ORDINARIO">Reconocido ordinario</option><option value="RECONOCIDO_ADICIONAL">Adicional por antigüedad</option><option value="DISFRUTADO">Disfrutado histórico</option></select><input id="vac-ajuste-dias" type="number" step="0.01" class="swal2-input !mx-0 !w-full" placeholder="Días (+ o -)"><input id="vac-ajuste-fecha" type="date" value="${today()}" class="swal2-input !mx-0 !w-full"><textarea id="vac-ajuste-motivo" class="swal2-textarea !mx-0 !w-full" placeholder="Motivo y soporte"></textarea>`,
      showCancelButton: true,
      preConfirm: () => {
        const dias = Number(document.getElementById("vac-ajuste-dias")?.value);
        const motivo = document.getElementById("vac-ajuste-motivo")?.value?.trim();
        if (!dias || !motivo) return Swal.showValidationMessage("Ingrese días distintos de cero y un motivo."), false;
        return { categoria: document.getElementById("vac-ajuste-categoria")?.value, dias, fechaCorte: document.getElementById("vac-ajuste-fecha")?.value, motivo, idempotenciaKey: crypto.randomUUID() };
      },
    });
    if (!result.isConfirmed) return;
    const response = await request(() => api.post(`/api/vacaciones/periodos/${periodo.id}/ajustes`, result.value), "Ajuste registrado");
    if (response) await loadBalances();
  };

  const decision = async (id, action) => {
    let motivo = "";
    if (action !== "aprobar") { const prompt = await Swal.fire({ title: `Motivo para ${action}`, input: "textarea", showCancelButton: true, inputValidator: (v) => !v?.trim() && "El motivo es obligatorio." }); if (!prompt.isConfirmed) return; motivo = prompt.value; }
    const result = await request(() => api.post(`/api/vacaciones/solicitudes/${id}/${action}`, { motivo }), `Solicitud ${action === "aprobar" ? "aprobada" : action === "rechazar" ? "rechazada" : "cancelada"}`);
    if (result) await Promise.all([loadData(), loadBalances()]);
  };

  const savePayment = async (event) => {
    event.preventDefault();
    const consumes = ["COMPENSACION_ANTIGUEDAD", "LIQUIDACION_TERMINACION"].includes(pagoForm.concepto);
    const origins = consumes ? Object.entries(asignaciones).filter(([, days]) => Number(days) > 0).map(([periodoId, days]) => ({ periodoId: Number(periodoId), dias: Number(days) })) : [];
    const result = await request(() => api.post("/api/vacaciones/pagos", { ...pagoForm, usuarioId: Number(usuarioId), dias: consumes ? Number(pagoForm.dias) : 0, baseCalculo: pagoForm.baseCalculo || null, periodos: origins, idempotenciaKey: crypto.randomUUID() }), "Registro de pago creado; no se realizó ninguna transferencia");
    if (result) { await loadData(); setPagoForm((f) => ({ ...f, fundamento: "", dias: 0, baseCalculo: "", monto: "", fechaPago: "", medio: "", referencia: "", soporte: "" })); }
  };

  const paymentAction = async (payment, action) => {
    let body = {};
    if (action === "confirmar") { const value = await Swal.fire({ title: "Confirmar pago documentado", html: "Esta acción no realiza transferencias.", input: "text", inputLabel: "Referencia / comprobante", showCancelButton: true, inputValidator: (v) => !v?.trim() && "Ingrese la referencia." }); if (!value.isConfirmed) return; body = { fechaPago: today(), referencia: value.value }; }
    if (action === "anular") { const value = await Swal.fire({ title: "Motivo de anulación", input: "textarea", showCancelButton: true, inputValidator: (v) => !v?.trim() && "Ingrese el motivo." }); if (!value.isConfirmed) return; body = { motivo: value.value }; }
    const result = await request(() => api.post(`/api/vacaciones/pagos/${payment.id}/${action}`, body), "Pago actualizado"); if (result) await Promise.all([loadData(), loadBalances()]);
  };

  return <div className="space-y-6">
    <header className="rounded-3xl bg-black p-6 text-white shadow-xl">
      <p className="text-xs font-black uppercase tracking-[.25em] text-orange-400">Desarrollo Organizacional</p>
      <h1 className="mt-1 text-3xl font-black">Vacaciones</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">Períodos por aniversario, solicitudes, calendario, saldos auditables y documentación de pagos. Conteo legal: días calendario incluidos los no laborables.</p>
    </header>

    <Card title="Filtros y colaborador activo">
      <div className="grid gap-3 md:grid-cols-5">
        <select className={inputClass} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}><option value="">Todos los colaboradores</option>{catalogos.usuarios.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <select className={inputClass} value={agenciaId} onChange={(e) => setAgenciaId(e.target.value)}><option value="">Todas las unidades</option>{catalogos.agencias.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.tipo}</option>)}</select>
        <select className={inputClass} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos los estados</option>{["PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA"].map((item) => <option key={item}>{item}</option>)}</select>
        <input className={inputClass} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input className={inputClass} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </div>
    </Card>

    <div className="flex flex-wrap gap-2">{[["resumen", "Saldos y períodos"], ["solicitudes", "Solicitudes y calendario"], ["pagos", "Pagos documentados"]].map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-black ${tab === key ? "bg-orange-500 text-white" : "bg-white text-slate-700 shadow-sm"}`}>{label}</button>)}</div>

    {tab === "resumen" && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{Object.entries({ Reconocidos: saldoTotal.reconocidos, Disfrutados: saldoTotal.disfrutados, Comprometidos: saldoTotal.comprometidos, "Reserva compensación": saldoTotal.reservadosCompensacion, Compensados: saldoTotal.compensados, Disponibles: saldoTotal.disponibles }).map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-4"><div className="text-xs font-bold uppercase text-slate-500">{label}</div><div className="mt-1 text-2xl font-black">{number(value)}</div></div>)}</div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card title="Períodos laborales y movimientos">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500">{["Período", "Estado", "Reconocidos", "Disfrutados", "Comprometidos", "Reservados", "Compensados", "Disponibles", ""].map((h, index) => <th key={`${h}-${index}`} className="p-2">{h}</th>)}</tr></thead><tbody>{periodos.map((p) => <tr key={p.id} className="border-b"><td className="p-2 font-bold">{p.fechaInicio}<br />{p.fechaFin}</td><td className="p-2"><Status value={p.estado} /></td><td className="p-2">{number(p.reconocidos)}</td><td className="p-2">{number(p.disfrutados)}</td><td className="p-2">{number(p.comprometidos)}</td><td className="p-2">{number(p.reservadosCompensacion)}</td><td className="p-2">{number(p.compensados)}</td><td className="p-2 font-black text-emerald-700">{number(p.disponibles)}</td><td className="p-2"><button type="button" onClick={() => adjustPeriod(p)} className="rounded-lg border px-2 py-1 text-xs font-bold">Ajustar</button></td></tr>)}{!periodos.length && <tr><td colSpan="9" className="p-8 text-center text-slate-500">Seleccione un colaborador o registre sus períodos históricos.</td></tr>}</tbody></table></div>
        </Card>
        <Card title="Registrar período por aniversario">
          <form onSubmit={savePeriod} className="space-y-3">
            <label className="block text-xs font-bold">Año de servicio desde fecha de ingreso
              <select required className={inputClass} value={periodoForm.fechaInicio && periodoForm.fechaFin ? `${periodoForm.fechaInicio}:${periodoForm.fechaFin}` : ""} onChange={(e) => selectProposedPeriod(e.target.value)}>
                <option value="">Seleccione un período</option>
                {periodosPropuestos.map((item) => <option key={`${item.fechaInicio}-${item.fechaFin}`} value={`${item.fechaInicio}:${item.fechaFin}`} disabled={item.registrado}>Año {item.anioServicio}: {item.fechaInicio} – {item.fechaFin} · {item.estado}{item.registrado ? " · REGISTRADO" : ""}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Inicio<input readOnly className={`${inputClass} bg-slate-100`} value={periodoForm.fechaInicio} /></label><label className="text-xs font-bold">Fin<input readOnly className={`${inputClass} bg-slate-100`} value={periodoForm.fechaFin} /></label></div>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Ordinarios<input className={inputClass} type="number" min="0" step=".01" value={periodoForm.diasOrdinarios} onChange={(e) => setPeriodoForm({ ...periodoForm, diasOrdinarios: e.target.value })} /></label><label className="text-xs font-bold">Adicionales<input className={inputClass} type="number" min="0" step=".01" value={periodoForm.diasAdicionales} onChange={(e) => setPeriodoForm({ ...periodoForm, diasAdicionales: e.target.value })} /></label></div>
            <label className="block text-xs font-bold">Disfrutados históricos<input className={inputClass} type="number" min="0" step=".01" value={periodoForm.diasDisfrutadosHistoricos} onChange={(e) => setPeriodoForm({ ...periodoForm, diasDisfrutadosHistoricos: e.target.value })} /></label>
            <label className="block text-xs font-bold">Fecha de corte<input required className={inputClass} type="date" value={periodoForm.fechaCorte} onChange={(e) => setPeriodoForm({ ...periodoForm, fechaCorte: e.target.value })} /></label>
            <textarea className={inputClass} placeholder="Motivo / fuente del histórico" value={periodoForm.motivoHistorico} onChange={(e) => setPeriodoForm({ ...periodoForm, motivoHistorico: e.target.value })} />
            <p className="text-xs text-slate-500">Las fechas se generan desde la fecha de ingreso guardada en Usuarios. Los períodos en formación se registran con cero días reconocidos; los ajustes posteriores son movimientos auditables.</p>
            <button disabled={loading || !usuarioId} className={buttonClass}>Guardar período</button>
          </form>
        </Card>
      </div>
    </>}

    {tab === "solicitudes" && <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
        <Card title="Nueva solicitud">
          <form onSubmit={saveRequest} className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Inicio<input required className={inputClass} type="date" value={solicitudForm.fechaInicio} onChange={(e) => setSolicitudForm({ ...solicitudForm, fechaInicio: e.target.value })} /></label><label className="text-xs font-bold">Último día incluido<input required className={inputClass} type="date" value={solicitudForm.fechaFin} onChange={(e) => setSolicitudForm({ ...solicitudForm, fechaFin: e.target.value })} /></label></div>
            <div className="rounded-xl bg-orange-50 p-3 text-sm font-bold text-orange-900">{diasSolicitud > 0 ? `${diasSolicitud} días calendario` : "Seleccione el rango"} · Reincorporación: {solicitudForm.fechaReincorporacion || "—"}</div>
            <select className={inputClass} value={solicitudForm.reemplazoUsuarioId} onChange={(e) => setSolicitudForm({ ...solicitudForm, reemplazoUsuarioId: e.target.value })}><option value="">Sin reemplazo</option>{catalogos.usuarios.filter((u) => String(u.id) !== String(usuarioId)).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
            <textarea className={inputClass} placeholder="Observación" value={solicitudForm.observacion} onChange={(e) => setSolicitudForm({ ...solicitudForm, observacion: e.target.value })} />
            <button type="button" onClick={proposeAllocation} className="rounded-xl border border-orange-500 px-3 py-2 text-sm font-bold text-orange-700">Proponer períodos más antiguos</button>
            <div className="space-y-2">{periodos.filter((p) => Number(p.disponibles) > 0).map((p) => <label key={p.id} className="grid grid-cols-[1fr_100px] items-center gap-2 rounded-xl border p-2 text-xs"><span><b>{p.fechaInicio} – {p.fechaFin}</b><br />Disponible: {number(p.disponibles)}</span><input className={inputClass} type="number" min="0" max={p.disponibles} step=".01" value={asignaciones[p.id] || ""} onChange={(e) => setAsignaciones({ ...asignaciones, [p.id]: e.target.value })} /></label>)}</div>
            <textarea className={inputClass} placeholder="Motivo obligatorio si cambia la prioridad más antigua" value={solicitudForm.motivoPrioridad} onChange={(e) => setSolicitudForm({ ...solicitudForm, motivoPrioridad: e.target.value })} />
            <p className="text-xs text-slate-500">La ley prevé un período ininterrumpido. Todo fraccionamiento debe quedar fundamentado y revisado por RRHH.</p>
            <button disabled={loading || !usuarioId || !agenciaId || diasSolicitud <= 0} className={buttonClass}>Registrar pendiente</button>
          </form>
        </Card>
        <Card title="Calendario aprobado">
          <div className="grid gap-3 md:grid-cols-2">{calendario.map((item) => <article key={item.id} className={`rounded-2xl border p-4 ${item.advertenciaCobertura ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}><div className="flex items-center justify-between gap-2"><b>{item.colaborador?.nombre}</b><Status value={item.estadoTemporal} /></div><div className="mt-2 text-sm">{item.fechaInicio} → {item.fechaFin}</div><div className="text-xs text-slate-500">{item.agencia?.nombre} · reincorpora {item.fechaReincorporacion}</div>{item.advertenciaCobertura && <p className="mt-2 text-xs font-bold text-amber-800">Revisar coincidencia de cobertura.</p>}</article>)}{!calendario.length && <p className="text-sm text-slate-500">No hay vacaciones aprobadas en el rango.</p>}</div>
        </Card>
      </div>
      <Card title="Solicitudes e historial">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500">{["Colaborador", "Unidad", "Fechas", "Días", "Estado", "Acciones"].map((h) => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{solicitudes.map((item) => <tr key={item.id} className="border-b"><td className="p-2 font-bold">{item.colaborador?.nombre}<div className="text-xs font-normal text-slate-500">#{item.id} · {item.estadoTemporal}</div></td><td className="p-2">{item.agencia?.nombre}</td><td className="p-2">{item.fechaInicio}<br />{item.fechaFin}</td><td className="p-2">{number(item.cantidadDias)}</td><td className="p-2"><Status value={item.estado} /></td><td className="p-2"><div className="flex flex-wrap gap-1">{item.estado === "PENDIENTE" && <><button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white" onClick={() => decision(item.id, "aprobar")}>Aprobar</button><button className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white" onClick={() => decision(item.id, "rechazar")}>Rechazar</button></>}{["PENDIENTE", "APROBADA"].includes(item.estado) && <button className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-bold text-white" onClick={() => decision(item.id, "cancelar")}>Cancelar</button>}</div></td></tr>)}</tbody></table></div>
      </Card>
    </div>}

    {tab === "pagos" && <div className="grid gap-6 xl:grid-cols-[.65fr_1.35fr]">
      <Card title="Documentar concepto de pago">
        <form onSubmit={savePayment} className="space-y-3">
          <select className={inputClass} value={pagoForm.concepto} onChange={(e) => setPagoForm({ ...pagoForm, concepto: e.target.value })}><option value="REMUNERACION_DESCANSO">Remuneración durante descanso (no consume)</option><option value="COMPENSACION_ANTIGUEDAD">Compensación de adicionales por antigüedad</option><option value="LIQUIDACION_TERMINACION">Liquidación por terminación</option><option value="HISTORICO_REVISION">Pago histórico para revisión (no extingue)</option></select>
          <textarea required className={inputClass} placeholder="Fundamento legal y documental" value={pagoForm.fundamento} onChange={(e) => setPagoForm({ ...pagoForm, fundamento: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><input className={inputClass} type="number" min="0" step=".01" placeholder="Días" value={pagoForm.dias} onChange={(e) => setPagoForm({ ...pagoForm, dias: e.target.value })} /><input required className={inputClass} type="number" min="0" step=".01" placeholder="Monto USD" value={pagoForm.monto} onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })} /></div>
          <input className={inputClass} type="number" min="0" step=".01" placeholder="Base de cálculo documentada (no se infiere salario)" value={pagoForm.baseCalculo} onChange={(e) => setPagoForm({ ...pagoForm, baseCalculo: e.target.value })} />
          {["COMPENSACION_ANTIGUEDAD", "LIQUIDACION_TERMINACION"].includes(pagoForm.concepto) && <div className="space-y-2 rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold">Distribución por períodos</p>{periodos.filter((p) => Number(p.disponibles) > 0).map((p) => <label key={`pago-${p.id}`} className="grid grid-cols-[1fr_95px] items-center gap-2 text-xs"><span>{p.fechaInicio} · disp. {number(p.disponibles)}{pagoForm.concepto === "COMPENSACION_ANTIGUEDAD" ? ` · adicional ${number(p.adicionalesDisponibles)}` : ""}</span><input className={inputClass} type="number" min="0" step=".01" value={asignaciones[p.id] || ""} onChange={(e) => setAsignaciones({ ...asignaciones, [p.id]: e.target.value })} /></label>)}</div>}
          <textarea className={inputClass} placeholder="Soporte / ruta / referencia documental" value={pagoForm.soporte} onChange={(e) => setPagoForm({ ...pagoForm, soporte: e.target.value })} />
          <p className="rounded-xl bg-red-50 p-3 text-xs text-red-800">El módulo no realiza transferencias ni inventa salarios. Las vacaciones ordinarias de personal activo no son libremente sustituibles por dinero.</p>
          <button disabled={loading || !usuarioId} className={buttonClass}>Crear pendiente de pago</button>
        </form>
      </Card>
      <Card title="Pagos y reversiones">
        <div className="space-y-3">{pagos.map((payment) => <article key={payment.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{payment.colaborador?.nombre}</b><div className="text-xs text-slate-500">#{payment.id} · {payment.concepto.replaceAll("_", " ")}</div></div><div className="flex items-center gap-3"><b>{money(payment.monto)}</b><Status value={payment.estado} /></div></div><p className="mt-2 text-sm text-slate-600">{payment.fundamento}</p><div className="mt-3 flex gap-2">{payment.estado === "PENDIENTE_PAGO" && !payment.fechaAprobacion && <button className={buttonClass} onClick={() => paymentAction(payment, "aprobar")}>Aprobar reserva</button>}{payment.estado === "PENDIENTE_PAGO" && payment.fechaAprobacion && <button className={buttonClass} onClick={() => paymentAction(payment, "confirmar")}>Confirmar pagado</button>}{payment.estado !== "ANULADO" && <button className="rounded-xl border px-3 py-2 text-sm font-bold" onClick={() => paymentAction(payment, "anular")}>Anular / revertir</button>}</div></article>)}{!pagos.length && <p className="text-sm text-slate-500">No hay pagos documentados para el filtro.</p>}</div>
      </Card>
    </div>}
  </div>;
}
