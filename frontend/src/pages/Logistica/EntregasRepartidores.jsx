import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import ResumenEntregas from "./ResumenEntregas";

export default function EntregasRepartidores() {
  const [repartidores, setRepartidores] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingRepartidores, setLoadingRepartidores] = useState(false);

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [estado, setEstado] = useState("");

  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFechaInicio(hoyLocal);
    setFechaFin(hoyLocal);
  }, []);

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

      // construir filtros dinámicos
      const params = {};

      if (repartidorSeleccionado) params.userId = repartidorSeleccionado;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;
      if (estado) params.estado = estado;

      const response = await axios.get(`${API_URL}/entregas/entregas`, {
        params,
      });

      setEntregas(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error(err);
      setError("Error al cargar entregas");
      setEntregas([]);
    } finally {
      setLoading(false);
    }
  }, [repartidorSeleccionado, fechaInicio, fechaFin, estado]);
  /* =========================
     Cargar todas al inicio
  ========================= */
  useEffect(() => {
    fetchEntregas();
  }, [fetchEntregas]);

  /* =========================
     Cambio de repartidor
  ========================= */
  const handleChange = (e) => {
    const id = e.target.value;
    setRepartidorSeleccionado(id);

    if (id) {
      fetchEntregas(id);
    } else {
      fetchEntregas();
    }
  };

  /* =========================
     Render
  ========================= */
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Estado de Entregas</h2>
        <p className="text-sm text-gray-500">
          Consulta y seguimiento de entregas asignadas
        </p>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* REPARTIDOR */}
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

        {/* FECHA INICIO */}
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

        {/* FECHA FIN */}
        <div>
          <label className="text-sm font-medium text-gray-700">Fecha fin</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          />
        </div>

        {/* ESTADO */}
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
            <option value="No entregado">No entregado</option>
            <option value="Transito">En tránsito</option>
          </select>
        </div>
      </div>

      {/* ESTADOS */}
      {loading && (
        <div className="text-center text-gray-500">Cargando entregas…</div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          {error}
        </div>
      )}

      {!loading && !error && entregas.length === 0 && (
        <div className="text-center text-gray-500">
          No hay entregas registradas
        </div>
      )}
      {/* LISTA ENTREGAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {!loading &&
          !error &&
          entregas.map((entrega) => (
            <div
              key={entrega.id}
              className="bg-white rounded-2xl shadow-md border hover:shadow-lg transition"
            >
              {/* HEADER CARD */}
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">
                    Entrega #{entrega.id}
                  </h4>
                  <p className="text-sm text-gray-500">
                    {entrega.fecha
                      ? new Date(entrega.fecha).toLocaleDateString()
                      : "—"}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 text-xs rounded-full font-semibold
                    ${
                      entrega.estado === "Entregado"
                        ? "bg-green-100 text-green-700"
                        : entrega.estado === "Transito"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                >
                  {entrega.estado}
                </span>
              </div>

              {/* BODY */}
              <div className="p-4 space-y-4">
                {/* CLIENTE */}
                <section>
                  <h5 className="text-sm font-semibold text-gray-700 mb-1">
                    Cliente
                  </h5>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{entrega.cliente?.cliente ?? "—"}</p>
                    <p>Cédula: {entrega.cliente?.cedula ?? "—"}</p>
                    <p>Tel: {entrega.cliente?.telefono ?? "—"}</p>
                    <p>{entrega.cliente?.direccion ?? "—"}</p>
                  </div>
                </section>

                {/* PRODUCTOS */}
                <section>
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">
                    Productos
                  </h5>

                  <div className="space-y-2">
                    {entrega.detalleEntregas?.length > 0 ? (
                      entrega.detalleEntregas.map((d) => (
                        <div
                          key={d.id}
                          className="border rounded-xl p-3 bg-gray-50"
                        >
                          <p className="text-sm font-medium text-gray-800">
                            {d.dispositivoMarca?.marca?.nombre ?? ""}
                            {d.modelo?.nombre ? ` – ${d.modelo.nombre}` : ""}
                          </p>

                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-1">
                            <p>Cantidad: {d.cantidad}</p>
                            <p>Precio: ${d.precioUnitario}</p>
                            <p>Vendedor: {d.precioVendedor ?? "—"}</p>
                            <p>Entrada: {d.entrada ?? "—"}</p>
                            <p>Alcance: {d.alcance ?? "—"}</p>
                            <p>Pago: {d.formaPago?.nombre}</p>
                          </div>

                          {d.contrato && (
                            <p className="mt-1 text-xs text-gray-500">
                              Contrato: {d.contrato}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">Sin productos</p>
                    )}
                  </div>
                </section>

                {/* FOOTER */}
                <section className="pt-2 border-t text-sm text-gray-600">
                  <p>
                    <strong>Origen:</strong> {entrega.origen?.nombre ?? "—"}
                  </p>
                  <p>
                    <strong>Observación:</strong> {entrega.observacion || "—"}
                  </p>
                  <p>
                    <strong>Validada:</strong> {entrega.validada ? "Sí" : "No"}
                  </p>
                  <p>
                    <strong>Observacion Logistica:</strong>{" "}
                    {entrega.observacionLogistica || "—"}
                  </p>
                </section>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
