import { useEffect, useState } from "react";
import api from "../../api/client";

const nuevaClaveOperacion = () =>
  globalThis.crypto?.randomUUID?.() ||
  `usuario-agencia-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function UsuarioAgencia() {
  const [usuarios, setUsuarios] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [relaciones, setRelaciones] = useState([]);
  const [repartidores, setRepartidores] = useState([]);

  const [filtro, setFiltro] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    usuarioId: "",
    agenciaId: "",
    activo: true,
    responsableDestinoId: "",
    motivo: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  // ================================
  // CARGA INICIAL
  // ================================
  useEffect(() => {
    cargarDatos();

    const filtroGuardado = localStorage.getItem("filtroUsuarioAgencia");
    if (filtroGuardado) setFiltro(filtroGuardado);
  }, []);

  useEffect(() => {
    localStorage.setItem("filtroUsuarioAgencia", filtro);
  }, [filtro]);

  const cargarDatos = async () => {
    try {
      setLoading(true);

      const [u, a, r, repartidoresRes] = await Promise.all([
        api.get("/usuarios"),
        api.get("/agencias"),
        api.get("/usuario-agencia"),
        api.get("/api/usuario-permisos/usuarios-repartidores"),
      ]);

      setUsuarios(u.data);
      setAgencias(a.data);
      setRelaciones(r.data);
      setRepartidores(repartidoresRes.data);
    } catch {
      setError("Error cargando datos");
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // FILTRO
  // ================================
  const relacionesFiltradas = relaciones.filter((r) => {
    const texto = filtro.toLowerCase();

    return (
      r.usuario?.nombre?.toLowerCase().includes(texto) ||
      r.agencia?.nombre?.toLowerCase().includes(texto)
    );
  });

  // ================================
  // INPUTS
  // ================================
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  // ================================
  // GUARDAR
  // ================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.usuarioId || !form.agenciaId) {
      setError("Selecciona usuario y agencia");
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        await api.put(`/usuario-agencia/${editingId}`, {
          ...form,
          responsableDestinoId: form.responsableDestinoId
            ? Number(form.responsableDestinoId)
            : null,
          idempotencyKey: nuevaClaveOperacion(),
        });
      } else {
        await api.post("/usuario-agencia", form);
      }

      await cargarDatos();

      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      usuarioId: "",
      agenciaId: "",
      activo: true,
      responsableDestinoId: "",
      motivo: "",
    });
    setEditingId(null);
  };

  // ================================
  // EDITAR
  // ================================
  const handleEdit = (rel) => {
    setEditingId(rel.id);

    setForm({
      usuarioId: rel.usuario?.id || "",
      agenciaId: rel.agencia?.id || "",
      activo: rel.activo,
      responsableDestinoId: "",
      motivo: "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ================================
  // ELIMINAR
  // ================================
  const handleDelete = async (id) => {
    const confirmacion = window.confirm(
      "¿Seguro que deseas desactivar esta relación? Si tiene entregas abiertas, la operación será bloqueada hasta elegir un responsable de destino."
    );

    if (!confirmacion) return;

    try {
      await api.put(`/usuario-agencia/${id}`, {
        activo: false,
        motivo: "Desactivación administrativa",
        idempotencyKey: nuevaClaveOperacion(),
      });
      cargarDatos();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo desactivar");
      const relacion = relaciones.find((item) => item.id === id);
      if (relacion) handleEdit({ ...relacion, activo: false });
    }
  };

  return (
    <div className="p-6 space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">
          Usuarios ↔ Agencias
        </h1>

        <span className="text-sm text-gray-500">
          {relacionesFiltradas.length} registros
        </span>
      </div>

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow rounded-xl p-6 grid md:grid-cols-3 gap-4 border"
      >
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded col-span-3">
            {error}
          </div>
        )}

        {/* USUARIO */}
        <div>
          <label className="text-sm font-semibold">Usuario</label>

          <select
            name="usuarioId"
            value={form.usuarioId}
            onChange={handleChange}
            disabled={Boolean(editingId)}
            className="border p-2 rounded w-full mt-1"
          >
            <option value="">Seleccionar usuario</option>

            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* AGENCIA */}
        <div>
          <label className="text-sm font-semibold">Agencia</label>

          <select
            name="agenciaId"
            value={form.agenciaId}
            onChange={handleChange}
            disabled={Boolean(editingId)}
            className="border p-2 rounded w-full mt-1"
          >
            <option value="">Seleccionar agencia</option>

            {agencias.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} — {a.ciudad}
              </option>
            ))}
          </select>
        </div>

        {/* ACTIVO */}
        <div className="flex items-center gap-3 mt-6">
          <input
            type="checkbox"
            name="activo"
            checked={form.activo}
            onChange={handleChange}
            className="w-5 h-5"
          />

          <span className="font-medium">Activo</span>
        </div>

        {editingId && !form.activo && (
          <>
            <div>
              <label className="text-sm font-semibold">Transferir entregas abiertas a</label>
              <select
                name="responsableDestinoId"
                value={form.responsableDestinoId}
                onChange={handleChange}
                className="border p-2 rounded w-full mt-1"
              >
                <option value="">Sin transferencia (solo si no tiene abiertas)</option>
                {repartidores
                  .filter((item) => Number(item.id) !== Number(editingId))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.usuario?.nombre} — {item.agencia?.nombre}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-semibold">Motivo de desactivación/transferencia</label>
              <input
                name="motivo"
                value={form.motivo}
                onChange={handleChange}
                required
                className="border p-2 rounded w-full mt-1"
              />
            </div>
          </>
        )}

        {/* BOTONES */}
        <div className="col-span-3 flex gap-3 mt-2">
          <button
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            {editingId ? "Actualizar relación" : "Crear relación"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* BUSCADOR */}
      <div className="flex justify-between items-center">

        <input
          type="text"
          placeholder="Buscar usuario o agencia..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="border rounded p-2 w-full md:w-80"
        />

        {loading && (
          <span className="text-gray-500 text-sm">
            Cargando...
          </span>
        )}
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto">

        <table className="w-full bg-white shadow rounded-xl overflow-hidden">

          <thead className="bg-green-500 text-white">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th className="p-3 text-left">Usuario</th>
              <th className="p-3 text-left">Agencia</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>

            {relacionesFiltradas.map((r) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">

                <td className="p-3">{r.id}</td>

                <td className="p-3 font-medium">
                  {r.usuario?.nombre}
                </td>

                <td className="p-3">
                  {r.agencia?.nombre}
                </td>

                <td className="p-3">

                  <span
                    className={`px-2 py-1 text-xs rounded font-semibold ${
                      r.activo
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.activo ? "Activo" : "Inactivo"}
                  </span>

                </td>

                <td className="p-3 flex gap-2">

                  <button
                    onClick={() => handleEdit(r)}
                    className="bg-yellow-400 px-3 py-1 rounded hover:bg-yellow-500"
                  >
                    Editar
                  </button>

                  <button
                    onClick={() => handleDelete(r.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Desactivar
                  </button>

                </td>

              </tr>
            ))}

            {relacionesFiltradas.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center p-6 text-gray-500">
                  No se encontraron resultados
                </td>
              </tr>
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}
