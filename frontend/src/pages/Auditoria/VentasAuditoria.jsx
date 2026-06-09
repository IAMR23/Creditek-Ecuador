import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { Link } from "react-router-dom"; // para navegar a otro componente
import { jwtDecode } from "jwt-decode";
import { Eye, FileText, Trash } from "lucide-react";
import Swal from "sweetalert2";

const STORAGE_KEY = "ventas_auditoria_filtros";

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

  if (precioVendedor > precioVenta) {
    return " text-green-600 font-bold";
  }

  if (precioVendedor < precioVenta) {
    return " text-red-600 font-bold";
  }

  return " text-gray-700 font-semibold";
};

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

      if (agenciaId && agenciaId !== "todas") {
        params.append("agenciaId", agenciaId);
      }

      if (vendedorId && vendedorId !== "todos") {
        params.append("vendedorId", vendedorId);
      }

      if (modeloId && modeloId !== "todos") {
        params.append("modeloId", modeloId);
      }

      if (cierreCaja && cierreCaja !== "todos") {
        params.append("cierreCaja", cierreCaja);
      }

      if (origenId && origenId !== "todos") {
        params.append("origenId", origenId);
      }

      if (dispositivoId && dispositivoId !== "todos") {
        params.append("dispositivoId", dispositivoId);
      }

      if (estado && estado !== "todos") {
        params.append("estado", estado);
      }

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

  const escaparHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const obtenerNombreSeleccionado = (items, id) =>
    items.find((item) => String(item.id) === String(id))?.nombre || "Todos";

  const generarReportePdf = () => {
    if (!filas.length) {
      Swal.fire({
        icon: "info",
        title: "Sin datos",
        text: "No hay ventas para generar el reporte.",
      });
      return;
    }

    const columnas = Object.keys(filas[0]).filter((key) => key !== "id");
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
            ${columnas.map((columna) => `<td>${escaparHtml(fila[columna])}</td>`).join("")}
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
            th { background: #166534; color: white; }
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
                ${columnas.map((columna) => `<th>${escaparHtml(columna)}</th>`).join("")}
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
    title: "¿Desactivar venta?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, desactivar",
  });

  if (!confirm.isConfirmed) return;

  try {
    await axios.put(`${API_URL}/ventas/${id}`, {
      activo: false,
    });

    setFilas((prev) =>
      prev.map((fila) =>
        fila.id === id ? { ...fila, Estado: "Desactivada" } : fila
      )
    );

  } catch (error) {
    console.error(error);
  }
};


  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ventas Auditoria</h1>

      <div className="flex flex-wrap gap-4 mb-4 items-end">
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
          <label className="block text-sm font-medium">Modelo</label>
          <select
            className="border px-2 py-1 rounded"
            value={modeloId}
            onChange={(e) => setModeloId(e.target.value)}
          >
            <option value="">Todos</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.dispositivoMarca?.marca?.nombre
                  ? `${m.dispositivoMarca.marca.nombre} ${m.nombre}`
                  : m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Cierre de caja</label>
          <select
            className="border px-2 py-1 rounded"
            value={cierreCaja}
            onChange={(e) => setCierreCaja(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="CONTADO">Contado</option>
            <option value="CREDITV">CrediTV</option>
            <option value="UPHONE">Uphone</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Origen</label>
          <select
            className="border px-2 py-1 rounded"
            value={origenId}
            onChange={(e) => setOrigenId(e.target.value)}
          >
            <option value="">Todos</option>
            {origenes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Dispositivo</label>
          <select
            className="border px-2 py-1 rounded"
            value={dispositivoId}
            onChange={(e) => setDispositivoId(e.target.value)}
          >
            <option value="">Todos</option>
            {dispositivos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Estado</label>
          <select
            className="border px-2 py-1 rounded"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="desactivada">Desactivada</option>
          </select>
        </div>

        <button
          type="button"
          onClick={generarReportePdf}
          className="flex items-center gap-2 bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
        >
          <FileText size={18} />
          PDF
        </button>
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="min-w-[1100px] border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">#</th> 
              {Object.keys(filas[0] || {}).map((key) => (
                <th key={key} className="p-2 border">
                  {key}
                </th>
              ))}
              <th className="p-2 border">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {filas.map((f, i) => (
              <tr key={f.id ?? i}>
                <td className="p-2 border font-semibold text-center">
                  {i + 1}
                </td>

                {Object.entries(f).map(([key, val], j) => {
                  let clase = "p-2 border";

                  if (key === "Precio Sistema") {
                    clase += " text-blue-600 font-semibold";
                  }

                  if (key === "Precio Venta") {
                    clase += " text-blue-600 font-semibold";
                  }

                  if (key === "Precio Vendedor") {
                    clase += getPrecioVendedorClass(val, f["Precio Venta"]);
                  }

                  if (key === "Diferencia") {
                    const diferencia = Number(val) || 0;
                    if (diferencia !== 0) {
                      clase += diferencia > 0 ? " text-red-600 font-bold" : " text-green-600 font-semibold";
                    } else {
                      clase += " text-gray-600 font-semibold";
                    }
                  }

                  if (key === "Estado") {
                    if (val === "Activo") {
                      clase += " text-green-600 font-semibold";
                    } else {
                      clase += " text-red-600 font-bold";
                    }
                  }

                  return (
                    <td key={j} className={clase}>
                      {val}
                    </td>
                  );
                })}

                <td className="text-center">
                  <div className="flex justify-center items-center gap-1">
                    <Link
                      to={`/ventas-auditoria/${f.id}`}
                      className="text-white hover:underline font-semibold p-2 bg-green-700 rounded-xl"
                    >
                      <Eye size={18} />
                    </Link>

                    <button
                      onClick={() => desactivarVenta(f.id)}
                      className="text-white hover:underline font-semibold p-2 bg-red-700 rounded-xl"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
