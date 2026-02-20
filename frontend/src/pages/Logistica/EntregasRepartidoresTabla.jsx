import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_URL } from "../../../config";

export default function EntregasRepartidoresTabla() {
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

  useEffect(() => {
    fetchEntregas();
  }, [repartidorSeleccionado, fechaInicio, fechaFin, estado]);

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
    <div className="mx-auto p-6">

            <div>
        <h2 className="text-2xl font-bold text-gray-800">Informe de Entregas</h2>
        <p className="text-sm text-gray-500">
          Consulta y seguimiento de entregas asignadas
        </p>
      </div>

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
            </tr>
          </thead>
          <tbody className="divide-y">
            {!loading &&
              !error &&
              entregas.flatMap((entrega , j ) =>
                entrega.detalleEntregas?.length > 0
                  ? entrega.detalleEntregas.map((d, index) => (
                      <tr
                        key={`${entrega.id}-${index}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-2">{j + 1}</td>


           <td className="px-4 py-2">
                          {entrega.id}
                        </td>

                        {/* FECHA */}
                        <td className="px-4 py-2">
                          {entrega.fecha
                            ? new Date(entrega.fecha).toLocaleDateString()
                            : "—"}
                        </td>

                        {/* CLIENTE */}
                        <td className="px-4 py-2">
                          {entrega.cliente?.cliente ?? "—"}
                        </td>

                        <td className="px-4 py-2">
                          {d.dispositivoMarca?.dispositivo?.nombre ?? "—"}
                        </td>

                        {/* PRODUCTO */}
                        <td className="px-4 py-2">{d.modelo?.nombre ?? "—"}</td>

                        {/* OBSEQUIOS */}
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

                        {/* VENDEDOR ✅ */}
                        <td className="px-4 py-2">{entrega.vendedor ?? "—"}</td>

                        {/* AGENCIA (DEL VENDEDOR) ✅ */}
                        <td className="px-4 py-2">
                          {entrega.agenciaVendedor ?? "—"}
                        </td>

                        {/* SECTOR */}
                        <td className="px-4 py-2">
                          {entrega.sectorEntrega ?? "—"}
                        </td>

                        {/* ESTADO */}
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold
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
                        </td>

                        {/* FORMA DE PAGO */}
                        <td className="px-4 py-2">
                          {d.formaPago?.nombre ?? "—"}
                        </td>

                        {/* FORMA DE ENTREGA */}
                        <td className="px-4 py-2">
                          {entrega.UsuarioAgenciaEntrega?.estado ?? "—"}
                        </td>

                        {/* ENTRADA */}
                        <td className="px-4 py-2">${d.entrada ?? "0.00"}</td>

                        <td className="px-4 py-2">${d.alcance ?? "0.00"}</td>

                        {/* MOTORIZADO ✅ */}
                        <td className="px-4 py-2">
                          {entrega.motorizado ?? "—"}
                        </td>
                      </tr>
                    ))
                  : [
                      <tr key={entrega.id}>
                        <td
                          colSpan="13"
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
