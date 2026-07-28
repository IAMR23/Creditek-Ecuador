/* eslint-disable react/prop-types */
import { useMemo, useState } from "react";
import {
  FaCalendarCheck,
  FaCheckCircle,
  FaCircle,
  FaDoorOpen,
  FaTimes,
  FaUserClock,
  FaUserPlus,
} from "react-icons/fa";

const formatearFecha = (fecha) => {
  if (!fecha) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T00:00:00.000Z`));
};

const formatearMomento = (fecha) => {
  if (!fecha) return null;
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return null;

  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(valor);
};

function AlertasPersonalModal({
  alertas,
  cargando,
  cargandoMas,
  error,
  total,
  noLeidas,
  hayMas,
  onClose,
  onCargarMas,
  onCambiarLectura,
  onMarcarTodasLeidas,
}) {
  const [filtro, setFiltro] = useState("todas");
  const alertasVisibles = useMemo(
    () =>
      filtro === "no-leidas"
        ? alertas.filter((alerta) => !alerta.leida)
        : alertas,
    [alertas, filtro],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="alertas-personal-titulo"
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl"
      >
        <header className="border-b border-gray-200 bg-white px-5 pb-3 pt-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="alertas-personal-titulo"
                className="text-2xl font-extrabold tracking-tight text-gray-900"
              >
                Notificaciones
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Novedades de personal · {total} en el historial
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar notificaciones de personal"
              className="rounded-full bg-gray-100 p-2.5 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
            >
              <FaTimes />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1 rounded-full bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setFiltro("todas")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  filtro === "todas"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFiltro("no-leidas")}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  filtro === "no-leidas"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                No leídas {noLeidas > 0 ? `(${noLeidas})` : ""}
              </button>
            </div>

            {noLeidas > 0 && (
              <button
                type="button"
                onClick={onMarcarTodasLeidas}
                className="text-xs font-bold text-blue-600 hover:underline sm:text-sm"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4">
          {cargando && alertas.length === 0 && (
            <div className="flex items-center justify-center gap-3 py-12 text-sm text-gray-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              Consultando notificaciones...
            </div>
          )}

          {!cargando && error && alertas.length === 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!cargando && !error && alertasVisibles.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="mb-3 rounded-full bg-blue-100 p-4 text-blue-600">
                <FaCalendarCheck className="h-6 w-6" />
              </span>
              <p className="font-semibold text-gray-700">
                {filtro === "no-leidas"
                  ? "No tienes notificaciones sin leer"
                  : "Aún no hay notificaciones"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">
                Las novedades de usuarios nuevos, salidas y 15 días de ingreso
                aparecerán aquí y permanecerán en el historial.
              </p>
            </div>
          )}

          {alertasVisibles.length > 0 && (
            <div className="space-y-2">
              {alertasVisibles.map((alerta) => {
                const esSalida = alerta.tipo === "FECHA_SALIDA";
                const esCreacion = alerta.tipo === "USUARIO_CREADO";
                const momento = formatearMomento(alerta.creadaAt);

                return (
                  <article
                    key={alerta.id}
                    onClick={() => {
                      if (!alerta.leida) onCambiarLectura(alerta.id, true);
                    }}
                    className={`group relative flex gap-3 rounded-xl border p-3.5 transition ${
                      alerta.leida
                        ? "border-gray-200 bg-white hover:bg-gray-100"
                        : "cursor-pointer border-blue-200 bg-blue-50 hover:bg-blue-100"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        esSalida
                          ? "bg-orange-100 text-orange-600"
                          : esCreacion
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {esSalida ? (
                        <FaDoorOpen />
                      ) : esCreacion ? (
                        <FaUserPlus />
                      ) : (
                        <FaUserClock />
                      )}
                    </span>

                    <div className="min-w-0 flex-1 pr-7">
                      <h3
                        className={`text-sm text-gray-900 ${
                          alerta.leida ? "font-semibold" : "font-extrabold"
                        }`}
                      >
                        {alerta.titulo}
                      </h3>
                      <p className="mt-0.5 text-sm leading-5 text-gray-600">
                        {alerta.mensaje}
                      </p>
                      <p
                        className={`mt-1.5 text-xs ${
                          alerta.leida
                            ? "text-gray-500"
                            : "font-bold text-blue-600"
                        }`}
                      >
                        {esSalida
                          ? "Fecha de salida"
                          : esCreacion
                            ? "Fecha de creación"
                            : "Fecha de ingreso"}
                        : {formatearFecha(alerta.fechaReferencia)}
                        {momento ? ` · ${momento}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      title={
                        alerta.leida
                          ? "Marcar como no leída"
                          : "Marcar como leída"
                      }
                      aria-label={
                        alerta.leida
                          ? "Marcar como no leída"
                          : "Marcar como leída"
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        onCambiarLectura(alerta.id, !alerta.leida);
                      }}
                      className={`absolute right-3 top-4 rounded-full p-1 transition ${
                        alerta.leida
                          ? "text-gray-300 opacity-0 hover:text-blue-600 group-hover:opacity-100"
                          : "text-blue-600 hover:text-blue-800"
                      }`}
                    >
                      {alerta.leida ? <FaCheckCircle /> : <FaCircle />}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          {hayMas && filtro === "todas" && (
            <button
              type="button"
              disabled={cargandoMas}
              onClick={onCargarMas}
              className="mt-4 w-full rounded-xl bg-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-300 disabled:cursor-wait disabled:opacity-60"
            >
              {cargandoMas ? "Cargando..." : "Ver notificaciones anteriores"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default AlertasPersonalModal;
