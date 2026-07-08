import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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
  "#0f766e",
  "#9333ea",
];

const toArray = (obj = {}) =>
  Object.entries(obj)
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value);

const ESTADOS_ENTREGA = [
  { key: "entregado", label: "Entregado", color: "#16a34a" },
  { key: "pendiente", label: "Pendiente", color: "#f59e0b" },
  { key: "noEntregado", label: "No entregado", color: "#dc2626" },
  { key: "transito", label: "Transito", color: "#64748b" },
];

const toEntregasPorVendedorEstados = (rows = []) =>
  Array.isArray(rows)
    ? rows
        .map((row) => ({
          name: row.vendedor || "Sin vendedor",
          total: Number(row.total) || 0,
          entregado: Number(row.entregado) || 0,
          pendiente: Number(row.pendiente) || 0,
          noEntregado: Number(row.noEntregado) || 0,
          transito: Number(row.transito ?? row.otros) || 0,
        }))
        .sort((a, b) => b.total - a.total)
    : [];

const tooltipStyle = {
  contentStyle: {
    borderRadius: "10px",
    border: "none",
    boxShadow: "0 6px 16px rgba(15,23,42,0.15)",
  },
};

export default function DashboardGraficas({ estadisticas }) {
  if (!estadisticas) return null;

  const entregasPorVendedorEstados = toEntregasPorVendedorEstados(
    estadisticas.entregasPorVendedorEstados,
  );
  const entregasPorVendedorChart = entregasPorVendedorEstados.length
    ? entregasPorVendedorEstados
    : toArray(estadisticas.entregasPorVendedor).map((item) => ({
        name: item.name,
        total: item.value,
        entregado: 0,
        pendiente: 0,
        noEntregado: 0,
        transito: item.value,
      }));
  const totalEntregas =
    entregasPorVendedorChart.reduce((acc, item) => acc + item.total, 0) ||
    toArray(estadisticas.entregasPorVendedor).reduce(
      (acc, item) => acc + item.value,
      0,
    );

  const cards = [
    {
      title: "Ventas por Agencia",
      type: "bar",
      data: toArray(estadisticas.porAgencia),
      color: COLORS[0],
      showXAxis: true,
    },
    {
      title: "Ventas por Vendedor",
      type: "bar",
      data: toArray(estadisticas.porVendedor),
      color: COLORS[1],
    },
    {
      title: "Entregas subidas por Vendedor",
      type: "stacked-bar",
      data: entregasPorVendedorChart,
      showXAxis: true,
    },
    {
      title: "Ventas por Dia",
      type: "line",
      data: toArray(estadisticas.porDia),
      color: COLORS[2],
      showXAxis: true,
    },
    {
      title: "Tipo de Producto",
      type: "pie",
      data: toArray(estadisticas.porTipo),
    },
    {
      title: "Ventas por Marca",
      type: "bar",
      data: toArray(estadisticas.porMarca),
      color: COLORS[3],
    },
    {
      title: "Origen",
      type: "pie",
      data: toArray(estadisticas.porOrigen),
    },
    {
      title: "Modelo",
      type: "bar",
      data: toArray(estadisticas.porModelo),
      color: COLORS[5],
    },
    {
      title: "Cierre de Caja",
      type: "pie",
      data: toArray(estadisticas.porCierreCaja),
    },
  ];

  return (
    <section className="mt-6 space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total ventas" value={estadisticas.totalVentas || 0} />
        <KpiCard
          label="Total entregas"
          value={totalEntregas}
        />
        <KpiCard
          label="Agencias con ventas"
          value={toArray(estadisticas.porAgencia).length}
        />
        <KpiCard
          label="Vendedores con ventas"
          value={toArray(estadisticas.porVendedor).length}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {cards.map((card) => (
          <ChartCard key={card.title} title={card.title}>
            <ChartRenderer {...card} />
          </ChartCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RankingCard
          title="Dispositivos mas vendidos"
          data={toArray(estadisticas.porTipo)}
          color={COLORS[0]}
        />
        <RankingCard
          title="Modelos mas vendidos"
          data={toArray(estadisticas.porModelo)}
          color={COLORS[5]}
        />
      </div>
    </section>
  );
}

function KpiCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="h-[320px] min-w-0">{children}</div>
    </div>
  );
}

function ChartRenderer({ type, data, color = COLORS[0], showXAxis = false }) {
  if (!data.length) {
    return <EmptyState />;
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={105}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 18, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" hide={!showXAxis} tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip {...tooltipStyle} />
          <Line
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "stacked-bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 18, left: -10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" hide={!showXAxis} tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip {...tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) =>
              ESTADOS_ENTREGA.find((estado) => estado.key === value)?.label || value
            }
          />
          {ESTADOS_ENTREGA.map((estado) => (
            <Bar
              key={estado.key}
              dataKey={estado.key}
              stackId="entregas"
              fill={estado.color}
              name={estado.label}
              radius={estado.key === "transito" ? [6, 6, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 18, left: -10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" hide={!showXAxis} tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
      Sin datos para mostrar
    </div>
  );
}

function RankingCard({ title, data, color }) {
  const max = data[0]?.value || 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-slate-900">{title}</h3>

      {data.length ? (
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-slate-800">
                    {item.name}
                  </span>
                </div>
                <span className="shrink-0 font-bold text-slate-900">
                  {item.value}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${max ? (item.value / max) * 100 : 0}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
          Sin datos para mostrar
        </div>
      )}
    </div>
  );
}
