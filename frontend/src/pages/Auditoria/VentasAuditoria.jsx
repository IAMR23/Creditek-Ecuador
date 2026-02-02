import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { Link } from "react-router-dom"; // para navegar a otro componente
import { jwtDecode } from "jwt-decode";
import { Eye } from "lucide-react";

export default function VentasAuditoria() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [vendedorId, setVendedorId] = useState("");

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

      const url = `${API_URL}/auditoria/ventas?${params.toString()}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      const ventas = data.ventas || [];

      const resultado = ventas.map((venta) => ({
        id: venta.id,
        Fecha: venta.fecha ?? "",
        Cedula: venta.cedula ?? "",
        Cliente: venta.nombre ?? "",
        Agencia: venta.local ?? "",
        Vendedor: venta.vendedor ?? "",
        Origen: venta.origen ?? "",
        Observacion : venta.observaciones ?? "",  
        Dispositivo: venta.tipo ?? "",
        Marca: venta.marca ?? "",
        Modelo: venta.modelo ?? "",
        "Precio Sistema": venta.precioSistema ?? "",
        "Precio Vendedor": venta.precioVendedor ?? "",
        "Forma Pago": venta.formaPago ?? "",
        Entrada: venta.entrada ?? "",
        Alcance: venta.alcance ?? "",
        Estado: venta.activo ? "Activo" : "Desactivada",
      }));

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
  }, [fechaInicio, fechaFin, agenciaId, vendedorId]);

  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFechaInicio("2026-01-01");
    setFechaFin(hoyLocal);
  }, []);
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ventas Auditoria</h1>

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
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border mt-4 text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">#</th> {/* contador */}
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

                  if (key === "Precio Vendedor") {
                    const precioSistema = Number(f["Precio Sistema"]) || 0;
                    const precioVendedor = Number(val) || 0;

                    if (precioVendedor < precioSistema) {
                      clase += " text-red-600 font-bold";
                    } else {
                      clase += " text-green-600 font-semibold";
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

                <td className="p-2 border">
                  <Link
                    to={`/ventas-auditoria/${f.id}`}
                    className="text-green-600 hover:underline font-semibold"
                  >
                    <Eye size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
