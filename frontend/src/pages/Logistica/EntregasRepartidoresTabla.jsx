import { useEffect, useState, useCallback, useMemo } from "react";
import Swal from "sweetalert2";
import api from "../../api/client";
import { getHoyLocal } from "../../utils/dateUtils";

const OPCIONES_ERRORES = [
  "No reporto entradas o alcance inmediatamente",
  "No coordino la ruta correctamente",
  "Se olvido el contrato",
  "Se olvido el regalo",
  "Retrasos en la coordinación",
  "Retrasos en la entrega",
  "No actualiza al RVE",
  "No envia el TAG",
];

const normalizarTexto = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const nuevaClaveOperacion = () =>
  globalThis.crypto?.randomUUID?.() ||
  `entrega-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function EntregasRepartidoresTabla() {
  const [repartidores, setRepartidores] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingRepartidores, setLoadingRepartidores] = useState(false);

  const [fechaInicio, setFechaInicio] = useState(getHoyLocal());
  const [fechaFin, setFechaFin] = useState(getHoyLocal());
  const [estado, setEstado] = useState("");
  const [clasificacion, setClasificacion] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // control UI errores
  const [filaAbierta, setFilaAbierta] = useState(null);
  const [erroresTemp, setErroresTemp] = useState({});
  const [guardandoErrores, setGuardandoErrores] = useState({});
  const [guardandoTipoEntrega, setGuardandoTipoEntrega] = useState({});
  const [entregaReasignacion, setEntregaReasignacion] = useState(null);
  const [nuevoRepartidorId, setNuevoRepartidorId] = useState("");
  const [reasignando, setReasignando] = useState(false);

  useEffect(() => {
    const fetchRepartidores = async () => {
      try {
        setLoadingRepartidores(true);

        const response = await api.get(
          "/api/usuario-permisos/usuarios-repartidores",
        );

        setRepartidores(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error(err);
        setRepartidores([]);
      } finally {
        setLoadingRepartidores(false);
      }
    };

    fetchRepartidores();
  }, []);

  const fetchEntregas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (repartidorSeleccionado) params.userId = repartidorSeleccionado;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;
      if (estado) params.estado = estado;
      if (clasificacion) params.clasificacion = clasificacion;

      const response = await api.get("/entregas/entregas", {
        params,
      });

      const data = Array.isArray(response.data) ? response.data : [];
      setEntregas(data);

      // inicializar errores temporales desde backend
      const inicial = {};
      data.forEach((entrega) => {
        inicial[entrega.id] = Array.isArray(entrega.errores)
          ? entrega.errores
          : [];
      });
      setErroresTemp(inicial);
    } catch (err) {
      console.error(err);
      setError("Error al cargar entregas");
      setEntregas([]);
    } finally {
      setLoading(false);
    }
  }, [repartidorSeleccionado, fechaInicio, fechaFin, estado, clasificacion]);

  useEffect(() => {
    fetchEntregas();
  }, [fetchEntregas]);

  const entregasFiltradas = useMemo(() => {
    const termino = normalizarTexto(busqueda);
    if (!termino) return entregas;

    return entregas.filter((entrega) =>
      [
        entrega.id,
        entrega.cliente?.cliente,
        entrega.cliente?.cedula,
        entrega.vendedor,
      ].some((value) => normalizarTexto(value).includes(termino)),
    );
  }, [busqueda, entregas]);

  const toggleError = (entregaId, errorTexto) => {
    setErroresTemp((prev) => {
      const actuales = prev[entregaId] || [];
      const existe = actuales.includes(errorTexto);

      return {
        ...prev,
        [entregaId]: existe
          ? actuales.filter((e) => e !== errorTexto)
          : [...actuales, errorTexto],
      };
    });
  };

  const seleccionarNinguno = (entregaId) => {
    setErroresTemp((prev) => ({
      ...prev,
      [entregaId]: [],
    }));
  };

  const guardarErrores = async (id) => {
    try {
      setGuardandoErrores((prev) => ({ ...prev, [id]: true }));

      const errores = erroresTemp[id] || [];

      const actual = entregas.find((entrega) => entrega.id === id);
      const response = await api.put(`/entregas/${id}`, {
        errores,
        expectedVersion: actual?.version,
        motivo: "Actualizacion de errores logisticos",
        idempotencyKey: nuevaClaveOperacion(),
      });

      setEntregas((prev) =>
        prev.map((entrega) =>
          entrega.id === id
            ? { ...entrega, errores, version: response.data.version }
            : entrega,
        ),
      );

      setFilaAbierta(null);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) await fetchEntregas();
      alert(
        err.response?.status === 409
          ? "La entrega cambio mientras la editabas. Se recargaron los datos."
          : "No se pudieron guardar los errores",
      );
    } finally {
      setGuardandoErrores((prev) => ({ ...prev, [id]: false }));
    }
  };

  const cambiarTipoEntrega = async (entregaId, nuevoTipo) => {
    const entregaActual = entregas.find((entrega) => entrega.id === entregaId);
    const tipoAnterior = entregaActual?.tipoEntrega || "Entrega";

    if (nuevoTipo === tipoAnterior) return;

    setEntregas((prev) =>
      prev.map((entrega) =>
        entrega.id === entregaId
          ? { ...entrega, tipoEntrega: nuevoTipo }
          : entrega,
      ),
    );
    setGuardandoTipoEntrega((prev) => ({ ...prev, [entregaId]: true }));

    try {
      const response = await api.patch(`/entregas/${entregaId}/tipo-entrega`, {
        tipoEntrega: nuevoTipo,
        expectedVersion: entregaActual?.version,
        idempotencyKey: nuevaClaveOperacion(),
      });

      setEntregas((prev) =>
        prev.map((entrega) =>
          entrega.id === entregaId
            ? { ...entrega, version: response.data.version }
            : entrega,
        ),
      );

      await Swal.fire({
        icon: "success",
        title:
          nuevoTipo === "Envio" ? "Cambiado a envío" : "Cambiado a entrega",
        toast: true,
        position: "top-end",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(err);
      setEntregas((prev) =>
        prev.map((entrega) =>
          entrega.id === entregaId
            ? { ...entrega, tipoEntrega: tipoAnterior }
            : entrega,
        ),
      );

      await Swal.fire({
        icon: "error",
        title: "No se pudo cambiar el tipo",
        text:
          err.response?.data?.message ||
          "Ocurrió un error al actualizar la entrega.",
      });
      if (err.response?.status === 409) await fetchEntregas();
    } finally {
      setGuardandoTipoEntrega((prev) => ({ ...prev, [entregaId]: false }));
    }
  };

  const renderTipoEntrega = (entrega) => {
    const guardando = Boolean(guardandoTipoEntrega[entrega.id]);
    const estadoAsignacion =
      entrega.repartidores?.[0]?.UsuarioAgenciaEntrega?.estado;

    return (
      <div className="min-w-32 space-y-1">
        <select
          value={entrega.tipoEntrega || "Entrega"}
          onChange={(event) =>
            cambiarTipoEntrega(entrega.id, event.target.value)
          }
          disabled={guardando}
          aria-label={`Forma de entrega ${entrega.id}`}
          className="w-full rounded-lg border border-green-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 disabled:cursor-wait disabled:opacity-60"
        >
          <option value="Entrega">Entrega</option>
          <option value="Envio">Envío</option>
        </select>

        <span className="block text-xs text-gray-400">
          {guardando ? "Guardando..." : estadoAsignacion || "Sin asignación"}
        </span>
      </div>
    );
  };

  const abrirReasignacion = (entrega) => {
    setEntregaReasignacion(entrega);
    setNuevoRepartidorId("");
  };

  const cerrarReasignacion = () => {
    if (reasignando) return;
    setEntregaReasignacion(null);
    setNuevoRepartidorId("");
  };

  const repartidorActualId =
    entregaReasignacion?.repartidores?.find(
      (repartidor) =>
        repartidor.UsuarioAgenciaEntrega?.activo !== false,
    )?.id ?? entregaReasignacion?.repartidores?.[0]?.id;

  const repartidoresDisponibles = useMemo(
    () =>
      repartidores.filter(
        (repartidor) => String(repartidor.id) !== String(repartidorActualId),
      ),
    [repartidorActualId, repartidores],
  );

  const confirmarReasignacion = async () => {
    if (!entregaReasignacion || !nuevoRepartidorId) return;

    const nuevoRepartidor = repartidores.find(
      (repartidor) => String(repartidor.id) === String(nuevoRepartidorId),
    );
    const nombreNuevo = nuevoRepartidor?.usuario?.nombre || "el repartidor seleccionado";

    const confirmacion = await Swal.fire({
      icon: "warning",
      title: "Cambiar responsable",
      text: `La entrega #${entregaReasignacion.id} pasará de ${entregaReasignacion.motorizado || "su repartidor actual"} a ${nombreNuevo}.`,
      input: "textarea",
      inputLabel: "Motivo obligatorio",
      inputValidator: (value) =>
        !value?.trim() ? "Ingresa el motivo" : undefined,
      showCancelButton: true,
      confirmButtonText: "Confirmar cambio",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setReasignando(true);

      await api.post(
        `/entregas/${entregaReasignacion.id}/asignar-repartidor`,
        {
          usuarioAgenciaId: Number(nuevoRepartidorId),
          forzarReasignacion: true,
          expectedVersion: entregaReasignacion.version,
          motivo: confirmacion.value.trim(),
          idempotencyKey: nuevaClaveOperacion(),
        },
      );

      await fetchEntregas();
      setEntregaReasignacion(null);
      setNuevoRepartidorId("");

      await Swal.fire({
        icon: "success",
        title: "Responsable actualizado",
        text: `Ahora está asignada a ${nombreNuevo}.`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "No se pudo cambiar el responsable",
        text:
          err.response?.data?.message ||
          "Ocurrió un error al cambiar el repartidor.",
      });
      if (err.response?.status === 409) await fetchEntregas();
    } finally {
      setReasignando(false);
    }
  };

  const cambiarEstado = async (entrega) => {
    const opciones = {
      Pendiente: ["Transito", "Revisar", "No Entregado"],
      Revisar: ["Pendiente", "Transito"],
      Transito: ["Entregado", "No Entregado", "Revisar"],
    }[entrega.estado] || [];
    if (!opciones.length) return;

    const estadoResultado = await Swal.fire({
      title: `Actualizar estado de #${entrega.id}`,
      input: "select",
      inputOptions: Object.fromEntries(opciones.map((valor) => [valor, valor])),
      inputPlaceholder: "Selecciona el nuevo estado",
      showCancelButton: true,
      inputValidator: (value) =>
        !value ? "Selecciona un estado" : undefined,
    });
    if (!estadoResultado.isConfirmed) return;

    const motivoResultado = await Swal.fire({
      title: "Motivo del cambio",
      input: "textarea",
      showCancelButton: true,
      inputValidator: (value) =>
        !value?.trim() ? "Ingresa el motivo" : undefined,
    });
    if (!motivoResultado.isConfirmed) return;

    try {
      await api.patch(`/entregas/${entrega.id}/estado`, {
        estado: estadoResultado.value,
        expectedVersion: entrega.version,
        motivo: motivoResultado.value.trim(),
        idempotencyKey: nuevaClaveOperacion(),
      });
      await fetchEntregas();
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo cambiar el estado",
        text: err.response?.data?.message || "Ocurrió un error.",
      });
      if (err.response?.status === 409) await fetchEntregas();
    }
  };

  const renderAcciones = (entrega) => {
    const editable = !["Entregado", "No Entregado"].includes(entrega.estado);
    return editable ? (
      <div className="flex min-w-40 flex-col gap-2">
        <button type="button" onClick={() => cambiarEstado(entrega)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
          Actualizar estado
        </button>
        <button type="button" onClick={() => abrirReasignacion(entrega)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
          Cambiar responsable
        </button>
      </div>
    ) : (
      <span className="text-gray-400">—</span>
    );
  };

  const renderErroresGuardados = (errores) => {
    if (!Array.isArray(errores) || errores.length === 0) {
      return <span className="text-gray-400">Ninguno</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {errores.map((err, idx) => (
          <span
            key={idx}
            className="inline-block bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full"
          >
            {err}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          Informe de Entregas
        </h2>
        <p className="text-sm text-gray-500">
          Consulta y seguimiento de entregas asignadas
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-700">Buscar</label>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="ID, cliente, cédula o vendedor"
            className="w-full mt-1 rounded-xl border-gray-300"
          />
          <p className="mt-1 text-xs text-gray-400">
            {entregasFiltradas.length} resultado(s)
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Repartidor
          </label>
          <select
            value={repartidorSeleccionado}
            onChange={(e) => setRepartidorSeleccionado(e.target.value)}
            disabled={loadingRepartidores}
            className="w-full mt-1 rounded-xl border-gray-300"
          >
            <option value="">
              {loadingRepartidores ? "Cargando..." : "Todos"}
            </option>
            {repartidores.map((r) => (
              <option key={r.id} value={r.id}>
                {r.usuario.nombre} — {r.agencia.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Fecha inicio
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Fecha fin</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          >
            <option value="">Todos</option>
            <option value="Entregado">Entregado</option>
            <option value="Pendiente">Pendiente</option>
            <option value="No Entregado">No Entregado</option>
            <option value="Transito">En tránsito</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Tipo / proceso
          </label>
          <select
            value={clasificacion}
            onChange={(e) => setClasificacion(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          >
            <option value="">Todos</option>
            <option value="Envio">Envío</option>
            <option value="Entrega">Entrega</option>
            <option value="ProcesoCompleto">Proceso completo</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center text-gray-500 mb-4">Cargando entregas…</div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4">
          {error}
        </div>
      )}

      {!loading && !error && entregas.length === 0 && (
        <div className="text-center text-gray-500 mb-4">
          No hay entregas registradas
        </div>
      )}

      {!loading &&
        !error &&
        entregas.length > 0 &&
        entregasFiltradas.length === 0 && (
          <div className="text-center text-gray-500 mb-4">
            No se encontraron entregas con la búsqueda ingresada
          </div>
        )}

      <div className="bg-white rounded-2xl shadow-md border overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Detalle</th>
              <th className="px-4 py-3">Obsequios</th>
              <th className="px-4 py-3">Vended@r</th>
              <th className="px-4 py-3">Agencia</th>
              <th className="px-4 py-3">Sector</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Forma de Pago</th>
              <th className="px-4 py-3">Forma de Entrega</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Alcance</th>
              <th className="px-4 py-3">Motorizado</th>
              <th className="px-4 py-3">Errores</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {!loading &&
              !error &&
              entregasFiltradas.flatMap((entrega, j) =>
                entrega.detalleEntregas?.length > 0
                  ? entrega.detalleEntregas.map((d, index) => (
                      <tr
                        key={`${entrega.id}-${index}`}
                        className="hover:bg-gray-50 align-top"
                      >
                        <td className="px-4 py-2">{j + 1}</td>

                        <td className="px-4 py-2">{entrega.id}</td>
                        <td className="px-4 py-2">{entrega.fecha ?? "—"}</td>

                        <td className="px-4 py-2">
                          {entrega.cliente?.cliente ?? "—"}
                        </td>

                        <td className="px-4 py-2">
                          {d.dispositivoMarca?.dispositivo?.nombre ?? "—"}
                        </td>

                        <td className="px-4 py-2">{d.modelo?.nombre ?? "—"}</td>

                        <td className="px-4 py-2">
                          {entrega.obsequiosEntrega?.length > 0
                            ? entrega.obsequiosEntrega
                                .map(
                                  (o) =>
                                    `${o.obsequio?.nombre} (${o.cantidad})`,
                                )
                                .join(", ")
                            : "—"}
                        </td>

                        <td className="px-4 py-2">{entrega.vendedor ?? "—"}</td>

                        <td className="px-4 py-2">
                          {entrega.agenciaVendedor ?? "—"}
                        </td>

                        <td className="px-4 py-2">
                          {entrega.sectorEntrega ?? "—"}
                        </td>

                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              entrega.estado === "Entregado"
                                ? "bg-green-100 text-green-700"
                                : entrega.estado === "Transito"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {entrega.estado}
                          </span>
                        </td>

                        <td className="px-4 py-2">
                          {d.formaPago?.nombre ?? "—"}
                        </td>

                        {index === 0 && (
                          <td
                            className="px-4 py-2"
                            rowSpan={entrega.detalleEntregas.length}
                          >
                            {renderTipoEntrega(entrega)}
                          </td>
                        )}

                        <td className="px-4 py-2">${d.entrada ?? "0.00"}</td>

                        <td className="px-4 py-2">${d.alcance ?? "0.00"}</td>

                        <td className="px-4 py-2">
                          {entrega.motorizado ?? "—"}
                          {entrega.advertenciaResponsable && (
                            <span className="mt-1 block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                              {entrega.advertenciaResponsable}
                            </span>
                          )}
                        </td>

                        {/* NUEVA COLUMNA ERRORES */}
                        <td className="px-4 py-2 min-w-[320px]">
                          <div className="space-y-2">
                            {renderErroresGuardados(entrega.errores)}

                            <button
                              type="button"
                              onClick={() =>
                                setFilaAbierta(
                                  filaAbierta === entrega.id
                                    ? null
                                    : entrega.id,
                                )
                              }
                              className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                              {filaAbierta === entrega.id
                                ? "Cerrar"
                                : "Agregar error"}
                            </button>

                            {filaAbierta === entrega.id && (
                              <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={
                                      (erroresTemp[entrega.id] || []).length ===
                                      0
                                    }
                                    onChange={() =>
                                      seleccionarNinguno(entrega.id)
                                    }
                                  />
                                  Ninguno
                                </label>

                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                  {OPCIONES_ERRORES.map((opcion) => (
                                    <label
                                      key={opcion}
                                      className="flex items-start gap-2 text-sm text-gray-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={(
                                          erroresTemp[entrega.id] || []
                                        ).includes(opcion)}
                                        onChange={() =>
                                          toggleError(entrega.id, opcion)
                                        }
                                      />
                                      <span>{opcion}</span>
                                    </label>
                                  ))}
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => guardarErrores(entrega.id)}
                                    disabled={guardandoErrores[entrega.id]}
                                    className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {guardandoErrores[entrega.id]
                                      ? "Guardando..."
                                      : "Guardar"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setErroresTemp((prev) => ({
                                        ...prev,
                                        [entrega.id]: Array.isArray(
                                          entrega.errores,
                                        )
                                          ? entrega.errores
                                          : [],
                                      }));
                                      setFilaAbierta(null);
                                    }}
                                    className="px-3 py-1.5 text-xs rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          {index === 0
                            ? renderAcciones(entrega)
                            : null}
                        </td>
                      </tr>
                    ))
                  : [
                      <tr key={entrega.id}>
                        <td
                          colSpan="12"
                          className="text-center py-4 text-gray-400"
                        >
                          Entrega sin productos
                        </td>
                        <td className="px-4 py-2">
                          {renderTipoEntrega(entrega)}
                        </td>
                        <td colSpan="4" className="px-4 py-2 text-gray-400">
                          —
                        </td>
                        <td className="px-4 py-2">
                          {renderAcciones(entrega)}
                        </td>
                      </tr>,
                    ],
              )}
          </tbody>
        </table>
      </div>

      {entregaReasignacion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-reasignacion"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3
              id="titulo-reasignacion"
              className="text-lg font-bold text-gray-800"
            >
              Cambiar responsable de entrega #{entregaReasignacion.id}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Repartidor actual: {entregaReasignacion.motorizado || "Sin información"}
            </p>

            <label className="mt-5 block text-sm font-medium text-gray-700">
              Nuevo repartidor
              <select
                value={nuevoRepartidorId}
                onChange={(event) => setNuevoRepartidorId(event.target.value)}
                disabled={reasignando}
                className="mt-1 w-full rounded-xl border-gray-300"
              >
                <option value="">-- Seleccione un repartidor --</option>
                {repartidoresDisponibles.map((repartidor) => (
                  <option key={repartidor.id} value={repartidor.id}>
                    {repartidor.usuario?.nombre || "Sin nombre"} — {repartidor.agencia?.nombre || "Sin agencia"}
                  </option>
                ))}
              </select>
            </label>

            {repartidoresDisponibles.length === 0 && (
              <p className="mt-2 text-sm text-amber-700">
                No hay otro repartidor activo disponible.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarReasignacion}
                disabled={reasignando}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReasignacion}
                disabled={!nuevoRepartidorId || reasignando}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reasignando ? "Actualizando..." : "Cambiar responsable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
