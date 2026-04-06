import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import { FaFileExcel, FaTrash } from "react-icons/fa";

import { DataGrid } from "@mui/x-data-grid";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { getHoyLocal } from "../../utils/dateUtils";

const STORAGE_KEY = "metasComercialesFiltros";

export default function MetasComerciales() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(getHoyLocal());
  const [fechaFin, setFechaFin] = useState(getHoyLocal());
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [vendedorId, setVendedorId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [filtrosCargados, setFiltrosCargados] = useState(false);

  const observaciones = [
    "Luis",
    "Uphone",
    "Creditv",
    "Anais",
    "Bryan",
    "Andres",
    "Damian",
    "Elizeth",
    "Oscar",
    "Alejandra",
    "Damaris",
    "Mirka",
    "Fernando",
    "Mateo",
    "Raul",
    "Steeven Furgo",
  ];

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

  // 🔹 Cargar filtros guardados al iniciar
  useEffect(() => {
    try {
      const filtrosGuardados = localStorage.getItem(STORAGE_KEY);

      if (filtrosGuardados) {
        const filtros = JSON.parse(filtrosGuardados);

        setFechaInicio(filtros.fechaInicio || getHoyLocal());
        setFechaFin(filtros.fechaFin || getHoyLocal());
        setAgenciaId(filtros.agenciaId || "");
        setVendedorId(filtros.vendedorId || "");
        setObservacion(filtros.observacion || "");
      }
    } catch (error) {
      console.error("Error cargando filtros desde localStorage:", error);
    } finally {
      setFiltrosCargados(true);
    }
  }, []);

  // 🔹 Guardar filtros cada vez que cambien
  useEffect(() => {
    if (!filtrosCargados) return;

    const filtros = {
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      observacion,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtros));
  }, [fechaInicio, fechaFin, agenciaId, vendedorId, observacion, filtrosCargados]);

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

      if (observacion && observacion.trim() !== "") {
        params.append("observacion", observacion.trim());
      }

      const url = `${API_URL}/auditoria/informe?${params.toString()}`;
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
        "Precio de Venta": venta.precioVendedor ?? "",
        "Cierre de caja": venta.cierreCaja ?? "",
        Entrada: venta.entrada ?? "",
        Alcance: venta.alcance ?? "",
        Margen: venta.margen ?? "",
        Costo: venta.costo ?? "",
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

  const descargarExcel = () => {
    if (!filas || filas.length === 0) {
      Swal.fire("Atención", "No hay datos para exportar", "warning");
      return;
    }

    const data = filas.map(({ id, ...rest }) => rest);
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Metas Comerciales");

    const nombreArchivo = `Metas_Comerciales_${fechaInicio}_a_${fechaFin}.xlsx`;
    XLSX.writeFile(workbook, nombreArchivo);
  };

  useEffect(() => {
    if (
      filtrosCargados &&
      fechaInicio &&
      fechaFin &&
      usuarioInfo?.id
    ) {
      fetchData();
    }
  }, [filtrosCargados, fechaInicio, fechaFin, agenciaId, vendedorId, observacion, usuarioInfo]);

  const limpiarFiltros = () => {
    setFechaInicio(getHoyLocal());
    setFechaFin(getHoyLocal());
    setAgenciaId("");
    setVendedorId("");
    setObservacion("");
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Metas Comerciales</h1>

      <div className="flex gap-4 mb-4 items-end flex-wrap">
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
          <label className="block text-sm font-medium">Promotor</label>
          <input
            type="text"
            list="observaciones-list"
            className="border px-2 py-1 rounded"
            placeholder="Escriba o seleccione"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />
          <datalist id="observaciones-list">
            {observaciones.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>

        <button
          onClick={descargarExcel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          <FaFileExcel size={18} />
        </button>

        <button
          onClick={limpiarFiltros}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          <FaTrash size={18}/>
        </button>
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <DataGrid
          rows={filas.map((f, i) => ({ id: f.id ?? i, ...f }))}
          columns={columnas}
          autoHeight
          pageSizeOptions={[10, 25, 50 , 100]}
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
            return "";
          }}
        />
      )}
    </div>
  );
}