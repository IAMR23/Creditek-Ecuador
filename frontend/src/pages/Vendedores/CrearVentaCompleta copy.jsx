import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import imageCompression from "browser-image-compression";
import { useNavigate } from "react-router-dom";

const CrearVentaCompleta = () => {
  const [loading, setLoading] = useState(false);
  const [origenes, setOrigenes] = useState([]);
  const [usuarioInfo, setUsuarioInfo] = useState(null);

  const [dispositivoMarcas, setDispositivoMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [formasPago, setFormasPago] = useState([]);

  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);

  const [origenSeleccionado, setOrigenSeleccionado] = useState(null);
  const [formaPagoSeleccionada, setFormaPagoSeleccionada] = useState(null);
  const [dispositivoMarcaSeleccionado, setDispositivoMarcaSeleccionado] =
    useState(null);

  const [modeloSeleccionado, setModeloSeleccionado] = useState(null);
  const navigate = useNavigate();
  // 👉 Capturar foto o archivo
  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const hoy = new Date().toLocaleDateString("en-CA");

  const [obsequiosDisponibles, setObsequiosDisponibles] = useState([]);

  useEffect(() => {
    const fetchObsequios = async () => {
      try {
        const res = await axios.get(`${API_URL}/obsequios`);
        setObsequiosDisponibles(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchObsequios();
  }, []);

  const [cliente, setCliente] = useState({
    cliente: "",
    cedula: "",
    telefono: "",
    correo: "",
    direccion: "",
  });

  const [obsequios, setObsequios] = useState([]);

  const [venta, setVenta] = useState({
    usuarioAgenciaId: null,
    origenId: "",
    observacion: "",
    fecha: hoy,
  });

  const [detalle, setDetalle] = useState({
    cantidad: 1,
    precioUnitario: "",
    precioVendedor: "",
    dispositivoMarcaId: "",
    modeloId: "",
    contrato: "",
    formaPagoId: "",
    entrada: "",
    alcance: "",
    observacionDetalle: "",
  });

  useEffect(() => {
    const fetchSelects = async () => {
      try {
        const [dmRes, fpRes] = await Promise.all([
          axios.get(`${API_URL}/dispositivoMarca`),
          axios.get(`${API_URL}/formaPago`),
        ]);
        setDispositivoMarcas(dmRes.data);
        setFormasPago(fpRes.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchSelects();
  }, []);

  useEffect(() => {
    const fetchPrecio = async () => {
      if (!detalle.modeloId || !detalle.formaPagoId) return;

      try {
        const res = await axios.get(
          `${API_URL}/precio/${detalle.modeloId}/${detalle.formaPagoId}`,
        );

        setDetalle((prev) => ({
          ...prev,
          precioUnitario: res.data?.precio?.toString() || "0",
        }));
      } catch (err) {
        console.error(err);
        setDetalle((prev) => ({ ...prev, precioUnitario: "0" }));
      }
    };

    fetchPrecio();
  }, [detalle.modeloId, detalle.formaPagoId]);

  /* ===============================
     MODELOS
  =============================== */
  const handleDispositivoMarcaChange = async (e) => {
    const dispositivoMarcaId = e.target.value;

    setDetalle((prev) => ({
      ...prev,
      dispositivoMarcaId,
      modeloId: "",
    }));

    if (!dispositivoMarcaId) {
      setModelos([]);
      return;
    }

    try {
      const res = await axios.get(
        `${API_URL}/dispositivoMarca/${dispositivoMarcaId}`,
      );
      setModelos(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      setUsuarioInfo(decoded.usuario);

      setVenta((prev) => ({
        ...prev,
        usuarioAgenciaId:
          decoded.usuario?.agenciaPrincipal?.usuarioAgenciaId || null,
      }));
    } catch (error) {
      console.error("Error decodificando token:", error);
    }
  }, []);

  useEffect(() => {
    const cargarOrigenes = async () => {
      try {
        const res = await axios.get(`${API_URL}/origen`);
        setOrigenes(res.data);
      } catch (error) {
        console.error(error);
      }
    };
    cargarOrigenes();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Permitimos que campos numéricos puedan ser vacíos para editar libremente
    if (["cantidad", "precioUnitario", "entrada", "alcance"].includes(name)) {
      setDetalle((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setDetalle((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleClienteChange = (e) =>
    setCliente({ ...cliente, [e.target.name]: e.target.value });

  const handleVentaChange = (e) =>
    setVenta({ ...venta, [e.target.name]: e.target.value });

  const handleDetalleChange = (e) =>
    setDetalle({ ...detalle, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!foto) {
      Swal.fire("Atención", "Debes subir una foto", "warning");
      return;
    }

    try {
      setLoading(true);

      // 🔥 Construir FormData
      const formData = new FormData();

      formData.append(
        "data",
        JSON.stringify({
          cliente,
          venta: {
            ...venta,
            usuarioAgenciaId: Number(venta.usuarioAgenciaId),
            origenId: Number(venta.origenId),
          },
          detalle: {
            ...detalle,
            dispositivoMarcaId: Number(detalle.dispositivoMarcaId),
            modeloId: Number(detalle.modeloId),
            formaPagoId: Number(detalle.formaPagoId),
            cantidad: Number(detalle.cantidad),
            precioVendedor: Number(detalle.precioVendedor),
            entrada: detalle.entrada ? Number(detalle.entrada) : 0,
            alcance: detalle.alcance ? Number(detalle.alcance) : 0,
          },
          obsequios,
        }),
      );

      const options = {
        maxSizeMB: 0.4, // ~400 KB
        maxWidthOrHeight: 1280, // resolución máxima
        useWebWorker: true,
      };

      const imagenComprimida = await imageCompression(foto, options);

      // Agregar imagen comprimida
      formData.append("foto", imagenComprimida);

      const response = await axios.post(
        `${API_URL}/registrar/ventas-completas`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const ventaData = response.data;
      const texto = buildVentaText({
        cliente,
        origen: origenSeleccionado,
        dispositivoMarca: dispositivoMarcaSeleccionado,
        formaPago: formaPagoSeleccionada,
        modelo: modeloSeleccionado,
        venta: {
          ...venta,
          id: ventaData.venta.id,
          fecha: ventaData.venta.fecha,
        },
        detalle,
        usuarioInfo,
        obsequios,
      });

      await navigator.clipboard.writeText(texto);
      Swal.fire(
        "Venta registrada",
        "La información fue copiada al portapapeles",
        "success",
      );

      Swal.fire(
        "Éxito",
        "📄 Venta creada y copiada al portapapeles",
        "success",
      );

      // 🔄 Reset
      setFoto(null);
      setPreview(null);
      setObsequios([]);
      setCliente({
        cliente: "",
        cedula: "",
        telefono: "",
        correo: "",
        direccion: "",
      });
      setVenta((prev) => ({ ...prev, origenId: "", observacion: "" }));
      navigate("/");
    } catch (error) {
      console.error(error);

      const mensaje =
        error.response?.data?.message || "No se pudo crear la venta";

      Swal.fire("Error", mensaje, "error");
    } finally {
      setLoading(false);
    }
  };

  const buildVentaText = ({
    cliente = {},
    venta = {},
    detalle = {},
    obsequios = [],
    origen,
    formaPago,
    modelo,
  }) => {
    return `
VENTA REGISTRADA ${venta.id || ""}
 Vendedor  ${usuarioInfo.nombre} 
 Agencia: ${usuarioInfo.agenciaPrincipal?.nombre}
 Fecha: ${venta.fecha || "N/A"}
Cliente:
- Nombre: ${cliente.cliente || "N/A"}
- Cédula: ${cliente.cedula || "N/A"}
- Teléfono: ${cliente.telefono || "N/A"}
- Correo: ${cliente.correo || "N/A"}
- Direccion: ${cliente.direccion || "N/A"}
📍 Origen
- Origen : ${origen.nombre || "N/A"}
- Observación: ${venta.observacion || "N/A"}
Detalle:
- Dispositivo: ${dispositivoMarcaSeleccionado?.dispositivo?.nombre || "N/A"}
- Marca: ${dispositivoMarcaSeleccionado?.marca?.nombre || "N/A"}
- Modelo: ${modelo?.nombre || "N/A"}
- Forma de Pago: ${formaPago?.nombre || "N/A"}
- Precio : $${detalle.precioVendedor || 0}
- Cantidad: ${detalle.cantidad || 0}
- Entrada : $${detalle.entrada || 0}
- Alcance : $${detalle.alcance || 0}
- Contrato: ${detalle.contrato || "N/A"}
- Observación del detalle: ${detalle.observacionDetalle || "N/A"}
Obsequios:
${
  obsequios.length
    ? obsequios
        .map((o) => {
          const info = obsequiosDisponibles.find((d) => d.id === o.obsequioId);

          return `- ${info?.nombre || "Desconocido"} (x${o.cantidad})`;
        })
        .join("\n")
    : "- Ninguno"
}
    `;
  };

  return (
    <div className="max-w-3xl mx-auto shadow-sm p-4 m-4 bg-white rounded-lg border border-green-500">
      {usuarioInfo && (
        <div className="mb-6 p-5 bg-gradient-to-r from-green-50 to-white border border-green-200 rounded-xl shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Columna izquierda */}
            <div>
              <p className="text-lg font-semibold text-green-700">
                {usuarioInfo.nombre}
              </p>
            </div>

            {/* Columna derecha */}
            <div className="md:text-right">
              <p className="text-sm font-medium text-gray-700">Agencia</p>
              <p className="text-base font-semibold text-green-900">
                {usuarioInfo.agenciaPrincipal?.nombre}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <h4 className="font-bold">Datos del Cliente</h4>


        <h4 className="font-bold">Datos de la Venta</h4>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="fecha"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Fecha de la venta *
            </label>
            <input
              id="fecha"
              type="date"
              name="fecha"
              value={venta.fecha}
              onChange={handleVentaChange}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label
              htmlFor="origenId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Origen *
            </label>
            <select
              id="origenId"
              name="origenId"
              value={venta.origenId}
              onChange={(e) => {
                const id = Number(e.target.value);
                const origen = origenes.find((o) => o.id === id);

                setVenta((prev) => ({ ...prev, origenId: id }));
                setOrigenSeleccionado(origen || null);
              }}
              required
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Seleccionar origen</option>
              {origenes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="observacion"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Observación
            </label>

            <select
              id="observacion"
              name="observacion"
              value={venta.observacion}
              onChange={handleVentaChange}
              className="w-full border border-gray-300 p-2 rounded bg-white
               focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Seleccione una observación</option>
              <option value="Luis">Luis</option>
              <option value="Uphone">Uphone</option>
              <option value="Creditv">Creditv</option>
              <option value="Anais">Anais</option>
              <option value="Bryan">Bryan</option>
              <option value="Andres">Andres</option>
              <option value="Damian">Damian</option>
              <option value="Elizeth">Elizeth</option>
              <option value="Oscar">Oscar</option>
              <option value="Alejandra">Alejandra</option>
              <option value="Damaris">Damaris</option>
              <option value="Mirka">Mirka</option>
              <option value="Fernando">Fernando</option>
              <option value="Mateo">Mateo</option>
              <option value="Raul">Raul</option>
              <option value="Steeven Furgo">Steeven Furgo</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded"
        >
          {loading ? "Guardando..." : "Guardar Venta"}
        </button>
      </form>
    </div>
  );
};

export default CrearVentaCompleta;
