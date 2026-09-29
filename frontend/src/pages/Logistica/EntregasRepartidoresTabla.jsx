/* eslint-disable react/prop-types */
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  CalendarDays,
  ClipboardList,
  ExternalLink,
  Eye,
  Gift,
  Mail,
  MapPin,
  Package,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { API_URL } from "../../../config";
import api from "../../api/client";
import { getHoyLocal } from "../../utils/dateUtils";

const OPCIONES_ERRORES = [
  "No reporto entradas o alcance inmediatamente",
  "No coordino la ruta correctamente",
  "Se olvido el contrato",
  "Se olvido el regalo",
  "Retrasos en la coordinación",
  "Retrasos en la entrega",
  "No actualiza al RVE",
  "No envia el TAG",
];

const normalizarTexto = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const nuevaClaveOperacion = () =>
  globalThis.crypto?.randomUUID?.() ||
  `entrega-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const mostrarValor = (value) => {
  if (value === 0 || value === false) return String(value);
  return value || "—";
};

const formatoDinero = (value) => {
  const numero = Number(value);
  return Number.isFinite(numero)
    ? new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
      }).format(numero)
    : "—";
};

const formatoFechaHora = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-EC", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatoFechaCorta = (value) => {
  if (!value) return "—";
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
};

const resolverArchivoUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_URL || ""}${value}`;
};

const CampoDetalle = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 px-3 py-2">
    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
      {label}
    </dt>
    <dd className="mt-1 break-words text-sm text-slate-800">
      {mostrarValor(value)}
    </dd>
  </div>
);

const EntregaDetalleModal = ({ entrega, onClose }) => {
  if (!entrega) return null;

  const asignacion = entrega.repartidores?.find(
    (repartidor) => repartidor.UsuarioAgenciaEntrega?.activo !== false,
  )?.UsuarioAgenciaEntrega || entrega.repartidores?.[0]?.UsuarioAgenciaEntrega;
  const evidencias = [
    { label: "Validación", value: entrega.fotoValidacion },
    { label: "Fecha de llamada", value: entrega.fotoFechaLlamada },
    { label: "Logística", value: entrega.fotoLogistica },
  ].filter((item) => item.value);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-detalle-entrega"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 id="titulo-detalle-entrega" className="flex items-center gap-2 text-base font-bold text-slate-950">
            <ClipboardList size={17} /> Entrega #{entrega.id}
          </h3>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              entrega.estado === "Entregado"
                ? "bg-emerald-100 text-emerald-700"
                : entrega.estado === "Transito"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
            }`}>
              {mostrarValor(entrega.estado)}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="space-y-5 overflow-y-auto p-5 text-sm text-slate-950">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} /> Fecha: {formatoFechaCorta(entrega.fecha)}
            </span>
            <span>
              Asignada: {formatoFechaCorta(entrega.fechaHoraAsignacion || asignacion?.fecha_asignacion)}
            </span>
          </div>

          <section>
            <h4 className="mb-1.5 flex items-center gap-2 font-bold text-slate-950">
              <UserRound size={15} /> Cliente
            </h4>
            <div className="space-y-0.5">
              <p className="font-medium uppercase">{mostrarValor(entrega.cliente?.cliente)}</p>
              <p>Cédula: {mostrarValor(entrega.cliente?.cedula)}</p>
              <p className="flex items-center gap-1.5">
                <Phone size={13} /> {mostrarValor(entrega.cliente?.telefono)}
              </p>
              <p className="flex items-center gap-1.5">
                <Mail size={13} /> {mostrarValor(entrega.cliente?.correo)}
              </p>
              <p className="flex items-start gap-1.5">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                <span className="break-all">{mostrarValor(entrega.cliente?.direccion)}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin size={13} /> {mostrarValor(entrega.origen?.nombre)}
              </p>
              <p>Observación: {mostrarValor(entrega.observacion)}</p>
              <p>Observación de Logística: {mostrarValor(entrega.observacionLogistica)}</p>
            </div>
          </section>

          <section>
            <h4 className="mb-2 flex items-center gap-2 font-bold text-slate-950">
              <Package size={15} /> Productos
            </h4>
            <div className="space-y-4">
              {entrega.detalleEntregas?.length ? entrega.detalleEntregas.map((detalle, index) => (
                <article
                  key={detalle.id || index}
                  className="border-l-[3px] border-blue-500 py-0.5 pl-3"
                >
                  <p className="font-bold">
                    {detalle.dispositivoMarca?.dispositivo?.nombre || "Producto"}{" "}
                    {detalle.dispositivoMarca?.marca?.nombre || ""}{" "}
                    {detalle.modelo?.nombre ? `– ${detalle.modelo.nombre}` : ""}
                  </p>
                  <p>Contrato: {mostrarValor(detalle.contrato)}</p>
                  <p>Forma de pago: {mostrarValor(detalle.formaPago?.nombre)}</p>
                  <p>Precio: {formatoDinero(detalle.precioVendedor ?? detalle.precioUnitario)}</p>
                  <p>Entrada: {formatoDinero(detalle.entrada)}</p>
                  <p>Alcance: {formatoDinero(detalle.alcance)}</p>
                  <p>Observación: {mostrarValor(detalle.observacionDetalle)}</p>
                  {detalle.ubicacion && (
                    <a
                      href={detalle.ubicacion}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      Ver ubicación <ExternalLink size={13} />
                    </a>
                  )}
                </article>
              )) : <p className="text-slate-500">Sin productos registrados.</p>}
            </div>
          </section>

          <section>
            <h4 className="mb-1.5 flex items-center gap-2 font-bold text-slate-950">
              <Gift size={15} /> Obsequios
            </h4>
            {entrega.obsequiosEntrega?.length ? (
              <ul className="list-inside list-disc space-y-0.5">
                {entrega.obsequiosEntrega.map((item, index) => (
                  <li key={`${item.obsequio?.nombre}-${index}`}>
                    {item.obsequio?.nombre || "Obsequio"} x{item.cantidad}
                  </li>
                ))}
              </ul>
            ) : <p className="text-slate-500">Sin obsequios.</p>}
          </section>

          <section className="border-t border-slate-200 pt-4">
            <label className="font-bold text-slate-950" htmlFor={`observacion-repartidor-${entrega.id}`}>
              Observaciones de Entrega (Repartidor)
            </label>
            <textarea
              id={`observacion-repartidor-${entrega.id}`}
              value={entrega.observacionEntrega || ""}
              readOnly
              rows={3}
              placeholder="Ej: Cliente no se encontraba en domicilio, dirección incorrecta, entrega exitosa sin novedades..."
              className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </section>

          <div className="hidden">
          <section>
            <h4 className="mb-3 text-sm font-bold text-slate-900">Información general</h4>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <CampoDetalle label="Fecha" value={entrega.fecha} />
              <CampoDetalle label="Semana" value={entrega.semana} />
              <CampoDetalle label="Forma de entrega" value={entrega.tipoEntrega} />
              <CampoDetalle label="Sector" value={entrega.sectorEntrega} />
              <CampoDetalle label="Origen" value={entrega.origen?.nombre} />
              <CampoDetalle label="Horario estimado" value={entrega.horaEstimadaEntrega} />
              <CampoDetalle
                label="Fecha de asignación"
                value={formatoFechaHora(entrega.fechaHoraAsignacion || asignacion?.fecha_asignacion)}
              />
              <CampoDetalle
                label="Fecha de finalización"
                value={formatoFechaHora(asignacion?.fecha_finalizacion)}
              />
              <CampoDetalle
                label="Fecha y hora de llamada"
                value={formatoFechaHora(entrega.FechaHoraLlamada)}
              />
              <CampoDetalle label="Validada" value={entrega.validada ? "Sí" : "No"} />
              <CampoDetalle label="Creada" value={formatoFechaHora(entrega.createdAt)} />
              <CampoDetalle label="Última actualización" value={formatoFechaHora(entrega.updatedAt)} />
            </dl>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <h4 className="mb-3 text-sm font-bold text-slate-900">Cliente</h4>
              <dl className="grid gap-2 sm:grid-cols-2">
                <CampoDetalle label="Nombre" value={entrega.cliente?.cliente} />
                <CampoDetalle label="Cédula" value={entrega.cliente?.cedula} />
                <CampoDetalle label="Teléfono" value={entrega.cliente?.telefono} />
                <CampoDetalle label="Correo" value={entrega.cliente?.correo} />
                <div className="sm:col-span-2">
                  <CampoDetalle label="Dirección" value={entrega.cliente?.direccion} />
                </div>
                <CampoDetalle
                  label="Cliente Contífico"
                  value={entrega.cliente?.clienteContifico}
                />
              </dl>
            </section>

            <section>
              <h4 className="mb-3 text-sm font-bold text-slate-900">Responsables</h4>
              <dl className="grid gap-2 sm:grid-cols-2">
                <CampoDetalle label="Vendedor" value={entrega.vendedor} />
                <CampoDetalle label="Agencia del vendedor" value={entrega.agenciaVendedor} />
                <CampoDetalle label="Repartidor" value={entrega.motorizado} />
                <CampoDetalle label="Agencia del repartidor" value={entrega.agenciaMotorizado} />
                <CampoDetalle label="Estado de asignación" value={asignacion?.estado} />
              </dl>
            </section>
          </div>

          <section>
            <h4 className="mb-3 text-sm font-bold text-slate-900">Observaciones</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Vendedor
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {mostrarValor(entrega.observacion)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Logística
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {mostrarValor(entrega.observacionLogistica)}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                  Repartidor
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-blue-950">
                  {mostrarValor(entrega.observacionEntrega)}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-3 text-sm font-bold text-slate-900">Productos</h4>
            <div className="space-y-3">
              {entrega.detalleEntregas?.length ? entrega.detalleEntregas.map((detalle, index) => (
                <article key={detalle.id || index} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h5 className="font-bold text-slate-900">
                      {detalle.dispositivoMarca?.dispositivo?.nombre || "Producto"}{" "}
                      {detalle.dispositivoMarca?.marca?.nombre || ""}{" "}
                      {detalle.modelo?.nombre ? `– ${detalle.modelo.nombre}` : ""}
                    </h5>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Cantidad: {mostrarValor(detalle.cantidad)}
                    </span>
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <CampoDetalle label="Precio unitario" value={formatoDinero(detalle.precioUnitario)} />
                    <CampoDetalle label="Precio vendedor" value={formatoDinero(detalle.precioVendedor)} />
                    <CampoDetalle label="Entrada" value={formatoDinero(detalle.entrada)} />
                    <CampoDetalle label="Alcance" value={formatoDinero(detalle.alcance)} />
                    <CampoDetalle label="Forma de pago" value={detalle.formaPago?.nombre} />
                    <CampoDetalle label="Contrato" value={detalle.contrato} />
                    <CampoDetalle label="Identificador del anuncio" value={detalle.identificadorAnuncio} />
                    <CampoDetalle label="Observación del producto" value={detalle.observacionDetalle} />
                  </dl>
                  {(detalle.ubicacion || detalle.ubicacionDispositivo) && (
                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      {detalle.ubicacion && (
                        <a href={detalle.ubicacion} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline">
                          Ubicación del cliente <ExternalLink size={14} />
                        </a>
                      )}
                      {detalle.ubicacionDispositivo && (
                        <a href={detalle.ubicacionDispositivo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline">
                          Ubicación del dispositivo <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  )}
                </article>
              )) : (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  Esta entrega no tiene productos registrados.
                </p>
              )}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-3">
            <section>
              <h4 className="mb-3 text-sm font-bold text-slate-900">Obsequios</h4>
              {entrega.obsequiosEntrega?.length ? (
                <ul className="space-y-2">
                  {entrega.obsequiosEntrega.map((item, index) => (
                    <li key={`${item.obsequio?.nombre}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {item.obsequio?.nombre || "Obsequio"} × {item.cantidad}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">Sin obsequios.</p>}
            </section>

            <section>
              <h4 className="mb-3 text-sm font-bold text-slate-900">Errores registrados</h4>
              {entrega.errores?.length ? (
                <div className="flex flex-wrap gap-2">
                  {entrega.errores.map((error, index) => (
                    <span key={`${error}-${index}`} className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                      {error}
                    </span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">Sin errores registrados.</p>}
            </section>

            <section>
              <h4 className="mb-3 text-sm font-bold text-slate-900">Evidencias</h4>
              {evidencias.length ? (
                <div className="flex flex-col items-start gap-2">
                  {evidencias.map((evidencia) => (
                    <a
                      key={evidencia.label}
                      href={resolverArchivoUrl(evidencia.value)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Ver {evidencia.label.toLowerCase()} <ExternalLink size={14} />
                    </a>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">Sin evidencias adjuntas.</p>}
            </section>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function EntregasRepartidoresTabla() {
  const [repartidores, setRepartidores] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingRepartidores, setLoadingRepartidores] = useState(false);

  const [fechaInicio, setFechaInicio] = useState(getHoyLocal());
  const [fechaFin, setFechaFin] = useState(getHoyLocal());
  const [estado, setEstado] = useState("");
  const [clasificacion, setClasificacion] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // control UI errores
  const [filaAbierta, setFilaAbierta] = useState(null);
  const [erroresTemp, setErroresTemp] = useState({});
  const [guardandoErrores, setGuardandoErrores] = useState({});
  const [guardandoTipoEntrega, setGuardandoTipoEntrega] = useState({});
  const [entregaDetalle, setEntregaDetalle] = useState(null);
  const [entregaReasignacion, setEntregaReasignacion] = useState(null);
  const [nuevoRepartidorId, setNuevoRepartidorId] = useState("");
  const [reasignando, setReasignando] = useState(false);

  useEffect(() => {
    const fetchRepartidores = async () => {
      try {
        setLoadingRepartidores(true);

        const response = await api.get(
          "/api/usuario-permisos/usuarios-repartidores",
        );

        setRepartidores(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error(err);
        setRepartidores([]);
      } finally {
        setLoadingRepartidores(false);
      }
    };

    fetchRepartidores();
  }, []);

  const fetchEntregas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (repartidorSeleccionado) params.userId = repartidorSeleccionado;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;
      if (estado) params.estado = estado;
      if (clasificacion) params.clasificacion = clasificacion;

      const response = await api.get("/entregas/entregas", {
        params,
      });

      const data = Array.isArray(response.data) ? response.data : [];
      setEntregas(data);

      // inicializar errores temporales desde backend
      const inicial = {};
      data.forEach((entrega) => {
        inicial[entrega.id] = Array.isArray(entrega.errores)
          ? entrega.errores
          : [];
      });
      setErroresTemp(inicial);
    } catch (err) {
      console.error(err);
      setError("Error al cargar entregas");
      setEntregas([]);
    } finally {
      setLoading(false);
    }
  }, [repartidorSeleccionado, fechaInicio, fechaFin, estado, clasificacion]);

  useEffect(() => {
    fetchEntregas();
  }, [fetchEntregas]);

  useEffect(() => {
    if (!entregaDetalle) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setEntregaDetalle(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [entregaDetalle]);

  const entregasFiltradas = useMemo(() => {
    const termino = normalizarTexto(busqueda);
    if (!termino) return entregas;

    return entregas.filter((entrega) =>
      [
        entrega.id,
        entrega.cliente?.cliente,
        entrega.cliente?.cedula,
        entrega.vendedor,
      ].some((value) => normalizarTexto(value).includes(termino)),
    );
  }, [busqueda, entregas]);

  const toggleError = (entregaId, errorTexto) => {
    setErroresTemp((prev) => {
      const actuales = prev[entregaId] || [];
      const existe = actuales.includes(errorTexto);

      return {
        ...prev,
        [entregaId]: existe
          ? actuales.filter((e) => e !== errorTexto)
          : [...actuales, errorTexto],
      };
    });
  };

  const seleccionarNinguno = (entregaId) => {
    setErroresTemp((prev) => ({
      ...prev,
      [entregaId]: [],
    }));
  };

  const guardarErrores = async (id) => {
    try {
      setGuardandoErrores((prev) => ({ ...prev, [id]: true }));

      const errores = erroresTemp[id] || [];

      const actual = entregas.find((entrega) => entrega.id === id);
      const response = await api.put(`/entregas/${id}`, {
        errores,
        expectedVersion: actual?.version,
        motivo: "Actualizacion de errores logisticos",
        idempotencyKey: nuevaClaveOperacion(),
      });

      setEntregas((prev) =>
        prev.map((entrega) =>
          entrega.id === id
            ? { ...entrega, errores, version: response.data.version }
            : entrega,
        ),
      );

      setFilaAbierta(null);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) await fetchEntregas();
      alert(
        err.response?.status === 409
          ? "La entrega cambio mientras la editabas. Se recargaron los datos."
          : "No se pudieron guardar los errores",
      );
    } finally {
      setGuardandoErrores((prev) => ({ ...prev, [id]: false }));
    }
  };

  const cambiarTipoEntrega = async (entregaId, nuevoTipo) => {
    const entregaActual = entregas.find((entrega) => entrega.id === entregaId);
    const tipoAnterior = entregaActual?.tipoEntrega || "Entrega";

    if (nuevoTipo === tipoAnterior) return;

    setEntregas((prev) =>
      prev.map((entrega) =>
        entrega.id === entregaId
          ? { ...entrega, tipoEntrega: nuevoTipo }
          : entrega,
      ),
    );
    setGuardandoTipoEntrega((prev) => ({ ...prev, [entregaId]: true }));

    try {
      const response = await api.patch(`/entregas/${entregaId}/tipo-entrega`, {
        tipoEntrega: nuevoTipo,
        expectedVersion: entregaActual?.version,
        idempotencyKey: nuevaClaveOperacion(),
      });

      setEntregas((prev) =>
        prev.map((entrega) =>
          entrega.id === entregaId
            ? { ...entrega, version: response.data.version }
            : entrega,
        ),
      );

      await Swal.fire({
        icon: "success",
        title:
          nuevoTipo === "Envio" ? "Cambiado a envío" : "Cambiado a entrega",
        toast: true,
        position: "top-end",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(err);
      setEntregas((prev) =>
        prev.map((entrega) =>
          entrega.id === entregaId
            ? { ...entrega, tipoEntrega: tipoAnterior }
            : entrega,
        ),
      );

      await Swal.fire({
        icon: "error",
        title: "No se pudo cambiar el tipo",
        text:
          err.response?.data?.message ||
          "Ocurrió un error al actualizar la entrega.",
      });
      if (err.response?.status === 409) await fetchEntregas();
    } finally {
      setGuardandoTipoEntrega((prev) => ({ ...prev, [entregaId]: false }));
    }
  };

  const renderTipoEntrega = (entrega) => {
    const guardando = Boolean(guardandoTipoEntrega[entrega.id]);
    const estadoAsignacion =
      entrega.repartidores?.[0]?.UsuarioAgenciaEntrega?.estado;

    return (
      <div className="min-w-32 space-y-1">
        <select
          value={entrega.tipoEntrega || "Entrega"}
          onChange={(event) =>
            cambiarTipoEntrega(entrega.id, event.target.value)
          }
          disabled={guardando}
          aria-label={`Forma de entrega ${entrega.id}`}
          className="w-full rounded-lg border border-green-300 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 disabled:cursor-wait disabled:opacity-60"
        >
          <option value="Entrega">Entrega</option>
          <option value="Envio">Envío</option>
        </select>

        <span className="block text-xs text-gray-400">
          {guardando ? "Guardando..." : estadoAsignacion || "Sin asignación"}
        </span>
      </div>
    );
  };

  const abrirReasignacion = (entrega) => {
    setEntregaReasignacion(entrega);
    setNuevoRepartidorId("");
  };

  const cerrarReasignacion = () => {
    if (reasignando) return;
    setEntregaReasignacion(null);
    setNuevoRepartidorId("");
  };

  const repartidorActualId =
    entregaReasignacion?.repartidores?.find(
      (repartidor) =>
        repartidor.UsuarioAgenciaEntrega?.activo !== false,
    )?.id ?? entregaReasignacion?.repartidores?.[0]?.id;

  const repartidoresDisponibles = useMemo(
    () =>
      repartidores.filter(
        (repartidor) => String(repartidor.id) !== String(repartidorActualId),
      ),
    [repartidorActualId, repartidores],
  );

  const confirmarReasignacion = async () => {
    if (!entregaReasignacion || !nuevoRepartidorId) return;

    const nuevoRepartidor = repartidores.find(
      (repartidor) => String(repartidor.id) === String(nuevoRepartidorId),
    );
    const nombreNuevo = nuevoRepartidor?.usuario?.nombre || "el repartidor seleccionado";

    const confirmacion = await Swal.fire({
      icon: "warning",
      title: "Cambiar responsable",
      text: `La entrega #${entregaReasignacion.id} pasará de ${entregaReasignacion.motorizado || "su repartidor actual"} a ${nombreNuevo}.`,
      input: "textarea",
      inputLabel: "Motivo obligatorio",
      inputValidator: (value) =>
        !value?.trim() ? "Ingresa el motivo" : undefined,
      showCancelButton: true,
      confirmButtonText: "Confirmar cambio",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setReasignando(true);

      await api.post(
        `/entregas/${entregaReasignacion.id}/asignar-repartidor`,
        {
          usuarioAgenciaId: Number(nuevoRepartidorId),
          forzarReasignacion: true,
          expectedVersion: entregaReasignacion.version,
          motivo: confirmacion.value.trim(),
          idempotencyKey: nuevaClaveOperacion(),
        },
      );

      await fetchEntregas();
      setEntregaReasignacion(null);
      setNuevoRepartidorId("");

      await Swal.fire({
        icon: "success",
        title: "Responsable actualizado",
        text: `Ahora está asignada a ${nombreNuevo}.`,
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "No se pudo cambiar el responsable",
        text:
          err.response?.data?.message ||
          "Ocurrió un error al cambiar el repartidor.",
      });
      if (err.response?.status === 409) await fetchEntregas();
    } finally {
      setReasignando(false);
    }
  };

  const cambiarEstado = async (entrega) => {
    const opciones = {
      Pendiente: ["Transito", "Revisar", "No Entregado"],
      Revisar: ["Pendiente", "Transito"],
      Transito: ["Entregado", "No Entregado", "Revisar"],
    }[entrega.estado] || [];
    if (!opciones.length) return;

    const estadoResultado = await Swal.fire({
      title: `Actualizar estado de #${entrega.id}`,
      input: "select",
      inputOptions: Object.fromEntries(opciones.map((valor) => [valor, valor])),
      inputPlaceholder: "Selecciona el nuevo estado",
      showCancelButton: true,
      inputValidator: (value) =>
        !value ? "Selecciona un estado" : undefined,
    });
    if (!estadoResultado.isConfirmed) return;

    const motivoResultado = await Swal.fire({
      title: "Motivo del cambio",
      input: "textarea",
      showCancelButton: true,
      inputValidator: (value) =>
        !value?.trim() ? "Ingresa el motivo" : undefined,
    });
    if (!motivoResultado.isConfirmed) return;

    try {
      await api.patch(`/entregas/${entrega.id}/estado`, {
        estado: estadoResultado.value,
        expectedVersion: entrega.version,
        motivo: motivoResultado.value.trim(),
        idempotencyKey: nuevaClaveOperacion(),
      });
      await fetchEntregas();
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo cambiar el estado",
        text: err.response?.data?.message || "Ocurrió un error.",
      });
      if (err.response?.status === 409) await fetchEntregas();
    }
  };

  const renderAcciones = (entrega) => {
    const editable = !["Entregado", "No Entregado"].includes(entrega.estado);
    return (
      <div className="flex min-w-40 flex-col gap-2">
        <button
          type="button"
          onClick={() => setEntregaDetalle(entrega)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <Eye size={15} /> Ver entrega
        </button>
        {editable && (
          <>
            <button type="button" onClick={() => cambiarEstado(entrega)} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
              Actualizar estado
            </button>
            <button type="button" onClick={() => abrirReasignacion(entrega)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
              Cambiar responsable
            </button>
          </>
        )}
      </div>
    );
  };

  const renderErroresGuardados = (errores) => {
    if (!Array.isArray(errores) || errores.length === 0) {
      return <span className="text-gray-400">Ninguno</span>;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {errores.map((err, idx) => (
          <span
            key={idx}
            className="inline-block bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full"
          >
            {err}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          Informe de Entregas
        </h2>
        <p className="text-sm text-gray-500">
          Consulta y seguimiento de entregas asignadas
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-700">Buscar</label>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="ID, cliente, cédula o vendedor"
            className="w-full mt-1 rounded-xl border-gray-300"
          />
          <p className="mt-1 text-xs text-gray-400">
            {entregasFiltradas.length} resultado(s)
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Repartidor
          </label>
          <select
            value={repartidorSeleccionado}
            onChange={(e) => setRepartidorSeleccionado(e.target.value)}
            disabled={loadingRepartidores}
            className="w-full mt-1 rounded-xl border-gray-300"
          >
            <option value="">
              {loadingRepartidores ? "Cargando..." : "Todos"}
            </option>
            {repartidores.map((r) => (
              <option key={r.id} value={r.id}>
                {r.usuario.nombre} — {r.agencia.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Fecha inicio
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Fecha fin</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Estado</label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          >
            <option value="">Todos</option>
            <option value="Entregado">Entregado</option>
            <option value="Pendiente">Pendiente</option>
            <option value="No Entregado">No Entregado</option>
            <option value="Transito">En tránsito</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            Tipo / proceso
          </label>
          <select
            value={clasificacion}
            onChange={(e) => setClasificacion(e.target.value)}
            className="w-full mt-1 rounded-xl border-gray-300"
          >
            <option value="">Todos</option>
            <option value="Envio">Envío</option>
            <option value="Entrega">Entrega</option>
            <option value="ProcesoCompleto">Proceso completo</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-center text-gray-500 mb-4">Cargando entregas…</div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-4">
          {error}
        </div>
      )}

      {!loading && !error && entregas.length === 0 && (
        <div className="text-center text-gray-500 mb-4">
          No hay entregas registradas
        </div>
      )}

      {!loading &&
        !error &&
        entregas.length > 0 &&
        entregasFiltradas.length === 0 && (
          <div className="text-center text-gray-500 mb-4">
            No se encontraron entregas con la búsqueda ingresada
          </div>
        )}

      <div className="bg-white rounded-2xl shadow-md border overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Detalle</th>
              <th className="px-4 py-3">Obsequios</th>
              <th className="px-4 py-3">Vended@r</th>
              <th className="px-4 py-3">Agencia</th>
              <th className="px-4 py-3">Sector</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Forma de Pago</th>
              <th className="px-4 py-3">Forma de Entrega</th>
              <th className="px-4 py-3">Entrada</th>
              <th className="px-4 py-3">Alcance</th>
              <th className="px-4 py-3">Motorizado</th>
              <th className="px-4 py-3">Errores</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {!loading &&
              !error &&
              entregasFiltradas.flatMap((entrega, j) =>
                entrega.detalleEntregas?.length > 0
                  ? entrega.detalleEntregas.map((d, index) => (
                      <tr
                        key={`${entrega.id}-${index}`}
                        className="hover:bg-gray-50 align-top"
                      >
                        <td className="px-4 py-2">{j + 1}</td>

                        <td className="px-4 py-2">{entrega.id}</td>
                        <td className="px-4 py-2">{entrega.fecha ?? "—"}</td>

                        <td className="px-4 py-2">
                          {entrega.cliente?.cliente ?? "—"}
                        </td>

                        <td className="px-4 py-2">
                          {d.dispositivoMarca?.dispositivo?.nombre ?? "—"}
                        </td>

                        <td className="px-4 py-2">{d.modelo?.nombre ?? "—"}</td>

                        <td className="px-4 py-2">
                          {entrega.obsequiosEntrega?.length > 0
                            ? entrega.obsequiosEntrega
                                .map(
                                  (o) =>
                                    `${o.obsequio?.nombre} (${o.cantidad})`,
                                )
                                .join(", ")
                            : "—"}
                        </td>

                        <td className="px-4 py-2">{entrega.vendedor ?? "—"}</td>

                        <td className="px-4 py-2">
                          {entrega.agenciaVendedor ?? "—"}
                        </td>

                        <td className="px-4 py-2">
                          {entrega.sectorEntrega ?? "—"}
                        </td>

                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              entrega.estado === "Entregado"
                                ? "bg-green-100 text-green-700"
                                : entrega.estado === "Transito"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {entrega.estado}
                          </span>
                        </td>

                        <td className="px-4 py-2">
                          {d.formaPago?.nombre ?? "—"}
                        </td>

                        {index === 0 && (
                          <td
                            className="px-4 py-2"
                            rowSpan={entrega.detalleEntregas.length}
                          >
                            {renderTipoEntrega(entrega)}
                          </td>
                        )}

                        <td className="px-4 py-2">${d.entrada ?? "0.00"}</td>

                        <td className="px-4 py-2">${d.alcance ?? "0.00"}</td>

                        <td className="px-4 py-2">
                          {entrega.motorizado ?? "—"}
                          {entrega.advertenciaResponsable && (
                            <span className="mt-1 block rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                              {entrega.advertenciaResponsable}
                            </span>
                          )}
                        </td>

                        {/* NUEVA COLUMNA ERRORES */}
                        <td className="px-4 py-2 min-w-[320px]">
                          <div className="space-y-2">
                            {renderErroresGuardados(entrega.errores)}

                            <button
                              type="button"
                              onClick={() =>
                                setFilaAbierta(
                                  filaAbierta === entrega.id
                                    ? null
                                    : entrega.id,
                                )
                              }
                              className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                              {filaAbierta === entrega.id
                                ? "Cerrar"
                                : "Agregar error"}
                            </button>

                            {filaAbierta === entrega.id && (
                              <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={
                                      (erroresTemp[entrega.id] || []).length ===
                                      0
                                    }
                                    onChange={() =>
                                      seleccionarNinguno(entrega.id)
                                    }
                                  />
                                  Ninguno
                                </label>

                                <div className="space-y-2 max-h-52 overflow-y-auto">
                                  {OPCIONES_ERRORES.map((opcion) => (
                                    <label
                                      key={opcion}
                                      className="flex items-start gap-2 text-sm text-gray-700"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={(
                                          erroresTemp[entrega.id] || []
                                        ).includes(opcion)}
                                        onChange={() =>
                                          toggleError(entrega.id, opcion)
                                        }
                                      />
                                      <span>{opcion}</span>
                                    </label>
                                  ))}
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => guardarErrores(entrega.id)}
                                    disabled={guardandoErrores[entrega.id]}
                                    className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                                  >
                                    {guardandoErrores[entrega.id]
                                      ? "Guardando..."
                                      : "Guardar"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setErroresTemp((prev) => ({
                                        ...prev,
                                        [entrega.id]: Array.isArray(
                                          entrega.errores,
                                        )
                                          ? entrega.errores
                                          : [],
                                      }));
                                      setFilaAbierta(null);
                                    }}
                                    className="px-3 py-1.5 text-xs rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-2">
                          {index === 0
                            ? renderAcciones(entrega)
                            : null}
                        </td>
                      </tr>
                    ))
                  : [
                      <tr key={entrega.id}>
                        <td
                          colSpan="12"
                          className="text-center py-4 text-gray-400"
                        >
                          Entrega sin productos
                        </td>
                        <td className="px-4 py-2">
                          {renderTipoEntrega(entrega)}
                        </td>
                        <td colSpan="4" className="px-4 py-2 text-gray-400">
                          —
                        </td>
                        <td className="px-4 py-2">
                          {renderAcciones(entrega)}
                        </td>
                      </tr>,
                    ],
              )}
          </tbody>
        </table>
      </div>

      <EntregaDetalleModal
        entrega={entregaDetalle}
        onClose={() => setEntregaDetalle(null)}
      />

      {entregaReasignacion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-reasignacion"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3
              id="titulo-reasignacion"
              className="text-lg font-bold text-gray-800"
            >
              Cambiar responsable de entrega #{entregaReasignacion.id}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Repartidor actual: {entregaReasignacion.motorizado || "Sin información"}
            </p>

            <label className="mt-5 block text-sm font-medium text-gray-700">
              Nuevo repartidor
              <select
                value={nuevoRepartidorId}
                onChange={(event) => setNuevoRepartidorId(event.target.value)}
                disabled={reasignando}
                className="mt-1 w-full rounded-xl border-gray-300"
              >
                <option value="">-- Seleccione un repartidor --</option>
                {repartidoresDisponibles.map((repartidor) => (
                  <option key={repartidor.id} value={repartidor.id}>
                    {repartidor.usuario?.nombre || "Sin nombre"} — {repartidor.agencia?.nombre || "Sin agencia"}
                  </option>
                ))}
              </select>
            </label>

            {repartidoresDisponibles.length === 0 && (
              <p className="mt-2 text-sm text-amber-700">
                No hay otro repartidor activo disponible.
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarReasignacion}
                disabled={reasignando}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReasignacion}
                disabled={!nuevoRepartidorId || reasignando}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reasignando ? "Actualizando..." : "Cambiar responsable"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
