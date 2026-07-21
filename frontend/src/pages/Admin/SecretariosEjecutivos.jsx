import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  CheckCircle2,
  ClipboardList,
  Edit3,
  Filter,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";
import {
  clasesEstadoItemFormula,
  crearItemFormula,
  ESTADOS_ITEMS_FORMULA,
  normalizarItemsFormula,
  normalizarRespuestasFormula,
} from "../../utils/planBatallaRespuestas";

const API_ENDPOINT = `${API_URL}/api/gerencia/secretarios-ejecutivos/planes`;

const ESTADOS = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "FINALIZADO", label: "Finalizado" },
];

const CONDICIONES = {
  inexistencia: {
    label: "Inexistencia",
    formula: [
      "ENCUENTRE UNA LINEA DE COMUNICACION",
      "DESE A CONOCER",
      "DESCUBRA LO QUE NECESITA O DESEA",
      "HAGALO, PRODUZCALO O PRESENTELO",
    ],
  },
  inexistencia_extendida: {
    label: "Inexistencia Extendida",
    formula: [
      "ENCUENTRA Y PONTE EN LÍNEA DE COMUNICACIÓN QUE VAYAS A NECESITAR PARA DAR Y OBTENER INFORMACIÓN RELATIVA A TUS DEBERES Y SUMINISTROS",
      "DATE A CONOCER, JUNTO CON LA DESIGNACIÓN DE TU PUESTO Y TUS DEBERES, A TODOS LOS TERMINALES QUE NECESITARÁS PARA LA OBTENCIÓN DE INFORMACIÓN Y LA ENTREGA DE DATOS",
      "DESCUBRE DE TUS SUPERIORES, COMPAÑEROS DE TRABAJO Y CUALQUIER PÚBLICO CON EL QUE PUEDAS NECESITAR PONERTE EN CONTACTO EN EL CUMPLIMIENTO DE TUS OBLIGACIONES, LO QUE CADA UNO DE ELLOS NECESITA Y DESEA",
      "HAZ, PRODUCE Y PRESENTA LO QUE CADA UNO NECESITA Y DESEA, QUE ESTÉ EN CONFORMIDAD A LA POLÍTICA",
      "MANTÉN LAS LÍNEAS DE COMUNICACIÓN QUE TIENES Y AMPLÍALAS PARA OBTENER OTRA INFORMACIÓN QUE AHORA ENCUENTRES QUE NECESITAS DE MANERA HABITUAL",
      "MANTÉN TUS LÍNEAS DE ORIGINACIÓN PARA INFORMAR A OTROS DE LO QUE ESTÁS HACIENDO EXACTAMENTE, PERO SOLO A AQUELLOS QUE REALMENTE NECESITAN LA INFORMACIÓN",
      "SIMPLIFICA Y HAZ DE FORMA MÁS EFICIENTE LO QUE ESTÁS HACIENDO, PRODUCIÉNDOLO Y PRESENTÁNDOLO DE MODO QUE SE ACERQUE MÁS A LO QUE REALMENTE SE NECESITA Y SE DESEA",
      "DANDO Y RECIBIENDO INFORMACIÓN PLENA RESPECTO A TUS PRODUCTOS, HAZ, PRODUCE Y PRESENTA, DE MANERA HABITUAL EN TU PUESTO, UN PRODUCTO MEJOR",
    ],
  },
  peligro: {
    label: "Peligro",
    formula: [
      "PASE POR ALTO HABITOS O RUTINAS NORMALES",
      "RESUELVA LA SITUACION Y CUALQUIER PELIGRO QUE HAYA EN ELLA",
      "ASIGNESE UNA CONDICION DE PELIGRO",
      "DESCUBRA QUE ESTA HACIENDO CONTRARIO A LOS IDEALES O A LOS MEJORES INTERESES DEL GRUPO O ACTIVIDAD Y USE AUTODISCIPLINA PARA CORREGIRLO Y VUELVASE HONESTO Y RETO",
      "REORGANICE SU VIDA PARA QUE LA SITUACION PELIGROSA NO LE ESTE OCURRIENDO CONTINUAMENTE",
      "FORMULE Y ADOPTE UNA POLITICA FIRME QUE DE AQUI EN ADELANTE DETECTE LA MISMA SITUACION E IMPIDE QUE VUELVA A OCURRIR",
    ],
  },
  emergencia: {
    label: "Emergencia",
    formula: [
      "PROMOCIONA Y PRODUCE",
      "CAMBIE SU FORMA DE ACTUAR",
      "ECONOMICE",
      "PREPARARSE PARA DAR SERVICIO",
      "HACER MAS ESTRICTA LA DISCIPLINA",
    ],
  },
  normal: {
    label: "Normal",
    formula: [
      "NO CAMBIAR NADA",
      "LA ETICA ES MUY POCO SEVERA",
      "SI UNA ESTADISTICA MEJORA, EXAMINALA Y AVERIGUA QUE MEJORO SIN ABANDONAR LO QUE ESTABAS HACIENDO ANTES",
      "ENCUENTRA POR QUE EMPEORO UNA ESTADISTICA Y CORRIGELO",
    ],
  },
  afluencia: {
    label: "Afluencia",
    formula: [
      "ECONOMIZA EN ACTIVIDADES INNECESARIAS QUE NO CONTRIBUYERON A LA AFLUENCIA",
      "HAZ QUE TODA ACCION CUENTE Y NO TOMES PARTE EN NINGUNA ACCION INUTIL",
      "CONSOLIDAR LAS GANANCIAS, EN CUALQUIER AREA EN QUE HAYAS OBTENIDO UNA GANANCIA, LA CONSERVAS",
      "DESCUBRE POR TI MISMO Y PARA TI MISMO QUE CAUSO LA CONDICION DE AFLUENCIA Y REFUERZALO",
    ],
  },
};

const BLOQUES = [
  "Actividades urgentes",
  "Actividades pendientes",
  "Ordenes que debo cumplir",
  "Ordenes que deben realizar mis juniors",
  "Meta para la semana",
  "Objetivos que contribuyen al plan estrategico",
];

const getHoyLocal = () => new Date().toLocaleDateString("en-CA");

const crearDetalleVacio = () =>
  BLOQUES.reduce((acc, bloque) => {
    acc[bloque] = { estado: "PENDIENTE", descripcion: "" };
    return acc;
  }, {});

const crearFormInicial = () => ({
  fecha: getHoyLocal(),
  condicion: "inexistencia",
  respuestasFormula: normalizarRespuestasFormula(
    {},
    CONDICIONES.inexistencia.formula.length,
  ),
  detalle: crearDetalleVacio(),
  objetivoDia: "Plan de batalla INEXISTENCIA",
  actividadesPlanificadas: "{}",
  prioridad: "MEDIA",
  estado: "PENDIENTE",
  observaciones: "",
});

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const estadoClases = {
  PENDIENTE: "border-amber-200 bg-amber-50 text-amber-700",
  EN_PROGRESO: "border-blue-200 bg-blue-50 text-blue-700",
  FINALIZADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export default function SecretariosEjecutivos() {
  const [tab, setTab] = useState("crear");
  const [planes, setPlanes] = useState([]);
  const [form, setForm] = useState(crearFormInicial);
  const [planEditando, setPlanEditando] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [filtros, setFiltros] = useState({
    fecha: "",
    estado: "todos",
  });

  const resumen = useMemo(
    () => ({
      total: planes.length,
      pendientes: planes.filter((plan) => plan.estado === "PENDIENTE").length,
      enProgreso: planes.filter((plan) => plan.estado === "EN_PROGRESO").length,
      finalizados: planes.filter((plan) => plan.estado === "FINALIZADO").length,
    }),
    [planes],
  );

  const condicionActual = CONDICIONES[form.condicion] || CONDICIONES.inexistencia;
  const preguntasActivas = useMemo(
    () =>
      condicionActual.formula.map((texto, index) => ({
        numero: index + 1,
        texto,
      })),
    [condicionActual],
  );

  const cargarPlanes = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filtros.fecha) params.fecha = filtros.fecha;
      if (filtros.estado !== "todos") params.estado = filtros.estado;

      const { data } = await axios.get(API_ENDPOINT, {
        headers: getAuthHeaders(),
        params,
      });

      setPlanes(data.planes || []);
    } catch (error) {
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
    cargarPlanes();
  }, [filtros.fecha, filtros.estado]);

  const actualizarForm = (campo, value) => {
    setForm((prev) => ({ ...prev, [campo]: value }));
  };

  const actualizarItemFormula = (numero, itemIndex, campo, value) => {
    setForm((prev) => ({
      ...prev,
      respuestasFormula: {
        ...prev.respuestasFormula,
        [numero]: normalizarItemsFormula(prev.respuestasFormula?.[numero], {
          incluirVacio: true,
        }).map((item, index) =>
          index === itemIndex ? { ...item, [campo]: value } : item,
        ),
      },
    }));
  };

  const agregarItemFormula = (numero) => {
    setForm((prev) => ({
      ...prev,
      respuestasFormula: {
        ...prev.respuestasFormula,
        [numero]: [
          ...normalizarItemsFormula(prev.respuestasFormula?.[numero], {
            incluirVacio: true,
          }),
          crearItemFormula(),
        ],
      },
    }));
  };

  const eliminarItemFormula = (numero, itemIndex) => {
    setForm((prev) => {
      const items = normalizarItemsFormula(prev.respuestasFormula?.[numero], {
        incluirVacio: true,
      });

      if (items.length <= 1) return prev;

      return {
        ...prev,
        respuestasFormula: {
          ...prev.respuestasFormula,
          [numero]: items.filter((_, index) => index !== itemIndex),
        },
      };
    });
  };

  const actualizarDetalle = (bloque, campo, value) => {
    setForm((prev) => ({
      ...prev,
      detalle: {
        ...prev.detalle,
        [bloque]: {
          ...(prev.detalle[bloque] || { estado: "PENDIENTE", descripcion: "" }),
          [campo]: value,
        },
      },
    }));
  };

  const limpiarForm = () => {
    setForm(crearFormInicial());
    setPlanEditando(null);
  };

  const editarPlan = (plan) => {
    const condicion = plan.condicion || "inexistencia";
    const cantidadPreguntas =
      CONDICIONES[condicion]?.formula.length || CONDICIONES.inexistencia.formula.length;

    setPlanEditando(plan);
    setForm({
      fecha: plan.fecha || getHoyLocal(),
      condicion,
      respuestasFormula: normalizarRespuestasFormula(
        plan.respuestasFormula,
        cantidadPreguntas,
      ),
      detalle: {
        ...crearDetalleVacio(),
        ...(plan.detalle || {}),
      },
      objetivoDia: plan.objetivoDia || "",
      actividadesPlanificadas: plan.actividadesPlanificadas || "",
      prioridad: plan.prioridad || "MEDIA",
      estado: plan.estado || "PENDIENTE",
      observaciones: plan.observaciones || "",
    });
    setTab("crear");
  };

  const guardarPlan = async (event) => {
    event.preventDefault();

    if (!form.fecha) {
      Swal.fire(
        "Validacion",
        "La fecha es obligatoria",
        "warning",
      );
      return;
    }

    try {
      setGuardando(true);
      const condicionLabel = CONDICIONES[form.condicion]?.label || form.condicion;
      const payload = {
        ...form,
        objetivoDia: `Plan de batalla ${condicionLabel}`,
        actividadesPlanificadas: JSON.stringify({
          respuestasFormula: form.respuestasFormula,
          detalle: form.detalle,
        }),
      };

      if (planEditando) {
        await axios.put(`${API_ENDPOINT}/${planEditando.id}`, payload, {
          headers: getAuthHeaders(),
        });
      } else {
        await axios.post(API_ENDPOINT, payload, {
          headers: getAuthHeaders(),
        });
      }

      await cargarPlanes();
      limpiarForm();
      setTab("mis");

      Swal.fire({
        icon: "success",
        title: planEditando ? "Plan actualizado" : "Plan creado",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar el plan",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (plan, estado) => {
    try {
      await axios.patch(
        `${API_ENDPOINT}/${plan.id}/estado`,
        { estado },
        { headers: getAuthHeaders() },
      );
      await cargarPlanes();
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cambiar el estado",
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
          <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                Secretarios Ejecutivos
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Gestiona tu plan de batalla semanal y da seguimiento a tus actividades.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                limpiarForm();
                setTab("crear");
              }}
              className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              <Plus size={18} />
              Nuevo plan
            </button>
          </div>
        </header>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Planes" value={resumen.total} />
          <Metric label="Pendientes" value={resumen.pendientes} tone="amber" />
          <Metric label="En progreso" value={resumen.enProgreso} tone="blue" />
          <Metric label="Finalizados" value={resumen.finalizados} tone="green" />
        </div>

        <div className="mb-5 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <TabButton active={tab === "crear"} onClick={() => setTab("crear")}>
              Crear Plan de Batalla
            </TabButton>
            <TabButton active={tab === "mis"} onClick={() => setTab("mis")}>
              Mis Planes de Batalla
            </TabButton>
          </div>
        </div>

        {tab === "crear" ? (
          <form
            onSubmit={guardarPlan}
            className="rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-bold uppercase text-slate-700">
                {planEditando ? "Editar plan" : "Nuevo plan"}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-4">
              <Field label="Fecha">
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(event) => actualizarForm("fecha", event.target.value)}
                  className="h-11 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </Field>

              <Field label="Condicion">
                <select
                  value={form.condicion}
                  onChange={(event) =>
                    actualizarForm("condicion", event.target.value)
                  }
                  className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {Object.entries(CONDICIONES).map(([value, condicion]) => (
                    <option key={value} value={value}>
                      {condicion.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="lg:col-span-4 rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-bold uppercase text-slate-700">
                    Preguntas
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {preguntasActivas.map((pregunta) => {
                    const items = normalizarItemsFormula(
                      form.respuestasFormula?.[pregunta.numero],
                      { incluirVacio: true },
                    );

                    return (
                      <div key={pregunta.numero} className="p-4">
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <p className="text-sm font-bold text-slate-800">
                            {pregunta.numero}.- {pregunta.texto}
                          </p>
                          <button
                            type="button"
                            onClick={() => agregarItemFormula(pregunta.numero)}
                            className="inline-flex shrink-0 items-center justify-center gap-1 rounded border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                          >
                            <Plus size={15} />
                            Agregar ítem
                          </button>
                        </div>

                        <div className="space-y-3">
                          {items.map((item, itemIndex) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-1 gap-3 rounded border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[170px_1fr_auto]"
                            >
                              <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                  Estado
                                </span>
                                <select
                                  value={item.estado}
                                  onChange={(event) =>
                                    actualizarItemFormula(
                                      pregunta.numero,
                                      itemIndex,
                                      "estado",
                                      event.target.value,
                                    )
                                  }
                                  className={`h-10 w-full rounded border px-2 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-slate-200 ${
                                    clasesEstadoItemFormula[item.estado]
                                  }`}
                                >
                                  {ESTADOS_ITEMS_FORMULA.map((estado) => (
                                    <option key={estado.value} value={estado.value}>
                                      {estado.label}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="block">
                                <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                                  Ítem {itemIndex + 1}
                                </span>
                                <textarea
                                  rows={2}
                                  value={item.descripcion}
                                  onChange={(event) =>
                                    actualizarItemFormula(
                                      pregunta.numero,
                                      itemIndex,
                                      "descripcion",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full resize-y rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                              </label>

                              <div className="flex items-end">
                                <button
                                  type="button"
                                  disabled={items.length <= 1}
                                  onClick={() =>
                                    eliminarItemFormula(pregunta.numero, itemIndex)
                                  }
                                  aria-label={`Eliminar ítem ${itemIndex + 1}`}
                                  className="inline-flex h-10 w-full items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 lg:w-10"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-4 rounded-lg border border-slate-200 bg-white">
                <div className="grid grid-cols-[170px_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-600">
                  <div>Estado</div>
                  <div>Descripcion</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {BLOQUES.map((bloque) => (
                    <div
                      key={bloque}
                      className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[170px_1fr]"
                    >
                      <div>
                        <p className="mb-2 text-sm font-bold text-slate-900">
                          {bloque}
                        </p>
                        <select
                          value={form.detalle[bloque]?.estado || "PENDIENTE"}
                          onChange={(event) =>
                            actualizarDetalle(bloque, "estado", event.target.value)
                          }
                          className="h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        >
                          {ESTADOS.map((estado) => (
                            <option key={estado.value} value={estado.value}>
                              {estado.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        rows={3}
                        value={form.detalle[bloque]?.descripcion || ""}
                        onChange={(event) =>
                          actualizarDetalle(bloque, "descripcion", event.target.value)
                        }
                        className="w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Observaciones" className="lg:col-span-4">
                <textarea
                  rows={3}
                  value={form.observaciones}
                  onChange={(event) =>
                    actualizarForm("observaciones", event.target.value)
                  }
                  className="w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
              {planEditando && (
                <button
                  type="button"
                  onClick={limpiarForm}
                  className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <X size={16} />
                  Cancelar edicion
                </button>
              )}
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={16} />
                {guardando ? "Guardando..." : planEditando ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </form>
        ) : (
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase text-slate-700">
                <Filter size={16} />
                Filtros
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Fecha">
                  <input
                    type="date"
                    value={filtros.fecha}
                    onChange={(event) =>
                      setFiltros((prev) => ({ ...prev, fecha: event.target.value }))
                    }
                    className="h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </Field>

                <Field label="Estado">
                  <select
                    value={filtros.estado}
                    onChange={(event) =>
                      setFiltros((prev) => ({ ...prev, estado: event.target.value }))
                    }
                    className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="todos">Todos</option>
                    {ESTADOS.map((estado) => (
                      <option key={estado.value} value={estado.value}>
                        {estado.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setFiltros({ fecha: "", estado: "todos" })}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <X size={16} />
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2">Fecha</th>
                    <th className="border-b border-slate-200 px-3 py-2">
                      Condicion
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2">
                      Estado
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2">
                      Observaciones
                    </th>
                    <th className="border-b border-slate-200 px-3 py-2">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                        Cargando planes...
                      </td>
                    </tr>
                  ) : planes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                        No tienes planes con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    planes.map((plan) => (
                      <tr key={plan.id} className="border-b border-slate-100">
                        <td className="px-3 py-3 font-bold text-slate-900">
                          {plan.fecha}
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-700">
                          {CONDICIONES[plan.condicion]?.label || plan.condicion || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={plan.estado}
                            onChange={(event) =>
                              cambiarEstado(plan, event.target.value)
                            }
                            className={`rounded border px-2 py-1 text-xs font-bold outline-none ${
                              estadoClases[plan.estado] || estadoClases.PENDIENTE
                            }`}
                          >
                            {ESTADOS.map((estado) => (
                              <option key={estado.value} value={estado.value}>
                                {estado.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="max-w-sm whitespace-pre-wrap px-3 py-3 text-slate-700">
                          {plan.observaciones || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => editarPlan(plan)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                              title="Editar"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => cambiarEstado(plan, "FINALIZADO")}
                              disabled={plan.estado === "FINALIZADO"}
                              className="inline-flex h-9 w-9 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                              title="Finalizar"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-4 py-2 text-sm font-bold transition ${
        active
          ? "bg-emerald-600 text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <div className={`rounded border p-3 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-bold uppercase opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}
