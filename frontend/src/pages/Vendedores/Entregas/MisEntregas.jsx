import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { useNavigate } from "react-router-dom"; // para navegar a otro componente
import { jwtDecode } from "jwt-decode";

export default function MisEntregas() {
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

    try {
      const url = `${API_URL}/vendedor/entrega/${usuarioInfo.id}?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      console.log(data.entrega)
      const ventas = data.entrega || [];
      const resultado = ventas.map((entrega) => ({
        id: entrega.id, // guardamos el id para el botón
        Fecha: entrega.fecha ?? "",
        Día: entrega.dia ?? "",
        Agencia: entrega.local ?? "",
        Vendedor: entrega.vendedor ?? "",
        Origen: entrega.origen ?? "",
        Dispositivo: entrega.tipo ?? "",
        Marca: entrega.marca ?? "",
        Modelo: entrega.modelo ?? "",
        Precio: entrega.pvp ?? entrega.valorCorregido ?? entrega.precioUnitario,
        "Forma Pago": entrega.formaPago ?? "",
        Contrato: entrega.contrato ?? "",
        Entrada: entrega.entrada ?? "",
        Alcance: entrega.alcance ?? "",
        Estado : entrega.estado ?? "",
        ObservacionLogistica : entrega.observacionLogistica ?? "",
      }));

      setFilas(resultado);
      console.log(resultado)
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


  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Mis entregas</h1>

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
                    Ver entrega
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
