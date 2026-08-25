import { useEffect, useRef, useState } from "react";
import api from "../../api/client";

const formatearClienteResultado = (cliente) => {
  const identificacion = String(cliente?.cedula || "").trim();
  const nombre = String(cliente?.cliente || "").trim();

  if (identificacion && nombre) return `${identificacion} - ${nombre}`;
  return identificacion || nombre || `Cliente #${cliente.id}`;
};

const obtenerNombreCliente = (cliente) =>
  String(cliente?.cliente || "").trim() ||
  String(cliente?.cedula || "").trim() ||
  `Cliente #${cliente.id}`;

/* eslint-disable react/prop-types */
export default function ClienteAutocomplete({
  value,
  clienteId,
  disabled = false,
  dropdownId,
  inputClassName = "w-full p-1",
  wrapperClassName = "relative min-w-[180px]",
  onChange,
  onSelect,
  onRowKeyDown = () => {},
}) {
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [error, setError] = useState("");
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const contenedorRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const cerrarAlHacerClickFuera = (event) => {
      if (!contenedorRef.current?.contains(event.target)) setAbierto(false);
    };

    document.addEventListener("mousedown", cerrarAlHacerClickFuera);
    return () => document.removeEventListener("mousedown", cerrarAlHacerClickFuera);
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const termino = String(value || "").trim();

    if (disabled || clienteId || termino.length < 2) {
      setResultados([]);
      setBuscando(false);
      setConsultado(false);
      setError("");
      setAbierto(false);
      return undefined;
    }

    setResultados([]);
    setIndiceActivo(-1);
    setAbierto(false);
    setConsultado(false);
    setError("");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setBuscando(true);
        setAbierto(true);
        const response = await api.get("/clientes/buscar", {
          params: { q: termino, limit: 15 },
          signal: controller.signal,
        });

        if (requestId !== requestIdRef.current) return;
        setResultados(response.data?.clientes || []);
        setIndiceActivo(-1);
        setConsultado(true);
      } catch (requestError) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        console.error("Error buscando clientes:", requestError);
        setResultados([]);
        setError("No se pudo buscar. Intente nuevamente.");
        setConsultado(true);
      } finally {
        if (requestId === requestIdRef.current) setBuscando(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [clienteId, disabled, value]);

  const mostrarDropdown =
    abierto &&
    !disabled &&
    (buscando || consultado || Boolean(error) || resultados.length > 0);

  useEffect(() => {
    if (!mostrarDropdown) return undefined;

    const actualizarPosicion = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = Math.min(
        Math.max(rect.width, 280),
        Math.max(160, window.innerWidth - 16),
      );
      const left = Math.max(
        8,
        Math.min(rect.left, Math.max(8, window.innerWidth - width - 8)),
      );
      setDropdownStyle({
        left,
        top: rect.bottom + 4,
        width,
      });
    };

    actualizarPosicion();
    window.addEventListener("resize", actualizarPosicion);
    window.addEventListener("scroll", actualizarPosicion, true);
    return () => {
      window.removeEventListener("resize", actualizarPosicion);
      window.removeEventListener("scroll", actualizarPosicion, true);
    };
  }, [mostrarDropdown]);

  const seleccionar = (cliente) => {
    onSelect({ id: cliente.id, texto: obtenerNombreCliente(cliente) });
    setAbierto(false);
    setResultados([]);
    setConsultado(false);
    setError("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      if (abierto) {
        event.preventDefault();
        event.stopPropagation();
        setAbierto(false);
      }
      return;
    }

    if (event.key === "ArrowDown" && resultados.length) {
      event.preventDefault();
      event.stopPropagation();
      setAbierto(true);
      setIndiceActivo((actual) => (actual + 1) % resultados.length);
      return;
    }

    if (event.key === "ArrowUp" && resultados.length) {
      event.preventDefault();
      event.stopPropagation();
      setAbierto(true);
      setIndiceActivo((actual) =>
        actual <= 0 ? resultados.length - 1 : actual - 1,
      );
      return;
    }

    if (event.key === "Enter" && abierto) {
      event.preventDefault();
      event.stopPropagation();
      const clienteActivo = resultados[indiceActivo >= 0 ? indiceActivo : 0];
      if (clienteActivo) seleccionar(clienteActivo);
      return;
    }

    onRowKeyDown(event);
  };

  return (
    <div ref={contenedorRef} className={wrapperClassName}>
      <input
        ref={inputRef}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (!clienteId && String(value || "").trim().length >= 2) {
            setAbierto(true);
          }
        }}
        onKeyDown={handleKeyDown}
        className={inputClassName}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={mostrarDropdown}
        aria-controls={dropdownId}
      />

      {mostrarDropdown && (
        <div
          id={dropdownId}
          role="listbox"
          style={dropdownStyle}
          className="fixed z-[100] max-h-64 overflow-y-auto rounded-md border border-gray-300 bg-white text-left shadow-xl"
        >
          {buscando ? (
            <div className="px-3 py-2 text-xs text-gray-500">Buscando...</div>
          ) : error ? (
            <div className="px-3 py-2 text-xs text-red-600">{error}</div>
          ) : resultados.length ? (
            resultados.map((cliente, index) => (
              <button
                key={cliente.id}
                type="button"
                role="option"
                aria-selected={index === indiceActivo}
                onMouseEnter={() => setIndiceActivo(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => seleccionar(cliente)}
                className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-xs last:border-b-0 ${
                  index === indiceActivo
                    ? "bg-blue-50 text-blue-900"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {formatearClienteResultado(cliente)}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-500">
              No se encontraron clientes
            </div>
          )}
        </div>
      )}
    </div>
  );
}
/* eslint-enable react/prop-types */
