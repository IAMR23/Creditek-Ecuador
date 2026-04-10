import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { getHoyLocal } from "../../utils/dateUtils";

const formatearMoneda = (valor) => {
  return `$${Number(valor || 0).toFixed(2)}`;
};

const formatearFecha = (fecha) => {
  if (!fecha) return "";
  const f = new Date(fecha);
  return f.toLocaleDateString("es-EC");
};

export default function CierresCajaTabla() {
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);

  const [fechaInicio, setFechaInicio] = useState(getHoyLocal());

  const [fechaFin, setFechaFin] = useState(getHoyLocal());

  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState("");

  const obtenerCierres = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const response = await axios.get(
        `${API_URL}/api/contabilidad/cierres-caja`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setCierres(response.data?.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Error al obtener los cierres de caja",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerCierres();
  }, []);

  const toggleExpand = (id) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-4">
      <div className="bg-white shadow rounded border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold">Cierres de Caja</h2>
          <div className="flex gap-4 mb-4 items-end flex-wrap">
            <div>
              <label className="block text-sm font-medium">Fecha Inicio</label>
              <input
                type="date"
                className="border px-2 py-1 rounded"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Fecha Fin</label>
              <input
                type="date"
                className="border px-2 py-1 rounded"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Agencia</label>
              <select
                className="border px-2 py-1 rounded"
                value={agenciaId}
                onChange={(e) => setAgenciaId(e.target.value)}
              >
                <option value="">Todas</option>
                {agencias.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={obtenerCierres}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Recargar
          </button>
        </div>

        {loading && (
          <div className="p-4 text-gray-600">Cargando cierres de caja...</div>
        )}

        {error && <div className="p-4 text-red-600 font-medium">{error}</div>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">ID</th>
                  <th className="border px-3 py-2 text-left">Fecha</th>
                  <th className="border px-3 py-2 text-left">Usuario</th>
                  <th className="border px-3 py-2 text-left">Agencia</th>
                  <th className="border px-3 py-2 text-left">Físico</th>
                  <th className="border px-3 py-2 text-left">Efectivo</th>
                  <th className="border px-3 py-2 text-left">Transferencia</th>
                  <th className="border px-3 py-2 text-left">Pendiente</th>
                  <th className="border px-3 py-2 text-left">Sistema</th>
                  <th className="border px-3 py-2 text-left">Diferencia</th>
                  <th className="border px-3 py-2 text-left">Estado</th>
                  <th className="border px-3 py-2 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {cierres.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center py-6 text-gray-500">
                      No existen cierres de caja
                    </td>
                  </tr>
                ) : (
                  cierres.map((item) => {
                    const cierre = item.cierre;
                    const isExpanded = expandedRow === cierre.id;

                    return (
                      <React.Fragment key={cierre.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="border px-3 py-2">{cierre.id}</td>
                          <td className="border px-3 py-2">
                            {formatearFecha(cierre.fecha)}
                          </td>

                          <td className="border px-3 py-2">
                            {cierre.usuarioAgencia?.usuario?.nombre}
                          </td>
                          <td className="border px-3 py-2">
                            {cierre.usuarioAgencia?.agencia?.nombre}
                          </td>
                          <td className="border px-3 py-2">
                            {formatearMoneda(cierre.totalFisico)}
                          </td>
                          <td className="border px-3 py-2">
                            {formatearMoneda(cierre.totalEfectivo)}
                          </td>
                          <td className="border px-3 py-2">
                            {formatearMoneda(cierre.totalTransferencia)}
                          </td>
                          <td className="border px-3 py-2">
                            {formatearMoneda(cierre.totalPendiente)}
                          </td>
                          <td className="border px-3 py-2">
                            {formatearMoneda(cierre.totalSistema)}
                          </td>
                          <td
                            className={`border px-3 py-2 font-semibold ${
                              Number(cierre.diferencia) === 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatearMoneda(cierre.diferencia)}
                          </td>
                          <td className="border px-3 py-2">
                            <span
                              className={`px-2 py-1 rounded text-white text-sm ${
                                cierre.estado === "CUADRADO"
                                  ? "bg-green-600"
                                  : "bg-red-600"
                              }`}
                            >
                              {cierre.estado}
                            </span>
                          </td>
                          <td className="border px-3 py-2 text-center">
                            <button
                              onClick={() => toggleExpand(cierre.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded"
                            >
                              {isExpanded ? "Ocultar" : "Ver"}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td
                              colSpan="11"
                              className="border px-4 py-4 bg-gray-50"
                            >
                              <DetalleCierre item={item} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function DetalleCierre({ item }) {
  const { cierre, resumenPorTipo, denominaciones, movimientos, retiros } = item;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-2">Resumen General</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card
            label="Agencia"
            value={cierre.usuarioAgencia?.agencia?.nombre}
          />
          <Card
            label="Usuario"
            value={cierre.usuarioAgencia?.usuario?.nombre}
          />
          <Card
            label="Total Transferencia"
            value={formatearMoneda(cierre.totalTransferencia)}
          />
          <Card
            label="Total Pendiente"
            value={formatearMoneda(cierre.totalPendiente)}
          />
          <Card
            label="Total Sistema"
            value={formatearMoneda(cierre.totalSistema)}
          />
          <Card label="Diferencia" value={formatearMoneda(cierre.diferencia)} />
          <Card label="Estado" value={cierre.estado} />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-2">Resumen por Tipo</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card
            label="Cuota Efectivo"
            value={formatearMoneda(resumenPorTipo.cuotaEfectivo)}
          />
          <Card
            label="Cuota Transferencia"
            value={formatearMoneda(resumenPorTipo.cuotaTransferencia)}
          />
          <Card
            label="Contado Efectivo"
            value={formatearMoneda(resumenPorTipo.contadoEfectivo)}
          />
          <Card
            label="Contado Transferencia"
            value={formatearMoneda(resumenPorTipo.contadoTransferencia)}
          />
          <Card
            label="Entrada Efectivo"
            value={formatearMoneda(resumenPorTipo.entradaEfectivo)}
          />
          <Card
            label="Entrada Transferencia"
            value={formatearMoneda(resumenPorTipo.entradaTransferencia)}
          />
          <Card
            label="Entrada Pendiente"
            value={formatearMoneda(resumenPorTipo.entradaPendiente)}
          />
          <Card
            label="Alcance Efectivo"
            value={formatearMoneda(resumenPorTipo.alcanceEfectivo)}
          />
          <Card
            label="Alcance Transferencia"
            value={formatearMoneda(resumenPorTipo.alcanceTransferencia)}
          />
        </div>
      </div>

      <div className="">
        <h3 className="text-lg font-bold mb-2">Denominaciones</h3>
        <TablaDenominaciones denominaciones={denominaciones} />
      </div>

      <div>
        <h3 className="text-lg font-bold mb-2">Movimientos</h3>
        <TablaMovimientos movimientos={movimientos} />
      </div>

      <div>
        <h3 className="text-lg font-bold mb-2">Retiros</h3>
        <TablaRetiros retiros={retiros} />
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="bg-white border rounded p-3 shadow-xl">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="font-semibold text-base mt-1 break-words">{value}</div>
    </div>
  );
}

function TablaDenominaciones({ denominaciones }) {
  return (
    <div className="overflow-x-auto bg-white border rounded">
      <table className="w-full border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Denominación</th>
            <th className="border px-3 py-2 text-left">Cantidad</th>
            <th className="border px-3 py-2 text-left">Total</th>
          </tr>
        </thead>
        <tbody>
          {denominaciones?.length ? (
            denominaciones.map((d) => (
              <tr key={d.id}>
                <td className="border px-3 py-2">{formatearMoneda(d.valor)}</td>
                <td className="border px-3 py-2">{d.cantidad}</td>
                <td className="border px-3 py-2">
                  {formatearMoneda(Number(d.valor) * Number(d.cantidad))}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan="3"
                className="border px-3 py-4 text-center text-gray-500"
              >
                Sin denominaciones
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TablaMovimientos({ movimientos }) {
  return (
    <div className="overflow-x-auto bg-white border rounded">
      <table className="w-full border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">#</th>
            <th className="border px-3 py-2 text-left">Responsable</th>
            <th className="border px-3 py-2 text-left">Detalle</th>
            <th className="border px-3 py-2 text-left">Entidad</th>
            <th className="border px-3 py-2 text-left">Valor</th>
            <th className="border px-3 py-2 text-left">Forma Pago</th>
            <th className="border px-3 py-2 text-left">Recibo</th>
            <th className="border px-3 py-2 text-left">Observación</th>
          </tr>
        </thead>
        <tbody>
          {movimientos?.length ? (
            movimientos.map((m, index) => (
              <tr key={m.id}>
                <td className="border px-3 py-2">{index + 1}</td>
                <td className="border px-3 py-2">{m.responsable || "-"}</td>
                <td className="border px-3 py-2">{m.detalle || "-"}</td>
                <td className="border px-3 py-2">{m.entidad || "-"}</td>
                <td className="border px-3 py-2">{formatearMoneda(m.valor)}</td>
                <td className="border px-3 py-2">{m.formaPago || "-"}</td>
                <td className="border px-3 py-2">{m.recibo || "-"}</td>
                <td className="border px-3 py-2">{m.observacion || "-"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan="8"
                className="border px-3 py-4 text-center text-gray-500"
              >
                Sin movimientos
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TablaRetiros({ retiros }) {
  return (
    <div className="overflow-x-auto bg-white border rounded">
      <table className="w-full border-collapse">
        <thead className="bg-red-100">
          <tr>
            <th className="border px-3 py-2 text-left">#</th>
            <th className="border px-3 py-2 text-left">Monto</th>
            <th className="border px-3 py-2 text-left">Motivo</th>
            <th className="border px-3 py-2 text-left">Autorizado por</th>
          </tr>
        </thead>
        <tbody>
          {retiros?.length ? (
            retiros.map((r, index) => (
              <tr key={r.id}>
                <td className="border px-3 py-2">{index + 1}</td>
                <td className="border px-3 py-2">{formatearMoneda(r.monto)}</td>
                <td className="border px-3 py-2">{r.motivo || "-"}</td>
                <td className="border px-3 py-2">{r.autorizadoPor || "-"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan="4"
                className="border px-3 py-4 text-center text-gray-500"
              >
                Sin retiros
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
