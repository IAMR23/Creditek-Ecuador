import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { Link } from "react-router-dom"; // para navegar a otro componente
import { jwtDecode } from "jwt-decode";
import DashboardGraficas from "./DashboardGraficas";

export default function Dashboard() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("2026-01-01");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [vendedorId, setVendedorId] = useState("");

  const [estadisticas, setEstadisticas] = useState(null);

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

      const url = `${API_URL}/auditoria/ventas2?${params.toString()}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;
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
        Modelo: venta.modelo ?? "",
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

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchData();
    }
  }, [fechaInicio, fechaFin, agenciaId, vendedorId]);

  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFechaFin(hoyLocal);
  }, []);
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>

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
        <DashboardGraficas estadisticas={estadisticas} />
      )}
    </div>
  );
}
