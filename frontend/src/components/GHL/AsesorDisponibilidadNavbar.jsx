/* eslint-disable react/prop-types */
import { useCallback, useEffect, useState } from "react";
import { FaPause, FaPlay, FaSpinner } from "react-icons/fa";
import api from "../../api/client";

const AVAILABILITY_EVENT = "ghl:availability-updated";
const messageOf = (error) =>
  error.response?.data?.message || error.message || "No se pudo actualizar GHL";

export default function AsesorDisponibilidadNavbar({ auth }) {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isSeller = auth?.isAuthenticated && String(auth?.rol || "").toLowerCase() === "vendedor";

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!isSeller) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/api/ghl/repartos/mi-disponibilidad");
      setAvailability(response.data.disponibilidad);
      setError("");
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isSeller]);

  useEffect(() => {
    if (!isSeller) {
      setAvailability(null);
      setError("");
      return undefined;
    }

    load();
    const interval = window.setInterval(() => load({ silent: true }), 60 * 1000);
    const synchronize = (event) => setAvailability(event.detail);
    window.addEventListener(AVAILABILITY_EVENT, synchronize);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(AVAILABILITY_EVENT, synchronize);
    };
  }, [isSeller, load]);

  const toggle = async () => {
    if (busy || !availability?.vinculado) return;
    const estado = availability.estado === "ACTIVO" ? "PAUSADO" : "ACTIVO";
    setBusy(true);
    setError("");
    try {
      const response = await api.patch("/api/ghl/repartos/mi-disponibilidad", { estado });
      setAvailability(response.data.disponibilidad);
      window.dispatchEvent(new CustomEvent(AVAILABILITY_EVENT, {
        detail: response.data.disponibilidad,
      }));
    } catch (requestError) {
      setError(messageOf(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (!isSeller || loading || !availability?.vinculado) return null;

  const active = availability.estado === "ACTIVO";
  const label = active ? "Pausar reparto" : "Activar reparto";

  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        title={`${label}. Leads recibidos hoy: ${availability.leadsHoy || 0}`}
        aria-label={label}
        className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-xs font-bold shadow-sm transition sm:px-3 ${
          active
            ? "bg-green-500 text-white hover:bg-green-400"
            : "bg-gray-700 text-gray-100 ring-1 ring-gray-500 hover:bg-gray-600"
        } disabled:cursor-wait disabled:opacity-60`}
      >
        {busy ? <FaSpinner className="animate-spin" /> : active ? <FaPause /> : <FaPlay />}
        <span>{active ? "En Play" : "Play"}</span>
        <span className="hidden border-l border-current/30 pl-2 md:inline">
          {availability.leadsHoy || 0} hoy
        </span>
      </button>
      {error && (
        <span className="absolute right-0 top-11 z-50 w-64 rounded border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-700 shadow-lg" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
