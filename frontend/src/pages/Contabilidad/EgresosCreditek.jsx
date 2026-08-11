import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BadgePercent,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  ListChecks,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const money = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const SECCIONES = [
  {
    id: "entradas",
    label: "Entradas",
    icon: WalletCards,
    active: "border-emerald-600 bg-emerald-50 text-emerald-800",
    iconTone: "bg-emerald-100 text-emerald-700",
    totalTone: "text-emerald-700",
    buttonTone: "bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-200",
  },
  {
    id: "cajas",
    label: "Cajas",
    icon: Banknote,
    active: "border-blue-600 bg-blue-50 text-blue-800",
    iconTone: "bg-blue-100 text-blue-700",
    totalTone: "text-blue-700",
    buttonTone: "bg-blue-700 hover:bg-blue-800 focus:ring-blue-200",
  },
  {
    id: "transferencias",
    label: "Transferencias",
    icon: ArrowLeftRight,
    active: "border-cyan-600 bg-cyan-50 text-cyan-800",
    iconTone: "bg-cyan-100 text-cyan-700",
    totalTone: "text-cyan-700",
    buttonTone: "bg-cyan-700 hover:bg-cyan-800 focus:ring-cyan-200",
  },
  {
    id: "descuentos",
    label: "Descuentos",
    icon: BadgePercent,
    active: "border-amber-500 bg-amber-50 text-amber-900",
    iconTone: "bg-amber-100 text-amber-800",
    totalTone: "text-amber-700",
    buttonTone: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-200",
  },
];

const ACCIONES = {
  CREADO: "Creado",
  EDITADO: "Editado",
  DESACTIVADO: "Desactivado",
  REACTIVADO: "Reactivado",
};

const PERIODOS = [
  { id: "todos", label: "Todos" },
  { id: "hoy", label: "Hoy" },
  { id: "7dias", label: "Últimos 7 días" },
  { id: "mes", label: "Este mes" },
];

const formatoFechaEcuador = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Guayaquil",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fechaEcuadorIso = (value) => {
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "";
  const partes = Object.fromEntries(
    formatoFechaEcuador
      .formatToParts(fecha)
      .filter((parte) => parte.type !== "literal")
      .map((parte) => [parte.type, parte.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
};

const moverFechaIso = (value, dias) => {
  const fecha = new Date(`${value}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizarValor = (value) => {
  const numero = Number(String(value || "").trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
};

const fechaHora = (value) => {
  if (!value) return "-";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "-";
  return fecha.toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Guayaquil",
  });
};

export default function EgresosCreditek() {
  const [usuarios, setUsuarios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [seccionActiva, setSeccionActiva] = useState("entradas");
  const [usuarioId, setUsuarioId] = useState("");
  const [valor, setValor] = useState("");
  const [observacion, setObservacion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState("todos");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [registroEditando, setRegistroEditando] = useState(null);
  const [edicion, setEdicion] = useState({
    usuarioId: "",
    valor: "",
    observacion: "",
  });
  const [actualizandoId, setActualizandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const registrosPeriodo = useMemo(() => {
    if (periodo === "todos") return registros;
    const hoy = fechaEcuadorIso(new Date());
    const inicioSieteDias = moverFechaIso(hoy, -6);

    return registros.filter((registro) => {
      const fechaRegistro = fechaEcuadorIso(registro.createdAt);
      if (periodo === "hoy") return fechaRegistro === hoy;
      if (periodo === "7dias") {
        return fechaRegistro >= inicioSieteDias && fechaRegistro <= hoy;
      }
      if (periodo === "mes") return fechaRegistro.startsWith(hoy.slice(0, 7));
      if (periodo === "fecha") return fechaRegistro === fechaFiltro;
      return true;
    });
  }, [fechaFiltro, periodo, registros]);

  const total = useMemo(
    () =>
      registrosPeriodo.reduce(
        (suma, registro) =>
          registro.activo === false
            ? suma
            : suma + Number(registro.valor || 0),
        0,
      ),
    [registrosPeriodo],
  );
  const activos = registrosPeriodo.filter(
    (registro) => registro.activo !== false,
  ).length;
  const inactivos = registrosPeriodo.length - activos;

  const seccion =
    SECCIONES.find((item) => item.id === seccionActiva) || SECCIONES[0];
  const SeccionIcon = seccion.icon;

  const registrosFiltrados = useMemo(() => {
    const query = normalizarTexto(busqueda.trim());
    if (!query) return registrosPeriodo;

    return registrosPeriodo.filter((registro) =>
      [
        registro.usuario?.nombre,
        registro.observacion,
        registro.registradoPor?.nombre,
        registro.actualizadoPor?.nombre,
        ACCIONES[registro.ultimaAccion],
        registro.activo === false ? "inactivo" : "activo",
      ].some((value) => normalizarTexto(value).includes(query)),
    );
  }, [busqueda, registrosPeriodo]);

  const cargar = useCallback(
    async (seccionId, { silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await api.get(
          `/api/contabilidad/egresos-creditek/${seccionId}`,
        );
        setUsuarios(Array.isArray(data.usuarios) ? data.usuarios : []);
        setRegistros(Array.isArray(data.registros) ? data.registros : []);
      } catch (error) {
        Swal.fire(
          "Error",
          error.response?.data?.message || "No se pudieron cargar los registros.",
          "error",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    cargar("entradas");
  }, [cargar]);

  useEffect(() => {
    if (!registroEditando) return undefined;
    const cerrarConEscape = (event) => {
      if (event.key === "Escape" && actualizandoId === null) {
        setRegistroEditando(null);
      }
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [actualizandoId, registroEditando]);

  const cambiarSeccion = async (seccionId) => {
    if (
      seccionId === seccionActiva ||
      loading ||
      saving ||
      actualizandoId !== null
    ) {
      return;
    }
    setSeccionActiva(seccionId);
    setRegistros([]);
    setValor("");
    setObservacion("");
    setBusqueda("");
    await cargar(seccionId);
  };

  const guardar = async (event) => {
    event.preventDefault();
    const valorNumerico = normalizarValor(valor);
    if (!usuarioId) {
      Swal.fire("Usuario requerido", "Selecciona un usuario.", "warning");
      return;
    }
    if (valorNumerico <= 0) {
      Swal.fire("Valor no valido", "Ingresa un valor mayor a cero.", "warning");
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post(
        `/api/contabilidad/egresos-creditek/${seccionActiva}`,
        { usuarioId: Number(usuarioId), valor, observacion },
      );
      setRegistros((actuales) => [data.registro, ...actuales]);
      setValor("");
      setObservacion("");
      setBusqueda("");
      Swal.fire({
        icon: "success",
        title: "Registro guardado",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar el registro.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const abrirEdicion = (registro) => {
    setRegistroEditando(registro);
    setEdicion({
      usuarioId: String(registro.usuarioId || ""),
      valor: Number(registro.valor || 0).toFixed(2),
      observacion: registro.observacion || "",
    });
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    if (!registroEditando || actualizandoId !== null) return;

    const valorNumerico = normalizarValor(edicion.valor);
    if (!edicion.usuarioId) {
      Swal.fire("Usuario requerido", "Selecciona un usuario.", "warning");
      return;
    }
    if (valorNumerico <= 0) {
      Swal.fire("Valor no válido", "Ingresa un valor mayor a cero.", "warning");
      return;
    }

    try {
      setActualizandoId(registroEditando.id);
      const { data } = await api.put(
        `/api/contabilidad/egresos-creditek/${seccionActiva}/${registroEditando.id}`,
        {
          usuarioId: Number(edicion.usuarioId),
          valor: edicion.valor,
          observacion: edicion.observacion,
        },
      );
      setRegistros((actuales) =>
        actuales.map((registro) =>
          registro.id === data.registro.id ? data.registro : registro,
        ),
      );
      setRegistroEditando(null);
      Swal.fire({
        icon: "success",
        title: "Registro actualizado",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo actualizar el registro.",
        "error",
      );
    } finally {
      setActualizandoId(null);
    }
  };

  const cambiarEstado = async (registro) => {
    if (actualizandoId !== null) return;
    const reactivar = registro.activo === false;
    const accion = reactivar ? "reactivar" : "desactivar";
    const confirmacion = await Swal.fire({
      title: `${reactivar ? "Reactivar" : "Desactivar"} registro`,
      text: reactivar
        ? "El valor volverá a incluirse en el total de la sección."
        : "El registro seguirá visible, pero su valor se excluirá del total.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: "Cancelar",
      confirmButtonColor: reactivar ? "#047857" : "#be123c",
    });
    if (!confirmacion.isConfirmed) return;

    try {
      setActualizandoId(registro.id);
      const { data } = await api.patch(
        `/api/contabilidad/egresos-creditek/${seccionActiva}/${registro.id}/estado`,
        { activo: reactivar },
      );
      setRegistros((actuales) =>
        actuales.map((item) =>
          item.id === data.registro.id ? data.registro : item,
        ),
      );
      Swal.fire({
        icon: "success",
        title: reactivar ? "Registro reactivado" : "Registro desactivado",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cambiar el estado.",
        "error",
      );
    } finally {
      setActualizandoId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Contabilidad <span className="px-1 text-slate-300">/</span> Roles Creditek
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Egresos Creditek
            </h1>
          </div>
          <button
            type="button"
            onClick={() => cargar(seccionActiva)}
            disabled={loading || saving || actualizandoId !== null}
            className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            title="Actualizar registros"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </header>

        <nav
          className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-4"
          aria-label="Secciones de Egresos Creditek"
        >
          {SECCIONES.map((item) => {
            const Icon = item.icon;
            const activa = item.id === seccionActiva;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => cambiarSeccion(item.id)}
                disabled={loading || saving || actualizandoId !== null}
                className={`inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  activa
                    ? item.active
                    : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
                aria-current={activa ? "page" : undefined}
              >
                <Icon size={17} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <span className={`inline-flex size-9 items-center justify-center rounded-md ${seccion.iconTone}`}>
                <SeccionIcon size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-950">Nuevo registro</h2>
                <p className="truncate text-xs font-medium text-slate-500">
                  {seccion.label}
                </p>
              </div>
            </div>

            <form
              onSubmit={guardar}
              className="grid gap-3 p-4 sm:grid-cols-2 sm:items-end sm:p-5 lg:grid-cols-[minmax(220px,1fr)_180px_minmax(240px,1.25fr)_auto]"
            >
              <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700">
                Usuario
                <select
                  value={usuarioId}
                  onChange={(event) => setUsuarioId(event.target.value)}
                  disabled={loading || saving || actualizandoId !== null}
                  className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Seleccionar usuario</option>
                  {usuarios.map((usuario) => (
                    <option key={usuario.id} value={usuario.id}>
                      {usuario.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                Valor
                <span className="relative block">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-400">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (/^\d*([.,]\d{0,2})?$/.test(next)) setValor(next);
                    }}
                    disabled={saving || actualizandoId !== null}
                    placeholder="0,00"
                    className="h-10 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-right text-sm font-bold text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </span>
              </label>

              <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-1">
                Observación
                <input
                  type="text"
                  value={observacion}
                  onChange={(event) => setObservacion(event.target.value)}
                  disabled={saving || actualizandoId !== null}
                  maxLength={1000}
                  placeholder="Motivo o detalle opcional"
                  className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <button
                type="submit"
                disabled={saving || loading || actualizandoId !== null}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 lg:col-span-1 ${seccion.buttonTone}`}
              >
                {saving ? (
                  <RefreshCw size={17} className="animate-spin" />
                ) : (
                  <Plus size={17} />
                )}
                Registrar
              </button>
            </form>
          </section>

          <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Total activo
                </p>
                <p className={`mt-2 truncate text-2xl font-bold ${seccion.totalTone}`}>
                  {money.format(total)}
                </p>
              </div>
              <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md ${seccion.iconTone}`}>
                <CircleDollarSign size={20} />
              </span>
            </div>
            <div className="grid grid-cols-2 border-t border-slate-200 bg-slate-50 xl:grid-cols-1 xl:divide-y xl:divide-slate-200">
              <div className="border-r border-slate-200 px-4 py-3 xl:border-r-0">
                <p className="text-[11px] font-semibold uppercase text-slate-500">Estado</p>
                <p className="mt-1 text-sm font-bold text-slate-950">
                  {activos} activos
                </p>
                <p className="text-xs text-slate-500">{inactivos} inactivos</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-semibold uppercase text-slate-500">Último registro</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                  {registrosPeriodo[0]
                    ? fechaHora(registrosPeriodo[0].createdAt)
                    : "Sin actividad"}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <ListChecks size={17} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-slate-950">
                  Historial de {seccion.label.toLowerCase()}
                </h2>
                <p className="text-xs text-slate-500">
                  {busqueda
                    ? `${registrosFiltrados.length} de ${registrosPeriodo.length} registros`
                    : periodo === "todos"
                      ? `${registros.length} registros`
                      : `${registrosPeriodo.length} de ${registros.length} registros`}
                </p>
              </div>
            </div>

            <label className="relative block w-full sm:w-72">
              <span className="sr-only">Buscar registros</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar usuario u observación"
                className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Limpiar búsqueda"
                  aria-label="Limpiar búsqueda"
                >
                  <X size={15} />
                </button>
              )}
            </label>
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <CalendarDays size={15} className="text-slate-400" />
                Período
              </span>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-300 bg-white p-1 sm:flex">
                {PERIODOS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setPeriodo(item.id);
                      setFechaFiltro("");
                    }}
                    className={`h-8 rounded px-3 text-xs font-semibold transition-colors ${
                      periodo === item.id
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                    aria-pressed={periodo === item.id}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              Fecha
              <input
                type="date"
                value={fechaFiltro}
                max={fechaEcuadorIso(new Date())}
                onChange={(event) => {
                  const next = event.target.value;
                  setFechaFiltro(next);
                  setPeriodo(next ? "fecha" : "todos");
                }}
                className={`h-9 min-w-0 rounded-md border bg-white px-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${
                  periodo === "fecha"
                    ? "border-slate-500 text-slate-950"
                    : "border-slate-300 text-slate-600"
                }`}
              />
            </label>
          </div>

          {loading ? (
            <div className="divide-y divide-slate-100" aria-label="Cargando registros">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="grid animate-pulse gap-3 px-4 py-4 sm:grid-cols-3 lg:grid-cols-5"
                >
                  <span className="h-4 rounded bg-slate-100" />
                  <span className="h-4 rounded bg-slate-100" />
                  <span className="h-4 rounded bg-slate-100" />
                  <span className="h-4 rounded bg-slate-100" />
                  <span className="h-4 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : registros.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 py-10 text-center">
              <span className="inline-flex size-11 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                <SeccionIcon size={21} />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-700">Sin registros</p>
              <p className="mt-1 text-xs text-slate-500">
                No existen movimientos en {seccion.label.toLowerCase()}.
              </p>
            </div>
          ) : registrosPeriodo.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 py-10 text-center">
              <CalendarDays size={22} className="text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                Sin registros en este período
              </p>
              <button
                type="button"
                onClick={() => {
                  setPeriodo("todos");
                  setFechaFiltro("");
                }}
                className="mt-3 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
              >
                Ver todos los registros
              </button>
            </div>
          ) : registrosFiltrados.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-4 py-10 text-center">
              <Search size={22} className="text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Sin coincidencias</p>
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="mt-3 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div>
              <div className="hidden grid-cols-[minmax(0,1fr)_110px_92px_minmax(0,1.15fr)_minmax(180px,1.1fr)_84px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase text-slate-500 lg:grid">
                <span>Usuario</span>
                <span className="text-right">Valor</span>
                <span>Estado</span>
                <span>Observación</span>
                <span>Trazabilidad</span>
                <span className="text-right">Acciones</span>
              </div>
              <div className="divide-y divide-slate-100">
                {registrosFiltrados.map((registro) => (
                  <article
                    key={registro.id}
                    className={`grid min-w-0 gap-x-4 gap-y-3 px-4 py-3.5 text-sm transition-colors sm:grid-cols-2 sm:px-5 lg:grid-cols-[minmax(0,1fr)_110px_92px_minmax(0,1.15fr)_minmax(180px,1.1fr)_84px] lg:items-center ${
                      registro.activo === false
                        ? "bg-slate-50/80"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 lg:hidden">Usuario</p>
                      <p className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
                        <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md ${seccion.iconTone}`}>
                          <UserRound size={14} />
                        </span>
                        <span className="truncate">
                          {registro.usuario?.nombre || `Usuario #${registro.usuarioId}`}
                        </span>
                      </p>
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 lg:hidden">Valor</p>
                      <p
                        className={`font-bold tabular-nums ${
                          registro.activo === false
                            ? "text-slate-400 line-through"
                            : "text-slate-950"
                        }`}
                      >
                        {money.format(Number(registro.valor || 0))}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 lg:hidden">Estado</p>
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                          registro.activo === false
                            ? "border-slate-300 bg-slate-100 text-slate-600"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {registro.activo === false ? "Inactivo" : "Activo"}
                      </span>
                    </div>
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 lg:hidden">Observación</p>
                      <p className="break-words text-xs leading-5 text-slate-600">
                        {registro.observacion || "Sin observación"}
                      </p>
                    </div>
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 lg:hidden">Trazabilidad</p>
                      <div className="space-y-1 text-[11px] leading-4 text-slate-500">
                        <p className="truncate">
                          <span className="font-semibold text-slate-700">Creado</span>
                          {` por ${registro.registradoPor?.nombre || "-"}`}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Clock3 size={12} className="shrink-0" />
                          <span className="truncate">{fechaHora(registro.createdAt)}</span>
                        </p>
                        {registro.actualizadoPor && (
                          <div className="mt-1 border-t border-slate-200 pt-1">
                            <p className="truncate">
                              <span className="font-semibold text-slate-700">
                                {ACCIONES[registro.ultimaAccion] || "Actualizado"}
                              </span>
                              {` por ${registro.actualizadoPor.nombre}`}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Clock3 size={12} className="shrink-0" />
                              <span className="truncate">{fechaHora(registro.updatedAt)}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 lg:hidden">Acciones</p>
                      <div className="mt-1 flex items-center gap-1 lg:mt-0 lg:justify-end">
                        <button
                        type="button"
                        onClick={() => abrirEdicion(registro)}
                        disabled={actualizandoId !== null}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Editar registro"
                        aria-label="Editar registro"
                      >
                        <Pencil size={15} />
                        </button>
                        <button
                        type="button"
                        onClick={() => cambiarEstado(registro)}
                        disabled={actualizandoId !== null}
                        className={`inline-flex size-8 items-center justify-center rounded-md border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          registro.activo === false
                            ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            : "border-rose-200 text-rose-700 hover:bg-rose-50"
                        }`}
                        title={registro.activo === false ? "Reactivar registro" : "Desactivar registro"}
                        aria-label={registro.activo === false ? "Reactivar registro" : "Desactivar registro"}
                      >
                        {actualizandoId === registro.id ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : registro.activo === false ? (
                          <RotateCcw size={15} />
                        ) : (
                          <Power size={15} />
                        )}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                <span className="text-xs font-semibold uppercase text-slate-500">Total activo</span>
                <span className={`text-lg font-bold tabular-nums ${seccion.totalTone}`}>
                  {money.format(total)}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      {registroEditando && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="editar-egreso-titulo"
        >
          <section className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md ${seccion.iconTone}`}>
                  <Pencil size={17} />
                </span>
                <div className="min-w-0">
                  <h2 id="editar-egreso-titulo" className="text-sm font-bold text-slate-950">
                    Editar registro
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {seccion.label} · Registro #{registroEditando.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegistroEditando(null)}
                disabled={actualizandoId !== null}
                className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:opacity-50"
                title="Cerrar"
                aria-label="Cerrar edición"
              >
                <X size={17} />
              </button>
            </header>

            <form onSubmit={guardarEdicion}>
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
                  Usuario
                  <select
                    value={edicion.usuarioId}
                    onChange={(event) =>
                      setEdicion((actual) => ({
                        ...actual,
                        usuarioId: event.target.value,
                      }))
                    }
                    disabled={actualizandoId !== null}
                    className="h-10 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    {registroEditando.usuario &&
                      !usuarios.some(
                        (usuario) => usuario.id === registroEditando.usuarioId,
                      ) && (
                        <option value={registroEditando.usuarioId}>
                          {registroEditando.usuario.nombre} (inactivo)
                        </option>
                      )}
                    {usuarios.map((usuario) => (
                      <option key={usuario.id} value={usuario.id}>
                        {usuario.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                  Valor
                  <span className="relative block">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-semibold text-slate-400">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={edicion.valor}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (/^\d*([.,]\d{0,2})?$/.test(next)) {
                          setEdicion((actual) => ({ ...actual, valor: next }));
                        }
                      }}
                      disabled={actualizandoId !== null}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-right text-sm font-bold text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </span>
                </label>

                <div className="grid content-end gap-1.5 text-xs font-semibold text-slate-700">
                  Estado
                  <span
                    className={`inline-flex h-10 items-center rounded-md border px-3 text-sm ${
                      registroEditando.activo === false
                        ? "border-slate-300 bg-slate-100 text-slate-600"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {registroEditando.activo === false ? "Inactivo" : "Activo"}
                  </span>
                </div>

                <label className="grid gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
                  Observación
                  <textarea
                    value={edicion.observacion}
                    onChange={(event) =>
                      setEdicion((actual) => ({
                        ...actual,
                        observacion: event.target.value,
                      }))
                    }
                    disabled={actualizandoId !== null}
                    maxLength={1000}
                    rows={4}
                    placeholder="Motivo o detalle opcional"
                    className="min-h-24 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>

              <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => setRegistroEditando(null)}
                  disabled={actualizandoId !== null}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actualizandoId !== null}
                  className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${seccion.buttonTone}`}
                >
                  {actualizandoId !== null ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Guardar cambios
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
