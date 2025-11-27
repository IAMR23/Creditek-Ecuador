import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";

export default function EntregaDetalle() {
  const [entrega, setEntrega] = useState(null);
  const [loading, setLoading] = useState(true);
  const { id } = useParams();

  const navigate = useNavigate();
  useEffect(() => {
    const fetchEntrega = async () => {
      try {
        const res = await axios.get(`${API_URL}/entregas/${id}`);
        setEntrega(res.data);
      } catch (error) {
        console.error("Error cargando entrega:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntrega();
  }, [id]);

  if (loading)
    return (
      <p className="text-center py-10 text-lg text-gray-500">Cargando...</p>
    );
  if (!entrega)
    return (
      <p className="text-center py-10 text-lg text-red-600">
        No existe información
      </p>
    );

  const actualizarEstado = async (estado) => {
    const accion =
      estado === "aprobado" ? "aprobar esta entrega" : "rechazar esta entrega";

    const confirm = await Swal.fire({
      title: "¿Estás seguro?",
      text: `¿Deseas ${accion}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: estado === "aprobado" ? "#16a34a" : "#000000",
      cancelButtonColor: "#d33",
      confirmButtonText: estado === "aprobado" ? "Sí, aprobar" : "Sí, rechazar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
      title: "Procesando...",
      text: "Actualizando estado de la entrega.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const response = await axios.patch(
        `${API_URL}/entregas/${entrega.id}/estado`,
        {
          estado: estado,
        }
      );

      Swal.fire({
        title: "¡Listo!",
        text:
          estado === "aprobado"
            ? "La entrega fue aprobada correctamente."
            : "La entrega fue rechazada.",
        icon: "success",
        confirmButtonColor: estado === "aprobado" ? "#16a34a" : "#000000",
      });

      console.log("Estado actualizado:", response.data);
      navigate("/entregas");
    } catch (error) {
      Swal.fire({
        title: "Error",
        text: "No se pudo actualizar el estado. Intenta otra vez.",
        icon: "error",
        confirmButtonColor: "#000000",
      });

      console.error("Error al actualizar estado:", error);
      navigate("/entregas");
    }
  };

  const handleAprobar = () => {
    actualizarEstado("aprobado");
  };

  const handleRechazar = () => {
    actualizarEstado("rechazado");
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-10">
      <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-2xl p-6 md:p-10 border border-gray-200">
        <h2 className="text-3xl font-bold text-black mb-6">
          Detalle de la Entrega{" "}
          <span className="text-green-600">#{entrega.id}</span>
        </h2>

        <div className="md:col-span-2 pt-4">
          <h3 className="text-xl font-semibold text-green-600 mb-2">
            Datos del Vendedor
          </h3>
        </div>

        {/* VENDEDOR Y AGENCIA - MISMA FILA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4  my-4">
          {/* VENDEDOR */}
          <div>
            <label className="text-sm font-medium text-black">Vendedor</label>
            <input
              type="text"
              readOnly
              value={entrega.usuario_agencia.usuario.nombre}
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 cursor-not-allowed"
            />
          </div>

          {/* AGENCIA */}
          <div>
            <label className="text-sm font-medium text-black">Agencia</label>
            <input
              type="text"
              readOnly
              value={entrega.usuario_agencia.agencia.nombre}
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 cursor-not-allowed"
            />
          </div>
        </div>

        <form className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* CLIENTE */}
          <div className="md:col-span-2">
            <h3 className="text-xl font-semibold text-green-600">Cliente</h3>
          </div>

          <div>
            <label className="text-sm font-medium text-black">Nombre</label>
            <input
              type="text"
              readOnly
              value={entrega.cliente.cliente}
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-black">Cédula</label>
            <input
              type="text"
              readOnly
              value={entrega.cliente.cedula}
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-black">Teléfono</label>
            <input
              type="text"
              readOnly
              value={entrega.cliente.telefono}
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 cursor-not-allowed"
            />
          </div>

          {/* PRODUCTO */}
          <div className="md:col-span-2 pt-4">
            <h3 className="text-xl font-semibold text-green-600 mb-2">
              Producto
            </h3>
          </div>

          <div>
            <label className="text-sm font-medium text-black">Nombre</label>
            <input
              type="text"
              readOnly
              value={entrega.producto.nombre}
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 cursor-not-allowed"
            />
          </div>

          {/* INFO GENERAL */}
          {[
            { label: "Contrato", value: entrega.contrato || "—" },
            { label: "Origen", value: entrega.origen },
            { label: "Entrada", value: entrega.valor_entrada },
            { label: "Alcance", value: entrega.valor_alcance },
            { label: "Ubicación", value: entrega.ubicacion },
            {
              label: "Ubicación del dispositivo",
              value: entrega.ubicacion_dispositivo,
            },
          ].map((item, idx) => (
            <div key={idx}>
              <label className="text-sm font-medium text-black">
                {item.label}
              </label>
              <input
                type="text"
                value={item.value}
                readOnly
                className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 text-gray-700 cursor-not-allowed"
              />
            </div>
          ))}

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-black">Obsequios</label>
            <input
              type="text"
              value={entrega.obsequios}
              readOnly
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 text-gray-700 cursor-not-allowed"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-black">
              Observación
            </label>
            <textarea
              rows="3"
              value={entrega.observacion}
              readOnly
              className="w-full mt-1 p-2.5 rounded-lg border border-gray-300 bg-gray-200 text-gray-700 cursor-not-allowed"
            />
          </div>
        </form>

        {/* BOTONES */}
        <div className="md:col-span-2 flex flex-col md:flex-row gap-4 mt-10 justify-end">
          <button
            onClick={handleRechazar}
            className="w-full md:w-auto px-6 py-3 rounded-xl font-semibold bg-black text-white hover:bg-gray-900 transition-all shadow-lg"
          >
            Rechazar
          </button>

          <button
            onClick={handleAprobar}
            className="w-full md:w-auto px-6 py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 transition-all shadow-lg"
          >
            Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}
