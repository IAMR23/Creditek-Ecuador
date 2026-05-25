import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    activo: true,
  });

  const cargar = async () => {
    const res = await api.get("/rol");
    setRoles(res.data);
  };

  useEffect(() => {
    cargar();
  }, []);

  const crear = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post("/rol", {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        activo: form.activo,
      });
      setForm({ nombre: "", descripcion: "", activo: true });
      await cargar();
      Swal.fire({ icon: "success", title: "Rol creado", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "No se pudo crear el rol",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActivo = async (rol) => {
    try {
      await api.put(`/rol/${rol.id}`, { activo: !rol.activo });
      await cargar();
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo actualizar el rol" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Roles</h1>
        <p className="text-sm text-slate-500 mt-1">Crea y administra roles.</p>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm rounded-2xl p-6 mb-8 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-950 mb-5">Crear rol</h2>
        <form onSubmit={crear} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Nombre (ej: ADMIN)"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <input
            placeholder="Descripción (opcional)"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />

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
            className="md:col-span-2 bg-slate-950 hover:bg-slate-900 disabled:bg-slate-700 text-white p-3 rounded-xl font-semibold"
          >
            {loading ? "Creando..." : "Crear Rol"}
          </button>
        </form>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm rounded-2xl p-6 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-950 mb-4">Lista</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950 text-white">
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left hidden lg:table-cell">Descripción</th>
                <th className="p-3 text-left">Activo</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-slate-200 hover:bg-white">
                  <td className="p-3 font-semibold text-slate-950">{r.nombre}</td>
                  <td className="p-3 hidden lg:table-cell">{r.descripcion || "-"}</td>
                  <td className="p-3">{r.activo ? "Sí" : "No"}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => toggleActivo(r)}
                      className="px-4 py-2 rounded-xl font-semibold border border-slate-200 hover:bg-slate-50"
                    >
                      {r.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-slate-500">
                    No hay roles.
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

