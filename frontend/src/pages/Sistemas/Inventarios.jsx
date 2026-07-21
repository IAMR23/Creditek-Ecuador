/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  Boxes,
  Building2,
  Cable,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Headphones,
  Laptop,
  Monitor,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Smartphone,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { api } from "../../api/client";

let secuenciaItems = 0;

const crearItemFormulario = (data = {}) => ({
  claveTemporal: data.id ? `item-${data.id}` : `nuevo-${secuenciaItems += 1}`,
  id: data.id || null,
  dispositivo: data.dispositivo || "LAPTOP",
  marca: data.marca || "",
  modelo: data.modelo || "",
  precio: data.precio ?? "",
  estado: data.estado || "OPERATIVO",
  observacion: data.observacion || "",
});

const crearFormInicial = () => ({
  responsableId: "",
  agenciaId: "",
  items: [crearItemFormulario()],
});

const filtrosIniciales = {
  q: "",
  agenciaId: "",
  responsableId: "",
  dispositivo: "",
  estado: "",
};

const resumenInicial = {
  items: 0,
  operativos: 0,
  mantenimiento: 0,
  fueraServicio: 0,
  responsables: 0,
};

const estadoConfig = {
  OPERATIVO: {
    label: "Operativo",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    border: "border-t-emerald-500",
  },
  EN_MANTENIMIENTO: {
    label: "En mantenimiento",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    border: "border-t-amber-500",
  },
  FUERA_DE_SERVICIO: {
    label: "Fuera de servicio",
    badge: "border-red-200 bg-red-50 text-red-700",
    border: "border-t-red-500",
  },
};

const iconosDispositivo = {
  LAPTOP: Laptop,
  COMPUTADOR_ESCRITORIO: Monitor,
  AUDIFONOS: Headphones,
  CELULAR: Smartphone,
  CARGADOR_LAPTOP: Cable,
  CARGADOR_CELULAR: Cable,
};

const formatFecha = (value) => {
  if (!value) return "-";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return "-";
  return fecha.toLocaleString("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatPrecio = (value) => {
  if (value === null || value === undefined || value === "") return "Sin precio";

  const precio = Number(value);
  if (!Number.isFinite(precio)) return "Sin precio";

  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(precio);
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

function DispositivoIcono({ value, size = 22 }) {
  const Icono = iconosDispositivo[value] || Boxes;
  return <Icono size={size} />;
}

function StatCard({ label, value, icon, tone = "green" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    gray: "bg-slate-100 text-slate-600",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${tones[tone] || tones.green}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function Inventarios() {
  const [inventarios, setInventarios] = useState([]);
  const [catalogos, setCatalogos] = useState({
    agencias: [],
    responsables: [],
    dispositivos: [],
    estados: [],
  });
  const [resumen, setResumen] = useState(resumenInicial);
  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    limite: 24,
    total: 0,
    totalPaginas: 1,
  });
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState(filtrosIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(crearFormInicial);

  const inventariosAgrupados = useMemo(() => {
    const grupos = new Map();

    inventarios.forEach((item) => {
      const clave = `${item.responsableId || "sin-responsable"}-${
        item.agenciaId || "sin-agencia"
      }`;

      if (!grupos.has(clave)) {
        grupos.set(clave, {
          clave,
          responsable: item.responsable,
          agencia: item.agencia,
          items: [],
        });
      }

      grupos.get(clave).items.push(item);
    });

    return Array.from(grupos.values());
  }, [inventarios]);

  const cargarCatalogos = useCallback(async () => {
    try {
      const { data } = await api.get("/api/sistemas/inventarios/catalogos");
      setCatalogos({
        agencias: data.agencias || [],
        responsables: data.responsables || [],
        dispositivos: data.dispositivos || [],
        estados: data.estados || [],
      });
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudieron cargar los catálogos"),
        "error",
      );
    }
  }, []);

  const cargarInventarios = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/api/sistemas/inventarios", {
        params: {
          pagina,
          limite: paginacion.limite,
          ...Object.fromEntries(
            Object.entries(filtros).filter(([, value]) => value !== ""),
          ),
        },
      });
      setInventarios(data.inventarios || []);
      setResumen(data.resumen || resumenInicial);
      setPaginacion(
        data.paginacion || {
          pagina,
          limite: 24,
          total: 0,
          totalPaginas: 1,
        },
      );
    } catch (error) {
      setInventarios([]);
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo cargar el inventario"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [filtros, pagina, paginacion.limite]);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    cargarInventarios();
  }, [cargarInventarios]);

  const aplicarBusqueda = (event) => {
    event.preventDefault();
    setPagina(1);
    setFiltros((prev) => ({ ...prev, q: busqueda.trim() }));
  };

  const actualizarFiltro = (campo, value) => {
    setPagina(1);
    setFiltros((prev) => ({ ...prev, [campo]: value }));
  };

  const limpiarFiltros = () => {
    setPagina(1);
    setBusqueda("");
    setFiltros(filtrosIniciales);
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm(crearFormInicial());
    setModalAbierto(true);
  };

  const abrirEditar = (item) => {
    setEditando(item);
    setForm({
      responsableId: String(item.responsableId || ""),
      agenciaId: String(item.agenciaId || ""),
      items: [
        crearItemFormulario({
          id: item.id,
          dispositivo: item.dispositivoValor || "LAPTOP",
          marca: item.marca,
          modelo: item.modelo,
          precio: item.precio,
          estado: item.estado,
          observacion: item.observacion,
        }),
      ],
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalAbierto(false);
    setEditando(null);
    setForm(crearFormInicial());
  };

  const agregarItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, crearItemFormulario()],
    }));
  };

  const actualizarItem = (index, campo, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [campo]: value } : item,
      ),
    }));
  };

  const quitarItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const guardar = async (event) => {
    event.preventDefault();

    if (!form.responsableId || !form.agenciaId) {
      Swal.fire(
        "Campos obligatorios",
        "Selecciona primero la persona responsable y la agencia.",
        "warning",
      );
      return;
    }

    if (form.items.length === 0 || form.items.some((item) => !item.dispositivo)) {
      Swal.fire(
        "Dispositivos requeridos",
        "Agrega al menos un dispositivo válido a la asignación.",
        "warning",
      );
      return;
    }

    try {
      setGuardando(true);
      const payload = {
        responsableId: Number(form.responsableId),
        agenciaId: Number(form.agenciaId),
        items: form.items.map((item) => ({
          id: item.id,
          dispositivo: item.dispositivo,
          marca: item.marca,
          modelo: item.modelo,
          precio: item.precio === "" ? null : Number(item.precio),
          estado: item.estado,
          observacion: item.observacion,
        })),
      };

      await api.post("/api/sistemas/inventarios/lote", payload);

      setModalAbierto(false);
      setEditando(null);
      setForm(crearFormInicial());
      await cargarInventarios();
      Swal.fire(
        editando ? "Asignación actualizada" : "Dispositivos asignados",
        `${payload.items.length} ${payload.items.length === 1 ? "ítem fue guardado" : "ítems fueron guardados"} correctamente.`,
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo guardar la asignación"),
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (item) => {
    const confirmacion = await Swal.fire({
      icon: "warning",
      title: "Desactivar ítem",
      text: `Se ocultará ${item.dispositivo} asignado a ${
        item.responsable?.nombre || "la persona responsable"
      }, pero se conservará su historial.`,
      showCancelButton: true,
      confirmButtonText: "Desactivar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await api.delete(`/api/sistemas/inventarios/${item.id}`);
      await cargarInventarios();
      Swal.fire("Ítem desactivado", "El registro ya no aparece en el listado.", "success");
    } catch (error) {
      Swal.fire(
        "Error",
        getErrorMessage(error, "No se pudo desactivar el ítem"),
        "error",
      );
    }
  };

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
  const tableInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Sistemas · Control interno
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Inventario por responsable
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Registra cada equipo como un ítem individual y asígnalo a la persona que lo tiene bajo su responsabilidad.
              </p>
            </div>
            <button
              type="button"
              onClick={abrirNuevo}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <Plus size={18} /> Asignar dispositivos
            </button>
          </div>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Ítems registrados" value={resumen.items} icon={<Boxes size={22} />} />
          <StatCard label="Responsables" value={resumen.responsables} icon={<UserRound size={22} />} tone="gray" />
          <StatCard label="Operativos" value={resumen.operativos} icon={<PackageCheck size={22} />} />
          <StatCard label="Mantenimiento" value={resumen.mantenimiento} icon={<Wrench size={22} />} tone="amber" />
          <StatCard label="Fuera de servicio" value={resumen.fueraServicio} icon={<CircleOff size={22} />} tone="red" />
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(160px,1fr))_auto]">
            <form onSubmit={aplicarBusqueda} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar dispositivo, marca o modelo"
                  className="h-10 w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">
                Buscar
              </button>
            </form>

            <select value={filtros.agenciaId} onChange={(event) => actualizarFiltro("agenciaId", event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500">
              <option value="">Todas las agencias</option>
              {catalogos.agencias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
            <select value={filtros.responsableId} onChange={(event) => actualizarFiltro("responsableId", event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500">
              <option value="">Todos los responsables</option>
              {catalogos.responsables.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
            <select value={filtros.dispositivo} onChange={(event) => actualizarFiltro("dispositivo", event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500">
              <option value="">Todos los dispositivos</option>
              {catalogos.dispositivos.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={filtros.estado} onChange={(event) => actualizarFiltro("estado", event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500">
              <option value="">Todos los estados</option>
              {catalogos.estados.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <button type="button" onClick={limpiarFiltros} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <RefreshCw size={17} /> Limpiar
            </button>
          </div>
        </section>

        {loading ? (
          <div className="mt-5 flex min-h-[260px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
            <RefreshCw className="mr-2 animate-spin text-emerald-600" size={20} /> Cargando inventario...
          </div>
        ) : inventarios.length === 0 ? (
          <div className="mt-5 flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <CircleOff size={40} className="text-slate-300" />
            <h2 className="mt-3 text-lg font-bold text-slate-700">Sin ítems registrados</h2>
            <p className="mt-1 text-sm text-slate-500">Agrega un dispositivo o cambia los filtros aplicados.</p>
          </div>
        ) : (
          <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase text-slate-700">
                  Asignaciones de inventario
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Los equipos están agrupados por responsable y agencia.
                </p>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                {inventariosAgrupados.length}{" "}
                {inventariosAgrupados.length === 1 ? "asignación" : "asignaciones"}
                {" · "}
                {inventarios.length} {inventarios.length === 1 ? "ítem" : "ítems"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1140px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3">Dispositivo</th>
                    <th className="border-b border-slate-200 px-4 py-3">Marca y modelo</th>
                    <th className="border-b border-slate-200 px-4 py-3">Precio</th>
                    <th className="border-b border-slate-200 px-4 py-3">Estado técnico</th>
                    <th className="border-b border-slate-200 px-4 py-3">Observación</th>
                    <th className="border-b border-slate-200 px-4 py-3">Actualización</th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>

                {inventariosAgrupados.map((grupo) => (
                  <tbody key={grupo.clave} className="divide-y divide-slate-100">
                    <tr className="border-t border-slate-200 bg-emerald-50/60 first:border-t-0">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                            <span className="inline-flex items-center gap-2 font-bold text-slate-800">
                              <UserRound size={17} className="text-emerald-600" />
                              {grupo.responsable?.nombre || "Sin responsable"}
                            </span>
                            <span className="inline-flex items-center gap-2 text-slate-600">
                              <Building2 size={17} className="text-emerald-600" />
                              {grupo.agencia?.nombre || "Sin agencia"}
                              {grupo.agencia?.ciudad ? ` · ${grupo.agencia.ciudad}` : ""}
                            </span>
                          </div>
                          <span className="w-fit rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                            {grupo.items.length} {grupo.items.length === 1 ? "equipo" : "equipos"}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {grupo.items.map((item) => {
                      const estado = estadoConfig[item.estado] || estadoConfig.OPERATIVO;

                      return (
                        <tr key={item.id} className="align-middle hover:bg-slate-50/70">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
                                <DispositivoIcono value={item.dispositivoValor} size={18} />
                              </span>
                              <span className="font-semibold text-slate-800">
                                {item.dispositivo}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-700">
                              {item.marca || "Sin marca"}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {item.modelo || "Sin modelo"}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                            {formatPrecio(item.precio)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${estado.badge}`}>
                              {estado.label}
                            </span>
                          </td>
                          <td className="max-w-[320px] whitespace-pre-wrap px-4 py-3 text-slate-600">
                            {item.observacion || "Sin observaciones"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {formatFecha(item.updatedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => abrirEditar(item)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                              >
                                <Pencil size={15} /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => eliminar(item)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                title="Desactivar ítem"
                                aria-label={`Desactivar ${item.dispositivo}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </section>
        )}

        {paginacion.totalPaginas > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina((value) => value - 1)} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 disabled:opacity-40">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-slate-600">
              Página {paginacion.pagina} de {paginacion.totalPaginas}
            </span>
            <button type="button" disabled={pagina >= paginacion.totalPaginas} onClick={() => setPagina((value) => value + 1)} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 disabled:opacity-40">
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-600/40 p-4 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Inventario de Sistemas
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-800">
                  {editando ? "Editar asignación" : "Asignar dispositivos"}
                </h2>
              </div>
              <button type="button" onClick={cerrarModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar formulario">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardar} className="p-5">
              <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    1
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Selecciona a la persona</h3>
                    <p className="text-sm text-slate-600">
                      Todos los ítems agregados quedarán bajo esta responsabilidad.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label>
                    <span className="text-sm font-bold text-slate-700">Persona responsable *</span>
                    <select value={form.responsableId} onChange={(event) => setForm({ ...form, responsableId: event.target.value })} className={inputClass} required>
                      <option value="">Selecciona un responsable</option>
                      {catalogos.responsables.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </label>

                  <label>
                    <span className="text-sm font-bold text-slate-700">Agencia *</span>
                    <select value={form.agenciaId} onChange={(event) => setForm({ ...form, agenciaId: event.target.value })} className={inputClass} required>
                      <option value="">Selecciona una agencia</option>
                      {catalogos.agencias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </label>
                </div>
              </section>

              <section className="mt-6">
                <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                      2
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Agrega los dispositivos</h3>
                      <p className="text-sm text-slate-500">
                        Puedes registrar varios ítems para la misma persona.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={agregarItem}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Plus size={17} /> Agregar otro ítem
                  </button>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1255px] table-fixed text-left">
                      <colgroup>
                        <col className="w-[64px]" />
                        <col className="w-[210px]" />
                        <col className="w-[175px]" />
                        <col className="w-[155px]" />
                        <col className="w-[175px]" />
                        <col className="w-[135px]" />
                        <col className="w-[270px]" />
                        <col className="w-[72px]" />
                      </colgroup>
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-3 py-3 text-center">N.º</th>
                          <th className="px-3 py-3">Dispositivo</th>
                          <th className="px-3 py-3">Estado técnico</th>
                          <th className="px-3 py-3">Marca</th>
                          <th className="px-3 py-3">Modelo</th>
                          <th className="px-3 py-3">Precio</th>
                          <th className="px-3 py-3">Observación</th>
                          <th className="px-3 py-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {form.items.map((item, index) => (
                          <tr key={item.claveTemporal} className="align-top transition hover:bg-emerald-50/40">
                            <td className="px-3 py-3">
                              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
                                <DispositivoIcono value={item.dispositivo} size={18} />
                              </div>
                              <p className="mt-1 text-center text-xs font-bold text-slate-500">
                                {index + 1}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={item.dispositivo}
                                onChange={(event) => actualizarItem(index, "dispositivo", event.target.value)}
                                className={tableInputClass}
                                aria-label={`Dispositivo del ítem ${index + 1}`}
                                required
                              >
                                {catalogos.dispositivos.map((opcion) => (
                                  <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={item.estado}
                                onChange={(event) => actualizarItem(index, "estado", event.target.value)}
                                className={tableInputClass}
                                aria-label={`Estado del ítem ${index + 1}`}
                              >
                                {catalogos.estados.map((opcion) => (
                                  <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                value={item.marca}
                                onChange={(event) => actualizarItem(index, "marca", event.target.value)}
                                maxLength={80}
                                placeholder="Ej. Dell"
                                className={tableInputClass}
                                aria-label={`Marca del ítem ${index + 1}`}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                value={item.modelo}
                                onChange={(event) => actualizarItem(index, "modelo", event.target.value)}
                                maxLength={120}
                                placeholder="Ej. Latitude 5420"
                                className={tableInputClass}
                                aria-label={`Modelo del ítem ${index + 1}`}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={item.precio}
                                onChange={(event) => actualizarItem(index, "precio", event.target.value)}
                                placeholder="0.00"
                                className={tableInputClass}
                                aria-label={`Precio del ítem ${index + 1}`}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <textarea
                                value={item.observacion}
                                onChange={(event) => actualizarItem(index, "observacion", event.target.value)}
                                maxLength={3000}
                                rows={2}
                                placeholder="Novedad del equipo..."
                                className={`${tableInputClass} min-h-[42px] resize-y`}
                                aria-label={`Observación del ítem ${index + 1}`}
                              />
                            </td>
                            <td className="px-3 py-3 text-center">
                              {!item.id && form.items.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => quitarItem(index)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50"
                                  title={`Quitar ítem ${index + 1}`}
                                  aria-label={`Quitar ítem ${index + 1}`}
                                >
                                  <Trash2 size={17} />
                                </button>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={cerrarModal} disabled={guardando} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {guardando ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                  {guardando ? "Guardando..." : "Guardar asignación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
