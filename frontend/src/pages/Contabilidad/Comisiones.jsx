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

const ENDPOINT = "/api/contabilidad/comisiones";

const PERIODOS = [
  { value: "", label: "Todos los periodos" },
  { value: "COMISION_SEMANAL", label: "Comision semanal" },
  { value: "BONO_MENSUAL", label: "Bono mensual" },
  { value: "BONO_MENSUAL_4_SEMANAS", label: "Bono mensual 4 semanas" },
  { value: "BONO_MENSUAL_5_SEMANAS", label: "Bono mensual 5 semanas" },
];

const emptyFilters = {
  grupo: "",
  periodo: "",
  q: "",
  activo: "true",
};

const emptyForm = {
  grupo: "",
  subgrupo: "",
  periodo: "COMISION_SEMANAL",
  unidadesVendidas: "",
  comisionPorEquipo: "",
  porcentaje: "",
  promedioPorVendedor: "",
  bono: "",
  valorAproximado: "",
  notas: "",
  orden: "",
  activo: true,
};

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("es-EC", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const getPeriodoLabel = (periodo) =>
  PERIODOS.find((item) => item.value === periodo)?.label || periodo;

const formatMoney = (value) =>
  value === null || value === undefined || value === ""
    ? "-"
    : moneyFormatter.format(Number(value || 0));

const formatApprox = (value) => {
  if (value === null || value === undefined || value === "") return "-";

  const numericValue = Number(String(value).replace(",", "."));
  return Number.isFinite(numericValue) && String(value).trim() !== ""
    ? formatMoney(numericValue)
    : value;
};

const formatCommission = (row) => {
  if (row.porcentaje !== null && row.porcentaje !== undefined && row.porcentaje !== "") {
    return percentFormatter.format(Number(row.porcentaje));
  }

  return formatMoney(row.comisionPorEquipo);
};

const sortByOrder = (a, b) => {
  const orderA = Number(a.orden || 0);
  const orderB = Number(b.orden || 0);

  if (orderA !== orderB) return orderA - orderB;
  return String(a.unidadesVendidas || a.promedioPorVendedor || "").localeCompare(
    String(b.unidadesVendidas || b.promedioPorVendedor || ""),
    "es",
    { numeric: true },
  );
};

const agruparComisiones = (items) => {
  const gruposMap = new Map();

  items.forEach((row) => {
    const grupo = row.grupo || "Sin grupo";
    const subgrupo = row.subgrupo || "General";

    if (!gruposMap.has(grupo)) {
      gruposMap.set(grupo, {
        grupo,
        minOrden: Number(row.orden || 0),
        bloquesMap: new Map(),
      });
    }

    const grupoData = gruposMap.get(grupo);
    grupoData.minOrden = Math.min(grupoData.minOrden, Number(row.orden || 0));

    if (!grupoData.bloquesMap.has(subgrupo)) {
      grupoData.bloquesMap.set(subgrupo, {
        subgrupo,
        minOrden: Number(row.orden || 0),
        semanales: [],
        bonosMap: new Map(),
      });
    }

    const bloque = grupoData.bloquesMap.get(subgrupo);
    bloque.minOrden = Math.min(bloque.minOrden, Number(row.orden || 0));

    if (row.periodo === "COMISION_SEMANAL") {
      bloque.semanales.push(row);
      return;
    }

    if (!bloque.bonosMap.has(row.periodo)) {
      bloque.bonosMap.set(row.periodo, []);
    }
    bloque.bonosMap.get(row.periodo).push(row);
  });

  return [...gruposMap.values()]
    .sort((a, b) => a.minOrden - b.minOrden || a.grupo.localeCompare(b.grupo))
    .map((grupoData) => ({
      grupo: grupoData.grupo,
      bloques: [...grupoData.bloquesMap.values()]
        .sort((a, b) => a.minOrden - b.minOrden || a.subgrupo.localeCompare(b.subgrupo))
        .map((bloque) => ({
          ...bloque,
          semanales: bloque.semanales.sort(sortByOrder),
          bonos: [...bloque.bonosMap.entries()]
            .map(([periodo, rows]) => ({
              periodo,
              rows: rows.sort(sortByOrder),
            }))
            .sort((a, b) => {
              const firstA = Number(a.rows[0]?.orden || 0);
              const firstB = Number(b.rows[0]?.orden || 0);
              return firstA - firstB || a.periodo.localeCompare(b.periodo);
            }),
        })),
    }));
};

export default function Comisiones() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const grupos = useMemo(
    () => [...new Set(rows.map((row) => row.grupo).filter(Boolean))].sort(),
    [rows],
  );

  const resumen = useMemo(
    () => ({
      registros: rows.length,
      grupos: grupos.length,
      semanales: rows.filter((row) => row.periodo === "COMISION_SEMANAL").length,
      bonos: rows.filter((row) => row.periodo !== "COMISION_SEMANAL").length,
    }),
    [rows, grupos.length],
  );

  const matricesComisiones = useMemo(() => agruparComisiones(rows), [rows]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(ENDPOINT, {
        params: Object.fromEntries(
          Object.entries(filters).filter(([, value]) => String(value || "").trim()),
        ),
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando comisiones", error);
      Swal.fire("Error", "No se pudo cargar la configuracion de comisiones", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      grupo: row.grupo || "",
      subgrupo: row.subgrupo || "",
      periodo: row.periodo || "COMISION_SEMANAL",
      unidadesVendidas: row.unidadesVendidas || "",
      comisionPorEquipo: row.comisionPorEquipo ?? "",
      porcentaje: row.porcentaje ?? "",
      promedioPorVendedor: row.promedioPorVendedor || "",
      bono: row.bono ?? "",
      valorAproximado: row.valorAproximado || "",
      notas: row.notas || "",
      orden: row.orden ?? "",
      activo: Boolean(row.activo),
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
        comisionPorEquipo: form.comisionPorEquipo === "" ? null : form.comisionPorEquipo,
        porcentaje: form.porcentaje === "" ? null : form.porcentaje,
        bono: form.bono === "" ? null : form.bono,
        orden: form.orden === "" ? 0 : form.orden,
      };

      if (editing) {
        await api.put(`${ENDPOINT}/${editing.id}`, payload);
      } else {
        await api.post(ENDPOINT, payload);
      }

      Swal.fire("Listo", "Configuracion guardada correctamente", "success");
      closeModal();
      fetchRows();
    } catch (error) {
      console.error("Error guardando comision", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la configuracion",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: "Desactivar configuracion",
      text: `${row.grupo} - ${getPeriodoLabel(row.periodo)}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Desactivar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`${ENDPOINT}/${row.id}`);
      Swal.fire("Desactivado", "La configuracion fue desactivada", "success");
      fetchRows();
    } catch (error) {
      console.error("Error desactivando comision", error);
      Swal.fire("Error", "No se pudo desactivar la configuracion", "error");
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
                Contabilidad
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Comisiones
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Configuracion de tablas de comisiones y bonos importadas desde la matriz.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Plus size={17} />
              Nueva regla
            </button>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Registros" value={resumen.registros} />
          <Metric label="Grupos" value={resumen.grupos} />
          <Metric label="Semanales" value={resumen.semanales} />
          <Metric label="Bonos" value={resumen.bonos} />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter size={18} />
            Filtros
          </div>
          <div className="grid gap-3 md:grid-cols-[220px_220px_1fr_150px_auto]">
            <select
              value={filters.grupo}
              onChange={(event) => setFilters({ ...filters, grupo: event.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Todos los grupos</option>
              {grupos.map((grupo) => (
                <option key={grupo} value={grupo}>
                  {grupo}
                </option>
              ))}
            </select>

            <select
              value={filters.periodo}
              onChange={(event) =>
                setFilters({ ...filters, periodo: event.target.value })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {PERIODOS.map((periodo) => (
                <option key={periodo.value} value={periodo.value}>
                  {periodo.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                value={filters.q}
                onChange={(event) => setFilters({ ...filters, q: event.target.value })}
                placeholder="Buscar grupo, unidades o notas"
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
              onClick={fetchRows}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              Aplicar
            </button>
          </div>
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
              Cargando configuracion...
            </div>
          ) : matricesComisiones.length ? (
            matricesComisiones.map((grupo) => (
              <ComisionGroup
                key={grupo.grupo}
                grupo={grupo}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
              No hay configuraciones para los filtros seleccionados.
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editing ? "Editar comision" : "Nueva comision"}
                </h2>
                <p className="text-sm text-slate-500">
                  Configura reglas base; el calculo se agregara en una etapa posterior.
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
              <Field label="Grupo">
                <input
                  value={form.grupo}
                  onChange={(event) => setForm({ ...form, grupo: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Subgrupo">
                <input
                  value={form.subgrupo}
                  onChange={(event) =>
                    setForm({ ...form, subgrupo: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Periodo">
                <select
                  value={form.periodo}
                  onChange={(event) => setForm({ ...form, periodo: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {PERIODOS.filter((periodo) => periodo.value).map((periodo) => (
                    <option key={periodo.value} value={periodo.value}>
                      {periodo.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Unidades vendidas">
                <input
                  value={form.unidadesVendidas}
                  onChange={(event) =>
                    setForm({ ...form, unidadesVendidas: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Comision por equipo">
                <input
                  type="number"
                  step="0.0001"
                  value={form.comisionPorEquipo}
                  onChange={(event) =>
                    setForm({ ...form, comisionPorEquipo: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Porcentaje">
                <input
                  type="number"
                  step="0.0001"
                  value={form.porcentaje}
                  onChange={(event) =>
                    setForm({ ...form, porcentaje: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Promedio por vendedor">
                <input
                  value={form.promedioPorVendedor}
                  onChange={(event) =>
                    setForm({ ...form, promedioPorVendedor: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Bono">
                <input
                  type="number"
                  step="0.01"
                  value={form.bono}
                  onChange={(event) => setForm({ ...form, bono: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Valor aproximado">
                <input
                  value={form.valorAproximado}
                  onChange={(event) =>
                    setForm({ ...form, valorAproximado: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Orden">
                <input
                  type="number"
                  value={form.orden}
                  onChange={(event) => setForm({ ...form, orden: event.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Notas" className="sm:col-span-2">
                <textarea
                  rows={3}
                  value={form.notas}
                  onChange={(event) => setForm({ ...form, notas: event.target.value })}
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

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ComisionGroup({ grupo, onEdit, onDelete }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[980px] space-y-8 p-4">
          {grupo.bloques.map((bloque, index) => (
            <div
              key={`${grupo.grupo}-${bloque.subgrupo}`}
              className="grid grid-cols-[170px_minmax(370px,1fr)_minmax(300px,0.85fr)] items-start gap-0"
            >
              <div className="min-h-full border-r border-slate-300 pr-4">
                {index === 0 ? (
                  <h2 className="text-2xl font-black uppercase leading-tight text-slate-950">
                    {grupo.grupo}
                  </h2>
                ) : null}
                <p className="mt-8 text-sm font-semibold text-slate-800">
                  {bloque.subgrupo === "General" ? "" : bloque.subgrupo}
                </p>
              </div>

              <div className="px-4">
                {bloque.semanales.length ? (
                  <ComisionSemanalTable
                    rows={bloque.semanales}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ) : (
                  <div className="h-full border border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Sin comision semanal
                  </div>
                )}
              </div>

              <div className="space-y-4 pl-4">
                {bloque.bonos.length ? (
                  bloque.bonos.map((bono) => (
                    <BonoTable
                      key={`${grupo.grupo}-${bloque.subgrupo}-${bono.periodo}`}
                      periodo={bono.periodo}
                      rows={bono.rows}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))
                ) : (
                  <div className="min-h-[110px]" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComisionSemanalTable({ rows, onEdit, onDelete }) {
  const usesPercent = rows.some(
    (row) => row.porcentaje !== null && row.porcentaje !== undefined && row.porcentaje !== "",
  );

  return (
    <table className="w-full border-collapse text-center text-xs text-slate-950">
      <thead>
        <tr>
          <th colSpan={4} className="border border-slate-950 px-2 py-1 font-black">
            COMISION SEMANAL
          </th>
        </tr>
        <tr className="align-middle">
          <th className="w-[32%] border border-slate-950 px-2 py-2 font-bold">
            unidades vendidas
          </th>
          <th className="w-[26%] border border-slate-950 px-2 py-2 font-bold">
            {usesPercent ? "porcentaje" : "comision por equipo"}
          </th>
          <th className="w-[28%] border border-slate-950 px-2 py-2 font-bold">
            VALOR APROXIMADO
          </th>
          <th className="w-[14%] border border-slate-950 px-2 py-2 font-bold">
            acc.
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className={row.activo ? "bg-white" : "bg-slate-100 text-slate-500"}
          >
            <td className="border border-slate-950 px-2 py-1.5 font-medium">
              {row.unidadesVendidas || "-"}
            </td>
            <td className="border border-slate-950 px-2 py-1.5">
              {formatCommission(row)}
            </td>
            <td className="border border-slate-950 px-2 py-1.5">
              {formatApprox(row.valorAproximado)}
            </td>
            <td className="border border-slate-950 px-1 py-1">
              <MatrixActions row={row} onEdit={onEdit} onDelete={onDelete} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BonoTable({ periodo, rows, onEdit, onDelete }) {
  const usesAverage = rows.some((row) => row.promedioPorVendedor);
  const showApprox = rows.some((row) => row.valorAproximado);

  return (
    <table className="w-full border-collapse text-center text-xs text-slate-950">
      <thead>
        <tr>
          <th
            colSpan={showApprox ? 4 : 3}
            className="border border-slate-950 px-2 py-1 font-black"
          >
            {getPeriodoLabel(periodo).toUpperCase()}
          </th>
        </tr>
        <tr className="align-middle">
          <th className="border border-slate-950 px-2 py-2 font-bold">
            {usesAverage ? "promedio por vendedor" : "unidades vendidas"}
          </th>
          <th className="border border-slate-950 px-2 py-2 font-bold">bono</th>
          {showApprox ? (
            <th className="border border-slate-950 px-2 py-2 font-bold">
              valor
            </th>
          ) : null}
          <th className="w-[54px] border border-slate-950 px-2 py-2 font-bold">
            acc.
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className={row.activo ? "bg-white" : "bg-slate-100 text-slate-500"}
          >
            <td className="border border-slate-950 px-2 py-1.5 font-medium">
              {usesAverage
                ? row.promedioPorVendedor || "-"
                : row.unidadesVendidas || "-"}
            </td>
            <td className="border border-slate-950 px-2 py-1.5">
              {formatMoney(row.bono)}
            </td>
            {showApprox ? (
              <td className="border border-slate-950 px-2 py-1.5">
                {formatApprox(row.valorAproximado)}
              </td>
            ) : null}
            <td className="border border-slate-950 px-1 py-1">
              <MatrixActions row={row} onEdit={onEdit} onDelete={onDelete} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MatrixActions({ row, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onEdit(row)}
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
        title="Editar"
      >
        <Pencil size={14} />
      </button>
      {row.activo ? (
        <button
          type="button"
          onClick={() => onDelete(row)}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100"
          title="Desactivar"
        >
          <Trash size={14} />
        </button>
      ) : null}
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
