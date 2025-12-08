import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import * as XLSX from "xlsx";

export default function MetasComerciales() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);

  // 📅 Estados para las fechas seleccionadas
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // ❗ Mensaje de error por validación
  const [error, setError] = useState("");

  const fetchData = async () => {
    // Validación FECHA INICIO > FECHA FIN
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const url = `${API_URL}/admin/metas-comerciales/ventas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      const ventas = data.ventas || [];

      const resultado = ventas.map((venta) => ({
        Fecha: venta.fecha ?? "",
        Día: venta.dia ?? "",
        Agencia: venta.local ?? "",
        Vendedor: venta.vendedor ?? "",
        Origen: venta.origen ?? "",
        Dispositivo: venta.tipo ?? "",
        Marca: venta.marca ?? "",
        Modelo: venta.modelo ?? "",
        Precio: venta.pvp ?? venta.valorCorregido ?? "",
        "Forma Pago": venta.formaPago ?? "",
        Contrato: venta.contrato ?? "",
        Entrada: venta.entrada ?? "",
        Alcance: venta.alcance ?? "",
      }));

      setFilas(resultado);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  // 🟦 Se ejecuta cada vez que cambian las fechas
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      fetchData();
    }
  }, [fechaInicio, fechaFin]);

  // 📥 Función para descargar Excel
  const descargarExcel = () => {
    if (filas.length === 0) return alert("No hay datos para descargar");

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);

    XLSX.utils.book_append_sheet(wb, ws, "Metas");

    const nombreArchivo = `MetasComerciales_${fechaInicio}_a_${fechaFin}.xlsx`;

    XLSX.writeFile(wb, nombreArchivo);
  };

  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    // "en-CA" produce formato YYYY-MM-DD

    setFechaInicio(hoyLocal);
    setFechaFin(hoyLocal);
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Metas Comerciales</h1>

      {/* 📅 Inputs de Fecha */}
      <div className="flex gap-4 mb-4 items-end">
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

        {/* 🔽 Botón de descarga */}
        <button
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          onClick={descargarExcel}
        >
          Descargar Excel
        </button>
      </div>

      {/* Mensaje de error */}
      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border mt-4 text-sm">
          <thead className="bg-gray-200">
            <tr>
              {Object.keys(filas[0] || {}).map((key) => (
                <th key={key} className="p-2 border">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {Object.values(f).map((val, j) => (
                  <td key={j} className="p-2 border">
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
