/* eslint-disable react/prop-types */
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import {
  crearFechaLocal,
  formatearFechaISO,
} from "../../utils/calendarioTareas";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ESTILOS_ESTADO = {
  pendiente: {
    tarea: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    vineta: "bg-amber-500",
    label: "Pendiente",
  },
  en_progreso: {
    tarea: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
    vineta: "bg-blue-500",
    label: "En progreso",
  },
  finalizado: {
    tarea:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    vineta: "bg-emerald-500",
    label: "Finalizado",
  },
};

const normalizarEstado = (estado) =>
  estado === "completada" ? "finalizado" : estado;

const construirDiasCalendario = (mesReferencia) => {
  const referencia = crearFechaLocal(mesReferencia) || new Date();
  const primerDiaMes = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    1,
  );
  const desplazamientoLunes = (primerDiaMes.getDay() + 6) % 7;
  const primerDiaVisible = new Date(primerDiaMes);
  primerDiaVisible.setDate(primerDiaMes.getDate() - desplazamientoLunes);

  return Array.from({ length: 42 }, (_, index) => {
    const fecha = new Date(primerDiaVisible);
    fecha.setDate(primerDiaVisible.getDate() + index);
    return {
      fecha,
      key: formatearFechaISO(fecha),
      perteneceAlMes: fecha.getMonth() === referencia.getMonth(),
    };
  });
};

const tareaCorrespondeAlDia = (tarea, fecha) => {
  const inicio = String(tarea.fechaInicio || "");
  const fin = String(tarea.fechaFin || tarea.fechaInicio || "");
  return Boolean(inicio) && fecha >= inicio && fecha <= fin;
};

export default function CalendarioTareas({
  mes,
  tareas,
  loading,
  error,
  onMesAnterior,
  onMesSiguiente,
  onMesActual,
  onEditarTarea,
}) {
  const dias = useMemo(() => construirDiasCalendario(mes), [mes]);
  const fechaReferencia = crearFechaLocal(mes) || new Date();
  const hoy = formatearFechaISO(new Date());
  const tituloMesSinFormato = new Intl.DateTimeFormat("es-EC", {
    month: "long",
    year: "numeric",
  }).format(fechaReferencia);
  const tituloMes =
    tituloMesSinFormato.charAt(0).toUpperCase() + tituloMesSinFormato.slice(1);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-base font-bold text-gray-900">
            <CalendarDays size={18} className="text-blue-600" />
            {tituloMes}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Selecciona una tarea para consultar o editar sus datos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMesActual}
            className="rounded border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={onMesAnterior}
            aria-label="Mes anterior"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={onMesSiguiente}
            aria-label="Mes siguiente"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
        {Object.entries(ESTILOS_ESTADO).map(([estado, estilos]) => (
          <span key={estado} className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${estilos.vineta}`} />
            {estilos.label}
          </span>
        ))}
      </div>

      {error && (
        <div className="m-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-100">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="border-r border-gray-200 px-3 py-2 text-center text-xs font-bold uppercase text-gray-600 last:border-r-0"
              >
                {dia}
              </div>
            ))}
          </div>

          <div className="relative grid grid-cols-7">
            {dias.map((dia) => {
              const tareasDia = tareas.filter((tarea) =>
                tareaCorrespondeAlDia(tarea, dia.key),
              );
              const esHoy = dia.key === hoy;

              return (
                <div
                  key={dia.key}
                  className={`min-h-32 border-b border-r border-gray-200 p-2 last:border-r-0 ${
                    dia.perteneceAlMes ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  <div className="mb-2 flex justify-end">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        esHoy
                          ? "bg-blue-600 text-white"
                          : dia.perteneceAlMes
                            ? "text-gray-700"
                            : "text-gray-400"
                      }`}
                    >
                      {dia.fecha.getDate()}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {tareasDia.slice(0, 4).map((tarea) => {
                      const estado = normalizarEstado(tarea.status);
                      const estilos =
                        ESTILOS_ESTADO[estado] || ESTILOS_ESTADO.pendiente;

                      return (
                        <button
                          key={tarea.id}
                          type="button"
                          onClick={() => onEditarTarea(tarea)}
                          title={`${tarea.titulo} · ${estilos.label}`}
                          className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs font-semibold transition ${estilos.tarea}`}
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${estilos.vineta}`}
                          />
                          <span className="truncate">{tarea.titulo}</span>
                        </button>
                      );
                    })}

                    {tareasDia.length > 4 && (
                      <div className="px-1 text-xs font-semibold text-gray-500">
                        +{tareasDia.length - 4} tareas más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-sm font-semibold text-gray-600 backdrop-blur-[1px]">
                Cargando calendario...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
