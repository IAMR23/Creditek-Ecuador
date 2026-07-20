/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
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
    badge: "border-green-200 bg-green-50 text-green-700",
    border: "border-t-green-500",
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

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

function DispositivoIcono({ value, size = 22 }) {
  const Icono = iconosDispositivo[value] || Boxes;
  return <Icono size={size} />;
}

function StatCard({ label, value, icon, tone = "green" }) {
  const tones = {
    green: "bg-green-100 text-green-700",
    gray: "bg-gray-100 text-gray-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <p className="mt-1 text-3xl font-black text-gray-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${tones[tone] || tones.green}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function InventarioCard({ item, onEdit, onDelete }) {
  const estado = estadoConfig[item.estado] || estadoConfig.OPERATIVO;
  const detalleEquipo = [item.marca, item.modelo].filter(Boolean).join(" · ");

  return (
    <article
      className={`flex min-h-[340px] flex-col rounded-2xl border border-t-4 border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${estado.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex rounded-xl bg-gray-900 p-3 text-green-400">
          <DispositivoIcono value={item.dispositivoValor} size={24} />
        </span>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${estado.badge}`}>
          {estado.label}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-green-600">
          Dispositivo
        </p>
        <h2 className="mt-1 text-xl font-black text-gray-900">{item.dispositivo}</h2>
        <p className="mt-1 min-h-5 text-sm font-medium text-gray-500">
          {detalleEquipo || "Sin marca o modelo registrado"}
        </p>
      </div>

      <div className="mt-5 space-y-3 text-sm text-gray-700">
        <p className="flex items-center gap-2">
          <Building2 size={17} className="shrink-0 text-green-600" />
          <span className="truncate font-medium">
            {item.agencia?.nombre || "Sin agencia"}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <UserRound size={17} className="shrink-0 text-green-600" />
          <span className="truncate">
            {item.responsable?.nombre || "Sin responsable"}
          </span>
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
        <p className="line-clamp-3 min-h-[60px]">
          {item.observacion || "Sin observaciones registradas."}
        </p>
      </div>

      <div className="mt-auto pt-4">
        <p className="mb-3 text-right text-xs text-gray-400">
          Actualizado {formatFecha(item.updatedAt)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-green-700"
          >
            <Pencil size={16} /> Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="inline-flex items-center justify-center rounded-xl border border-red-200 px-3 py-2 text-red-600 transition hover:bg-red-50"
            title="Desactivar ítem"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    </article>
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
    "mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100";
  const tableInputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100";

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="overflow-hidden rounded-3xl border border-green-500/30 bg-gray-900 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-green-400">
                Sistemas · Control interno
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Inventario por responsable
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-300 sm:text-base">
                Registra cada equipo como un ítem individual y asígnalo a la persona que lo tiene bajo su responsabilidad.
              </p>
            </div>
            <button
              type="button"
              onClick={abrirNuevo}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-5 py-3 font-black text-gray-950 shadow transition hover:bg-green-400"
            >
              <Plus size={20} /> Asignar dispositivos
            </button>
          </div>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Ítems registrados" value={resumen.items} icon={<Boxes size={22} />} />
          <StatCard label="Responsables" value={resumen.responsables} icon={<UserRound size={22} />} tone="gray" />
          <StatCard label="Operativos" value={resumen.operativos} icon={<PackageCheck size={22} />} />
          <StatCard label="Mantenimiento" value={resumen.mantenimiento} icon={<Wrench size={22} />} tone="amber" />
          <StatCard label="Fuera de servicio" value={resumen.fueraServicio} icon={<CircleOff size={22} />} tone="red" />
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.5fr)_repeat(4,minmax(160px,1fr))_auto]">
            <form onSubmit={aplicarBusqueda} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Buscar dispositivo, marca o modelo"
                  className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>
              <button type="submit" className="rounded-xl bg-gray-900 px-4 text-white hover:bg-gray-800">
                Buscar
              </button>
            </form>

            <select value={filtros.agenciaId} onChange={(event) => actualizarFiltro("agenciaId", event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2.5 focus:border-green-500">
              <option value="">Todas las agencias</option>
              {catalogos.agencias.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
            <select value={filtros.responsableId} onChange={(event) => actualizarFiltro("responsableId", event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2.5 focus:border-green-500">
              <option value="">Todos los responsables</option>
              {catalogos.responsables.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
            <select value={filtros.dispositivo} onChange={(event) => actualizarFiltro("dispositivo", event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2.5 focus:border-green-500">
              <option value="">Todos los dispositivos</option>
              {catalogos.dispositivos.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={filtros.estado} onChange={(event) => actualizarFiltro("estado", event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2.5 focus:border-green-500">
              <option value="">Todos los estados</option>
              {catalogos.estados.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <button type="button" onClick={limpiarFiltros} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-600 hover:bg-gray-50">
              <RefreshCw size={17} /> Limpiar
            </button>
          </div>
        </section>

        {loading ? (
          <div className="mt-8 flex min-h-[300px] items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500">
            <RefreshCw className="mr-2 animate-spin text-green-600" size={20} /> Cargando inventario...
          </div>
        ) : inventarios.length === 0 ? (
          <div className="mt-8 flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <CircleOff size={46} className="text-gray-300" />
            <h2 className="mt-4 text-xl font-black text-gray-800">Sin ítems registrados</h2>
            <p className="mt-1 text-gray-500">Agrega un dispositivo o cambia los filtros aplicados.</p>
          </div>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {inventarios.map((item) => (
              <InventarioCard key={item.id} item={item} onEdit={abrirEditar} onDelete={eliminar} />
            ))}
          </section>
        )}

        {paginacion.totalPaginas > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina((value) => value - 1)} className="rounded-xl border border-gray-300 bg-white p-2 text-gray-700 disabled:opacity-40">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-gray-600">
              Página {paginacion.pagina} de {paginacion.totalPaginas}
            </span>
            <button type="button" disabled={pagina >= paginacion.totalPaginas} onClick={() => setPagina((value) => value + 1)} className="rounded-xl border border-gray-300 bg-white p-2 text-gray-700 disabled:opacity-40">
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-gray-900 px-6 py-5 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-green-400">
                  Inventario de Sistemas
                </p>
                <h2 className="text-2xl font-black">
                  {editando ? "Editar asignación" : "Asignar dispositivos"}
                </h2>
              </div>
              <button type="button" onClick={cerrarModal} className="rounded-full p-2 text-gray-300 hover:bg-gray-800 hover:text-white" aria-label="Cerrar formulario">
                <X size={22} />
              </button>
            </div>

            <form onSubmit={guardar} className="p-6">
              <section className="rounded-2xl border border-green-200 bg-green-50/60 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-black text-white">
                    1
                  </span>
                  <div>
                    <h3 className="font-black text-gray-900">Selecciona a la persona</h3>
                    <p className="text-sm text-gray-600">
                      Todos los ítems agregados quedarán bajo esta responsabilidad.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label>
                    <span className="text-sm font-bold text-gray-700">Persona responsable *</span>
                    <select value={form.responsableId} onChange={(event) => setForm({ ...form, responsableId: event.target.value })} className={inputClass} required>
                      <option value="">Selecciona un responsable</option>
                      {catalogos.responsables.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                    </select>
                  </label>

                  <label>
                    <span className="text-sm font-bold text-gray-700">Agencia *</span>
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-black text-green-400">
                      2
                    </span>
                    <div>
                      <h3 className="font-black text-gray-900">Agrega los dispositivos</h3>
                      <p className="text-sm text-gray-500">
                        Puedes registrar varios ítems para la misma persona.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={agregarItem}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 transition hover:bg-green-100"
                  >
                    <Plus size={17} /> Agregar otro ítem
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] table-fixed text-left">
                      <colgroup>
                        <col className="w-[64px]" />
                        <col className="w-[210px]" />
                        <col className="w-[175px]" />
                        <col className="w-[155px]" />
                        <col className="w-[175px]" />
                        <col className="w-[270px]" />
                        <col className="w-[72px]" />
                      </colgroup>
                      <thead className="bg-gray-900 text-xs uppercase tracking-wide text-gray-300">
                        <tr>
                          <th className="px-3 py-3 text-center">N.º</th>
                          <th className="px-3 py-3">Dispositivo</th>
                          <th className="px-3 py-3">Estado técnico</th>
                          <th className="px-3 py-3">Marca</th>
                          <th className="px-3 py-3">Modelo</th>
                          <th className="px-3 py-3">Observación</th>
                          <th className="px-3 py-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {form.items.map((item, index) => (
                          <tr key={item.claveTemporal} className="align-top transition hover:bg-green-50/40">
                            <td className="px-3 py-3">
                              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-green-400">
                                <DispositivoIcono value={item.dispositivo} size={18} />
                              </div>
                              <p className="mt-1 text-center text-xs font-bold text-gray-500">
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
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={cerrarModal} disabled={guardando} className="rounded-xl border border-gray-300 px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando} className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 font-bold text-white hover:bg-green-700 disabled:opacity-60">
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
