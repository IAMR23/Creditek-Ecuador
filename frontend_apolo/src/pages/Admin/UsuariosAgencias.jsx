import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

export default function UsuariosAgencias() {
  const [usuarios, setUsuarios] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [relaciones, setRelaciones] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    usuarioId: "",
    agenciaId: "",
    activo: true,
  });

  const cargar = async () => {
    const [u, a, r] = await Promise.all([
      api.get("/usuarios"),
      api.get("/agencias"),
      api.get("/usuario-agencia"),
    ]);
    setUsuarios(u.data);
    setAgencias(a.data);
    setRelaciones(r.data);
  };

  useEffect(() => {
    cargar();
  }, []);

  const usuariosById = useMemo(() => {
    const map = new Map();
    usuarios.forEach((u) => map.set(String(u.id), u));
    return map;
  }, [usuarios]);

  const agenciasById = useMemo(() => {
    const map = new Map();
    agencias.forEach((a) => map.set(String(a.id), a));
    return map;
  }, [agencias]);

  const crear = async (e) => {
    e.preventDefault();
    if (!form.usuarioId || !form.agenciaId) {
      return Swal.fire({
        icon: "warning",
        title: "Campos requeridos",
        text: "Selecciona usuario y agencia.",
      });
    }
    try {
      setLoading(true);
      await api.post("/usuario-agencia", {
        usuarioId: Number(form.usuarioId),
        agenciaId: Number(form.agenciaId),
        activo: form.activo,
      });
      setForm({ usuarioId: "", agenciaId: "", activo: true });
      await cargar();
      Swal.fire({
        icon: "success",
        title: "Relación creada",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "No se pudo crear la relación",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActivo = async (rel) => {
    try {
      await api.put(`/usuario-agencia/${rel.id}`, { activo: !rel.activo });
      await cargar();
    } catch {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar la relación",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
          Usuarios ↔ Agencias
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Crea y administra la relación entre usuarios y agencias.
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm rounded-2xl p-6 mb-8 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-950 mb-5">Crear relación</h2>
        <form onSubmit={crear} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.usuarioId}
            onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
          >
            <option value="">Usuario</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.email})
              </option>
            ))}
          </select>

          <select
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.agenciaId}
            onChange={(e) => setForm({ ...form, agenciaId: e.target.value })}
          >
            <option value="">Agencia</option>
            {agencias.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>

          <select
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={String(form.activo)}
            onChange={(e) => setForm({ ...form, activo: e.target.value === "true" })}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="md:col-span-3 bg-slate-950 hover:bg-slate-900 disabled:bg-slate-700 text-white p-3 rounded-xl font-semibold"
          >
            {loading ? "Creando..." : "Crear Relación"}
          </button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm rounded-2xl p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-950 mb-4">Relaciones</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950 text-white">
                <th className="p-3 text-left">ID</th>
                <th className="p-3 text-left">Usuario</th>
                <th className="p-3 text-left">Agencia</th>
                <th className="p-3 text-left">Activo</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {relaciones.map((rel) => {
                const u = rel.usuario || usuariosById.get(String(rel.usuarioId));
                const a = rel.agencia || agenciasById.get(String(rel.agenciaId));
                return (
                  <tr key={rel.id} className="border-b border-slate-200 hover:bg-white">
                    <td className="p-3">{rel.id}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-950">{u?.nombre || "-"}</div>
                      <div className="text-xs text-slate-500">{u?.email || ""}</div>
                    </td>
                    <td className="p-3">{a?.nombre || "-"}</td>
                    <td className="p-3">{rel.activo ? "Sí" : "No"}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleActivo(rel)}
                        className="px-4 py-2 rounded-xl font-semibold border border-slate-200 hover:bg-slate-50"
                      >
                        {rel.activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {relaciones.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-slate-500">
                    No hay relaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

