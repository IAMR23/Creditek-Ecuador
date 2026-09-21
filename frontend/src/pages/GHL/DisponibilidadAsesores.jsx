import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock3, RefreshCcw, Save, Search, X } from "lucide-react";
import api from "../../api/client";
import AsesoresDisponibilidadPanel from "../../components/GHL/AsesoresDisponibilidadPanel";

const messageOf = (error) =>
  error.response?.data?.message || error.message || "No se pudieron consultar los usuarios de GHL";

export default function DisponibilidadAsesores() {
  const [ghlUsers, setGhlUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [associationFilter, setAssociationFilter] = useState("todos");
  const [autoPauseTime, setAutoPauseTime] = useState("18:00");
  const [savedAutoPauseTime, setSavedAutoPauseTime] = useState("18:00");
  const [pauseConfiguration, setPauseConfiguration] = useState(null);
  const [savingPauseTime, setSavingPauseTime] = useState(false);
  const [success, setSuccess] = useState("");

  const loadGhlUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResponse, pauseResponse] = await Promise.all([
        api.get("/api/ghl/repartos/catalogos/users"),
        api.get("/api/ghl/repartos/asesores/configuracion-pausa"),
      ]);
      const configuration = pauseResponse.data.configuracion || {};
      const configuredTime = configuration.horaPausaAutomatica || "18:00";
      setGhlUsers(usersResponse.data.users || []);
      setAutoPauseTime(configuredTime);
      setSavedAutoPauseTime(configuredTime);
      setPauseConfiguration(configuration);
      setError("");
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGhlUsers();
  }, [loadGhlUsers]);

  const saveAutoPauseTime = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(autoPauseTime) || savingPauseTime) return;
    setSavingPauseTime(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.put("/api/ghl/repartos/asesores/configuracion-pausa", {
        horaPausaAutomatica: autoPauseTime,
      });
      const configuration = response.data.configuracion;
      setPauseConfiguration(configuration);
      setAutoPauseTime(configuration.horaPausaAutomatica);
      setSavedAutoPauseTime(configuration.horaPausaAutomatica);
      setSuccess(response.data.message || "Hora de pausa guardada correctamente");
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setSavingPauseTime(false);
    }
  };

  return (
    <div className="min-h-screen space-y-4 bg-gray-50 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-green-700">GoHighLevel</div>
          <h1 className="text-2xl font-bold text-gray-900">Disponibilidad de asesores</h1>
          <p className="text-sm text-gray-500">
            Asociaciones RVE–GHL y control de Play/Pausa para el reparto de nuevos leads.
          </p>
        </div>
        <button
          type="button"
          onClick={loadGhlUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm disabled:opacity-50"
        >
          <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
          Actualizar usuarios GHL
        </button>
      </header>

      {error && (
        <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between rounded border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")} aria-label="Cerrar mensaje"><X size={16} /></button>
        </div>
      )}

      <section className="rounded border border-green-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-green-100 p-2 text-green-700"><Clock3 size={20} /></div>
            <div>
              <h2 className="font-bold text-gray-900">Pausa automática de asesores</h2>
              <p className="text-sm text-gray-500">A esta hora, todos los asesores que estén en Play pasarán a Pausa. Zona horaria: America/Guayaquil.</p>
              {pauseConfiguration?.migracionPendiente && <p className="mt-1 text-xs font-semibold text-amber-700">La migración de base de datos está pendiente; aplícala antes de guardar.</p>}
              {pauseConfiguration?.updatedAt && <p className="mt-1 text-xs text-gray-500">Última actualización: {new Date(pauseConfiguration.updatedAt).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</p>}
            </div>
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs font-semibold text-gray-600">
              Hora de cierre
              <input
                type="time"
                value={autoPauseTime}
                onChange={(event) => { setAutoPauseTime(event.target.value); setSuccess(""); }}
                className="mt-1 block h-10 rounded border border-gray-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </label>
            <button
              type="button"
              onClick={saveAutoPauseTime}
              disabled={savingPauseTime || pauseConfiguration?.migracionPendiente || autoPauseTime === savedAutoPauseTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(autoPauseTime)}
              className="inline-flex h-10 items-center gap-2 rounded bg-green-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} /> {savingPauseTime ? "Guardando..." : "Guardar hora"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre o correo..."
            aria-label="Buscar asesor por nombre o correo"
            className="h-11 w-full rounded border border-gray-300 bg-white pl-10 pr-10 text-sm shadow-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={17} />
            </button>
          )}
        </div>
        <select
          value={associationFilter}
          onChange={(event) => setAssociationFilter(event.target.value)}
          aria-label="Filtrar por asociación"
          className="h-11 rounded border border-gray-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
        >
          <option value="todos">Todos los asesores</option>
          <option value="asociados">Asociados</option>
          <option value="no-asociados">No asociados</option>
        </select>
      </div>

      <AsesoresDisponibilidadPanel
        key={savedAutoPauseTime}
        ghlUsers={ghlUsers}
        searchTerm={searchTerm}
        associationFilter={associationFilter}
        autoPauseTime={savedAutoPauseTime}
      />
    </div>
  );
}
