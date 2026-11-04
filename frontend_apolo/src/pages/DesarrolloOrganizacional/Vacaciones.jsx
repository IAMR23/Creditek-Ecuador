import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
const number = (value) => Number(value || 0).toFixed(2);
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100";
const buttonClass = "rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50";
const errorText = (error) => error.response?.data?.message || error.message || "No se pudo completar la operación.";
const normalizeSearch = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const addDays = (date, days) => {
  const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};
const inclusiveDays = (start, end) => start && end ? Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1 : 0;
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const isoDate = (year, month, day) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function Card({ title, children, className = "" }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}><h2 className="mb-4 text-lg font-black text-slate-900">{title}</h2>{children}</section>;
}

function Status({ value }) {
  const colors = { PENDIENTE: "bg-amber-100 text-amber-800", APROBADA: "bg-emerald-100 text-emerald-800", RECHAZADA: "bg-red-100 text-red-800", CANCELADA: "bg-slate-200 text-slate-700", PAGADO: "bg-emerald-100 text-emerald-800", PENDIENTE_PAGO: "bg-amber-100 text-amber-800", ANULADO: "bg-slate-200 text-slate-700" };
  return <span className={`rounded-full px-2 py-1 text-xs font-extrabold ${colors[value] || "bg-blue-100 text-blue-800"}`}>{String(value || "").replaceAll("_", " ")}</span>;
}

function VacationYearCalendar({ year, usuario, approvedVacations }) {
  const currentDate = today();
  const isInApprovedRange = (date) => approvedVacations.some((item) => item.fechaInicio <= date && item.fechaFin >= date);
  const isUnavailable = (date) => Boolean(
    (usuario?.fechaIngreso && date < usuario.fechaIngreso) ||
    (usuario?.fechaSalida && date > usuario.fechaSalida)
  );

  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {MONTHS.map((monthName, month) => {
      const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const firstDayOffset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
      const cells = [...Array(firstDayOffset).fill(null), ...Array.from({ length: totalDays }, (_, index) => index + 1)];
      return <div key={monthName} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="mb-2 text-center text-sm font-black uppercase tracking-wide text-slate-800">{monthName}</h3>
        <div className="grid grid-cols-7 gap-1">{WEEK_DAYS.map((label, index) => <div key={`${monthName}-${label}-${index}`} className="py-1 text-center text-[10px] font-black text-slate-400">{label}</div>)}
          {cells.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} />;
            const date = isoDate(year, month, day);
            const unavailable = isUnavailable(date);
            const approved = isInApprovedRange(date);
            const rested = approved && date <= currentDate;
            const futureApproved = approved && date > currentDate;
            return <div
              key={date}
              title={unavailable ? "Fuera de la relación laboral" : rested ? "Vacación registrada ya transcurrida" : futureApproved ? "Vacación registrada futura" : "Sin vacaciones registradas"}
              className={`relative aspect-square rounded-lg text-xs font-bold transition ${
                unavailable ? "cursor-not-allowed bg-slate-100 text-slate-300" :
                rested ? "bg-emerald-600 text-white" :
                futureApproved ? "bg-blue-500 text-white" :
                date === currentDate ? "border border-orange-500 text-orange-700" :
                "text-slate-700"
              }`}
            ><span className="flex h-full items-center justify-center">{day}</span></div>;
          })}
        </div>
      </div>;
    })}
  </div>;
}

export default function Vacaciones() {
  const [tab, setTab] = useState("resumen");
  const [catalogos, setCatalogos] = useState({ usuarios: [], agencias: [] });
  const [usuarioId, setUsuarioId] = useState("");
  const [busquedaColaborador, setBusquedaColaborador] = useState("");
  const [mostrarCoincidencias, setMostrarCoincidencias] = useState(false);
  const [agenciaId, setAgenciaId] = useState("");
  const [estado, setEstado] = useState("");
  const [desde, setDesde] = useState(`${today().slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(addDays(`${today().slice(0, 7)}-01`, 41));
  const [periodos, setPeriodos] = useState([]);
  const [periodosPropuestos, setPeriodosPropuestos] = useState([]);
  const [descansos, setDescansos] = useState([]);
  const [anioCalendario, setAnioCalendario] = useState(Number(today().slice(0, 4)));
  const [loading, setLoading] = useState(false);
  const [periodoForm, setPeriodoForm] = useState({ fechaInicio: "", fechaFin: "", fechaInicioVacaciones: "", fechaFinVacaciones: "", fechaReincorporacion: "", diasOrdinarios: 15, diasAdicionales: 0, motivoHistorico: "", observacion: "" });

  const usuario = catalogos.usuarios.find((item) => String(item.id) === String(usuarioId));
  const colaboradoresCoincidentes = useMemo(() => {
    const query = normalizeSearch(busquedaColaborador);
    return catalogos.usuarios
      .filter((item) => !query || normalizeSearch(item.nombre).includes(query))
      .slice(0, 12);
  }, [busquedaColaborador, catalogos.usuarios]);
  const agenciasUsuario = usuario?.agencias || [];
  const diasHistoricosPeriodo = periodoForm.fechaInicioVacaciones && periodoForm.fechaFinVacaciones
    ? inclusiveDays(periodoForm.fechaInicioVacaciones, periodoForm.fechaFinVacaciones)
    : 0;
  const periodoSeleccionado = periodosPropuestos.find((item) => item.fechaInicio === periodoForm.fechaInicio && item.fechaFin === periodoForm.fechaFin);
  const periodoEnFormacion = periodoSeleccionado?.estado === "FORMACION";
  const aniosCumplidos = periodosPropuestos.filter((item) => item.estado === "CUMPLIDO").length;
  const periodosCumplidosPendientes = periodosPropuestos.filter((item) => item.estado === "CUMPLIDO" && !item.registrado).length;
  const diasOrdinariosPorAntiguedad = aniosCumplidos * 15;
  const saldoTotal = useMemo(() => periodos.reduce((acc, item) => {
    for (const key of ["reconocidos", "disfrutados", "comprometidos", "reservadosCompensacion", "compensados", "disponibles"]) acc[key] += Number(item[key] || 0);
    return acc;
  }, { reconocidos: 0, disfrutados: 0, comprometidos: 0, reservadosCompensacion: 0, compensados: 0, disponibles: 0 }), [periodos]);
  const descansosRegistrados = useMemo(() => periodos.flatMap((item) => {
    const movimientos = (item.movimientos || [])
      .filter((movimiento) => movimiento.categoria === "DISFRUTADO" && !movimiento.anuladoAt && movimiento.fechaInicioVacaciones && movimiento.fechaFinVacaciones)
      .map((movimiento) => ({
        id: `movimiento-${movimiento.id}`,
        periodoInicio: item.fechaInicio,
        periodoFin: item.fechaFin,
        fechaInicio: movimiento.fechaInicioVacaciones,
        fechaFin: movimiento.fechaFinVacaciones,
        fechaReincorporacion: movimiento.fechaReincorporacion,
        dias: Number(movimiento.dias || inclusiveDays(movimiento.fechaInicioVacaciones, movimiento.fechaFinVacaciones)),
      }));
    const tieneRegistroEstructurado = movimientos.some((movimiento) => movimiento.fechaInicio === item.fechaInicioVacaciones && movimiento.fechaFin === item.fechaFinVacaciones);
    if (item.fechaInicioVacaciones && item.fechaFinVacaciones && !tieneRegistroEstructurado) movimientos.unshift({
      id: `historico-${item.id}`,
      periodoInicio: item.fechaInicio,
      periodoFin: item.fechaFin,
      fechaInicio: item.fechaInicioVacaciones,
      fechaFin: item.fechaFinVacaciones,
      fechaReincorporacion: item.fechaReincorporacion,
      dias: inclusiveDays(item.fechaInicioVacaciones, item.fechaFinVacaciones),
    });
    return movimientos;
  }).sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)), [periodos]);
  const vacacionesCalendarioVisual = descansosRegistrados;

  const request = async (callback, success) => {
    setLoading(true);
    try { const result = await callback(); if (success) await Swal.fire({ icon: "success", title: success, timer: 1300, showConfirmButton: false }); return result; }
    catch (error) { await Swal.fire("Error", errorText(error), "error"); return null; }
    finally { setLoading(false); }
  };

  const loadCatalogs = async () => {
    const { data } = await api.get("/api/vacaciones/catalogos"); setCatalogos(data);
  };

  const selectCollaborator = (item) => {
    setUsuarioId(String(item.id));
    setBusquedaColaborador(item.nombre || "");
    setMostrarCoincidencias(false);
  };

  const clearCollaborator = () => {
    setUsuarioId("");
    setBusquedaColaborador("");
    setAgenciaId("");
    setMostrarCoincidencias(false);
  };
  const loadData = async () => {
    setLoading(true);
    try {
      if (usuarioId) {
        const balanceResponse = await api.get(`/api/vacaciones/saldos/${usuarioId}`);
        setPeriodos(balanceResponse.data || []);
      }
      const vacationList = await api.get("/api/vacaciones/descansos", { params: { usuarioId: usuarioId || undefined } });
      setDescansos(vacationList.data || []);
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
      const primeraSeleccionable = proposals.data?.propuestas?.find((item) => !item.registrado) || proposals.data?.propuestas?.[0];
      if (primeraSeleccionable) setPeriodoForm((current) => ({
        ...current,
        fechaInicio: primeraSeleccionable.fechaInicio,
        fechaFin: primeraSeleccionable.fechaFin,
        diasOrdinarios: primeraSeleccionable.diasOrdinariosSugeridos,
        diasAdicionales: primeraSeleccionable.diasAdicionalesMaximos,
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
  const savePeriod = async (event) => {
    event.preventDefault();
    const propuesta = periodosPropuestos.find((item) => item.fechaInicio === periodoForm.fechaInicio && item.fechaFin === periodoForm.fechaFin);
    const result = propuesta?.periodoId
      ? await request(() => api.post(`/api/vacaciones/periodos/${propuesta.periodoId}/vacaciones-historicas`, { ...periodoForm, idempotenciaKey: crypto.randomUUID() }), "Vacaciones agregadas al período")
      : await request(() => api.post("/api/vacaciones/periodos", { ...periodoForm, usuarioId: Number(usuarioId) }), "Período registrado");
    if (result) { await Promise.all([loadBalances(), loadData()]); setPeriodoForm((f) => ({ ...f, fechaInicio: "", fechaFin: "", fechaInicioVacaciones: "", fechaFinVacaciones: "", fechaReincorporacion: "", motivoHistorico: "", observacion: "" })); }
  };

  const editVacation = async (item) => {
    const result = await Swal.fire({
      title: `Editar vacaciones de ${item.colaborador?.nombre || "colaborador"}`,
      icon: "warning",
      html: `<label class="swal2-label">Inicio de vacaciones</label><input id="vac-edit-inicio" type="date" value="${item.fechaInicioVacaciones}" class="swal2-input !mx-0 !w-full"><label class="swal2-label">Fin de vacaciones</label><input id="vac-edit-fin" type="date" value="${item.fechaFinVacaciones}" class="swal2-input !mx-0 !w-full"><label class="swal2-label">Reincorporación</label><input id="vac-edit-reincorporacion" type="date" value="${item.fechaReincorporacion}" class="swal2-input !mx-0 !w-full"><textarea id="vac-edit-motivo" class="swal2-textarea !mx-0 !w-full" placeholder="Motivo (opcional)"></textarea>`,
      showCancelButton: true,
      confirmButtonText: "Guardar cambios",
      cancelButtonText: "Cancelar",
      didOpen: () => { document.getElementById("vac-edit-motivo").value = item.motivo || ""; },
      preConfirm: () => {
        const fechaInicioVacaciones = document.getElementById("vac-edit-inicio")?.value;
        const fechaFinVacaciones = document.getElementById("vac-edit-fin")?.value;
        const fechaReincorporacion = document.getElementById("vac-edit-reincorporacion")?.value;
        if (!fechaInicioVacaciones || !fechaFinVacaciones || !fechaReincorporacion) return Swal.showValidationMessage("Complete las tres fechas."), false;
        return { fechaInicioVacaciones, fechaFinVacaciones, fechaReincorporacion, motivoHistorico: document.getElementById("vac-edit-motivo")?.value?.trim() || "", idempotenciaKey: crypto.randomUUID() };
      },
    });
    if (!result.isConfirmed) return;
    const response = await request(() => api.put(`/api/vacaciones/descansos/${item.id}`, result.value), "Vacaciones actualizadas");
    if (response) await Promise.all([loadData(), loadBalances()]);
  };

  const deleteVacation = async (item) => {
    const confirmation = await Swal.fire({
      title: "¿Eliminar este registro de vacaciones?",
      text: `${item.colaborador?.nombre || "Colaborador"}: ${item.fechaInicioVacaciones} al ${item.fechaFinVacaciones}. El saldo será recalculado y el historial se conservará para auditoría.`,
      icon: "warning",
      input: "textarea",
      inputPlaceholder: "Motivo de eliminación (opcional)",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmation.isConfirmed) return;
    const response = await request(() => api.delete(`/api/vacaciones/descansos/${item.id}`, { data: { motivo: confirmation.value?.trim() || "" } }), "Registro eliminado");
    if (response) await Promise.all([loadData(), loadBalances()]);
  };

  return <div className="space-y-6">
    <header className="rounded-3xl border border-orange-200 bg-white p-6 text-slate-900 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[.25em] text-orange-600">Desarrollo Organizacional</p>
      <h1 className="mt-1 text-3xl font-black">Vacaciones</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600">Períodos por aniversario, calendario y saldos auditables de vacaciones.</p>
    </header>

    <Card title="Filtros y colaborador activo">
      <div className="grid gap-3 md:grid-cols-5">
        <div className="relative">
          <div className="relative">
            <input
              className={`${inputClass} pr-10`}
              value={busquedaColaborador}
              placeholder="Buscar colaborador por nombre..."
              autoComplete="off"
              onFocus={() => setMostrarCoincidencias(true)}
              onBlur={() => window.setTimeout(() => setMostrarCoincidencias(false), 150)}
              onChange={(event) => {
                const value = event.target.value;
                setBusquedaColaborador(value);
                setMostrarCoincidencias(true);
                if (!usuario || value !== usuario.nombre) {
                  setUsuarioId("");
                  setAgenciaId("");
                }
              }}
            />
            {(busquedaColaborador || usuarioId) && <button type="button" aria-label="Mostrar todos los colaboradores" title="Mostrar todos" onMouseDown={(event) => event.preventDefault()} onClick={clearCollaborator} className="absolute right-3 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400 hover:text-slate-700">×</button>}
          </div>
          {mostrarCoincidencias && <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={clearCollaborator} className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-orange-700 hover:bg-orange-50">Todos los colaboradores</button>
            {colaboradoresCoincidentes.map((item) => <button type="button" key={item.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectCollaborator(item)} className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 ${String(item.id) === String(usuarioId) ? "bg-orange-50 font-black text-orange-700" : "text-slate-700"}`}>{item.nombre}</button>)}
            {busquedaColaborador && colaboradoresCoincidentes.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">No se encontraron coincidencias.</p>}
          </div>}
        </div>
        <select className={inputClass} value={agenciaId} onChange={(e) => setAgenciaId(e.target.value)}><option value="">Todas las unidades</option>{catalogos.agencias.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.tipo}</option>)}</select>
        <select className={inputClass} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos los estados</option>{["PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA"].map((item) => <option key={item}>{item}</option>)}</select>
        <input className={inputClass} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <input className={inputClass} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      </div>
    </Card>

    <div className="flex flex-wrap gap-2">{[["resumen", "Saldos y períodos"], ["solicitudes", "Solicitudes y calendario"]].map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-black ${tab === key ? "bg-orange-500 text-white" : "bg-white text-slate-700 shadow-sm"}`}>{label}</button>)}</div>

    {usuarioId && <section className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-orange-600">Resumen de vacaciones</p>
          <h2 className="mt-1 text-xl font-black text-slate-900">{usuario?.nombre}</h2>
          <p className="mt-1 text-sm text-slate-600">{aniosCumplidos} año(s) laboral(es) cumplido(s) × 15 días = {number(diasOrdinariosPorAntiguedad)} días ordinarios de referencia.</p>
          {periodosCumplidosPendientes > 0 && <p className="mt-2 text-xs font-bold text-amber-700">Hay {periodosCumplidosPendientes} período(s) cumplido(s) pendiente(s) de registrar para incorporarlos al saldo disponible.</p>}
        </div>
        <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-[420px]">
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-900"><div className="text-xs font-bold uppercase tracking-wide text-orange-700">Días ya tomados</div><div className="mt-1 text-3xl font-black">{number(saldoTotal.disfrutados)}</div></div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Días disponibles</div><div className="mt-1 text-3xl font-black">{number(saldoTotal.disponibles)}</div></div>
        </div>
      </div>
    </section>}

    {tab === "resumen" && <>
      <Card title="Registrar período por aniversario y vacaciones">
          <form onSubmit={savePeriod} className="space-y-3">
            <label className="block text-xs font-bold">Año de servicio desde fecha de ingreso
              <select required className={inputClass} value={periodoForm.fechaInicio && periodoForm.fechaFin ? `${periodoForm.fechaInicio}:${periodoForm.fechaFin}` : ""} onChange={(e) => selectProposedPeriod(e.target.value)}>
                <option value="">Seleccione un período</option>
                {periodosPropuestos.map((item) => <option key={`${item.fechaInicio}-${item.fechaFin}`} value={`${item.fechaInicio}:${item.fechaFin}`}>Año {item.anioServicio}: {item.fechaInicio} – {item.fechaFin} · {item.estado}{item.registrado ? " · EXISTENTE" : ""}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Inicio<input readOnly className={`${inputClass} bg-slate-100`} value={periodoForm.fechaInicio} /></label><label className="text-xs font-bold">Fin<input readOnly className={`${inputClass} bg-slate-100`} value={periodoForm.fechaFin} /></label></div>
            {periodoEnFormacion && <p className="rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800">Este colaborador todavía no cumple el aniversario. Puede registrar sus vacaciones; se reconocerán únicamente los días concedidos como anticipo, no los 15 días completos.</p>}
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
              <h3 className="mb-3 text-sm font-black text-orange-900">Vacaciones disfrutadas en este registro</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-bold">Fecha de inicio de vacaciones<input className={inputClass} type="date" value={periodoForm.fechaInicioVacaciones} onChange={(e) => setPeriodoForm({ ...periodoForm, fechaInicioVacaciones: e.target.value })} /></label>
                <label className="text-xs font-bold">Fecha fin de vacaciones<input className={inputClass} type="date" min={periodoForm.fechaInicioVacaciones || undefined} value={periodoForm.fechaFinVacaciones} onChange={(e) => setPeriodoForm({ ...periodoForm, fechaFinVacaciones: e.target.value })} /></label>
                <label className="text-xs font-bold">Fecha de reincorporación<input className={inputClass} type="date" min={periodoForm.fechaFinVacaciones ? addDays(periodoForm.fechaFinVacaciones, 1) : undefined} value={periodoForm.fechaReincorporacion} onChange={(e) => setPeriodoForm({ ...periodoForm, fechaReincorporacion: e.target.value })} /></label>
              </div>
              <div className="mt-3 rounded-xl bg-white p-3 text-sm"><b>Días tomados:</b> {diasHistoricosPeriodo > 0 ? diasHistoricosPeriodo : 0}</div>
              <p className="mt-2 text-xs text-orange-800">Solo se cuentan las fechas entre el inicio y el fin de vacaciones. La reincorporación se registra aparte y no agrega los días intermedios al descanso.</p>
            </div>
            <textarea className={inputClass} placeholder="Motivo / fuente del histórico" value={periodoForm.motivoHistorico} onChange={(e) => setPeriodoForm({ ...periodoForm, motivoHistorico: e.target.value })} />
            <p className="text-xs text-slate-500">Las fechas se generan desde la fecha de ingreso guardada en Usuarios. Los períodos en formación se registran con cero días reconocidos; los ajustes posteriores son movimientos auditables.</p>
            <button disabled={loading || !usuarioId} className={buttonClass}>Guardar período</button>
          </form>
      </Card>
      <Card title="Listado de vacaciones registradas">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500">{["Colaborador", "Vacaciones", "Reincorporación", "Período de origen", "Días", "Motivo", "Acciones"].map((h) => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{descansos.map((item) => <tr key={item.id} className="border-b"><td className="p-2 font-bold">{item.colaborador?.nombre}</td><td className="p-2">{item.fechaInicioVacaciones}<br />{item.fechaFinVacaciones}</td><td className="p-2">{item.fechaReincorporacion}</td><td className="p-2">{item.periodoInicio}<br />{item.periodoFin}</td><td className="p-2 font-black">{number(item.dias)}</td><td className="max-w-56 p-2 text-slate-600">{item.motivo || "—"}</td><td className="p-2"><div className="flex gap-2"><button type="button" onClick={() => editVacation(item)} className="rounded-lg border border-blue-300 px-3 py-1 text-xs font-bold text-blue-700">Editar</button><button type="button" onClick={() => deleteVacation(item)} className="rounded-lg border border-red-300 px-3 py-1 text-xs font-bold text-red-700">Eliminar</button></div></td></tr>)}{!descansos.length && <tr><td colSpan="7" className="p-8 text-center text-slate-500">No hay vacaciones registradas para el filtro seleccionado.</td></tr>}</tbody></table></div>
      </Card>
    </>}

    {tab === "solicitudes" && <div className="space-y-6">
      <Card title="Calendario visual de vacaciones">
        {!usuarioId ? <p className="text-sm text-slate-500">Seleccione un colaborador para visualizar sus vacaciones registradas.</p> : <>
          <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-bold text-slate-700">Vista informativa de las vacaciones registradas en Saldos y períodos.</p>
              <p className="text-xs text-slate-500">Las fechas no se agregan ni se modifican desde este calendario.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Año anterior" onClick={() => setAnioCalendario((value) => value - 1)} disabled={Boolean(usuario?.fechaIngreso && anioCalendario <= Number(usuario.fechaIngreso.slice(0, 4)))} className="rounded-xl border px-3 py-2 font-black disabled:opacity-30">←</button>
              <span className="min-w-24 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-center text-lg font-black text-orange-800">{anioCalendario}</span>
              <button type="button" aria-label="Año siguiente" onClick={() => setAnioCalendario((value) => value + 1)} disabled={Boolean(usuario?.fechaSalida && anioCalendario >= Number(usuario.fechaSalida.slice(0, 4)))} className="rounded-xl border px-3 py-2 font-black disabled:opacity-30">→</button>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
            <span className="flex items-center gap-2"><i className="h-4 w-4 rounded bg-emerald-600" /> Días ya descansados</span>
            <span className="flex items-center gap-2"><i className="h-4 w-4 rounded bg-blue-500" /> Vacaciones futuras registradas</span>
            <span className="flex items-center gap-2"><i className="h-4 w-4 rounded bg-slate-200" /> Fuera de la relación laboral</span>
          </div>
          <VacationYearCalendar year={anioCalendario} usuario={usuario} approvedVacations={vacacionesCalendarioVisual} />
        </>}
      </Card>
      <Card title="Vacaciones registradas por período">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500">{["Período de servicio", "Inicio de vacaciones", "Fin de vacaciones", "Reincorporación", "Días"].map((h) => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{descansosRegistrados.map((item) => <tr key={item.id} className="border-b"><td className="p-2 font-bold">{item.periodoInicio}<br />{item.periodoFin}</td><td className="p-2">{item.fechaInicio}</td><td className="p-2">{item.fechaFin}</td><td className="p-2">{item.fechaReincorporacion || "—"}</td><td className="p-2 font-black">{number(item.dias)}</td></tr>)}{!descansosRegistrados.length && <tr><td colSpan="5" className="p-8 text-center text-slate-500">No hay vacaciones registradas en Saldos y períodos.</td></tr>}</tbody></table></div>
      </Card>
    </div>}

  </div>;
}
