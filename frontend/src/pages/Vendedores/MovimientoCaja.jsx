import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";

const filaVacia = {
  responsable: "",
  detalle: "",
  entidad: "",
  valor: "",
  formaPago: "EFECTIVO",
  nroRecibo: "",
  observacion: "",
};

export default function MovimientoCaja() {
  const [rows, setRows] = useState([{ ...filaVacia }]);
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFecha(hoyLocal);
  }, []);

  const handleChange = (index, field, value) => {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[index][field] = value;
      return newRows;
    });
  };

  const agregarFila = async () => {
    try {
      const ultimaFila = rows[rows.length - 1];

      const token = localStorage.getItem("token");

      if (!token) {
        alert("Sesión expirada");
        return;
      }

      setLoading(true);

      // 💾 Guardar la fila actual en backend
      await axios.post(
        `${API_URL}/api/movimientos`,
        {
          ...ultimaFila,
          valor: Number(ultimaFila.valor),
          nroRecibo: ultimaFila.nroRecibo ? Number(ultimaFila.nroRecibo) : null,
          // ❌ fecha se asigna en backend
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // ➕ Nueva fila vacía
      const nuevaFila = {
        ...filaVacia,
        responsable: ultimaFila.responsable || "", // mantiene responsable
        nroRecibo: ultimaFila.nroRecibo
          ? Number(ultimaFila.nroRecibo) + 1
          : null, // incrementa recibo si existe
      };

      setRows((prev) => [...prev, nuevaFila]);
    } catch (error) {
      console.error(error?.response?.data || error);
      alert(error?.response?.data?.msg || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  // ❌ eliminar fila (solo frontend)
  const eliminarFila = (index) => {
    const nuevas = rows.filter((_, i) => i !== index);
    setRows(nuevas);
  };

  const totales = rows.reduce(
    (acc, row) => {
      const valor = Number(row.valor) || 0;

      if (row.formaPago === "EFECTIVO") {
        acc.efectivo += valor;
      } else if (row.formaPago === "TRANSFERENCIA") {
        acc.transferencia += valor;
      } else if (row.formaPago === "PENDIENTE") {
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

const totalRetiros = retiros.reduce(
  (acc, r) => acc + (Number(r.monto) || 0),
  0
);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Movimiento de Caja</h2>

      <div className="mt-4 border p-3 w-fit bg-gray-100">
        <h3 className="font-bold mb-2">Resumen</h3>

        <div className="flex flex-wrap gap-4 text-sm items-center">
          <div>
            Efectivo: <strong>${totales.efectivo.toFixed(2)}</strong>
          </div>
          <div>
            Transferencia: <strong>${totales.transferencia.toFixed(2)}</strong>
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

      <div className="mt-4 border p-3 w-fit bg-gray-50">
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
              <th>Entidad</th>
              <th>Valor</th>
              <th>Forma Pago</th>
              <th>Recibo</th>
              <th>Observación</th>
              <th></th>
            </tr>
          </thead>

          <tbody className="">
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                <td className="p-1">{i + 1}</td>
                <td>
                  <input
                    value={row.responsable}
                    onChange={(e) =>
                      handleChange(i, "responsable", e.target.value)
                    }
                    className="w-full p-1"
                  />
                </td>

                <td>
                  <select
                    value={row.detalle}
                    onChange={(e) => handleChange(i, "detalle", e.target.value)}
                    className="w-full p-1"
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="CUOTA">CUOTA</option>
                    <option value="ENTRADA">ENTRADA</option>
                    <option value="ALCANCE">ALCANCE</option>
                    <option value="CONTADO">CONTADO</option>
                    <option value="CANCELA_ENTRADA_PEND">
                      CANCELA ENTRADA PEND.
                    </option>
                    <option value="CANCELA_ALCANCE_PEND">
                      CANCELA ALCANCE PEND.
                    </option>
                    <option value="EGRESO">EGRESO</option>
                  </select>
                </td>

                <td>
                  <input
                    value={row.entidad}
                    onChange={(e) => handleChange(i, "entidad", e.target.value)}
                    className="w-full p-1"
                  />
                </td>

                <td>
                  <input
                    type="number"
                    value={row.valor}
                    onChange={(e) => handleChange(i, "valor", e.target.value)}
                    className="w-full p-1"
                  />
                </td>

                <td>
                  <select
                    value={row.formaPago}
                    onChange={(e) =>
                      handleChange(i, "formaPago", e.target.value)
                    }
                    className="w-full p-1"
                  >
                    <option value="EFECTIVO">EFECTIVO</option>
                    <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                    <option value="PENDIENTE">PENDIENTE</option>
                  </select>
                </td>

                <td>
                  <input
                    type="number"
                    value={row.nroRecibo}
                    onChange={(e) =>
                      handleChange(i, "nroRecibo", e.target.value)
                    }
                    className="w-full p-1"
                  />
                </td>

                <td>
                  <input
                    value={row.observacion}
                    onChange={(e) =>
                      handleChange(i, "observacion", e.target.value)
                    }
                    className="w-full p-1"
                  />
                </td>

                <td>
                  <button
                    onClick={() => eliminarFila(i)}
                    className="text-red-500"
                  >
                    X
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        
      </div>

      {/* ACCIONES */}
      <div className="flex justify-between mt-4">
        <button
          onClick={agregarFila}
          disabled={loading}
          className="bg-gray-500 text-white px-4 py-2"
        >
          {loading ? "Guardando..." : "+ Fila"}
        </button>
      </div>

      <div className="mt-4 border p-3 bg-red-50">
  <h3 className="font-bold mb-2"> Retiros de Caja - Total: ${totalRetiros.toFixed(2)}</h3>

  <table className="w-full text-sm">
    <thead className="bg-red-200">
      <tr>
        <th>#</th>
        <th>Monto</th>
        <th>Motivo</th>
        <th>Autorizado por</th>
        <th></th>
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

          <td>
            <button
              onClick={() =>
                setRetiros(retiros.filter((_, index) => index !== i))
              }
              className="text-red-500"
            >
              X
            </button>
          </td>
        </tr>
      ))}
    </tbody>



  </table>

  <button
    onClick={() =>
      setRetiros([...retiros, { monto: "", motivo: "", autorizadoPor: "" }])
    }
    className="mt-2 bg-red-500 text-white px-3 py-1"
  >
    + Retiro
  </button>
</div>

    </div>
  );
}
