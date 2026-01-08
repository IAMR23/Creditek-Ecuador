import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { Link } from "react-router-dom"; // para navegar a otro componente
import { jwtDecode } from "jwt-decode";

import { DataGrid } from "@mui/x-data-grid";


export default function MetasComerciales() {
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
        Día: venta.dia ?? "",
        Fecha: venta.fecha ?? "",
        Agencia: venta.local ?? "",
        Origen: venta.origen ?? "",
        "Observaciones de Origen": venta.observaciones ?? "",
        Vendedor: venta.vendedor ?? "",
        Dispositivo: venta.tipo ?? "",
        Marca: venta.marca ?? "",
        Modelo: venta.modelo ?? "",
        "Forma Pago": venta.formaPago ?? "",
        "Precio Sistema": venta.precioSistema ?? "",
        "Precio Vendedor": venta.precioVendedor ?? "",
        Entrada: venta.entrada ?? "",
        Alcance: venta.alcance ?? "",
      }));

      setFilas(resultado);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columnas = [
  {
    field: "numero",
    headerName: "#",
    width: 70,
    sortable: false,
    filterable: false,
    align: "center",
    headerAlign: "center",
    renderCell: (params) =>
      params.api.getRowIndexRelativeToVisibleRows(params.id) + 1,
  },
  ...Object.keys(filas[0] || {}).map((key) => ({
    field: key,
    headerName: key,
    flex: 1,
    editable: true,
  })),
];




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
      <h1 className="text-xl font-bold mb-4">Metas Comerciales</h1>

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
      <DataGrid
  rows={filas.map((f, i) => ({ id: f.id ?? i, ...f }))}
  columns={columnas}
  autoHeight
  pageSizeOptions={[10, 25, 50]}
  sx={{
    "& .precio-rojo": { color: "red", fontWeight: "bold" },
    "& .precio-verde": { color: "green", fontWeight: "bold" },
  }}
  getCellClassName={(params) => {
    if (params.field === "Precio Vendedor") {
      const ps = Number(params.row["Precio Sistema"]) || 0;
      const pv = Number(params.value) || 0;
      return pv < ps ? "precio-rojo" : "precio-verde";
    }
  }}
/>
      )}
    </div>
  );
}
