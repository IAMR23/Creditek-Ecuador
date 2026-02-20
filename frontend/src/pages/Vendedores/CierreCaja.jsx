import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../../config";

const denominacionesBase = [
  100, 50, 20, 10, 5, 1, 0.5, 0.25, 0.1
];

export default function CierreCaja() {
  const [fecha, setFecha] = useState("");
  const [usuario, setUsuario] = useState("");
  const [observacion, setObservacion] = useState("");

  const [detalles, setDetalles] = useState(
    denominacionesBase.map((d) => ({
      denominacion: d,
      cantidad: 0,
      total: 0,
    }))
  );

  const [totalFisico, setTotalFisico] = useState(0);
  const [loading, setLoading] = useState(false);

  // 🔢 recalcular totales
  useEffect(() => {
    let total = 0;

    const nuevos = detalles.map((d) => {
      const t = d.denominacion * d.cantidad;
      total += t;
      return { ...d, total: t };
    });

    setDetalles(nuevos);
    setTotalFisico(total);
  }, []);

  // actualizar cantidad
  const handleCantidadChange = (index, value) => {
    const nuevos = [...detalles];
    nuevos[index].cantidad = Number(value);
    nuevos[index].total =
      nuevos[index].cantidad * nuevos[index].denominacion;

    setDetalles(nuevos);

    // recalcular total
    const total = nuevos.reduce((acc, d) => acc + d.total, 0);
    setTotalFisico(total);
  };

  // enviar cierre
  const handleSubmit = async () => {
    try {
      setLoading(true);

      const payload = {
        fecha,
        usuario,
        observacion,
        detalles: detalles.filter((d) => d.cantidad > 0),
      };

      const res = await axios.post(`${API_URL}/cierre-caja`, payload);

      alert("✅ Cierre realizado correctamente");
      console.log(res.data);

    } catch (error) {
      console.error(error);
      alert(error.response?.data?.msg || "Error en cierre");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Cierre de Caja</h2>

      {/* FORM */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <input
          type="date"
          className="border p-2 rounded"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />

        <input
          type="text"
          placeholder="Usuario"
          className="border p-2 rounded"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
        />

        <input
          type="text"
          placeholder="Observación"
          className="border p-2 rounded"
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
        />
      </div>

      {/* TABLA */}
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
                    onChange={(e) =>
                      handleCantidadChange(i, e.target.value)
                    }
                  />
                </td>
                <td className="p-2 font-semibold">
                  ${d.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TOTAL */}
      <div className="mt-4 text-right text-xl font-bold">
        Total físico: ${totalFisico.toFixed(2)}
      </div>

      {/* BOTÓN */}
      <div className="mt-6 text-right">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Guardando..." : "Cerrar Caja"}
        </button>
      </div>
    </div>
  );
}
