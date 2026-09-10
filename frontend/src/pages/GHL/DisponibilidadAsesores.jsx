import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import api from "../../api/client";
import AsesoresDisponibilidadPanel from "../../components/GHL/AsesoresDisponibilidadPanel";

const messageOf = (error) =>
  error.response?.data?.message || error.message || "No se pudieron consultar los usuarios de GHL";

export default function DisponibilidadAsesores() {
  const [ghlUsers, setGhlUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGhlUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/api/ghl/repartos/catalogos/users");
      setGhlUsers(response.data.users || []);
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

      <AsesoresDisponibilidadPanel ghlUsers={ghlUsers} />
    </div>
  );
}
