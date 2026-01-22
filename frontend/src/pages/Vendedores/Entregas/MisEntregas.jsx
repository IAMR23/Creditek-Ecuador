import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import { Eye } from "lucide-react";

export default function MisEntregas() {
  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);

  // 🔹 Paginación
  const [page, setPage] = useState(1);
  const limit = 10;
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [textoEntrega, setTextoEntrega] = useState("");

  // ==============================
  // Obtener usuario desde token
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
  // Fetch principal con paginación
  // ==============================
  const fetchData = async () => {
    if (!usuarioInfo?.id) return;

    setLoading(true);
    setError("");

    try {
      const url = `${API_URL}/vendedor/entrega/${usuarioInfo.id}?page=${page}&limit=${limit}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      setTotalPages(data.totalPages || 1);

      const ventas = data.entrega || [];
      const resultado = ventas.map((entrega) => ({
        id: entrega.id,
        Fecha: entrega.fecha ?? "",
        Día: entrega.dia ?? "",
        
        Origen: entrega.origen ?? "",
        Dispositivo: entrega.tipo ?? "",
        Marca: entrega.marca ?? "",
        Modelo: entrega.modelo ?? "",
        Precio:
          entrega.pvp ??
          entrega.valorCorregido ??
          entrega.precioUnitario ??
          "",
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
      setError("Error al cargar las entregas");
    } finally {
      setLoading(false);
    }
  };

  // Auto fetch cuando cambia página o usuario
  useEffect(() => {
    fetchData();
  }, [usuarioInfo, page]);

  // ==============================
  // Texto detalle entrega
  // ==============================
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
- Correo : ${cliente.correo || ""}
- Dirección: ${cliente.direccion || ""}

📍 Origen
- Origen: ${origen.nombre}
- Observacion del origen : ${entrega.observacion || ""} 

🛻 Logistica 
- Fecha y hora de la llamada: ${entrega.FechaHoraLlamada || ""}

📦 Detalle de la Venta
`;
    detalleEntrega.forEach((item, index) => {
      texto += `
📌 Producto ${index + 1}
- Dispositivo: ${item.dispositivoMarca.dispositivo.nombre}
- Marca: ${item.dispositivoMarca.marca.nombre}
- Modelo: ${item.modelo.nombre}
- Precio: $${item.precioUnitario}
- Entrada : $${item.entrada} 
- Alcance : $${item.alcance}
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
  const handleCopiarDatos = async (idEntrega) => {
    try {
      const url = `${API_URL}/vendedor/entrega-logistica/${idEntrega}`;
      const { data } = await axios.get(url);

      if (data.ok) {
        setTextoEntrega(generarTextoEntrega(data.entrega));
        setModalAbierto(true);
      }
    } catch (error) {
      console.log("Error al obtener detalle:", error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Mis entregas</h1>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          <table className="w-full border text-sm">
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
                      <Eye size={18}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ===== PAGINACIÓN ===== */}
          <div className="flex justify-between items-center mt-4">
            <button
              className="px-4 py-1 bg-gray-300 rounded disabled:opacity-50"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              ◀ Anterior
            </button>

            <span>
              Página <b>{page}</b> de <b>{totalPages}</b>
            </span>

            <button
              className="px-4 py-1 bg-gray-300 rounded disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente ▶
            </button>
          </div>
        </>
      )}

      {/* ===================== MODAL ===================== */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded-lg w-10/12 max-w-2xl">
            <h2 className="text-xl font-bold mb-3">Detalle de la Entrega</h2>

            <textarea
              className="w-full border p-2 h-56 rounded"
              value={textoEntrega}
              readOnly
            />

            <button
              className="mt-3 w-full bg-blue-600 text-white py-2 rounded"
              onClick={() => {
                navigator.clipboard.writeText(textoEntrega);
                Swal.fire("¡Copiado!", "Texto copiado al portapapeles", "success");
                setModalAbierto(false);
              }}
            >
              Copiar al portapapeles
            </button>

            <button
              className="mt-2 w-full bg-red-500 text-white py-2 rounded"
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
