/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const formularioInicial = {
  cliente: "",
  cedula: "",
  telefono: "",
  correo: "",
  direccion: "",
  rolId: "",
};

const resumenInicial = {
  total: 0,
  conRol: 0,
  deVentas: 0,
  deEntregas: 0,
  prospectos: 0,
};

const titulo = (value) => {
  const texto = String(value || "").trim();
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
};

const fecha = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
};

const fuenteClases = {
  Venta: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Entrega: "border-blue-200 bg-blue-50 text-blue-700",
  Prospecto: "border-amber-200 bg-amber-50 text-amber-700",
};

function Metrica({ label, value, tone = "slate" }) {
  const tonos = {
    slate: "border-slate-200 bg-white text-slate-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tonos[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function Personas() {
  const [personas, setPersonas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [resumen, setResumen] = useState(resumenInicial);
  const [paginacion, setPaginacion] = useState({
    pagina: 1,
    limite: 25,
    total: 0,
    totalPaginas: 1,
  });
  const [filtros, setFiltros] = useState({ q: "", rolId: "", fuente: "" });
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [personaEditando, setPersonaEditando] = useState(null);
  const [form, setForm] = useState(formularioInicial);
  const [guardando, setGuardando] = useState(false);

  const cargarCatalogos = useCallback(async () => {
    try {
      const { data } = await api.get("/api/sistemas/personas/catalogos");
      setRoles(Array.isArray(data.roles) ? data.roles : []);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron cargar los roles",
        "error",
      );
    }
  }, []);

  const cargarPersonas = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/sistemas/personas", {
        params: {
          pagina: paginacion.pagina,
          limite: paginacion.limite,
          q: busquedaAplicada || undefined,
          rolId: filtros.rolId || undefined,
          fuente: filtros.fuente || undefined,
        },
      });
      setPersonas(Array.isArray(data.personas) ? data.personas : []);
      setResumen(data.resumen || resumenInicial);
      setPaginacion((prev) => ({ ...prev, ...(data.paginacion || {}) }));
    } catch (error) {
      setPersonas([]);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron cargar las personas",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [busquedaAplicada, filtros.fuente, filtros.rolId, paginacion.limite, paginacion.pagina]);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    cargarPersonas();
  }, [cargarPersonas]);

  const rango = useMemo(() => {
    if (!paginacion.total) return { desde: 0, hasta: 0 };
    const desde = (paginacion.pagina - 1) * paginacion.limite + 1;
    return {
      desde,
      hasta: Math.min(desde + personas.length - 1, paginacion.total),
    };
  }, [paginacion, personas.length]);

  const aplicarBusqueda = (event) => {
    event.preventDefault();
    setPaginacion((prev) => ({ ...prev, pagina: 1 }));
    setBusquedaAplicada(filtros.q.trim());
  };

  const actualizarFiltro = (campo, value) => {
    setFiltros((prev) => ({ ...prev, [campo]: value }));
    if (campo !== "q") setPaginacion((prev) => ({ ...prev, pagina: 1 }));
  };

  const limpiarFiltros = () => {
    setFiltros({ q: "", rolId: "", fuente: "" });
    setBusquedaAplicada("");
    setPaginacion((prev) => ({ ...prev, pagina: 1 }));
  };

  const abrirNueva = () => {
    setPersonaEditando(null);
    setForm(formularioInicial);
    setModalAbierto(true);
  };

  const abrirEditar = (persona) => {
    setPersonaEditando(persona);
    setForm({
      cliente: persona.cliente || "",
      cedula: persona.cedula || "",
      telefono: persona.telefono || "",
      correo: persona.correo || "",
      direccion: persona.direccion || "",
      rolId: persona.rolId ? String(persona.rolId) : "",
    });
    setModalAbierto(true);
  };

  const cerrarModal = (forzar = false) => {
    const cierreForzado = forzar === true;
    if (guardando && !cierreForzado) return;
    setModalAbierto(false);
    setPersonaEditando(null);
    setForm(formularioInicial);
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (!form.cliente.trim() && !form.cedula.trim() && !form.telefono.trim() && !form.correo.trim()) {
      return Swal.fire(
        "Datos incompletos",
        "Ingresa al menos un nombre, cedula, telefono o correo.",
        "warning",
      );
    }

    try {
      setGuardando(true);
      const payload = { ...form, rolId: form.rolId || null };
      if (personaEditando) {
        await api.put(`/api/sistemas/personas/${personaEditando.id}`, payload);
      } else {
        await api.post("/api/sistemas/personas", payload);
      }
      cerrarModal(true);
      await cargarPersonas();
      Swal.fire({
        icon: "success",
        title: personaEditando ? "Persona actualizada" : "Persona creada",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la persona",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <Users size={24} />
              <span className="text-sm font-bold">Sistemas</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Personas</h1>
            <p className="mt-1 text-sm text-slate-500">
              Registro central de clientes de ventas, entregas y prospectos.
            </p>
          </div>
          <button
            type="button"
            onClick={abrirNueva}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus size={18} />
            Nueva persona
          </button>
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metrica label="Personas" value={resumen.total} />
          <Metrica label="Con rol" value={resumen.conRol} tone="violet" />
          <Metrica label="En ventas" value={resumen.deVentas} tone="emerald" />
          <Metrica label="En entregas" value={resumen.deEntregas} tone="blue" />
          <Metrica label="Prospectos" value={resumen.prospectos} tone="amber" />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Filter size={17} />
            Filtros
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto]">
            <form onSubmit={aplicarBusqueda} className="flex gap-2">
              <label className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
                <input
                  value={filtros.q}
                  onChange={(event) => actualizarFiltro("q", event.target.value)}
                  placeholder="Nombre, cedula, telefono, correo..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <button
                type="submit"
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900"
              >
                Buscar
              </button>
            </form>

            <select
              value={filtros.rolId}
              onChange={(event) => actualizarFiltro("rolId", event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Todos los roles</option>
              <option value="sin-rol">Sin rol</option>
              {roles.map((rol) => (
                <option key={rol.id} value={rol.id}>{titulo(rol.nombre)}</option>
              ))}
            </select>

            <select
              value={filtros.fuente}
              onChange={(event) => actualizarFiltro("fuente", event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Todas las fuentes</option>
              <option value="venta">Venta</option>
              <option value="entrega">Entrega</option>
              <option value="prospecto">Prospecto</option>
            </select>

            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <X size={16} />
              Limpiar
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Listado de personas</h2>
              <p className="text-xs text-slate-500">
                Los datos no disponibles se muestran vacios y pueden completarse despues.
              </p>
            </div>
            <button
              type="button"
              onClick={cargarPersonas}
              disabled={loading}
              className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-4 py-3">Persona</th>
                  <th className="px-4 py-3">Cedula</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Direccion</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Origen del registro</th>
                  <th className="px-4 py-3">Actualizada</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">Cargando personas...</td></tr>
                ) : personas.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No hay personas con los filtros seleccionados.</td></tr>
                ) : personas.map((persona) => (
                  <tr key={persona.id} className="hover:bg-emerald-50/30">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <div className="rounded-full bg-slate-100 p-2 text-slate-500"><UserRound size={17} /></div>
                        <div>
                          <div className="font-bold text-slate-900">{persona.cliente || ""}</div>
                          <div className="text-xs text-slate-400">ID {persona.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{persona.cedula || ""}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1 text-slate-700">
                        <div className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" />{persona.telefono || ""}</div>
                        <div className="flex items-center gap-1.5"><Mail size={14} className="text-slate-400" />{persona.correo || ""}</div>
                      </div>
                    </td>
                    <td className="max-w-xs px-4 py-3 align-top text-slate-700">
                      <div className="flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" /><span>{persona.direccion || ""}</span></div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {persona.rol ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">
                          <ShieldCheck size={13} />{titulo(persona.rol.nombre)}
                        </span>
                      ) : ""}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {persona.fuentes.map((fuente) => (
                          <span key={fuente} className={`rounded-full border px-2 py-1 text-xs font-bold ${fuenteClases[fuente]}`}>{fuente}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-500">{fecha(persona.updatedAt)}</td>
                    <td className="px-4 py-3 text-center align-top">
                      <button
                        type="button"
                        onClick={() => abrirEditar(persona)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        title="Editar persona"
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>Mostrando {rango.desde}-{rango.hasta} de {paginacion.total}</span>
              <select
                value={paginacion.limite}
                onChange={(event) => setPaginacion((prev) => ({ ...prev, limite: Number(event.target.value), pagina: 1 }))}
                className="rounded border border-slate-300 bg-white px-2 py-1"
              >
                {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value} por pagina</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loading || paginacion.pagina <= 1}
                onClick={() => setPaginacion((prev) => ({ ...prev, pagina: prev.pagina - 1 }))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              ><ChevronLeft size={16} />Anterior</button>
              <span className="px-2 text-sm font-bold text-slate-700">{paginacion.pagina} / {paginacion.totalPaginas}</span>
              <button
                type="button"
                disabled={loading || paginacion.pagina >= paginacion.totalPaginas}
                onClick={() => setPaginacion((prev) => ({ ...prev, pagina: prev.pagina + 1 }))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >Siguiente<ChevronRight size={16} /></button>
            </div>
          </div>
        </section>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={guardar} className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">{personaEditando ? "Editar persona" : "Nueva persona"}</h2>
                <p className="text-xs text-slate-500">Los campos que no existan pueden quedar vacios.</p>
              </div>
              <button type="button" onClick={cerrarModal} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {[
                ["cliente", "Nombre completo", "text"],
                ["cedula", "Cedula", "text"],
                ["telefono", "Telefono", "tel"],
                ["correo", "Correo", "email"],
              ].map(([campo, label, type]) => (
                <label key={campo} className="block">
                  <span className="mb-1 block text-sm font-bold text-slate-700">{label}</span>
                  <input
                    type={type}
                    value={form[campo]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [campo]: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              ))}
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-bold text-slate-700">Direccion</span>
                <input
                  value={form.direccion}
                  onChange={(event) => setForm((prev) => ({ ...prev, direccion: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-bold text-slate-700">Rol</span>
                <select
                  value={form.rolId}
                  onChange={(event) => setForm((prev) => ({ ...prev, rolId: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Sin rol</option>
                  {roles.map((rol) => <option key={rol.id} value={rol.id}>{titulo(rol.nombre)}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={cerrarModal} disabled={guardando} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={guardando} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                <Save size={16} />{guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
