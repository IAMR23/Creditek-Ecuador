import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { FaPlus, FaTimes } from "react-icons/fa";
import { getHoyLocal } from "../../utils/dateUtils";
import { useAuthUser } from "../../utils/useAuthUser";

const filaVacia = {
  responsable: "",
  detalle: "",
  valor: "",
  formaPago: "",
  recibo: "",
  observacion: "",
  guardado: false,
};

export default function MovimientoCaja() {
  const [rows, setRows] = useState([{ ...filaVacia }]);
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
        { denominacion: 0.05, cantidad: 0, total: 0 },
    { denominacion: 0.01, cantidad: 0, total: 0 },
  ];

  const [detalles, setDetalles] = useState(denominacionesBase);

  let guardado = false;

  const handleCantidadChange = (index, cantidad) => {
    const newDetalles = [...detalles];

    const cant = Number(cantidad) || 0;
    const denom = newDetalles[index].denominacion;

    newDetalles[index].cantidad = cant;
    newDetalles[index].total = cant * denom;

    setDetalles(newDetalles);
  };

  const filaEsMovimientoValido = (fila) => {
    return (
      fila.detalle?.trim() && Number(fila.valor) > 0 && fila.formaPago?.trim()
    );
  };

  const cerrarCaja = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Sesión expirada");
        return;
      }

      setLoading(true);

      const retirosLimpios = retiros
        .filter(
          (r) =>
            Number(r.monto) > 0 || r.motivo?.trim() || r.autorizadoPor?.trim(),
        )
        .map((r) => ({
          monto: Number(r.monto) || 0,
          motivo: r.motivo || "",
          autorizadoPor: r.autorizadoPor || "",
        }));

      const denominaciones = detalles
        .filter((d) => d.cantidad > 0)
        .map((d) => ({
          denominacion: d.denominacion,
          cantidad: Number(d.cantidad),
          total: Number(d.total),
        }));

      const movimientosPendientes = rows
        .filter(filaEsMovimientoValido)
        .map((row) => ({
          responsable: row.responsable || "",
          detalle: row.detalle || "",
          valor: Number(row.valor) || 0,
          formaPago: row.formaPago || null,
          recibo: row.recibo ? Number(row.recibo) : null,
          observacion: row.observacion || "",
        }));

      const payload = {
        cierre: {
          
          observacion: "Cierre desde sistema",
        },
        denominaciones,
        retiros: retirosLimpios,
        movimientosPendientes,
      };

      await axios.post(`${API_URL}/api/contabilidad/cierre-caja`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      alert("Cierre realizado correctamente");

      setRows([{ ...filaVacia }]);
      setRetiros([{ monto: "", motivo: "", autorizadoPor: "" }]);
      setDetalles(denominacionesBase);
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

        const res = await axios.get(`${API_URL}/api/movimientos`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = res.data.data;

        if (!data || data.length === 0) {
          setRows([{ ...filaVacia, guardado: false }]);
        } else {
          const mapped = data.map((item) => ({
            ...item,
            recibo: item.recibo || "",
            guardado: true,
          }));

          const ultimaFila = mapped[mapped.length - 1];

          mapped.push({
            ...filaVacia,
            responsable: ultimaFila?.responsable || "",
            recibo: ultimaFila?.recibo ? Number(ultimaFila.recibo) + 1 : "",
            guardado: false,
          });

          setRows(mapped);
        }
      } catch (error) {
        console.error(error);
      }
    };

    cargarMovimientos();
  }, []);

  const agregarFila = async () => {
    try {
      const ultimaFila = rows[rows.length - 1];

      if (
        !ultimaFila.detalle?.trim() ||
        Number(ultimaFila.valor) <= 0 ||
        !ultimaFila.formaPago?.trim()
      ) {
        alert("Debe completar detalle, valor y forma de pago");
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
        recibo: ultimaFila.recibo ? Number(ultimaFila.recibo) + 1 : "",
        guardado: false,
      };

      setRows((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          guardado: true,
        };
        updated.push(nuevaFila);
        return updated;
      });
    } catch (error) {
      console.error(error?.response?.data || error);
      alert(error?.response?.data?.msg || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const eliminarFila = async (index) => {
    const fila = rows[index];

    try {
      if (fila.id) {
        await axios.delete(`${API_URL}/api/movimientos/${fila.id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
      }

      setRows((prev) => {
        const nuevas = prev.filter((_, i) => i !== index);

        const existeFilaEditable = nuevas.some((fila) => !fila.guardado);

        if (!existeFilaEditable) {
          const ultimaFila = nuevas[nuevas.length - 1];

          nuevas.push({
            ...filaVacia,
            responsable: ultimaFila?.responsable || "",
            recibo: ultimaFila?.recibo ? Number(ultimaFila.recibo) + 1 : "",
            guardado: false,
          });
        }

        return nuevas;
      });
    } catch (error) {
      console.error("Error al eliminar fila:", error);
      alert("No se pudo eliminar la fila");
    }
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

  const [retiros, setRetiros] = useState([
    { monto: "", motivo: "", autorizadoPor: "" },
  ]);

  const totalRetiros = retiros.reduce(
    (acc, r) => acc + (Number(r.monto) || 0),
    0,
  );

  const user = useAuthUser();
  const agencia = user?.agenciaPrincipal?.nombre || "Agencia Desconocida";

  return (
    <div className=" flex justify-between flex-row gap-2 items-start p-4">
      <div className="flex flex-col border">
        <div>
          <h2 className="text-xl font-bold mb-2 uppercase ">
            CUADRE DE CAJA AGENCIA {agencia}{" "}
          </h2>
        </div>

        <h3 className="font-bold ">
          Conteo de Efectivo (${totalDenominaciones.toFixed(2)})
        </h3>

        <div className="border rounded-lg shadow-lg overflow-hidden m-2">
          <table className="w-full text-sm">
            <thead>
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
      </div>

      <div className="flex justify-center  flex-col gap-2 ">
        <div className="flex justify-between p-2">
          <h2 className="text-xl font-bold ">Movimiento de Caja</h2>
          <input
            type="date"
            value={getHoyLocal()}
            disabled
            readOnly
            className="border"
          />
        </div>
        <div className="border p-3 w-fit ">
          <h3 className="font-bold mb-2">Resumen</h3>

          <div className="flex flex-wrap gap-4 text-sm items-center">
            <div>
              Efectivo: <strong>${totales.efectivo.toFixed(2)}</strong>
            </div>
            <div>
              Transferencia:{" "}
              <strong>${totales.transferencia.toFixed(2)}</strong>
            </div>
            <div>
              Pendiente: <strong>${totales.pendiente.toFixed(2)}</strong>
            </div>
            <div className="font-semibold">
              Efectivo + Transferencia: ${totalET.toFixed(2)}
            </div>
            <div className="font-bold">
              Total General: ${totalGeneral.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="border p-3 w-fit ">
          <h3 className="font-bold mb-2">Resumen por Tipo</h3>

          <div className="flex flex-wrap gap-6 text-sm">
            {resumenArray.map((item) => (
              <div key={item.key} className="flex flex-col">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-semibold">
                  ${(item.value || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* TABLA */}
        <div className="overflow-auto border p-3">
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th>Item</th>
                <th>Responsable</th>
                <th>Detalle</th>
                <th>Valor</th>
                <th>Forma Pago</th>
                <th>Recibo</th>
                <th>Observación</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody className="">
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">{i + 1}</td>
                  <td>
                    <input
                      disabled={row.guardado}
                      value={row.responsable}
                      onChange={(e) =>
                        handleChange(i, "responsable", e.target.value)
                      }
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <select
                      disabled={row.guardado}
                      value={row.detalle}
                      onChange={(e) =>
                        handleChange(i, "detalle", e.target.value)
                      }
                      className="w-full p-1"
                    >
                      <option value="">-- Seleccionar --</option>
                      <option value="CUOTA">CUOTA</option>
                      <option value="ENTRADA">ENTRADA</option>
                      <option value="ALCANCE">ALCANCE</option>
                      <option value="CREDITO">CREDITO</option>
                      <option value="CONTADO">CONTADO</option>
                      <option value="CANCELA_ENTRADA_PEND">
                        CANCELA ENTRADA PEND.
                      </option>
                      <option value="CANCELA_ALCANCE_PEND">
                        CANCELA ALCANCE PEND.
                      </option>
                      <option value="EGRESO">EGRESO</option>
                      <option value="TARJETA DE CREDITO">
                        TARJETA DE CREDITO
                      </option>
                    </select>
                  </td>

                  <td>
                    <input
                      type="number"
                      value={row.valor}
                      onChange={(e) => handleChange(i, "valor", e.target.value)}
                      className="w-full p-1"
                      disabled={row.guardado}
                    />
                  </td>

                  <td>
                    <select
                      value={row.formaPago}
                      onChange={(e) =>
                        handleChange(i, "formaPago", e.target.value)
                      }
                      className="w-full p-1"
                      disabled={row.guardado}
                    >
                      <option value="">-- Seleccionar --</option>
                      <option value="EFECTIVO">EFECTIVO</option>
                      <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                      <option value="PENDIENTE">PENDIENTE</option>
                    </select>
                  </td>

                  <td>
                    <input
                      disabled={row.guardado}
                      type="number"
                      value={row.recibo}
                      onChange={(e) =>
                        handleChange(i, "recibo", e.target.value)
                      }
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <input
                      disabled={row.guardado}
                      value={row.observacion}
                      onChange={(e) =>
                        handleChange(i, "observacion", e.target.value)
                      }
                      className="w-full p-1"
                    />
                  </td>

                  <td className="flex justify-center items-center p-2 gap-2">
                    <button
                      onClick={agregarFila}
                      disabled={
                        loading || row.guardado || i !== rows.length - 1
                      }
                      className="bg-green-500 text-white p-2 disabled:bg-gray-400"
                    >
                      {loading ? "Guardando..." : <FaPlus />}
                    </button>
                    <button
                      onClick={() => eliminarFila(i)}
                      className="text-white bg-red-600 p-2"
                    >
                      <FaTimes />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border p-3 bg-red-50">
          <h3 className="font-bold mb-2">
            Retiros de Caja - Total: ${totalRetiros.toFixed(2)}
          </h3>

          <table className="w-full text-sm">
            <thead className="bg-red-200">
              <tr>
                <th>#</th>
                <th>Monto</th>
                <th>Motivo</th>
                <th>Autorizado por</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {retiros.map((r, i) => (
                <tr key={i} className="border-t">
                  <td>{i + 1}</td>

                  <td>
                    <input
                      type="number"
                      value={r.monto}
                      onChange={(e) => {
                        const newData = [...retiros];
                        newData[i].monto = e.target.value;
                        setRetiros(newData);
                      }}
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <input
                      value={r.motivo}
                      onChange={(e) => {
                        const newData = [...retiros];
                        newData[i].motivo = e.target.value;
                        setRetiros(newData);
                      }}
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <input
                      value={r.autorizadoPor}
                      onChange={(e) => {
                        const newData = [...retiros];
                        newData[i].autorizadoPor = e.target.value;
                        setRetiros(newData);
                      }}
                      className="w-full p-1"
                    />
                  </td>

                  <td className="flex justify-center items-center p-2 gap-2">
                    <button
                      onClick={() =>
                        setRetiros([
                          ...retiros,
                          { monto: "", motivo: "", autorizadoPor: "" },
                        ])
                      }
                      className="bg-green-500 text-white p-2"
                    >
                      <FaPlus />
                    </button>

                    <button
                      onClick={() =>
                        setRetiros(retiros.filter((_, index) => index !== i))
                      }
                      className="text-white bg-red-600 p-2"
                    >
                      <FaTimes />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col justify-end h-full">
          <button
            onClick={cerrarCaja}
            className="bg-blue-600 text-white px-6 py-2 self-end"
          >
            Cerrar Caja
          </button>
        </div>
      </div>
    </div>
  );
}
