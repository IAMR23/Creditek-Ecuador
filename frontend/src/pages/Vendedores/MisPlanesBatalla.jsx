import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import {
  MdAdd,
  MdArrowBack,
  MdDeleteOutline,
  MdOutlineAssignmentTurnedIn,
  MdVisibility,
} from "react-icons/md";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import {
  clasesEstadoItemFormula,
  etiquetaEstadoItemFormula,
  normalizarItemsFormula,
} from "../../utils/planBatallaRespuestas";

const ENVIOS_KEY = "planes_batalla_enviados";

const CONDICIONES_LABELS = {
  inexistencia: "Inexistencia",
  peligro: "Peligro",
  emergencia: "Emergencia",
  normal: "Normal",
  afluencia: "Afluencia",
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

const leerPlanes = () => {
  try {
    const planes = JSON.parse(localStorage.getItem(ENVIOS_KEY) || "[]");
    return Array.isArray(planes) ? planes : [];
  } catch {
    return [];
  }
};

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const getUsuarioAgenciaId = (usuario) =>
  usuario?.agenciaPrincipal?.usuarioAgenciaId || usuario?.usuarioAgenciaId || "";

const getEnviosKey = (usuario) => {
  const usuarioAgenciaId = getUsuarioAgenciaId(usuario);
  return usuarioAgenciaId
    ? `${ENVIOS_KEY}_${usuarioAgenciaId}`
    : ENVIOS_KEY;
};

const formatearFecha = (value) => {
  if (!value) return "-";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    const [year, month, day] = String(value).split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  return fecha.toLocaleString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MisPlanesBatalla() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [planSeleccionadoId, setPlanSeleccionadoId] = useState(null);

  useEffect(() => {
    setUsuario(leerUsuarioToken());
  }, []);

  useEffect(() => {
    const cargarPlanes = async () => {
      const usuarioToken = leerUsuarioToken();

      try {
        const { data } = await axios.get(`${API_URL}/api/planes-batalla/mios`, {
          headers: getAuthHeaders(),
        });
        setPlanes(data.planes || []);
      } catch (error) {
        console.error("Error cargando mis planes de batalla:", error);
        try {
          const planesLocales = JSON.parse(
            localStorage.getItem(getEnviosKey(usuarioToken)) || "[]",
          );
          setPlanes(Array.isArray(planesLocales) ? planesLocales : []);
        } catch {
          setPlanes(leerPlanes().filter(
            (plan) =>
              String(plan.usuario?.usuarioAgenciaId || "") ===
              String(getUsuarioAgenciaId(usuarioToken)),
          ));
        }
      }
    };

    cargarPlanes();
  }, []);

  const agencia = usuario?.agenciaPrincipal;
  const usuarioAgenciaId = agencia?.usuarioAgenciaId;

  const misPlanes = useMemo(() => {
    if (!usuarioAgenciaId) return [];

    return planes.filter(
      (plan) =>
        String(plan.usuario?.usuarioAgenciaId || "") === String(usuarioAgenciaId),
    );
  }, [planes, usuarioAgenciaId]);

  const planSeleccionado =
    misPlanes.find((plan) => String(plan.id) === String(planSeleccionadoId)) ||
    misPlanes[0] ||
    null;

  const eliminarPlan = async (planId) => {
    const confirm = await Swal.fire({
      title: "Eliminar plan?",
      text: "Se eliminara de tus planes guardados en este navegador.",
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
    } catch (error) {
      console.error("Error eliminando plan en servidor:", error);
    } finally {
      const actualizados = planes.filter(
        (plan) => String(plan.id) !== String(planId),
      );
      localStorage.setItem(getEnviosKey(usuario), JSON.stringify(actualizados));
      setPlanes(actualizados);
    }

    if (String(planSeleccionadoId) === String(planId)) {
      setPlanSeleccionadoId(null);
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
                Mis planes de batalla
              </div>
              <h1 className="text-2xl font-bold text-slate-950">
                Historial de planes enviados
              </h1>
            </div>

            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[460px]">
              <InfoPill label="Vendedor" value={usuario?.nombre || "Sin usuario"} />
              <InfoPill label="Agencia" value={agencia?.nombre || "Sin agencia"} />
            </div>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate("/vendedor-panel")}
            className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <MdArrowBack size={18} />
            Volver
          </button>

          <button
            type="button"
            onClick={() => navigate("/planes-batalla")}
            className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            <MdAdd size={18} />
            Nuevo plan
          </button>
        </div>

        {misPlanes.length === 0 ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Aun no tienes planes enviados
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Cuando envies un plan de batalla semanal aparecera aqui.
            </p>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-bold uppercase text-slate-700">
                  Planes enviados
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                {misPlanes.map((item) => {
                  const activo =
                    String(planSeleccionado?.id) === String(item.id);
                  const condicion =
                    CONDICIONES_LABELS[item.plan?.condicion] ||
                    item.plan?.condicion ||
                    "-";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPlanSeleccionadoId(item.id)}
                      className={`block w-full p-4 text-left transition ${
                        activo ? "bg-emerald-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {condicion}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Enviado: {formatearFecha(item.enviadoEn)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Fecha: {item.plan?.fechaInicio || "-"}
                          </p>
                        </div>
                        <MdVisibility
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
          <MdDeleteOutline size={18} />
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
            {Object.entries(respuestas).length === 0 ? (
              <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                Sin respuestas registradas.
              </p>
            ) : (
              Object.entries(respuestas).map(([numero, respuesta]) => {
                const items = normalizarItemsFormula(respuesta);

                return (
                  <div key={numero} className="rounded border border-slate-200 p-3">
                    <p className="text-xs font-black uppercase text-slate-500">
                      Pregunta {numero}
                    </p>
                    <div className="mt-2 space-y-2">
                      {items.map((item, itemIndex) => (
                        <div
                          key={item.id || itemIndex}
                          className="rounded border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-500">
                              Ítem {itemIndex + 1}
                            </span>
                            <span
                              className={`rounded border px-2 py-1 text-xs font-bold ${
                                clasesEstadoItemFormula[item.estado]
                              }`}
                            >
                              {etiquetaEstadoItemFormula(item.estado)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-sm text-slate-800">
                            {item.descripcion || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
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
