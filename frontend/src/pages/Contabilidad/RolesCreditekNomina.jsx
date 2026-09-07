import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  CalendarDays,
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
import { saveAs } from "file-saver";
import { crearLibroNomina, ENCABEZADOS_NOMINA, ENCABEZADOS_NOVEDAD } from "../../utils/rolesCreditekNominaExcel";
import { api } from "../../api/client";
import { useAuthUser } from "../../utils/useAuthUser";
import NominaNovedadModal from './NominaNovedadModal';
import {
  calcularEgresosNomina,
  aplicarCalculoNovedad,
  moverPrioridadNomina,
  normalizarIdsNomina,
  ordenarFilasNomina,
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
  const conNovedad = aplicarCalculoNovedad(row);
  if (conNovedad) return conNovedad;
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
  const [exportando, setExportando] = useState(false);
  const [cambios, setCambios] = useState({});
  const [cambiosExtras, setCambiosExtras] = useState({});
  const [personaNovedad, setPersonaNovedad] = useState(null);
  const [novedadesDisponibles, setNovedadesDisponibles] = useState(true);
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
    if (!hayCambios) return undefined;
    const advertir = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", advertir);
    return () => window.removeEventListener("beforeunload", advertir);
  }, [hayCambios]);

  const cargar = useCallback(async ({ conservarCambios = false } = {}) => {
    setLoading(true);
    try {
      const { data } = await api.get(
        "/api/contabilidad/roles-creditek-resumen",
        { params: { anio, mes } },
      );
      setRows(Array.isArray(data.registros) ? data.registros : []);
      setNovedadesDisponibles(data.novedadesDisponibles !== false);
      if (!conservarCambios) {
        setCambios({});
        setCambiosExtras({});
      }
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

  const prioritariosVisibles = useMemo(() => {
    const presentes = new Set(rowsFiltradas.map((row) => String(row.usuarioId)));
    return prioritarios.filter((id) => presentes.has(id));
  }, [prioritarios, rowsFiltradas]);

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
      salario: sumar(rowsFiltradas, "salario"),
      sueldoAPagar: sumar(rowsFiltradas, "sueldoAPagar"),
      fondosReserva: sumar(rowsFiltradas, "fondosReserva"),
      sueldosExtras: sumar(rowsFiltradas, "sueldosExtras"),
      comisionVenta: sumar(rowsFiltradas, "comisionVenta"),
      totalIngresos: sumar(rowsFiltradas, "totalIngresos"),
      iess: sumar(rowsFiltradas, "iess"),
      anticipo: sumar(rowsFiltradas, "anticipo"),
      prestamo: sumar(rowsFiltradas, "prestamo"),
      sancionMeta: sumar(rowsFiltradas, "sancionMeta"),
      totalEgresos: sumar(rowsFiltradas, "totalEgresos"),
      valorRecibir: sumar(rowsFiltradas, "valorRecibir"),
      diasMaternidad25: sumar(rowsFiltradas, 'diasMaternidad25'),
      diasSueldoCompleto: redondear(rowsFiltradas.reduce((total, row) => total + (row.diasSueldoCompleto ?? row.diasTrabajados), 0)),
      sueldoMaternidadEmpresa: sumar(rowsFiltradas, 'sueldoMaternidadEmpresa'),
      subsidioIessInformativo: sumar(rowsFiltradas, 'subsidioIessInformativo'),
    }),
    [rowsFiltradas],
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

  const exportarExcel = async () => {
    if (!rowsFiltradas.length || exportando) return;
    setExportando(true);
    try {
      const workbook = crearLibroNomina({ filas: rowsFiltradas, totales, periodoTexto, formatoFecha });
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `Nomina_Roles_Creditek_${anio}_${String(mes).padStart(2, '0')}.xlsx`);
    } catch {
      Swal.fire('Error', 'No se pudo generar el Excel de la nómina. Intenta nuevamente.', 'error');
    } finally {
      setExportando(false);
    }
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
              disabled={loading || exportando || !rowsFiltradas.length}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              title="Descargar todas las filas visibles, en el orden de la tabla"
            >
              <FileSpreadsheet size={17} />
              {exportando ? 'Generando...' : 'Excel'}
            </button>
          </div>
        </header>

        <section className="overflow-hidden border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-300 bg-slate-100 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
              {hayCambios && <span className="text-amber-700">Cambios sin guardar</span>}
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1">
                {rowsFiltradas.length} colaboradores
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
              disabled={!prioritarios.length}
              onClick={() => setOrdenPersonal({ clave: claveOrden, ids: [] })}
              className="rounded-md border border-slate-300 px-2 py-1.5 font-semibold hover:bg-sky-50 disabled:opacity-50"
            >
              Restablecer orden
            </button>
            <span>Totales y Excel incluyen todas las filas visibles.</span>
            <span className="inline-flex items-center gap-1 text-sky-800">
              <Star size={14} /> Destaca personas para mostrarlas primero y usa las flechas para ordenarlas. El orden se recuerda en este navegador.
            </span>
          </div>

          {!novedadesDisponibles && <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Novedades de nómina pendientes de habilitar: aplicar la migración de maternidad y lactancia.</p>}
          <div className="max-h-[calc(100vh-250px)] min-h-[480px] overflow-auto">
            <table className="w-full min-w-[1840px] border-collapse text-xs">
              <thead className="sticky top-0 z-20 text-slate-950">
                <tr>
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
                  {ENCABEZADOS_NOVEDAD.map((titulo) => (
                    <th key={titulo} rowSpan={2} className="border border-slate-950 bg-sky-100 px-2 py-2 text-center">{titulo}</th>
                  ))}
                </tr>
                <tr>
                  {ENCABEZADOS_NOMINA.map((header) => (
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
                      colSpan={24}
                      className="border border-slate-300 px-4 py-16 text-center text-sm font-semibold text-slate-500"
                    >
                      Calculando nomina...
                    </td>
                  </tr>
                ) : rowsFiltradas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={24}
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
                        index % 2 === 0
                          ? "bg-emerald-50/70 hover:bg-emerald-100"
                          : "bg-white hover:bg-emerald-50"
                      }
                    >
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
                          <span className="flex-1">{row.nombre}
                            <button type="button" disabled={saving || !novedadesDisponibles}
                              onClick={() => setPersonaNovedad(row)}
                              title="Crear o editar una novedad de nómina"
                              className="mt-1 flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium normal-case text-sky-800 disabled:opacity-50">
                              <CalendarDays size={13} /> {row.novedadesNomina?.length ? 'Editar novedad' : 'Novedad de nómina'}
                            </button>
                          </span>
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
                      <td className="border border-slate-950 px-2 py-1.5 text-right tabular-nums">{row.diasMaternidad25 || 0}</td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right tabular-nums">{row.diasSueldoCompleto ?? row.diasTrabajados}</td>
                      <td className="border border-slate-950 px-2 py-1.5 text-right tabular-nums">{formatoNumero(row.sueldoMaternidadEmpresa)}</td>
                      <td title="Informativo: no se suma al total de ingresos ni al valor a recibir de Creditek" className="border border-slate-950 bg-indigo-50 px-2 py-1.5 text-right font-bold text-indigo-800 tabular-nums">{formatoNumero(row.subsidioIessInformativo)}</td>
                      <td className="min-w-48 border border-slate-950 px-2 py-1.5">
                        {row.tipoNovedad && <span className="rounded bg-sky-100 px-2 py-1 font-semibold text-sky-900">{row.tipoNovedad === 'LACTANCIA' ? 'Lactancia' : row.tipoNovedad}</span>}
                        {row.tipoNovedad && row.novedadesNomina?.map((novedad) => <div key={novedad.id} className="mt-1 text-[11px] text-slate-600">
                          {novedad.tipo}: {formatoFecha(novedad.fechaInicio)} – {formatoFecha(novedad.fechaFin)}{novedad.fechaRetorno ? ` · Retorno: ${formatoFecha(novedad.fechaRetorno)}` : ''}
                          <button type="button" disabled={saving || !novedadesDisponibles}
                            onClick={() => setPersonaNovedad({ ...row, novedadIdEditar: novedad.id })}
                            className="ml-2 rounded border border-sky-200 bg-sky-50 px-2 py-1 font-semibold text-sky-800 disabled:opacity-50">Editar</button>
                        </div>)}
                      </td>
                      <td className="min-w-48 whitespace-pre-wrap border border-slate-950 px-2 py-1.5">{row.observacionNovedad || ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && rowsFiltradas.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-sky-700 text-white">
                  <tr>
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2" />
                    <td className="border border-slate-950 px-2 py-2 font-extrabold uppercase">
                      Totales
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
                    <td className="border border-slate-950 px-2 py-2 text-right font-bold">{totales.diasMaternidad25}</td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-bold">{totales.diasSueldoCompleto}</td>
                    <td className="border border-slate-950 px-2 py-2 text-right font-bold">{formatoNumero(totales.sueldoMaternidadEmpresa)}</td>
                    <td title="Total informativo; no incluido en el pago de Creditek" className="border border-slate-950 bg-indigo-700 px-2 py-2 text-right font-bold">{formatoNumero(totales.subsidioIessInformativo)}</td>
                    <td className="border border-slate-950" />
                    <td className="border border-slate-950" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      </div>
      {personaNovedad && <NominaNovedadModal persona={personaNovedad} anio={anio} mes={mes}
        novedadIdInicial={personaNovedad.novedadIdEditar}
        ajustesPendientes={{
          ...(Object.hasOwn(cambios, personaNovedad.usuarioId) ? { fondosReservaManual: cambios[personaNovedad.usuarioId] } : {}),
          ...(Object.hasOwn(cambiosExtras, personaNovedad.usuarioId) ? { sueldosExtrasManual: cambiosExtras[personaNovedad.usuarioId] } : {}),
        }}
        onClose={() => setPersonaNovedad(null)} onSaved={() => { setPersonaNovedad(null); cargar({ conservarCambios: true }); }} />}
    </main>
  );
}
