import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import imageCompression from "browser-image-compression";
import Swal from "sweetalert2";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  ImagePlus,
  MapPin,
  Package,
  RefreshCw,
  Save,
  Trash,
  User,
} from "lucide-react";
import { API_URL } from "../../../config";

const hoyLocal = () => new Date().toLocaleDateString("en-CA");

const formatDatetimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return parts.replace(" ", "T");
};

const normalizarDecimal = (value) => String(value ?? "").replace(",", ".");

const esDecimalEditable = (value) => /^\d*\.?\d{0,2}$/.test(value);

export default function EntregaAuditoria() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [activando, setActivando] = useState(false);
  const [origenes, setOrigenes] = useState([]);
  const [dispositivoMarcas, setDispositivoMarcas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [formasPago, setFormasPago] = useState([]);
  const [obsequiosDisponibles, setObsequiosDisponibles] = useState([]);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState("");

  const [cliente, setCliente] = useState({
    cliente: "",
    cedula: "",
    telefono: "",
    correo: "",
    direccion: "",
  });
  const [entrega, setEntrega] = useState({
    usuarioAgenciaId: null,
    origenId: "",
    observacion: "",
    fecha: hoyLocal(),
    FechaHoraLlamada: "",
    estado: "Pendiente",
    activo: true,
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
    ubicacion: "",
    ubicacionDispositivo: "",
    observacionDetalle: "",
  });
  const [obsequios, setObsequios] = useState([]);

  const dispositivoMarcaSeleccionado = useMemo(
    () =>
      dispositivoMarcas.find(
        (item) => String(item.id) === String(detalle.dispositivoMarcaId),
      ) || null,
    [detalle.dispositivoMarcaId, dispositivoMarcas],
  );
  const modeloSeleccionado = useMemo(
    () => modelos.find((item) => String(item.id) === String(detalle.modeloId)) || null,
    [detalle.modeloId, modelos],
  );
  const formaPagoSeleccionada = useMemo(
    () =>
      formasPago.find((item) => String(item.id) === String(detalle.formaPagoId)) ||
      null,
    [detalle.formaPagoId, formasPago],
  );

  const cargarModelos = async (dispositivoMarcaId) => {
    if (!dispositivoMarcaId) {
      setModelos([]);
      return;
    }

    try {
      const { data } = await axios.get(`${API_URL}/dispositivoMarca/${dispositivoMarcaId}`);
      setModelos(data || []);
    } catch (error) {
      console.error("Error cargando modelos:", error);
      setModelos([]);
    }
  };

  const cargarCatalogos = async () => {
    const [origenesRes, dmRes, formasPagoRes, obsequiosRes] = await Promise.all([
      axios.get(`${API_URL}/origen`),
      axios.get(`${API_URL}/dispositivoMarca`),
      axios.get(`${API_URL}/formaPago`),
      axios.get(`${API_URL}/obsequios`),
    ]);

    setOrigenes(origenesRes.data || []);
    setDispositivoMarcas(dmRes.data || []);
    setFormasPago(formasPagoRes.data || []);
    setObsequiosDisponibles(obsequiosRes.data || []);
  };

  const cargarEntrega = async () => {
    setLoading(true);

    try {
      const { data } = await axios.get(`${API_URL}/registrar2/entrega-completa/${id}`);
      const detalleDB = data.detalle || {};
      const entregaDB = data.entrega || {};

      setCliente({
        cliente: data.cliente?.cliente || "",
        cedula: data.cliente?.cedula || "",
        telefono: data.cliente?.telefono || "",
        correo: data.cliente?.correo || "",
        direccion: data.cliente?.direccion || "",
      });
      setEntrega({
        usuarioAgenciaId: entregaDB.usuarioAgenciaId ?? null,
        origenId: Number(entregaDB.origenId) || "",
        observacion: entregaDB.observacion || "",
        fecha: entregaDB.fecha ? String(entregaDB.fecha).slice(0, 10) : hoyLocal(),
        FechaHoraLlamada: formatDatetimeLocal(entregaDB.FechaHoraLlamada),
        estado: entregaDB.estado || "Pendiente",
        activo: entregaDB.activo !== false,
      });
      setDetalle({
        cantidad: Number(detalleDB.cantidad) || 1,
        precioUnitario: detalleDB.precioUnitario?.toString() || "",
        precioVendedor: detalleDB.precioVendedor?.toString() || "",
        dispositivoMarcaId: String(detalleDB.dispositivoMarcaId || ""),
        modeloId: Number(detalleDB.modeloId) || "",
        contrato: detalleDB.contrato || "",
        formaPagoId: Number(detalleDB.formaPagoId) || "",
        entrada: detalleDB.entrada?.toString() || "",
        alcance: detalleDB.alcance?.toString() || "",
        ubicacion: detalleDB.ubicacion || "",
        ubicacionDispositivo: detalleDB.ubicacionDispositivo || "",
        observacionDetalle: detalleDB.observacionDetalle || "",
      });
      setObsequios(
        (data.obsequios || []).map((item) => ({
          obsequioId: item.obsequioId,
          cantidad: item.cantidad || 1,
        })),
      );

      if (entregaDB.fotoFechaLlamada) {
        setPreview(`${API_URL}${entregaDB.fotoFechaLlamada}`);
      }

      if (detalleDB.dispositivoMarcaId) {
        await cargarModelos(detalleDB.dispositivoMarcaId);
      }
    } catch (error) {
      console.error("Error cargando entrega auditoria:", error);
      Swal.fire("Error", "No se pudo cargar la entrega", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        await cargarCatalogos();
        await cargarEntrega();
      } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudo preparar el formulario", "error");
        setLoading(false);
      }
    };

    cargar();
  }, [id]);

  useEffect(() => {
    const cargarPrecio = async () => {
      if (!detalle.modeloId || !detalle.formaPagoId) return;

      try {
        const { data } = await axios.get(
          `${API_URL}/precio/${detalle.modeloId}/${detalle.formaPagoId}`,
        );

        setDetalle((prev) => ({
          ...prev,
          precioUnitario: data?.precio?.toString() || prev.precioUnitario || "0",
        }));
      } catch (error) {
        console.error("Error cargando precio:", error);
      }
    };

    cargarPrecio();
  }, [detalle.modeloId, detalle.formaPagoId]);

  const updateCliente = (key, value) => {
    setCliente((prev) => ({ ...prev, [key]: value }));
  };

  const updateEntrega = (key, value) => {
    setEntrega((prev) => ({ ...prev, [key]: value }));
  };

  const updateDetalle = (key, value) => {
    setDetalle((prev) => ({ ...prev, [key]: value }));
  };

  const updateDecimalDetalle = (key, value) => {
    const normalizado = normalizarDecimal(value);
    if (esDecimalEditable(normalizado)) updateDetalle(key, normalizado);
  };

  const handleDispositivoMarcaChange = async (value) => {
    updateDetalle("dispositivoMarcaId", value);
    updateDetalle("modeloId", "");
    await cargarModelos(value);
  };

  const handleFoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const toggleObsequio = (obsequioId) => {
    setObsequios((prev) => {
      const existente = prev.find((item) => item.obsequioId === obsequioId);
      if (existente) return prev.filter((item) => item.obsequioId !== obsequioId);
      return [...prev, { obsequioId, cantidad: 1 }];
    });
  };

  const setCantidadObsequio = (obsequioId, cantidad) => {
    setObsequios((prev) =>
      prev.map((item) =>
        item.obsequioId === obsequioId
          ? { ...item, cantidad: Math.max(1, Number(cantidad) || 1) }
          : item,
      ),
    );
  };

  const guardar = async (event) => {
    event.preventDefault();
    setGuardando(true);

    try {
      const formData = new FormData();
      formData.append(
        "data",
        JSON.stringify({
          cliente,
          entrega: {
            ...entrega,
            origenId: Number(entrega.origenId),
          },
          detalle: {
            ...detalle,
            cantidad: Number(detalle.cantidad) || 1,
            dispositivoMarcaId: Number(detalle.dispositivoMarcaId),
            modeloId: Number(detalle.modeloId),
            formaPagoId: Number(detalle.formaPagoId),
            precioUnitario: Number(detalle.precioUnitario) || 0,
            precioVendedor: Number(detalle.precioVendedor) || 0,
            entrada: Number(detalle.entrada) || 0,
            alcance: Number(detalle.alcance) || 0,
          },
          obsequios,
        }),
      );

      if (foto) {
        const imagenComprimida = await imageCompression(foto, {
          maxSizeMB: 0.4,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
        });
        formData.append("foto", imagenComprimida);
      }

      await axios.put(`${API_URL}/registrar2/entrega-completa/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire("Listo", "Entrega actualizada correctamente", "success");
      navigate("/entregas-auditoria");
    } catch (error) {
      console.error("Error guardando entrega auditoria:", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo actualizar la entrega",
        "error",
      );
    } finally {
      setGuardando(false);
    }
  };

  const desactivarEntrega = async () => {
    const confirm = await Swal.fire({
      title: "Desactivar entrega?",
      text: "La entrega quedara inactiva y marcada como Eliminado.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Si, desactivar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    setEliminando(true);

    try {
      await axios.patch(`${API_URL}/auditoria/entregas/${id}/desactivar`);
      Swal.fire("Listo", "Entrega desactivada correctamente", "success");
      navigate("/entregas-auditoria");
    } catch (error) {
      console.error("Error desactivando entrega auditoria:", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo desactivar la entrega",
        "error",
      );
    } finally {
      setEliminando(false);
    }
  };

  const activarEntrega = async () => {
    const confirm = await Swal.fire({
      title: "Activar entrega?",
      text: "La entrega volvera a quedar activa con estado Pendiente.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Si, activar",
      cancelButtonText: "Cancelar",
    });

    if (!confirm.isConfirmed) return;

    setActivando(true);

    try {
      await axios.patch(`${API_URL}/auditoria/entregas/${id}/activar`, {
        estado: "Pendiente",
      });
      Swal.fire("Listo", "Entrega activada correctamente", "success");
      navigate("/entregas-auditoria");
    } catch (error) {
      console.error("Error activando entrega auditoria:", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo activar la entrega",
        "error",
      );
    } finally {
      setActivando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="rounded border border-gray-200 bg-white p-8 text-center text-gray-500">
          Cargando entrega...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 text-gray-900 md:p-6">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editar entrega #{id}</h1>
          <p className="text-sm text-gray-500">
            Ajusta datos de cliente, entrega, producto, ubicaciones y estado.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {entrega.activo ? (
            <button
              type="button"
              onClick={desactivarEntrega}
              disabled={guardando || eliminando || activando}
              className="inline-flex items-center justify-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {eliminando ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Trash size={16} />
              )}
              {eliminando ? "Desactivando..." : "Desactivar"}
            </button>
          ) : (
            <button
              type="button"
              onClick={activarEntrega}
              disabled={guardando || eliminando || activando}
              className="inline-flex items-center justify-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {activando ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {activando ? "Activando..." : "Activar"}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/entregas-auditoria")}
            className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
            Volver
          </button>
        </div>
      </header>

      <form onSubmit={guardar} className="space-y-5">
        <Section
          icon={<User size={18} />}
          title="Cliente"
          subtitle="Datos principales del cliente asociado a la entrega."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <TextInput label="Nombre" value={cliente.cliente} onChange={(value) => updateCliente("cliente", value)} required />
            <TextInput label="Cedula" value={cliente.cedula} onChange={(value) => updateCliente("cedula", value)} required />
            <TextInput label="Telefono" value={cliente.telefono} onChange={(value) => updateCliente("telefono", value)} />
            <TextInput label="Correo" value={cliente.correo} onChange={(value) => updateCliente("correo", value)} />
            <TextInput label="Direccion" value={cliente.direccion} onChange={(value) => updateCliente("direccion", value)} className="xl:col-span-2" />
          </div>
        </Section>

        <Section
          icon={<Package size={18} />}
          title="Entrega"
          subtitle="Fecha, origen, estado y observaciones operativas."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TextInput type="date" label="Fecha" value={entrega.fecha} onChange={(value) => updateEntrega("fecha", value)} required />
            <TextInput
              type="datetime-local"
              label="Fecha hora llamada"
              value={entrega.FechaHoraLlamada}
              onChange={(value) => updateEntrega("FechaHoraLlamada", value)}
            />
            <SelectInput label="Origen" value={entrega.origenId} onChange={(value) => updateEntrega("origenId", value)} required>
              <option value="">Seleccionar</option>
              {origenes.map((origen) => (
                <option key={origen.id} value={origen.id}>
                  {origen.nombre}
                </option>
              ))}
            </SelectInput>
            <SelectInput label="Estado" value={entrega.estado} onChange={(value) => updateEntrega("estado", value)}>
              <option value="Pendiente">Pendiente</option>
              <option value="Entregado">Entregado</option>
              <option value="Urgente">Urgente</option>
              <option value="Eliminado">Eliminado</option>
            </SelectInput>
            <TextArea
              label="Observacion"
              value={entrega.observacion}
              onChange={(value) => updateEntrega("observacion", value)}
              className="md:col-span-2 xl:col-span-4"
            />
          </div>
        </Section>

        <Section
          icon={<Package size={18} />}
          title="Producto"
          subtitle="Modelo, forma de pago y valores de la entrega."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SelectInput
              label="Dispositivo y marca"
              value={detalle.dispositivoMarcaId}
              onChange={handleDispositivoMarcaChange}
              required
            >
              <option value="">Seleccionar</option>
              {dispositivoMarcas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.dispositivo?.nombre} - {item.marca?.nombre}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              label="Modelo"
              value={detalle.modeloId}
              onChange={(value) => updateDetalle("modeloId", value)}
              required
              disabled={!detalle.dispositivoMarcaId}
            >
              <option value="">Seleccionar</option>
              {modelos.map((modelo) => (
                <option key={modelo.id} value={modelo.id}>
                  {modelo.nombre}
                </option>
              ))}
            </SelectInput>
            <SelectInput
              label="Forma de pago"
              value={detalle.formaPagoId}
              onChange={(value) => updateDetalle("formaPagoId", value)}
              required
            >
              <option value="">Seleccionar</option>
              {formasPago.map((forma) => (
                <option key={forma.id} value={forma.id}>
                  {forma.nombre}
                </option>
              ))}
            </SelectInput>
            <TextInput label="Contrato" value={detalle.contrato} onChange={(value) => updateDetalle("contrato", value)} />
            <TextInput label="Precio sistema" value={detalle.precioUnitario} onChange={(value) => updateDecimalDetalle("precioUnitario", value)} />
            <TextInput label="Precio vendedor" value={detalle.precioVendedor} onChange={(value) => updateDecimalDetalle("precioVendedor", value)} required />
            <TextInput label="Entrada" value={detalle.entrada} onChange={(value) => updateDecimalDetalle("entrada", value)} />
            <TextInput label="Alcance" value={detalle.alcance} onChange={(value) => updateDecimalDetalle("alcance", value)} />
            <TextArea
              label="Observacion detalle"
              value={detalle.observacionDetalle}
              onChange={(value) => updateDetalle("observacionDetalle", value)}
              className="md:col-span-2 xl:col-span-4"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 md:grid-cols-3">
            <p><strong>Dispositivo:</strong> {dispositivoMarcaSeleccionado?.dispositivo?.nombre || "-"}</p>
            <p><strong>Marca:</strong> {dispositivoMarcaSeleccionado?.marca?.nombre || "-"}</p>
            <p><strong>Modelo:</strong> {modeloSeleccionado?.nombre || "-"}</p>
            <p><strong>Forma pago:</strong> {formaPagoSeleccionada?.nombre || "-"}</p>
          </div>
        </Section>

        <Section
          icon={<MapPin size={18} />}
          title="Ubicaciones"
          subtitle="La ubicacion del cliente es la que se normaliza para el mapa comercial."
        >
          <div className="grid grid-cols-1 gap-3">
            <TextInput
              label="Ubicacion del cliente"
              value={detalle.ubicacion}
              onChange={(value) => updateDetalle("ubicacion", value)}
              placeholder="URL de Google Maps"
            />
            <TextInput
              label="Ubicacion del dispositivo"
              value={detalle.ubicacionDispositivo}
              onChange={(value) => updateDetalle("ubicacionDispositivo", value)}
            />
          </div>
        </Section>

        <Section icon={<ImagePlus size={18} />} title="Foto de llamada">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Seleccionar foto
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFoto}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
              />
            </label>
            <div className="flex h-52 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50">
              {preview ? (
                <img src={preview} alt="Foto de llamada" className="h-full w-full object-contain" />
              ) : (
                <span className="text-sm text-gray-400">Sin foto</span>
              )}
            </div>
          </div>
        </Section>

        <Section icon={<Gift size={18} />} title="Obsequios">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {obsequiosDisponibles.map((obsequio) => {
              const seleccionado = obsequios.find(
                (item) => item.obsequioId === obsequio.id,
              );

              return (
                <div
                  key={obsequio.id}
                  className={`rounded border p-3 ${
                    seleccionado
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(seleccionado)}
                      onChange={() => toggleObsequio(obsequio.id)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    {obsequio.nombre}
                  </label>
                  {seleccionado && (
                    <input
                      type="number"
                      min="1"
                      value={seleccionado.cantidad}
                      onChange={(event) =>
                        setCantidadObsequio(obsequio.id, event.target.value)
                      }
                      className="mt-2 w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-gray-200 bg-gray-50/95 py-4 backdrop-blur sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => cargarEntrega()}
            disabled={guardando}
            className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Recargar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {guardando ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
            {guardando ? "Guardando..." : "Guardar entrega"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ icon, title, subtitle, children }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start gap-2">
        <span className="mt-0.5 text-blue-600">{icon}</span>
        <div>
          <h2 className="text-sm font-bold uppercase text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function TextInput({ label, value, onChange, type = "text", required = false, placeholder = "", className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <textarea
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, children, required = false, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled}
        className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
      >
        {children}
      </select>
    </label>
  );
}
