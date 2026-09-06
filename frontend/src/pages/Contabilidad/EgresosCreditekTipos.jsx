/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { api } from "../../api/client";

export default function EgresosCreditekTipos({ seccion, onClose, onActualizados, onCreado }) {
  const [tipos, setTipos] = useState([]);
  const [nombres, setNombres] = useState({});
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/contabilidad/egresos-creditek/${seccion}/tipos`;

  useEffect(() => {
    let vigente = true;
    api.get(endpoint).then(({ data }) => {
      if (vigente) setTipos(data.tipos || []);
    }).catch((e) => {
      if (vigente) setError(e.response?.data?.message || "No se pudieron cargar los tipos");
    }).finally(() => { if (vigente) setLoading(false); });
    return () => { vigente = false; };
  }, [endpoint]);

  useEffect(() => {
    const keydown = (event) => { if (event.key === "Escape" && !saving) { event.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", keydown, true);
    return () => document.removeEventListener("keydown", keydown, true);
  }, [onClose, saving]);

  const guardar = async (tipo, cambios) => {
    setSaving(true);
    setError("");
    try {
      const { data } = tipo
        ? cambios.activo === false
          ? await api.delete(`${endpoint}/${tipo.id}`)
          : await api.put(`${endpoint}/${tipo.id}`, cambios)
        : await api.post(endpoint, { nombre });
      const siguientes = tipo ? tipos.map((item) => item.id === tipo.id ? data.tipo : item) : [...tipos, data.tipo];
      siguientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setTipos(siguientes);
      setNombres((actuales) => {
        const siguientesNombres = { ...actuales };
        delete siguientesNombres[data.tipo.id];
        return siguientesNombres;
      });
      onActualizados(siguientes);
      if (!tipo) { setNombre(""); onCreado(data.tipo.codigo); }
    } catch (e) { setError(e.response?.data?.message || "No se pudo guardar el tipo"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="tipos-egresos-titulo" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 id="tipos-egresos-titulo" className="font-bold text-slate-900">Tipos de {seccion === "prestamos" ? "préstamo" : "anticipo"}</h2>
          <button type="button" aria-label="Cerrar catálogo" onClick={onClose} disabled={saving} className="rounded p-2 hover:bg-slate-100 disabled:opacity-50"><X size={20} /></button>
        </header>
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-600">Crea o cambia nombres desde aquí. Desactivar un tipo conserva sus registros anteriores y sus descuentos.</p>
          {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <form onSubmit={(e) => { e.preventDefault(); guardar(null); }} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold text-slate-700">Nuevo tipo
              <input autoFocus required maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={loading || saving}
                placeholder="Nombre del tipo" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <button type="submit" disabled={loading || saving || !nombre.trim()} className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} />Crear tipo</button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50"><tr><th className="p-2">Nombre</th><th className="p-2">Estado</th><th className="p-2">Acciones</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={3} className="p-8 text-center">Cargando tipos...</td></tr> : tipos.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-slate-500">No hay tipos registrados.</td></tr> : tipos.map((tipo) => (
                  <tr key={tipo.id} className="border-t border-slate-200">
                    <td className="p-2"><input aria-label={`Nombre de ${tipo.nombre}`} maxLength={100} disabled={saving} value={nombres[tipo.id] ?? tipo.nombre}
                      onChange={(e) => setNombres((actuales) => ({ ...actuales, [tipo.id]: e.target.value }))} className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1.5" /></td>
                    <td className="p-2">{tipo.activo ? "Activo" : "Inactivo"}</td>
                    <td className="p-2"><div className="flex gap-2">
                      <button type="button" disabled={saving || !nombres[tipo.id]?.trim() || nombres[tipo.id] === tipo.nombre} onClick={() => guardar(tipo, { nombre: nombres[tipo.id] })} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1.5 disabled:opacity-40"><Save size={14} />Guardar</button>
                      <button type="button" disabled={saving} onClick={() => guardar(tipo, { activo: !tipo.activo })} className="rounded border border-slate-300 px-2 py-1.5 disabled:opacity-40">{tipo.activo ? "Desactivar" : "Reactivar"}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end"><button type="button" onClick={onClose} disabled={saving} className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Volver al registro</button></div>
        </div>
      </section>
    </div>
  );
}
