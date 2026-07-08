import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  BadgeDollarSign,
  Filter,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash,
  X,
} from "lucide-react";
import { api } from "../../api/client";

const ENDPOINT = "/api/contabilidad/roles-pago";

const emptyFilters = {
  nivel: "",
  cargo: "",
  activo: "true",
};

const emptyForm = {
  nivel: "",
  cargo: "",
  descripcion: "",
  sueldoBase: "",
  sueldoExtra: "",
  comisiones: "",
  ingresoMin: "",
  ingresoMax: "",
  activo: true,
};

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const toMoney = (value) => moneyFormatter.format(Number(value || 0));

const getTotal = (rol) =>
  Number((Number(rol.sueldoBase || 0) + Number(rol.sueldoExtra || 0)).toFixed(2));

const getIngreso = (rol) => {
  if (rol.ingresoMin === null || rol.ingresoMin === undefined) return "-";
  if (rol.ingresoMax === null || rol.ingresoMax === undefined) return "-";
  return `${toMoney(rol.ingresoMin)} - ${toMoney(rol.ingresoMax)}`;
};

export default function RolesPago() {
  const [roles, setRoles] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const niveles = useMemo(
    () => [...new Set(roles.map((rol) => rol.nivel).filter(Boolean))].sort(),
    [roles],
  );

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(ENDPOINT, {
        params: Object.fromEntries(
          Object.entries(filters).filter(([, value]) => String(value || "").trim()),
        ),
      });
      setRoles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando roles de pago", error);
      Swal.fire("Error", "No se pudieron cargar los roles de pago", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (rol) => {
    setEditing(rol);
    setForm({
      nivel: rol.nivel || "",
      cargo: rol.cargo || "",
      descripcion: rol.descripcion || "",
      sueldoBase: rol.sueldoBase ?? "",
      sueldoExtra: rol.sueldoExtra ?? "",
      comisiones: rol.comisiones || "",
      ingresoMin: rol.ingresoMin ?? "",
      ingresoMax: rol.ingresoMax ?? "",
      activo: Boolean(rol.activo),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        comisiones: form.comisiones.trim() || null,
      };

      if (editing) {
        await api.put(`${ENDPOINT}/${editing.id}`, payload);
      } else {
        await api.post(ENDPOINT, payload);
      }

      Swal.fire("Listo", "Rol de pago guardado correctamente", "success");
      closeModal();
      fetchRoles();
    } catch (error) {
      console.error("Error guardando rol de pago", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar el rol de pago",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rol) => {
    const result = await Swal.fire({
      title: "Desactivar rol de pago",
      text: rol.cargo,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Desactivar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`${ENDPOINT}/${rol.id}`);
      Swal.fire("Desactivado", "El rol de pago fue desactivado", "success");
      fetchRoles();
    } catch (error) {
      console.error("Error desactivando rol de pago", error);
      Swal.fire("Error", "No se pudo desactivar el rol de pago", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <BadgeDollarSign size={18} />
                Niveles Jerárquicos
              </div>
             
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Plus size={17} />
              Nuevo rol
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter size={18} />
            Filtros
          </div>
          <div className="grid gap-3 md:grid-cols-[180px_1fr_160px_auto]">
            <select
              value={filters.nivel}
              onChange={(event) => setFilters({ ...filters, nivel: event.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Todos los niveles</option>
              {niveles.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {nivel}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                value={filters.cargo}
                onChange={(event) => setFilters({ ...filters, cargo: event.target.value })}
                placeholder="Buscar cargo"
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={filters.activo}
              onChange={(event) => setFilters({ ...filters, activo: event.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
              <option value="todos">Todos</option>
            </select>

            <button
              type="button"
              onClick={fetchRoles}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              Aplicar
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Nivel</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Descripcion</th>
                  <th className="px-4 py-3">Base</th>
                  <th className="px-4 py-3">Extra</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Comisiones</th>
                  <th className="px-4 py-3">Ingreso aproximado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      Cargando roles de pago...
                    </td>
                  </tr>
                ) : roles.length ? (
                  roles.map((rol) => (
                    <tr key={rol.id} className="align-top transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{rol.nivel}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{rol.cargo}</td>
                      <td className="max-w-[360px] px-4 py-3 text-slate-600">
                        {rol.descripcion || "-"}
                      </td>
                      <td className="px-4 py-3">{toMoney(rol.sueldoBase)}</td>
                      <td className="px-4 py-3">{toMoney(rol.sueldoExtra)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {toMoney(rol.sueldoTotal ?? getTotal(rol))}
                      </td>
                      <td className="max-w-[260px] px-4 py-3">{rol.comisiones || "-"}</td>
                      <td className="px-4 py-3">{getIngreso(rol)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            rol.activo
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {rol.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(rol)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700"
                            title="Editar"
                          >
                            <Pencil size={17} />
                          </button>
                          {rol.activo && (
                            <button
                              type="button"
                              onClick={() => handleDelete(rol)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700"
                              title="Desactivar"
                            >
                              <Trash size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      No hay roles de pago para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editing ? "Editar rol de pago" : "Nuevo rol de pago"}
                </h2>
                <p className="text-sm text-slate-500">
                  El total se calcula como sueldo base mas sueldo extra.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Nivel">
                <input
                  value={form.nivel}
                  onChange={(event) => setForm({ ...form, nivel: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Cargo">
                <input
                  value={form.cargo}
                  onChange={(event) => setForm({ ...form, cargo: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Sueldo base">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sueldoBase}
                  onChange={(event) =>
                    setForm({ ...form, sueldoBase: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Sueldo extra">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sueldoExtra}
                  onChange={(event) =>
                    setForm({ ...form, sueldoExtra: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Ingreso minimo">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ingresoMin}
                  onChange={(event) =>
                    setForm({ ...form, ingresoMin: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Ingreso maximo">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ingresoMax}
                  onChange={(event) =>
                    setForm({ ...form, ingresoMax: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Comisiones" className="sm:col-span-2">
                <textarea
                  rows={2}
                  value={form.comisiones}
                  onChange={(event) => setForm({ ...form, comisiones: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Descripcion" className="sm:col-span-2">
                <textarea
                  rows={4}
                  value={form.descripcion}
                  onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(event) => setForm({ ...form, activo: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                Activo
              </label>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? <RefreshCw className="animate-spin" size={16} /> : null}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, className = "", children }) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
