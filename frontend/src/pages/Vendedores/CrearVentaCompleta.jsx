import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import imageCompression from "browser-image-compression";

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
          `${API_URL}/precio/${detalle.modeloId}/${detalle.formaPagoId}`
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
        `${API_URL}/dispositivoMarca/${dispositivoMarcaId}`
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
        })
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
      console.log(texto);

      await navigator.clipboard.writeText(texto);
      Swal.fire(
        "Venta registrada",
        "La información fue copiada al portapapeles",
        "success"
      );

      Swal.fire("Éxito", "Venta creada y validada correctamente", "success");

      // 🔄 Reset
      setFoto(null);
      setPreview(null);
      setObsequios([]);
      setCliente({ cliente: "", cedula: "", telefono: "" });
      setVenta((prev) => ({ ...prev, origenId: "", observacion: "" }));
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudo crear la venta", "error");
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
 Fecha: ${venta.fecha ? new Date().toLocaleDateString("en-CA") : "N/A"}
Cliente:
- Nombre: ${cliente.cliente || "N/A"}
- Cédula: ${cliente.cedula || "N/A"}
- Teléfono: ${cliente.telefono || "N/A"}
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

        <div className="space-y-4">
          {/* Nombre del cliente */}
          <div>
            <label
              htmlFor="cliente"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nombre del cliente *
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
            <textarea
              id="observacion"
              name="observacion"
              placeholder="Detalle adicional de la venta"
              value={venta.observacion}
              onChange={handleVentaChange}
              rows={3}
              className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
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
                    (dm) => String(dm.id) === value
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
                    modelos.find((m) => m.id === value) || null
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
            <div className="grid grid-cols-2 gap-3">
              <div>
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

        <div>
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
      (obs) => obs.obsequioId === o.id
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
                  obs.obsequioId === o.id
                    ? { ...obs, cantidad }
                    : obs
                )
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
      <span className="text-gray-400">
        Vista previa de la imagen
      </span>
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
    </div>
  );
};

export default CrearVentaCompleta;
