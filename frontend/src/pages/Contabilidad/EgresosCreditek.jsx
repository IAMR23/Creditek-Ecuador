import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BadgePercent,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import {
  descargarExcelEgresosCreditek,
  descargarExcelRubroEgresosCreditek,
  descargarPdfEgresosCreditek,
  SECCIONES_REPORTE_EGRESOS,
} from "../../utils/egresosCreditekExport";

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
  {
    id: "jefes",
    label: "Jefes",
    icon: UserRound,
    active: "border-violet-600 bg-violet-50 text-violet-800",
    iconTone: "bg-violet-100 text-violet-700",
    totalTone: "text-violet-700",
    buttonTone: "bg-violet-700 hover:bg-violet-800 focus:ring-violet-200",
  },
  {
    id: "multas_facturacion",
    label: "Multas facturacion",
    icon: BadgePercent,
    active: "border-rose-600 bg-rose-50 text-rose-800",
    iconTone: "bg-rose-100 text-rose-700",
    totalTone: "text-rose-700",
    buttonTone: "bg-rose-700 hover:bg-rose-800 focus:ring-rose-200",
  },
  {
    id: "otros",
    label: "Otros",
    icon: CircleDollarSign,
    active: "border-slate-700 bg-slate-100 text-slate-950",
    iconTone: "bg-slate-100 text-slate-700",
    totalTone: "text-slate-800",
    buttonTone: "bg-slate-800 hover:bg-slate-900 focus:ring-slate-200",
  },
];

const SECCIONES_CON_FECHA = new Set(SECCIONES.map((seccion) => seccion.id));

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

const requiereFechaRegistro = (seccionId) =>
  SECCIONES_CON_FECHA.has(seccionId);

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

const ORIGEN_CONTROL_FINANCIERO_CAJA = "CONTROL_FINANCIERO_CAJA";

const esCajaControlFinanciero = (registro) =>
  registro?.origen === ORIGEN_CONTROL_FINANCIERO_CAJA;

const esRegistroControlFinanciero = esCajaControlFinanciero;

export default function EgresosCreditek() {
  const [usuarios, setUsuarios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [seccionActiva, setSeccionActiva] = useState("entradas");
  const [usuarioId, setUsuarioId] = useState("");
  const [valor, setValor] = useState("");
  const [observacion, setObservacion] = useState("");
  const [fechaRegistro, setFechaRegistro] = useState(fechaEcuadorIso(new Date()));
  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState("todos");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [registroEditando, setRegistroEditando] = useState(null);
  const [edicion, setEdicion] = useState({
    usuarioId: "",
    valor: "",
    observacion: "",
    fecha: "",
    estadoPagoEntrada: "PENDIENTE",
  });
  const [actualizandoId, setActualizandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportando, setExportando] = useState(null);

  const registrosPeriodo = useMemo(() => {
    if (periodo === "todos") return registros;
    const hoy = fechaEcuadorIso(new Date());
    const inicioSieteDias = moverFechaIso(hoy, -6);

    return registros.filter((registro) => {
      const fechaBase =
        requiereFechaRegistro(seccionActiva) && registro.fecha
          ? registro.fecha
          : fechaEcuadorIso(registro.createdAt);
      if (periodo === "hoy") return fechaBase === hoy;
      if (periodo === "7dias") {
        return fechaBase >= inicioSieteDias && fechaBase <= hoy;
      }
      if (periodo === "mes") return fechaBase.startsWith(hoy.slice(0, 7));
      if (periodo === "fecha") return fechaBase === fechaFiltro;
      return true;
    });
  }, [fechaFiltro, periodo, registros, seccionActiva]);

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
  const seccionRequiereFecha = requiereFechaRegistro(seccionActiva);
  const historialGridClass =
    "xl:grid-cols-[minmax(180px,1.15fr)_110px_120px_100px_minmax(180px,1.15fr)_minmax(190px,1fr)_88px]";
  const editandoControlFinanciero =
    registroEditando && esRegistroControlFinanciero(registroEditando);

  const registrosFiltrados = useMemo(() => {
    const query = normalizarTexto(busqueda.trim());
    if (!query) return registrosPeriodo;

    return registrosPeriodo.filter((registro) =>
      [
        registro.usuario?.nombre,
        registro.observacion,
        registro.fecha,
        registro.registradoPor?.nombre,
        registro.actualizadoPor?.nombre,
        ACCIONES[registro.ultimaAccion],
        esRegistroControlFinanciero(registro) ? "control financiero" : "manual",
        registro.estadoPagoEntrada,
        registro.tipoProductoEntrada,
        registro.contrato,
        registro.cliente,
        registro.vendedor,
        registro.modelo,
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
    setFechaRegistro(fechaEcuadorIso(new Date()));
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
    if (seccionRequiereFecha && !fechaRegistro) {
      Swal.fire("Fecha requerida", "Ingresa la fecha de la sanción.", "warning");
      return;
    }

    try {
      setSaving(true);
      const { data } = await api.post(
        `/api/contabilidad/egresos-creditek/${seccionActiva}`,
        {
          usuarioId: Number(usuarioId),
          valor,
          observacion,
          ...(seccionRequiereFecha ? { fecha: fechaRegistro } : {}),
        },
      );
      setRegistros((actuales) => [data.registro, ...actuales]);
      setValor("");
      setObservacion("");
      setFechaRegistro(fechaEcuadorIso(new Date()));
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
      fecha: registro.fecha || fechaEcuadorIso(new Date()),
      estadoPagoEntrada: registro.estadoPagoEntrada || "PENDIENTE",
    });
  };

  const guardarEdicion = async (event) => {
    event?.preventDefault();
    if (!registroEditando || actualizandoId !== null) return;

    const esVinculado = esRegistroControlFinanciero(registroEditando);
    const esCajaVinculada = esCajaControlFinanciero(registroEditando);
    const valorNumerico = normalizarValor(edicion.valor);
    if (!edicion.usuarioId) {
      Swal.fire(
        esVinculado ? "Responsable requerido" : "Usuario requerido",
        esVinculado ? "Selecciona un responsable." : "Selecciona un usuario.",
        "warning",
      );
      return;
    }
    if (!esVinculado && valorNumerico <= 0) {
      Swal.fire("Valor no válido", "Ingresa un valor mayor a cero.", "warning");
      return;
    }

    if (!esVinculado && seccionRequiereFecha && !edicion.fecha) {
      Swal.fire("Fecha requerida", "Ingresa la fecha de la sanción.", "warning");
      return;
    }

    try {
      setActualizandoId(registroEditando.id);
      if (esVinculado) {
        const { data } = await api.patch(
          esCajaVinculada
            ? `/api/contabilidad/control-financiero/registros/${registroEditando.controlFinancieroRegistroId}/gestion-caja-no-en-cierre`
            : `/api/contabilidad/control-financiero/registros/${registroEditando.controlFinancieroRegistroId}/pago-entrada`,
          esCajaVinculada
            ? {
                responsableUsuarioId: Number(edicion.usuarioId),
                observacion: edicion.observacion,
                estado: edicion.estadoPagoEntrada,
              }
            : {
                estado: edicion.estadoPagoEntrada,
                responsableUsuarioId: Number(edicion.usuarioId),
                observacion: edicion.observacion,
              },
        );
        const registroControl = data.registro || {};
        const registroActualizado = {
          ...registroEditando,
          usuarioId: registroControl.responsablePagoEntradaId,
          usuario: registroControl.responsablePagoEntrada || null,
          valor: Number(
            esCajaVinculada
              ? registroControl.pagosCuotas || registroEditando.valor || 0
              : registroControl.entradas || registroEditando.valor || 0,
          ),
          observacion: registroControl.observacionPagoEntrada || "",
          estadoPagoEntrada:
            registroControl.estadoPagoEntrada || edicion.estadoPagoEntrada,
          actualizadoPor:
            registroControl.responsablePagoEntrada ||
            registroEditando.actualizadoPor,
          updatedAt: registroControl.updatedAt || new Date().toISOString(),
        };
        setRegistros((actuales) =>
          actuales.map((registro) =>
            registro.id === registroEditando.id ? registroActualizado : registro,
          ),
        );
      } else {
        const { data } = await api.put(
          `/api/contabilidad/egresos-creditek/${seccionActiva}/${registroEditando.id}`,
          {
            usuarioId: Number(edicion.usuarioId),
            valor: edicion.valor,
            observacion: edicion.observacion,
            ...(seccionRequiereFecha ? { fecha: edicion.fecha } : {}),
          },
        );
        setRegistros((actuales) =>
          actuales.map((registro) =>
            registro.id === data.registro.id ? data.registro : registro,
          ),
        );
      }
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

  const eliminarRegistro = async (registro) => {
    if (actualizandoId !== null || esRegistroControlFinanciero(registro)) return;
    const confirmacion = await Swal.fire({
      title: "Eliminar registro",
      html: `Se eliminará definitivamente el registro de <strong>${registro.usuario?.nombre || `Usuario #${registro.usuarioId}`}</strong> por <strong>${money.format(Number(registro.valor || 0))}</strong>. Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#be123c",
      focusCancel: true,
    });
    if (!confirmacion.isConfirmed) return;

    try {
      setActualizandoId(registro.id);
      await api.delete(
        `/api/contabilidad/egresos-creditek/${seccionActiva}/${registro.id}`,
      );
      setRegistros((actuales) =>
        actuales.filter((item) => item.id !== registro.id),
      );
      Swal.fire({
        icon: "success",
        title: "Registro eliminado",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo eliminar el registro.",
        "error",
      );
    } finally {
      setActualizandoId(null);
    }
  };

  const descargarReporte = async (formato) => {
    if (exportando) return;

    try {
      setExportando(formato);
      if (formato === "excel-hoja") {
        const rubro = SECCIONES_REPORTE_EGRESOS.find(
          (item) => item.id === seccionActiva,
        );
        const { data } = await api.get(
          `/api/contabilidad/egresos-creditek/${seccionActiva}`,
        );
        await descargarExcelRubroEgresosCreditek({
          ...rubro,
          registros: Array.isArray(data?.registros) ? data.registros : [],
        });
        return;
      }

      const respuestas = await Promise.all(
        SECCIONES_REPORTE_EGRESOS.map((item) =>
          api.get(`/api/contabilidad/egresos-creditek/${item.id}`),
        ),
      );
      const datosSecciones = SECCIONES_REPORTE_EGRESOS.map((item, index) => ({
        ...item,
        registros: Array.isArray(respuestas[index]?.data?.registros)
          ? respuestas[index].data.registros
          : [],
      }));

      if (formato === "excel") {
        await descargarExcelEgresosCreditek(datosSecciones);
      } else {
        descargarPdfEgresosCreditek(datosSecciones);
      }
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo generar el reporte de egresos.",
        "error",
      );
    } finally {
      setExportando(null);
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
          <div className="grid w-full grid-cols-2 gap-2 self-start sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => descargarReporte("excel")}
              disabled={loading || saving || actualizandoId !== null || exportando !== null}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Descargar las siete secciones en Excel"
            >
              {exportando === "excel" ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={16} />
              )}
              Excel general
            </button>
            <button
              type="button"
              onClick={() => descargarReporte("excel-hoja")}
              disabled={loading || saving || actualizandoId !== null || exportando !== null}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-3 text-sm font-semibold text-cyan-700 shadow-sm transition-colors hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={`Descargar solamente la hoja de ${seccion.label}`}
            >
              {exportando === "excel-hoja" ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={16} />
              )}
              Excel hoja actual
            </button>
            <button
              type="button"
              onClick={() => descargarReporte("pdf")}
              disabled={loading || saving || actualizandoId !== null || exportando !== null}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Descargar las siete secciones en PDF"
            >
              {exportando === "pdf" ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <FileText size={16} />
              )}
              PDF
            </button>
            <button
              type="button"
              onClick={() => cargar(seccionActiva)}
              disabled={loading || saving || actualizandoId !== null || exportando !== null}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Actualizar registros"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </header>

        <nav
          className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
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
                className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md border px-2 py-2 text-center text-xs font-semibold leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm ${
                  activa
                    ? item.active
                    : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
                aria-current={activa ? "page" : undefined}
              >
                <Icon size={17} className="shrink-0" />
                <span className="whitespace-normal">{item.label}</span>
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
              className="grid gap-3 p-4 sm:grid-cols-2 sm:items-end sm:p-5 lg:grid-cols-12"
            >
              <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700 lg:col-span-3">
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

              <label className="grid gap-1.5 text-xs font-semibold text-slate-700 lg:col-span-2">
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

              {seccionRequiereFecha && (
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700 lg:col-span-2">
                  Fecha de sanción
                  <input
                    type="date"
                    value={fechaRegistro}
                    onChange={(event) => setFechaRegistro(event.target.value)}
                    disabled={saving || actualizandoId !== null}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              )}

              <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">
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
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 lg:col-span-2 ${seccion.buttonTone}`}
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
                <p className="text-[11px] font-semibold uppercase text-slate-500">Última sanción</p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                  {registrosPeriodo[0]
                    ? registrosPeriodo[0].fecha || fechaHora(registrosPeriodo[0].createdAt)
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

            <label className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-slate-600 sm:w-auto sm:justify-start">
              Fecha sanción
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
                  className="grid animate-pulse gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-7"
                >
                  <span className="h-4 rounded bg-slate-100" />
                  <span className="h-4 rounded bg-slate-100" />
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
                No existen sanciones registradas en {seccion.label.toLowerCase()}.
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
              <div className={`hidden gap-4 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase text-slate-500 xl:grid ${historialGridClass}`}>
                <span>Usuario</span>
                <span className="text-right">Valor</span>
                {seccionRequiereFecha && <span>Fecha sanción</span>}
                <span>Estado</span>
                <span>Observación</span>
                <span>Trazabilidad</span>
                <span className="text-right">Acciones</span>
              </div>
              <div className="divide-y divide-slate-100">
                {registrosFiltrados.map((registro) => (
                  <article
                    key={registro.id}
                    className={`grid min-w-0 gap-x-4 gap-y-3 px-4 py-3.5 text-sm transition-colors sm:grid-cols-2 sm:px-5 xl:items-center ${historialGridClass} ${
                      registro.activo === false
                        ? "bg-slate-50/80"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">Usuario</p>
                      <p className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
                        <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md ${seccion.iconTone}`}>
                          <UserRound size={14} />
                        </span>
                        <span className="truncate">
                          {registro.usuario?.nombre ||
                            (esRegistroControlFinanciero(registro)
                              ? "Sin responsable"
                              : `Usuario #${registro.usuarioId}`)}
                        </span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                            esRegistroControlFinanciero(registro)
                              ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                          }`}
                        >
                          {esRegistroControlFinanciero(registro)
                            ? "Control financiero"
                            : "Manual"}
                        </span>
                        {esRegistroControlFinanciero(registro) && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                            {esCajaControlFinanciero(registro)
                              ? "Caja no en cierre"
                              : registro.tipoProductoEntrada}
                          </span>
                        )}
                      </div>
                      {esRegistroControlFinanciero(registro) && (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {registro.contrato
                            ? `Contrato ${registro.contrato}`
                            : "Contrato no disponible"}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">Valor</p>
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
                    {seccionRequiereFecha && (
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">Fecha sanción</p>
                        <p className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          <CalendarDays size={13} className="shrink-0 text-slate-400" />
                          {registro.fecha || "-"}
                        </p>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">Estado</p>
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${
                          esRegistroControlFinanciero(registro)
                            ? registro.estadoPagoEntrada === "PAGADO"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                            : registro.activo === false
                              ? "border-slate-300 bg-slate-100 text-slate-600"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {esRegistroControlFinanciero(registro)
                          ? registro.estadoPagoEntrada || "PENDIENTE"
                          : registro.activo === false
                            ? "Inactivo"
                            : "Activo"}
                      </span>
                    </div>
                    <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">Observación</p>
                      <p className="break-words text-xs leading-5 text-slate-600">
                        {registro.observacion || "Sin observación"}
                      </p>
                      {esRegistroControlFinanciero(registro) && (
                        <p className="mt-1 truncate text-[11px] text-slate-500">
                          {registro.cliente || "Cliente no disponible"}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">Trazabilidad</p>
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
                    <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                      <p className="text-[10px] font-semibold uppercase text-slate-400 xl:hidden">Acciones</p>
                      <div className="mt-1 flex items-center gap-1 xl:mt-0 xl:justify-end">
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
                        {!esRegistroControlFinanciero(registro) && (
                          <button
                            type="button"
                            onClick={() => eliminarRegistro(registro)}
                            disabled={actualizandoId !== null}
                            className="inline-flex size-8 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Eliminar registro"
                            aria-label="Eliminar registro"
                          >
                            {actualizandoId === registro.id ? (
                              <RefreshCw size={15} className="animate-spin" />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        )}
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
          <section className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
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
                  {editandoControlFinanciero ? "Responsable" : "Usuario"}
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
                    <option value="">
                      {editandoControlFinanciero
                        ? "Seleccionar responsable"
                        : "Seleccionar usuario"}
                    </option>
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
                      disabled={
                        actualizandoId !== null || editandoControlFinanciero
                      }
                      className={`h-10 w-full rounded-md border border-slate-300 pl-8 pr-3 text-right text-sm font-bold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${
                        editandoControlFinanciero
                          ? "bg-slate-50 text-slate-500"
                          : "bg-white text-slate-950"
                      }`}
                    />
                  </span>
                </label>

                {seccionRequiereFecha && (
                  <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
                    Fecha de sanción
                    <input
                      type="date"
                      value={edicion.fecha}
                      onChange={(event) =>
                        setEdicion((actual) => ({
                          ...actual,
                          fecha: event.target.value,
                        }))
                      }
                      disabled={actualizandoId !== null || editandoControlFinanciero}
                      className={`h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 ${
                        editandoControlFinanciero
                          ? "bg-slate-50 text-slate-500"
                          : "bg-white text-slate-900"
                      }`}
                    />
                  </label>
                )}

                <div className="grid content-end gap-1.5 text-xs font-semibold text-slate-700">
                  {editandoControlFinanciero ? "Estado de pago" : "Estado"}
                  {editandoControlFinanciero ? (
                    <select
                      value={edicion.estadoPagoEntrada}
                      onChange={(event) =>
                        setEdicion((actual) => ({
                          ...actual,
                          estadoPagoEntrada: event.target.value,
                        }))
                      }
                      disabled={actualizandoId !== null}
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="PAGADO">PAGADO</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-flex h-10 items-center rounded-md border px-3 text-sm ${
                        registroEditando.activo === false
                          ? "border-slate-300 bg-slate-100 text-slate-600"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {registroEditando.activo === false ? "Inactivo" : "Activo"}
                    </span>
                  )}
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

              <footer className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex sm:items-center sm:justify-end sm:px-5">
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
