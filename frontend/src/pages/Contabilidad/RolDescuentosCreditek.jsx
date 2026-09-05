import { useEffect, useMemo, useState } from "react";
import { Archive, FileSpreadsheet, Pencil, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, X } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import { agruparDescuentos, colorCuota, crearExcelDescuentos, ESTADOS_DESCUENTOS, MESES_DESCUENTOS, mesesDesde, totalesDescuentos } from "../../utils/rolDescuentosCreditek";

const ENDPOINT = "/api/contabilidad/rol-descuentos-creditek";
const moneda = (valor) => Number(valor || 0).toLocaleString("es-EC", { style: "currency", currency: "USD" });
const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export default function RolDescuentosCreditek() {
  const [inicio, setInicio] = useState(`${new Date().getFullYear()}-03`);
  const [cantidad, setCantidad] = useState(15);
  const [archivados, setArchivados] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [datos, setDatos] = useState({ registros: [], usuarios: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [errorEditor, setErrorEditor] = useState("");
  const [plan, setPlan] = useState({ inicio: "", cantidad: 1, valor: "" });
  const meses = useMemo(() => mesesDesde(inicio, cantidad), [inicio, cantidad]);
  const fin = meses.at(-1)?.key;

  useEffect(() => {
    if (!inicio || !fin) { setLoading(false); setDatos({ registros: [], usuarios: [] }); return; }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api.get(ENDPOINT, { params: { inicio, fin, archivados }, signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setDatos(data); })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.response?.data?.message || "No se pudo cargar el rol de descuentos");
          setDatos({ registros: [], usuarios: [] });
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [inicio, fin, archivados, revision]);

  const grupos = useMemo(() => agruparDescuentos(datos.registros, busqueda), [datos.registros, busqueda]);
  const totales = useMemo(() => totalesDescuentos(grupos, meses), [grupos, meses]);
  const abrirEditor = (fila = null) => {
    setEditor(fila ? { id: fila.id, usuarioId: fila.usuarioId, motivo: fila.motivo, version: fila.version, cuotas: fila.cuotas.map((cuota) => ({ ...cuota })) }
      : { usuarioId: "", motivo: "", cuotas: [] });
    setPlan({ inicio, cantidad: 1, valor: "" });
    setErrorEditor("");
  };
  const agregarCuotas = () => {
    const valor = Number(plan.valor);
    const numero = Number(plan.cantidad);
    if (!plan.inicio || !Number.isInteger(numero) || numero < 1 || numero > 120 || !Number.isFinite(valor) || valor <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(plan.valor))) {
      setErrorEditor("Ingrese un mes, de 1 a 120 cuotas y un valor positivo con hasta dos decimales"); return;
    }
    const nuevas = mesesDesde(plan.inicio, numero).filter((mes) => !editor.cuotas.some((cuota) => cuota.periodo === mes.key))
      .map((mes) => ({ periodo: mes.key, valor, estado: "PENDIENTE" }));
    if (nuevas.some((cuota) => cuota.periodo < "2000-01" || cuota.periodo > "2100-12")) { setErrorEditor("Las cuotas deben quedar entre enero de 2000 y diciembre de 2100"); return; }
    if (!nuevas.length) { setErrorEditor("Esos meses ya tienen cuota. Puede editar sus valores abajo"); return; }
    if (editor.cuotas.length + nuevas.length > 120) { setErrorEditor("El motivo admite hasta 120 cuotas"); return; }
    setEditor({ ...editor, cuotas: [...editor.cuotas, ...nuevas].sort((a, b) => a.periodo.localeCompare(b.periodo)) });
    setErrorEditor("");
  };
  const editarCuota = (index, campo, value) => setEditor((actual) => ({ ...actual, cuotas: actual.cuotas.map((cuota, i) => i === index ? { ...cuota, [campo]: value } : cuota) }));
  const guardar = async (event) => {
    event.preventDefault();
    if (!editor.cuotas.length) { setErrorEditor("Agregue al menos una cuota mensual"); return; }
    setGuardando(true);
    setErrorEditor("");
    try {
      if (editor.id) await api.put(`${ENDPOINT}/${editor.id}`, editor);
      else await api.post(ENDPOINT, editor);
      setEditor(null);
      setRevision((value) => value + 1);
      Swal.fire({ icon: "success", title: "Descuento guardado", timer: 1400, showConfirmButton: false });
    } catch (err) { setErrorEditor(err.response?.data?.message || "No se pudo guardar el descuento"); }
    finally { setGuardando(false); }
  };
  const cambiarEstado = async (fila) => {
    const respuesta = await Swal.fire({ title: fila.activo ? "¿Archivar este motivo?" : "¿Restaurar este motivo?", text: `${fila.usuario?.nombre}: ${fila.motivo}`, icon: "question", showCancelButton: true, confirmButtonText: fila.activo ? "Archivar" : "Restaurar", cancelButtonText: "Cancelar" });
    if (!respuesta.isConfirmed) return;
    setGuardando(true);
    try {
      await api.patch(`${ENDPOINT}/${fila.id}/estado`, { activo: !fila.activo, version: fila.version });
      setRevision((value) => value + 1);
    } catch (err) { Swal.fire("Error", err.response?.data?.message || "No se pudo cambiar el estado", "error"); }
    finally { setGuardando(false); }
  };
  const exportar = async () => {
    setExportando(true);
    try {
      const workbook = await crearExcelDescuentos(grupos, meses);
      const blob = new Blob([await workbook.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rol-descuentos-creditek-${inicio}-${fin}${archivados ? "-archivados" : ""}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { Swal.fire("Error", "No se pudo exportar el Excel", "error"); }
    finally { setExportando(false); }
  };
  const usuariosEditor = datos.usuarios.some((usuario) => Number(usuario.id) === Number(editor?.usuarioId)) || !editor?.id
    ? datos.usuarios
    : [...datos.usuarios, datos.registros.find((fila) => fila.id === editor.id)?.usuario].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><h1 className="text-2xl font-bold text-slate-900">Rol de descuentos Creditek</h1><p className="mt-1 text-sm text-slate-500">Motivos y cuotas mensuales por colaborador.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={loading || guardando || !inicio || !fin} onClick={() => setRevision((v) => v + 1)} className={`${inputClass} flex items-center gap-2 disabled:opacity-50`}><RefreshCw size={16} />Actualizar</button>
            <button type="button" disabled={loading || exportando || !grupos.length} onClick={exportar} className={`${inputClass} flex items-center gap-2 disabled:opacity-50`}><FileSpreadsheet size={16} />{exportando ? "Exportando…" : "Excel"}</button>
            <button type="button" disabled={loading || guardando || !datos.usuarios.length} onClick={() => abrirEditor()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} />Nuevo motivo</button>
          </div>
        </header>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <label className="grid gap-1 text-sm text-slate-600">Desde<input type="month" min="2000-01" max="2100-01" value={inicio} onChange={(e) => setInicio(e.target.value)} className={inputClass} /></label>
          <label className="grid gap-1 text-sm text-slate-600">Meses<select value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className={inputClass}>{[6, 12, 15, 18, 24].map((n) => <option key={n} value={n}>{n} meses</option>)}</select></label>
          <label className="grid gap-1 text-sm text-slate-600">Registros<select value={String(archivados)} onChange={(e) => setArchivados(e.target.value === "true")} className={inputClass}><option value="false">Activos</option><option value="true">Archivados</option></select></label>
          <label className="grid flex-1 gap-1 text-sm text-slate-600">Buscar<div className="flex items-center gap-2"><Search size={16} /><input aria-label="Buscar nombre o motivo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o motivo" className={`${inputClass} w-full min-w-[180px]`} /></div></label>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">{Object.entries(ESTADOS_DESCUENTOS).map(([key, estado]) => <span key={key} className="flex items-center gap-2"><span className="h-3 w-3 border border-slate-400" style={{ backgroundColor: `#${estado.color}` }} />{estado.label}</span>)}<span>Diciembre resaltado en naranja</span></div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
        <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm" aria-busy={loading}>
          <div className="max-h-[70vh] overflow-auto">
            <table style={{ minWidth: 536 + meses.length * 105 }} className="w-full table-fixed border-collapse text-xs text-black">
              <caption className="border-b border-black bg-[#d6cec0] px-4 py-3 text-sm font-bold">ROL DE DESCUENTOS CREDITEK{archivados ? " · ARCHIVADOS" : ""}</caption>
              <colgroup><col style={{ width: 200 }} /><col style={{ width: 240 }} />{meses.map((mes) => <col key={mes.key} />)}<col style={{ width: 96 }} /></colgroup>
              <thead className="sticky top-0 z-30"><tr>
                <th scope="col" className="sticky left-0 z-40 min-w-[200px] border border-slate-500 bg-slate-200 px-3 py-2">NOMBRE</th>
                <th scope="col" className="sticky left-[200px] z-40 min-w-[240px] border border-slate-500 bg-slate-200 px-3 py-2">MOTIVO</th>
                {meses.map((mes) => <th scope="col" key={mes.key} className="min-w-[105px] border border-slate-500 px-2 py-2" style={{ backgroundColor: mes.mes === 11 ? "#fbbf24" : "#e2e8f0" }}>{MESES_DESCUENTOS[mes.mes].toUpperCase()}<span className="block text-[10px] font-normal">{mes.anio}</span></th>)}
                <th scope="col" className="border border-slate-500 bg-slate-200 px-3 py-2">ACCIONES</th>
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={meses.length + 3} className="p-12 text-center text-slate-500">Cargando descuentos…</td></tr>
                  : !grupos.length ? <tr><td colSpan={meses.length + 3} className="p-12 text-center text-slate-500">{error ? "No se pudieron obtener los registros." : "No hay descuentos para este período y filtro."}</td></tr>
                    : grupos.map((grupo) => grupo.filas.map((fila, index) => <tr key={fila.id} className={index === 0 ? "border-t-2 border-black" : ""}>
                      {index === 0 && <th scope="rowgroup" rowSpan={grupo.filas.length} className="sticky left-0 z-20 w-[200px] min-w-[200px] max-w-[200px] border border-slate-500 bg-white px-3 py-2 text-left align-top font-medium italic uppercase">{grupo.nombre}</th>}
                      <th scope="row" className="sticky left-[200px] z-10 min-w-[240px] border border-slate-500 bg-white px-3 py-2 text-left uppercase">{fila.motivo}</th>
                      {meses.map((mes) => { const cuota = fila.cuotasPorMes[mes.key]; return <td key={mes.key} title={cuota ? `${ESTADOS_DESCUENTOS[cuota.estado]?.label}: ${moneda(cuota.valor)}` : "Sin cuota"} className="border border-slate-400 px-2 py-2 text-right tabular-nums" style={{ backgroundColor: `#${colorCuota(cuota, mes.mes)}` }}>{cuota ? moneda(cuota.valor) : ""}</td>; })}
                      <td className="border border-slate-400 px-2 py-1"><div className="flex gap-2"><button type="button" title={`Editar ${fila.motivo} de ${grupo.nombre}`} aria-label={`Editar ${fila.motivo} de ${grupo.nombre}`} disabled={guardando} onClick={() => abrirEditor(fila)} className="rounded p-2 text-blue-700 hover:bg-blue-50"><Pencil size={15} /></button><button type="button" title={fila.activo ? "Archivar motivo" : "Restaurar motivo"} aria-label={`${fila.activo ? "Archivar" : "Restaurar"} ${fila.motivo} de ${grupo.nombre}`} disabled={guardando} onClick={() => cambiarEstado(fila)} className="rounded p-2 text-slate-600 hover:bg-slate-100">{fila.activo ? <Archive size={15} /> : <RotateCcw size={15} />}</button></div></td>
                    </tr>))}
              </tbody>
              {!loading && grupos.length > 0 && <tfoot><tr className="bg-slate-200 font-bold"><th colSpan={2} scope="row" className="border border-slate-500 px-3 py-3 text-left">TOTAL</th>{meses.map((mes) => <td key={mes.key} className="border border-slate-500 px-2 py-3 text-right">{moneda(totales[mes.key])}</td>)}<td className="border border-slate-500" /></tr></tfoot>}
            </table>
          </div>
        </section>
      </div>
      {editor && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
        <form onSubmit={guardar} role="dialog" aria-modal="true" aria-labelledby="titulo-descuento" className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between"><h2 id="titulo-descuento" className="text-xl font-bold">{editor.id ? "Editar motivo" : "Nuevo motivo"}</h2><button type="button" disabled={guardando} onClick={() => setEditor(null)} aria-label="Cerrar editor"><X size={22} /></button></div>
          <fieldset disabled={guardando} className="space-y-4">
            <label className="grid gap-1 text-sm">Colaborador<select required value={editor.usuarioId} disabled={Boolean(editor.id)} onChange={(e) => setEditor({ ...editor, usuarioId: e.target.value })} className={inputClass}><option value="">Seleccione un usuario</option>{usuariosEditor.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}{usuario.activo === false ? " (inactivo)" : ""}</option>)}</select></label>
            <label className="grid gap-1 text-sm">Motivo<input required maxLength={200} value={editor.motivo} onChange={(e) => setEditor({ ...editor, motivo: e.target.value })} placeholder="Ej.: préstamo, lentes, teléfono, multa…" className={inputClass} /></label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="mb-2 text-sm font-semibold">Agregar cuotas mensuales</p><div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs">Primer mes<input type="month" min="2000-01" max="2100-12" value={plan.inicio} onChange={(e) => setPlan({ ...plan, inicio: e.target.value })} className={inputClass} /></label>
              <label className="grid gap-1 text-xs">Cantidad<input type="number" min="1" max="120" value={plan.cantidad} onChange={(e) => setPlan({ ...plan, cantidad: e.target.value })} className={`${inputClass} w-24`} /></label>
              <label className="grid gap-1 text-xs">Valor por cuota ($)<input type="number" min="0.01" max="9999999999.99" step="0.01" value={plan.valor} onChange={(e) => setPlan({ ...plan, valor: e.target.value })} className={`${inputClass} w-36`} /></label>
              <button type="button" onClick={agregarCuotas} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">Agregar cuotas</button>
            </div></div>
            <p className="text-xs text-slate-500">Puede ajustar el valor y estado de cada mes. Los meses ya registrados se conservan.</p>
            <div className="max-h-64 overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>Mes</th><th>Valor ($)</th><th>Estado</th><th><span className="sr-only">Quitar</span></th></tr></thead><tbody>{editor.cuotas.map((cuota, index) => <tr key={cuota.periodo}>
              <td className="py-1">{MESES_DESCUENTOS[Number(cuota.periodo.slice(5)) - 1]} {cuota.periodo.slice(0, 4)}</td>
              <td><input aria-label={`Valor ${cuota.periodo}`} type="number" min="0.01" max="9999999999.99" step="0.01" required value={cuota.valor} onChange={(e) => editarCuota(index, "valor", e.target.value)} className={`${inputClass} w-32`} /></td>
              <td><select aria-label={`Estado ${cuota.periodo}`} value={cuota.estado} onChange={(e) => editarCuota(index, "estado", e.target.value)} className={inputClass}>{Object.entries(ESTADOS_DESCUENTOS).map(([key, estado]) => <option key={key} value={key}>{estado.label}</option>)}</select></td>
              <td><button type="button" aria-label={`Quitar cuota ${cuota.periodo}`} onClick={() => setEditor({ ...editor, cuotas: editor.cuotas.filter((_cuota, i) => i !== index) })} className="p-2 text-red-600"><Trash2 size={16} /></button></td>
            </tr>)}</tbody></table></div>
            {errorEditor && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{errorEditor}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className={inputClass}>Cancelar</button><button type="submit" className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Save size={16} />{guardando ? "Guardando…" : "Guardar"}</button></div>
          </fieldset>
        </form>
      </div>}
    </div>
  );
}
