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
        nroRecibo: ultimaFila.nroRecibo
          ? Number(ultimaFila.nroRecibo)
          : null,
        // ❌ fecha se asigna en backend
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
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



  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Movimiento de Caja</h2>

      {/* FECHA Y AGENCIA */}
      <div className="hidden ">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border p-2"
        />
      </div>

      {/* TABLA */}
      <div className="overflow-auto border">
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
                  <input
                    value={row.detalle}
                    onChange={(e) => handleChange(i, "detalle", e.target.value)}
                    className="w-full p-1"
                  />
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
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
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
    </div>
  );
}
