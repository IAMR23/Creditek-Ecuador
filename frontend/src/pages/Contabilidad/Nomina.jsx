import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import {
  BadgeDollarSign,
  CheckSquare,
  Eye,
  FileSpreadsheet,
  Filter,
  Pencil,
  Save,
  Search,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";

const API_ENDPOINT = `${API_URL}/api/contabilidad/nomina`;

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "ACTIVO", label: "Activo" },
  { value: "PASIVO", label: "Pasivo" },
];

const BENEFICIOS = [
  { value: "IESS", label: "IESS" },
  { value: "DECIMO_TERCERO", label: "Decimo tercero" },
  { value: "DECIMO_CUARTO", label: "Decimo cuarto" },
  { value: "FONDOS_RESERVA", label: "Fondos de reserva" },
  { value: "UTILIDADES", label: "Utilidades" },
  { value: "FINIQUITO", label: "Finiquito" },
  { value: "FACTURA", label: "Factura" },
];

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const emptyFilters = {
  agenciaId: "",
  estado: "",
  nombre: "",
};

const formatDate = (value) => {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const getBenefitLabel = (tipoBeneficio) =>
  BENEFICIOS.find((beneficio) => beneficio.value === tipoBeneficio)?.label || tipoBeneficio;

export default function Nomina() {
  const [registros, setRegistros] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    sueldo: "",
    cargo: "",
    estado: "ACTIVO",
    observaciones: "",
    beneficios: [],
  });

  const readOnly = modalMode === "view";

  const filteredActivos = useMemo(
    () =>
      registros.reduce(
        (acc, registro) => {
          if (registro.estado === "ACTIVO") acc.activos += 1;
          if (registro.estado === "PASIVO") acc.pasivos += 1;
          return acc;
        },
        { activos: 0, pasivos: 0 },
      ),
    [registros],
  );

  const fetchAgencias = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/agencias`);
      setAgencias(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando agencias", error);
    }
  };

  const fetchNomina = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(API_ENDPOINT, {
        headers: authHeaders(),
        params: Object.fromEntries(
          Object.entries(filters).filter(([, value]) => String(value || "").trim()),
        ),
      });
      setRegistros(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error cargando nomina", error);
      Swal.fire("Error", "No se pudo cargar la nomina", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgencias();
  }, []);

  useEffect(() => {
    fetchNomina();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = (registro, mode) => {
    setSelected(registro);
    setModalMode(mode);
    setForm({
      sueldo: registro.sueldo ?? "",
      cargo: registro.cargo || "",
      estado: registro.estado || "ACTIVO",
      observaciones: registro.observaciones || "",
      beneficios: BENEFICIOS.map((beneficio) => {
        const actual = registro.beneficios?.find(
          (item) => item.tipoBeneficio === beneficio.value,
        );
        return {
          tipoBeneficio: beneficio.value,
          activo: Boolean(actual?.activo),
          observacion: actual?.observacion || "",
        };
      }),
    });
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
  };

  const updateBenefit = (tipoBeneficio, changes) => {
    setForm((prev) => ({
      ...prev,
      beneficios: prev.beneficios.map((beneficio) =>
        beneficio.tipoBeneficio === tipoBeneficio
          ? { ...beneficio, ...changes }
          : beneficio,
      ),
    }));
  };

  const handleSave = async () => {
    if (!selected) return;

    try {
      await axios.put(
        `${API_ENDPOINT}/${selected.id}`,
        {
          sueldo: form.sueldo,
          cargo: form.cargo,
          estado: form.estado,
          observaciones: form.observaciones,
          beneficios: form.beneficios,
        },
        { headers: authHeaders() },
      );

      Swal.fire("Actualizado", "La informacion de nomina fue actualizada", "success");
      closeModal();
      fetchNomina();
    } catch (error) {
      console.error("Error actualizando nomina", error);
      Swal.fire("Error", "No se pudo actualizar la nomina", "error");
    }
  };

  const beneficiosActivos = (beneficios = []) =>
    beneficios.filter((beneficio) => beneficio.activo).map((beneficio) => beneficio.tipoBeneficio);

  const exportarExcel = () => {
    if (!registros.length) {
      Swal.fire("Sin datos", "No hay registros para exportar", "info");
      return;
    }

    const filas = registros.map((registro, index) => ({
      "#" : index + 1,
      Agencia: registro.agencia || "",
      Nombre: registro.nombre || "",
      "Fecha de ingreso": registro.fechaIngreso || "",
      "Fecha de salida": registro.fechaSalida || "",
      "Tiempo trabajado": registro.tiempoTrabajado || "",
      Cargo: registro.cargo || "",
      Sueldo: Number(registro.sueldo || 0),
      "CI / Cedula": registro.cedula || "",
      "Correo electronico": registro.correo || "",
      "Cuenta bancaria": registro.cuentaBancaria || "",
      "Entidad financiera": registro.entidadBancaria || "",
      Direccion: registro.direccion || "",
      Estado: registro.estado || "",
      Beneficios: (registro.beneficios || [])
        .filter((beneficio) => beneficio.activo)
        .map((beneficio) => getBenefitLabel(beneficio.tipoBeneficio))
        .join(", "),
      Observaciones: registro.observaciones || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(filas);
    worksheet["!cols"] = [
      { wch: 22 },
      { wch: 28 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 24 },
      { wch: 12 },
      { wch: 15 },
      { wch: 30 },
      { wch: 20 },
      { wch: 22 },
      { wch: 34 },
      { wch: 12 },
      { wch: 44 },
      { wch: 34 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Nomina");
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Nomina_${fecha}.xlsx`);
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
              <h1 className="mt-2 text-2xl font-bold text-slate-900">Nomina</h1>
              <p className="mt-1 text-sm text-slate-500">
                Gestion laboral conectada con usuarios y agencias existentes.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-slate-200 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Registros</p>
                  <p className="text-xl font-bold text-slate-900">{registros.length}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-medium text-emerald-700">Activos</p>
                  <p className="text-xl font-bold text-emerald-800">{filteredActivos.activos}</p>
                </div>
                <div className="rounded-lg border border-slate-200 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Pasivos</p>
                  <p className="text-xl font-bold text-slate-900">{filteredActivos.pasivos}</p>
                </div>
              </div>
              <button
                onClick={exportarExcel}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
              >
                <FileSpreadsheet size={17} />
                Descargar Excel
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter size={18} />
            Filtros
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
            <select
              value={filters.agenciaId}
              onChange={(event) => setFilters({ ...filters, agenciaId: event.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Todas las agencias</option>
              {agencias.map((agencia) => (
                <option key={agencia.id} value={agencia.id}>
                  {agencia.nombre}
                </option>
              ))}
            </select>

            <select
              value={filters.estado}
              onChange={(event) => setFilters({ ...filters, estado: event.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {ESTADOS.map((estado) => (
                <option key={estado.value} value={estado.value}>
                  {estado.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                value={filters.nombre}
                onChange={(event) => setFilters({ ...filters, nombre: event.target.value })}
                placeholder="Buscar por nombre"
                className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <button
              onClick={fetchNomina}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Filter size={16} />
              Aplicar
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1600px] w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Agencia</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Fecha ingreso</th>
                  <th className="px-4 py-3">Fecha salida</th>
                  <th className="px-4 py-3">Tiempo trabajado</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Sueldo</th>
                  <th className="px-4 py-3">CI / Cedula</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Cuenta bancaria</th>
                  <th className="px-4 py-3">Entidad financiera</th>
                  <th className="px-4 py-3">Direccion</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Beneficios</th>
                  <th className="px-4 py-3">Observaciones</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={16} className="px-4 py-10 text-center text-slate-500">
                      Cargando nomina...
                    </td>
                  </tr>
                ) : registros.length ? (
                  registros.map((registro, index) => {
                    const activos = beneficiosActivos(registro.beneficios);

                    return (
                      <tr key={registro.id} className="align-top transition hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{registro.agencia || "-"}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{registro.nombre || "-"}</td>
                        <td className="px-4 py-3">{formatDate(registro.fechaIngreso)}</td>
                        <td className="px-4 py-3">{formatDate(registro.fechaSalida)}</td>
                        <td className="px-4 py-3">{registro.tiempoTrabajado || "-"}</td>
                        <td className="px-4 py-3">{registro.cargo || "-"}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {moneyFormatter.format(Number(registro.sueldo || 0))}
                        </td>
                        <td className="px-4 py-3">{registro.cedula || "-"}</td>
                        <td className="px-4 py-3">{registro.correo || "-"}</td>
                        <td className="px-4 py-3">{registro.cuentaBancaria || "-"}</td>
                        <td className="px-4 py-3">{registro.entidadBancaria || "-"}</td>
                        <td className="px-4 py-3 max-w-[220px]">{registro.direccion || "-"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              registro.estado === "ACTIVO"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {registro.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {activos.length ? (
                            <div className="flex max-w-[260px] flex-wrap gap-1">
                              {activos.map((beneficio) => (
                                <span
                                  key={beneficio}
                                  className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"
                                >
                                  {getBenefitLabel(beneficio)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[240px] text-slate-600">
                          {registro.observaciones || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openModal(registro, "view")}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                              title="Ver"
                            >
                              <Eye size={17} />
                            </button>
                            <button
                              onClick={() => openModal(registro, "edit")}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700"
                              title="Editar"
                            >
                              <Pencil size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={16} className="px-4 py-10 text-center text-slate-500">
                      No hay registros para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selected && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {readOnly ? "Detalle de nomina" : "Editar nomina"}
                </h2>
                <p className="text-sm text-slate-500">
                  {selected.nombre} · {selected.agencia}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]">
              <section className="space-y-3 rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">Informacion laboral</h3>
                <Info label="Agencia" value={selected.agencia} />
                <Info label="Nombre" value={selected.nombre} />
                <Info label="Fecha de ingreso" value={formatDate(selected.fechaIngreso)} />
                <Info label="Fecha de salida" value={formatDate(selected.fechaSalida)} />
                <Info label="Tiempo trabajado" value={selected.tiempoTrabajado || "-"} />
                <Info label="CI / Cedula" value={selected.cedula} />
                <Info label="Correo electronico" value={selected.correo} />
                <Info label="Cuenta bancaria" value={selected.cuentaBancaria || "-"} />
                <Info label="Entidad financiera" value={selected.entidadBancaria || "-"} />
                <Info label="Direccion" value={selected.direccion || "-"} />
              </section>

              <section className="space-y-4 rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-900">Datos de nomina</h3>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Cargo</span>
                  <input
                    value={form.cargo}
                    disabled={readOnly}
                    onChange={(event) => setForm({ ...form, cargo: event.target.value })}
                    placeholder="Ej. Jefe de logistica"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Sueldo</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.sueldo}
                      disabled={readOnly}
                      onChange={(event) => setForm({ ...form, sueldo: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-700">Estado</span>
                    <select
                      value={form.estado}
                      disabled={readOnly}
                      onChange={(event) => setForm({ ...form, estado: event.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    >
                      <option value="ACTIVO">Activo</option>
                      <option value="PASIVO">Pasivo</option>
                    </select>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <CheckSquare size={17} />
                    Beneficios
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {form.beneficios.map((beneficio) => (
                      <div
                        key={beneficio.tipoBeneficio}
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={beneficio.activo}
                            disabled={readOnly}
                            onChange={(event) =>
                              updateBenefit(beneficio.tipoBeneficio, {
                                activo: event.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                          />
                          {getBenefitLabel(beneficio.tipoBeneficio)}
                        </label>
                        <input
                          value={beneficio.observacion}
                          disabled={readOnly}
                          onChange={(event) =>
                            updateBenefit(beneficio.tipoBeneficio, {
                              observacion: event.target.value,
                            })
                          }
                          placeholder="Observacion"
                          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:bg-slate-100"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Observaciones</span>
                  <textarea
                    rows={4}
                    value={form.observaciones}
                    disabled={readOnly}
                    onChange={(event) => setForm({ ...form, observaciones: event.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  />
                </label>
              </section>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cerrar
              </button>
              {!readOnly && (
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <Save size={16} />
                  Guardar cambios
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-slate-100 pb-2 text-sm last:border-0">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="text-slate-900">{value || "-"}</span>
    </div>
  );
}
