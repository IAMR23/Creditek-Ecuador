/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";

const EQUIPOS = ["Caupicho", "Sangolquí", "Nueva Aurora", "Martha Bucaram"];

const normalizarBusqueda = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const crearBorradores = (vendedores) =>
  Object.fromEntries(
    vendedores.map((vendedor) => [
      vendedor.usuarioId,
      {
        alias: vendedor.alias || "",
        equipoCopa: vendedor.equipoCopa || "",
        mostrarEnMarcador: vendedor.mostrarEnMarcador !== false,
        meta: String(vendedor.meta ?? 0),
        ventasManual:
          vendedor.ventasManual === null ? "" : String(vendedor.ventasManual),
      },
    ]),
  );

export default function CopaCreditekConfiguracion({
  vendedores,
  guardandoId,
  estadoGuardado,
  accionesDeshabilitadas,
  onGuardar,
  onGuardarTodos,
  onRestaurarAutomatico,
}) {
  const [borradores, setBorradores] = useState(() => crearBorradores(vendedores));
  const [errorLocal, setErrorLocal] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloSinAlias, setSoloSinAlias] = useState(false);
  const [filtroMarcador, setFiltroMarcador] = useState("todos");

  const vendedoresFiltrados = useMemo(() => {
    const terminos = normalizarBusqueda(busqueda).split(/\s+/).filter(Boolean);
    return vendedores.filter((vendedor) => {
      if (soloSinAlias && String(vendedor.alias || "").trim()) return false;
      if (
        filtroMarcador === "mostrados" &&
        vendedor.mostrarEnMarcador === false
      ) {
        return false;
      }
      if (
        filtroMarcador === "ocultos" &&
        vendedor.mostrarEnMarcador !== false
      ) {
        return false;
      }

      const contenido = normalizarBusqueda(
        `${vendedor.nombre || ""} ${vendedor.nombreCorto || ""} ${
          vendedor.agencia || ""
        }`,
      );
      return terminos.every((termino) => contenido.includes(termino));
    });
  }, [busqueda, filtroMarcador, soloSinAlias, vendedores]);

  useEffect(() => {
    setBorradores(crearBorradores(vendedores));
  }, [vendedores]);

  const actualizar = (usuarioId, campo, valor) => {
    setBorradores((actuales) => ({
      ...actuales,
      [usuarioId]: { ...actuales[usuarioId], [campo]: valor },
    }));
  };

  const validarBorrador = (vendedor) => {
    const valores = borradores[vendedor.usuarioId];
    const meta = Number(valores.meta);
    const ventasManual =
      valores.ventasManual === "" ? null : Number(valores.ventasManual);

    if (!Number.isSafeInteger(meta) || meta < 0) {
      return {
        error: `${vendedor.nombreCorto}: la meta debe ser un número entero mayor o igual a 0.`,
      };
    }
    if (
      ventasManual !== null &&
      (!Number.isSafeInteger(ventasManual) || ventasManual < 0)
    ) {
      return {
        error: `${vendedor.nombreCorto}: las ventas manuales deben ser un número entero mayor o igual a 0.`,
      };
    }

    return {
      valores: {
        ...valores,
        meta,
        ventasManual: ventasManual === null ? "" : ventasManual,
      },
    };
  };

  const guardar = async (vendedor) => {
    const validacion = validarBorrador(vendedor);
    if (validacion.error) {
      setErrorLocal(validacion.error);
      return;
    }

    setErrorLocal("");
    try {
      await onGuardar(vendedor, validacion.valores);
    } catch {
      // El contenedor conserva el póster y muestra el error de la API.
    }
  };

  const guardarTodos = async () => {
    const filas = [];
    for (const vendedor of vendedores) {
      const validacion = validarBorrador(vendedor);
      if (validacion.error) {
        setErrorLocal(validacion.error);
        return;
      }
      filas.push({
        usuarioId: vendedor.usuarioId,
        ...validacion.valores,
        ventasManual:
          validacion.valores.ventasManual === ""
            ? null
            : validacion.valores.ventasManual,
      });
    }

    setErrorLocal("");
    try {
      await onGuardarTodos(filas);
    } catch {
      // El contenedor muestra el error devuelto por la operación transaccional.
    }
  };

  const restaurar = async (vendedor) => {
    setErrorLocal("");
    await onRestaurarAutomatico(vendedor);
  };

  if (vendedores.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
        No hay vendedores activos con rol Vendedor.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Los valores manuales solo cambian este marcador y este período. No
        modifican ventas, auditoría ni reportes comerciales.
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="w-full text-sm font-semibold text-slate-700 sm:min-w-[260px] sm:flex-1">
            Buscar vendedor o agencia
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Nombre, apellido o agencia..."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={soloSinAlias}
              onChange={(event) => setSoloSinAlias(event.target.checked)}
              className="h-4 w-4 accent-blue-700"
            />
            Solo sin alias
          </label>
          <label className="shrink-0 text-sm font-semibold text-slate-700">
            Estado en marcador
            <select
              value={filtroMarcador}
              onChange={(event) => setFiltroMarcador(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            >
              <option value="todos">Todos</option>
              <option value="mostrados">Mostrados</option>
              <option value="ocultos">Ocultos</option>
            </select>
          </label>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="text-sm font-semibold text-slate-500">
            {vendedoresFiltrados.length} de {vendedores.length} vendedores
          </p>
          <button
            type="button"
            onClick={guardarTodos}
            disabled={guardandoId !== null || accionesDeshabilitadas}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardandoId === "todos" ? "Guardando todo..." : "Guardar todo"}
          </button>
        </div>
      </div>
      {(errorLocal || estadoGuardado.mensaje) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            errorLocal || estadoGuardado.tipo === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {errorLocal || estadoGuardado.mensaje}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[1240px]">
          <div className="grid grid-cols-[1.3fr_.9fr_.85fr_1fr_.75fr_.65fr_1.25fr_auto] gap-3 bg-slate-900 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-white">
            <span>Vendedor</span>
            <span>Agencia actual</span>
            <span>Marcador</span>
            <span>Equipo Copa</span>
            <span>Alias</span>
            <span>Meta</span>
            <span>Ventas Copa</span>
            <span>Acciones</span>
          </div>

          {vendedoresFiltrados.length === 0 && (
            <div className="border-t border-slate-100 px-4 py-8 text-center text-sm font-semibold text-slate-500">
              No se encontraron vendedores con esa búsqueda.
            </div>
          )}

          {vendedoresFiltrados.map((vendedor) => {
            const valores = borradores[vendedor.usuarioId] || {};
            const guardando = guardandoId === vendedor.usuarioId;
            const requiereEquipo =
              valores.mostrarEnMarcador && !valores.equipoCopa;
            return (
              <div
                key={vendedor.usuarioId}
                className="grid grid-cols-[1.3fr_.9fr_.85fr_1fr_.75fr_.65fr_1.25fr_auto] items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900" title={vendedor.nombre}>
                    {vendedor.nombreCorto}
                  </p>
                  <p className="truncate text-xs text-slate-500" title={vendedor.nombre}>
                    {vendedor.nombre}
                  </p>
                </div>
                <span className="truncate text-slate-700">
                  {vendedor.agencia || "Sin agencia activa"}
                </span>
                <select
                  value={valores.mostrarEnMarcador ? "mostrar" : "ocultar"}
                  onChange={(event) =>
                    actualizar(
                      vendedor.usuarioId,
                      "mostrarEnMarcador",
                      event.target.value === "mostrar",
                    )
                  }
                  className={`w-full rounded-lg border px-2 py-2 font-semibold ${
                    valores.mostrarEnMarcador
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-slate-300 bg-slate-100 text-slate-600"
                  }`}
                >
                  <option value="mostrar">Mostrar</option>
                  <option value="ocultar">Ocultar</option>
                </select>
                <div>
                  <select
                    value={valores.equipoCopa || ""}
                    onChange={(event) =>
                      actualizar(vendedor.usuarioId, "equipoCopa", event.target.value)
                    }
                    className={`w-full rounded-lg border px-2 py-2 ${
                      requiereEquipo
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-300"
                    }`}
                  >
                    <option value="">Sin asignar</option>
                    {EQUIPOS.map((equipo) => (
                      <option key={equipo} value={equipo}>
                        {equipo}
                      </option>
                    ))}
                  </select>
                  {requiereEquipo && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      Requiere asignación
                    </p>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={50}
                  value={valores.alias || ""}
                  placeholder={vendedor.nombreCorto}
                  onChange={(event) =>
                    actualizar(vendedor.usuarioId, "alias", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-2 py-2"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={valores.meta ?? "0"}
                  onChange={(event) =>
                    actualizar(vendedor.usuarioId, "meta", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 tabular-nums"
                />
                <div>
                  <p className="text-xs text-slate-600">
                    Calculadas: <strong>{vendedor.ventasCalculadas}</strong>
                  </p>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={valores.ventasManual ?? ""}
                    placeholder="Automático"
                    onChange={(event) =>
                      actualizar(
                        vendedor.usuarioId,
                        "ventasManual",
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 tabular-nums"
                  />
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {vendedor.ventasManual === null
                      ? "Automático"
                      : "Modificado manualmente"}
                  </p>
                </div>
                <div className="flex w-36 flex-col gap-2">
                  <button
                    type="button"
                    disabled={guardandoId !== null || accionesDeshabilitadas}
                    onClick={() => guardar(vendedor)}
                    className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {guardando ? "Guardando..." : "Guardar"}
                  </button>
                  <button
                    type="button"
                    disabled={
                      guardandoId !== null ||
                      accionesDeshabilitadas ||
                      vendedor.ventasManual === null
                    }
                    onClick={() => restaurar(vendedor)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Usar automático
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
