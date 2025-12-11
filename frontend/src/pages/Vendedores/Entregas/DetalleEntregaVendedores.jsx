import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../../config";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";

export default function DetalleEntregaVendedores() {
  const { id } = useParams();
  const entregaId = id;
  const navigate = useNavigate();
  const location = useLocation();

  const cliente = location.state?.cliente;

  const [detalles, setDetalles] = useState([]);
  const [dispositivoMarcas, setDispositivoMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [formasPago, setFormasPago] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    entregaId: entregaId,
    cantidad: "1",
    precioUnitario: "0",
    dispositivoMarcaId: "",
    modeloId: "",
    contrato: "",
    formaPagoId: "",
    entrada: "0",
    alcance: "0",
    ubicacion: "",
    ubicacionDispositivo: "",
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, entregaId: entregaId }));

    if (entregaId) {
      fetchEntregaInfo();
      fetchDetalles();
      fetchSelects();
    }
  }, [entregaId]);

  const fetchEntregaInfo = async () => {
    try {
      await axios.get(`${API_URL}/entregas/${entregaId}`);
    } catch (err) {
      console.error("Error al obtener info de entrega:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetalles = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/detalle-entrega/entrega/${entregaId}`
      );
      setDetalles(res.data);
    } catch (err) {
      console.error("Error al obtener detalles:", err);
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

  // PRECIO UNITARIO AL CAMBIAR MODELO O FORMA PAGO
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
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (["cantidad", "precioUnitario", "entrada", "alcance"].includes(name)) {
      setForm((prev) => ({ ...prev, [name]: value }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.modeloId || !form.formaPagoId) {
      Swal.fire({
        icon: "warning",
        title: "Campos incompletos",
        text: "Selecciona modelo y forma de pago",
      });
      return;
    }

    try {
      const detalleData = {
        ...form,
        entregaId: entregaId,
        cantidad: parseFloat(form.cantidad) || 0,
        precioUnitario: parseFloat(form.precioUnitario) || 0,
        entrada: parseFloat(form.entrada) || 0,
        alcance: parseFloat(form.alcance) || 0,
        subtotal:
          (parseFloat(form.cantidad) || 0) *
          (parseFloat(form.precioUnitario) || 0),
      };

      await axios.post(`${API_URL}/detalle-entrega`, detalleData);

      fetchDetalles();

      setForm({
        entregaId: entregaId,
        cantidad: "1",
        precioUnitario: "0",
        dispositivoMarcaId: "",
        modeloId: "",
        contrato: "",
        formaPagoId: "",
        entrada: "0",
        alcance: "0",
        ubicacion: "",
        ubicacionDispositivo: "",
      });
      setModelos([]);
    } catch (err) {
      console.error("Error al crear detalle:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || err.message,
      });
    }
  };

  const handleFinalizarEntrega = async () => {
    if (detalles.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "Sin productos",
        text: "Debe agregar al menos un producto.",
      });
      return;
    }

    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "¿Finalizar entrega?",
      text: "No podrás deshacer esto.",
      showCancelButton: true,
      confirmButtonText: "Sí, finalizar",
      cancelButtonText: "Cancelar",
    });

    if (isConfirmed) {
      try {
        await Swal.fire({
          icon: "success",
          title: "Entrega finalizada",
          text: "Entrega finalizada correctamente.",
        });

        navigate(`/entregas/${entregaId}/obsequios`, {
          state: { cliente: cliente },
        });
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Error al finalizar entrega",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando detalles de entrega...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-orange-600">
              Información de la Entrega
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
          <div>
            <p className="text-sm text-gray-500">
              Productos agregados: {detalles.length}
            </p>
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-orange-600 mb-4">
          Agregar Producto
        </h2>

        <form
          onSubmit={handleSubmit}
          className="mb-6 p-6 border border-orange-500 rounded-lg bg-white shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* IZQUIERDA */}
            <div className="space-y-4">
              {/* Dispositivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dispositivo y Marca *
                </label>
                <select
                  name="dispositivoMarcaId"
                  value={form.dispositivoMarcaId}
                  onChange={handleDispositivoMarcaChange}
                  className="w-full p-2 border border-orange-500 rounded"
                  required
                >
                  <option value="">Selecciona</option>
                  {dispositivoMarcas.map((dm) => (
                    <option key={dm.id} value={dm.id}>
                      {dm.dispositivo?.nombre} - {dm.marca?.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modelo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modelo *
                </label>
                <select
                  name="modeloId"
                  value={form.modeloId}
                  onChange={handleChange}
                  className="w-full p-2 border border-orange-500 rounded"
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

              {/* Contrato */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contrato
                </label>
                <input
                  type="text"
                  name="contrato"
                  value={form.contrato}
                  onChange={handleChange}
                  className="w-full p-2 border border-orange-500 rounded"
                  placeholder="Número de contrato"
                />
              </div>

              {/* UBICACIÓN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación del Cliente
                </label>
                <input
                  type="text"
                  name="ubicacion"
                  placeholder="Pegar la url"
                  value={form.ubicacion}
                  onChange={handleChange}
                  className="w-full p-2 border border-orange-500 rounded"
                />
              </div>
            </div>

            {/* DERECHA */}
            <div className="space-y-4">
              {/* Forma de pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Pago *
                </label>
                <select
                  name="formaPagoId"
                  value={form.formaPagoId}
                  onChange={handleChange}
                  className="w-full p-2 border border-orange-500 rounded"
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

              {/* Cantidad & Precio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    name="cantidad"
                    min="1"
                    value={form.cantidad}
                    readOnly
                    className="w-full p-2 border border-orange-500 bg-gray-50 rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio Unitario
                  </label>
                  <input
                    type="number"
                    name="precioUnitario"
                    value={form.precioUnitario}
                    readOnly
                    className="w-full p-2 border border-orange-500 bg-gray-50 rounded"
                  />
                </div>
              </div>

              {/* Entrada + Alcance */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entrada
                  </label>
                  <input
                    type="number"
                    name="entrada"
                    value={form.entrada}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full p-2 border border-orange-500 rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alcance
                  </label>
                  <input
                    type="number"
                    name="alcance"
                    value={form.alcance}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full p-2 border border-orange-500 rounded"
                  />
                </div>
              </div>

              {/* Ubicación del dispositivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ubicación exacta del dispositivo
                </label>
                <input
                  type="text"
                  name="ubicacionDispositivo"
                  placeholder="Ej: Oficinas Creditek"
                  value={form.ubicacionDispositivo}
                  onChange={handleChange}
                  className="w-full p-2 border border-orange-500 rounded"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded"
            >
              Agregar Producto a la Entrega
            </button>
          </div>
        </form>
      </div>

      {/* TABLA PRODUCTOS */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-orange-600 mb-4">
          Productos Agregados ({detalles.length})
        </h2>

        {detalles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border border-orange-500 rounded-lg">
              <thead className="bg-orange-500 text-white">
                <tr>
                  <th className="p-3 border">#</th>
                  <th className="p-3 border">Producto</th>
                  <th className="p-3 border">Modelo</th>
                  <th className="p-3 border">Cantidad</th>
                  <th className="p-3 border">Precio</th>
                  <th className="p-3 border">Forma Pago</th>
                  <th className="p-3 border">Contrato</th>
                  <th className="p-3 border">Ubicación</th>
                  <th className="p-3 border">Ubicación Disp.</th>
                </tr>
              </thead>

              <tbody>
                {detalles.map((d, index) => (
                  <tr key={d.id} className="border-b hover:bg-orange-50">
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
                      ${(d.cantidad * parseFloat(d.precioUnitario)).toFixed(2)}
                    </td>
                    <td className="p-3 border">
                      {formasPago.find((fp) => fp.id === d.formaPagoId)
                        ?.nombre || "-"}
                    </td>
                    <td className="p-3 border">{d.contrato || "-"}</td>

                    {/* NUEVOS CAMPOS */}
                    <td className="p-3 border">{d.ubicacion || "-"}</td>
                    <td className="p-3 border">
                      {d.ubicacionDispositivo || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="bg-orange-100">
                <tr>
                  <td colSpan="5" className="p-3 border text-right font-bold">
                    Total:
                  </td>
                  <td
                    colSpan="4"
                    className="p-3 border font-bold text-orange-700"
                  >
                    $
                    {detalles
                      .reduce(
                        (total, d) =>
                          total + d.cantidad * parseFloat(d.precioUnitario),
                        0
                      )
                      .toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed border-orange-300 rounded-lg">
            <p className="text-gray-500">No hay productos agregados.</p>
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex justify-between">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
        >
          Volver
        </button>

        {detalles.length > 0 && (
          <button
            onClick={handleFinalizarEntrega}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded"
          >
            Obsequios
          </button>
        )}
      </div>
    </div>
  );
}
