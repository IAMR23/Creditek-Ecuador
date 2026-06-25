import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { Eye, Filter, Trash2, X } from "lucide-react";
import { API_URL } from "../../../config";
import { nombreCortoUsuario } from "../../utils/nombres";

const CONDICIONES = [
  { value: "todos", label: "Todas" },
  { value: "inexistencia", label: "Inexistencia" },
  { value: "peligro", label: "Peligro" },
  { value: "emergencia", label: "Emergencia" },
  { value: "normal", label: "Normal" },
  { value: "afluencia", label: "Afluencia" },
];

const CONDICIONES_LABELS = CONDICIONES.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const PREGUNTAS_POR_CONDICION = {
  inexistencia: [
    "ENCUENTRE UNA LÍNEA DE COMUNICACIÓN",
    "DESE A CONOCER",
    "DESCUBRA LO QUE NECESITA O DESEA",
    "HÁGALO, PRODUZCALO O PRESÉNTELO",
  ],
  peligro: [
    "PASE POR ALTO HÁBITOS O RUTINAS NORMALES",
    "RESUELVA LA SITUACIÓN Y CUALQUIER PELIGRO QUE HAYA EN ELLA",
    "ASIGNESE UNA CONDICIÓN DE PELIGRO",
    "DESCUBRA QUÉ ESTÁ HACIENDO CONTRARIO A LOS IDEALES O A LOS MEJORES INTERESES DEL GRUPO O ACTIVIDAD Y USE AUTODISCIPLINA PARA CORREGIRLO Y VUÉLVASE HONESTO Y RETO",
    "REORGANICE SU VIDA PARA QUE LA SITUACIÓN PELIGROSA NO LE ESTÉ OCURRIENDO CONTINUAMENTE",
    "FORMULE Y ADOPTE UNA POLÍTICA FIRME QUE DE AQUÍ EN ADELANTE DETECTE LA MISMA SITUACIÓN E IMPIDE QUE VUELVA A OCURRIR",
  ],
  emergencia: [
    "PROMOCIONA Y PRODUCE",
    "CAMBIE SU FORMA DE ACTUAR",
    "ECONOMICE",
    "PREPARARSE PARA DAR SERVICIO",
    "HACER MÁS ESTRICTA LA DISCIPLINA",
  ],
  normal: [
    "NO CAMBIAR NADA",
    "LA ÉTICA ES MUY POCO SEVERA",
    "SI UNA ESTADÍSTICA MEJORA, EXAMINALA Y AVERIGUA QUE MEJORÓ SIN ABANDONAR LO QUE ESTABAS HACIENDO ANTES",
    "ENCUENTRA POR QUE EMPEORO UNA ESTADÍSTICA Y CORRÍGELO",
  ],
  afluencia: [
    "ECONOMIZA EN ACTIVIDADES INNECESARIAS QUE NO CONTRIBUYERON A LA AFLUENCIA",
    "HAZ QUE TODA ACCIÓN CUENTE Y NO TOMES PARTE EN NINGUNA ACCIÓN INÚTIL",
    "CONSOLIDAR LAS GANANCIAS, EN CUALQUIER ÁREA EN QUE HAYAS OBTENIDO UNA GANANCIA, LA CONSERVAS",
    "DESCUBRE POR TI MISMO Y PARA TI MISMO QUE CAUSÓ LA CONDICIÓN DE AFLUENCIA Y REFUERZALO",
  ],
};

const getHoyLocal = () => new Date().toLocaleDateString("en-CA");

const filtrosIniciales = {
  agenciaId: "todos",
  vendedorId: "todos",
  fechaInicio: getHoyLocal(),
  condicion: "todos",
};

const crearFiltrosIniciales = () => ({
  ...filtrosIniciales,
  fechaInicio: getHoyLocal(),
});

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const formatearFecha = (value) => {
  if (!value) return "-";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return value;

  return fecha.toLocaleString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function VerPlanesBatalla() {
  const [planes, setPlanes] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filtros, setFiltros] = useState(crearFiltrosIniciales);
  const [loading, setLoading] = useState(false);
  const [planSeleccionadoId, setPlanSeleccionadoId] = useState(null);

  const planSeleccionado =
    planes.find((plan) => String(plan.id) === String(planSeleccionadoId)) ||
    planes[0] ||
    null;

  const vendedoresOrdenados = useMemo(
    () => [...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [usuarios],
  );

  const cargarCatalogos = async () => {
    try {
      const [agenciasRes, usuariosRes] = await Promise.all([
        axios.get(`${API_URL}/agencias`),
        axios.get(`${API_URL}/usuarios`, { params: { rol: "Vendedor" } }),
      ]);

      setAgencias(agenciasRes.data || []);
      setUsuarios(usuariosRes.data || []);
    } catch (error) {
      console.error("Error cargando catalogos:", error);
      Swal.fire("Error", "No se pudieron cargar agencias o vendedores", "error");
    }
  };

  const cargarPlanes = async () => {
    try {
      setLoading(true);
      const params = {};

      Object.entries(filtros).forEach(([key, value]) => {
        if (value && value !== "todos") params[key] = value;
      });
      if (filtros.fechaInicio) params.fechaFin = filtros.fechaInicio;

      const { data } = await axios.get(`${API_URL}/api/planes-batalla`, {
        headers: getAuthHeaders(),
        params,
      });

      const items = data.planes || [];
      setPlanes(items);
      setPlanSeleccionadoId(items[0]?.id || null);
    } catch (error) {
      console.error("Error cargando planes de batalla:", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron cargar los planes",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarPlanes();
  }, [filtros]);

  const actualizarFiltro = (campo, value) => {
    setFiltros((prev) => ({ ...prev, [campo]: value }));
  };

  const limpiarFiltros = () => {
    setFiltros(crearFiltrosIniciales());
  };

  const eliminarPlan = async (planId) => {
    const confirm = await Swal.fire({
      title: "Eliminar plan?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.delete(`${API_URL}/api/planes-batalla/${planId}`, {
        headers: getAuthHeaders(),
      });
      await cargarPlanes();
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo eliminar el plan",
        "error",
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Gerencia
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Ver planes de batalla
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Consulta los planes enviados por vendedor, agencia y rango de fechas.
          </p>
        </header>

        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase text-slate-700">
            <Filter size={16} />
            Filtros
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <SelectFiltro
              label="Agencia"
              value={filtros.agenciaId}
              onChange={(value) => actualizarFiltro("agenciaId", value)}
            >
              <option value="todos">Todas</option>
              {agencias.map((agencia) => (
                <option key={agencia.id} value={agencia.id}>
                  {agencia.nombre}
                </option>
              ))}
            </SelectFiltro>

            <SelectFiltro
              label="Vendedor"
              value={filtros.vendedorId}
              onChange={(value) => actualizarFiltro("vendedorId", value)}
            >
              <option value="todos">Todos</option>
              {vendedoresOrdenados.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {nombreCortoUsuario(usuario)}
                </option>
              ))}
            </SelectFiltro>

            <SelectFiltro
              label="Condicion"
              value={filtros.condicion}
              onChange={(value) => actualizarFiltro("condicion", value)}
            >
              {CONDICIONES.map((condicion) => (
                <option key={condicion.value} value={condicion.value}>
                  {condicion.label}
                </option>
              ))}
            </SelectFiltro>

            <InputFiltro
              label="Fecha"
              type="date"
              value={filtros.fechaInicio}
              onChange={(value) => actualizarFiltro("fechaInicio", value)}
            />

            <div className="flex items-end">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <X size={16} />
                Limpiar
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Cargando planes...
          </div>
        ) : planes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              No hay planes con los filtros seleccionados
            </h2>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[430px_1fr]">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-bold uppercase text-slate-700">
                  Planes encontrados ({planes.length})
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {planes.map((plan) => {
                  const activo = String(planSeleccionado?.id) === String(plan.id);
                  const condicion =
                    CONDICIONES_LABELS[plan.plan?.condicion] ||
                    plan.plan?.condicion ||
                    "-";

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setPlanSeleccionadoId(plan.id)}
                      className={`block w-full p-4 text-left transition ${
                        activo ? "bg-emerald-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {plan.usuario?.nombre || "-"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {plan.agencia?.nombre || "-"} · {condicion}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Fecha: {plan.plan?.fechaInicio || "-"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Enviado: {formatearFecha(plan.enviadoEn)}
                          </p>
                        </div>
                        <Eye
                          size={18}
                          className={activo ? "text-emerald-700" : "text-slate-400"}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <DetallePlan plan={planSeleccionado} onEliminar={eliminarPlan} />
          </div>
        )}
      </div>
    </div>
  );
}

function DetallePlan({ plan, onEliminar }) {
  if (!plan) return null;

  const condicion =
    CONDICIONES_LABELS[plan.plan?.condicion] || plan.plan?.condicion || "-";
  const respuestas = plan.plan?.respuestasFormula || {};
  const detalle = plan.plan?.detalle || {};

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">
            Detalle del plan
          </p>
          <h2 className="text-xl font-bold text-slate-950">{condicion}</h2>
        </div>

        <button
          type="button"
          onClick={() => onEliminar(plan.id)}
          className="inline-flex items-center justify-center gap-2 rounded border border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
        >
          <Trash2 size={16} />
          Eliminar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 md:grid-cols-3">
        <InfoPill label="Vendedor" value={plan.usuario?.nombre || "-"} />
        <InfoPill label="Agencia" value={plan.agencia?.nombre || "-"} />
        <InfoPill label="Fecha" value={plan.plan?.fechaInicio || "-"} />
      </div>

      <div className="space-y-5 p-4">
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase text-slate-700">
            Preguntas
          </h3>
          <div className="space-y-3">
            {PREGUNTAS_POR_CONDICION[plan.plan?.condicion]?.length ? (
              PREGUNTAS_POR_CONDICION[plan.plan.condicion].map((pregunta, index) => {
                const numero = String(index + 1);

                return (
                  <div key={numero} className="rounded border border-slate-200 p-3">
                    <p className="text-sm font-bold text-slate-900">
                      {numero}.- {pregunta}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-800">
                      {respuestas[numero] || "-"}
                    </p>
                  </div>
                );
              })
            ) : Object.entries(respuestas).length === 0 ? (
              <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                Sin respuestas registradas.
              </p>
            ) : (
              Object.entries(respuestas).map(([numero, respuesta]) => (
                <div key={numero} className="rounded border border-slate-200 p-3">
                  <p className="text-xs font-black uppercase text-slate-500">
                    Pregunta {numero}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                    {respuesta || "-"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-bold uppercase text-slate-700">
            Estado y descripcion
          </h3>
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2">Seccion</th>
                  <th className="border-b border-slate-200 px-3 py-2">Estado</th>
                  <th className="border-b border-slate-200 px-3 py-2">
                    Descripcion
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(detalle).map(([bloque, item]) => (
                  <tr key={bloque} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-bold text-slate-900">
                      {bloque}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                        {item?.estado || "-"}
                      </span>
                    </td>
                    <td className="whitespace-pre-wrap px-3 py-3 text-slate-700">
                      {item?.descripcion || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {plan.plan?.observacion && (
          <div>
            <h3 className="mb-2 text-sm font-bold uppercase text-slate-700">
              Observacion general
            </h3>
            <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {plan.plan.observacion}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SelectFiltro({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        {children}
      </select>
    </label>
  );
}

function InputFiltro({ label, value, onChange, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        {...props}
      />
    </label>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="truncate text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}
