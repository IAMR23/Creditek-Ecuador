/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { api } from "../../api/client";

const DURACION_MODAL_MS = 10_000;

const ESTILOS = {
  verde: {
    contenedor: "border-green-200 bg-green-50/70",
    titulo: "text-green-800",
    boton:
      "bg-green-600 hover:bg-green-700 focus:ring-green-200 disabled:bg-green-300",
    input: "focus:border-green-500 focus:ring-green-100",
  },
  naranja: {
    contenedor: "border-orange-200 bg-orange-50/70",
    titulo: "text-orange-800",
    boton:
      "bg-orange-600 hover:bg-orange-700 focus:ring-orange-200 disabled:bg-orange-300",
    input: "focus:border-orange-500 focus:ring-orange-100",
  },
};

const ESTILOS_AVISO = {
  exito: {
    icono: "✓",
    iconoClase: "bg-green-100 text-green-700",
    tituloClase: "text-green-800",
  },
  informacion: {
    icono: "i",
    iconoClase: "bg-blue-100 text-blue-700",
    tituloClase: "text-blue-800",
  },
  error: {
    icono: "!",
    iconoClase: "bg-red-100 text-red-700",
    tituloClase: "text-red-800",
  },
};

export default function BusquedaClienteCedula({
  cedula,
  onCedulaChange,
  onClienteEncontrado,
  onClienteNuevo,
  variante = "verde",
}) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const estilos = ESTILOS[variante] || ESTILOS.verde;

  useEffect(() => {
    if (!aviso) return undefined;

    const temporizador = window.setTimeout(() => {
      setAviso(null);
    }, DURACION_MODAL_MS);

    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  const mostrarAviso = (tipo, titulo, mensaje) => {
    setAviso({ tipo, titulo, mensaje });
  };

  const actualizarCedula = (value) => {
    onCedulaChange(String(value || "").replace(/\D/g, "").slice(0, 10));
  };

  const buscarCliente = async () => {
    const cedulaNormalizada = String(cedula || "").replace(/\D/g, "");
    actualizarCedula(cedulaNormalizada);

    if (!/^\d{10}$/.test(cedulaNormalizada)) {
      mostrarAviso(
        "error",
        "Cédula incompleta",
        "Ingrese una cédula de exactamente 10 dígitos para buscar.",
      );
      return;
    }

    try {
      setBuscando(true);
      const { data } = await api.get(
        `/clientes/cedula/${encodeURIComponent(cedulaNormalizada)}`,
      );
      const cliente = data?.cliente || {};

      onClienteEncontrado({
        cliente: cliente.cliente || "",
        cedula: cliente.cedula || cedulaNormalizada,
        telefono: cliente.telefono || "",
        correo: cliente.correo || "",
        direccion: cliente.direccion || "",
      });
      mostrarAviso(
        "exito",
        "Cliente encontrado",
        "Los datos del cliente se cargaron en el formulario.",
      );
    } catch (error) {
      if (error.response?.status === 404) {
        onClienteNuevo(cedulaNormalizada);
        mostrarAviso(
          "informacion",
          "Cliente nuevo",
          "Cliente nuevo, por favor ingrese los datos.",
        );
        return;
      }

      console.error("Error buscando cliente por cédula:", error);
      mostrarAviso(
        "error",
        "No se pudo buscar",
        error.response?.data?.mensaje ||
          "Ocurrió un problema al consultar el cliente. Intente nuevamente.",
      );
    } finally {
      setBuscando(false);
    }
  };

  const manejarTecla = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    buscarCliente();
  };

  const estiloAviso = aviso ? ESTILOS_AVISO[aviso.tipo] : null;

  return (
    <>
      <section className={`rounded-xl border p-4 ${estilos.contenedor}`}>
        <div className="mb-3">
          <h4 className={`font-semibold ${estilos.titulo}`}>
            Buscar cliente registrado
          </h4>
          <p className="mt-1 text-sm text-gray-600">
            Ingrese la cédula para completar automáticamente los datos del
            cliente.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            aria-label="Cédula del cliente para buscar"
            placeholder="Ej: 0102030405"
            value={cedula}
            disabled={buscando}
            onChange={(event) => actualizarCedula(event.target.value)}
            onKeyDown={manejarTecla}
            className={`min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 outline-none transition focus:ring-2 disabled:cursor-wait disabled:bg-gray-100 ${estilos.input}`}
          />
          <button
            type="button"
            disabled={buscando}
            onClick={buscarCliente}
            className={`rounded-lg px-5 py-2 font-semibold text-white outline-none transition focus:ring-4 disabled:cursor-not-allowed ${estilos.boton}`}
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </section>

      {aviso && estiloAviso && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 p-4"
          onClick={() => setAviso(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="aviso-cliente-titulo"
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${estiloAviso.iconoClase}`}
              >
                {estiloAviso.icono}
              </span>
              <div className="min-w-0 flex-1">
                <h3
                  id="aviso-cliente-titulo"
                  className={`font-bold ${estiloAviso.tituloClase}`}
                >
                  {aviso.titulo}
                </h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  {aviso.mensaje}
                </p>
                <p className="mt-3 text-xs text-gray-400">
                  Esta ventana se cerrará automáticamente en 10 segundos.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={() => setAviso(null)}
                className="rounded-md px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
