import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../../config";
import Swal from "sweetalert2";

export default function VentaAuditoria() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [observacionesLogistica, setObservacionesLogistica] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchVenta = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/vendedor/venta/${id}`);
        if (data.ok) setForm(data.venta);
      } catch (error) {
        console.error(error);
      }
    };
    fetchVenta();
  }, [id]);

  if (!form)
    return <p className="text-green-600 font-semibold">Cargando Venta...</p>;

  const actualizarEstado = async (nuevoEstado) => {
    try {
      await axios.put(`${API_URL}/ventas/${id}`, {
        activo : false
      });


      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: `El estado cambió a: ${nuevoEstado}`,
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

  const inputStyle =
    "w-full p-2 border border-green-300 rounded-lg bg-gray-100 cursor-not-allowed";

  return (
    <div className="max-w-5xl mx-auto p-6 bg-green-50 rounded-2xl shadow-xl mt-8">
      {/* Vendedor y Agencia */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-green-100 p-5 rounded-xl shadow-md">
          <label className="font-semibold text-green-800">Vendedor</label>
          <input
            className={inputStyle}
            value={form.usuarioAgencia?.usuario?.nombre || ""}
            readOnly
          />
        </div>

        <div className="bg-green-100 p-5 rounded-xl shadow-md">
          <label className="font-semibold text-green-800">Agencia</label>
          <input
            className={inputStyle}
            value={form.usuarioAgencia?.agencia?.nombre || ""}
            readOnly
          />
        </div>
      </div>

      {/* Cliente */}
      <div className="bg-green-100 p-5 rounded-xl shadow-md mb-6">
        <h3 className="text-xl font-semibold text-green-800 mb-3">Cliente</h3>

        <div className="grid md:grid-cols-3 gap-4">
          <input
            className={inputStyle}
            value={form.cliente?.nombre || ""}
            readOnly
          />
          <input
            className={inputStyle}
            value={form.cliente?.cedula || ""}
            readOnly
          />
          <input
            className={inputStyle}
            value={form.cliente?.telefono || ""}
            readOnly
          />
        </div>
      </div>

      {/* Fecha */}
      <div className="bg-green-100 p-5 rounded-xl shadow-md mb-6">
        <label className="font-semibold text-green-800">Fecha</label>
        <input
          className={inputStyle}
          value={form.fecha?.substring(0, 10)}
          readOnly
        />
      </div>

      {/* Origen */}
      <div className="bg-green-100 p-5 rounded-xl shadow-md mb-6">
        <label className="font-semibold text-green-800">Origen</label>
        <input
          className={inputStyle}
          value={form.origen?.nombre || ""}
          readOnly
        />
      </div>

      {/* Detalle de productos */}
      <h3 className="text-2xl font-bold text-green-700 mb-3">
        Detalle de Productos
      </h3>

      {form.detalleVenta.map((detalle) => (
        <div
          key={detalle.id}
          className="bg-green-50 p-5 rounded-xl border border-green-200 mb-4"
        >
          <div className="grid md:grid-cols-2 gap-4 mb-3">
            <input
              className={inputStyle}
              value={`Modelo: ${detalle.modelo?.nombre}`}
              readOnly
            />
            <input
              className={inputStyle}
              value={`Marca: ${detalle.dispositivoMarca?.marca?.nombre}`}
              readOnly
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-3">
            <input
              className={inputStyle}
              value={`Dispositivo: ${detalle.dispositivoMarca?.dispositivo?.nombre}`}
              readOnly
            />
            <input
              className={inputStyle}
              value={`Forma de pago: ${detalle.formaPago?.nombre}`}
              readOnly
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-3">
            <input
              className={inputStyle}
              value={`Contrato: ${detalle.contrato}`}
              readOnly
            />
            <input
              className={inputStyle}
              value={`Entrada: $${detalle.entrada}`}
              readOnly
            />
            <input
              className={inputStyle}
              value={`Precio: $${detalle.precioUnitario}`}
              readOnly
            />
          </div>

          <textarea
            className="w-full p-2 border border-green-300 rounded-lg bg-gray-100"
            value={detalle.observacionDetalle || ""}
            readOnly
          />
        </div>
      ))}

      {/* Obsequios */}
      {form.obsequiosVenta.length > 0 && (
        <>
          <h3 className="text-2xl font-bold text-green-700 mb-3">Obsequios</h3>
          {form.obsequiosVenta.map((ob) => (
            <div
              key={ob.id}
              className="bg-green-50 p-4 rounded-xl border border-green-200 mb-3"
            >
              <input
                className={inputStyle}
                value={ob.obsequio?.nombre}
                readOnly
              />
            </div>
          ))}
        </>
      )}

      {form.fotoValidacion && (
        <div className="bg-green-100 p-5 rounded-xl shadow-md space-y-3 mt-6">
          <h3 className="text-xl font-semibold text-green-800">
            Foto de Respaldo
          </h3>

          <img
            src={`${API_URL}${form.fotoValidacion}`}
            alt="Foto de validación"
            onClick={() =>
              verImagenCompleta(`${API_URL}${form.fotoValidacion}`)
            }
            s
            className="w-full max-w-md rounded-xl border-2 border-green-400 shadow-lg cursor-zoom-in hover:opacity-90 transition"
          />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <button
          onClick={() => actualizarEstado("Eliminar")}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
