import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../../config";
import Swal from "sweetalert2";
import Field from "../../components/Field";
import { MdCancel } from "react-icons/md";

export default function DetalleEntrega() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [observacionesLogistica, setObservacionesLogistica] = useState("");
  const [repartidores, setRepartidores] = useState([]);
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState("");
  const [loadingRepartidores, setLoadingRepartidores] = useState(false);
  const [fechaHoraAsignacion, setFechaHoraAsignacion] = useState("");
  const [horaEstimadaEntrega, setHoraEstimadaEntrega] = useState("");
  const [sectorEntrega, setSectorEntrega] = useState("");
  const rangosHorarios = [
    "7 - 9",
    "9 - 11",
    "11 - 13",
    "13 - 15",
    "15 - 17", 
    "17 - 19",
    "19 - 21",
    "21 - 22",
  ];

  const navigate = useNavigate();

  useEffect(() => {
    const fetchEntrega = async () => {
      try {
        const { data } = await axios.get(
          `${API_URL}/vendedor/entrega-logistica/${id}`,
        );

        if (data.ok) setForm(data.entrega);
      } catch (error) {
        console.error(error);
      }
    };
    fetchEntrega();
  }, [id]);

  useEffect(() => {
    const fetchRepartidores = async () => {
      try {
        setLoadingRepartidores(true);
        const { data } = await axios.get(
          `${API_URL}/api/usuario-agencia-permisos/usuarios-repartidores`,
        );
        setRepartidores(data);
      } catch (error) {
        console.error("Error cargando repartidores", error);
      } finally {
        setLoadingRepartidores(false);
      }
    };

    fetchRepartidores();
  }, []);

  const asignarRepartidor = async () => {
    if (!repartidorSeleccionado) {
      Swal.fire({
        icon: "warning",
        title: "Seleccione un repartidor",
        text: "Debe asignar un repartidor antes de continuar",
      });
      return;
    }

    try {
      await axios.post(`${API_URL}/entregas/${id}/asignar-repartidor`, {
        usuarioAgenciaId: repartidorSeleccionado,
      });

      await axios.put(`${API_URL}/entregas/${id}`, {
        fechaHoraAsignacion,
        horaEstimadaEntrega,
        sectorEntrega,
      });
      Swal.fire({
        icon: "success",
        title: "Repartidor asignado",
        timer: 1500,
        showConfirmButton: false,
      });

      actualizarEstado("Transito");
    } catch (error) {
      if (error.response?.status === 409) {
        const result = await Swal.fire({
          title: "Entrega ya asignada",
          text: "¿Deseas reasignarla?",
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Sí, reasignar",
          cancelButtonText: "Cancelar",
        });

        if (result.isConfirmed) {
          await axios.post(`${API_URL}/entregas/${id}/asignar-repartidor`, {
            usuarioAgenciaId: repartidorSeleccionado,
            forzarReasignacion: true,
          });

          await axios.put(`${API_URL}/entregas/${id}`, {
            fechaHoraAsignacion,
            horaEstimadaEntrega,
            sectorEntrega,
          });

          Swal.fire({
            icon: "success",
            title: "Reasignado correctamente",
            timer: 1500,
            showConfirmButton: false,
          });

          actualizarEstado("Transito");
        }
      } else {
        console.error(error);
        Swal.fire({
          icon: "error",
          title: "Error al asignar",
          text: "No se pudo asignar el repartidor",
        });
      }
    }
  };

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

      navigate("/entregas-pendientes");
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
    <div className="max-w-5xl mx-auto p-6  rounded-2xl shadow-xl mt-8">
      {/* Vendedor y Agencia */}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Vendedor */}
        <div className="rounded-2xl /80 backdrop-blur border border-green-200 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Vendedor
          </p>

          <p className="mt-2 text-lg font-medium text-gray-800">
            {form.usuarioAgencia?.usuario?.nombre || "No asignado"}
          </p>
        </div>

        {/* Agencia */}
        <div className="rounded-2xl /80 backdrop-blur border border-green-200 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
            Agencia
          </p>

          <p className="mt-2 text-lg font-medium text-gray-800">
            {form.usuarioAgencia?.agencia?.nombre || "No asignada"}
          </p>
        </div>
      </div>

      <form className="space-y-8">
        <h2 className="text-3xl font-extrabold text-green-700 border-b-4 border-green-500 pb-2">
          Detalle de Entrega
        </h2>

        <div className="relative bg-white/80 backdrop-blur-xl border border-green-200 rounded-2xl shadow-lg p-6 space-y-6">
          {/* HEADER */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
              C
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Cliente</h3>
              <p className="text-sm text-gray-500">
                Información registrada y validada
              </p>
            </div>
          </div>

          {/* DATOS DEL CLIENTE */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { label: "Nombre", value: form.cliente?.nombre },
              { label: "Cédula", value: form.cliente?.cedula },
              { label: "Teléfono", value: form.cliente?.telefono },
              { label: "Correo", value: form.cliente?.correo },
              { label: "Dirección", value: form.cliente?.direccion },
            ].map((field, i) => (
              <div key={i} className="flex flex-col space-y-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {field.label}
                </label>
                <input
                  type="text"
                  readOnly
                  value={field.value || ""}
                  className="
            w-full px-4 py-2 rounded-lg
            bg-gray-50 text-gray-800
            border border-gray-200
            shadow-inner
            cursor-default
          "
                />
              </div>
            ))}
          </div>

          {/* FECHAS */}
          <div className="grid md:grid-cols-2 gap-4 pt-2">
            {/* Fecha de registro */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Fecha de registro
              </label>
              <input
                type="text"
                readOnly
                value={form.fecha?.substring(0, 10) || ""}
                className="
          w-full px-4 py-2 rounded-lg
           text-gray-800
          border border-green-200
          shadow-inner
          cursor-default
        "
              />
            </div>

            {/* Fecha y hora de la llamada */}
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Fecha y hora de la llamada
              </label>
              <input
                type="text"
                readOnly
                value={form.FechaHoraLlamada || ""}
                className="
          w-full px-4 py-2 rounded-lg
           text-gray-800
          border border-green-200
          shadow-inner
          cursor-default
        "
              />
            </div>
          </div>
        </div>

        {/* Foto de fecha de llamada */}
        {form.fotoFechaLlamada && (
          <div className=" p-5 rounded-xl shadow-md space-y-3">
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

        <div className="relative bg-white/80 backdrop-blur-xl border border-green-200 rounded-2xl shadow-lg p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Origen</h3>
            <p className="text-sm text-gray-500">Procedencia y observación</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Origen
              </label>
              <input
                type="text"
                readOnly
                value={form.origen?.nombre || ""}
                className="
          w-full px-4 py-2 rounded-lg
           text-gray-800
          border border-green-200
          shadow-inner
          cursor-default
        "
              />
            </div>

            <div className="flex flex-col space-y-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Observación
              </label>
              <input
                type="text"
                readOnly
                value={form.observacion || ""}
                className="
          w-full px-4 py-2 rounded-lg
          bg-gray-50 text-gray-800
          border border-gray-200
          shadow-inner
          cursor-default
        "
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Detalle de productos
          </h3>

          {form.detalleEntrega?.map((detalle) => (
            <div
              key={detalle.id}
              className="bg-white/80 backdrop-blur-xl border border-green-200 rounded-2xl shadow-md p-6 space-y-4"
            >
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Modelo" value={detalle.modelo?.nombre} />
                <Field
                  label="Marca"
                  value={detalle.dispositivoMarca?.marca?.nombre}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field
                  label="Dispositivo"
                  value={detalle.dispositivoMarca?.dispositivo?.nombre}
                />
                <Field
                  label="Forma de pago"
                  value={detalle.formaPago?.nombre}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Contrato" value={detalle.contrato} />
                <Field label="Entrada" value={`$${detalle.entrada}`} />
                <Field label="Alcance" value={`$${detalle.alcance}`} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Ubicación" value={detalle.ubicacion} />
                <Field
                  label="Ubicación del dispositivo"
                  value={detalle.ubicacionDispositivo}
                />
              </div>

              <Field label="Observación" value={detalle.observacionDetalle} />
            </div>
          ))}
        </div>

        <div className="relative bg-white/80 backdrop-blur-xl border border-green-200 rounded-2xl shadow-lg p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Obsequios</h3>
              <p className="text-sm text-gray-500">
                Beneficios adicionales entregados al cliente
              </p>
            </div>

            <span className="px-3 py-1 text-xs font-semibold rounded-full  text-green-700 border border-green-200">
              {form.obsequiosEntrega?.length || 0} ítem(s)
            </span>
          </div>

          {/* Lista */}
          <div className="space-y-3">
            {form.obsequiosEntrega?.map((ob) => (
              <div
                key={ob.id}
                className="
          flex flex-col md:flex-row md:items-center md:justify-between
          gap-4 p-5 rounded-xl
          bg-gradient-to-r from-green-50 to-white
          border border-green-200
          shadow-sm
        "
              >
                <div className="flex-1">
                  <Field label="Obsequio" value={ob.obsequio?.nombre} />
                </div>

                <div className="w-full md:w-40">
                  <Field label="Cantidad" value={ob.cantidad} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            Asignar repartidor
          </label>

          <select
            value={repartidorSeleccionado}
            onChange={(e) => setRepartidorSeleccionado(e.target.value)}
            className="w-full p-3 border border-green-300 rounded-xl bg-white"
          >
            <option value="">-- Seleccione un repartidor --</option>

            {repartidores.map((r) => (
              <option key={r.id} value={r.id}>
                {r.usuario.nombre} — {r.agencia.nombre}
              </option>
            ))}
          </select>

          {loadingRepartidores && (
            <p className="text-sm text-gray-500">Cargando repartidores...</p>
          )}
        </div>

        {/* ASIGNACIÓN Y HORARIO */}
        <div className="relative bg-white/80 backdrop-blur-xl border border-green-200 rounded-2xl shadow-lg p-6 space-y-5">
          {/* Fecha y hora de asignación */}
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Fecha y hora de asignación
            </label>

            <input
              type="datetime-local"
              value={fechaHoraAsignacion}
              onChange={(e) => setFechaHoraAsignacion(e.target.value)}
              className="w-full p-3 border border-green-300 rounded-xl"
            />
          </div>

          {/* Hora estimada */}
          <div className="flex flex-col space-y-3">
            <label className="text-sm font-semibold text-gray-700">
              Hora estimada de entrega
            </label>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {rangosHorarios.map((rango) => (
                <label
                  key={rango}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition
            ${
              horaEstimadaEntrega === rango
                ? "bg-green-100 border-green-500"
                : "border-gray-300"
            }`}
                >
                  <input
                    type="radio"
                    name="horaEstimada"
                    value={rango}
                    checked={horaEstimadaEntrega === rango}
                    onChange={(e) => setHoraEstimadaEntrega(e.target.value)}
                    className="accent-green-600"
                  />
                  <span className="text-sm">{rango}</span>
                </label>
              ))}
            </div>
          </div>

                    <div className="flex flex-col space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Sector de la entrega
            </label>

            <input
              type="text"
              value={sectorEntrega}
              onChange={(e) => setSectorEntrega(e.target.value)}
              className="w-full p-3 border border-green-300 rounded-xl"
            />
          </div>


          

          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Observación de logística
            </h3>
            <p className="text-sm text-gray-500">
              Comentarios internos del área logística
            </p>
          </div>

          <textarea
            rows={4}
            value={observacionesLogistica}
            onChange={(e) => setObservacionesLogistica(e.target.value)}
            placeholder="Ej: Cliente no estuvo en domicilio, reprogramar entrega..."
            className="
      w-full p-3 rounded-xl
      border border-green-300
      focus:outline-none focus:ring-2 focus:ring-green-400
      bg-white
      resize-none
    "
          />
        </div>

        <div className="flex justify-end items-center gap-4 mt-4">
          <button
            type="button"
            onClick={asignarRepartidor}
            className="flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-xl font-semibold shadow transition"
          >
            Asignar repartidor y enviar a tránsito
          </button>

          <button
            type="button"
            onClick={() => actualizarEstado("No Entregado")}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-xl text-sm font-semibold shadow transition"
          >
            <MdCancel size={18} />
            No entregado
          </button>
        </div>
      </form>
    </div>
  );
}
