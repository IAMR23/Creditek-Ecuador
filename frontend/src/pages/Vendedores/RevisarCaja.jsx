import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";

const filaVacia = {
  responsable: "",
  detalle: "",
  valor: "",
  formaPago: "",
  recibo: "",
  observacion: "",
};

const STORAGE_KEY = "filtros_caja";

export default function RevisarCaja() {
  const [rows, setRows] = useState([{ ...filaVacia }]);
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(false);
  const denominacionesBase = [
    { denominacion: 100, cantidad: 0, total: 0 },
    { denominacion: 50, cantidad: 0, total: 0 },
    { denominacion: 20, cantidad: 0, total: 0 },
    { denominacion: 10, cantidad: 0, total: 0 },
    { denominacion: 5, cantidad: 0, total: 0 },
    { denominacion: 1, cantidad: 0, total: 0 },
    { denominacion: 0.5, cantidad: 0, total: 0 },
    { denominacion: 0.25, cantidad: 0, total: 0 },
    { denominacion: 0.1, cantidad: 0, total: 0 },
  ];

  const [detalles, setDetalles] = useState(denominacionesBase);

  const filtrosGuardados = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

  const [fechaInicio, setFechaInicio] = useState(
    filtrosGuardados.fechaInicio || "2026-01-01",
  );

  const [fechaFin, setFechaFin] = useState(
    filtrosGuardados.fechaFin || new Date().toLocaleDateString("en-CA"),
  );

  const [agencias, setAgencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [agenciaId, setAgenciaId] = useState(filtrosGuardados.agenciaId || "");

  const [vendedorId, setVendedorId] = useState(
    filtrosGuardados.vendedorId || "",
  );

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fechaInicio,
        fechaFin,
        agenciaId,
        vendedorId,
      }),
    );
  }, [fechaInicio, fechaFin, agenciaId, vendedorId]);

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      setUsuarios(res.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    cargarAgencias();
    cargarUsuarios();
  }, []);
  const handleCantidadChange = (index, cantidad) => {
    const newDetalles = [...detalles];

    const cant = Number(cantidad) || 0;
    const denom = newDetalles[index].denominacion;

    newDetalles[index].cantidad = cant;
    newDetalles[index].total = cant * denom;

    setDetalles(newDetalles);
  };

  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFecha(hoyLocal);
  }, []);

  const cerrarCaja = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Sesión expirada");
        return;
      }

      setLoading(true);

      const retirosLimpios = retiros.map((r) => ({
        monto: Number(r.monto),
        motivo: r.motivo,
        autorizadoPor: r.autorizadoPor,
      }));

      const denominaciones = detalles
        .filter((d) => d.cantidad > 0)
        .map((d) => ({
          denominacion: d.denominacion,
          cantidad: Number(d.cantidad),
          total: Number(d.total),
        }));

      const payload = {
        cierre: {
          fecha,
          observacion: "Cierre desde sistema",
        },
        denominaciones,
        retiros: retirosLimpios,
      };

      const res = await axios.post(
        `${API_URL}/api/contabilidad/cierre-caja`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      alert("Cierre realizado correctamente");

      // 🔄 reset UI
      setRows([{ ...filaVacia }]);
      setRetiros([]);
    } catch (error) {
      console.error(error?.response?.data || error);
      alert(error?.response?.data?.message || "Error al cerrar caja");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (index, field, value) => {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[index][field] = value;
      return newRows;
    });
  };

  useEffect(() => {
    const cargarMovimientos = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) return;

        const res = await axios.get(`${API_URL}/api/movimientos`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            fechaInicio,
            fechaFin,
            agenciaId,
            ...(vendedorId && { vendedorId }),
          },
        });

        const data = res.data?.data || res.data;

        if (!data || data.length === 0) {
          setRows([{ ...filaVacia }]);
        } else {
          const mapped = data.map((item) => ({
            ...item,
            recibo: item.recibo || "",
          }));

          setRows(mapped);
        }
      } catch (error) {
        console.error(error);
        setRows([{ ...filaVacia }]);
      }
    };

    cargarMovimientos();
  }, [fechaInicio, fechaFin, agenciaId, vendedorId]);

  /* TEMPORAL */

  const agregarFila = async () => {
    try {
      const ultimaFila = rows[rows.length - 1];

      // 🔴 Validación
      if (!ultimaFila.formaPago && !ultimaFila.observacion) {
        alert("Debe seleccionar forma de pago o escribir una observación");
        return;
      }

      const token = localStorage.getItem("token");

      if (!token) {
        alert("Sesión expirada");
        return;
      }

      setLoading(true);

      await axios.post(
        `${API_URL}/api/movimientos`,
        {
          ...ultimaFila,
          valor: Number(ultimaFila.valor),
          recibo: ultimaFila.recibo ? Number(ultimaFila.recibo) : null,
          formaPago: ultimaFila.formaPago || null,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const nuevaFila = {
        ...filaVacia,
        responsable: ultimaFila.responsable || "",
        recibo: ultimaFila.recibo ? Number(ultimaFila.recibo) + 1 : null,
      };

      setRows((prev) => [...prev, nuevaFila]);
    } catch (error) {
      console.error(error?.response?.data || error);
      alert(error?.response?.data?.msg || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const eliminarFila = (index) => {
    const nuevas = rows.filter((_, i) => i !== index);
    setRows(nuevas);
  };

  const totales = rows.reduce(
    (acc, row) => {
      const valor = Number(row.valor) || 0;

      const forma = row.formaPago || "NINGUNO";

      if (forma === "EFECTIVO") {
        acc.efectivo += valor;
      } else if (forma === "TRANSFERENCIA") {
        acc.transferencia += valor;
      } else if (forma === "PENDIENTE") {
        acc.pendiente += valor;
      }

      return acc;
    },
    {
      efectivo: 0,
      transferencia: 0,
      pendiente: 0,
    },
  );

  const totalDenominaciones = detalles.reduce((acc, d) => acc + d.total, 0);

  // Totales combinados
  const totalET = totales.efectivo + totales.transferencia;
  const totalGeneral = totalET + totales.pendiente;

  const resumenDetalle = rows.reduce((acc, row) => {
    const valor = Number(row.valor) || 0;

    if (!row.detalle || !row.formaPago) return acc;

    const key = `${row.detalle.toLowerCase()}_${row.formaPago.toLowerCase()}`;

    acc[key] = (acc[key] || 0) + valor;

    return acc;
  }, {});

  const resumenArray = [
    {
      key: "cuota_efectivo",
      label: "Cuota Efectivo",
      value: resumenDetalle.cuota_efectivo,
    },
    {
      key: "cuota_transferencia",
      label: "Cuota Transferencia",
      value: resumenDetalle.cuota_transferencia,
    },
    {
      key: "contado_efectivo",
      label: "Contado Efectivo",
      value: resumenDetalle.contado_efectivo,
    },
    {
      key: "contado_transferencia",
      label: "Contado Transferencia",
      value: resumenDetalle.contado_transferencia,
    },
    {
      key: "entrada_efectivo",
      label: "Entrada Efectivo",
      value: resumenDetalle.entrada_efectivo,
    },
    {
      key: "entrada_transferencia",
      label: "Entrada Transferencia",
      value: resumenDetalle.entrada_transferencia,
    },
    {
      key: "entrada_pendiente",
      label: "Entrada Pendiente",
      value: resumenDetalle.entrada_pendiente,
    },
    {
      key: "alcance_efectivo",
      label: "Alcance Efectivo",
      value: resumenDetalle.alcance_efectivo,
    },
    {
      key: "alcance_transferencia",
      label: "Alcance Transferencia",
      value: resumenDetalle.alcance_transferencia,
    },
  ];

  const retiroVacio = {
    monto: "",
    motivo: "",
    autorizadoPor: "",
  };

  const [retiros, setRetiros] = useState([]);

  const [cierres, setCierres] = useState([]);

  const totalRetiros = retiros.reduce(
    (acc, r) => acc + (Number(r.monto) || 0),
    0,
  );


  useEffect(() => {
    const cargarUltimoCierre = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) return;

        const res = await axios.get(
          `${API_URL}/api/contabilidad/cierres-caja`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              fechaInicio,
              fechaFin,
              agenciaId,
            },
          },
        );

        const cierres = res.data;

        if (!cierres || cierres.length === 0) return;
        
        setCierres(cierres);
      } catch (error) {
        console.error("Error cargando cierre:", error);
      }
    };

    cargarUltimoCierre();
  }, [fechaInicio, fechaFin, agenciaId]);


  return (
    <div className="p-4">
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

    {/*   <div className="mt-4 border p-3 bg-gray-50">
        <h3 className="font-bold mb-2">
          Conteo de Efectivo (${totalDenominaciones.toFixed(2)})
        </h3>

        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 text-left">Denominación</th>
                <th className="p-2 text-left">Cantidad</th>
                <th className="p-2 text-left">Total</th>
              </tr>
            </thead>

            <tbody>
              {detalles.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">${d.denominacion}</td>

                  <td className="p-2">
                    <input
                      type="number"
                      min="0"
                      className="border p-1 w-full"
                      value={d.cantidad}
                      onChange={(e) => handleCantidadChange(i, e.target.value)}
                    />
                  </td>

                  <td className="p-2 font-semibold">${d.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div> */}

      <h2 className="text-xl font-bold mb-4">Movimiento de Caja</h2>

      {/* HISTORIAL DE CIERRES */}
      {cierres.length > 0 && (
        <div className="mt-4 border p-4 bg-blue-50">
          <h3 className="font-bold text-lg mb-4">Historial de Cierres</h3>
          
          {cierres.map((cierre, idx) => (
            <div key={idx} className="mb-6 p-4 bg-white border rounded">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <span className="text-gray-500 text-sm">Fecha</span>
                  <p className="font-semibold">{cierre.fecha}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Usuario</span>
                  <p className="font-semibold">{cierre.usuarioAgencia?.usuario?.nombre}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Agencia</span>
                  <p className="font-semibold">{cierre.usuarioAgencia?.agencia?.nombre}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">Estado</span>
                  <p className={`font-semibold ${cierre.estado === 'CUADRADO' ? 'text-green-600' : 'text-red-600'}`}>
                    {cierre.estado}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 text-sm">
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Efectivo</span>
                  <p className="font-bold">${Number(cierre.totalEfectivo).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Transferencia</span>
                  <p className="font-bold">${Number(cierre.totalTransferencia).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Pendiente</span>
                  <p className="font-bold">${Number(cierre.totalPendiente).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Sistema</span>
                  <p className="font-bold">${Number(cierre.totalSistema).toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <span className="text-gray-500">Físico</span>
                  <p className="font-bold">${Number(cierre.totalFisico).toFixed(2)}</p>
                </div>
              </div>

              {/* Denominaciones */}
              <div className="mb-4">
                <h4 className="font-semibold mb-2">Denominaciones</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-200">
                      <tr>
                        <th className="p-1 text-left">Denominación</th>
                        <th className="p-1 text-left">Cantidad</th>
                        <th className="p-1 text-left">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cierre.denominaciones?.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-1">${d.valor}</td>
                          <td className="p-1">{d.cantidad}</td>
                          <td className="p-1">${(Number(d.valor) * Number(d.cantidad)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Retiros */}
              {cierre.retiros && cierre.retiros.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Retiros</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-red-200">
                        <tr>
                          <th className="p-1 text-left">Monto</th>
                          <th className="p-1 text-left">Motivo</th>
                          <th className="p-1 text-left">Autorizado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cierre.retiros.map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-1">${Number(r.monto).toFixed(2)}</td>
                            <td className="p-1">{r.motivo}</td>
                            <td className="p-1">{r.autorizadoPor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Movimientos */}
              {cierre.movimientos && cierre.movimientos.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Movimientos</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="p-1 text-left">Responsable</th>
                          <th className="p-1 text-left">Detalle</th>
                          <th className="p-1 text-left">Valor</th>
                          <th className="p-1 text-left">Forma Pago</th>
                          <th className="p-1 text-left">Recibo</th>
                          <th className="p-1 text-left">Observación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cierre.movimientos.map((m, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-1">{m.responsable}</td>
                            <td className="p-1">{m.detalle}</td>
                            <td className="p-1">${Number(m.valor).toFixed(2)}</td>
                            <td className="p-1">{m.formaPago}</td>
                            <td className="p-1">{m.recibo}</td>
                            <td className="p-1">{m.observacion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}


    </div>
  );
}
