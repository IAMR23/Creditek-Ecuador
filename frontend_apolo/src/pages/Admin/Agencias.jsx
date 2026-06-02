import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

export default function Agencias() {
  const [agencias, setAgencias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    ciudad: "",
  });

  const cargar = async () => {
    const res = await api.get("/agencias");
    setAgencias(res.data);
  };

  useEffect(() => {
    cargar();
  }, []);

  const crear = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post("/agencias", { ...form, activo: true });
      setForm({ nombre: "", direccion: "", telefono: "", ciudad: "" });
      await cargar();
      Swal.fire({ icon: "success", title: "Agencia creada", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "No se pudo crear la agencia",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActivo = async (agencia) => {
    try {
      await api.put(`/agencias/${agencia.id}`, { activo: !agencia.activo });
      await cargar();
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudo actualizar la agencia" });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-7">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Agencias</h1>
        <p className="text-sm text-slate-500 mt-1">Crea y administra agencias.</p>
      </div>

      <div className="bg-white/80 backdrop-blur shadow-sm rounded-2xl p-6 mb-8 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-950 mb-5">Crear agencia</h2>
        <form onSubmit={crear} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            placeholder="Nombre"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <input
            placeholder="Ciudad"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
          />
          <input
            placeholder="Teléfono"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
          <input
            placeholder="Dirección"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          />
          <button
            type="submit"
            disabled={loading}
            className="md:col-span-2 bg-slate-950 hover:bg-slate-900 disabled:bg-slate-700 text-white p-3 rounded-xl font-semibold"
          >
            {loading ? "Creando..." : "Crear Agencia"}
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
                <th className="p-3 text-left">Ciudad</th>
                <th className="p-3 text-left hidden lg:table-cell">Teléfono</th>
                <th className="p-3 text-left hidden xl:table-cell">Dirección</th>
                <th className="p-3 text-left">Activo</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agencias.map((a) => (
                <tr key={a.id} className="border-b border-slate-200 hover:bg-white">
                  <td className="p-3">{a.nombre}</td>
                  <td className="p-3">{a.ciudad || "-"}</td>
                  <td className="p-3 hidden lg:table-cell">{a.telefono || "-"}</td>
                  <td className="p-3 hidden xl:table-cell">{a.direccion || "-"}</td>
                  <td className="p-3">{a.activo ? "Sí" : "No"}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => toggleActivo(a)}
                      className="px-4 py-2 rounded-xl font-semibold border border-slate-200 hover:bg-slate-50"
                    >
                      {a.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
              {agencias.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-slate-500">
                    No hay agencias registradas.
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

