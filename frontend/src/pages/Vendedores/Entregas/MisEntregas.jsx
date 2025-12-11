import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";

export default function MisEntregas() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [textoEntrega, setTextoEntrega] = useState("");

  const navigate = useNavigate();

  // ==============================
  // Lee token
  // ==============================
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

  // ==============================
  // Fetch principal
  // ==============================
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

      const ventas = data.entrega || [];
      const resultado = ventas.map((entrega) => ({
        id: entrega.id,
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
        Estado: entrega.estado ?? "",
        ObservacionLogistica: entrega.observacionLogistica ?? "",
      }));

      setFilas(resultado);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  // Auto fetch
  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) fetchData();
  }, [fechaInicio, fechaFin]);

  // Set today's date
  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFechaInicio(hoyLocal);
    setFechaFin(hoyLocal);
  }, []);

  // ===========================================
  // GENERADOR DEL TEXTO — CORREGIDO
  // ===========================================
  const generarTextoEntrega = (entrega) => {
    const {
      id,
      usuarioAgencia,
      cliente,
      origen,
      detalleEntrega,
      obsequiosEntrega,
    } = entrega;

    let texto = `📄 Detalle de la Entrega #${id}

👤 Vendedor: ${usuarioAgencia.usuario.nombre}
🏢 Agencia: ${usuarioAgencia.agencia.nombre}

🧍 Cliente
- Nombre: ${cliente.nombre}
- Cédula: ${cliente.cedula}
- Teléfono: ${cliente.telefono}

📍 Origen
- Origen: ${origen.nombre}

📦 Detalle de la Venta
`;

    detalleEntrega.forEach((item, index) => {
      texto += `
📌 Producto ${index + 1}
- Dispositivo: ${item.dispositivoMarca.dispositivo.nombre}
- Marca: ${item.dispositivoMarca.marca.nombre}
- Modelo: ${item.modelo.nombre}
- Precio: $${item.precioUnitario}
- Forma de pago: ${item.formaPago.nombre}
- Ubicación del Cliente: ${item.ubicacion || ""}
- Ubicación del dispositivo: ${item.ubicacionDispositivo || ""}
`;
    });

    texto += `

🎁 Obsequios
`;

    if (obsequiosEntrega.length === 0) {
      texto += "(No se registraron obsequios)\n";
    } else {
      obsequiosEntrega.forEach((item, index) => {
        texto += `- ${item.obsequio.nombre} (Cantidad: ${item.cantidad})\n`;
      });
    }

    return texto;
  };

  // ===========================================
  // Abre modal + consulta API
  // ===========================================
  const handleCopiarDatos = async (idEntrega) => {
    try {
      const url = `${API_URL}/vendedor/entrega-logistica/${idEntrega}`;
      const { data } = await axios.get(url);

      if (data.ok) {
        const texto = generarTextoEntrega(data.entrega);
        setTextoEntrega(texto);
        setModalAbierto(true);
      }
    } catch (error) {
      console.log("Error al obtener detalle:", error);
    }
  };

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
              <th className="p-2 border">Acciones</th>
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

                <td className="p-2 border">
                  <button
                    className="bg-orange-600 text-white px-2 py-1 rounded"
                    onClick={() => handleCopiarDatos(f.id)}
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ===================== MODAL ===================== */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded-lg w-10/12 max-w-2xl overflow-y-auto max-h-[80vh] text-sm">
            <h2 className="text-xl font-bold mb-3">Detalle de la Entrega</h2>

            <div className="bg-gray-100 p-2 rounded mb-3">
              <p className="font-semibold">Información generada</p>

              <textarea
                className="w-full border p-2 h-48 mt-2 rounded"
                value={textoEntrega}
                readOnly
              ></textarea>
            </div>

            <button
              className="mt-3 w-full bg-blue-600 text-white py-2 rounded text-sm"
              onClick={() => {
                navigator.clipboard.writeText(textoEntrega);
                Swal.fire({
                  icon: "success",
                  title: "¡Copiado!",
                  text: "Información copiada al portapapeles",
                  confirmButtonColor: "#3085d6",
                });
                setModalAbierto(false);
              }}
            >
              Copiar al portapapeles
            </button>

            <button
              className="mt-2 w-full bg-red-500 text-white py-2 rounded text-sm"
              onClick={() => setModalAbierto(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
