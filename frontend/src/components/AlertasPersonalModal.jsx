/* eslint-disable react/prop-types */
import { FaCalendarCheck, FaDoorOpen, FaTimes, FaUserClock } from "react-icons/fa";

const formatearFecha = (fecha) => {
  if (!fecha) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T00:00:00.000Z`));
};

function AlertasPersonalModal({ alertas, cargando, error, fecha, onClose }) {
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
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white/20 p-2.5">
              <FaUserClock className="h-5 w-5" />
            </span>
            <div>
              <h2 id="alertas-personal-titulo" className="text-lg font-bold">
                Novedades de personal
              </h2>
              <p className="text-xs text-amber-50">
                {fecha ? formatearFecha(fecha) : "Alertas del día"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar alertas de personal"
            className="rounded-lg p-2 text-white/90 transition hover:bg-white/20 hover:text-white"
          >
            <FaTimes />
          </button>
        </header>

        <div className="max-h-[65vh] overflow-y-auto p-5">
          {cargando && (
            <div className="flex items-center justify-center gap-3 py-10 text-sm text-gray-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              Consultando novedades...
            </div>
          )}

          {!cargando && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {!cargando && !error && alertas.length === 0 && (
            <div className="flex flex-col items-center py-9 text-center">
              <span className="mb-3 rounded-full bg-emerald-100 p-4 text-emerald-600">
                <FaCalendarCheck className="h-6 w-6" />
              </span>
              <p className="font-semibold text-gray-700">Sin novedades para hoy</p>
              <p className="mt-1 max-w-xs text-sm text-gray-500">
                No hay ingresos que cumplan 15 días ni salidas registradas en esta fecha.
              </p>
            </div>
          )}

          {!cargando && !error && alertas.length > 0 && (
            <div className="space-y-3">
              {alertas.map((alerta) => {
                const esSalida = alerta.tipo === "FECHA_SALIDA";

                return (
                  <article
                    key={alerta.id}
                    className={`flex gap-3 rounded-xl border p-4 ${
                      esSalida
                        ? "border-orange-200 bg-orange-50"
                        : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 rounded-lg p-2 ${
                        esSalida
                          ? "bg-orange-100 text-orange-600"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {esSalida ? <FaDoorOpen /> : <FaUserClock />}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-800">{alerta.titulo}</h3>
                      <p className="mt-1 text-sm leading-5 text-gray-600">
                        {alerta.mensaje}
                      </p>
                      <p className="mt-2 text-xs font-medium text-gray-500">
                        Fecha registrada: {formatearFecha(alerta.fechaReferencia)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default AlertasPersonalModal;
