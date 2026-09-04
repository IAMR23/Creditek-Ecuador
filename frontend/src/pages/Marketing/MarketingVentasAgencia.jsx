import { useCallback, useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import CopaCreditekConfiguracion from "./CopaCreditek/CopaCreditekConfiguracion";
import CopaCreditekMarcador from "./CopaCreditek/CopaCreditekMarcador";

const STORAGE_KEY = "copaCreditekFiltros";

const formatearFechaLocal = (fecha) => {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
};

const obtenerSemanaActualLocal = () => {
  const hoy = new Date();
  const desplazamientoLunes = (hoy.getDay() + 6) % 7;
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  inicio.setDate(inicio.getDate() - desplazamientoLunes);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  return {
    fechaInicio: formatearFechaLocal(inicio),
    fechaFin: formatearFechaLocal(fin),
  };
};

const cargarFiltrosIniciales = () => {
  const semanaActual = obtenerSemanaActualLocal();
  try {
    const guardados = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (guardados?.fechaInicio && guardados?.fechaFin) {
      return {
        fechaInicio: guardados.fechaInicio,
        fechaFin: guardados.fechaFin,
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(semanaActual));
  return semanaActual;
};

const obtenerMensajeError = (error, predeterminado) =>
  error.response?.data?.message || error.message || predeterminado;

const crearBlobDesdeCanvas = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((resultado) => {
      if (resultado) resolve(resultado);
      else reject(new Error("No se pudo generar la imagen PNG."));
    }, "image/png");
  });

const esErrorFocoPortapapeles = (error) => {
  const mensaje = String(error?.message || error || "").toLowerCase();
  const nombre = String(error?.name || "").toLowerCase();
  return (
    nombre.includes("notallowed") ||
    mensaje.includes("document is not focused") ||
    mensaje.includes("focus") ||
    mensaje.includes("user activation") ||
    mensaje.includes("gesto")
  );
};

export default function MarketingVentasAgencia() {
  const [tabActiva, setTabActiva] = useState("marcador");
  const [filtros, setFiltros] = useState(cargarFiltrosIniciales);
  const [copa, setCopa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imagenLista, setImagenLista] = useState(null);
  const [copiando, setCopiando] = useState(false);
  const [guardandoId, setGuardandoId] = useState(null);
  const [estadoGuardado, setEstadoGuardado] = useState({ tipo: "", mensaje: "" });
  const posterRef = useRef(null);

  const periodoValido =
    filtros.fechaInicio &&
    filtros.fechaFin &&
    filtros.fechaInicio <= filtros.fechaFin;
  const datosDelPeriodoActual =
    copa?.fechaInicio === filtros.fechaInicio &&
    copa?.fechaFin === filtros.fechaFin;

  const cargarCopa = useCallback(async () => {
    if (!periodoValido) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin.");
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/marketing/copa-creditek", {
        params: filtros,
      });
      setCopa(data);
      return data;
    } catch (requestError) {
      setError(
        obtenerMensajeError(requestError, "No se pudo consultar la Copa Creditek."),
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [filtros, periodoValido]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtros));
    cargarCopa();
  }, [filtros, cargarCopa]);

  const cambiarFecha = (campo) => (event) => {
    setFiltros((actuales) => ({
      ...actuales,
      [campo]: event.target.value,
    }));
  };

  const copiarImagen = async () => {
    if (
      !posterRef.current ||
      !imagenLista ||
      !copa ||
      loading ||
      !datosDelPeriodoActual
    ) {
      await Swal.fire({
        icon: "warning",
        title: "Copa no disponible",
        text: "Espera a que la imagen y los datos terminen de cargar.",
      });
      return;
    }

    setCopiando(true);
    let blobPromesa = null;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error(
          "Este navegador no permite copiar imágenes. Usa Chrome o Edge mediante HTTPS.",
        );
      }

      window.focus();
      blobPromesa = (async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );

        const canvas = await html2canvas(posterRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: null,
          logging: false,
          onclone: (documentoClonado) => {
            documentoClonado
              .querySelectorAll(
                "[data-copa-bloque-vendedores], [data-copa-fila-vendedor], [data-copa-nombre-vendedor], [data-copa-resultado-vendedor]",
              )
              .forEach((elemento) => {
                elemento.style.overflow = "visible";
              });
          },
        });
        return crearBlobDesdeCanvas(canvas);
      })();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromesa }),
      ]);

      await Swal.fire({
        icon: "success",
        title: "Imagen copiada",
        text: "La Copa Creditek está lista para pegarse en WhatsApp u otra aplicación.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (captureError) {
      if (blobPromesa && esErrorFocoPortapapeles(captureError)) {
        try {
          const blob = await blobPromesa;
          const resultado = await Swal.fire({
            icon: "info",
            title: "Imagen lista",
            text: "Toca Copiar ahora para completar la copia.",
            confirmButtonText: "Copiar ahora",
            showCancelButton: true,
            cancelButtonText: "Cancelar",
            allowOutsideClick: false,
            didOpen: () => {
              Swal.getConfirmButton()?.focus();
            },
            preConfirm: async () => {
              window.focus();
              await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
              ]);
            },
          });

          if (resultado.isConfirmed) {
            await Swal.fire({
              icon: "success",
              title: "Imagen copiada",
              text: "La Copa Creditek estÃ¡ lista para pegarse en WhatsApp u otra aplicaciÃ³n.",
              timer: 1800,
              showConfirmButton: false,
            });
            return;
          }
        } catch (retryError) {
          captureError = retryError;
        }
      }

      await Swal.fire({
        icon: "error",
        title: "No se pudo copiar la Copa",
        text: captureError.message || "Intenta nuevamente.",
      });
    } finally {
      setCopiando(false);
    }
  };

  const guardarVendedor = async (vendedor, valores) => {
    setGuardandoId(vendedor.usuarioId);
    setEstadoGuardado({ tipo: "", mensaje: "" });
    try {
      await api.patch(
        `/api/marketing/copa-creditek/vendedores/${vendedor.usuarioId}/configuracion`,
        {
          alias: valores.alias,
          equipoCopa: valores.equipoCopa,
          mostrarEnMarcador: valores.mostrarEnMarcador,
        },
      );
      await api.put(
        `/api/marketing/copa-creditek/vendedores/${vendedor.usuarioId}/periodo/meta`,
        { ...filtros, meta: valores.meta },
      );

      if (valores.ventasManual === "") {
        if (vendedor.ventasManual !== null) {
          await api.delete(
            `/api/marketing/copa-creditek/vendedores/${vendedor.usuarioId}/periodo/ventas-manual`,
            { params: filtros },
          );
        }
      } else {
        await api.put(
          `/api/marketing/copa-creditek/vendedores/${vendedor.usuarioId}/periodo/ventas-manual`,
          { ...filtros, ventasManual: valores.ventasManual },
        );
      }

      await cargarCopa();
      setEstadoGuardado({
        tipo: "exito",
        mensaje: `Configuración de ${vendedor.nombreCorto} guardada.`,
      });
    } catch (saveError) {
      setEstadoGuardado({
        tipo: "error",
        mensaje: obtenerMensajeError(
          saveError,
          "No se pudo guardar la configuración.",
        ),
      });
      await cargarCopa();
      throw saveError;
    } finally {
      setGuardandoId(null);
    }
  };

  const guardarTodosLosVendedores = async (vendedores) => {
    setGuardandoId("todos");
    setEstadoGuardado({ tipo: "", mensaje: "" });
    try {
      const { data } = await api.put(
        "/api/marketing/copa-creditek/configuracion-completa",
        {
          ...filtros,
          vendedores,
        },
      );
      await cargarCopa();
      setEstadoGuardado({
        tipo: "exito",
        mensaje: `${data.actualizados || vendedores.length} vendedores guardados correctamente.`,
      });
    } catch (saveError) {
      setEstadoGuardado({
        tipo: "error",
        mensaje: obtenerMensajeError(
          saveError,
          "No se pudo guardar la configuración completa.",
        ),
      });
      throw saveError;
    } finally {
      setGuardandoId(null);
    }
  };

  const restaurarAutomatico = async (vendedor) => {
    setGuardandoId(vendedor.usuarioId);
    setEstadoGuardado({ tipo: "", mensaje: "" });
    try {
      await api.delete(
        `/api/marketing/copa-creditek/vendedores/${vendedor.usuarioId}/periodo/ventas-manual`,
        { params: filtros },
      );
      await cargarCopa();
      setEstadoGuardado({
        tipo: "exito",
        mensaje: `Las ventas de ${vendedor.nombreCorto} vuelven a ser automáticas.`,
      });
    } catch (restoreError) {
      setEstadoGuardado({
        tipo: "error",
        mensaje: obtenerMensajeError(
          restoreError,
          "No se pudo restaurar el valor automático.",
        ),
      });
    } finally {
      setGuardandoId(null);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1400px] p-3 sm:p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
            Marcador oficial
          </p>
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
            Copa Creditek 2026
          </h1>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="text-sm font-semibold text-slate-700">
            Fecha inicio
            <input
              type="date"
              value={filtros.fechaInicio}
              onChange={cambiarFecha("fechaInicio")}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Fecha fin
            <input
              type="date"
              value={filtros.fechaFin}
              onChange={cambiarFecha("fechaFin")}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
          <button
            type="button"
            onClick={cargarCopa}
            disabled={loading || !periodoValido}
            className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Actualizar
          </button>
          <button
            type="button"
            onClick={copiarImagen}
            disabled={
              copiando ||
              loading ||
              !imagenLista ||
              !copa ||
              !datosDelPeriodoActual ||
              tabActiva !== "marcador"
            }
            className="rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copiando ? "Copiando imagen..." : "Copiar imagen"}
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-2 border-b border-slate-200" role="tablist">
        {[
          ["marcador", "Marcador"],
          ["configuracion", "Configuración"],
        ].map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tabActiva === id}
            onClick={() => setTabActiva(id)}
            className={`border-b-2 px-4 py-3 text-sm font-extrabold uppercase tracking-wide transition ${
              tabActiva === id
                ? "border-blue-700 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
      {loading && !copa && (
        <p className="py-10 text-center font-semibold text-slate-600">
          Cargando Copa...
        </p>
      )}
      {loading && copa && (
        <p className="mb-3 text-sm font-semibold text-blue-700">
          Actualizando marcador...
        </p>
      )}
      {imagenLista === false && tabActiva === "marcador" && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          No se pudo cargar /CopaCreditek2026.webp. Verifica que la plantilla
          oficial exista en frontend/public/.
        </div>
      )}

      {tabActiva === "marcador" && copa && (
        <CopaCreditekMarcador
          copa={copa}
          posterRef={posterRef}
          onImageReady={setImagenLista}
        />
      )}

      {tabActiva === "configuracion" && copa && (
        <CopaCreditekConfiguracion
          vendedores={copa.vendedores || []}
          guardandoId={guardandoId}
          estadoGuardado={estadoGuardado}
          accionesDeshabilitadas={loading || !datosDelPeriodoActual}
          onGuardar={guardarVendedor}
          onGuardarTodos={guardarTodosLosVendedores}
          onRestaurarAutomatico={restaurarAutomatico}
        />
      )}
    </section>
  );
}
