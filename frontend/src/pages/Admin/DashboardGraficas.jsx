import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
];

const toArray = (obj = {}) =>
  Object.entries(obj).map(([name, value]) => ({ name, value }));

const tooltipStyle = {
  contentStyle: {
    borderRadius: "10px",
    border: "none",
    boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
  },
};

export default function DashboardGraficas({ estadisticas }) {
  if (!estadisticas) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
      {/* KPI */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="text-gray-500 text-sm">Total Ventas</h3>
        <p className="text-4xl font-bold text-blue-800">
          {estadisticas.totalVentas}
        </p>
      </div>

      {/* Ventas por Agencia */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="font-semibold mb-4">Ventas por Agencia</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={toArray(estadisticas.porAgencia)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ventas por Vendedor */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="font-semibold mb-4">Ventas por Vendedor</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={toArray(estadisticas.porVendedor)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" hide />
            <YAxis />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ventas por Día */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="font-semibold mb-4">Ventas por Día</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={toArray(estadisticas.porDia)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip {...tooltipStyle} />
            <Line
              dataKey="value"
              stroke={COLORS[2]}
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tipo de Producto */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="font-semibold mb-4">Tipo de Producto</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={toArray(estadisticas.porTipo)}
              dataKey="value"
              nameKey="name"
              outerRadius={95}
              label
            >
              {toArray(estadisticas.porTipo).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Ventas por Marca */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="font-semibold mb-4">Ventas por Marca</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={toArray(estadisticas.porMarca)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" hide />
            <YAxis />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" fill={COLORS[3]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow flex  flex-col gap-2 ">
        <div className="bg-white p-6 rounded-2xl shadow">
          <h3 className="font-semibold mb-4">Origen</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={toArray(estadisticas.porOrigen)}
                dataKey="value"
                nameKey="name"
                outerRadius={95}
                label
              >
                {toArray(estadisticas.porOrigen).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h3 className="font-semibold mb-4">Modelo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={toArray(estadisticas.porModelo)}
                dataKey="value"
                nameKey="name"
                outerRadius={95}
                label
              >
                {toArray(estadisticas.porModelo).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="font-semibold mb-4">Modelo</h3>
        {toArray(estadisticas.porModelo).map((m) => (
          <div key={m.name} className="mb-2">
            <div className="flex justify-between text-sm">
              <span>{m.name}</span>
              <span>{m.value}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded">
              <div
                className="h-2 bg-blue-500 rounded"
                style={{ width: `${m.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
