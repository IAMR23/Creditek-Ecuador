import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../../config";
import Swal from "sweetalert2";

export default function EntregaAuditoria() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [observacionesLogistica, setObservacionesLogistica] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchEntrega = async () => {
      try {
        const { data } = await axios.get(
          `${API_URL}/vendedor/entrega-logistica/${id}`
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
      await axios.put(`${API_URL}/entregas/${id}`, {
        estado: nuevoEstado,
        observacionLogistica: observacionesLogistica,
      });

      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: `El estado cambió a: ${nuevoEstado}`,
        timer: 1500,
        showConfirmButton: false,
      });

      navigate("/entregas-auditoria");
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error al actualizar",
        text: "Ocurrió un problema al guardar el estado.",
      });
    }
  };

  const inputStyle =
    "w-full p-2 border border-green-300 rounded-lg bg-gray-100 cursor-not-allowed";

  const verImagenCompleta = (url) => {
    Swal.fire({
      imageUrl: url,
      imageAlt: "Foto de validación",
      width: "90%",
      showConfirmButton: false,
      showCloseButton: true,
      background: "#f0fdf4",
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-green-50 rounded-2xl shadow-xl mt-8">
      {/* Vendedor y Agencia */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-green-100 p-5 rounded-xl shadow-md space-y-2">
          <label className="block font-semibold text-green-800">Vendedor</label>
          <input
            type="text"
            className={inputStyle}
            value={form.usuarioAgencia?.usuario?.nombre || ""}
            readOnly
          />
        </div>

        <div className="bg-green-100 p-5 rounded-xl shadow-md space-y-2">
          <label className="block font-semibold text-green-800">Agencia</label>
          <input
            type="text"
            className={inputStyle}
            value={form.usuarioAgencia?.agencia?.nombre || ""}
            readOnly
          />
        </div>
      </div>

      <form className="space-y-8">
        <h2 className="text-3xl font-extrabold text-green-700 border-b-4 border-green-500 pb-2">
          Detalle de Entrega
        </h2>

        {/* Cliente */}
        <div className="bg-green-100 p-5 rounded-xl shadow-md space-y-3">
          <h3 className="text-xl font-semibold text-green-800">Cliente</h3>

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

        {/* Fecha */}
        <div className="bg-green-100 p-5 rounded-xl shadow-md space-y-2">
          <label className="block font-semibold text-green-800">Fecha</label>
          <input
            type="text"
            className={inputStyle}
            value={form.fecha?.substring(0, 10) || ""}
            readOnly
          />
        </div>

        {/* Hora de llamada */}
        <div className="bg-green-100 p-5 rounded-xl shadow-md space-y-2">
          <label className="block font-semibold text-green-800">
            Hora de llamada
          </label>
          <input
            type="text"
            className={inputStyle}
            value={form.FechaHoraLlamada || ""}
            readOnly
          />
        </div>

        {/* Foto de fecha de llamada */}
        {form.fotoFechaLlamada && (
          <div className="bg-green-100 p-5 rounded-xl shadow-md space-y-3">
            <h3 className="text-xl font-semibold text-green-800">
              Foto Fecha Llamada
            </h3>

            <img
              src={`${API_URL}${form.fotoFechaLlamada}`}
              alt="Foto de validación"
              onClick={() =>
                verImagenCompleta(`${API_URL}${form.fotoFechaLlamada}`)
              }
              className="w-full max-w-md rounded-xl border-2 border-green-400 shadow-lg cursor-zoom-in hover:opacity-90 transition"
            />
          </div>
        )}

        {/* Origen */}
        <div className="bg-green-100 p-5 rounded-xl shadow-md space-y-2">
          <label className="block font-semibold text-green-800">Origen</label>
          <input
            type="text"
            className={inputStyle}
            value={form.origen?.nombre || ""}
            readOnly
          />
        </div>

        {/* Detalle productos */}
        <div>
          <h3 className="text-2xl font-bold text-green-700 mb-3">
            Detalle de Productos Auditoria
          </h3>

          {form.detalleEntrega?.map((detalle) => (
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
                  value={`Forma Pago: ${detalle.formaPago?.nombre}`}
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
                  value={`Alcance: $${detalle.alcance}`}
                  readOnly
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <input
                  className={inputStyle}
                  value={`Ubicación: ${detalle.ubicacion}`}
                  readOnly
                />
                <input
                  className={inputStyle}
                  value={`Ubicación dispositivo: ${detalle.ubicacionDispositivo}`}
                  readOnly
                />
              </div>
            </div>
          ))}
        </div>

        {/* Obsequios */}
        <div>
          <h3 className="text-2xl font-bold text-green-700 mb-3">Obsequios</h3>

          {form.obsequiosEntrega?.map((ob) => (
            <div
              key={ob.id}
              className="bg-green-50 p-4 rounded-xl border border-green-200 mb-4 grid md:grid-cols-2 gap-4"
            >
              <input
                className={inputStyle}
                value={ob.obsequio?.nombre}
                readOnly
              />
              <input className={inputStyle} value={ob.cantidad} readOnly />
            </div>
          ))}
        </div>

        {/* Observaciones logística */}
        <div className="bg-green-200 p-5 rounded-xl shadow-md">
          <label className="block font-semibold text-green-800">
            Observaciones de Logística
          </label>
          <textarea
            className="w-full p-3 border border-green-400 rounded-xl bg-white"
            rows={4}
            placeholder="Escribe una observación..."
            value={observacionesLogistica}
            onChange={(e) => setObservacionesLogistica(e.target.value)}
          />
        </div>

        {/* Foto validación */}
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

        {/* Botones */}
        <div className="grid md:grid-cols-3 gap-4 mt-6">

 <button
            type="button"
            onClick={() => actualizarEstado("Pendiente")}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-xl"
          >
            Pendiente
          </button>

          <button
            type="button"
            onClick={() => actualizarEstado("Eliminado")}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl"
          >
            Eliminar
          </button>
        </div>
      </form>
    </div>
  );
}
