import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  ArrowDown,
  ArrowUp,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Save,
  Star,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { api } from "../../api/client";
import { useAuthUser } from "../../utils/useAuthUser";
import {
  calcularEgresosNomina,
  cambiarSeleccionNomina,
  moverPrioridadNomina,
  normalizarIdsNomina,
  ordenarFilasNomina,
  seleccionarFilasNomina,
} from "../../utils/rolesCreditekNomina";

const ahora = new Date();
const IESS_RATE = 0.0945;
const SALARIO_BASE_NOMINA = 482;
const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const ORDEN_CARGOS_PRIORITARIOS = [
  "gerente",
  "jefe de compras",
  "jefe de marketing",
  "jefe de desarrollo organizacional",
];

const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const prioridadCargo = (cargo) => {
  const cargoNormalizado = normalizarTexto(cargo);
  const index = ORDEN_CARGOS_PRIORITARIOS.findIndex((prioridad) =>
    cargoNormalizado === prioridad ||
    cargoNormalizado.startsWith(`${prioridad} `) ||
    cargoNormalizado.includes(prioridad),
  );
  return index === -1 ? ORDEN_CARGOS_PRIORITARIOS.length : index;
};

const numero = (value) => {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const redondear = (value) => Number(numero(value).toFixed(2));

const formatoNumero = (value) =>
  new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero(value));

const formatoFecha = (value) => {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const finDeMes = (anio, mes) => new Date(anio, mes, 0);

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const diasTrabajadosPeriodo = (row, anio, mes) => {
  const finPeriodo = finDeMes(anio, mes);
  const fechaIngreso = parseDate(row.fechaIngreso);

  if (fechaIngreso && fechaIngreso > finPeriodo) return 0;
  if (
    !fechaIngreso ||
    fechaIngreso.getFullYear() !== Number(anio) ||
    fechaIngreso.getMonth() + 1 !== Number(mes)
  ) {
    return 30;
  }

  return Math.max(0, Math.min(30, 31 - fechaIngreso.getDate()));
};

const calcularFila = (row, anio, mes) => {
  const salario = SALARIO_BASE_NOMINA;
  const sueldoBase = SALARIO_BASE_NOMINA;
  const sueldoExtra = numero(row.rolPagoSueldoExtra);
  const diasTrabajados = diasTrabajadosPeriodo(row, anio, mes);
  const sueldoAPagar = redondear((sueldoBase * diasTrabajados) / 30);
  const sueldosExtras = row.sueldosExtrasManual != null
    ? redondear(row.sueldosExtrasManual)
    : redondear((sueldoExtra * diasTrabajados) / 30);
  const fondosReserva = row.fondosReservaManual != null
    ? redondear(row.fondosReservaManual)
    : row.fondoReservaActivo
      ? redondear((sueldoAPagar + sueldosExtras) / 12)
      : 0;
  const comisionVenta = numero(row.ingresosComisiones);
  const totalIngresos = redondear(
    sueldoAPagar + fondosReserva + sueldosExtras + comisionVenta,
  );
  const iess = redondear(totalIngresos * IESS_RATE);
  const { anticipo, prestamo, sancionMeta, totalEgresos } = calcularEgresosNomina(row, iess);
  const valorRecibir = redondear(totalIngresos - totalEgresos);

  return {
    ...row,
    salario,
    diasTrabajados,
    sueldoAPagar,
    fondosReserva,
    sueldosExtras,
    comisionVenta,
    totalIngresos,
    iess,
    anticipo,
    prestamo,
    sancionMeta,
    totalEgresos,
    valorRecibir,
  };
};

const sumar = (rows, campo) =>
  redondear(rows.reduce((total, row) => total + numero(row[campo]), 0));

export default function RolesCreditekNomina() {
  const user = useAuthUser();
  const [anio, setAnio] = useState(ahora.getFullYear());
  const [mes, setMes] = useState(ahora.getMonth() + 1);
  const [rows, setRows] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cambios, setCambios] = useState({});
  const [cambiosExtras, setCambiosExtras] = useState({});
  const [excluidos, setExcluidos] = useState([]);
  const [ordenPersonal, setOrdenPersonal] = useState({ clave: null, ids: [] });
  const claveOrden = user?.id ? `rve:nomina:orden:${user.id}` : null;
  const prioritarios = useMemo(
    () => ordenPersonal.clave === claveOrden ? ordenPersonal.ids : [],
    [claveOrden, ordenPersonal],
  );
  const hayCambios = Object.keys(cambios).length > 0 || Object.keys(cambiosExtras).length > 0;

  useEffect(() => {
    if (!claveOrden) return;
    let ids = [];
    try {
      ids = normalizarIdsNomina(JSON.parse(localStorage.getItem(claveOrden) || "[]"));
    } catch {
      // Se puede seguir ordenando aunque el navegador no permita guardar preferencias.
    }
    setOrdenPersonal({ clave: claveOrden, ids });
  }, [claveOrden]);

  useEffect(() => {
    if (!claveOrden || ordenPersonal.clave !== claveOrden) return;
    try {
      localStorage.setItem(claveOrden, JSON.stringify(ordenPersonal.ids));
    } catch {
      // El orden permanece disponible durante esta sesión.
    }
  }, [claveOrden, ordenPersonal]);

  useEffect(() => {
    setExcluidos([]);
  }, [anio, mes]);

  useEffect(() => {
    if (!hayCambios) return undefined;
    const advertir = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", advertir);
    return () => window.removeEventListener("beforeunload", advertir);
  }, [hayCambios]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        "/api/contabilidad/roles-creditek-resumen",
        { params: { anio, mes } },
      );
      setRows(Array.isArray(data.registros) ? data.registros : []);
      setCambios({});
      setCambiosExtras({});
    } catch (error) {
      setRows([]);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cargar la nomina.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [anio, mes]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const rowsCalculadas = useMemo(
    () =>
      rows
        .map((row) => calcularFila(
          {
            ...row,
            ...(Object.hasOwn(cambios, row.usuarioId) ? { fondosReservaManual: cambios[row.usuarioId] } : {}),
            ...(Object.hasOwn(cambiosExtras, row.usuarioId) ? { sueldosExtrasManual: cambiosExtras[row.usuarioId] } : {}),
          }, anio, mes,
        ))
        .sort((left, right) => {
          const prioridad = prioridadCargo(left.cargo) - prioridadCargo(right.cargo);
          if (prioridad !== 0) return prioridad;
          return String(left.nombre || "").localeCompare(
            String(right.nombre || ""),
            "es",
          );
        }),
    [anio, mes, rows, cambios, cambiosExtras],
  );

  const rowsOrdenadas = useMemo(
    () => ordenarFilasNomina(rowsCalculadas, prioritarios),
    [rowsCalculadas, prioritarios],
  );

  const rowsFiltradas = useMemo(() => {
    const query = normalizarTexto(busqueda);
    if (!query) return rowsOrdenadas;
    return rowsOrdenadas.filter((row) =>
      [
        row.usuarioId,
        row.cedula,
        row.nombre,
        row.cargo,
        row.fechaIngreso,
      ].some((value) => normalizarTexto(value).includes(query)),
    );
  }, [busqueda, rowsOrdenadas]);

  const rowsContabilizadas = useMemo(
    () => seleccionarFilasNomina(rowsFiltradas, excluidos),
    [rowsFiltradas, excluidos],
  );
  const idsExcluidos = useMemo(() => new Set(excluidos), [excluidos]);
  const prioritariosVisibles = useMemo(() => {
    const presentes = new Set(rowsFiltradas.map((row) => String(row.usuarioId)));
    return prioritarios.filter((id) => presentes.has(id));
  }, [prioritarios, rowsFiltradas]);
  const todasVisiblesMarcadas = rowsFiltradas.length > 0 && rowsContabilizadas.length === rowsFiltradas.length;

  const destacar = (usuarioId) => {
    const id = String(usuarioId);
    setOrdenPersonal((actual) => ({
      clave: claveOrden,
      ids: actual.ids.includes(id) ? actual.ids.filter((value) => value !== id) : [...actual.ids, id],
    }));
  };

  const moverPrioridad = (usuarioId, desplazamiento) => {
    setOrdenPersonal((actual) => ({
      clave: claveOrden,
      ids: moverPrioridadNomina(actual.ids, usuarioId, desplazamiento, rowsFiltradas),
    }));
  };

  const totales = useMemo(
    () => ({
      salario: sumar(rowsContabilizadas, "salario"),
      sueldoAPagar: sumar(rowsContabilizadas, "sueldoAPagar"),
      fondosReserva: sumar(rowsContabilizadas, "fondosReserva"),
      sueldosExtras: sumar(rowsContabilizadas, "sueldosExtras"),
      comisionVenta: sumar(rowsContabilizadas, "comisionVenta"),
      totalIngresos: sumar(rowsContabilizadas, "totalIngresos"),
      iess: sumar(rowsContabilizadas, "iess"),
      anticipo: sumar(rowsContabilizadas, "anticipo"),
      prestamo: sumar(rowsContabilizadas, "prestamo"),
      sancionMeta: sumar(rowsContabilizadas, "sancionMeta"),
      totalEgresos: sumar(rowsContabilizadas, "totalEgresos"),
      valorRecibir: sumar(rowsContabilizadas, "valorRecibir"),
    }),
    [rowsContabilizadas],
  );

  const guardarTodo = async () => {
    setSaving(true);
    try {
      const registros = rowsCalculadas.map((row) => ({
        usuarioId: row.usuarioId,
        fondosReservaManual: row.fondosReserva,
        sueldosExtrasManual: row.sueldosExtras,
      }));
      await api.put("/api/contabilidad/roles-creditek-resumen/nomina", { anio, mes, registros });
      const valores = new Map(registros.map((row) => [row.usuarioId, row]));
      setRows((actuales) => actuales.map((row) => ({
        ...row, ...valores.get(row.usuarioId),
      })));
      setCambios({});
      setCambiosExtras({});
      Swal.fire("Guardado", "Los fondos de reserva y sueldos extras del período fueron guardados.", "success");
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "No se pudo guardar la nómina. Los cambios siguen disponibles.", "error");
    } finally {
      setSaving(false);
    }
  };

  const exportarExcel = () => {
    if (!rowsContabilizadas.length) return;
    const encabezado = [
      [
        "N#",
        "FECHA DE INGRESO",
        "CEDULAS",
        "NOMBRES Y APELLIDOS",
        "CARGO",
        "SALARIO",
        "DIAS TRABAJADAS",
        "SUELDO A PAGAR",
        "FONDOS RESERVA",
        "SUELDOS EXTRAS",
        "COMxVTA",
        "TOTAL INGRESOS",
        "9,45% IESS/15DIAS",
        "ANTICIPO",
        "PRESTAMO",
        "SANCIÓN POR NO LLEGAR A META",
        "TOTAL EGRESOS",
        "VALOR A RECIBIR",
      ],
    ];
    const data = [
      [`NOMINA CREDITEK ${MESES[mes - 1].toUpperCase()} ${anio}`],
      [],
      ...encabezado,
      ...rowsContabilizadas.map((row, index) => [
        index + 1,
        formatoFecha(row.fechaIngreso),
        row.cedula || "",
        row.nombre || "",
        row.cargo || "",
        row.salario,
        row.diasTrabajados,
        row.sueldoAPagar,
        row.fondosReserva,
        row.sueldosExtras,
        row.comisionVenta,
        row.totalIngresos,
        row.iess,
        row.anticipo,
        row.prestamo,
        row.sancionMeta,
        row.totalEgresos,
        row.valorRecibir,
      ]),
      [
        "",
        "",
        "",
        "",
        "TOTALES",
        totales.salario,
        "",
        totales.sueldoAPagar,
        totales.fondosReserva,
        totales.sueldosExtras,
        totales.comisionVenta,
        totales.totalIngresos,
        totales.iess,
        totales.anticipo,
        totales.prestamo,
        totales.sancionMeta,
        totales.totalEgresos,
        totales.valorRecibir,
      ],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 14 },
      { wch: 34 },
      { wch: 24 },
      ...Array.from({ length: 13 }, () => ({ wch: 14 })),
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Nomina");
    XLSX.writeFile(
      workbook,
      `Nomina_Roles_Creditek_${anio}_${String(mes).padStart(2, "0")}.xlsx`,
    );
  };

  const anios = Array.from({ length: 7 }, (_, index) => ahora.getFullYear() - 3 + index);
  const periodoTexto = `Desde el 1 al ${finDeMes(anio, mes).getDate()} de ${MESES[mes - 1]} de ${anio}`;

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1900px] space-y-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <Calculator size={16} /> Contabilidad / Roles Creditek
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Nomina
            </h1>
            <p className="mt-1 text-sm font-semibold uppercase text-slate-600">
              {periodoTexto}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mes}
              onChange={(event) => setMes(Number(event.target.value))}
              disabled={loading || saving || hayCambios}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600"
              aria-label="Mes"
            >
              {MESES.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={anio}
              onChange={(event) => setAnio(Number(event.target.value))}
              disabled={loading || saving || hayCambios}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-600"
              aria-label="Anio"
            >
              {anios.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={cargar}
              disabled={loading || saving || hayCambios}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={guardarTodo}
              disabled={loading || saving || !rows.length}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Save size={17} />
              {saving ? "Guardando..." : "Guardar todo"}
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={loading || !rowsContabilizadas.length}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              title="Descargar las filas visibles marcadas, en el orden de la tabla"
            >
              <FileSpreadsheet size={17} />
              Excel seleccionados
            </button>
          </div>
        </header>

        <section className="overflow-hidden border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-300 bg-slate-100 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
              {hayCambios && <span className="text-amber-700">Cambios sin guardar</span>}
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1">
                {rowsContabilizadas.length} de {rowsFiltradas.length} filas visibles contabilizadas
              </span>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-emerald-800">
                Total a recibir {formatoNumero(totales.valorRecibir)}
              </span>
            </div>
            <label className="relative block w-full sm:w-80">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por cedula, nombre o cargo"
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-9 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Limpiar busqueda"
                  aria-label="Limpiar busqueda"
                >
                  <X size={16} />
                </button>
              )}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-3 py-2 text-xs text-slate-600">
            <button
              type="button"
              disabled={loading || !rows.length}
              onClick={() => setExcluidos([])}
              className="rounded-md border border-slate-300 px-2 py-1.5 font-semibold hover:bg-sky-50 disabled:opacity-50"
            >
              Marcar todas
            </button>
            <button
              type="button"
              disabled={loading || !rows.length}
              onClick={() => setExcluidos(cambiarSeleccionNomina([], rowsCalculadas, false))}
              className="rounded-md border border-slate-300 px-2 py-1.5 font-semibold hover:bg-sky-50 disabled:opacity-50"
            >
              Desmarcar todas
            </button>
            <button
              type="button"
              disabled={!prioritarios.length}
              onClick={() => setOrdenPersonal({ clave: claveOrden, ids: [] })}
              className="rounded-md border border-slate-300 px-2 py-1.5 font-semibold hover:bg-sky-50 disabled:opacity-50"
            >
              Restablecer orden
            </button>
            <span>Totales y Excel: solo filas visibles marcadas. Al cambiar de período se marcan todas.</span>
            <span className="inline-flex items-center gap-1 text-sky-800">
              <Star size={14} /> Destaca personas para mostrarlas primero y usa las flechas para ordenarlas. El orden se recuerda en este navegador.
            </span>
          </div>

          <div className="max-h-[calc(100vh-250px)] min-h-[480px] overflow-auto">
            <table className="w-full min-w-[1840px] border-collapse text-xs">
              <thead className="sticky top-0 z-20 text-slate-950">
                <tr>
                  <th rowSpan={2} className="border border-slate-950 bg-sky-100 px-2 py-2 text-center">
                    <label className="flex flex-col items-center gap-2">
                      Sumar
                      <input
                        type="checkbox"
                        checked={todasVisiblesMarcadas}
                        ref={(element) => {
                          if (element) element.indeterminate = rowsContabilizadas.length > 0 && !todasVisiblesMarcadas;
                        }}
                        disabled={loading || !rowsFiltradas.length}
                        onChange={(event) => setExcluidos((actuales) => cambiarSeleccionNomina(actuales, rowsFiltradas, event.target.checked))}
                        aria-label="Contabilizar todas las filas visibles"
                        className="size-4 cursor-pointer accent-sky-700"
                      />
                    </label>
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-950 bg-sky-100 px-2 py-2 text-center"
                  >
                    N#
                  </th>
                  <th
                    colSpan={4}
                    className="border border-slate-950 bg-sky-200 px-2 py-2 text-center"
                  >
                    DATOS
                  </th>
                  <th
                    colSpan={7}
                    className="border border-slate-950 bg-sky-200 px-2 py-2 text-center"
                  >
                    INGRESOS
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-950 bg-sky-200 px-2 py-2 text-center"
                  >
                    9,45%<br />IESS/15DIAS
                  </th>
                  <th
                    colSpan={4}
                    className="border border-slate-950 bg-sky-200 px-2 py-2 text-center"
                  >
                    EGRESOS
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-950 bg-sky-300 px-2 py-2 text-center"
                  >
                    VALOR<br />A RECIBIR
                  </th>
                </tr>
                <tr>
                  {[
                    "FECHA DE INGRESO",
                    "CEDULAS",
                    "NOMBRES Y APELLIDOS",
                    "CARGO",
                    "SALARIO",
                    "DIAS TRABAJADAS",
                    "SUELDO A PAGAR",
                    "FONDOS RESERVA",
                    "SUELDOS EXTRAS",
                    "COMxVTA",
                    "TOTAL INGRESOS",
                    "ANTICIPO",
                    "PRESTAMO",
                    "SANCIÓN POR NO LLEGAR A META",
                    "TOTAL EGRESOS",
                  ].map((header) => (
                    <th
                      key={header}
                      className="border border-slate-950 bg-sky-100 px-2 py-2 text-center"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={19}
                      className="border border-slate-300 px-4 py-16 text-center text-sm font-semibold text-slate-500"
                    >
                      Calculando nomina...
                    </td>
                  </tr>
                ) : rowsFiltradas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={19}
                      className="border border-slate-300 px-4 py-16 text-center text-sm text-slate-500"
                    >
                      No hay colaboradores para mostrar.
                    </td>
                  </tr>
                ) : (
                  rowsFiltradas.map((row, index) => (
                    <tr
                      key={row.usuarioId}
                      className={
                        idsExcluidos.has(String(row.usuarioId))
                          ? "bg-slate-100 text-slate-500"
                          : index % 2 === 0
                          ? "bg-emerald-50/70 hover:bg-emerald-100"
                          : "bg-white hover:bg-emerald-50"
                      }
                    >
                      <td className="border border-slate-950 px-2 py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={!idsExcluidos.has(String(row.usuarioId))}
                          onChange={(event) => setExcluidos((actuales) => cambiarSeleccionNomina(actuales, [row], event.target.checked))}
                          aria-label={`Contabilizar a ${row.nombre}`}
                          title={idsExcluidos.has(String(row.usuarioId)) ? "No se incluye en los totales ni en Excel" : "Incluido en los totales y en Excel"}
                          className="size-4 cursor-pointer accent-sky-700"
                        />
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-center font-bold">
                        {index + 1}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-center font-semibold">
                        {formatoFecha(row.fechaIngreso)}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-center font-semibold">
                        {row.cedula || "-"}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 font-bold uppercase">
                        <div className="flex min-w-64 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => destacar(row.usuarioId)}
                            disabled={!claveOrden || ordenPersonal.clave !== claveOrden}
                            aria-pressed={prioritarios.includes(String(row.usuarioId))}
                            aria-label={`${prioritarios.includes(String(row.usuarioId)) ? "Quitar prioridad de" : "Mostrar primero a"} ${row.nombre}`}
                            title="Mostrar al inicio"
                            className="shrink-0 rounded p-1 text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                          >
                            <Star size={17} fill={prioritarios.includes(String(row.usuarioId)) ? "currentColor" : "none"} />
                          </button>
                          <span className="flex-1">{row.nombre}</span>
                          {prioritariosVisibles.includes(String(row.usuarioId)) && (
                            <span className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moverPrioridad(row.usuarioId, -1)}
                                disabled={prioritariosVisibles[0] === String(row.usuarioId)}
                                aria-label={`Subir a ${row.nombre}`}
                                title="Subir prioridad"
                                className="rounded p-1 text-sky-700 hover:bg-sky-100 disabled:opacity-30"
                              >
                                <ArrowUp size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moverPrioridad(row.usuarioId, 1)}
                                disabled={prioritariosVisibles[prioritariosVisibles.length - 1] === String(row.usuarioId)}
                                aria-label={`Bajar a ${row.nombre}`}
                                title="Bajar prioridad"
                                className="rounded p-1 text-sky-700 hover:bg-sky-100 disabled:opacity-30"
                              >
                                <ArrowDown size={15} />
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 font-semibold uppercase">
                        {row.cargo || "-"}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right font-bold tabular-nums">
                        {formatoNumero(row.salario)}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-center font-bold tabular-nums">
                        {row.diasTrabajados}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right font-bold tabular-nums">
                        {formatoNumero(row.sueldoAPagar)}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right font-bold tabular-nums">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Fondos de reserva de ${row.nombre}`}
                          value={cambios[row.usuarioId] ?? row.fondosReserva.toFixed(2)}
                          disabled={saving}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (/^\d{0,10}([.,]\d{0,2})?$/.test(value)) {
                              setCambios((actuales) => ({ ...actuales, [row.usuarioId]: value }));
                            }
                          }}
                          onBlur={() => {
                            if (Object.hasOwn(cambios, row.usuarioId)) {
                              setCambios((actuales) => ({ ...actuales, [row.usuarioId]: numero(actuales[row.usuarioId]).toFixed(2) }));
                            }
                          }}
                          className="h-6 w-20 max-w-full rounded border border-slate-300 bg-white/80 px-1 text-right text-xs font-bold tabular-nums outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200 disabled:opacity-50"
                        />
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right font-bold tabular-nums">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Sueldos extras de ${row.nombre}`}
                          value={cambiosExtras[row.usuarioId] ?? row.sueldosExtras.toFixed(2)}
                          disabled={saving}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (/^\d{0,10}([.,]\d{0,2})?$/.test(value)) {
                              setCambiosExtras((actuales) => ({ ...actuales, [row.usuarioId]: value }));
                            }
                          }}
                          onBlur={() => {
                            if (Object.hasOwn(cambiosExtras, row.usuarioId)) {
                              setCambiosExtras((actuales) => ({ ...actuales, [row.usuarioId]: numero(actuales[row.usuarioId]).toFixed(2) }));
                            }
                          }}
                          className="h-6 w-20 max-w-full rounded border border-slate-300 bg-white/80 px-1 text-right text-xs font-bold tabular-nums outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200 disabled:opacity-50"
                        />
                      </td>
                      <td title="Choferes y encargados de logística: entregas del día 1 al último día del mes. Vendedores: Total Comisiones Semana + Mensual; jefes y supervisores: Total, según sus semanas comerciales." className="border border-slate-950 px-2 py-1.5 text-right font-bold tabular-nums">
                        {row.comisionVenta ? formatoNumero(row.comisionVenta) : ""}
                      </td>
                      <td className="border border-slate-950 bg-emerald-100 px-2 py-1.5 text-right font-extrabold tabular-nums">
                        {formatoNumero(row.totalIngresos)}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right font-bold tabular-nums">
                        {formatoNumero(row.iess)}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right font-bold tabular-nums">
                        {row.anticipo ? formatoNumero(row.anticipo) : ""}
                      </td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right font-bold tabular-nums">
                        {row.prestamo ? formatoNumero(row.prestamo) : ""}
                      </td>
                      <td title="Valor del período en Pagos comisiones · Sanción por no llegar a meta" className="border border-slate-950 bg-rose-50 px-2 py-1.5 text-right font-bold text-rose-800 tabular-nums">
                        {formatoNumero(row.sancionMeta)}
                      </td>
                      <td className="border border-slate-950 bg-rose-50 px-2 py-1.5 text-right font-extrabold tabular-nums">
                        {formatoNumero(row.totalEgresos)}
                      </td>
                      <td className="border border-slate-950 bg-sky-50 px-2 py-1.5 text-right font-extrabold text-sky-900 tabular-nums">
                        {formatoNumero(row.valorRecibir)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && rowsFiltradas.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-sky-700 text-white">
                  <tr>
                    <td className="border border-slate-950 px-2 py-2 text-center font-bold">{rowsContabilizadas.length}</td>
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2 font-extrabold uppercase">
                      Totales seleccionados
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.salario)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.sueldoAPagar)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.fondosReserva)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.sueldosExtras)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.comisionVenta)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.totalIngresos)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.iess)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.anticipo)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.prestamo)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.sancionMeta)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.totalEgresos)}
                    </td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-extrabold tabular-nums">
                      {formatoNumero(totales.valorRecibir)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
