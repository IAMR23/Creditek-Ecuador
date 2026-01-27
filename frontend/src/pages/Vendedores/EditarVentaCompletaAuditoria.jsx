import { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import imageCompression from "browser-image-compression";
import { useNavigate, useParams } from "react-router-dom";

const EditarVentaCompletaAuditoria = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();

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

  const hoy = new Date().toLocaleDateString("en-CA");

  const [cliente, setCliente] = useState({
    cliente: "",
    cedula: "",
    telefono: "",
  });

  const [venta, setVenta] = useState({
    usuarioAgenciaId: null,
    origenId: "",
    observacion: "",
    fecha: "",
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

  const [obsequios, setObsequios] = useState([]);
  const [obsequiosDisponibles, setObsequiosDisponibles] = useState([]);
  useEffect(() => {
    const fetchSelects = async () => {
      const [dmRes, fpRes] = await Promise.all([
        axios.get(`${API_URL}/dispositivoMarca`),
        axios.get(`${API_URL}/formaPago`),
      ]);
      setDispositivoMarcas(dmRes.data);
      setFormasPago(fpRes.data);
    };
    fetchSelects();
  }, []);

  useEffect(() => {
    axios.get(`${API_URL}/obsequios`).then((res) => {
      setObsequiosDisponibles(res.data);
    });
  }, []);

  useEffect(() => {
    const cargarVenta = async () => {
      try {
        const res = await axios.get(
          `${API_URL}/registrar/venta-completa/${id}`,
        );

        const {
          cliente: clienteDB,
          venta: ventaDB,
          detalle: detalleDB,
          obsequios: obsequiosDB,
        } = res.data;

        // 🔹 Formatear fecha para input date
        const fechaFormateada = ventaDB?.fecha
          ? ventaDB.fecha.split("T")[0]
          : "";

        // 🔹 CLIENTE
        setCliente({
          cliente: clienteDB?.cliente || "",
          cedula: clienteDB?.cedula || "",
          telefono: clienteDB?.telefono || "",
        });

        // 🔹 VENTA
        setVenta({
          ...ventaDB,
          origenId: Number(ventaDB?.origenId) || "",
          fecha: fechaFormateada,
        });

        // 🔹 DETALLE (normalizando tipos)
        setDetalle({
          ...detalleDB,
          dispositivoMarcaId: String(detalleDB?.dispositivoMarcaId || ""),
          modeloId: Number(detalleDB?.modeloId) || "",
          formaPagoId: Number(detalleDB?.formaPagoId) || "",
        });

        // 🔹 OBSEQUIOS
        setObsequios(
          obsequiosDB?.map((o) => ({
            obsequioId: o.obsequioId,
            cantidad: o.cantidad,
          })) || [],
        );

        // 🔹 Cargar modelos del dispositivo seleccionado (CLAVE)
        if (detalleDB?.dispositivoMarcaId) {
          const resModelos = await axios.get(
            `${API_URL}/dispositivoMarca/${detalleDB.dispositivoMarcaId}`,
          );
          setModelos(resModelos.data || []);
        }

        // 🔹 Foto preview
        if (ventaDB?.fotoValidacion) {
          setPreview(`${API_URL}${ventaDB.fotoValidacion}`);
        }
      } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudo cargar la venta", "error");
      }
    };

    cargarVenta();
  }, [id]);

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

  const handleClienteChange = (e) =>
    setCliente({ ...cliente, [e.target.name]: e.target.value });

  const handleVentaChange = (e) =>
    setVenta({ ...venta, [e.target.name]: e.target.value });

  const handleDetalleChange = (e) =>
    setDetalle({ ...detalle, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      const formData = new FormData();

      formData.append(
        "data",
        JSON.stringify({
          ventaId: id,
          cliente,
          venta,
          detalle,
          obsequios,
        }),
      );

      if (foto) {
        const options = { maxSizeMB: 0.4, maxWidthOrHeight: 1280 };
        const img = await imageCompression(foto, options);
        formData.append("foto", img);
      }

      await axios.put(`${API_URL}/registrar/venta-completa/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire("Actualizado", "Venta editada correctamente", "success");
      navigate("/ventas-auditoria");
    } catch (error) {
      Swal.fire("Error", "No se pudo editar la venta", "error");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const desactivarVenta = async () => {
    try {
      await axios.put(`${API_URL}/ventas/${id}`, {
        activo: false,
      });

      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        timer: 1500,
        showConfirmButton: false,
      });

      navigate("/ventas-auditoria");
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el estado",
      });
    }
  };

  const activarVenta = async () => {
    try {
      await axios.put(`${API_URL}/ventas/${id}`, {
        activo: true,
      });

      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        timer: 1500,
        showConfirmButton: true,
      });

      navigate("/ventas-auditoria");
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo actualizar el estado",
      });
    }
  };

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
              value={venta.fecha || hoy}
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

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 rounded-xl"
          >
            {loading ? "Guardando..." : "Guardar Venta"}
          </button>

          <button
            onClick={() => desactivarVenta()}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl"
          >
            Eliminar
          </button>

          <button
            onClick={() => activarVenta()}
            className="bg-yellow-400 hover:bg-yellow-700 text-white font-bold py-3 rounded-xl"
          >
            Activar
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditarVentaCompletaAuditoria;
