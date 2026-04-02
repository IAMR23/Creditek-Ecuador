import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import { FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import { getHoyLocal } from "../../utils/dateUtils";
import SelectUsuarios from "../../components/common/SelectUsuarios";


export default function BDDVentas() {
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
  const [origen, setOrigen] = useState([]);
  const [origenId, setOrigenId] = useState("");


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

  const cargarOrigenes = async () => {
    try {
      const res = await axios.get(`${API_URL}/origen`);
      setOrigen(res.data || []);
    } catch (error) {
      console.error("Error cargando orígenes:", error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudieron cargar las orígenes.",
      });

      setOrigen([]);
    }
  };

  useEffect(() => {
    cargarOrigenes();
    cargarAgencias();
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

      if (origenId && origenId !== "todas") {
        params.append("origenId", origenId);
      }

      const url = `${API_URL}/api/gerencia/informe?${params.toString()}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      const ventas = data.ventas || [];

      const resultado = ventas.map((venta) => ({
        Fecha: (venta.fecha ?? "").toString().toUpperCase(),
        Agencia: (venta.local ?? "").toUpperCase(),
        Cliente : (venta.nombre ?? "").toUpperCase(),  
        Cedula : (venta.cedula ?? "").toUpperCase(),
        Telefono : (venta.telefono ?? "").toUpperCase(),
        Direccion : (venta.direccion ?? "").toUpperCase(),
        Origen: (venta.origen ?? "").toUpperCase(),
        "Observaciones de Origen": (venta.observaciones ?? "").toUpperCase(),
        Vendedor: (venta.vendedor ?? "").toUpperCase(),

        Dispositivo:
          `${venta.tipo ?? ""} ${venta.marca ?? ""} ${venta.modelo ?? ""}`
            .trim()
            .toUpperCase(),

        "Forma Pago": (venta.formaPago ?? "").toUpperCase(),
        "Precio de Venta": (venta.precioVendedor ?? "")
          .toString()
          .toUpperCase(),
      }));

      setFilas(resultado);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const descargarExcel = () => {
    if (!filas || filas.length === 0) {
      Swal.fire("Atención", "No hay datos para exportar", "warning");
      return;
    }

    // 🔹 Quitar el id interno
    const data = filas.map(({ id, ...rest }) => rest);

    // 🔹 Crear hoja
    const worksheet = XLSX.utils.json_to_sheet(data);

    // 🔹 Crear libro
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BDD Ventas");

    // 🔹 Nombre dinámico
    const nombreArchivo = `BDD_Ventas_${fechaInicio}_a_${fechaFin}.xlsx`;

    // 🔹 Descargar
    XLSX.writeFile(workbook, nombreArchivo);
  };

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchData();
    }
  }, [fechaInicio, fechaFin, agenciaId, vendedorId, observacion, origenId]);


  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Base de Datos de Ventas</h1>

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
            <option value="todas">Todas</option>
            {agencias.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

   
   <SelectUsuarios
  label="Vendedor"
  value={vendedorId}
  onChange={setVendedorId}
/>


        <div>
          <label className="block text-sm font-medium">Origen</label>
          <select
            className="border px-2 py-1 rounded"
            value={origenId}
            onChange={(e) => setOrigenId(e.target.value)}
          >
            <option value="">Todas</option>
            {origen.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={descargarExcel}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          <FaFileExcel size={18} />
        </button>
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1">#</th>
                {filas.length > 0 &&
                  Object.keys(filas[0]).map((key) => (
                    <th key={key} className="border px-2 py-1">
                      {key}
                    </th>
                  ))}
              </tr>
            </thead>

            <tbody>
              {filas.map((fila, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border px-2 py-1 text-center">{index + 1}</td>

                  {Object.values(fila).map((valor, i) => (
                    <td key={i} className="border px-2 py-1">
                      {valor}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
