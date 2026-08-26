import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  Building2,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../../api/client";

const ENDPOINT = "/api/sistemas/reportes-caja-agencias";
const hoyIso = () => {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};
const crearFormInicial = () => ({
  codigoUsuario: "",
  agenciaId: "",
  fechaDesde: hoyIso(),
  fechaHasta: "",
});

const getEstadoVigencia = (item) => {
  if (!item.activo) {
    return { label: "Desactivada", className: "bg-red-50 text-red-700 border-red-200" };
  }
  const hoy = hoyIso();
  if (item.fechaDesde > hoy) {
    return { label: "Programada", className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (item.fechaHasta && item.fechaHasta < hoy) {
    return { label: "Historica", className: "bg-slate-100 text-slate-600 border-slate-200" };
  }
  return { label: "Actual", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

export default function ConfiguracionReportesCaja() {
  const [configuraciones, setConfiguraciones] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [form, setForm] = useState(crearFormInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(ENDPOINT);
      setConfiguraciones(data.configuraciones || []);
      setAgencias(data.agencias || []);
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo cargar la configuracion."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const configuracionesFiltradas = useMemo(() => {
    const filtro = busqueda.trim().toUpperCase();
    if (!filtro) return configuraciones;

    return configuraciones.filter(
      (item) =>
        item.codigoUsuario?.toUpperCase().includes(filtro) ||
        item.agencia?.nombre?.toUpperCase().includes(filtro),
    );
  }, [busqueda, configuraciones]);

  const resumenVigencias = useMemo(
    () =>
      configuraciones.reduce(
        (resumen, item) => {
          const estado = getEstadoVigencia(item).label;
          if (estado === "Actual") resumen.actuales += 1;
          if (estado === "Historica") resumen.historicas += 1;
          if (estado === "Programada") resumen.programadas += 1;
          if (estado === "Desactivada") resumen.desactivadas += 1;
          return resumen;
        },
        { actuales: 0, historicas: 0, programadas: 0, desactivadas: 0 },
      ),
    [configuraciones],
  );

  const limpiarForm = () => {
    setForm(crearFormInicial());
    setEditandoId(null);
  };

  const editar = (item) => {
    setEditandoId(item.id);
    setForm({
      codigoUsuario: item.codigoUsuario,
      agenciaId: String(item.agenciaId),
      fechaDesde: item.fechaDesde,
      fechaHasta: item.fechaHasta || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async (event) => {
    event.preventDefault();
    const payload = {
      codigoUsuario: form.codigoUsuario.trim().toUpperCase(),
      agenciaId: Number(form.agenciaId),
      fechaDesde: form.fechaDesde,
      fechaHasta: form.fechaHasta || null,
    };

    if (!payload.codigoUsuario || !payload.agenciaId || !payload.fechaDesde) {
      Swal.fire(
        "Datos incompletos",
        "Escribe el codigo, selecciona una agencia y define desde que fecha aplica.",
        "warning",
      );
      return;
    }

    setGuardando(true);
    try {
      if (editandoId) {
        await api.put(`${ENDPOINT}/${editandoId}`, payload);
      } else {
        await api.post(ENDPOINT, payload);
      }
      await cargar();
      limpiarForm();
      Swal.fire(
        "Configuracion guardada",
        "El siguiente reporte usara esta asignacion.",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "No se pudo guardar",
        getErrorMessage(error, "Revisa los datos e intenta nuevamente."),
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (item) => {
    const confirmacion = await Swal.fire({
      title: "Desactivar asignacion",
      text: `Se ocultara la vigencia de ${item.codigoUsuario} desde ${item.fechaDesde}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, desactivar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacion.isConfirmed) return;

    try {
      await api.delete(`${ENDPOINT}/${item.id}`);
      if (editandoId === item.id) limpiarForm();
      await cargar();
      Swal.fire("Desactivada", "La asignacion ya no se aplicara.", "success");
    } catch (error) {
      Swal.fire(
        "No se pudo desactivar",
        getErrorMessage(error, "Intenta nuevamente."),
        "error",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Sistemas - Reportes de caja
            </span>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Usuarios por agencia
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Relaciona el codigo de usuario que aparece en el PDF con la agencia
              que debe recibir sus cobros. La coincidencia se realiza aunque el
              reporte agregue texto antes o despues del codigo, respetando la
              vigencia correspondiente a la fecha del cobro.
            </p>
          </div>
          <button
            type="button"
            onClick={cargar}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </header>

        <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={guardar}
            className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                {editandoId ? <Pencil size={20} /> : <Plus size={20} />}
              </div>
              <div>
                <h2 className="font-bold text-slate-900">
                  {editandoId ? "Editar asignacion" : "Nueva asignacion"}
                </h2>
                <p className="text-xs text-slate-500">Un codigo solo puede tener una agencia por periodo.</p>
              </div>
            </div>

            <label className="mt-5 grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Codigo de usuario del PDF
              </span>
              <input
                value={form.codigoUsuario}
                onChange={(event) =>
                  setForm((actual) => ({
                    ...actual,
                    codigoUsuario: event.target.value.toUpperCase().replace(/\s/g, ""),
                  }))
                }
                maxLength={80}
                placeholder="Ej. ALEXFER"
                disabled={guardando}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Vigente desde
                </span>
                <input
                  type="date"
                  value={form.fechaDesde}
                  onChange={(event) =>
                    setForm((actual) => ({ ...actual, fechaDesde: event.target.value }))
                  }
                  disabled={guardando}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Vigente hasta
                </span>
                <input
                  type="date"
                  value={form.fechaHasta}
                  min={form.fechaDesde}
                  onChange={(event) =>
                    setForm((actual) => ({ ...actual, fechaHasta: event.target.value }))
                  }
                  disabled={guardando}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="text-[11px] text-slate-400">Vacia significa sin fecha final.</span>
              </label>
            </div>

            <label className="mt-4 grid gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Agencia representada
              </span>
              <select
                value={form.agenciaId}
                onChange={(event) =>
                  setForm((actual) => ({ ...actual, agenciaId: event.target.value }))
                }
                disabled={guardando}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Selecciona una agencia</option>
                {agencias.map((agencia) => (
                  <option key={agencia.id} value={agencia.id}>
                    {agencia.nombre}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:bg-slate-300"
              >
                {guardando ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarForm}
                  disabled={guardando}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 text-slate-600 hover:bg-slate-50"
                  aria-label="Cancelar edicion"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Historial de asignaciones</h2>
                <p className="text-sm text-slate-500">
                  {resumenVigencias.actuales} actuales | {resumenVigencias.historicas} historicas
                  {resumenVigencias.programadas
                    ? ` | ${resumenVigencias.programadas} programadas`
                    : ""}
                  {resumenVigencias.desactivadas
                    ? ` | ${resumenVigencias.desactivadas} desactivadas`
                    : ""}
                </p>
              </div>
              <label className="relative block sm:w-72">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar usuario o agencia"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500">
                <Loader2 size={20} className="animate-spin" /> Cargando configuracion...
              </div>
            ) : configuracionesFiltradas.length === 0 ? (
              <div className="p-12 text-center">
                <Link2 className="mx-auto text-slate-300" size={34} />
                <p className="mt-3 font-semibold text-slate-700">Sin asignaciones</p>
                <p className="mt-1 text-sm text-slate-500">
                  Agrega un codigo para que deje de clasificarse como OTROS.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Usuario en PDF</th>
                      <th className="px-4 py-3">Agencia</th>
                      <th className="px-4 py-3">Vigencia</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {configuracionesFiltradas.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono font-bold text-slate-800">
                            {item.codigoUsuario}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                            <Building2 size={16} className="text-emerald-600" />
                            {item.agencia?.nombre || "Agencia no disponible"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          <span className="font-medium">{item.fechaDesde}</span>
                          <span className="mx-1 text-slate-400">a</span>
                          <span>{item.fechaHasta || "Sin fin"}</span>
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            const estado = getEstadoVigencia(item);
                            return (
                              <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${estado.className}`}>
                                {estado.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {item.activo ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editar(item)}
                                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminar(item)}
                                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                title="Desactivar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-slate-400">Solo historial</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-bold">Orden de aplicacion</p>
          <p className="mt-1">
            Una excepcion temporal indicada en Extraccion de reportes caja tiene
            prioridad. Si no existe, se usa esta configuracion; los codigos sin
            coincidencia quedan en OTROS.
          </p>
          <p className="mt-2">
            Para cambiar un usuario de agencia, coloca una fecha final en su
            vigencia actual y crea la nueva asignacion desde el dia siguiente.
            Los periodos de un mismo codigo no pueden superponerse.
          </p>
        </section>
      </div>
    </div>
  );
}
