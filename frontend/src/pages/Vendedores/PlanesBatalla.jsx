import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import {
  MdAdd,
  MdArrowBack,
  MdDeleteOutline,
  MdOutlineAssignmentTurnedIn,
  MdSend,
} from "react-icons/md";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import {
  clasesEstadoItemFormula,
  crearItemFormula,
  ESTADOS_ITEMS_FORMULA,
  normalizarItemsFormula,
  normalizarRespuestasFormula,
} from "../../utils/planBatallaRespuestas";

const STORAGE_KEY = "planes_batalla_borrador";
const ENVIOS_KEY = "planes_batalla_enviados";

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
    acc[bloque] = { estado: "Pendiente", descripcion: "" };
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
    if (detalleGuardado[bloque]) {
      acc[bloque] = {
        estado: detalleGuardado[bloque].estado || "Pendiente",
        descripcion: detalleGuardado[bloque].descripcion || "",
      };
      return acc;
    }

    const filasAnteriores = Array.isArray(planAnterior[bloque])
      ? planAnterior[bloque]
      : [];
    const primeraFilaConDatos =
      filasAnteriores.find((fila) => fila?.estado || fila?.descripcion) || {};

    acc[bloque] = {
      estado: primeraFilaConDatos.estado || "Pendiente",
      descripcion: primeraFilaConDatos.descripcion || "",
    };
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

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const getUsuarioAgenciaId = (usuario) =>
  usuario?.agenciaPrincipal?.usuarioAgenciaId || usuario?.usuarioAgenciaId || "";

const getStorageKey = (usuario) => {
  const usuarioAgenciaId = getUsuarioAgenciaId(usuario);
  return usuarioAgenciaId
    ? `${STORAGE_KEY}_${usuarioAgenciaId}`
    : STORAGE_KEY;
};

const getEnviosKey = (usuario) => {
  const usuarioAgenciaId = getUsuarioAgenciaId(usuario);
  return usuarioAgenciaId
    ? `${ENVIOS_KEY}_${usuarioAgenciaId}`
    : ENVIOS_KEY;
};

export default function PlanesBatalla() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [form, setForm] = useState(crearFormularioInicial);

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

    try {
      setForm(
        normalizarFormularioGuardado(
          JSON.parse(localStorage.getItem(getStorageKey(usuarioToken))),
        ),
      );
    } catch {
      setForm(crearFormularioInicial());
    }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    localStorage.setItem(getStorageKey(usuario), JSON.stringify(form));
  }, [form, usuario]);

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

  const actualizarDetalle = (bloque, campo, value) => {
    setForm((prev) => ({
      ...prev,
      detalle: {
        ...prev.detalle,
        [bloque]: {
          ...(prev.detalle[bloque] || {}),
          [campo]: value,
        },
      },
    }));
  };

  const limpiarPlan = async () => {
    const confirm = await Swal.fire({
      title: "Limpiar plan?",
      text: "Se borrara el borrador actual.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, limpiar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    const nuevoFormulario = crearFormularioInicial();
    setForm(nuevoFormulario);
    localStorage.setItem(getStorageKey(usuario), JSON.stringify(nuevoFormulario));
  };

  const enviarPlan = async () => {
    if (!form.condicion) {
      Swal.fire("Validacion", "Selecciona una condicion", "warning");
      return;
    }

    const envioLocal = {
      id: Date.now(),
      enviadoEn: new Date().toISOString(),
      usuario: {
        id: usuario?.id || null,
        nombre: usuario?.nombre || "",
        usuarioAgenciaId: agencia?.usuarioAgenciaId || null,
      },
      agencia: {
        id: agencia?.agenciaId || null,
        nombre: agencia?.nombre || "",
      },
      plan: form,
    };

    try {
      const { data } = await axios.post(
        `${API_URL}/api/planes-batalla`,
        { ...form, fechaFin: null },
        { headers: getAuthHeaders() },
      );

      const enviosKey = getEnviosKey(usuario);
      const enviosPrevios = JSON.parse(localStorage.getItem(enviosKey) || "[]");
      localStorage.setItem(
        enviosKey,
        JSON.stringify([data.plan || envioLocal, ...enviosPrevios]),
      );
      localStorage.removeItem(getStorageKey(usuario));
      setForm(crearFormularioInicial());

      await Swal.fire({
        icon: "success",
        title: "Completado plan de batalla",
        text: "Exitos esta semana",
        confirmButtonText: "Aceptar",
      });
      navigate("/vendedor-panel");
    } catch (error) {
      const enviosKey = getEnviosKey(usuario);
      const enviosPrevios = JSON.parse(localStorage.getItem(enviosKey) || "[]");
      localStorage.setItem(enviosKey, JSON.stringify([envioLocal, ...enviosPrevios]));

      await Swal.fire({
        icon: "warning",
        title: "Plan guardado localmente",
        text:
          error.response?.data?.message ||
          "No se pudo enviar al servidor. Se guardo una copia local.",
        confirmButtonText: "Aceptar",
      });
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
                Plan de batalla semanal
              </div>
              <h1 className="text-2xl font-bold text-slate-950">
                Manejo para la formula por condicion
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
              <div className="grid grid-cols-[170px_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-600">
                <div>Estado</div>
                <div>Descripcion</div>
              </div>

              <div className="divide-y divide-slate-100">
                {BLOQUES.map((bloque) => (
                  <div key={bloque} className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[170px_1fr]">
                    <div>
                      <p className="mb-2 text-sm font-bold text-slate-900">{bloque}</p>
                      <select
                        value={form.detalle[bloque]?.estado || "Pendiente"}
                        onChange={(event) =>
                          actualizarDetalle(bloque, "estado", event.target.value)
                        }
                        className="h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        {ESTADOS.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
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
                onClick={() => navigate("/vendedor-panel")}
                className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <MdArrowBack size={18} />
                Volver
              </button>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={limpiarPlan}
                  className="inline-flex items-center justify-center gap-2 rounded border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50"
                >
                  <MdDeleteOutline size={18} />
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={enviarPlan}
                  className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <MdSend size={18} />
                  Enviar plan
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
