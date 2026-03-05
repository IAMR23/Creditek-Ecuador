import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
} from "recharts";
const STORAGE_KEY = "dashboard_filtros";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import { useRef } from "react";
import { FaFileExcel } from "react-icons/fa";

export default function Bonos() {
  // 🔥 Cargar filtros desde localStorage UNA SOLA VEZ
  const filtrosGuardados = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  const chartRef = useRef(null);
  const COLORS = [
    "#6366F1",
    "#22C55E",
    "#F59E0B",
    "#EF4444",
    "#06B6D4",
    "#A855F7",
    "#14B8A6",
  ];

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);

  const [tabla, setTabla] = useState([]);
  const [totalVentas, setTotalVentas] = useState(0);
  const [totalPago, setTotalPago] = useState(0);
const [bono, setBono] = useState(0);
const [ventasPorVendedor, setVentasPorVendedor] = useState({});
  // ✅ Estados persistentes
  const [fechaInicio, setFechaInicio] = useState(
    filtrosGuardados.fechaInicio || "2026-01-01",
  );

  const [fechaFin, setFechaFin] = useState(
    filtrosGuardados.fechaFin || new Date().toLocaleDateString("en-CA"),
  );

  const [agenciaId, setAgenciaId] = useState(filtrosGuardados.agenciaId || "");

  const [vendedorId, setVendedorId] = useState(
    filtrosGuardados.vendedorId || "",
  );

  const [cierreCajaTipo, setCierreCajaTipo] = useState(
    filtrosGuardados.cierreCajaTipo || "",
  );

  const exportarExcelCompleto = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Bonos");

    // -----------------------------
    // TITULO
    // -----------------------------
    worksheet.mergeCells("A1:D1");
    worksheet.getCell("A1").value = "REPORTE DE BONOS POR VENDEDOR";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.addRow([]);

    // -----------------------------
    // ENCABEZADOS
    // -----------------------------
    const header = ["Vendedor", "Ventas", "Bono", "Total"];

    const headerRow = worksheet.addRow(header);

    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF16A34A" },
      };

      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center" };
    });

    // -----------------------------
    // DATOS
    // -----------------------------
    tabla.forEach((v) => {
      worksheet.addRow([v.vendedor, v.cantidad, v.bono, v.total]);
    });

    worksheet.addRow([]);

    worksheet.addRow(["TOTAL", totalVentas, "", totalPago]);

    worksheet.columns = [
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
    ];

    // -----------------------------
    // CAPTURAR GRAFICA
    // -----------------------------
    const canvas = await html2canvas(chartRef.current);
    const image = canvas.toDataURL("image/png");

    const imageId = workbook.addImage({
      base64: image,
      extension: "png",
    });

    worksheet.addImage(imageId, {
      tl: { col: 0, row: tabla.length + 6 },
      ext: { width: 800, height: 400 },
    });

    // -----------------------------
    // DESCARGAR
    // -----------------------------
    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, "reporte_bonos_vendedores.xlsx");
  };

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fechaInicio,
        fechaFin,
        agenciaId,
        vendedorId,
        cierreCajaTipo,
      }),
    );
  }, [fechaInicio, fechaFin, agenciaId, vendedorId, cierreCajaTipo]);

  // -----------------------------
  // CARGAS INICIALES
  // -----------------------------
  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    }
  };

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data || []);
    } catch (error) {
      console.error("Error cargando agencias:", error);
      setAgencias([]);
    }
  };

  useEffect(() => {
    cargarAgencias();
    cargarUsuarios();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUsuarioInfo(decoded.usuario);
      } catch (error) {
        console.error("Error decodificando token:", error);
      }
    }
  }, []);

  // -----------------------------
  // FETCH DATA
  // -----------------------------
  const fetchData = async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams({
        fechaInicio,
        fechaFin,
      });

      if (agenciaId) params.append("agenciaId", agenciaId);
      if (vendedorId) params.append("vendedorId", vendedorId);
      if (cierreCajaTipo) params.append("cierreCaja", cierreCajaTipo);

      const url = `${API_URL}/auditoria/ventas2?${params.toString()}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

const vendedores = data.estadisticas.porVendedor || {};
setVentasPorVendedor(vendedores);
      const tablaCalculada = Object.entries(vendedores).map(
        ([nombre, ventas]) => ({
          vendedor: nombre,
          cantidad: ventas,
          bono: bono,
          total: ventas * bono,
        }),
      );

      const totalVentasCalc = tablaCalculada.reduce(
        (acc, v) => acc + v.cantidad,
        0,
      );

      const totalPagoCalc = tablaCalculada.reduce((acc, v) => acc + v.total, 0);

      setTabla(tablaCalculada);
      setTotalVentas(totalVentasCalc);
      setTotalPago(totalPagoCalc);

      setEstadisticas(data.estadisticas);

      const ventas = data.ventas || [];

      const resultado = ventas.map((venta) => ({
        id: venta.id,
        Fecha: venta.fecha ?? "",
        Día: venta.dia ?? "",
        Cliente: venta.nombre ?? "",
        Agencia: venta.local ?? "",
        Vendedor: venta.vendedor ?? "",
        Origen: venta.origen ?? "",
        "Observaciones de Origen": venta.observaciones ?? "",
        Dispositivo: venta.tipo ?? "",
        Marca: venta.marca ?? "",
        Modelo: venta.modelo ?? "",
        "Precio Sistema": venta.precioSistema ?? "",
        "Precio Vendedor": venta.precioVendedor ?? "",
        "Forma Pago": venta.formaPago ?? "",
        Contrato: venta.contrato ?? "",
        Entrada: venta.entrada ?? "",
        Alcance: venta.alcance ?? "",
        Estado: venta.validada ? "Validada" : "No validada",
      }));

      setFilas(resultado);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Se ejecuta cuando cambian filtros
  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchData();
    }
  }, [
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    cierreCajaTipo,
    usuarioInfo,
  ]);

  useEffect(() => {
  const tablaCalculada = Object.entries(ventasPorVendedor).map(
    ([nombre, ventas]) => ({
      vendedor: nombre,
      cantidad: ventas,
      bono: bono,
      total: ventas * bono,
    }),
  );

  const totalVentasCalc = tablaCalculada.reduce(
    (acc, v) => acc + v.cantidad,
    0,
  );

  const totalPagoCalc = tablaCalculada.reduce(
    (acc, v) => acc + v.total,
    0,
  );

  setTabla(tablaCalculada);
  setTotalVentas(totalVentasCalc);
  setTotalPago(totalPagoCalc);

}, [bono, ventasPorVendedor]);


  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ventas por Vendedor Bonos</h1>

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



        <div>
          <label className="block text-sm font-medium">Vendedor</label>
          <select
            className="border px-2 py-1 rounded"
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Tipo de cierre de caja
          </label>
          <select
            className="border px-2 py-1 rounded"
            value={cierreCajaTipo}
            onChange={(e) => setCierreCajaTipo(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="CONTADO">Contado</option>
            <option value="CREDITV">CrediTV</option>
            <option value="UPHONE">Uphone</option>
          </select>
        </div>

<div>
  <label className="block text-sm font-medium">Bono:</label>
<input
  type="number"
  className="border px-2 py-1 rounded w-24"
  value={bono}
  min="0"
  step="0.01"
  onChange={(e) => setBono(Number(e.target.value) || 0)}
/>
</div>

        <button
          onClick={exportarExcelCompleto}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          <FaFileExcel size={18} />
        </button>
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="flex justify-center items-center flex-row">
          <div className="overflow-x-auto mt-6">
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Vendedor</th>
                  <th className="px-4 py-3 text-center">Ventas</th>
                  <th className="px-4 py-3 text-center">Bono</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {tabla.map((v, i) => (
                  <tr key={i} className="hover:bg-green-50 transition">
                    <td className="px-4 py-2 font-medium text-gray-700">
                      {v.vendedor}
                    </td>

                    <td className="px-4 py-2 text-center font-semibold">
                      {v.cantidad}
                    </td>

                    <td className="px-4 py-2 text-center text-green-600 font-semibold">
                      ${v.bono}
                    </td>

                    <td className="px-4 py-2 text-right font-bold text-green-700">
                      ${v.total}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="bg-gray-100 font-bold">
                <tr>
                  <td className="px-4 py-3">TOTAL</td>

                  <td className="px-4 py-3 text-center text-green-600">
                    {totalVentas}
                  </td>

                  <td></td>

                  <td className="px-4 py-3 text-right text-green-700 text-lg">
                    ${totalPago}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div ref={chartRef} style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart width={900} height={400} data={tabla}>
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="vendedor"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={80}
                />

                <YAxis />

                <Tooltip />

                <Bar dataKey="cantidad">
                  {tabla.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
