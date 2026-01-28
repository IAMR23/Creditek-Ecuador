import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";

export default function DetalleVenta() {
  const { id } = useParams();
  const ventaId = id;
  const navigate = useNavigate();
  const location = useLocation();

  const cliente = location.state?.cliente;

  const [detalles, setDetalles] = useState([]);
  const [dispositivoMarcas, setDispositivoMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [formasPago, setFormasPago] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    ventaId,
    cantidad: "1",
    precioUnitario: "0", // 🔒 oculto
    precioVendedor: "0", // 👁 visible
    dispositivoMarcaId: "",
    modeloId: "",
    contrato: "",
    formaPagoId: "",
    entrada: "0",
    alcance: "0",
    observacionDetalle: "",
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, ventaId: ventaId }));

    if (ventaId) {
      fetchVentaInfo();
      fetchDetalles();
      fetchSelects();
    }
  }, [ventaId]);

  const fetchVentaInfo = async () => {
    try {
      await axios.get(`${API_URL}/ventas/${ventaId}`);
    } catch (err) {
      console.error("Error al obtener información de la venta:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetalles = async () => {
    try {
      const res = await axios.get(`${API_URL}/detalle-venta/venta/${ventaId}`);
      setDetalles(res.data);
    } catch (err) {
      console.error("Error al obtener detalles de venta:", err);
    }
  };

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

  useEffect(() => {
    const fetchPrecio = async () => {
      const { modeloId, formaPagoId } = form;
      if (!modeloId || !formaPagoId) return;

      try {
        const res = await axios.get(
          `${API_URL}/precio/${modeloId}/${formaPagoId}`
        );
        setForm((prev) => ({
          ...prev,
          precioUnitario: res.data.precio?.toString() || "0",
        }));
      } catch (err) {
        console.error(err);
        setForm((prev) => ({ ...prev, precioUnitario: "0" }));
      }
    };

    fetchPrecio();
  }, [form.modeloId, form.formaPagoId]);

  const handleDispositivoMarcaChange = async (e) => {
    const dispositivoMarcaId = e.target.value;
    setForm((prev) => ({ ...prev, dispositivoMarcaId, modeloId: "" }));

    if (!dispositivoMarcaId) {
      setModelos([]);
      return;
    }
    try {
      const res = await axios.get(
        `${API_URL}/dispositivoMarca/${dispositivoMarcaId}`
      );
      setModelos(res.data);
      console.log(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  console.log(modelos)

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Permitimos que campos numéricos puedan ser vacíos para editar libremente
    if (["cantidad", "precioUnitario", "entrada", "alcance"].includes(name)) {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const detalleData = {
      ...form,
      ventaId,
      cantidad: parseInt(form.cantidad),
      precioUnitario: parseFloat(form.precioUnitario), // oculto
      precioVendedor: parseFloat(form.precioVendedor), // manual
      entrada: parseFloat(form.entrada || 0),
      alcance: parseFloat(form.alcance || 0),
      subtotal: parseInt(form.cantidad) * parseFloat(form.precioVendedor),
      observacionDetalle: form.observacionDetalle || null,
    };

    await axios.post(`${API_URL}/detalle-venta`, detalleData);

    await fetchDetalles();

    // ✅ LIMPIA FORMULARIO (opcional)
    setForm((prev) => ({
      ...prev,
      modeloId: "",
      contrato: "",
      formaPagoId: "",
      entrada: "0",
      alcance: "0",
      observacionDetalle: "",
      precioVendedor: "0",
    }));
  };

  const handleFinalizarVenta = async () => {
    if (detalles.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin productos",
        text: "Debe agregar al menos un producto antes de finalizar la venta",
      });
      return;
    }

    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "Finalizar venta",
      text: "¿Está seguro de finalizar esta venta? Esta acción no se puede deshacer.",
      showCancelButton: true,
      confirmButtonText: "Sí, finalizar",
      cancelButtonText: "Cancelar",
    });

    if (isConfirmed) {
      try {
        await Swal.fire({
          icon: "success",
          title: "Venta finalizada",
          text: "Venta finalizada exitosamente!",
        });

        navigate(`/ventas/${ventaId}/obsequios`, {
          state: { cliente: cliente },
        });
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Error al finalizar la venta",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando detalles de venta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-green-600">
              Información de la Venta
            </h1>
            {cliente && (
              <p className="text-gray-700 mt-1">
                Cliente:{" "}
                <span className="font-semibold">{cliente.cliente}</span>
                {cliente.cedula && ` | Cédula: ${cliente.cedula}`}
                {cliente.telefono && ` | Teléfono: ${cliente.telefono}`}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Productos agregados: {detalles.length}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold text-green-600 mb-4">
          Agregar Producto
        </h2>

        <form
          onSubmit={handleSubmit}
          className="mb-6 p-6 border border-green-500 rounded-lg bg-white shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna izquierda */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dispositivo y Marca *
                </label>
                <select
                  name="dispositivoMarcaId"
                  value={form.dispositivoMarcaId}
                  onChange={handleDispositivoMarcaChange}
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
                  value={form.modeloId}
                  onChange={handleChange}
                  className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  required
                  disabled={!form.dispositivoMarcaId}
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
                  Contrato
                </label>
                <input
                  type="text"
                  name="contrato"
                  placeholder="Número de contrato"
                  value={form.contrato}
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
                  value={form.observacionDetalle}
                  onChange={handleChange}
                  rows={3}
                  className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Pago *
                </label>
                <select
                  name="formaPagoId"
                  value={form.formaPagoId}
                  onChange={handleChange}
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
                    value={form.cantidad}
                    onChange={handleChange}
                    step="1"
                    className="w-full p-2 border border-green-500 bg-gray-50 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    readOnly
                  />
                </div>

{/*                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Unitario
                  </label>
                  <input
                    type="number"
                    name="precioUnitario"
                    placeholder="Precio Unitario"
                    value={form.precioUnitario}
                    readOnly
                    className="w-full p-2 border border-green-500 rounded bg-gray-50"
                  />
                </div>
 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio *
                  </label>
                  <input
                    type="number"
                    name="precioVendedor"
                    placeholder="Ingrese el precio del vendedor"
                    value={form.precioVendedor}
                    onChange={handleChange}
                    step="0.01"
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
                    type="number"
                    name="entrada"
                    placeholder="Entrada"
                    value={form.entrada}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alcance
                  </label>
                  <input
                    type="number"
                    name="alcance"
                    placeholder="Alcance"
                    value={form.alcance}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full p-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded"
            >
              Agregar Producto a la Venta
            </button>
          </div>
        </form>
      </div>

      {/* Tabla de Productos */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-green-600">
            Productos Agregados ({detalles.length})
          </h2>
        </div>

        {detalles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border border-green-500 rounded-lg">
              <thead className="bg-green-500 text-white">
                <tr>
                  <th className="p-3 border text-left">#</th>
                  <th className="p-3 border text-left">Producto</th>
                  <th className="p-3 border text-left">Modelo</th>
                  <th className="p-3 border text-left">Cantidad</th>
                  <th className="p-3 border text-left">Precio</th>
                  <th className="p-3 border text-left">Forma de Pago</th>
                  <th className="p-3 border text-left">Contrato</th>
                  <th className="p-3 border text-left">Observación</th>
                </tr>
              </thead>

              <tbody>
                {detalles.map((d, index) => (
                  <tr key={d.id} className="border-b hover:bg-green-50">
                    <td className="p-3 border">{index + 1}</td>
                    <td className="p-3 border">
                      {d.dispositivoMarca?.dispositivo?.nombre} -{" "}
                      {d.dispositivoMarca?.marca?.nombre}
                    </td>
                    <td className="p-3 border">
                      {d.dispositivoMarca?.modelos?.find(
                        (m) => m.id === d.modeloId
                      )?.nombre || "-"}
                    </td>
                    <td className="p-3 border">{d.cantidad}</td>
                    <td className="p-3 border font-semibold">
                      $
                      {(d.cantidad * parseFloat(d.precioVendedor || 0)).toFixed(
                        2
                      )}
                    </td>
                    <td className="p-3 border">
                      {formasPago.find((fp) => fp.id === d.formaPagoId)
                        ?.nombre || "-"}
                    </td>
                    <td className="p-3 border">{d.contrato || "-"}</td>
                    <td className="p-3 border">
                      {d.observacionDetalle ? d.observacionDetalle : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="bg-green-100">
                <tr>
                  <td colSpan="6" className="p-3 border text-right font-bold">
                    Total de la venta:
                  </td>
                  <td
                    colSpan="3"
                    className="p-3 border font-bold text-green-700"
                  >
                    $
                    {detalles
                      .reduce(
                        (total, d) =>
                          total +
                          (d.cantidad || 0) * parseFloat(d.precioVendedor || 0),
                        0
                      )
                      .toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed border-green-300 rounded-lg">
            <p className="text-gray-500">
              No hay productos agregados a esta venta.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Agrega productos usando el formulario de arriba.
            </p>
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex justify-end items-center mb-4">
        {detalles.length > 0 && (
          <button
            onClick={handleFinalizarVenta}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded"
          >
            Obsequios
          </button>
        )}
      </div>
    </div>
  );
}
