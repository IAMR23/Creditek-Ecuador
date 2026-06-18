import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { Eye, FileText, Trash } from "lucide-react";
import Swal from "sweetalert2";

const STORAGE_KEY = "ventas_auditoria_filtros";

const TABLE_COLUMNS = [
  "Fecha",
  "Cedula",
  "Cliente",
  "Agencia",
  "Vendedor",
  "Origen",
  "Dispositivo",
  "Modelo",
  "Identificador UPH",
  "Precio Venta",
  "Precio Vendedor",
  "Diferencia",
  "Precio Unitario",
  "Forma Pago",
  "Entrada",
  "Alcance",
  "Estado",
  "Observacion",
];

const obtenerFiltrosGuardados = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (error) {
    console.error("Error leyendo filtros guardados:", error);
    return {};
  }
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const toMoney = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : "";
};

const getPrecioVendedorClass = (precioVendedorValue, precioVentaValue) => {
  const precioVenta = Number(precioVentaValue);
  const precioVendedor = Number(precioVendedorValue);

  if (!Number.isFinite(precioVenta) || !Number.isFinite(precioVendedor)) {
    return "";
  }

  if (precioVendedor > precioVenta) return " text-green-600 font-bold";
  if (precioVendedor < precioVenta) return " text-red-600 font-bold";
  return " text-gray-700 font-semibold";
};

const getEstadoBadge = (estado) =>
  estado === "Activo"
    ? "bg-green-100 text-green-700 border-green-200"
    : "bg-red-100 text-red-700 border-red-200";

const escaparHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const obtenerNombreSeleccionado = (items, id) =>
  items.find((item) => String(item.id) === String(id))?.nombre || "Todos";

export default function VentasAuditoria() {
  const filtrosGuardados = obtenerFiltrosGuardados();
  const hoyLocal = new Date().toLocaleDateString("en-CA");

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(
    filtrosGuardados.fechaInicio || hoyLocal,
  );
  const [fechaFin, setFechaFin] = useState(filtrosGuardados.fechaFin || hoyLocal);
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState(filtrosGuardados.agenciaId || "");
  const [usuarios, setUsuarios] = useState([]);
  const [vendedorId, setVendedorId] = useState(
    filtrosGuardados.vendedorId || "",
  );
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState(filtrosGuardados.modeloId || "");
  const [origenes, setOrigenes] = useState([]);
  const [origenId, setOrigenId] = useState(filtrosGuardados.origenId || "");
  const [dispositivos, setDispositivos] = useState([]);
  const [dispositivoId, setDispositivoId] = useState(
    filtrosGuardados.dispositivoId || "",
  );
  const [cierreCaja, setCierreCaja] = useState(
    filtrosGuardados.cierreCaja || "",
  );
  const [estado, setEstado] = useState(filtrosGuardados.estado || "");

  const resumen = useMemo(() => {
    const totalVenta = filas.reduce(
      (acc, fila) => acc + toNumber(fila["Precio Vendedor"]),
      0,
    );
    const diferencias = filas.reduce(
      (acc, fila) => acc + toNumber(fila.Diferencia),
      0,
    );
    const activas = filas.filter((fila) => fila.Estado === "Activo").length;

    return {
      registros: filas.length,
      activas,
      desactivadas: filas.length - activas,
      totalVenta: Number(totalVenta.toFixed(2)),
      diferencias: Number(diferencias.toFixed(2)),
    };
  }, [filas]);

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
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las agencias.",
      });
      setAgencias([]);
    }
  };

  const cargarCatalogosFiltros = async () => {
    try {
      const [modelosRes, origenesRes, dispositivosRes] = await Promise.all([
        axios.get(`${API_URL}/modelos`),
        axios.get(`${API_URL}/origen`),
        axios.get(`${API_URL}/dispositivos`),
      ]);

      setModelos(modelosRes.data || []);
      setOrigenes(origenesRes.data || []);
      setDispositivos(dispositivosRes.data || []);
    } catch (error) {
      console.error("Error cargando catalogos de filtros:", error);
      setModelos([]);
      setOrigenes([]);
      setDispositivos([]);
    }
  };

  useEffect(() => {
    cargarAgencias();
    cargarUsuarios();
    cargarCatalogosFiltros();
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
        origenId,
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
    origenId,
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
      const params = new URLSearchParams({
        fechaInicio,
        fechaFin,
      });

      if (agenciaId && agenciaId !== "todas") params.append("agenciaId", agenciaId);
      if (vendedorId && vendedorId !== "todos") params.append("vendedorId", vendedorId);
      if (modeloId && modeloId !== "todos") params.append("modeloId", modeloId);
      if (cierreCaja && cierreCaja !== "todos") params.append("cierreCaja", cierreCaja);
      if (origenId && origenId !== "todos") params.append("origenId", origenId);
      if (dispositivoId && dispositivoId !== "todos") {
        params.append("dispositivoId", dispositivoId);
      }
      if (estado && estado !== "todos") params.append("estado", estado);

      const url = `${API_URL}/auditoria/ventas?${params.toString()}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      const ventas = data.ventas || [];
      const resultado = ventas.map((venta) => {
        const precioVenta = toMoney(venta.precioVenta);
        const precioVendedor = toMoney(venta.precioVendedor);
        const diferencia =
          precioVenta !== "" || precioVendedor !== ""
            ? Number((toNumber(precioVenta) - toNumber(precioVendedor)).toFixed(2))
            : "";

        return {
          id: venta.id,
          Fecha: venta.fecha ?? "",
          Cedula: venta.cedula ?? "",
          Cliente: venta.nombre ?? "",
          Agencia: venta.local ?? "",
          Vendedor: venta.vendedor ?? "",
          Origen: venta.origen ?? "",
          Observacion: venta.observaciones ?? "",
          Dispositivo: `${venta.tipo ?? ""}`.toUpperCase(),
          Modelo: `${venta.marca ?? ""} ${venta.modelo ?? ""}`.toUpperCase(),
          "Identificador UPH": venta.identificadorUph ?? "",
          "Precio Venta": precioVenta,
          "Precio Vendedor": precioVendedor,
          Diferencia: diferencia,
          "Precio Unitario":
            venta.precioVendedor != null
              ? Number((venta.precioVendedor / 1.15).toFixed(2))
              : "",
          "Forma Pago": venta.formaPago ?? "",
          Entrada: venta.entrada ?? "",
          Alcance: venta.alcance ?? "",
          Estado: venta.activo ? "Activo" : "Desactivada",
        };
      });

      setFilas(resultado);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchData();
    }
  }, [
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    modeloId,
    cierreCaja,
    origenId,
    dispositivoId,
    estado,
    usuarioInfo,
  ]);

  const generarReportePdf = () => {
    if (!filas.length) {
      Swal.fire({
        icon: "info",
        title: "Sin datos",
        text: "No hay ventas para generar el reporte.",
      });
      return;
    }

    const filtros = [
      ["Fecha inicio", fechaInicio || "Todas"],
      ["Fecha fin", fechaFin || "Todas"],
      ["Agencia", obtenerNombreSeleccionado(agencias, agenciaId)],
      ["Vendedor", obtenerNombreSeleccionado(usuarios, vendedorId)],
      ["Modelo", obtenerNombreSeleccionado(modelos, modeloId)],
      ["Cierre de caja", cierreCaja || "Todos"],
      ["Origen", obtenerNombreSeleccionado(origenes, origenId)],
      ["Dispositivo", obtenerNombreSeleccionado(dispositivos, dispositivoId)],
      [
        "Estado",
        estado === "activo"
          ? "Activo"
          : estado === "desactivada"
            ? "Desactivada"
            : "Todos",
      ],
    ];

    const filasHtml = filas
      .map(
        (fila, index) => `
          <tr>
            <td>${index + 1}</td>
            ${TABLE_COLUMNS.map((columna) => `<td>${escaparHtml(fila[columna] ?? "")}</td>`).join("")}
          </tr>
        `,
      )
      .join("");

    const filtrosHtml = filtros
      .map(
        ([label, value]) =>
          `<div><strong>${escaparHtml(label)}:</strong> ${escaparHtml(value)}</div>`,
      )
      .join("");

    const ventana = window.open("", "_blank");
    if (!ventana) {
      Swal.fire({
        icon: "error",
        title: "Ventana bloqueada",
        text: "Permite ventanas emergentes para generar el PDF.",
      });
      return;
    }

    ventana.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Reporte Ventas Auditoria</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
            h1 { font-size: 18px; margin: 0 0 6px; }
            .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; font-size: 10px; margin: 10px 0 12px; }
            .summary { font-size: 11px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 8px; }
            th { background: #1f2937; color: white; }
            th, td { border: 1px solid #d1d5db; padding: 4px; text-align: left; vertical-align: top; }
            tr:nth-child(even) td { background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>Reporte Ventas Auditoria</h1>
          <div class="summary">Total de registros: ${filas.length}</div>
          <div class="meta">${filtrosHtml}</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                ${TABLE_COLUMNS.map((columna) => `<th>${escaparHtml(columna)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${filasHtml}</tbody>
          </table>
          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    ventana.document.close();
  };

  const desactivarVenta = async (id) => {
    const confirm = await Swal.fire({
      title: "Desactivar venta?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, desactivar",
    });

    if (!confirm.isConfirmed) return;

    try {
      await axios.put(`${API_URL}/ventas/${id}`, {
        activo: false,
      });

      setFilas((prev) =>
        prev.map((fila) =>
          fila.id === id ? { ...fila, Estado: "Desactivada" } : fila,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const renderCell = (fila, key) => {
    const val = fila[key];

    if (key === "Modelo") {
      return (
        <div className="min-w-44">
          <div className="font-semibold text-gray-900">{val || "-"}</div>
          <div className="text-xs text-gray-500">
            UPH: {fila["Identificador UPH"] || "-"}
          </div>
        </div>
      );
    }

    if (key === "Identificador UPH") {
      return (
        <span className="inline-flex rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
          {val || "-"}
        </span>
      );
    }

    if (key === "Estado") {
      return (
        <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getEstadoBadge(val)}`}>
          {val}
        </span>
      );
    }

    return val || "-";
  };

  const getCellClass = (fila, key) => {
    let clase = "px-3 py-2 align-top text-gray-700";

    if (key === "Precio Venta") {
      clase += " text-right font-semibold text-blue-700";
    }

    if (key === "Precio Vendedor") {
      clase += `${getPrecioVendedorClass(fila[key], fila["Precio Venta"])} text-right`;
    }

    if (key === "Diferencia") {
      const diferencia = Number(fila[key]) || 0;
      clase += " text-right";
      if (diferencia !== 0) {
        clase += diferencia > 0 ? " text-red-600 font-bold" : " text-green-600 font-semibold";
      } else {
        clase += " text-gray-600 font-semibold";
      }
    }

    if (["Precio Unitario", "Entrada", "Alcance"].includes(key)) {
      clase += " text-right tabular-nums";
    }

    if (key === "Observacion") {
      clase += " max-w-64 whitespace-normal";
    } else {
      clase += " whitespace-nowrap";
    }

    return clase;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas Auditoria</h1>
          <p className="text-sm text-gray-600">
            Revision de ventas con precios, diferencias y referencia UPH por modelo.
          </p>
        </div>

        <button
          type="button"
          onClick={generarReportePdf}
          className="inline-flex items-center justify-center gap-2 rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          <FileText size={18} />
          PDF
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Registros" value={resumen.registros} />
        <Metric label="Activas" value={resumen.activas} tone="green" />
        <Metric label="Desactivadas" value={resumen.desactivadas} tone="red" />
        <Metric label="Total Venta" value={`$${resumen.totalVenta.toFixed(2)}`} tone="blue" />
        <Metric label="Diferencia" value={`$${resumen.diferencias.toFixed(2)}`} tone="slate" />
      </div>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900">Filtros</h2>
          <span className="text-xs text-gray-500">
            Los cambios se guardan para tu proxima consulta
          </span>
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
          />

          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Modelo</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={modeloId}
              onChange={(e) => setModeloId(e.target.value)}
            >
              <option value="">Todos</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.dispositivoMarca?.marca?.nombre
                    ? `${m.dispositivoMarca.marca.nombre} ${m.nombre}`
                    : m.nombre}
                  {m.identificadorUph ? ` - UPH ${m.identificadorUph}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700">Cierre de caja</span>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={cierreCaja}
              onChange={(e) => setCierreCaja(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="CONTADO">Contado</option>
              <option value="CREDITV">CrediTV</option>
              <option value="UPHONE">Uphone</option>
            </select>
          </label>

          <FiltroSelect
            label="Origen"
            value={origenId}
            onChange={setOrigenId}
            options={origenes}
            emptyLabel="Todos"
          />

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
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="desactivada">Desactivada</option>
            </select>
          </label>
        </div>
      </section>

      {error && <p className="mb-3 font-semibold text-red-500">{error}</p>}

      {loading ? (
        <div className="rounded border border-gray-200 bg-white p-8 text-center text-gray-500">
          Cargando ventas...
        </div>
      ) : (
        <section className="max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Resultados</h2>
              <span className="text-xs text-gray-500">
                {filas.length} ventas encontradas
              </span>
            </div>
          </div>

          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1720px] border-collapse text-xs">
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
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.id ?? i} className="border-b border-gray-100 hover:bg-blue-50/40">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-center font-semibold text-gray-700">
                      {i + 1}
                    </td>

                    {TABLE_COLUMNS.map((key) => (
                      <td key={key} className={getCellClass(f, key)}>
                        {renderCell(f, key)}
                      </td>
                    ))}

                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to={`/ventas-auditoria/${f.id}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                          title="Ver detalle"
                        >
                          <Eye size={17} />
                        </Link>

                        <button
                          type="button"
                          onClick={() => desactivarVenta(f.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                          title="Desactivar venta"
                        >
                          <Trash size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filas.length === 0 && (
                  <tr>
                    <td
                      colSpan={TABLE_COLUMNS.length + 2}
                      className="px-3 py-10 text-center text-gray-500"
                    >
                      No hay ventas para los filtros seleccionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
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
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FiltroSelect({ label, value, onChange, options, emptyLabel }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      <select
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

function Metric({ label, value, tone = "gray" }) {
  const tones = {
    gray: "border-gray-200 bg-white text-gray-900",
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
  };

  return (
    <div className={`rounded-lg border p-3 shadow-sm ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
