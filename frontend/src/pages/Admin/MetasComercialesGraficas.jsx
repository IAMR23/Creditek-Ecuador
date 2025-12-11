import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

// Recharts
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LabelList,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
  Cell as PieCell,
} from "recharts";

export default function MetasComercialesGraficas() {
  const [filas, setFilas] = useState([]);
  const [dataGrafica, setDataGrafica] = useState([]);
  const [loading, setLoading] = useState(false);

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState("");
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(12); // Meta/viabilidad

  const COLORS = ["#16a34a", "#f87171"];

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data || []);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las agencias.",
      });
      setAgencias([]);
    }
  };

  const procesarGrafica = (ventas) => {
    const conteo = {};
    ventas.forEach((v) => {
      const ag = v.local ?? "SIN AGENCIA";
      if (!conteo[ag]) conteo[ag] = 0;
      conteo[ag]++;
    });

    const totalVentas = Object.values(conteo).reduce((a, b) => a + b, 0);

    const resultado = Object.entries(conteo).map(([agencia, total]) => ({
      agencia,
      total,
      porcentaje: ((total / totalVentas) * 100).toFixed(1),
    }));

    setDataGrafica(resultado);
  };

  const fetchData = async () => {
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
      setFilas(ventas);
      procesarGrafica(ventas);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

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
    XLSX.writeFile(wb, `Metas_Comerciales_${fechaInicio}_${fechaFin}.xlsx`);

    Swal.fire({
      icon: "success",
      title: "Excel generado",
      timer: 1500,
      showConfirmButton: false,
    });
  };

  useEffect(() => {
    const hoy = new Date().toLocaleDateString("en-CA");
    setFechaInicio(hoy);
    setFechaFin(hoy);
    cargarAgencias();
  }, []);

  useEffect(() => {
    if (fechaInicio && fechaFin) fetchData();
  }, [fechaInicio, fechaFin, agenciaId]);

  const getBarColor = (porcentaje) => {
    if (porcentaje >= 75) return "#16a34a"; // verde fuerte
    if (porcentaje >= 50) return "#a3e635"; // verde claro
    if (porcentaje >= 25) return "#facc15"; // amarillo
    return "#f87171"; // rojo
  };

  // Datos para PieChart (ejemplo de cumplimiento vs meta)
  const pieData = [
    { name: "Cumplido", value: Math.min(meta, dataGrafica.reduce((a, b) => a + b.total, 0)) },
    { name: "Faltante", value: Math.max(0, meta - dataGrafica.reduce((a, b) => a + b.total, 0)) },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">
        Metas Comerciales — Gráficas
      </h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium">Fecha Inicio</label>
          <input
            type="date"
            className="border px-3 py-2 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Fecha Fin</label>
          <input
            type="date"
            className="border px-3 py-2 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Agencia</label>
          <select
            className="border px-3 py-2 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
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
          <label className="block text-sm font-medium">Meta</label>
          <input
            type="number"
            className="border px-3 py-2 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            value={meta}
            onChange={(e) => setMeta(Number(e.target.value))}
          />
        </div>

        <button
          className="bg-green-600 text-white px-5 py-2 rounded hover:bg-green-700 shadow-md"
          onClick={descargarExcel}
        >
          Descargar Excel
        </button>
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Barra con línea de meta */}
          <div className="w-full h-96 bg-white p-4 rounded-xl shadow-lg border border-gray-200">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataGrafica}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis dataKey="agencia" tick={{ fontSize: 14 }} />
                <YAxis tickFormatter={(value) => `${value}`} />
                <Tooltip
                  formatter={(value) => [`${value} ventas`, "Total"]}
                />
                <Legend />
                <ReferenceLine
                  y={meta}
                  label={`Meta: ${meta}`}
                  stroke="#f87171"
                  strokeDasharray="3 3"
                />
                <Bar
                  dataKey="total"
                  name="Total de ventas"
                  isAnimationActive={true}
                  radius={[6, 6, 0, 0]}
                >
                  <LabelList
                    dataKey="porcentaje"
                    position="top"
                    formatter={(val) => `${val}%`}
                  />
                  {dataGrafica.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.porcentaje)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Diagrama de circulo */}
          <div className="w-full h-96 bg-white p-4 rounded-xl shadow-lg border border-gray-200 flex flex-col items-center justify-center">
            <h2 className="text-lg font-semibold mb-4">Cumplimiento de Meta</h2>
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((entry, index) => (
                    <PieCell key={`cell-pie-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
