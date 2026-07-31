import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { BadgeDollarSign, Pencil, Plus, Save, ShieldMinus, X } from "lucide-react";
import { api } from "../../api/client";

const emptyForm = {
  id: null,
  rolPagoId: "",
  cargoReferencia: "",
  minimoUnidades: 0,
  valorMultaUnidad: 0,
  descripcion: "",
  activo: true,
};

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));
const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("es-EC") : "-";

export default function MetaMinimaMultaConfiguracion() {
  const [configs, setConfigs] = useState([]);
  const [rolesPago, setRolesPago] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const rolesDisponibles = useMemo(() => {
    const used = new Set(
      configs
        .filter((config) => Number(config.id) !== Number(form.id))
        .map((config) => Number(config.rolPagoId)),
    );
    return rolesPago.filter((rol) => !used.has(Number(rol.id)));
  }, [configs, form.id, rolesPago]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [{ data: configData }, { data: rolesData }] = await Promise.all([
        api.get("/api/contabilidad/metas-minimas-multas"),
        api.get("/api/contabilidad/roles-pago", { params: { activo: "true" } }),
      ]);
      setConfigs(configData || []);
      setRolesPago(rolesData || []);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message ||
          "No se pudo cargar la configuracion de meta minima",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const editConfig = (config) => {
    setForm({
      id: config.id,
      rolPagoId: config.rolPagoId,
      cargoReferencia: config.cargoReferencia || config.rolPago?.cargo || "",
      minimoUnidades: config.minimoUnidades,
      valorMultaUnidad: config.valorMultaUnidad,
      descripcion: config.descripcion || "",
      activo: config.activo,
    });
  };

  const resetForm = () => setForm(emptyForm);

  const saveConfig = async () => {
    if (!form.rolPagoId) {
      Swal.fire("Atencion", "Seleccione un rol de pago", "warning");
      return;
    }

    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/api/contabilidad/metas-minimas-multas/${form.id}`, form);
      } else {
        await api.post("/api/contabilidad/metas-minimas-multas", form);
      }
      await cargar();
      resetForm();
      Swal.fire("Listo", "Configuracion guardada correctamente", "success");
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la configuracion",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleEstado = async (config) => {
    try {
      await api.patch(`/api/contabilidad/metas-minimas-multas/${config.id}/estado`, {
        activo: !config.activo,
      });
      await cargar();
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo actualizar el estado",
        "error",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <ShieldMinus size={18} />
                Contabilidad
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Configuracion de meta minima
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Meta semanal sin multa segun el rol de pago.
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Plus size={16} />
              Nueva configuracion
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            {form.id ? "Editar configuracion" : "Agregar configuracion"}
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm font-medium text-slate-700 xl:col-span-2">
              Rol de pago
              <select
                value={form.rolPagoId}
                onChange={(event) => {
                  const rol = rolesPago.find(
                    (item) => String(item.id) === event.target.value,
                  );
                  setForm({
                    ...form,
                    rolPagoId: event.target.value,
                    cargoReferencia: rol?.cargo || form.cargoReferencia,
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Seleccione un rol</option>
                {rolesDisponibles.map((rol) => (
                  <option key={rol.id} value={rol.id}>
                    {rol.cargo}
                  </option>
                ))}
              </select>
            </label>

            <Field
              label="Meta minima semanal"
              type="number"
              value={form.minimoUnidades}
              onChange={(value) => setForm({ ...form, minimoUnidades: value })}
            />
            <Field
              label="Multa por unidad"
              type="number"
              value={form.valorMultaUnidad}
              onChange={(value) => setForm({ ...form, valorMultaUnidad: value })}
            />
            <label className="text-sm font-medium text-slate-700">
              Estado
              <select
                value={form.activo ? "true" : "false"}
                onChange={(event) =>
                  setForm({ ...form, activo: event.target.value === "true" })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700 xl:col-span-4">
              Observacion
              <input
                value={form.descripcion}
                onChange={(event) =>
                  setForm({ ...form, descripcion: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Detalle u observacion"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={saveConfig}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? "Guardando..." : "Guardar"}
              </button>
              {form.id ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
                >
                  <X size={18} />
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-slate-700">
                  <th className="border border-slate-200 px-3 py-2">Rol de pago</th>
                  <th className="border border-slate-200 px-3 py-2">Meta minima semanal</th>
                  <th className="border border-slate-200 px-3 py-2">Multa por unidad</th>
                  <th className="border border-slate-200 px-3 py-2">Estado</th>
                  <th className="border border-slate-200 px-3 py-2">Actualizado por</th>
                  <th className="border border-slate-200 px-3 py-2">Fecha actualizacion</th>
                  <th className="border border-slate-200 px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      Cargando...
                    </td>
                  </tr>
                ) : configs.length ? (
                  configs.map((config) => (
                    <tr key={config.id} className="odd:bg-white even:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                        {config.rolPago?.cargo || config.cargoReferencia}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">{config.minimoUnidades}</td>
                      <td className="border border-slate-200 px-3 py-2">{formatMoney(config.valorMultaUnidad)}</td>
                      <td className="border border-slate-200 px-3 py-2">
                        <span className={`rounded px-2 py-1 text-xs font-bold ${config.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {config.activo ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        {config.actualizadoPor?.nombre || "-"}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        {formatDateTime(config.updatedAt)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editConfig(config)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil size={14} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleEstado(config)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {config.activo ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      No hay configuraciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        min={0}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}
