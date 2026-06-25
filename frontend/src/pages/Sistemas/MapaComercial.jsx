import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  Crosshair,
  Flame,
  MapPin,
  MapPinned,
  MousePointer2,
  RefreshCw,
  Search,
} from "lucide-react";
import { API_URL } from "../../../config";

const getHoyLocal = () => new Date().toLocaleDateString("en-CA");

const sumarDias = (fecha, dias) => {
  const date = new Date(`${fecha}T00:00:00`);
  date.setDate(date.getDate() + dias);
  return date.toLocaleDateString("en-CA");
};

const DEFAULT_FILTROS = {
  fechaInicio: sumarDias(getHoyLocal(), -30),
  fechaFin: getHoyLocal(),
  agenciaId: "",
  vendedorId: "",
  marcaId: "",
  modeloId: "",
  zona: "",
};

const numberFormatter = new Intl.NumberFormat("es-EC");

function MapBounds({ puntos }) {
  const map = useMap();

  useEffect(() => {
    const coordenadasPuntos = (puntos || [])
      .filter((punto) => Number.isFinite(Number(punto.latitud)) && Number.isFinite(Number(punto.longitud)))
      .map((punto) => [Number(punto.latitud), Number(punto.longitud)]);

    if (!coordenadasPuntos.length) {
      map.setView([-1.8312, -78.1834], 7);
      return;
    }

    map.fitBounds(coordenadasPuntos, { padding: [48, 48], maxZoom: 15 });
  }, [map, puntos]);

  return null;
}

function ManualPointPicker({ selected, onPick }) {
  useMapEvents({
    click(event) {
      if (!selected) return;
      onPick(event.latlng);
    },
  });

  return null;
}

export default function MapaComercial() {
  const [filtros, setFiltros] = useState(DEFAULT_FILTROS);
  const [data, setData] = useState(null);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [pendientesUbicacion, setPendientesUbicacion] = useState([]);
  const [ubicacionManual, setUbicacionManual] = useState(null);
  const [vistaMapa, setVistaMapa] = useState("puntos");
  const [catalogos, setCatalogos] = useState({
    agencias: [],
    marcas: [],
    modelos: [],
    zonas: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [normalizando, setNormalizando] = useState(false);

  const params = useMemo(() => {
    const search = new URLSearchParams();
    Object.entries(filtros).forEach(([key, value]) => {
      if (value) search.append(key, value);
    });
    return search;
  }, [filtros]);

  const maxVentasPunto = Math.max(
    0,
    ...puntosVenta.map((punto) => Number(punto.cantidadTotal) || 0),
  );
  const mapCenter = puntosVenta[0]
    ? [Number(puntosVenta[0].latitud), Number(puntosVenta[0].longitud)]
    : [-1.8312, -78.1834];

  const cargarCatalogos = async () => {
    try {
      const { data: response } = await axios.get(
        `${API_URL}/api/sistemas/mapa-comercial/filtros`,
      );
      if (response.ok) setCatalogos(response.filtros);
    } catch (error) {
      console.error("Error cargando filtros mapa comercial:", error);
    }
  };

  const cargarMapa = async () => {
    if (filtros.fechaInicio && filtros.fechaFin && filtros.fechaInicio > filtros.fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [dashboardResponse, puntosResponse, pendientesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/sistemas/mapa-comercial?${params.toString()}`),
        axios.get(`${API_URL}/api/sistemas/mapa-comercial/puntos?${params.toString()}`),
        axios.get(`${API_URL}/api/sistemas/mapa-comercial/ubicaciones-pendientes?${params.toString()}`),
      ]);
      const response = dashboardResponse.data;

      if (!response.ok) {
        setError("No se pudo cargar el mapa comercial");
        return;
      }

      setData(response);
      setPuntosVenta(
        Array.isArray(puntosResponse.data)
          ? puntosResponse.data
          : puntosResponse.data?.puntos || [],
      );
      setPendientesUbicacion(
        (pendientesResponse.data?.pendientes || []).filter((item) => item.id && item.entidadId),
      );
      setUbicacionManual(null);
    } catch (error) {
      console.error("Error cargando mapa comercial:", error);
      setError(error.response?.data?.message || "No se pudo cargar el mapa comercial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarMapa();
  }, [params]);

  const actualizarFiltro = (key, value) => {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  };

  const normalizarPendientes = async () => {
    setNormalizando(true);
    setError("");

    try {
      const { data: response } = await axios.post(
        `${API_URL}/api/sistemas/mapa-comercial/normalizar`,
        { limit: 100 },
      );

      if (!response.ok) {
        setError(response.message || "No se pudieron normalizar las ubicaciones");
        return;
      }

      await cargarMapa();
    } catch (error) {
      console.error("Error normalizando ubicaciones:", error);
      setError(error.response?.data?.message || "No se pudieron normalizar las ubicaciones");
    } finally {
      setNormalizando(false);
    }
  };

  const guardarUbicacionManual = async ({ lat, lng }) => {
    if (!ubicacionManual) return;

    try {
      await axios.patch(
        `${API_URL}/api/sistemas/mapa-comercial/ubicaciones/${ubicacionManual.id}`,
        {
          latitud: lat,
          longitud: lng,
          zona: ubicacionManual.ubicacionOriginal,
        },
      );
      await cargarMapa();
    } catch (error) {
      console.error("Error guardando ubicacion manual:", error);
      setError(error.response?.data?.message || "No se pudo guardar la ubicacion manual");
    }
  };

  const resumen = data?.resumen || {};

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-6">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mapa Comercial</h1>
          <p className="text-sm text-slate-500">
            Analisis agregado por zonas de cobertura, sin datos personales ni ubicaciones individuales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={normalizarPendientes}
            disabled={normalizando}
            className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <MapPin size={16} />
            {normalizando ? "Normalizando..." : "Normalizar pendientes"}
          </button>
          <button
            type="button"
            onClick={cargarMapa}
            className="inline-flex items-center justify-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-1 gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-7">
        <FilterDate label="Fecha Inicio" value={filtros.fechaInicio} onChange={(value) => actualizarFiltro("fechaInicio", value)} />
        <FilterDate label="Fecha Fin" value={filtros.fechaFin} onChange={(value) => actualizarFiltro("fechaFin", value)} />
        <FilterSelect label="Agencia" value={filtros.agenciaId} onChange={(value) => actualizarFiltro("agenciaId", value)} options={catalogos.agencias} emptyLabel="Todas" />
        <FilterSelect label="Marca" value={filtros.marcaId} onChange={(value) => actualizarFiltro("marcaId", value)} options={catalogos.marcas} emptyLabel="Todas" />
        <FilterSelect
          label="Modelo"
          value={filtros.modeloId}
          onChange={(value) => actualizarFiltro("modeloId", value)}
          options={catalogos.modelos.filter(
            (modelo) => !filtros.marcaId || String(modelo.marcaId) === String(filtros.marcaId),
          )}
          emptyLabel="Todos"
        />
        <FilterSelect label="Zona" value={filtros.zona} onChange={(value) => actualizarFiltro("zona", value)} options={catalogos.zonas.map((zona) => ({ id: zona.nombre, nombre: zona.nombre }))} emptyLabel="Todas" />
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
            Busqueda zona
          </span>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filtros.zona}
              onChange={(event) => actualizarFiltro("zona", event.target.value)}
              className="h-10 w-full rounded border border-slate-300 bg-white pl-8 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              placeholder="Sector"
            />
          </div>
        </label>
      </section>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-8">
        <Metric label="Dispositivos vendidos" value={resumen.totalDispositivos} />
        <Metric label="Puntos con coordenadas" value={puntosVenta.length} tone="red" />
        <Metric label="Modelos vendidos" value={resumen.modelosDiferentes} />
        <Metric label="Mas vendido" value={resumen.dispositivoMasVendido ? `${resumen.dispositivoMasVendido.marca} ${resumen.dispositivoMasVendido.modelo}` : "-"} />
        <Metric label="Zona top" value={resumen.zonaConMasVentas?.zona || "-"} />
        <Metric label="Zonas con ventas" value={resumen.zonasConVentas} />
        <Metric label="Zonas sin ventas" value={resumen.zonasSinVentas} tone="amber" />
        <Metric label="Cobertura" value={`${Number(resumen.coberturaComercial || 0).toFixed(2)}%`} tone="green" />
      </section>

      <section className="mb-5">
        <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold uppercase text-slate-700">Mapa de ventas</h2>
              <p className="text-xs text-slate-500">
                Puntos rojos anonimos calculados solo desde detalle_entregas.ubicacion.
              </p>
            </div>
            <MapPinned className="text-emerald-700" size={20} />
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
            <MapModeButton
              active={vistaMapa === "puntos"}
              icon={<MapPin size={15} />}
              label="Puntos de ventas"
              onClick={() => setVistaMapa("puntos")}
            />
            <MapModeButton
              active={vistaMapa === "calor"}
              icon={<Flame size={15} />}
              label="Mapa de calor"
              onClick={() => setVistaMapa("calor")}
            />
          </div>
          <div className="h-[620px]">
            <MapContainer center={mapCenter} zoom={11} className="h-full w-full" scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBounds puntos={puntosVenta} />
              <ManualPointPicker selected={ubicacionManual} onPick={guardarUbicacionManual} />
              {(vistaMapa === "puntos" || vistaMapa === "calor") && puntosVenta.map((punto) => {
                const cantidad = Number(punto.cantidadTotal) || 0;
                const radius = vistaMapa === "calor"
                  ? Math.max(28, Math.min(76, 28 + (cantidad / Math.max(1, maxVentasPunto)) * 48))
                  : Math.max(12, Math.min(32, 12 + (cantidad / Math.max(1, maxVentasPunto)) * 20));

                return (
                  <CircleMarker
                    key={`${punto.latitud}-${punto.longitud}-${punto.cantidadTotal}`}
                    center={[Number(punto.latitud), Number(punto.longitud)]}
                    radius={radius}
                    pathOptions={{
                      color: "#dc2626",
                      fillColor: "#ef4444",
                      fillOpacity: vistaMapa === "calor" ? 0.32 : 0.82,
                      weight: vistaMapa === "calor" ? 1 : 3,
                    }}
                  >
                    <Popup>
                      <div className="min-w-56 text-sm">
                        <p><strong>Fecha:</strong> {punto.fecha || "-"}</p>
                        <p><strong>Agencia:</strong> {punto.agencia || "-"}</p>
                        <p><strong>Zona:</strong> {punto.zona || "-"}</p>
                        <p><strong>Cantidad:</strong> {numberFormatter.format(punto.cantidadTotal || 0)}</p>
                        <div className="mt-2 border-t border-slate-200 pt-2">
                          {(punto.dispositivos || []).map((item) => (
                            <p key={`${item.marca}-${item.modelo}`}>
                              {item.marca} {item.modelo}: {numberFormatter.format(item.cantidad)}
                            </p>
                          ))}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <RankingDispositivos rows={data?.rankings?.dispositivos || []} />
        <RankingZonas rows={data?.rankings?.zonas || []} />
        <ZonasSinVentas rows={data?.zonasSinVentas || []} />
      </section>

      <section className="mt-5 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Crosshair size={18} className="text-amber-600" />
            <h2 className="text-sm font-bold uppercase text-slate-700">
              Ubicaciones pendientes
            </h2>
          </div>
          {ubicacionManual && (
            <div className="inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              <MousePointer2 size={14} />
              Haz clic en el mapa para ubicar: {ubicacionManual.ubicacionOriginal || `Venta ${ubicacionManual.entidadId}`}
            </div>
          )}
        </div>
        <p className="text-sm text-slate-600">
          {numberFormatter.format(pendientesUbicacion.length)} registros requieren normalizacion de detalle_entregas.ubicacion.
        </p>
        <div className="mt-3 max-h-72 overflow-auto rounded border border-slate-200">
          {pendientesUbicacion.length ? (
            pendientesUbicacion.slice(0, 50).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setUbicacionManual(item)}
                className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-amber-50 ${
                  ubicacionManual?.id === item.id ? "bg-amber-50 text-amber-800" : ""
                }`}
              >
                <span className="min-w-0">
                  <strong className="block truncate">
                    {item.ubicacionOriginal || `Venta ${item.entidadId}`}
                  </strong>
                  <span className="text-xs text-slate-500">
                    {item.tipoUbicacion || "-"} · {item.estadoGeocodificacion || "-"}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold uppercase">Corregir</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-slate-500">
              No hay ubicaciones ambiguas o con error para corregir manualmente.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function MapModeButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-xs font-bold uppercase ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterDate({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function FilterSelect({ label, value, onChange, options, emptyLabel }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className={`rounded border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase opacity-70">{label}</p>
      <p className="mt-2 truncate text-2xl font-black">{value ?? 0}</p>
    </div>
  );
}

function ZonaDetalle({ zona, loading }) {
  if (loading) {
    return (
      <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
        Cargando detalle...
      </div>
    );
  }

  if (!zona) {
    return (
      <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-sm">
        Selecciona una zona del mapa o ranking para ver el detalle agregado.
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">Zona</p>
      <h2 className="text-2xl font-black">{zona.zona}</h2>
      <p className="mt-1 text-sm text-slate-500">{zona.agencia}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="Vendidos" value={zona.totalDispositivos} />
        <Metric
          label="Top modelo"
          value={
            zona.modeloMasVendido
              ? `${zona.modeloMasVendido.marca} ${zona.modeloMasVendido.modelo}`
              : "-"
          }
        />
      </div>

      <h3 className="mt-5 text-sm font-bold uppercase text-slate-700">Marca y modelo</h3>
      <div className="mt-2 max-h-56 overflow-y-auto rounded border border-slate-200">
        {(zona.modelos || []).map((modelo) => (
          <div key={`${modelo.marca}-${modelo.modelo}`} className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-sm">
            <span className="font-semibold">{modelo.marca} {modelo.modelo}</span>
            <span>{modelo.cantidad} · {modelo.porcentaje}%</span>
          </div>
        ))}
      </div>

      <h3 className="mt-5 text-sm font-bold uppercase text-slate-700">Agencias y vendedores</h3>
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        <MiniList title="Agencias" rows={zona.agencias || []} />
        <MiniList title="Vendedores" rows={zona.vendedores || []} />
      </div>
    </div>
  );
}

function MiniList({ title, rows }) {
  return (
    <div className="rounded border border-slate-200">
      <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase text-slate-500">
        {title}
      </p>
      {rows.length ? (
        rows.map((row) => (
          <div key={row.nombre} className="flex justify-between px-3 py-2 text-sm">
            <span>{row.nombre}</span>
            <strong>{row.cantidad}</strong>
          </div>
        ))
      ) : (
        <p className="px-3 py-3 text-sm text-slate-500">Sin datos</p>
      )}
    </div>
  );
}

function RankingDispositivos({ rows }) {
  return (
    <TableCard title="Dispositivos mas vendidos">
      {rows.map((row) => (
        <tr key={`${row.marca}-${row.modelo}`}>
          <td>{row.posicion}</td>
          <td>{row.marca}</td>
          <td>{row.modelo}</td>
          <td className="text-right">{row.cantidad}</td>
          <td className="text-right">{row.porcentaje}%</td>
          <td className="text-right">{row.zonas}</td>
        </tr>
      ))}
    </TableCard>
  );
}

function RankingZonas({ rows }) {
  return (
    <TableCard title="Zonas con mas ventas">
      {rows.map((row) => (
        <tr
          key={`${row.agencia}-${row.zona}`}
        >
          <td>{row.posicion}</td>
          <td>{row.zona}</td>
          <td className="text-right">{row.cantidad}</td>
          <td>{row.modeloMasVendido ? `${row.modeloMasVendido.marca} ${row.modeloMasVendido.modelo}` : "-"}</td>
          <td>{row.agencia}</td>
          <td className="text-right">{row.porcentaje}%</td>
        </tr>
      ))}
    </TableCard>
  );
}

function ZonasSinVentas({ rows }) {
  return (
    <TableCard title="Zonas sin ventas">
      {rows.map((row) => (
        <tr
          key={`${row.agencia}-${row.zona}`}
        >
          <td>{row.zona}</td>
          <td>{row.agencia}</td>
          <td>{row.ultimaVenta || "-"}</td>
          <td className="text-right">{row.diasSinVentas ?? "-"}</td>
        </tr>
      ))}
    </TableCard>
  );
}

function TableCard({ title, children }) {
  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-bold uppercase text-slate-700">
        {title}
      </h2>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-xs">
          <tbody className="[&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-2">
            {children?.length ? children : (
              <tr>
                <td className="text-slate-500">Sin datos para el periodo seleccionado</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
