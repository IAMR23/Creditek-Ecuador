import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
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

  // control UI errores
  const [filaAbierta, setFilaAbierta] = useState(null);
  const [erroresTemp, setErroresTemp] = useState({});
  const [guardandoErrores, setGuardandoErrores] = useState({});

  useEffect(() => {
    const fetchRepartidores = async () => {
      try {
        setLoadingRepartidores(true);

        const response = await axios.get(
          `${API_URL}/api/usuario-agencia-permisos/usuarios-repartidores`,
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

      const response = await axios.get(`${API_URL}/entregas/entregas`, {
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
  }, [repartidorSeleccionado, fechaInicio, fechaFin, estado]);

  useEffect(() => {
    fetchEntregas();
  }, [fetchEntregas]);

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

      await axios.put(`${API_URL}/entregas/${id}`, {
        errores,
      });

      setEntregas((prev) =>
        prev.map((entrega) =>
          entrega.id === id ? { ...entrega, errores } : entrega,
        ),
      );

      setFilaAbierta(null);
    } catch (err) {
      console.error(err);
      alert("No se pudieron guardar los errores");
    } finally {
      setGuardandoErrores((prev) => ({ ...prev, [id]: false }));
    }
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

      <div className="bg-white p-4 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-700">
            Repartidor
          </label>
          <select
            value={repartidorSeleccionado}
            onChange={(e) => setRepartidorSeleccionado(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          >
            <option value="">Todos</option>
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
            </tr>
          </thead>

          <tbody className="divide-y">
            {!loading &&
              !error &&
              entregas.flatMap((entrega, j) =>
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

                        <td className="px-4 py-2">
                          {entrega.repartidores?.[0]?.UsuarioAgenciaEntrega
                            ?.estado ?? "—"}
                        </td>

                        <td className="px-4 py-2">${d.entrada ?? "0.00"}</td>

                        <td className="px-4 py-2">${d.alcance ?? "0.00"}</td>

                        <td className="px-4 py-2">
                          {entrega.motorizado ?? "—"}
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
                      </tr>
                    ))
                  : [
                      <tr key={entrega.id}>
                        <td
                          colSpan="17"
                          className="text-center py-4 text-gray-400"
                        >
                          Entrega sin productos
                        </td>
                      </tr>,
                    ],
              )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
