import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import imageCompression from "browser-image-compression";
import { Link, useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { FaPen } from "react-icons/fa";

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

  const [textoVenta, setTextoVenta] = useState("");

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

  const handleClienteChange = (e) => {
    const { name, value } = e.target;

    // Solo números para cédula y teléfono
    if (name === "cedula" || name === "telefono") {
      const soloNumeros = value.replace(/\D/g, ""); // elimina letras
      if (soloNumeros.length <= 10) {
        setCliente({ ...cliente, [name]: soloNumeros });
      }
      return;
    }

    setCliente({ ...cliente, [name]: value });
  };

  const handleVentaChange = (e) =>
    setVenta({ ...venta, [e.target.name]: e.target.value });

  const handleDetalleChange = (e) =>
    setDetalle({ ...detalle, [e.target.name]: e.target.value });


  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    setLoading(true);

    const formData = new FormData();

    const cedula = String(cliente.cedula || "").trim();
    const telefono = String(cliente.telefono || "").trim();

    // Validar cédula
    if (!/^\d{10}$/.test(cedula)) {
      Swal.fire(
        "Error",
        "La cédula debe tener exactamente 10 dígitos numéricos",
        "error"
      );
      return;
    }

    // Validar teléfono
    if (!/^\d{10}$/.test(telefono)) {
      Swal.fire(
        "Error",
        "El teléfono debe tener exactamente 10 dígitos numéricos",
        "error"
      );
      return;
    }

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
      })
    );

    // 🔹 Solo si existe foto
    if (foto) {
      const options = {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      };

      const imagenComprimida = await imageCompression(foto, options);
      formData.append("foto", imagenComprimida);
    }

    const token = localStorage.getItem("token");

    const response = await axios.post(
      `${API_URL}/registrar/ventas-completas`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      }
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

    const result = await Swal.fire({
      title: "Venta registrada",
      text: "¿Quieres copiar la información?",
      icon: "success",
      showCancelButton: true,
      confirmButtonText: "Copiar",
      cancelButtonText: "No",
    });

    if (result.isConfirmed) {
      await copiarTexto(texto);
    }

    // Reset
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

    setVenta((prev) => ({
      ...prev,
      origenId: "",
      observacion: "",
    }));

    navigate("/vendedor-panel");

  } catch (error) {
    console.error(error);

    const mensaje =
      error.response?.data?.message || "No se pudo crear la venta";

    Swal.fire("Error", mensaje, "error");

  } finally {
    setLoading(false);
  }
};


  const [id, setId] = useState(null);
  const [entregaIdInput, setEntregaIdInput] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [entregas, setEntregas] = useState([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [filas, setFilas] = useState([]);

  const cargarEntregas = async () => {
    if (!usuarioInfo?.id) return;

    setLoadingEntregas(true);
    setError("");

    try {
      const url = `${API_URL}/vendedor/entrega/${usuarioInfo.id}?page=${page}&limit=${limit}`;
      const { data } = await axios.get(url);

      if (!data.ok) return;

      setTotalPages(data.totalPages || 1);
      const ventas = data.entrega || [];
      const resultado = ventas.map((entrega) => ({
        id: entrega.id,
        Fecha: `${entrega.dia ?? ""} ${entrega.fecha ?? ""}`,
        Cliente: entrega.cliente ?? "",
        Dispositivo:
          `${entrega.tipo ?? ""} ${entrega.marca ?? ""} ${entrega.modelo ?? ""}`
            .toUpperCase()
            .trim(),
        Precio:
          entrega.precioVendedor != null ? `$${entrega.precioVendedor}` : "",
        "Forma Pago": entrega.formaPago ?? "",
        Entrada: entrega.entrada ?? "",
        Alcance: entrega.alcance ?? "",
        Estado: entrega.estado ?? "",
      }));

      setFilas(resultado);
    } catch (error) {
      setError("Error al cargar las entregas");
    } finally {
      setLoadingEntregas(false);
    }
  };

  useEffect(() => {
    if (showModal && usuarioInfo?.id) {
      cargarEntregas();
    }
  }, [showModal, usuarioInfo, page]);

  const seleccionarEntrega = async (id) => {
    setShowModal(false);
    await cargarEntregaPorId(id); // reutiliza tu lógica actual
  };

  const cargarEntregaPorId = async (id) => {
    if (!id) {
      Swal.fire("Atención", "ID de entrega no válido", "warning");
      return;
    }

    try {
      const res = await axios.get(
        `${API_URL}/registrar2/entrega-completa/${id}`,
      );

      const {
        cliente: clienteDB,
        entrega: entregaDB,
        detalle: detalleDB,
        obsequios: obsequiosDB,
      } = res.data;

      const fechaFormateada = entregaDB?.fecha
        ? entregaDB.fecha.split("T")[0]
        : "";

      // =========================
      // CLIENTE
      // =========================
      setCliente({
        cliente: clienteDB?.cliente || "",
        cedula: clienteDB?.cedula || "",
        telefono: clienteDB?.telefono || "",
        correo: clienteDB?.correo || "",
        direccion: clienteDB?.direccion || "",
      });

      setVenta((prev) => ({
        ...prev, // mantiene fecha y observacion actuales
        usuarioAgenciaId: entregaDB?.usuarioAgenciaId ?? null,
        origenId: Number(entregaDB?.origenId) || "",
      }));

      const origenEncontrado = origenes.find(
        (o) => o.id === Number(entregaDB?.origenId),
      );

      setOrigenSeleccionado(origenEncontrado || null);

      // =========================
      // DETALLE (IDs)
      // =========================
      const dispositivoMarcaId = Number(detalleDB?.dispositivoMarcaId) || "";
      const modeloId = Number(detalleDB?.modeloId) || "";
      const formaPagoId = Number(detalleDB?.formaPagoId) || "";

      setDetalle({
        ...detalleDB,
        dispositivoMarcaId: String(dispositivoMarcaId),
        modeloId,
        formaPagoId,
        cantidad: Number(detalleDB?.cantidad) || 1,
        precioUnitario: detalleDB?.precioUnitario?.toString() || "",
        precioVendedor: detalleDB?.precioVendedor?.toString() || "",
        entrada: detalleDB?.entrada?.toString() || "",
        alcance: detalleDB?.alcance?.toString() || "",
      });

      // =========================
      // ESTADOS DERIVADOS 🔥
      // =========================

      // Dispositivo + Marca
      const dispositivo = dispositivoMarcas.find(
        (dm) => dm.id === dispositivoMarcaId,
      );
      setDispositivoMarcaSeleccionado(dispositivo || null);

      // Forma de pago
      const forma = formasPago.find((f) => f.id === formaPagoId);
      setFormaPagoSeleccionada(forma || null);

      // =========================
      // OBSEQUIOS
      // =========================
      setObsequios(
        obsequiosDB?.map((o) => ({
          obsequioId: o.obsequioId,
          cantidad: o.cantidad,
        })) || [],
      );

      // =========================
      // MODELOS + MODELO SELECCIONADO
      // =========================
      if (dispositivoMarcaId) {
        const resModelos = await axios.get(
          `${API_URL}/dispositivoMarca/${dispositivoMarcaId}`,
        );

        const modelosData = resModelos.data || [];
        setModelos(modelosData);

        const modelo = modelosData.find((m) => m.id === modeloId);

        setModeloSeleccionado(modelo || null);
      } else {
        setModelos([]);
        setModeloSeleccionado(null);
      }

      Swal.fire("OK", "Entrega cargada correctamente", "success");
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se encontró la entrega", "error");
    }
  };

  const copiarTexto = async (texto) => {
    try {
      if (!texto) throw new Error("Texto vacío");

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = texto;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy"); // fallback legacy
        document.body.removeChild(textarea);
      }

      // Toast tipo SaaS (no bloquea UI)
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Copiado al portapapeles",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error("Error al copiar:", err);

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "error",
        title: "No se pudo copiar",
        showConfirmButton: false,
        timer: 2000,
      });
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
    "Steeven Chavez",
    "Jeje Alexis",
    "Ing Gaby",
    "Steeven Furgo",
    "Javier",
    "Joel",
  ];

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

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
        >
          Buscar entrega
        </button>

        <div className="space-y-4">
          {/* Nombre del cliente */}
          <div>
            <label
              htmlFor="cliente"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nombre Completo *
            </label>
            <input
              id="cliente"
              type="text"
              name="cliente"
              placeholder="Ej: Juan Pérez"
              value={cliente.cliente}
              onChange={handleClienteChange}
              required
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Cédula */}
          <div>
            <label
              htmlFor="cedula"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Cédula *
            </label>
            <input
              id="cedula"
              type="text"
              name="cedula"
              placeholder="Ej: 0102030405"
              value={cliente.cedula}
              onChange={handleClienteChange}
              required
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          {/* Teléfono */}
          <div>
            <label
              htmlFor="telefono"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Teléfono
            </label>
            <input
              id="telefono"
              type="text"
              name="telefono"
              placeholder="Ej: 0991234567"
              value={cliente.telefono}
              onChange={handleClienteChange}
              required
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          {/* Correo */}
          <div>
            <label
              htmlFor="correo"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Correo Electronico
            </label>
            <input
              id="correo"
              type="email"
              name="correo"
              placeholder="Ej: soycreditek@gmail.com"
              value={cliente.correo}
              onChange={handleClienteChange}
              required
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          {/* Direccion */}
          <div>
            <label
              htmlFor="direccion"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Dirección
            </label>
            <input
              id="direccion"
              type="text"
              name="direccion"
              placeholder="Sangolqui, Parque Turismo"
              value={cliente.direccion}
              onChange={handleClienteChange}
              required
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>

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
              className="w-full border border-gray-300 p-2 rounded
           focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Ninguna</option>
              {observaciones.map((obs) => (
                <option key={obs} value={obs}>
                  {obs}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h4 className="font-bold">Producto</h4>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dispositivo y Marca *
              </label>
              <select
                name="dispositivoMarcaId"
                value={detalle.dispositivoMarcaId}
                onChange={(e) => {
                  const value = e.target.value; // STRING

                  // Guardar el ID (string)
                  setDetalle((prev) => ({
                    ...prev,
                    dispositivoMarcaId: value,
                    modeloId: "", // reset modelo
                  }));

                  // Buscar el objeto completo
                  const seleccionado = dispositivoMarcas.find(
                    (dm) => String(dm.id) === value,
                  );

                  setDispositivoMarcaSeleccionado(seleccionado || null);

                  // Cargar modelos si existe
                  if (seleccionado) {
                    axios
                      .get(`${API_URL}/dispositivoMarca/${seleccionado.id}`)
                      .then((res) => setModelos(res.data))
                      .catch(console.error);
                  } else {
                    setModelos([]);
                  }
                }}
                className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">Selecciona Dispositivo y Marca</option>
                {dispositivoMarcas.map((dm) => (
                  <option key={dm.id} value={dm.id}>
                    {dm.dispositivo?.nombre} - {dm.marca?.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modelo *
              </label>

              <select
                name="modeloId"
                value={detalle.modeloId}
                onChange={(e) => {
                  const value = Number(e.target.value);

                  setDetalle((prev) => ({
                    ...prev,
                    modeloId: value,
                  }));

                  setModeloSeleccionado(
                    modelos.find((m) => m.id === value) || null,
                  );
                }}
                className="w-full p-2 border border-green-500 rounded"
                required
                disabled={!detalle.dispositivoMarcaId}
              >
                <option value="">Selecciona Modelo</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Forma de Pago *
              </label>
              <select
                name="formaPagoId"
                value={detalle.formaPagoId}
                onChange={(e) => {
                  const value = e.target.value;

                  if (!value) {
                    setDetalle((prev) => ({ ...prev, formaPagoId: "" }));
                    setFormaPagoSeleccionada(null);
                    return;
                  }

                  const id = Number(value);
                  const forma = formasPago.find((f) => f.id === id);

                  setDetalle((prev) => ({ ...prev, formaPagoId: id }));
                  setFormaPagoSeleccionada(forma || null);
                }}
                className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">Selecciona Forma de Pago</option>
                {formasPago.map((fp) => (
                  <option key={fp.id} value={fp.id}>
                    {fp.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="hidden">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad *
                </label>
                <input
                  type="number"
                  name="cantidad"
                  placeholder="Cantidad"
                  min="1"
                  value={detalle.cantidad}
                  onChange={handleChange}
                  step="1"
                  className="w-full p-2 border border-green-500 bg-gray-50 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Precio *
                </label>

                <input
                  type="text"
                  name="precioVendedor"
                  placeholder="Ej: 10.50"
                  value={detalle.precioVendedor}
                  onChange={(e) => {
                    let value = e.target.value.replace(",", ".");

                    // Regex: números + punto opcional + 2 decimales
                    const regex = /^\d*\.?\d{0,2}$/;

                    if (regex.test(value)) {
                      setDetalle((prev) => ({
                        ...prev,
                        precioVendedor: value,
                      }));
                    }
                  }}
                  required
                  className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entrada
                </label>
                <input
                  type="text"
                  name="entrada"
                  placeholder="Ej: 50.00"
                  value={detalle.entrada}
                  onChange={(e) => {
                    let value = e.target.value.replace(",", ".");

                    // Permite números con hasta 2 decimales
                    const regex = /^\d*\.?\d{0,2}$/;

                    if (regex.test(value)) {
                      setDetalle((prev) => ({
                        ...prev,
                        entrada: value,
                      }));
                    }
                  }}
                  className="w-full p-2 border border-green-500 rounded
             focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alcance
                </label>

                <input
                  type="text"
                  name="alcance"
                  placeholder="Ej: 10.50"
                  value={detalle.alcance}
                  onChange={(e) => {
                    let value = e.target.value.replace(",", ".");

                    // números + punto opcional + hasta 2 decimales
                    const regex = /^\d*\.?\d{0,2}$/;

                    if (regex.test(value)) {
                      setDetalle((prev) => ({
                        ...prev,
                        alcance: value,
                      }));
                    }
                  }}
                  className="w-full p-2 border border-green-500 rounded
             focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contrato
          </label>
          <input
            type="number"
            name="contrato"
            placeholder="Número de contrato"
            value={detalle.contrato}
            onChange={handleChange}
            className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Observación
          </label>
          <textarea
            name="observacionDetalle"
            placeholder="El cliente va a cancelar la entrada en dos pagos bajo mi responsabilidad..."
            value={detalle.observacionDetalle}
            onChange={handleChange}
            rows={3}
            className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          🎁 Obsequios
        </h4>

        <div className="space-y-3">
          {obsequiosDisponibles.map((o) => {
            const obsSeleccionado = obsequios.find(
              (obs) => obs.obsequioId === o.id,
            );

            const toggleSeleccion = () => {
              setObsequios((prev) => {
                if (obsSeleccionado) {
                  return prev.filter((obs) => obs.obsequioId !== o.id);
                } else {
                  return [...prev, { obsequioId: o.id, cantidad: 1 }];
                }
              });
            };

            return (
              <div
                key={o.id}
                onClick={toggleSeleccion}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer select-none transition
          ${
            obsSeleccionado
              ? "border-green-500 bg-green-50"
              : "border-gray-200 bg-white hover:border-green-300"
          }`}
              >
                {/* CHECKBOX */}
                <input
                  type="checkbox"
                  checked={!!obsSeleccionado}
                  onChange={() => {}}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-5 accent-green-600 cursor-pointer"
                />

                {/* TEXTO CLICKEABLE */}
                <span className="flex-1 text-sm font-medium text-gray-700">
                  {o.nombre}
                </span>

                {/* CANTIDAD */}
                {obsSeleccionado && (
                  <input
                    type="number"
                    min="1"
                    value={obsSeleccionado.cantidad}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const cantidad = parseInt(e.target.value) || 1;
                      setObsequios((prev) =>
                        prev.map((obs) =>
                          obs.obsequioId === o.id ? { ...obs, cantidad } : obs,
                        ),
                      );
                    }}
                    className="w-20 px-2 py-1 text-sm text-center rounded-lg border border-green-400 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white p-4 rounded shadow border border-green-500">
          <h2 className="text-lg font-semibold text-green-600 mb-4">
            Toma o selecciona una foto
          </h2>

          {/* CONTENEDOR FIJO */}
          <div className="w-full h-64 border rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
            {preview ? (
              <img
                src={preview}
                alt="preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-gray-400">Vista previa de la imagen</span>
            )}
          </div>

          {/* INPUT FILE */}
          <label className="block mt-4">
            <span className="text-green-600 font-semibold">Elegir foto:</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFoto}
              className="block mt-2"
            />
            <p className="text-sm text-gray-500">
              (Usa la cámara directamente o selecciona una imagen)
            </p>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded"
        >
          {loading ? "Guardando..." : "Guardar Venta"}
        </button>
      </form>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-[95%] max-w-5xl rounded-lg p-4 shadow-lg">
            <h3 className="text-lg font-bold mb-4">Seleccionar Entrega</h3>

            {loadingEntregas ? (
              <p>Cargando...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : (
              <>
                <div className="max-h-[400px] overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Cliente</th>
                        <th className="p-2">Dispositivo</th>
                        <th className="p-2">Precio</th>
                        <th className="p-2">Estado</th>
                        <th className="p-2">Acción</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filas.map((f) => (
                        <tr key={f.id} className="border-t hover:bg-gray-50">
                          <td className="p-2">{f.Fecha}</td>
                          <td className="p-2">{f.Cliente}</td>
                          <td className="p-2">{f.Dispositivo}</td>
                          <td className="p-2">{f.Precio}</td>
                          <td className="p-2">{f.Estado}</td>
                          <td className="p-2">
                            <button
                              onClick={() => seleccionarEntrega(f.id)}
                              className="bg-green-600 text-white px-2 py-1 rounded"
                            >
                              Usar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PAGINACIÓN */}
                <div className="flex justify-between items-center mt-4">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Anterior
                  </button>

                  <span className="text-sm">
                    Página {page} de {totalPages}
                  </span>

                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrearVentaCompleta;
