import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { CheckCircle2, Eye, RefreshCw, Search, Trash, X } from "lucide-react";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import { nombreCortoUsuario } from "../../utils/nombres";

const STORAGE_KEY = "entregas_auditoria_filtros";

const getHoyLocal = () => new Date().toLocaleDateString("en-CA");

const TABLE_COLUMNS = [
  "ID Entrega",
  "Fecha",
  "Cedula",
  "Cliente",
  "Agencia",
  "Vendedor",
  "Dispositivo",
  "Modelo",
  "Precio Vendedor",
  "Forma de Pago",
  "Entrada",
  "Alcance",
  "Estado",
];

const obtenerFiltrosGuardados = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    console.error("Error leyendo filtros de entregas auditoria:", error);
    return {};
  }
};

const normalizarBusqueda = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toMoney = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : "";
};

const getModeloLabel = (modelo) =>
  modelo.dispositivoMarca?.marca?.nombre
    ? `${modelo.dispositivoMarca.marca.nombre} ${modelo.nombre}`
    : modelo.nombre;

const coincideBusquedaCliente = (fila, busqueda) => {
  const termino = normalizarBusqueda(busqueda);
  if (!termino) return true;

  return ["Cliente", "Cedula", "ID Entrega"].some((key) =>
    normalizarBusqueda(fila[key]).includes(termino),
  );
};

const mapEntregaAuditoria = (entrega) => ({
  id: entrega.id,
  detalleEntregaId: entrega.detalleEntregaId,
  activo: entrega.activo !== false,
  modeloId: entrega.modeloId ?? "",
  cierreCaja: entrega.cierreCaja ?? "",
  "ID Entrega": entrega.id ?? "",
  Fecha: entrega.fecha ?? "",
  Cedula: entrega.cedula ?? "",
  Cliente: entrega.cliente ?? "",
  Agencia: entrega.agencia ?? "",
  Vendedor: entrega.vendedor ?? "",
  Dispositivo: `${entrega.dispositivo ?? ""}`.toUpperCase(),
  Modelo: `${entrega.marca ?? ""} ${entrega.modelo ?? ""}`.toUpperCase(),
  "Precio Vendedor": toMoney(entrega.precioVendedor),
  "Forma de Pago": entrega.formaPago ?? "",
  Entrada: toMoney(entrega.entrada),
  Alcance: toMoney(entrega.alcance),
  Estado: entrega.activo === false ? "Desactivada" : entrega.estado ?? "",
});

export default function EntregasAuditoria() {
  const filtrosGuardados = obtenerFiltrosGuardados();
  const hoyLocal = getHoyLocal();

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fechaInicio, setFechaInicio] = useState(
    filtrosGuardados.fechaInicio || hoyLocal,
  );
  const [fechaFin, setFechaFin] = useState(filtrosGuardados.fechaFin || hoyLocal);
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState(filtrosGuardados.agenciaId || "");
  const [usuarios, setUsuarios] = useState([]);
  const [vendedorId, setVendedorId] = useState(
    filtrosGuardados.vendedorId || "",
  );
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState(filtrosGuardados.modeloId || "");
  const [dispositivos, setDispositivos] = useState([]);
  const [dispositivoId, setDispositivoId] = useState(
    filtrosGuardados.dispositivoId || "",
  );
  const [cierreCaja, setCierreCaja] = useState(
    filtrosGuardados.cierreCaja || "",
  );
  const [estado, setEstado] = useState(filtrosGuardados.estado || "");
  const [busquedaCliente, setBusquedaCliente] = useState("");

  const filasVisibles = useMemo(
    () => filas.filter((fila) => coincideBusquedaCliente(fila, busquedaCliente)),
    [filas, busquedaCliente],
  );

  const resumen = useMemo(() => {
    const totalPrecioVendedor = filasVisibles.reduce(
      (acc, fila) => acc + toNumber(fila["Precio Vendedor"]),
      0,
    );
    const entregadas = filasVisibles.filter(
      (fila) => normalizarBusqueda(fila.Estado) === "entregado",
    ).length;

    return {
      registros: filasVisibles.length,
      entregadas,
      otrosEstados: filasVisibles.length - entregadas,
      totalPrecioVendedor: Number(totalPrecioVendedor.toFixed(2)),
    };
  }, [filasVisibles]);

  const cargarCatalogos = async () => {
    try {
      const [agenciasRes, usuariosRes, modelosRes, dispositivosRes] =
        await Promise.all([
          axios.get(`${API_URL}/agencias`),
          axios.get(`${API_URL}/usuarios`, { params: { rol: "Vendedor" } }),
          axios.get(`${API_URL}/modelos`),
          axios.get(`${API_URL}/dispositivos`),
        ]);

      setAgencias(agenciasRes.data || []);
      setUsuarios(usuariosRes.data || []);
      setModelos(modelosRes.data || []);
      setDispositivos(dispositivosRes.data || []);
    } catch (error) {
      console.error("Error cargando catalogos entregas auditoria:", error);
      setAgencias([]);
      setUsuarios([]);
      setModelos([]);
      setDispositivos([]);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fechaInicio,
        fechaFin,
        agenciaId,
        vendedorId,
        modeloId,
        cierreCaja,
        dispositivoId,
        estado,
      }),
    );
  }, [
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    modeloId,
    cierreCaja,
    dispositivoId,
    estado,
  ]);

  const fetchData = async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams({ fechaInicio, fechaFin });

      if (agenciaId && agenciaId !== "todas") params.append("agenciaId", agenciaId);
      if (vendedorId && vendedorId !== "todos") params.append("vendedorId", vendedorId);
      if (modeloId && modeloId !== "todos") params.append("modeloId", modeloId);
      if (cierreCaja && cierreCaja !== "todos") params.append("cierreCaja", cierreCaja);
      if (dispositivoId && dispositivoId !== "todos") {
        params.append("dispositivoId", dispositivoId);
      }
      if (estado && estado !== "todos") params.append("estado", estado);

      const { data } = await axios.get(
        `${API_URL}/auditoria/entregas?${params.toString()}`,
      );

      if (!data.ok) {
        setError("No se pudieron cargar las entregas");
        return;
      }

      setFilas((data.entregas || []).map(mapEntregaAuditoria));
    } catch (error) {
      console.error("Error cargando entregas auditoria:", error);
      setError(error.response?.data?.error || "No se pudieron cargar las entregas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    modeloId,
    cierreCaja,
    dispositivoId,
    estado,
  ]);

  const limpiarFiltros = () => {
    const hoy = getHoyLocal();

    setFechaInicio(hoy);
    setFechaFin(hoy);
    setAgenciaId("");
    setVendedorId("");
    setModeloId("");
    setCierreCaja("");
    setDispositivoId("");
    setEstado("");
    setBusquedaCliente("");
  };

  const desactivarEntrega = async (id) => {
    const confirm = await Swal.fire({
      title: "Desactivar entrega?",
      text: "La entrega quedara inactiva y marcada como Eliminado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, desactivar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.patch(`${API_URL}/auditoria/entregas/${id}/desactivar`);

      setFilas((prev) =>
        prev.map((fila) =>
          fila.id === id
            ? { ...fila, activo: false, Estado: "Desactivada" }
            : fila,
        ),
      );

      Swal.fire("Listo", "Entrega desactivada correctamente.", "success");
    } catch (error) {
      console.error("Error desactivando entrega:", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo desactivar la entrega.",
        "error",
      );
    }
  };

  const activarEntrega = async (id) => {
    const confirm = await Swal.fire({
      title: "Activar entrega?",
      text: "La entrega volvera a quedar activa con estado Pendiente.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, activar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    try {
      const { data } = await axios.patch(
        `${API_URL}/auditoria/entregas/${id}/activar`,
        { estado: "Pendiente" },
      );

      const estado = data.entrega?.estado || "Pendiente";

      setFilas((prev) =>
        prev.map((fila) =>
          fila.id === id ? { ...fila, activo: true, Estado: estado } : fila,
        ),
      );

      Swal.fire("Listo", "Entrega activada correctamente.", "success");
    } catch (error) {
      console.error("Error activando entrega:", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo activar la entrega.",
        "error",
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900 md:p-6">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entregas Auditoria</h1>
          <p className="text-sm text-gray-500">
            Revisión detallada de entregas por fecha, agencia, vendedor, modelo y estado.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="inline-flex items-center justify-center gap-2 rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Registros" value={resumen.registros} />
        <Metric label="Entregadas" value={resumen.entregadas} tone="green" />
        <Metric label="Otros estados" value={resumen.otrosEstados} tone="amber" />
        <Metric
          label="Total precio vendedor"
          value={`$${resumen.totalPrecioVendedor.toFixed(2)}`}
          tone="blue"
        />
      </div>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">Filtros</h2>
          <button
            type="button"
            onClick={limpiarFiltros}
            className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <X size={14} />
            Limpiar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FiltroFecha label="Fecha Inicio" value={fechaInicio} onChange={setFechaInicio} />
          <FiltroFecha label="Fecha Fin" value={fechaFin} onChange={setFechaFin} />
          <FiltroSelect
            label="Agencia"
            value={agenciaId}
            onChange={setAgenciaId}
            options={agencias}
            emptyLabel="Todas"
          />
          <FiltroSelect
            label="Vendedor"
            value={vendedorId}
            onChange={setVendedorId}
            options={usuarios}
            emptyLabel="Todos"
            shortNames
          />
          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Modelo</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={modeloId}
              onChange={(event) => setModeloId(event.target.value)}
            >
              <option value="">Todos</option>
              {modelos.map((modelo) => (
                <option key={modelo.id} value={modelo.id}>
                  {getModeloLabel(modelo)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Cierre de caja</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={cierreCaja}
              onChange={(event) => setCierreCaja(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="CONTADO">Contado</option>
              <option value="CREDITV">CrediTV</option>
              <option value="UPHONE">Uphone</option>
            </select>
          </label>
          <FiltroSelect
            label="Dispositivo"
            value={dispositivoId}
            onChange={setDispositivoId}
            options={dispositivos}
            emptyLabel="Todos"
          />
          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Estado</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={estado}
              onChange={(event) => setEstado(event.target.value)}
            >
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Entregado">Entregado</option>
              <option value="Urgente">Urgente</option>
              <option value="Eliminado">Eliminado</option>
              <option value="desactivada">Desactivada</option>
            </select>
          </label>
        </div>
      </section>

      {error && <p className="mb-3 font-semibold text-red-500">{error}</p>}

      <section className="max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Resultados</h2>
            <span className="text-xs text-gray-500">
              {filasVisibles.length} de {filas.length} registros
            </span>
          </div>

          <label className="block text-xs font-semibold text-gray-600">
            <span className="mb-1 block">Cliente / Cedula / ID</span>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={busquedaCliente}
                onChange={(event) => setBusquedaCliente(event.target.value)}
                placeholder="Nombre, cedula o ID"
                className="w-full rounded border border-gray-300 bg-white py-1.5 pl-8 pr-8 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-72"
              />
              {busquedaCliente && (
                <button
                  type="button"
                  onClick={() => setBusquedaCliente("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-gray-400 hover:text-gray-700"
                  aria-label="Limpiar busqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </label>
        </div>

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[1500px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-gray-100 text-left uppercase text-gray-600">
              <tr>
                <th className="sticky left-0 z-20 border-b border-gray-200 bg-gray-100 px-3 py-2 text-center">
                  #
                </th>
                {TABLE_COLUMNS.map((key) => (
                  <th key={key} className="border-b border-gray-200 px-3 py-2">
                    {key}
                  </th>
                ))}
                <th className="border-b border-gray-200 px-3 py-2 text-center">
                  Acción
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={TABLE_COLUMNS.length + 2}
                    className="px-3 py-10 text-center text-gray-500"
                  >
                    Cargando entregas...
                  </td>
                </tr>
              ) : filasVisibles.length ? (
                filasVisibles.map((fila, index) => (
                  <tr
                    key={`${fila.id}-${fila.detalleEntregaId || index}`}
                    className="border-b border-gray-100 hover:bg-blue-50/40"
                  >
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-center font-semibold text-gray-700">
                      {index + 1}
                    </td>
                    {TABLE_COLUMNS.map((key) => (
                      <td key={key} className={getCellClass(key)}>
                        {renderCell(fila, key)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to={`/entregas-auditoria/${fila.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                          title="Ver detalle"
                        >
                          <Eye size={17} />
                        </Link>

                        {fila.activo ? (
                          <button
                            type="button"
                            onClick={() => desactivarEntrega(fila.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                            title="Desactivar entrega"
                          >
                            <Trash size={17} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => activarEntrega(fila.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700"
                            title="Activar entrega"
                          >
                            <CheckCircle2 size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={TABLE_COLUMNS.length + 2}
                    className="px-3 py-10 text-center text-gray-500"
                  >
                    No hay entregas para los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function renderCell(fila, key) {
  if (["Precio Vendedor", "Entrada", "Alcance"].includes(key)) {
    const value = fila[key];
    return value === "" ? "-" : `$${Number(value).toFixed(2)}`;
  }

  if (key === "Estado") {
    return <EstadoBadge estado={fila[key]} />;
  }

  return fila[key] || "-";
}

function getCellClass(key) {
  const base = "px-3 py-2 align-top";

  if (["Precio Vendedor", "Entrada", "Alcance"].includes(key)) {
    return `${base} text-right font-semibold tabular-nums`;
  }

  if (["ID Entrega", "Fecha", "Cedula"].includes(key)) {
    return `${base} whitespace-nowrap font-semibold`;
  }

  return base;
}

function EstadoBadge({ estado }) {
  const valor = normalizarBusqueda(estado);
  const classes =
    valor === "desactivada" || valor === "eliminado"
      ? "border-red-200 bg-red-50 text-red-700"
      : valor === "entregado"
      ? "border-green-200 bg-green-50 text-green-700"
      : valor === "pendiente"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : valor === "urgente"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-gray-200 bg-gray-50 text-gray-700";

  return (
    <span className={`inline-flex rounded border px-2 py-1 text-xs font-bold ${classes}`}>
      {estado || "-"}
    </span>
  );
}

function FiltroFecha({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <input
        type="date"
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FiltroSelect({ label, value, onChange, options, emptyLabel, shortNames = false }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <select
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {shortNames ? nombreCortoUsuario(option) : option.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, tone = "gray" }) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    green: "border-green-200 bg-green-50 text-green-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
