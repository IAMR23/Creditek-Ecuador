import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { API_URL } from "../../../../config";
import axios from "axios";
import imageCompression from "browser-image-compression";
import Swal from "sweetalert2";

export default function EntregaFoto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cliente = location.state?.cliente;

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleEnviar = async () => {
    if (!foto) {
      setMsg("Selecciona o toma una foto primero");
      return false;
    }

    try {
      setLoading(true);
      setMsg("Comprimiendo imagen...");

      const options = {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };

      const imagenComprimida = await imageCompression(foto, options);

      const formData = new FormData();
      formData.append("foto", imagenComprimida);

      setMsg("Subiendo imagen...");

      await axios.put(`${API_URL}/entregas/entrega/${id}/validar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMsg("Entrega validada correctamente");
      return true;
    } catch (err) {
      console.error(err);
      setMsg("Error al enviar la foto");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "";
    return String(fecha).slice(0, 10);
  };

  const valorTexto = (valor, fallback = "N/A") => {
    if (valor === null || valor === undefined || valor === "") return fallback;
    return valor;
  };

  const generarDetalleEntrega = (detalles = []) => {
    if (!detalles.length) return "- Ninguno";

    return detalles
      .map(
        (item) => `- Dispositivo: ${valorTexto(
          item.dispositivoMarca?.dispositivo?.nombre
        )}
- Marca: ${valorTexto(item.dispositivoMarca?.marca?.nombre)}
- Modelo: ${valorTexto(item.modelo?.nombre)}
- Forma de Pago: ${valorTexto(item.formaPago?.nombre)}
- Precio Venta : $${valorTexto(item.precioVendedor || item.precioUnitario, "0")}
- Cantidad: ${valorTexto(item.cantidad, "1")}
- Entrada : $${valorTexto(item.entrada, "0")}
- Alcance : $${valorTexto(item.alcance, "0")}
- Contrato: ${valorTexto(item.contrato)}
- Observación del detalle: ${valorTexto(item.observacionDetalle)}`
      )
      .join("\n");
  };

  const generarObsequiosEntrega = (obsequios = []) => {
    if (!obsequios.length) return "- Ninguno";

    return obsequios
      .map(
        (item) =>
          `- ${valorTexto(item.obsequio?.nombre, "Ninguno")} (Cantidad: ${valorTexto(
            item.cantidad,
            "1"
          )})`
      )
      .join("\n");
  };

  const generarTextoEntrega = (entrega) => {
    return `ENTREGA REGISTRADA ${entrega.id}
Vendedor: ${valorTexto(entrega.usuarioAgencia?.usuario?.nombre)}
Agencia: ${valorTexto(entrega.usuarioAgencia?.agencia?.nombre)}
Fecha: ${formatearFecha(entrega.fecha)}
📍 Origen
- Origen : ${valorTexto(entrega.origen?.nombre)}
- Observación: ${valorTexto(entrega.observacion)}
Detalle:
${generarDetalleEntrega(entrega.detalleEntrega)}
Obsequios:
${generarObsequiosEntrega(entrega.obsequiosEntrega)}`;
  };

  const handleCopiarDatos = async () => {
    try {
      const url = `${API_URL}/vendedor/entrega-logistica/${id}`;
      const { data } = await axios.get(url);

      if (data.ok) {
        return generarTextoEntrega(data.entrega);
      }
    } catch (error) {
      console.log("Error al obtener detalle:", error);
    }

    return "";
  };

  const handleValidarEntrega = async () => {
    const enviada = await handleEnviar();
    if (!enviada) return;

    const texto = await handleCopiarDatos();
    if (texto) {
      await navigator.clipboard.writeText(texto);

      await Swal.fire({
        icon: "success",
        title: "Copiado",
        text: "Informacion copiada al portapapeles",
        confirmButtonColor: "#3085d6",
      });
    }

    navigate("/vendedor-panel");
  };

  return (
    <div className="p-6">
      <div className="p-4 mb-6 bg-orange-50 border border-orange-200 rounded-lg">
        <h1 className="text-2xl font-bold text-orange-600">
          Verificacion de la Entrega
        </h1>

        {cliente && (
          <p className="text-gray-700 mt-1">
            Cliente: <span className="font-semibold">{cliente.cliente}</span>
          </p>
        )}
      </div>

      <div className="bg-white p-4 rounded shadow border border-orange-500">
        <h2 className="text-lg font-semibold text-orange-600 mb-4">
          Toma o selecciona una foto
        </h2>
        <p>Si el dispositivo es un celular la foto debe ser del cliente</p>
        <p>Si el dispositivo es una TV la foto debe ser del contrato de CrediTV</p>

        {preview ? (
          <img
            src={preview}
            alt="preview"
            className="w-full rounded-lg mb-4 border"
          />
        ) : (
          <div className="w-full h-64 bg-gray-100 rounded-lg flex justify-center items-center text-gray-400 border">
            Vista previa de la imagen
          </div>
        )}

        <label className="block mt-4">
          <span className="text-orange-600 font-semibold">Elegir foto:</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFoto}
            className="block mt-2"
          />
          <p className="text-sm text-gray-500">
            (Usa la camara directamente o selecciona una imagen)
          </p>
        </label>

        <button
          onClick={handleValidarEntrega}
          className="mt-6 w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 rounded-lg"
        >
          {loading ? "Procesando..." : "Validar Entrega"}
        </button>

        {msg && (
          <p className="text-center mt-3 text-orange-700 font-medium">{msg}</p>
        )}

        <button
          onClick={() => navigate(-1)}
          className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
