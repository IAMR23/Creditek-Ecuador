/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  BadgeDollarSign,
  CalendarDays,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { api } from "../../api/client";

const ENDPOINT = "/api/contabilidad/pagos-comisiones";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const blockColors = [
  "bg-orange-200",
  "bg-amber-100",
  "bg-orange-200",
  "bg-yellow-300",
  "bg-rose-500 text-white",
];

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const commissionFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const currentDate = new Date();

const initialFilters = {
  year: currentDate.getFullYear(),
  month: currentDate.getMonth() + 1,
};

const emptyWeekValues = {
  venden: 0,
  valorVendido: 0,
  totalComisiones: 0,
  noCumpleMetas: 0,
  valorDescontar: 0,
};

const emptyMonthlyValues = {
  ventasTvCelulaMensual: 0,
  valorComisionSemanal: 0,
  valorComisionMensual: 0,
  totalComisionesSemanaMensual: 0,
  totalNoCumpleMetas: 0,
  totalValorDescontar: 0,
  totalPagar: 0,
};

const getWeekValues = (row, week) => row?.semanas?.[week.startDate] || emptyWeekValues;
const getMonthlyValues = (row) => row?.resumenMensual || emptyMonthlyValues;

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));
const formatCommission = (value) => commissionFormatter.format(Number(value || 0));
const cumpleFiltroCargo = (vendedor, cargoFiltro) => {
  const cargo = String(vendedor.cargo || "").toUpperCase();
  if (cargoFiltro === "CALL_CENTER") return cargo.includes("CALL CENTER");
  if (cargoFiltro === "PISO") return cargo.includes("PISO");
  return true;
};

const getSeccionCargo = (vendedor) => {
  const cargo = String(vendedor.cargo || "").toUpperCase();
  if (cargo.includes("JEFE COMERCIAL")) return "JEFES";
  if (cargo.includes("SUPERVISOR")) return "SUPERVISORES";
  return "VENDEDORES";
};

const SECCIONES = [
  { id: "VENDEDORES", label: "Vendedores" },
  { id: "JEFES", label: "Jefes comerciales" },
  { id: "SUPERVISORES", label: "Supervisores" },
];

export default function PagosComisiones() {
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vendedorFiltro, setVendedorFiltro] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState("");
  const [juniorId, setJuniorId] = useState("");
  const [jefeComercialId, setJefeComercialId] = useState("");
  const [guardandoJefe, setGuardandoJefe] = useState(false);
  const [juniorSupervisorId, setJuniorSupervisorId] = useState("");
  const [supervisorComercialId, setSupervisorComercialId] = useState("");
  const [guardandoSupervisor, setGuardandoSupervisor] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState("VENDEDORES");

  const years = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYear - 3 + index);
  }, []);

  const weeks = useMemo(() => report?.weeks || [], [report]);
  const vendedores = useMemo(() => report?.vendedores || [], [report]);
  const vendedoresSeccion = useMemo(
    () => vendedores.filter((vendedor) => getSeccionCargo(vendedor) === seccionActiva),
    [seccionActiva, vendedores],
  );

  const vendedoresFiltrados = useMemo(() => vendedoresSeccion.filter((vendedor) => {
    if (vendedorFiltro && String(vendedor.usuarioId) !== vendedorFiltro) return false;
    return cumpleFiltroCargo(vendedor, cargoFiltro);
  }), [vendedoresSeccion, vendedorFiltro, cargoFiltro]);

  const vendedoresPorCargo = useMemo(
    () => vendedoresSeccion.filter((vendedor) => cumpleFiltroCargo(vendedor, cargoFiltro)),
    [vendedoresSeccion, cargoFiltro],
  );

  const jefesComerciales = useMemo(
    () => vendedores.filter((vendedor) =>
      String(vendedor.cargo || "").toUpperCase().includes("JEFE COMERCIAL"),
    ),
    [vendedores],
  );

  const juniorsPiso = useMemo(
    () => vendedores.filter((vendedor) => {
      const cargo = String(vendedor.cargo || "").toUpperCase();
      return cargo.includes("VENDEDOR") && cargo.includes("PISO") && !cargo.includes("JEFE");
    }),
    [vendedores],
  );

  const supervisoresComerciales = useMemo(
    () => vendedores.filter((vendedor) => getSeccionCargo(vendedor) === "SUPERVISORES"),
    [vendedores],
  );

  const juniorsComerciales = useMemo(
    () => vendedores.filter((vendedor) => getSeccionCargo(vendedor) === "VENDEDORES"),
    [vendedores],
  );

  const totalVisible = useMemo(() => {
    const resumen = {
      semanas: Object.fromEntries(weeks.map((week) => [week.startDate, {
        ...emptyWeekValues,
        semanaFutura: vendedoresFiltrados[0]?.semanas?.[week.startDate]?.semanaFutura || false,
      }])),
      general: { ...emptyWeekValues },
      resumenMensual: { ...emptyMonthlyValues },
    };
    vendedoresFiltrados.forEach((vendedor) => {
      weeks.forEach((week) => {
        const values = getWeekValues(vendedor, week);
        Object.keys(emptyWeekValues).forEach((key) => {
          resumen.semanas[week.startDate][key] += Number(values[key] || 0);
          resumen.general[key] += Number(values[key] || 0);
        });
      });
      const mensual = getMonthlyValues(vendedor);
      Object.keys(emptyMonthlyValues).forEach((key) => {
        resumen.resumenMensual[key] += Number(mensual[key] || 0);
      });
    });
    return resumen;
  }, [vendedoresFiltrados, weeks]);

  const cambiarSeccion = (seccion) => {
    setSeccionActiva(seccion);
    setCargoFiltro("");
    setVendedorFiltro("");
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(ENDPOINT, { params: filters });
      setReport(data);
    } catch (error) {
      console.error("Error cargando pagos de comisiones", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cargar el reporte de pagos",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const seleccionarJunior = (value) => {
    setJuniorId(value);
    const junior = vendedores.find((item) => String(item.usuarioId) === value);
    setJefeComercialId(junior?.jefeComercialId ? String(junior.jefeComercialId) : "");
  };

  const guardarJefeComercial = async () => {
    if (!juniorId) {
      return Swal.fire("Atencion", "Seleccione un vendedor junior", "warning");
    }

    setGuardandoJefe(true);
    try {
      await api.put(`${ENDPOINT}/vendedores/${juniorId}/jefe-comercial`, {
        jefeComercialId: jefeComercialId || null,
      });
      await fetchReport();
      Swal.fire(
        "Listo",
        jefeComercialId ? "Jefe comercial asignado correctamente" : "Asignacion eliminada",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la asignacion",
        "error",
      );
    } finally {
      setGuardandoJefe(false);
    }
  };

  const seleccionarJuniorSupervisor = (value) => {
    setJuniorSupervisorId(value);
    const junior = vendedores.find((item) => String(item.usuarioId) === value);
    setSupervisorComercialId(
      junior?.supervisorComercialId ? String(junior.supervisorComercialId) : "",
    );
  };

  const guardarSupervisorComercial = async () => {
    if (!juniorSupervisorId) {
      return Swal.fire("Atencion", "Seleccione un vendedor junior", "warning");
    }

    setGuardandoSupervisor(true);
    try {
      await api.put(
        `${ENDPOINT}/vendedores/${juniorSupervisorId}/supervisor-comercial`,
        { supervisorComercialId: supervisorComercialId || null },
      );
      await fetchReport();
      Swal.fire(
        "Listo",
        supervisorComercialId ? "Supervisor asignado correctamente" : "Asignacion eliminada",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la asignacion",
        "error",
      );
    } finally {
      setGuardandoSupervisor(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <BadgeDollarSign size={18} />
                Contabilidad
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Pagos comisiones
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Reporte semanal comercial de jueves a miercoles, agrupado por el jueves inicial.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[150px_160px_auto]">
              <select
                value={filters.month}
                onChange={(event) =>
                  setFilters({ ...filters, month: Number(event.target.value) })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.year}
                onChange={(event) =>
                  setFilters({ ...filters, year: Number(event.target.value) })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={fetchReport}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Generar
              </button>
            </div>
          </div>
        </section>

        <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {SECCIONES.map((seccion) => {
            const cantidad = vendedores.filter(
              (vendedor) => getSeccionCargo(vendedor) === seccion.id,
            ).length;
            return (
              <button
                type="button"
                key={seccion.id}
                onClick={() => cambiarSeccion(seccion.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  seccionActiva === seccion.id
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {seccion.label} ({cantidad})
              </button>
            );
          })}
        </nav>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<CalendarDays size={18} />}
            label="Semanas comerciales"
            value={weeks.length}
          />
          <Metric
            icon={<FileSpreadsheet size={18} />}
            label={SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label}
            value={vendedoresFiltrados.length}
          />
          <Metric label="Unidades vendidas" value={totalVisible.general.venden || 0} />
          <Metric
            label="Total a pagar"
            value={formatMoney(totalVisible.resumenMensual.totalPagar)}
          />
        </div>

        {seccionActiva === "VENDEDORES" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Tipo de cargo
              <select value={cargoFiltro} onChange={(event) => { setCargoFiltro(event.target.value); setVendedorFiltro(""); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Todos los cargos</option>
                <option value="CALL_CENTER">Vendedor Call Center</option>
                <option value="PISO">Vendedor de Piso</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Colaborador
              <select value={vendedorFiltro} onChange={(event) => setVendedorFiltro(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Todos los colaboradores del cargo</option>
                {vendedoresPorCargo.map((vendedor) => <option key={vendedor.usuarioId} value={vendedor.usuarioId}>{vendedor.nombre}</option>)}
              </select>
            </label>
          </div>
        </section>
        ) : null}

        {seccionActiva === "JEFES" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">Jefe comercial de piso</h2>
            <p className="mt-1 text-sm text-slate-500">
              Asigne manualmente el jefe responsable de cada vendedor junior de piso.
            </p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="text-sm font-medium text-slate-700">
              Vendedor junior
              <select
                value={juniorId}
                onChange={(event) => seleccionarJunior(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccione un vendedor</option>
                {juniorsPiso.map((vendedor) => (
                  <option key={vendedor.usuarioId} value={vendedor.usuarioId}>
                    {vendedor.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Jefe comercial
              <select
                value={jefeComercialId}
                onChange={(event) => setJefeComercialId(event.target.value)}
                disabled={!juniorId}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">Sin jefe asignado</option>
                {jefesComerciales.map((jefe) => (
                  <option key={jefe.usuarioId} value={jefe.usuarioId}>
                    {jefe.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={guardarJefeComercial}
              disabled={!juniorId || guardandoJefe}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {guardandoJefe ? "Guardando..." : "Guardar asignacion"}
            </button>
          </div>
        </section>
        ) : null}

        {seccionActiva === "SUPERVISORES" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-900">Juniors por supervisor</h2>
              <p className="mt-1 text-sm text-slate-500">
                Asigne manualmente los vendedores que forman parte del equipo de cada supervisor.
              </p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="text-sm font-medium text-slate-700">
                Vendedor junior
                <select
                  value={juniorSupervisorId}
                  onChange={(event) => seleccionarJuniorSupervisor(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccione un vendedor</option>
                  {juniorsComerciales.map((vendedor) => (
                    <option key={vendedor.usuarioId} value={vendedor.usuarioId}>
                      {vendedor.nombre} - {vendedor.cargo}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Supervisor
                <select
                  value={supervisorComercialId}
                  onChange={(event) => setSupervisorComercialId(event.target.value)}
                  disabled={!juniorSupervisorId}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="">Sin supervisor asignado</option>
                  {supervisoresComerciales.map((supervisor) => (
                    <option key={supervisor.usuarioId} value={supervisor.usuarioId}>
                      {supervisor.nombre} - {supervisor.cargo}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={guardarSupervisorComercial}
                disabled={!juniorSupervisorId || guardandoSupervisor}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {guardandoSupervisor ? "Guardando..." : "Guardar asignacion"}
              </button>
            </div>
          </section>
        ) : null}

        {seccionActiva === "VENDEDORES" ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-center text-sm text-slate-950">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 min-w-[240px] border border-slate-950 bg-white px-3 py-4 text-xl font-black"
                  >
                    {SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label.toUpperCase()}
                  </th>
                  {weeks.map((week, index) => (
                    <th
                      key={week.startDate}
                      colSpan={5}
                      className={`border border-slate-950 px-3 py-2 text-lg font-black ${blockColors[index % blockColors.length]}`}
                    >
                      {week.label}
                    </th>
                  ))}
                  <MonthlyHeader />
                </tr>
                <tr>
                  {weeks.map((week, index) => (
                    <WeekHeader key={week.startDate} color={blockColors[index % blockColors.length]} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={1 + weeks.length * 5 + 7}
                      className="border border-slate-300 px-4 py-10 text-center text-slate-500"
                    >
                      Cargando reporte...
                    </td>
                  </tr>
                ) : vendedoresFiltrados.length ? (
                  vendedoresFiltrados.map((vendedor, index) => (
                    <tr
                      key={vendedor.usuarioId}
                      className={index % 2 === 0 ? "bg-white" : "bg-orange-100"}
                    >
                      <td className="sticky left-0 z-10 border border-slate-950 bg-inherit px-3 py-1.5 text-left font-medium">
                        <div className="leading-tight">
                          <span>{vendedor.nombre}</span>
                          {vendedor.cargo ? (
                            <span className="block text-[11px] font-normal text-slate-500">
                              {vendedor.cargo}
                            </span>
                          ) : null}
                          {vendedor.esJefeComercial ? (
                            <span className="block text-[11px] font-normal text-emerald-700">
                              {vendedor.vendedoresJunior?.length || 0} junior(s)
                              {vendedor.resumenMensual?.promedioVentasPorJunior !== null
                                ? ` · Promedio ${formatCommission(vendedor.resumenMensual?.promedioVentasPorJunior)}`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {weeks.map((week) => (
                        <WeekValues
                          key={`${vendedor.usuarioId}-${week.startDate}`}
                          values={getWeekValues(vendedor, week)}
                        />
                      ))}
                      <MonthlyValues values={getMonthlyValues(vendedor)} />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={1 + weeks.length * 5 + 7}
                      className="border border-slate-300 px-4 py-10 text-center text-slate-500"
                    >
                      No hay registros en esta seccion para el mes seleccionado.
                    </td>
                  </tr>
                )}

                {weeks.length ? (
                  <tr className="bg-fuchsia-500 font-black text-white">
                    <td className="sticky left-0 z-10 border border-slate-950 bg-fuchsia-500 px-3 py-1.5 text-left">
                      TOTAL
                    </td>
                    {weeks.map((week) => (
                      <WeekValues
                        key={`total-${week.startDate}`}
                        values={totalVisible.semanas?.[week.startDate] || emptyWeekValues}
                        total
                      />
                    ))}
                    <MonthlyValues values={getMonthlyValues(totalVisible)} total />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        ) : (
          <LeadershipCommissionTables
            rows={vendedoresFiltrados}
            weeks={weeks}
            loading={loading}
            sectionLabel={
              SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label || ""
            }
          />
        )}
      </div>
    </div>
  );
}

function LeadershipCommissionTables({ rows, weeks, loading, sectionLabel }) {
  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        Cargando reporte...
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        No hay registros en {sectionLabel.toLowerCase()} para el mes seleccionado.
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => {
        const mensual = getMonthlyValues(row);
        return (
          <section
            key={row.usuarioId}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-center text-lg font-black uppercase text-slate-900">
                Comisiones {row.nombre}
              </h2>
              {row.vendedoresJunior?.length ? (
                <p className="mt-1 text-center text-xs text-slate-500">
                  Juniors: {row.vendedoresJunior.map((junior) => junior.nombre).join(", ")}
                  {mensual.promedioVentasPorJunior !== null
                    ? ` · Promedio por junior: ${formatCommission(mensual.promedioVentasPorJunior)}`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[760px] border-collapse text-center text-sm text-slate-950">
                <thead>
                  <tr>
                    <th className="border border-slate-950 px-3 py-2" />
                    {weeks.map((week, index) => (
                      <th key={week.startDate} className={`border border-slate-950 px-3 py-2 font-black ${blockColors[index % blockColors.length]}`}>
                        {week.label}
                      </th>
                    ))}
                    <th className="border border-slate-950 bg-amber-100 px-3 py-2 font-black">COMISION</th>
                    <th className="border border-slate-950 px-3 py-2 font-black">BONO</th>
                    <th className="border border-slate-950 bg-red-600 px-3 py-2 font-black text-white">A RECIBIR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-950 px-3 py-2 font-bold uppercase">{row.nombre}</td>
                    {weeks.map((week) => {
                      const values = getWeekValues(row, week);
                      return <td key={week.startDate} className="border border-slate-950 px-3 py-2 text-xl">{values.semanaFutura ? "-" : values.venden || 0}</td>;
                    })}
                    <td className="border border-slate-950 bg-amber-100 px-3 py-2" />
                    <td className="border border-slate-950 px-3 py-2" />
                    <td className="border border-slate-950 bg-red-600 px-3 py-2 text-white" />
                  </tr>
                  <tr className="font-black">
                    <td className="border border-slate-950 bg-pink-400 px-3 py-2">TOTAL COMISIONES</td>
                    {weeks.map((week) => {
                      const values = getWeekValues(row, week);
                      return <td key={week.startDate} className="border border-slate-950 px-3 py-2 text-lg">{values.semanaFutura ? "-" : formatCommission(values.totalComisiones)}</td>;
                    })}
                    <td className="border border-slate-950 bg-amber-100 px-3 py-2 text-lg">{formatCommission(mensual.valorComisionSemanal)}</td>
                    <td className="border border-slate-950 px-3 py-2 text-lg">{formatCommission(mensual.valorComisionMensual)}</td>
                    <td className="border border-slate-950 bg-red-600 px-3 py-2 text-lg text-white">{formatCommission(mensual.totalPagar)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Metric({ icon = null, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function WeekHeader({ color }) {
  return (
    <>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        VENDEN
      </th>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        VALOR / VENDIDO
      </th>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        TOTAL COMISIONES
      </th>
      <th className="border border-slate-950 bg-blue-800 px-2 py-2 text-xs font-black text-white">
        NO CUMPLE METAS
      </th>
      <th className="border border-slate-950 bg-red-700 px-2 py-2 text-xs font-black text-white">
        VALOR A DESCONTAR
      </th>
    </>
  );
}

function WeekValues({ values, total = false }) {
  const noCumpleClass = total
    ? "border border-slate-950 px-2 py-1.5"
    : "border border-slate-950 bg-indigo-100 px-2 py-1.5";

  return (
    <>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "Pendiente" : values.venden || ""}
      </td>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "-" : values.valorVendido ? formatMoney(values.valorVendido) : ""}
      </td>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "-" : values.totalComisiones ? formatCommission(values.totalComisiones) : 0}
      </td>
      <td className={noCumpleClass}>
        {values.semanaFutura || (!total && values.semanaLaborada === false) ? "-" : values.noCumpleMetas || 0}
      </td>
      <td className="border border-slate-950 bg-red-100 px-2 py-1.5 text-red-700">
        {values.semanaFutura
          ? "Pendiente"
          : !total && values.semanaLaborada === false
            ? "No laborada"
          : formatMoney(values.valorDescontar || 0)}
      </td>
    </>
  );
}

function MonthlyHeader() {
  return (
    <>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Ventas Mensuales
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Valor Comision Semanal
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Valor Comision Mensual
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Total Comisiones Semana + Mensual
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-700 px-2 py-2 text-xs font-black text-white"
      >
        Total No Cumple Metas
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-800 px-2 py-2 text-xs font-black text-white"
      >
        Total Valor a Descontar
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-emerald-800 px-2 py-2 text-xs font-black text-white"
      >
        Total a Pagar
      </th>
    </>
  );
}

function MonthlyValues({ values, total = false }) {
  const totalClass = total
    ? "border border-slate-950 bg-red-600 px-2 py-1.5 text-white"
    : "border border-slate-950 px-2 py-1.5 text-red-600";

  return (
    <>
      <td className={totalClass}>{values.ventasTvCelulaMensual || 0}</td>
      <td className={totalClass}>
        {values.valorComisionSemanal
          ? formatCommission(values.valorComisionSemanal)
          : 0}
      </td>
      <td className={totalClass}>
        {values.valorComisionMensual
          ? formatCommission(values.valorComisionMensual)
          : ""}
      </td>
      <td className={totalClass}>
        {values.totalComisionesSemanaMensual
          ? formatCommission(values.totalComisionesSemanaMensual)
          : "0.00"}
      </td>
      <td className="border border-slate-950 bg-blue-700 px-2 py-1.5 text-white">
        {values.totalNoCumpleMetas || 0}
      </td>
      <td className="border border-slate-950 bg-red-800 px-2 py-1.5 font-semibold text-white">
        {formatMoney(values.totalValorDescontar || 0)}
      </td>
      <td className="border border-slate-950 bg-emerald-800 px-2 py-1.5 font-bold text-white">
        {formatMoney(values.totalPagar || 0)}
      </td>
    </>
  );
}
