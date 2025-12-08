import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

export default function MetasComerciales() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);

  // 📅 Fechas
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // 🏢 Agencia
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState("");

  // ❗ Validación
  const [error, setError] = useState("");

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data || []);
    } catch (error) {
      console.error("Error cargando agencias:", error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las agencias.",
      });

      setAgencias([]);
    }
  };

  const fetchData = async () => {
    // Validación fechas
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const url = `${API_URL}/admin/metas-comerciales/ventas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&agenciaId=${agenciaId}`;

      const { data } = await axios.get(url);

      if (!data.ok) return;

      const ventas = data.ventas || [];
      console.log(ventas);
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
        Observaciones: venta.observaciones ?? "",
        Estado: venta.validada ? "Validada" : "No validada",
        
      }));

      setFilas(resultado);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Ejecutar cuando cambien filtros
  // ============================================
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      fetchData();
    }
  }, [fechaInicio, fechaFin, agenciaId]);

  // ============================================
  // Descargar Excel
  // ============================================
  const descargarExcel = () => {
    if (filas.length === 0) {
      return Swal.fire({
        icon: "warning",
        title: "Sin datos",
        text: "No hay datos para descargar.",
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filas);
    XLSX.utils.book_append_sheet(wb, ws, "Metas");

    const nombreArchivo = `MetasComerciales_${fechaInicio}_a_${fechaFin}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);

    Swal.fire({
      icon: "success",
      title: "Excel generado",
      text: "El archivo se descargó correctamente.",
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // ============================================
  // Establecer fecha actual y cargar agencias
  // ============================================
  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFechaInicio(hoyLocal);
    setFechaFin(hoyLocal);
    cargarAgencias();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Metas Comerciales</h1>

      {/* 📅 Filtros */}
      <div className="flex gap-4 mb-4 items-end">
        {/* FECHA INICIO */}
        <div>
          <label className="block text-sm font-medium">Fecha Inicio</label>
          <input
            type="date"
            className="border px-2 py-1 rounded"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        {/* FECHA FIN */}
        <div>
          <label className="block text-sm font-medium">Fecha Fin</label>
          <input
            type="date"
            className="border px-2 py-1 rounded"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        {/* AGENCIA */}
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

        {/* 🔽 Botón Excel */}
        <button
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          onClick={descargarExcel}
        >
          Descargar Excel
        </button>
      </div>

      {/* Error */}
      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {/* TABLA */}
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
