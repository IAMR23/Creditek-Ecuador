/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Edit3,
  Filter,
  LockKeyhole,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { api } from "../../api/client";
import { socket } from "../../socket/socket";
import {
  BLOQUES_PLAN_BATALLA,
  CONDICIONES_PLAN_BATALLA,
} from "../../utils/planBatallaConfig";
import { ESTADOS_ITEMS_FORMULA } from "../../utils/planBatallaRespuestas";

const API_ENDPOINT = "/api/gerencia/consejo-ejecutivo/planes";
const SALAS_ENDPOINT = `${API_ENDPOINT}/salas`;

const ESTADO_CLASES = {
  PENDIENTE: "border-amber-200 bg-amber-50 text-amber-700",
  EN_PROGRESO: "border-blue-200 bg-blue-50 text-blue-700",
  FINALIZADO: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const ESTADO_ETIQUETAS = Object.fromEntries(
  ESTADOS_ITEMS_FORMULA.map((estado) => [estado.value, estado.label]),
);

const generarId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const hoyLocal = () => new Date().toLocaleDateString("en-CA");

const normalizarEstado = (estado) => {
  const value = String(estado || "PENDIENTE")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return ESTADO_ETIQUETAS[value] ? value : "PENDIENTE";
};

const crearItem = (item = {}) => ({
  id: item.id || generarId(),
  descripcion: String(item.descripcion || ""),
  estado: normalizarEstado(item.estado),
  responsableId:
    item.responsableId === undefined || item.responsableId === null
      ? ""
      : String(item.responsableId),
  responsableNombre: String(item.responsableNombre || ""),
});

const normalizarItems = (items, incluirVacio = true) => {
  const lista = Array.isArray(items) ? items.map(crearItem) : [];
  return lista.length || !incluirVacio ? lista : [crearItem()];
};

const crearRespuestas = (condicion, respuestas = {}) => {
  const cantidad =
    CONDICIONES_PLAN_BATALLA[condicion]?.formula.length ||
    CONDICIONES_PLAN_BATALLA.inexistencia.formula.length;

  return Array.from({ length: cantidad }, (_, index) => index + 1).reduce(
    (acc, numero) => {
      acc[numero] = normalizarItems(respuestas?.[numero]);
      return acc;
    },
    {},
  );
};

const crearDetalle = (detalle = {}) =>
  BLOQUES_PLAN_BATALLA.reduce((acc, bloque) => {
    acc[bloque] = normalizarItems(detalle?.[bloque]);
    return acc;
  }, {});

const crearFormInicial = () => ({
  fecha: hoyLocal(),
  condicion: "inexistencia",
  respuestasFormula: crearRespuestas("inexistencia"),
  detalle: crearDetalle(),
  observaciones: "",
  revision: null,
});

const crearSalaFormInicial = () => ({
  nombre: "",
  descripcion: "",
  participanteIds: [],
});

const usuarioPuedeCrearSalas = () => {
  try {
    const token = localStorage.getItem("token");
    const permisos = jwtDecode(token)?.usuario?.permisosAsignados || [];
    return permisos.some(
      (permiso) => String(permiso).trim().toLowerCase() === "gerencia",
    );
  } catch {
    return false;
  }
};

const crearFormDesdePlan = (plan) => ({
  fecha: plan.fecha || hoyLocal(),
  condicion: plan.condicion || "inexistencia",
  respuestasFormula: crearRespuestas(
    plan.condicion || "inexistencia",
    plan.respuestasFormula,
  ),
  detalle: crearDetalle(plan.detalle),
  observaciones: plan.observaciones || "",
  revision: plan.revision,
});

const obtenerItemsPlan = (plan) => [
  ...Object.values(plan.respuestasFormula || {}).flatMap((items) =>
    normalizarItems(items, false),
  ),
  ...Object.values(plan.detalle || {}).flatMap((items) =>
    normalizarItems(items, false),
  ),
];

const calcularProgreso = (plan) => {
  const items = obtenerItemsPlan(plan);
  const finalizados = items.filter((item) => item.estado === "FINALIZADO").length;
  return {
    total: items.length,
    pendientes: items.filter((item) => item.estado === "PENDIENTE").length,
    enProgreso: items.filter((item) => item.estado === "EN_PROGRESO").length,
    finalizados,
    porcentaje: items.length ? Math.round((finalizados / items.length) * 100) : 0,
  };
};

const ordenarPlanes = (planes) =>
  [...planes].sort((a, b) => {
    const fecha = String(b.fecha || "").localeCompare(String(a.fecha || ""));
    if (fecha) return fecha;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });

const upsertPlan = (planes, plan) => {
  const existe = planes.some((actual) => String(actual.id) === String(plan.id));
  return ordenarPlanes(
    existe
      ? planes.map((actual) =>
          String(actual.id) === String(plan.id) ? plan : actual,
        )
      : [plan, ...planes],
  );
};

const fechaHora = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const limpiarItemsParaEnvio = (items, ubicacion) =>
  normalizarItems(items, false).reduce((acc, item, index) => {
    const descripcion = item.descripcion.trim();
    const responsableId = Number(item.responsableId);
    const tieneResponsable = Number.isInteger(responsableId) && responsableId > 0;

    if (!descripcion && !item.responsableId) return acc;
    if (!descripcion) {
      throw new Error(`${ubicacion}, ítem ${index + 1}: escribe una descripción.`);
    }
    if (!tieneResponsable) {
      throw new Error(`${ubicacion}, ítem ${index + 1}: selecciona un responsable.`);
    }

    acc.push({
      id: item.id,
      descripcion,
      estado: item.estado,
      responsableId,
    });
    return acc;
  }, []);

const prepararPayload = (form) => {
  const cantidadPreguntas =
    CONDICIONES_PLAN_BATALLA[form.condicion].formula.length;
  let totalItems = 0;
  const respuestasFormula = {};

  for (let numero = 1; numero <= cantidadPreguntas; numero += 1) {
    respuestasFormula[numero] = limpiarItemsParaEnvio(
      form.respuestasFormula?.[numero],
      `Pregunta ${numero}`,
    );
    totalItems += respuestasFormula[numero].length;
  }

  const detalle = BLOQUES_PLAN_BATALLA.reduce((acc, bloque) => {
    acc[bloque] = limpiarItemsParaEnvio(form.detalle?.[bloque], bloque);
    totalItems += acc[bloque].length;
    return acc;
  }, {});

  if (!totalItems) {
    throw new Error("Agrega al menos un ítem con descripción y responsable.");
  }

  return {
    fecha: form.fecha,
    condicion: form.condicion,
    respuestasFormula,
    detalle,
    observaciones: form.observaciones,
    ...(form.revision ? { revision: form.revision } : {}),
  };
};

export default function ConsejoEjecutivo() {
  const [tab, setTab] = useState("planes");
  const [salas, setSalas] = useState([]);
  const [salaActivaId, setSalaActivaId] = useState(null);
  const [salaForm, setSalaForm] = useState(crearSalaFormInicial);
  const [salaEditandoId, setSalaEditandoId] = useState(null);
  const [mostrarEditorSala, setMostrarEditorSala] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [form, setForm] = useState(crearFormInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [expandidos, setExpandidos] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardandoSala, setGuardandoSala] = useState(false);
  const [conectado, setConectado] = useState(socket.connected);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState(null);
  const [actualizadoEnVivo, setActualizadoEnVivo] = useState(false);
  const [filtros, setFiltros] = useState({
    fecha: "",
    condicion: "todas",
    estado: "todos",
  });
  const editandoIdRef = useRef(null);
  const salaActivaIdRef = useRef(null);
  const puedeCrearSalas = useMemo(usuarioPuedeCrearSalas, []);

  useEffect(() => {
    editandoIdRef.current = editandoId;
  }, [editandoId]);

  useEffect(() => {
    salaActivaIdRef.current = salaActivaId;
  }, [salaActivaId]);

  const cargarCatalogo = useCallback(async ({ silencioso = false } = {}) => {
    try {
      if (!silencioso) setLoading(true);
      const [salasResponse, responsablesResponse] = await Promise.all([
        api.get(SALAS_ENDPOINT),
        api.get(`${API_ENDPOINT}/responsables`),
      ]);
      const salasRecibidas = salasResponse.data.salas || [];
      const responsablesRecibidos = responsablesResponse.data.responsables || [];
      setSalas(salasRecibidas);
      setResponsables(responsablesRecibidos);
      setUltimaSincronizacion(new Date());

      const salaAbierta = salaActivaIdRef.current;
      if (
        salaAbierta &&
        !salasRecibidas.some((sala) => String(sala.id) === String(salaAbierta))
      ) {
        setSalaActivaId(null);
        setPlanes([]);
        setTab("planes");
      }

      return { salas: salasRecibidas, responsables: responsablesRecibidos };
    } catch (error) {
      if (!silencioso) {
        Swal.fire(
          "Error",
          error.response?.data?.message || "No se pudo cargar el Consejo Ejecutivo",
          "error",
        );
      }
      return null;
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, []);

  const cargarPlanesSala = useCallback(
    async (salaId, { silencioso = false } = {}) => {
      if (!salaId) {
        setPlanes([]);
        return { planes: [] };
      }

      try {
        if (!silencioso) setLoading(true);
        const { data } = await api.get(API_ENDPOINT, { params: { salaId } });
        const planesRecibidos = ordenarPlanes(data.planes || []);
        setPlanes(planesRecibidos);
        setUltimaSincronizacion(new Date());
        return { planes: planesRecibidos };
      } catch (error) {
        if (!silencioso) {
          Swal.fire(
            "Error",
            error.response?.data?.message || "No se pudieron cargar los planes de la sala",
            "error",
          );
        }
        return null;
      } finally {
        if (!silencioso) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    cargarCatalogo();
  }, [cargarCatalogo]);

  useEffect(() => {
    const alConectar = () => setConectado(true);
    const alDesconectar = () => setConectado(false);
    const alActualizar = ({ plan }) => {
      if (!plan) return;
      if (String(plan.salaId) !== String(salaActivaIdRef.current)) return;
      setPlanes((prev) => upsertPlan(prev, plan));
      setUltimaSincronizacion(new Date());

      if (String(editandoIdRef.current) === String(plan.id)) {
        setActualizadoEnVivo(true);
      }
    };
    const alActualizarSalas = () => cargarCatalogo({ silencioso: true });
    const alActualizarPersonal = () => cargarCatalogo({ silencioso: true });

    socket.on("connect", alConectar);
    socket.on("disconnect", alDesconectar);
    socket.on("consejo-ejecutivo:actualizado", alActualizar);
    socket.on("consejo-ejecutivo:salas-actualizadas", alActualizarSalas);
    socket.on("novedades-personal:actualizar", alActualizarPersonal);

    return () => {
      socket.off("connect", alConectar);
      socket.off("disconnect", alDesconectar);
      socket.off("consejo-ejecutivo:actualizado", alActualizar);
      socket.off("consejo-ejecutivo:salas-actualizadas", alActualizarSalas);
      socket.off("novedades-personal:actualizar", alActualizarPersonal);
    };
  }, [cargarCatalogo]);

  const resumen = useMemo(
    () =>
      planes.reduce(
        (acc, plan) => {
          const progreso = calcularProgreso(plan);
          acc.planes += 1;
          acc.items += progreso.total;
          acc.pendientes += progreso.pendientes;
          acc.enProgreso += progreso.enProgreso;
          acc.finalizados += progreso.finalizados;
          return acc;
        },
        { planes: 0, items: 0, pendientes: 0, enProgreso: 0, finalizados: 0 },
      ),
    [planes],
  );

  const planesFiltrados = useMemo(
    () =>
      planes.filter((plan) => {
        if (filtros.fecha && plan.fecha !== filtros.fecha) return false;
        if (filtros.condicion !== "todas" && plan.condicion !== filtros.condicion) {
          return false;
        }
        if (filtros.estado !== "todos") {
          return obtenerItemsPlan(plan).some((item) => item.estado === filtros.estado);
        }
        return true;
      }),
    [filtros, planes],
  );

  const salaActiva = useMemo(
    () => salas.find((sala) => String(sala.id) === String(salaActivaId)) || null,
    [salaActivaId, salas],
  );
  const participantesSala = salaActiva?.participantes || [];
  const condicionActual = CONDICIONES_PLAN_BATALLA[form.condicion];

  const limpiarForm = () => {
    setForm(crearFormInicial());
    setEditandoId(null);
    setActualizadoEnVivo(false);
  };

  const iniciarNuevo = () => {
    if (!salaActivaId) return;
    limpiarForm();
    setTab("formulario");
  };

  const entrarSala = async (sala) => {
    setSalaActivaId(sala.id);
    salaActivaIdRef.current = sala.id;
    setMostrarEditorSala(false);
    limpiarForm();
    setTab("planes");
    await cargarPlanesSala(sala.id);
  };

  const salirSala = () => {
    setSalaActivaId(null);
    salaActivaIdRef.current = null;
    setPlanes([]);
    setMostrarEditorSala(false);
    limpiarForm();
    setTab("planes");
    cargarCatalogo({ silencioso: true });
  };

  const iniciarNuevaSala = () => {
    setSalaEditandoId(null);
    setSalaForm(crearSalaFormInicial());
    setMostrarEditorSala(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editarSala = (sala) => {
    setSalaEditandoId(sala.id);
    setSalaForm({
      nombre: sala.nombre || "",
      descripcion: sala.descripcion || "",
      participanteIds: (sala.participantes || []).map((item) => String(item.id)),
    });
    setMostrarEditorSala(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const alternarParticipante = (id) => {
    const value = String(id);
    setSalaForm((prev) => ({
      ...prev,
      participanteIds: prev.participanteIds.includes(value)
        ? prev.participanteIds.filter((actual) => actual !== value)
        : [...prev.participanteIds, value],
    }));
  };

  const guardarSala = async (event) => {
    event.preventDefault();
    if (!salaForm.participanteIds.length) {
      Swal.fire(
        "Invita participantes",
        "Selecciona al menos un usuario con rol Admin o Administrador.",
        "warning",
      );
      return;
    }

    try {
      setGuardandoSala(true);
      const payload = {
        nombre: salaForm.nombre,
        descripcion: salaForm.descripcion,
        participanteIds: salaForm.participanteIds.map(Number),
      };
      const { data } = salaEditandoId
        ? await api.put(`${SALAS_ENDPOINT}/${salaEditandoId}`, payload)
        : await api.post(SALAS_ENDPOINT, payload);

      setSalas((prev) => {
        const existe = prev.some((sala) => String(sala.id) === String(data.sala.id));
        return existe
          ? prev.map((sala) => (String(sala.id) === String(data.sala.id) ? data.sala : sala))
          : [data.sala, ...prev];
      });
      setMostrarEditorSala(false);
      setSalaEditandoId(null);
      setSalaForm(crearSalaFormInicial());

      if (!salaEditandoId) await entrarSala(data.sala);

      Swal.fire({
        icon: "success",
        title: salaEditandoId ? "Sala actualizada" : "Sala creada",
        text: "Los participantes Admin fueron invitados correctamente.",
        timer: 1700,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "No se pudo guardar la sala",
        error.response?.data?.message || error.message,
        "error",
      );
    } finally {
      setGuardandoSala(false);
    }
  };

  const editarPlan = (plan) => {
    setForm(crearFormDesdePlan(plan));
    setEditandoId(plan.id);
    setActualizadoEnVivo(false);
    setTab("formulario");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cargarVersionReciente = () => {
    const planActualizado = planes.find(
      (plan) => String(plan.id) === String(editandoId),
    );
    if (!planActualizado) return;

    setForm(crearFormDesdePlan(planActualizado));
    setActualizadoEnVivo(false);
  };

  const cambiarCondicion = (condicion) => {
    setForm((prev) => ({
      ...prev,
      condicion,
      respuestasFormula: crearRespuestas(condicion, prev.respuestasFormula),
    }));
  };

  const actualizarItem = (seccion, grupo, itemIndex, campo, value) => {
    setForm((prev) => ({
      ...prev,
      [seccion]: {
        ...prev[seccion],
        [grupo]: normalizarItems(prev[seccion]?.[grupo]).map((item, index) =>
          index === itemIndex ? { ...item, [campo]: value } : item,
        ),
      },
    }));
  };

  const agregarItem = (seccion, grupo) => {
    setForm((prev) => ({
      ...prev,
      [seccion]: {
        ...prev[seccion],
        [grupo]: [...normalizarItems(prev[seccion]?.[grupo]), crearItem()],
      },
    }));
  };

  const eliminarItem = (seccion, grupo, itemIndex) => {
    setForm((prev) => {
      const items = normalizarItems(prev[seccion]?.[grupo]);
      return {
        ...prev,
        [seccion]: {
          ...prev[seccion],
          [grupo]:
            items.length === 1
              ? [crearItem()]
              : items.filter((_, index) => index !== itemIndex),
        },
      };
    });
  };

  const guardarPlan = async (event) => {
    event.preventDefault();

    if (editandoId && actualizadoEnVivo) {
      Swal.fire(
        "Hay una versión más reciente",
        "Carga la actualización recibida antes de guardar para no perder cambios de otra sesión.",
        "info",
      );
      return;
    }

    try {
      if (!salaActivaId) throw new Error("Selecciona una sala antes de guardar el plan.");
      const payload = { ...prepararPayload(form), salaId: salaActivaId };
      setGuardando(true);
      const { data } = editandoId
        ? await api.put(`${API_ENDPOINT}/${editandoId}`, payload)
        : await api.post(API_ENDPOINT, payload);

      setPlanes((prev) => upsertPlan(prev, data.plan));
      limpiarForm();
      setTab("planes");
      setUltimaSincronizacion(new Date());

      Swal.fire({
        icon: "success",
        title: editandoId ? "Plan actualizado" : "Plan creado",
        text: "El cambio ya se sincronizó con las demás sesiones.",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      if (error.response?.status === 409) {
        const datosActualizados = await cargarPlanesSala(salaActivaId, {
          silencioso: true,
        });
        const planActualizado = datosActualizados?.planes.find(
          (plan) => String(plan.id) === String(editandoId),
        );
        if (planActualizado) {
          setForm(crearFormDesdePlan(planActualizado));
          setActualizadoEnVivo(false);
        }
      }
      Swal.fire(
        error.response?.status === 409 ? "Plan actualizado en otra sesión" : "Revisa el plan",
        error.response?.data?.message || error.message || "No se pudo guardar el plan",
        error.response?.status === 409 ? "info" : "warning",
      );
    } finally {
      setGuardando(false);
    }
  };

  const alternarExpandido = (id) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                Gerencia
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">
                Consejo Ejecutivo
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Salas privadas para crear el plan de batalla con participantes Admin invitados.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${
                  conectado
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                <Radio size={14} className={conectado ? "animate-pulse" : ""} />
                {conectado ? "Tiempo real activo" : "Reconectando tiempo real"}
              </div>
              {puedeCrearSalas && (
                <button
                  type="button"
                  onClick={iniciarNuevaSala}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  <UserPlus size={18} />
                  Nueva sala
                </button>
              )}
              {salaActiva && (
                <button
                  type="button"
                  onClick={iniciarNuevo}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <Plus size={18} />
                  Nuevo plan
                </button>
              )}
            </div>
          </div>
          {ultimaSincronizacion && (
            <p className="mt-3 text-xs text-slate-400">
              Última sincronización: {fechaHora(ultimaSincronizacion)}
            </p>
          )}
        </header>

        {mostrarEditorSala && (
          <EditorSala
            form={salaForm}
            responsables={responsables}
            editando={Boolean(salaEditandoId)}
            guardando={guardandoSala}
            onChange={(campo, value) =>
              setSalaForm((prev) => ({ ...prev, [campo]: value }))
            }
            onAlternarParticipante={alternarParticipante}
            onSubmit={guardarSala}
            onCancelar={() => {
              setMostrarEditorSala(false);
              setSalaEditandoId(null);
              setSalaForm(crearSalaFormInicial());
            }}
          />
        )}

        {!salaActiva ? (
          <SalasPanel
            salas={salas}
            loading={loading}
            puedeCrear={puedeCrearSalas}
            onCrear={iniciarNuevaSala}
            onEntrar={entrarSala}
            onEditar={editarSala}
            onActualizar={() => cargarCatalogo()}
          />
        ) : (
          <>
            <section className="mb-5 rounded-xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={salirSala}
                    className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-emerald-300 hover:text-emerald-200"
                  >
                    <ArrowLeft size={15} />
                    Volver a mis salas
                  </button>
                  <div className="flex items-center gap-2">
                    <LockKeyhole size={20} className="text-emerald-400" />
                    <h2 className="text-xl font-black">{salaActiva.nombre}</h2>
                  </div>
                  {salaActiva.descripcion && (
                    <p className="mt-2 max-w-3xl text-sm text-slate-300">
                      {salaActiva.descripcion}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {participantesSala.map((participante) => (
                      <span
                        key={participante.id}
                        className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200"
                      >
                        {participante.nombre}
                      </span>
                    ))}
                  </div>
                </div>
                {salaActiva.puedeAdministrar && puedeCrearSalas && (
                  <button
                    type="button"
                    onClick={() => editarSala(salaActiva)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <Settings size={16} />
                    Administrar invitados
                  </button>
                )}
              </div>
            </section>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Planes" value={resumen.planes} icon={<UsersRound size={18} />} />
          <Metric label="Ítems" value={resumen.items} icon={<Activity size={18} />} />
          <Metric label="Pendientes" value={resumen.pendientes} tone="amber" />
          <Metric label="En progreso" value={resumen.enProgreso} tone="blue" />
          <Metric label="Finalizados" value={resumen.finalizados} tone="green" />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <TabButton active={tab === "planes"} onClick={() => setTab("planes")}>
            Planes compartidos
          </TabButton>
          <TabButton active={tab === "formulario"} onClick={() => setTab("formulario")}>
            {editandoId ? "Editar plan" : "Crear plan"}
          </TabButton>
        </div>

        {tab === "formulario" ? (
          <form onSubmit={guardarPlan} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-black text-slate-900">
                  {editandoId ? "Editar plan compartido" : "Nuevo plan compartido"}
                </h2>
                {editandoId && (
                  <p className="text-xs text-slate-500">Revisión {form.revision}</p>
                )}
              </div>
              {actualizadoEnVivo && (
                <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 sm:flex-row sm:items-center">
                  <span>Este plan cambió en otra sesión. Tus cambios locales siguen intactos.</span>
                  <button
                    type="button"
                    onClick={cargarVersionReciente}
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                  >
                    Cargar versión reciente
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <Field label="Fecha">
                <input
                  type="date"
                  required
                  value={form.fecha}
                  onChange={(event) => setForm((prev) => ({ ...prev, fecha: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </Field>

              <Field label="Condición">
                <select
                  value={form.condicion}
                  onChange={(event) => cambiarCondicion(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  {Object.entries(CONDICIONES_PLAN_BATALLA).map(([value, condicion]) => (
                    <option key={value} value={value}>
                      {condicion.label}
                    </option>
                  ))}
                </select>
              </Field>

              {!participantesSala.length && (
                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Esta sala no tiene participantes Admin disponibles para asignar ítems.
                </div>
              )}

              <section className="md:col-span-2 overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-black uppercase text-slate-700">
                    Preguntas según la condición
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {condicionActual.formula.map((pregunta, index) => {
                    const numero = index + 1;
                    return (
                      <EditorGrupoItems
                        key={numero}
                        titulo={`${numero}.- ${pregunta}`}
                        items={normalizarItems(form.respuestasFormula?.[numero])}
                        responsables={participantesSala}
                        onAgregar={() => agregarItem("respuestasFormula", numero)}
                        onActualizar={(itemIndex, campo, value) =>
                          actualizarItem("respuestasFormula", numero, itemIndex, campo, value)
                        }
                        onEliminar={(itemIndex) =>
                          eliminarItem("respuestasFormula", numero, itemIndex)
                        }
                      />
                    );
                  })}
                </div>
              </section>

              <section className="md:col-span-2 overflow-hidden rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-black uppercase text-slate-700">
                    Ítems del plan y su estado
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {BLOQUES_PLAN_BATALLA.map((bloque) => (
                    <EditorGrupoItems
                      key={bloque}
                      titulo={bloque}
                      items={normalizarItems(form.detalle?.[bloque])}
                      responsables={participantesSala}
                      onAgregar={() => agregarItem("detalle", bloque)}
                      onActualizar={(itemIndex, campo, value) =>
                        actualizarItem("detalle", bloque, itemIndex, campo, value)
                      }
                      onEliminar={(itemIndex) =>
                        eliminarItem("detalle", bloque, itemIndex)
                      }
                    />
                  ))}
                </div>
              </section>

              <Field label="Observaciones" className="md:col-span-2">
                <textarea
                  rows={4}
                  value={form.observaciones}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, observaciones: event.target.value }))
                  }
                  className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end">
              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarForm}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <X size={16} />
                  Cancelar edición
                </button>
              )}
              <button
                type="submit"
                disabled={guardando || !participantesSala.length}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={17} />
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear plan"}
              </button>
            </div>
          </form>
        ) : (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black uppercase text-slate-700">
                  <Filter size={16} />
                  Filtros
                </div>
                <button
                  type="button"
                  onClick={() => cargarPlanesSala(salaActivaId)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw size={15} />
                  Actualizar
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Field label="Fecha">
                  <input
                    type="date"
                    value={filtros.fecha}
                    onChange={(event) =>
                      setFiltros((prev) => ({ ...prev, fecha: event.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </Field>
                <Field label="Condición">
                  <select
                    value={filtros.condicion}
                    onChange={(event) =>
                      setFiltros((prev) => ({ ...prev, condicion: event.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="todas">Todas</option>
                    {Object.entries(CONDICIONES_PLAN_BATALLA).map(([value, condicion]) => (
                      <option key={value} value={value}>
                        {condicion.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado de ítem">
                  <select
                    value={filtros.estado}
                    onChange={(event) =>
                      setFiltros((prev) => ({ ...prev, estado: event.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  >
                    <option value="todos">Todos</option>
                    {ESTADOS_ITEMS_FORMULA.map((estado) => (
                      <option key={estado.value} value={estado.value}>
                        {estado.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setFiltros({ fecha: "", condicion: "todas", estado: "todos" })}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <X size={16} />
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                Cargando planes del Consejo Ejecutivo...
              </div>
            ) : planesFiltrados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <UsersRound className="mx-auto text-slate-300" size={38} />
                <p className="mt-3 font-bold text-slate-700">No hay planes con estos filtros</p>
                <button
                  type="button"
                  onClick={iniciarNuevo}
                  className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                >
                  Crear primer plan
                </button>
              </div>
            ) : (
              planesFiltrados.map((plan) => {
                const progreso = calcularProgreso(plan);
                const expandido = expandidos.has(plan.id);
                return (
                  <article key={plan.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-black text-slate-900">
                              {CONDICIONES_PLAN_BATALLA[plan.condicion]?.label || plan.condicion}
                            </h2>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                              {plan.fecha}
                            </span>
                            <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">
                              Revisión {plan.revision}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Actualizado por {plan.actualizadoPor?.nombre || "Usuario no disponible"} · {fechaHora(plan.updatedAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editarPlan(plan)}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            <Edit3 size={15} />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => alternarExpandido(plan.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            {expandido ? "Ocultar" : "Ver ítems"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <DatoProgreso label="Total" value={progreso.total} />
                        <DatoProgreso label="Pendientes" value={progreso.pendientes} tone="amber" />
                        <DatoProgreso label="En progreso" value={progreso.enProgreso} tone="blue" />
                        <DatoProgreso label="Finalizados" value={progreso.finalizados} tone="green" />
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${progreso.porcentaje}%` }}
                        />
                      </div>
                      <p className="mt-1 text-right text-xs font-bold text-slate-500">
                        {progreso.porcentaje}% completado
                      </p>
                    </div>

                    {expandido && <DetallePlan plan={plan} />}
                  </article>
                );
              })
            )}
          </section>
        )}
          </>
        )}
      </div>
    </div>
  );
}

function EditorSala({
  form,
  responsables,
  editando,
  guardando,
  onChange,
  onAlternarParticipante,
  onSubmit,
  onCancelar,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-5 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-emerald-50 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Sala privada
          </p>
          <h2 className="font-black text-slate-900">
            {editando ? "Administrar sala e invitados" : "Crear sala del Consejo Ejecutivo"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancelar}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-white"
          aria-label="Cerrar editor de sala"
        >
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        <Field label="Nombre de la sala">
          <input
            required
            maxLength={120}
            value={form.nombre}
            onChange={(event) => onChange("nombre", event.target.value)}
            placeholder="Ej. Consejo Ejecutivo - Semana 33"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </Field>

        <Field label="Descripción">
          <input
            value={form.descripcion}
            onChange={(event) => onChange("descripcion", event.target.value)}
            placeholder="Objetivo o tema principal de la sala"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </Field>

        <div className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-slate-500">
                Invitar participantes Admin
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Solo estos participantes podrán entrar a la sala y ser responsables de ítems.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              {form.participanteIds.length} seleccionados
            </span>
          </div>

          {responsables.length ? (
            <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {responsables.map((responsable) => {
                const seleccionado = form.participanteIds.includes(String(responsable.id));
                return (
                  <label
                    key={responsable.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                      seleccionado
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={seleccionado}
                      onChange={() => onAlternarParticipante(responsable.id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-800">
                        {responsable.nombre}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {responsable.email}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No existen usuarios activos con rol Admin o Administrador para invitar.
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando || !responsables.length}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Save size={16} />
          {guardando ? "Guardando..." : editando ? "Guardar invitaciones" : "Crear sala e invitar"}
        </button>
      </div>
    </form>
  );
}

function SalasPanel({
  salas,
  loading,
  puedeCrear,
  onCrear,
  onEntrar,
  onEditar,
  onActualizar,
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">Mis salas</h2>
          <p className="text-sm text-slate-500">
            Solo aparecen las salas que creaste o a las que fuiste invitado.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onActualizar}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} />
            Actualizar
          </button>
          {puedeCrear && (
            <button
              type="button"
              onClick={onCrear}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <UserPlus size={15} />
              Crear sala
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Cargando salas...</div>
      ) : salas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
          <LockKeyhole className="mx-auto text-slate-300" size={42} />
          <p className="mt-3 font-black text-slate-700">Todavía no tienes salas</p>
          <p className="mt-1 text-sm text-slate-500">
            Crea una sala e invita al personal con rol Admin.
          </p>
          {puedeCrear && (
            <button
              type="button"
              onClick={onCrear}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
            >
              Crear primera sala
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {salas.map((sala) => (
            <article
              key={sala.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-emerald-400">
                  <DoorOpen size={20} />
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-slate-500">
                  {sala.totalPlanes || 0} planes
                </span>
              </div>
              <h3 className="mt-3 text-base font-black text-slate-900">{sala.nombre}</h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-500">
                {sala.descripcion || "Sala privada del Consejo Ejecutivo"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(sala.participantes || []).slice(0, 4).map((participante) => (
                  <span
                    key={participante.id}
                    className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600"
                  >
                    {participante.nombre}
                  </span>
                ))}
                {(sala.participantes || []).length > 4 && (
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600">
                    +{sala.participantes.length - 4}
                  </span>
                )}
              </div>
              <div className="mt-auto flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => onEntrar(sala)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <DoorOpen size={15} />
                  Entrar a la sala
                </button>
                {sala.puedeAdministrar && puedeCrear && (
                  <button
                    type="button"
                    onClick={() => onEditar(sala)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-white"
                    aria-label={`Administrar ${sala.nombre}`}
                  >
                    <Settings size={15} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EditorGrupoItems({
  titulo,
  items,
  responsables,
  onAgregar,
  onActualizar,
  onEliminar,
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm font-black text-slate-800">{titulo}</p>
        <button
          type="button"
          onClick={onAgregar}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
        >
          <Plus size={15} />
          Agregar ítem
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, itemIndex) => (
          <div
            key={item.id}
            className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 xl:grid-cols-[160px_240px_1fr_auto]"
          >
            <Field label="Estado">
              <select
                value={item.estado}
                onChange={(event) => onActualizar(itemIndex, "estado", event.target.value)}
                className={`h-10 w-full rounded-lg border px-2 text-sm font-bold outline-none ${ESTADO_CLASES[item.estado]}`}
              >
                {ESTADOS_ITEMS_FORMULA.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Responsable Admin">
              <select
                value={item.responsableId}
                onChange={(event) => onActualizar(itemIndex, "responsableId", event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">Seleccionar responsable</option>
                {item.responsableId &&
                  !responsables.some(
                    (responsable) => String(responsable.id) === String(item.responsableId),
                  ) && (
                    <option value={item.responsableId} disabled>
                      {item.responsableNombre || "Responsable no disponible"}
                    </option>
                  )}
                {responsables.map((responsable) => (
                  <option key={responsable.id} value={responsable.id}>
                    {responsable.nombre}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={`Ítem ${itemIndex + 1}`}>
              <textarea
                rows={2}
                value={item.descripcion}
                onChange={(event) => onActualizar(itemIndex, "descripcion", event.target.value)}
                placeholder="Describe la acción o resultado esperado"
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </Field>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => onEliminar(itemIndex)}
                aria-label={`Eliminar ítem ${itemIndex + 1}`}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-red-200 px-3 text-red-600 hover:bg-red-50 xl:w-10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetallePlan({ plan }) {
  const gruposFormula = CONDICIONES_PLAN_BATALLA[plan.condicion]?.formula || [];

  return (
    <div className="border-t border-slate-200 bg-slate-50 p-4">
      <div className="space-y-4">
        {gruposFormula.map((pregunta, index) => {
          const items = normalizarItems(plan.respuestasFormula?.[index + 1], false);
          return items.length ? (
            <GrupoLectura key={pregunta} titulo={`${index + 1}.- ${pregunta}`} items={items} />
          ) : null;
        })}

        {BLOQUES_PLAN_BATALLA.map((bloque) => {
          const items = normalizarItems(plan.detalle?.[bloque], false);
          return items.length ? <GrupoLectura key={bloque} titulo={bloque} items={items} /> : null;
        })}

        {obtenerItemsPlan(plan).length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500">Este plan no tiene ítems registrados.</p>
        )}

        {plan.observaciones && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-black uppercase text-slate-500">Observaciones</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{plan.observaciones}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GrupoLectura({ titulo, items }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h3 className="border-b border-slate-100 bg-white px-3 py-2 text-xs font-black uppercase text-slate-700">
        {titulo}
      </h3>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="grid gap-2 px-3 py-3 md:grid-cols-[130px_220px_1fr] md:items-center">
            <span className={`w-fit rounded-full border px-2 py-1 text-xs font-bold ${ESTADO_CLASES[item.estado]}`}>
              {ESTADO_ETIQUETAS[item.estado]}
            </span>
            <span className="text-xs font-bold text-slate-600">
              {item.responsableNombre || "Responsable no disponible"}
            </span>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{item.descripcion}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
        active ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, className = "", children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, tone = "slate", icon }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase opacity-70">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function DatoProgreso({ label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-black uppercase opacity-70">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}
