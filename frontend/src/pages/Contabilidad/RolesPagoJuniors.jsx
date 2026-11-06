import { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, Plus, RefreshCw } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const ENDPOINT = "/api/contabilidad/roles-pago-juniors";

export default function RolesPagoJuniors() {
  const [roles, setRoles] = useState([]);
  const [relaciones, setRelaciones] = useState([]);
  const [cargoRolPagoId, setCargoRolPagoId] = useState("");
  const [juniorRolPagoId, setJuniorRolPagoId] = useState("");
  const [estado, setEstado] = useState("true");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesResponse, relacionesResponse] = await Promise.all([
        api.get("/api/contabilidad/roles-pago", { params: { activo: "true" } }),
        api.get(ENDPOINT, { params: { activo: estado } }),
      ]);
      setRoles(Array.isArray(rolesResponse.data) ? rolesResponse.data : []);
      setRelaciones(Array.isArray(relacionesResponse.data) ? relacionesResponse.data : []);
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "No se pudieron cargar las relaciones de cargos.", "error");
    } finally {
      setLoading(false);
    }
  }, [estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const juniorsDisponibles = useMemo(
    () => roles.filter((rol) => String(rol.id) !== String(cargoRolPagoId)),
    [roles, cargoRolPagoId],
  );

  const relacionesFiltradas = useMemo(() => {
    const query = busqueda.trim().toLocaleLowerCase("es");
    if (!query) return relaciones;
    return relaciones.filter((row) => [row.cargo?.cargo, row.cargo?.nivel, row.junior?.cargo, row.junior?.nivel]
      .some((value) => String(value || "").toLocaleLowerCase("es").includes(query)));
  }, [busqueda, relaciones]);

  const guardar = async (event) => {
    event.preventDefault();
    if (!cargoRolPagoId || !juniorRolPagoId) {
      Swal.fire("Datos incompletos", "Selecciona el cargo principal y el cargo junior.", "warning");
      return;
    }
    setSaving(true);
    try {
      await api.post(ENDPOINT, {
        cargoRolPagoId: Number(cargoRolPagoId),
        juniorRolPagoId: Number(juniorRolPagoId),
      });
      setJuniorRolPagoId("");
      await cargar();
      Swal.fire("Guardado", "La relación entre cargos fue registrada.", "success");
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "No se pudo guardar la relación.", "error");
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstado = async (row) => {
    const activar = !row.activo;
    const confirmacion = await Swal.fire({
      title: activar ? "Activar relación" : "Desactivar relación",
      text: `${row.cargo?.cargo || "Cargo"} → ${row.junior?.cargo || "Junior"}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: activar ? "Activar" : "Desactivar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmacion.isConfirmed) return;
    try {
      await api.patch(`${ENDPOINT}/${row.id}/estado`, { activo: activar });
      await cargar();
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "No se pudo actualizar la relación.", "error");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700">
            <Link2 size={16} /> Contabilidad / Roles Creditek
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Cargos y juniors</h1>
          <p className="mt-1 text-sm text-slate-600">Relaciona cada cargo principal con uno o varios cargos junior.</p>
        </header>

        <form onSubmit={guardar} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="text-sm font-semibold text-slate-700">
              Cargo principal
              <select value={cargoRolPagoId} onChange={(event) => {
                setCargoRolPagoId(event.target.value);
                if (event.target.value === juniorRolPagoId) setJuniorRolPagoId("");
              }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">Seleccione un cargo</option>
                {roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.cargo} · {rol.nivel}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Cargo junior
              <select value={juniorRolPagoId} onChange={(event) => setJuniorRolPagoId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">Seleccione el junior</option>
                {juniorsDisponibles.map((rol) => <option key={rol.id} value={rol.id}>{rol.cargo} · {rol.nivel}</option>)}
              </select>
            </label>
            <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 disabled:opacity-50">
              <Plus size={17} /> {saving ? "Guardando..." : "Agregar relación"}
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-[1fr_180px_auto]">
            <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar cargo o junior" className="rounded-lg border border-slate-300 px-3 py-2" />
            <select value={estado} onChange={(event) => setEstado(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
              <option value="todos">Todas</option>
            </select>
            <button type="button" onClick={cargar} disabled={loading} className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:opacity-50">
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="px-4 py-3">Cargo principal</th>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Cargo junior</th>
                  <th className="px-4 py-3">Nivel junior</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {relacionesFiltradas.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.cargo?.cargo || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.cargo?.nivel || "-"}</td>
                    <td className="px-4 py-3 font-semibold text-sky-800">{row.junior?.cargo || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.junior?.nivel || "-"}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.activo ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{row.activo ? "Activa" : "Inactiva"}</span></td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={() => cambiarEstado(row)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${row.activo ? "border-rose-200 text-rose-700" : "border-emerald-200 text-emerald-700"}`}>{row.activo ? "Desactivar" : "Activar"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && relacionesFiltradas.length === 0 && <p className="p-8 text-center text-slate-500">No hay relaciones para mostrar.</p>}
          {loading && <p className="p-8 text-center text-slate-500">Cargando relaciones...</p>}
        </section>
      </div>
    </main>
  );
}
