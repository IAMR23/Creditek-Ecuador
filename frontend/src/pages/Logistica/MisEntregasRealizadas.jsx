import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";

import {
  MdLocalShipping,
  MdPerson,
  MdPhone,
  MdEmail,
  MdLocationOn,
  MdAssignment,
  MdInventory,
  MdCalendarToday,
  MdCardGiftcard,
  MdCheckCircle,
  MdCancel,
} from "react-icons/md";
import Swal from "sweetalert2";

export default function MisEntregasRealizadas() {
  const [entregas, setEntregas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarEntregas();
  }, []);

  const cargarEntregas = async () => {
    const token = localStorage.getItem("token");
    const decoded = jwtDecode(token);
    const usuarioAgenciaId =
      decoded.usuario?.agenciaPrincipal?.usuarioAgenciaId;

    const res = await axios.get(
      `${API_URL}/entregas/mis-entregas-realizadas/${usuarioAgenciaId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    setEntregas(res.data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Cargando entregas...
      </div>
    );
  }

  const actualizarEstado = async (id, nuevoEstado) => {
    const result = await Swal.fire({
      title: "¿Confirmar acción?",
      text: `¿Deseas cambiar el estado a "${nuevoEstado}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#16a34a", // green-600
      cancelButtonColor: "#dc2626", // red-600
      confirmButtonText: "Sí, actualizar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      await axios.put(`${API_URL}/entregas/${id}`, {
        estado: nuevoEstado,
      });

      Swal.fire({
        icon: "success",
        title: "Estado actualizado",
        text: `El estado cambió a: ${nuevoEstado}`,
        timer: 1500,
        showConfirmButton: false,
      });

      cargarEntregas();
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Error al actualizar",
        text: "Ocurrió un problema al guardar el estado.",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <MdLocalShipping /> Mis Entregas
      </h1>

      {entregas.map((entrega) => (
        <div
          key={entrega.id}
          className="bg-white rounded-xl shadow border p-5 space-y-4"
        >
          {/* HEADER */}
          <div className="flex justify-between items-center">
            <div className="font-semibold flex items-center gap-2">
              <MdAssignment />
              Entrega #{entrega.id}
            </div>

            <span className="px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-700">
              {entrega.estado}
            </span>
          </div>

          {/* FECHAS */}
          <div className="text-sm text-gray-600 flex gap-4">
            <span className="flex items-center gap-1">
              <MdCalendarToday />
              Fecha: {entrega.fecha.slice(0, 10)}
            </span>
            <span>
              Asignada:{" "}
              {entrega.UsuarioAgenciaEntrega.fecha_asignacion.slice(0, 10)}
            </span>
          </div>

          {/* CLIENTE */}
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <MdPerson /> Cliente
            </h3>
            <p>{entrega.cliente.cliente}</p>
            <p className="text-sm text-gray-600">
              Cédula: {entrega.cliente.cedula}
            </p>
            <p className="text-sm flex items-center gap-1">
              <MdPhone /> {entrega.cliente.telefono}
            </p>
            <p className="text-sm flex items-center gap-1">
              <MdEmail /> {entrega.cliente.correo}
            </p>
            <p className="text-sm flex items-center gap-1">
              <MdLocationOn /> {entrega.cliente.direccion}
            </p>

            <p className="text-sm flex items-center gap-1">
              <MdLocationOn /> {entrega.origen.nombre}
            </p>

            <p className="text-sm flex items-center gap-1">
              Observacion: {entrega.observacion}
            </p>
          </div>

          {/* PRODUCTOS */}
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-2">
              <MdInventory /> Productos
            </h3>

            {entrega.detalleEntregas.map((d) => (
              <div key={d.id} className="border-l-4 border-blue-500 pl-3 mb-3">
                <p className="font-medium">
                  {d.dispositivoMarca.dispositivo.nombre}{" "}
                  {d.dispositivoMarca.marca.nombre} – {d.modelo.nombre}
                </p>

                <p className="text-sm">Contrato: {d.contrato}</p>
                <p className="text-sm">Forma de pago: {d.formaPago.nombre}</p>
                <p className="text-sm">Precio: ${d.precioVendedor}</p>
                <p className="text-sm">Entrada: ${d.entrada}</p>
                <p className="text-sm">Alcance: ${d.alcance}</p>
                <p className="text-sm">Observacion: {d.observacionDetalle}</p>

                {d.ubicacion && (
                  <a
                    href={d.ubicacion}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 text-sm underline"
                  >
                    Ver ubicación
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* OBSEQUIOS */}
          {entrega.obsequiosEntrega.length > 0 && (
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <MdCardGiftcard /> Obsequios
              </h3>
              <ul className="list-disc list-inside">
                {entrega.obsequiosEntrega.map((o) => (
                  <li key={o.id}>
                    {o.obsequio.nombre} x{o.cantidad}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
