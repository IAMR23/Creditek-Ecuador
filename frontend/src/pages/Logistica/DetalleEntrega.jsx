import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

export default function DetalleEntrega() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [observacionesLogistica, setObservacionesLogistica] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchEntrega = async () => {
      try {
        const { data } = await axios.get(
          `http://localhost:5020/vendedor/entrega-logistica/${id}`
        );

        if (data.ok) setForm(data.entrega);
      } catch (error) {
        console.error(error);
      }
    };
    fetchEntrega();
  }, [id]);

  if (!form)
    return <p className="text-green-600 font-semibold">Cargando entrega...</p>;

  const actualizarEstado = async (nuevoEstado) => {
    try {
      await axios.put(`http://localhost:5020/entregas/${id}`, {
        estado: nuevoEstado,
        observacionLogistica: observacionesLogistica,
      });

      alert(`Estado actualizado a: ${nuevoEstado}`);
      navigate("/entregas-logistica");
    } catch (error) {
      console.error(error);
      alert("Error al actualizar estado");
    }
  };

  const inputStyle =
    "w-full p-2 border border-green-300 rounded-lg bg-gray-100  cursor-not-allowed";

  return (
    <div className="max-w-4xl mx-auto p-6 bg-green-50 rounded-xl shadow-lg mt-6">
      <div className="grid md:grid-cols-2 gap-4 ">
        <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
          <label className="block font-semibold text-green-700">Vendedor</label>
          <input
            type="text"
            className={inputStyle}
            value={form.usuarioAgencia?.usuario?.nombre || ""}
            readOnly
          />
        </div>

        <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
          <label className="block font-semibold text-green-700">Agencia</label>
          <input
            type="text"
            className={inputStyle}
            value={form.usuarioAgencia?.agencia?.nombre || ""}
            readOnly
          />
        </div>
      </div>

      <form className="space-y-6">
        <h2 className="text-3xl font-bold text-green-600 border-b-2 border-green-500 pb-2">
          Detalle de Entrega
        </h2>

        {/* Cliente */}
        <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
          <h3 className="text-xl font-semibold text-green-700">Cliente</h3>

          <div className="grid md:grid-cols-3 gap-4">
            <input
              type="text"
              className={inputStyle}
              value={form.cliente?.nombre || ""}
              readOnly
            />
            <input
              type="text"
              className={inputStyle}
              value={form.cliente?.cedula || ""}
              readOnly
            />
            <input
              type="text"
              className={inputStyle}
              value={form.cliente?.telefono || ""}
              readOnly
            />
          </div>
        </div>

        {/* Origen */}
        <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
          <label className="block font-semibold text-green-700">Origen</label>
          <input
            type="text"
            className={inputStyle}
            value={form.origen?.nombre || ""}
            readOnly
          />
        </div>

        {/* Detalle de productos */}
        <div>
          <h3 className="text-2xl font-semibold text-green-600 mb-2">
            Detalle de Productos
          </h3>

          {form.detalleEntrega?.length === 0 && (
            <p className="text-gray-500 italic">
              No hay artículos registrados.
            </p>
          )}

          {form.detalleEntrega?.map((detalle) => (
            <div
              key={detalle.id}
              className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 space-y-2"
            >
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="text"
                  className={inputStyle}
                  value={`Modelo: ${detalle.modelo?.nombre || "-"}`}
                  readOnly
                />
                <input
                  type="text"
                  className={inputStyle}
                  value={`Marca: ${
                    detalle.dispositivoMarca?.marca?.nombre || "-"
                  }`}
                  readOnly
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="text"
                  className={inputStyle}
                  value={`Dispositivo: ${
                    detalle.dispositivoMarca?.dispositivo?.nombre || "-"
                  }`}
                  readOnly
                />
                <input
                  type="text"
                  className={inputStyle}
                  value={`Forma de Pago: ${detalle.formaPago?.nombre || "-"}`}
                  readOnly
                />
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <input
                  type="text"
                  className={inputStyle}
                  value={`Contrato: ${detalle.contrato || "-"}`}
                  readOnly
                />
                <input
                  type="text"
                  className={inputStyle}
                  value={`Entrada: $${detalle.entrada}`}
                  readOnly
                />
                <input
                  type="text"
                  className={inputStyle}
                  value={`Alcance: $${detalle.alcance}`}
                  readOnly
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  type="text"
                  className={inputStyle}
                  value={`Ubicación: ${detalle.ubicacion || "-"}`}
                  readOnly
                />

                <input
                  type="text"
                  className={inputStyle}
                  value={`Ubicación dispositivo: ${
                    detalle.ubicacionDispositivo || "-"
                  }`}
                  readOnly
                />
              </div>
            </div>
          ))}
        </div>

        {/* Obsequios */}
        <div>
          <h3 className="text-2xl font-semibold text-green-600 mb-2">
            Obsequios
          </h3>

          {form.obsequiosEntrega?.length === 0 && (
            <p className="text-gray-500 italic">
              No hay obsequios registrados.
            </p>
          )}

          {form.obsequiosEntrega?.map((ob) => (
            <div
              key={ob.id}
              className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 grid md:grid-cols-2 gap-4"
            >
              <input
                type="text"
                className={inputStyle}
                value={ob.obsequio?.nombre || "-"}
                readOnly
              />
              <input
                type="number"
                className={inputStyle}
                value={ob.cantidad}
                readOnly
              />
            </div>
          ))}
        </div>

        {/* Observaciones logística */}
        <div className="bg-green-200 p-4 rounded-lg shadow-inner space-y-2">
          <label className="block font-semibold text-green-800">
            Observaciones de Logística
          </label>

          <textarea
            className="w-full p-3 border border-green-400 rounded-lg bg-white"
            rows={4}
            placeholder="Escribe una observación..."
            value={observacionesLogistica}
            onChange={(e) => setObservacionesLogistica(e.target.value)}
          ></textarea>
        </div>

        {form.fotoValidacion && (
          <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2 mt-4">
            <h3 className="text-xl font-semibold text-green-700">
              Foto de Validación
            </h3>

            <img
              src={`http://localhost:5020${form.fotoValidacion}`}
              alt="Foto de validación"
              className="w-full max-w-sm rounded-lg border-2 border-green-400 shadow-md"
            />

            <a
              href={`http://localhost:5020${form.fotoValidacion}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline block mt-2"
            >
              Ver foto en tamaño completo
            </a>
          </div>
        )}

        {/* Botones */}
        <div className="grid md:grid-cols-3 gap-3 mt-6">
          <button
            type="button"
            onClick={() => actualizarEstado("Transito")}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg"
          >
            En tránsito
          </button>

          <button
            type="button"
            onClick={() => actualizarEstado("Revisar")}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg"
          >
            Regresar al Vendedor
          </button>
        </div>
      </form>
    </div>
  );
}
