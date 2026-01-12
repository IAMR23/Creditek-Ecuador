import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { useNavigate } from "react-router-dom"; // para navegar a otro componente
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";

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

    try {
      const url = `${API_URL}/vendedor/${usuarioInfo.id}?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;
      const ventas = data.ventas || [];
      const resultado = ventas.map((venta) => ({
        id: venta.id, // guardamos el id para el botón
        Fecha: venta.fecha ?? "",
        Día: venta.dia ?? "",
        Cliente : venta.nombre , 
        Origen: venta.origen ?? "",
        "Observaciones de Origen": venta.observaciones ?? "",
        Dispositivo: venta.tipo ?? "",
        Marca: venta.marca ?? "",
        Modelo: venta.modelo ?? "",
        Precio: venta.pvp ?? venta.valorCorregido ?? "",
        "Forma Pago": venta.formaPago ?? "",
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
    if (fechaInicio && fechaFin && usuarioInfo?.id) fetchData();
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    const hoyLocal = new Date().toLocaleDateString("en-CA");
    setFechaInicio(hoyLocal);
    setFechaFin(hoyLocal);
  }, []);

  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const handleVerVenta = async (id) => {
    try {
      const { data } = await axios.get(`${API_URL}/vendedor/venta/${id}`);
      if (data.ok) {
        setVentaSeleccionada(data.venta);
        console.log(data.venta);
        setModalAbierto(true); // abrimos modal
      }
    } catch (error) {
      console.log(error);
    }
  };

  const copiarVenta = () => {
    if (!ventaSeleccionada) return;

    let texto = `📄 *Detalle de la Venta #${ventaSeleccionada.id}*\n\n`;

    texto += `👤 *Vendedor:* ${ventaSeleccionada.usuarioAgencia.usuario.nombre}\n`;
    texto += `🏢 *Agencia:* ${ventaSeleccionada.usuarioAgencia.agencia.nombre}\n`;
    texto += `🧍 *Cliente*\n`;
    texto += `- Nombre: ${ventaSeleccionada.cliente.cliente}\n`;
    texto += `- Cédula: ${ventaSeleccionada.cliente.cedula}\n`;
    texto += `- Teléfono: ${ventaSeleccionada.cliente.telefono}\n`;
    texto += `- Correo: ${ventaSeleccionada.cliente.correo}\n`;
    texto += `- Direccion: ${ventaSeleccionada.cliente.direccion}\n`;
    texto += `🧍 *Origen*\n`;
    texto += `- Origen: ${ventaSeleccionada.origen.nombre}\n`;
    texto += `- Observacion del origen: ${ventaSeleccionada.observacion}\n`;

    texto += `📦 *Detalle de la Venta*\n`;

    ventaSeleccionada.detalleVenta.forEach((item, index) => {
      texto += `\n📌 *Producto ${index + 1}*\n`;
      texto += `- Dispositivo: ${item.dispositivoMarca.dispositivo.nombre}\n`;
      texto += `- Marca: ${item.dispositivoMarca.marca.nombre}\n`;
      texto += `- Modelo: ${item.modelo.nombre}\n`;
      texto += `- Precio: ${item.precioVendedor}\n`;
      texto += `- Entrada: ${item.entrada}\n`;
      texto += `- Alcance: ${item.alcance}\n`;
      texto += `- Forma de pago: ${item.formaPago.nombre}\n`;
      texto += `- Obs: ${item.observacionDetalle}\n`;

    });

    // 🎁 Obsequios
    texto += `\n🎁 *Obsequios*\n`;
    if (ventaSeleccionada.obsequiosVenta.length === 0) {
      texto += `- No hay obsequios\n`;
    } else {
      ventaSeleccionada.obsequiosVenta.forEach((ob) => {
        texto += `- ${ob.obsequio.nombre} (Cant: ${ob.cantidad})\n`;
      });
    }

    navigator.clipboard.writeText(texto);
    Swal.fire({
      icon: "success",
      title: "¡Copiado!",
      text: "Información copiada al portapapeles",
      confirmButtonColor: "#3085d6",
    });
      setModalAbierto(false);
  };



  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Mis Ventas</h1>

      <div className="flex gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm font-medium">Fecha - Inicio</label>
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
              <th>Acciones</th>
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
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                    onClick={() => handleVerVenta(f.id)}
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalAbierto && ventaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white p-4 rounded-lg w-10/12 max-w-2xl overflow-y-auto max-h-[80vh] text-sm">
            <h2 className="text-xl font-bold mb-3">
              Detalle Venta #{ventaSeleccionada.id}
            </h2>

            {/* Vendedor / Agencia */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="font-semibold">Vendedor:</p>
                <p>{ventaSeleccionada.usuarioAgencia.usuario.nombre}</p>
              </div>
              <div>
                <p className="font-semibold">Agencia:</p>
                <p>{ventaSeleccionada.usuarioAgencia.agencia.nombre}</p>
              </div>
            </div>

            {/* Cliente */}
            <div className="bg-gray-100 p-2 rounded mb-3">
              <p className="font-semibold">Cliente</p>
              <p>
                <b>Nombre:</b> {ventaSeleccionada.cliente.cliente}
              </p>
              <p>
                <b>Cédula:</b> {ventaSeleccionada.cliente.cedula}
              </p>
              <p>
                <b>Teléfono:</b> {ventaSeleccionada.cliente.telefono}
              </p>
            </div>

            {/* Detalle de Venta */}
            <p className="font-semibold mb-1">Detalle</p>
            {ventaSeleccionada.detalleVenta.map((item) => (
              <div key={item.id} className="border p-2 rounded mb-2">
                <p>
                  <b>Dispositivo:</b> {item.dispositivoMarca.dispositivo.nombre}
                </p>
                <p>
                  <b>Marca:</b> {item.dispositivoMarca.marca.nombre}
                </p>
                <p>
                  <b>Modelo:</b> {item.modelo.nombre}
                </p>
                <p>
                  <b>Precio:</b> {item.precioUnitario}
                </p>
                <p>
                  <b>Forma Pago:</b> {item.formaPago.nombre}
                </p>

                {item.observacionDetalle?.trim() !== "" && (
                  <p>
                    <b>Obs:</b> {item.observacionDetalle}
                  </p>
                )}
              </div>
            ))}

            {/* Obsequios */}
            <p className="font-semibold mt-3 mb-1">Obsequios</p>
            {ventaSeleccionada.obsequiosVenta.length === 0 ? (
              <p>No hay obsequios</p>
            ) : (
              ventaSeleccionada.obsequiosVenta.map((ob) => (
                <div key={ob.id} className="border p-2 rounded mb-2">
                  <p>
                    <b>Obsequio:</b> {ob.obsequio.nombre}
                  </p>
                  <p>
                    <b>Cantidad:</b> {ob.cantidad}
                  </p>
                </div>
              ))
            )}

            <button
              className="mt-3 w-full bg-green-600 text-white py-2 rounded text-sm"
              onClick={copiarVenta}
            >
              Copiar información
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
