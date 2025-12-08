import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { useNavigate } from "react-router-dom"; // para navegar a otro componente
import { jwtDecode } from "jwt-decode";

export default function MisMetas() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const navigate = useNavigate();

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
    console.log(usuarioInfo.id)

    try {
      const url = `${API_URL}/vendedor/${usuarioInfo.id}?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      const ventas = data.ventas || [];
      const resultado = ventas.map((venta) => ({
        id: venta.id, // guardamos el id para el botón
        Fecha: venta.fecha ?? "",
        Día: venta.dia ?? "",
        Agencia: venta.local ?? "",
        Vendedor: venta.vendedor ?? "",
        Origen: venta.origen ?? "",
        Dispositivo: venta.tipo ?? "",
        Marca: venta.marca ?? "",
        Modelo: venta.modelo ?? "",
        Precio: venta.pvp ?? venta.valorCorregido ?? "",
        "Forma Pago": venta.formaPago ?? "",
        Contrato: venta.contrato ?? "",
        Entrada: venta.entrada ?? "",
        Alcance: venta.alcance ?? "",
        
      }));

      setFilas(resultado);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id)  fetchData();
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFechaInicio(hoyLocal);
    setFechaFin(hoyLocal);
  }, []);

  // Función para ver venta
  const handleVerVenta = (id) => {
    navigate(`/mis-ventas/${id}`); // redirige a otro componente pasando el id
  };

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
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border mt-4 text-sm">
          <thead className="bg-gray-200">
            <tr>
              {Object.keys(filas[0] || {}).map((key) => (
                <th key={key} className="p-2 border">
                  {key}
                </th>
              ))}
              
              {/* Columna de acciones */}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                {Object.values(f).map((val, j) => (
                  <td key={j} className="p-2 border">
                    {val}
                  </td>
                ))}
             {/*    <td className="p-2 border">
                  <button
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                    onClick={() => handleVerVenta(f.id)}
                  >
                    Ver venta
                  </button>
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
