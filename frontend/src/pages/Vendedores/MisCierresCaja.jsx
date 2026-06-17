import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import { getHoyLocal } from "../../utils/dateUtils";

const formatearMoneda = (value) => `$${Number(value || 0).toFixed(2)}`;

const formatearFecha = (fecha) => {
  if (!fecha) return "";
  const partes = String(fecha).slice(0, 10).split("-");
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const primerDiaMes = () => {
  const hoy = getHoyLocal();
  return `${hoy.slice(0, 8)}01`;
};

const nombreUsuario = (item) =>
  item?.cierre?.usuarioAgencia?.usuario?.nombre || "Usuario";

const nombreAgencia = (item) =>
  item?.cierre?.usuarioAgencia?.agencia?.nombre || "Agencia";

export default function MisCierresCaja() {
  const [cierres, setCierres] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(getHoyLocal());
  const [estadoCierre, setEstadoCierre] = useState("");

  const selectedItem = useMemo(() => {
    if (!cierres.length) return null;
    return (
      cierres.find((item) => String(item.cierre.id) === String(selectedId)) ||
      cierres[0]
    );
  }, [cierres, selectedId]);

  const cargarCierres = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        await Swal.fire("Sesion expirada", "Vuelve a iniciar sesion.", "warning");
        return;
      }

      setLoading(true);
      const { data } = await axios.get(
        `${API_URL}/api/contabilidad/mis-cierres-caja`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            ...(fechaInicio && { fechaInicio }),
            ...(fechaFin && { fechaFin }),
            ...(estadoCierre && { estadoCierre }),
          },
        },
      );

      const items = data?.data || [];
      setCierres(items);
      setSelectedId(items[0]?.cierre?.id || null);
    } catch (error) {
      console.error(error?.response?.data || error);
      Swal.fire(
        "Error",
        error?.response?.data?.message || "No se pudieron cargar tus cierres",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCierres();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Mis cierres de caja
            </h1>
            <p className="text-sm text-gray-500">
              Consulta tus cierres registrados en modo solo lectura.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm text-gray-700">
              Inicio
              <input
                type="date"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
                className="mt-1 block rounded border border-gray-300 px-2 py-1"
              />
            </label>

            <label className="text-sm text-gray-700">
              Fin
              <input
                type="date"
                value={fechaFin}
                onChange={(event) => setFechaFin(event.target.value)}
                className="mt-1 block rounded border border-gray-300 px-2 py-1"
              />
            </label>

            <label className="text-sm text-gray-700">
              Estado
              <select
                value={estadoCierre}
                onChange={(event) => setEstadoCierre(event.target.value)}
                className="mt-1 block rounded border border-gray-300 px-2 py-1"
              >
                <option value="">Todos</option>
                <option value="CERRADO">Cerrado</option>
                <option value="REABIERTO">Reabierto</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </label>

            <button
              type="button"
              onClick={cargarCierres}
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
            >
              {loading ? "Cargando..." : "Buscar"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="overflow-hidden rounded border border-gray-200 bg-white">
            <div className="border-b bg-gray-100 px-3 py-2 text-sm font-semibold">
              Cierres encontrados: {cierres.length}
            </div>

            {cierres.length === 0 && !loading && (
              <div className="p-4 text-sm text-gray-500">
                No existen cierres de caja para los filtros seleccionados.
              </div>
            )}

            <div className="max-h-[70vh] overflow-auto">
              {cierres.map((item) => {
                const cierre = item.cierre;
                const activo = String(selectedItem?.cierre?.id) === String(cierre.id);

                return (
                  <button
                    type="button"
                    key={cierre.id}
                    onClick={() => setSelectedId(cierre.id)}
                    className={`block w-full border-b px-3 py-3 text-left text-sm ${
                      activo ? "bg-blue-50" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-900">
                        {formatearFecha(cierre.fecha)}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          cierre.estado === "CUADRADO"
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {cierre.estado}
                      </span>
                    </div>
                    <div className="mt-1 text-gray-500">{nombreAgencia(item)}</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <span>Sistema: {formatearMoneda(cierre.totalSistema)}</span>
                      <span>Fisico: {formatearMoneda(cierre.totalFisico)}</span>
                    </div>
                    {cierre.observacionContabilidad && (
                      <div className="mt-2 line-clamp-2 text-xs text-gray-600">
                        Contabilidad: {cierre.observacionContabilidad}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-gray-200 bg-white p-4">
            {!selectedItem ? (
              <div className="text-sm text-gray-500">
                Selecciona un cierre para ver el detalle.
              </div>
            ) : (
              <DetalleCierre item={selectedItem} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetalleCierre({ item }) {
  const cierre = item.cierre;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Cierre del {formatearFecha(cierre.fecha)}
          </h2>
          <p className="text-sm text-gray-500">
            {nombreUsuario(item)} - {nombreAgencia(item)}
          </p>
        </div>
        <div className="text-sm font-semibold text-gray-700">
          {cierre.estadoCierre}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Resumen label="Efectivo" value={cierre.totalEfectivo} />
        <Resumen label="Transferencia" value={cierre.totalTransferencia} />
        <Resumen label="Pendiente" value={cierre.totalPendiente} />
        <Resumen label="Sistema" value={cierre.totalSistema} />
        <Resumen label="Fisico" value={cierre.totalFisico} />
        <Resumen label="Diferencia" value={cierre.diferencia} />
      </div>

      <section className="rounded border border-gray-200 bg-gray-50 p-3">
        <h3 className="text-sm font-semibold text-gray-800">
          Observacion contabilidad
        </h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
          {cierre.observacionContabilidad || "Sin observacion contable."}
        </p>
      </section>

      <TablaDenominaciones denominaciones={item.denominaciones || []} />
      <TablaRetiros retiros={item.retiros || []} />
      <TablaMovimientos movimientos={item.movimientos || []} />
    </div>
  );
}

function Resumen({ label, value }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 font-bold text-gray-900">{formatearMoneda(value)}</div>
    </div>
  );
}

function TablaDenominaciones({ denominaciones }) {
  return (
    <Tabla titulo="Denominaciones">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2 text-left">Denominacion</th>
          <th className="p-2 text-left">Cantidad</th>
          <th className="p-2 text-left">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {denominaciones.map((d) => (
          <tr key={d.id || d.valor} className="border-t">
            <td className="p-2">{formatearMoneda(d.valor)}</td>
            <td className="p-2">{Number(d.cantidad).toFixed(2)}</td>
            <td className="p-2">
              {formatearMoneda(Number(d.valor) * Number(d.cantidad))}
            </td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function TablaRetiros({ retiros }) {
  return (
    <Tabla titulo="Retiros">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2 text-left">Monto</th>
          <th className="p-2 text-left">Motivo</th>
          <th className="p-2 text-left">Autorizado por</th>
        </tr>
      </thead>
      <tbody>
        {retiros.length === 0 ? (
          <tr>
            <td className="p-2 text-gray-500" colSpan="3">
              Sin retiros registrados.
            </td>
          </tr>
        ) : (
          retiros.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{formatearMoneda(r.monto)}</td>
              <td className="p-2">{r.motivo}</td>
              <td className="p-2">{r.autorizadoPor}</td>
            </tr>
          ))
        )}
      </tbody>
    </Tabla>
  );
}

function TablaMovimientos({ movimientos }) {
  return (
    <Tabla titulo="Movimientos">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2 text-left">Responsable</th>
          <th className="p-2 text-left">Detalle</th>
          <th className="p-2 text-left">Valor</th>
          <th className="p-2 text-left">Forma pago</th>
          <th className="p-2 text-left">Recibo</th>
          <th className="p-2 text-left">Observacion</th>
        </tr>
      </thead>
      <tbody>
        {movimientos.map((m) => (
          <tr key={m.id} className="border-t">
            <td className="p-2">{m.responsable}</td>
            <td className="p-2">{m.detalle}</td>
            <td className="p-2">{formatearMoneda(m.valor)}</td>
            <td className="p-2">{m.formaPago}</td>
            <td className="p-2">{m.recibo}</td>
            <td className="p-2">{m.observacion}</td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}

function Tabla({ titulo, children }) {
  return (
    <section>
      <h3 className="mb-2 font-bold text-gray-800">{titulo}</h3>
      <div className="overflow-auto rounded border border-gray-200">
        <table className="w-full min-w-[640px] text-sm">{children}</table>
      </div>
    </section>
  );
}
