import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  MdAdd,
  MdArrowBack,
  MdDeleteOutline,
  MdOutlineAssignmentTurnedIn,
  MdSend,
} from "react-icons/md";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import {
  clasesEstadoItemFormula,
  crearItemDetalle,
  crearItemFormula,
  ESTADOS_ITEMS_FORMULA,
  normalizarItemsDetalle,
  normalizarItemsFormula,
  normalizarRespuestasFormula,
} from "../../utils/planBatallaRespuestas";

const STORAGE_KEY = "planes_batalla_borrador";
const ENVIOS_KEY = "planes_batalla_enviados";
const TIEMPO_LIMITE_GUARDADO_MS = 30000;

const CONDICIONES = {
  inexistencia: {
    label: "Inexistencia",
    formula: [
      "ENCUENTRE UNA LÍNEA DE COMUNICACIÓN",
      "DESE A CONOCER",
      "DESCUBRA LO QUE NECESITA O DESEA",
      "HÁGALO, PRODUZCALO O PRESÉNTELO",
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
      "PASE POR ALTO HÁBITOS O RUTINAS NORMALES",
      "RESUELVA LA SITUACIÓN Y CUALQUIER PELIGRO QUE HAYA EN ELLA",
      "ASIGNESE UNA CONDICIÓN DE PELIGRO",
      "DESCUBRA QUÉ ESTÁ HACIENDO CONTRARIO A LOS IDEALES O A LOS MEJORES INTERESES DEL GRUPO O ACTIVIDAD Y USE AUTODISCIPLINA PARA CORREGIRLO Y VUÉLVASE HONESTO Y RETO",
      "REORGANICE SU VIDA PARA QUE LA SITUACIÓN PELIGROSA NO LE ESTÉ OCURRIENDO CONTINUAMENTE",
      "FORMULE Y ADOPTE UNA POLÍTICA FIRME QUE DE AQUÍ EN ADELANTE DETECTE LA MISMA SITUACIÓN E IMPIDE QUE VUELVA A OCURRIR",
    ],
  },
  emergencia: {
    label: "Emergencia",
    formula: [
      "PROMOCIONA Y PRODUCE",
      "CAMBIE SU FORMA DE ACTUAR",
      "ECONOMICE",
      "PREPARARSE PARA DAR SERVICIO",
      "HACER MÁS ESTRICTA LA DISCIPLINA",
    ],
  },
  normal: {
    label: "Normal",
    formula: [
      "NO CAMBIAR NADA",
      "LA ÉTICA ES MUY POCO SEVERA",
      "SI UNA ESTADÍSTICA MEJORA, EXAMINALA Y AVERIGUA QUE MEJORÓ SIN ABANDONAR LO QUE ESTABAS HACIENDO ANTES",
      "ENCUENTRA POR QUE EMPEORO UNA ESTADÍSTICA Y CORRÍGELO",
    ],
  },
  afluencia: {
    label: "Afluencia",
    formula: [
      "ECONOMIZA EN ACTIVIDADES INNECESARIAS QUE NO CONTRIBUYERON A LA AFLUENCIA",
      "HAZ QUE TODA ACCIÓN CUENTE Y NO TOMES PARTE EN NINGUNA ACCIÓN INÚTIL",
      "CONSOLIDAR LAS GANANCIAS, EN CUALQUIER ÁREA EN QUE HAYAS OBTENIDO UNA GANANCIA, LA CONSERVAS",
      "DESCUBRE POR TI MISMO Y PARA TI MISMO QUE CAUSÓ LA CONDICIÓN DE AFLUENCIA Y REFUERZALO",
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

const ESTADOS = ["Pendiente", "En progreso", "Completado", "Bloqueado"];

const crearDetalleVacio = () =>
  BLOQUES.reduce((acc, bloque) => {
    acc[bloque] = [
      crearItemDetalle({}, { estadoPredeterminado: "Pendiente" }),
    ];
    return acc;
  }, {});

const crearFormularioInicial = () => ({
  condicion: "inexistencia",
  fechaInicio: new Date().toLocaleDateString("en-CA"),
  fechaFin: "",
  respuestasFormula: normalizarRespuestasFormula(
    {},
    CONDICIONES.inexistencia.formula.length,
  ),
  detalle: crearDetalleVacio(),
  observacion: "",
});

const normalizarFormularioGuardado = (guardado) => {
  const base = crearFormularioInicial();
  if (!guardado || typeof guardado !== "object") return base;

  const detalleGuardado = guardado.detalle || {};
  const planAnterior = guardado.plan || {};
  const condicion = CONDICIONES[guardado.condicion]
    ? guardado.condicion
    : base.condicion;

  const detalle = BLOQUES.reduce((acc, bloque) => {
    const detalleBloque =
      detalleGuardado[bloque] !== undefined
        ? detalleGuardado[bloque]
        : planAnterior[bloque];

    acc[bloque] = normalizarItemsDetalle(detalleBloque, {
      incluirVacio: true,
      estadoPredeterminado: "Pendiente",
    });
    return acc;
  }, {});

  return {
    ...base,
    ...guardado,
    condicion,
    fechaInicio: guardado.fechaInicio || guardado.fecha || base.fechaInicio,
    fechaFin: "",
    respuestasFormula: normalizarRespuestasFormula(
      guardado.respuestasFormula || guardado.accionesPorPaso,
      CONDICIONES[condicion].formula.length,
    ),
    detalle,
  };
};

const leerUsuarioToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    return jwtDecode(token)?.usuario || null;
  } catch {
    return null;
  }
};

const getUsuarioAgenciaId = (usuario) =>
  usuario?.agenciaPrincipal?.usuarioAgenciaId || usuario?.usuarioAgenciaId || "";

const getStorageKey = (usuario) => {
  const usuarioAgenciaId = getUsuarioAgenciaId(usuario);
  return usuarioAgenciaId
    ? `${STORAGE_KEY}_${usuarioAgenciaId}`
    : STORAGE_KEY;
};

const getIdempotenciaStorageKey = (usuario) =>
  `${getStorageKey(usuario)}_idempotencia`;

const getEnviosKey = (usuario) => {
  const usuarioAgenciaId = getUsuarioAgenciaId(usuario);
  return usuarioAgenciaId
    ? `${ENVIOS_KEY}_${usuarioAgenciaId}`
    : ENVIOS_KEY;
};

const guardarPlanEnCache = (planes, planGuardado, planId = null) => {
  const lista = Array.isArray(planes) ? planes : [];
  if (!planId) return [planGuardado, ...lista];

  let encontrado = false;
  const actualizados = lista.map((plan) => {
    if (String(plan.id) !== String(planId)) return plan;
    encontrado = true;
    return planGuardado;
  });

  return encontrado ? actualizados : [planGuardado, ...actualizados];
};

const crearClaveIdempotencia = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export default function PlanesBatalla() {
  const navigate = useNavigate();
  const location = useLocation();
  const planEnEdicion = location.state?.planEditar || null;
  const planIdEdicion = planEnEdicion?.id || null;
  const [usuario, setUsuario] = useState(null);
  const [form, setForm] = useState(crearFormularioInicial);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const claveIdempotenciaRef = useRef(crearClaveIdempotencia());

  const condicionActual = CONDICIONES[form.condicion] || CONDICIONES.inexistencia;
  const agencia = usuario?.agenciaPrincipal;

  const preguntasActivas = useMemo(
    () =>
      condicionActual.formula.map((texto, index) => ({
        numero: index + 1,
        texto,
      })),
    [condicionActual],
  );

  useEffect(() => {
    const usuarioToken = leerUsuarioToken();
    setUsuario(usuarioToken);

    if (planEnEdicion?.plan) {
      setForm(normalizarFormularioGuardado(planEnEdicion.plan));
      return;
    }

    const claveGuardada = localStorage.getItem(
      getIdempotenciaStorageKey(usuarioToken),
    );
    claveIdempotenciaRef.current =
      claveGuardada || crearClaveIdempotencia();
    localStorage.setItem(
      getIdempotenciaStorageKey(usuarioToken),
      claveIdempotenciaRef.current,
    );

    try {
      setForm(
        normalizarFormularioGuardado(
          JSON.parse(localStorage.getItem(getStorageKey(usuarioToken))),
        ),
      );
    } catch {
      setForm(crearFormularioInicial());
    }
  }, [planEnEdicion]);

  useEffect(() => {
    if (!usuario || planEnEdicion) return;
    localStorage.setItem(getStorageKey(usuario), JSON.stringify(form));
    localStorage.setItem(
      getIdempotenciaStorageKey(usuario),
      claveIdempotenciaRef.current,
    );
  }, [form, planEnEdicion, usuario]);

  const actualizarCampo = (campo, value) => {
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

  const actualizarItemDetalle = (bloque, itemIndex, campo, value) => {
    setForm((prev) => ({
      ...prev,
      detalle: {
        ...prev.detalle,
        [bloque]: normalizarItemsDetalle(prev.detalle?.[bloque], {
          incluirVacio: true,
          estadoPredeterminado: "Pendiente",
        }).map((item, index) =>
          index === itemIndex ? { ...item, [campo]: value } : item,
        ),
      },
    }));
  };

  const agregarItemDetalle = (bloque) => {
    setForm((prev) => ({
      ...prev,
      detalle: {
        ...prev.detalle,
        [bloque]: [
          ...normalizarItemsDetalle(prev.detalle?.[bloque], {
            incluirVacio: true,
            estadoPredeterminado: "Pendiente",
          }),
          crearItemDetalle({}, { estadoPredeterminado: "Pendiente" }),
        ],
      },
    }));
  };

  const eliminarItemDetalle = (bloque, itemIndex) => {
    setForm((prev) => {
      const items = normalizarItemsDetalle(prev.detalle?.[bloque], {
        incluirVacio: true,
        estadoPredeterminado: "Pendiente",
      });

      if (items.length <= 1) return prev;

      return {
        ...prev,
        detalle: {
          ...prev.detalle,
          [bloque]: items.filter((_, index) => index !== itemIndex),
        },
      };
    });
  };

  const limpiarPlan = async () => {
    const confirm = await Swal.fire({
      title: planEnEdicion ? "Restaurar plan?" : "Limpiar plan?",
      text: planEnEdicion
        ? "Se descartaran los cambios realizados en esta edicion."
        : "Se borrara el borrador actual.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: planEnEdicion ? "Si, restaurar" : "Si, limpiar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    const nuevoFormulario = planEnEdicion?.plan
      ? normalizarFormularioGuardado(planEnEdicion.plan)
      : crearFormularioInicial();
    setForm(nuevoFormulario);
    if (!planEnEdicion) {
      claveIdempotenciaRef.current = crearClaveIdempotencia();
      localStorage.setItem(
        getIdempotenciaStorageKey(usuario),
        claveIdempotenciaRef.current,
      );
      localStorage.setItem(
        getStorageKey(usuario),
        JSON.stringify(nuevoFormulario),
      );
    }
  };

  const enviarPlan = async () => {
    if (guardandoRef.current) return;

    if (!form.condicion) {
      Swal.fire("Validacion", "Selecciona una condicion", "warning");
      return;
    }

    guardandoRef.current = true;
    setGuardando(true);

    const envioLocal = {
      id: planIdEdicion || claveIdempotenciaRef.current,
      enviadoEn: planEnEdicion?.enviadoEn || new Date().toISOString(),
      usuario: {
        id: planEnEdicion?.usuario?.id || usuario?.id || null,
        nombre: planEnEdicion?.usuario?.nombre || usuario?.nombre || "",
        usuarioAgenciaId:
          planEnEdicion?.usuario?.usuarioAgenciaId ||
          agencia?.usuarioAgenciaId ||
          null,
      },
      agencia: {
        id: planEnEdicion?.agencia?.id || agencia?.agenciaId || null,
        nombre: planEnEdicion?.agencia?.nombre || agencia?.nombre || "",
      },
      plan: form,
    };

    try {
      const payload = {
        ...form,
        fechaFin: null,
        ...(!planIdEdicion && {
          claveIdempotencia: claveIdempotenciaRef.current,
        }),
      };
      const { data } = planIdEdicion
        ? await api.put(`/api/planes-batalla/${planIdEdicion}`, payload, {
            timeout: TIEMPO_LIMITE_GUARDADO_MS,
          })
        : await api.post("/api/planes-batalla", payload, {
            timeout: TIEMPO_LIMITE_GUARDADO_MS,
          });

      const enviosKey = getEnviosKey(usuario);
      const enviosPrevios = JSON.parse(localStorage.getItem(enviosKey) || "[]");
      localStorage.setItem(
        enviosKey,
        JSON.stringify(
          guardarPlanEnCache(
            enviosPrevios,
            data.plan || envioLocal,
            planIdEdicion || claveIdempotenciaRef.current,
          ),
        ),
      );
      if (!planEnEdicion) {
        localStorage.removeItem(getStorageKey(usuario));
        localStorage.removeItem(getIdempotenciaStorageKey(usuario));
      }
      setForm(crearFormularioInicial());

      await Swal.fire({
        icon: "success",
        title: planEnEdicion
          ? "Plan de batalla actualizado"
          : "Completado plan de batalla",
        text: planEnEdicion
          ? "Los cambios fueron guardados correctamente."
          : "Exitos esta semana",
        confirmButtonText: "Aceptar",
      });
      navigate(
        planEnEdicion ? "/mis-planes-batalla" : "/vendedor-panel",
        { replace: true },
      );
    } catch (error) {
      if (planEnEdicion && error.response) {
        await Swal.fire({
          icon: "error",
          title: "No se pudo actualizar el plan",
          text:
            error.response?.data?.message ||
            "El servidor rechazo la actualizacion.",
          confirmButtonText: "Aceptar",
        });
        return;
      }

      const enviosKey = getEnviosKey(usuario);
      const enviosPrevios = JSON.parse(localStorage.getItem(enviosKey) || "[]");
      localStorage.setItem(
        enviosKey,
        JSON.stringify(
          guardarPlanEnCache(
            enviosPrevios,
            envioLocal,
            planIdEdicion || claveIdempotenciaRef.current,
          ),
        ),
      );

      await Swal.fire({
        icon: "warning",
        title: planEnEdicion
          ? "Cambios guardados localmente"
          : "Plan guardado localmente",
        text:
          error.response?.data?.message ||
          (planEnEdicion
            ? "No se pudo conectar con el servidor. Se actualizo la copia local."
            : "No se pudo enviar al servidor. Se guardo una copia local."),
        confirmButtonText: "Aceptar",
      });

      if (planEnEdicion) {
        navigate("/mis-planes-batalla", { replace: true });
      }
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                <MdOutlineAssignmentTurnedIn size={16} />
                {planEnEdicion
                  ? "Editando plan de batalla"
                  : "Plan de batalla semanal"}
              </div>
              <h1 className="text-2xl font-bold text-slate-950">
                {planEnEdicion
                  ? "Actualizar plan de batalla"
                  : "Manejo para la formula por condicion"}
              </h1>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[460px]">
              <InfoPill label="Vendedor" value={usuario?.nombre || "Sin usuario"} />
              <InfoPill label="Agencia" value={agencia?.nombre || "Sin agencia"} />
            </div>
          </div>
        </header>

        <section className="mb-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Condicion
              </span>
              <select
                value={form.condicion}
                onChange={(event) => actualizarCampo("condicion", event.target.value)}
                className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {Object.entries(CONDICIONES).map(([value, condicion]) => (
                  <option key={value} value={value}>
                    {condicion.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                Fecha
              </span>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(event) => actualizarCampo("fechaInicio", event.target.value)}
                className="h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
        </section>

        <div>
          <main className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-bold uppercase text-slate-700">
                  Preguntas
                </h2>
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
                          <MdAdd size={17} />
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
                                <MdDeleteOutline size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-600">
                Estado y descripción por ítem
              </div>

              <div className="divide-y divide-slate-100">
                {BLOQUES.map((bloque) => {
                  const items = normalizarItemsDetalle(form.detalle?.[bloque], {
                    incluirVacio: true,
                    estadoPredeterminado: "Pendiente",
                  });

                  return (
                    <div key={bloque} className="p-4">
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-bold text-slate-900">{bloque}</p>
                        <button
                          type="button"
                          onClick={() => agregarItemDetalle(bloque)}
                          className="inline-flex shrink-0 items-center justify-center gap-1 rounded border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                        >
                          <MdAdd size={17} />
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
                                  actualizarItemDetalle(
                                    bloque,
                                    itemIndex,
                                    "estado",
                                    event.target.value,
                                  )
                                }
                                className="h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              >
                                {ESTADOS.map((estado) => (
                                  <option key={estado} value={estado}>
                                    {estado}
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
                                  actualizarItemDetalle(
                                    bloque,
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
                                  eliminarItemDetalle(bloque, itemIndex)
                                }
                                aria-label={`Eliminar ítem ${itemIndex + 1} de ${bloque}`}
                                className="inline-flex h-10 w-full items-center justify-center rounded border border-red-200 px-3 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 lg:w-10"
                              >
                                <MdDeleteOutline size={18} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <label className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <span className="mb-2 block text-sm font-bold text-slate-800">
                Observacion general
              </span>
              <textarea
                rows={4}
                value={form.observacion}
                onChange={(event) => actualizarCampo("observacion", event.target.value)}
                className="w-full resize-y rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    planEnEdicion
                      ? "/mis-planes-batalla"
                      : "/vendedor-panel",
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <MdArrowBack size={18} />
                Volver
              </button>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={limpiarPlan}
                  disabled={guardando}
                  className="inline-flex items-center justify-center gap-2 rounded border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MdDeleteOutline size={18} />
                  {planEnEdicion ? "Restaurar" : "Limpiar"}
                </button>
                <button
                  type="button"
                  onClick={enviarPlan}
                  disabled={guardando}
                  className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MdSend size={18} />
                  {guardando
                    ? "Guardando..."
                    : planEnEdicion
                      ? "Guardar cambios"
                      : "Enviar plan"}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
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
