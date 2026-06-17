import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import {
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";
import { getHoyLocal } from "../../utils/dateUtils";
import { useAuthUser } from "../../utils/useAuthUser";

const DENOMINACIONES_BASE = [100, 50, 20, 10, 5, 1, 0.5, 0.25, 0.1, 0.05, 0.01];
const DETALLES_CAJA = [
  "CUOTA",
  "ENTRADA",
  "ALCANCE",
  "CREDITO",
  "CONTADO",
  "CANCELA_ENTRADA_PEND",
  "CANCELA_ALCANCE_PEND",
  "EGRESO",
  "TARJETA DE CREDITO",
];
const FORMAS_PAGO = ["EFECTIVO", "TRANSFERENCIA", "PENDIENTE"];

const movimientoVacio = {
  responsable: "",
  detalle: "",
  valor: "",
  formaPago: "",
  recibo: "",
  entidad: "",
  observacion: "",
};

const retiroVacio = {
  monto: "",
  motivo: "",
  autorizadoPor: "",
};

const formatearMoneda = (valor) => `$${Number(valor || 0).toFixed(2)}`;

const claseDiferencia = (valor) => {
  const diferencia = Number(valor) || 0;

  if (diferencia < 0) return "font-semibold text-red-700";
  if (diferencia > 0) return "font-semibold text-green-700";
  return "font-semibold text-green-700";
};

const estadoCuadre = (cierre = {}) =>
  Number(cierre.diferencia || 0) === 0 ? "CUADRADO" : "DESCUADRADO";

const formatearFecha = (fecha) => {
  if (!fecha) return "";
  const partes = String(fecha).slice(0, 10).split("-");
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const formatearFechaHora = (fecha) => {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleString("es-EC");
};

const normalizarNumeroPositivoTexto = (value) => {
  const normalizado = String(value || "").replace(/,/g, ".");
  const limpio = normalizado.replace(/[^\d.]/g, "");
  const [entero, ...decimales] = limpio.split(".");

  if (!decimales.length) return entero;

  return `${entero}.${decimales.join("").slice(0, 2)}`;
};

const normalizarEnteroPositivoTexto = (value) =>
  String(value || "").replace(/\D/g, "");

const normalizarRol = (rol) =>
  String(rol || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const uniqueById = (items) => {
  const map = new Map();
  items.forEach((item) => {
    if (item?.id) map.set(item.id, item);
  });
  return [...map.values()];
};

const crearDenominacionesEdit = (denominaciones = []) => {
  const existentes = new Map(
    denominaciones.map((d) => [Number(d.valor), d.cantidad]),
  );

  return DENOMINACIONES_BASE.map((valor) => ({
    valor,
    cantidad:
      Number(existentes.get(Number(valor))) > 0
        ? normalizarEnteroPositivoTexto(existentes.get(Number(valor)))
        : "",
  }));
};

const mapMovimientoEdit = (m = {}) => ({
  responsable: m.responsable || "",
  detalle: m.detalle || "",
  valor: m.valor || "",
  formaPago: m.formaPago || "",
  recibo: m.recibo || "",
  entidad: m.entidad || m.observacion || "",
  observacion: m.entidad ? m.observacion || "" : "",
});

const crearEditForm = (item) => ({
  fecha: String(item.cierre?.fecha || "").slice(0, 10),
  agenciaId: item.cierre?.agenciaId || item.cierre?.usuarioAgencia?.agenciaId || "",
  usuarioId: item.cierre?.usuarioId || item.cierre?.usuarioAgencia?.usuarioId || "",
  observacion: item.cierre?.observacion || "",
  observacionContabilidad: item.cierre?.observacionContabilidad || "",
  denominaciones: crearDenominacionesEdit(item.denominaciones || []),
  movimientos: (item.movimientos || []).map(mapMovimientoEdit),
  retiros: (item.retiros || []).map((r) => ({
    monto: r.monto || "",
    motivo: r.motivo || "",
    autorizadoPor: r.autorizadoPor || "",
  })),
});

const totalDenominaciones = (denominaciones = []) =>
  denominaciones.reduce(
    (total, d) => total + Number(d.valor) * (Number(d.cantidad) || 0),
    0,
  );

const getResumenPorTipo = (resumenPorTipo = {}) => [
  {
    key: "cuotaEfectivo",
    label: "Cuota Efectivo",
    value: resumenPorTipo.cuotaEfectivo,
  },
  {
    key: "cuotaTransferencia",
    label: "Cuota Transferencia",
    value: resumenPorTipo.cuotaTransferencia,
  },
  {
    key: "contadoEfectivo",
    label: "Contado Efectivo",
    value: resumenPorTipo.contadoEfectivo,
  },
  {
    key: "contadoTransferencia",
    label: "Contado Transferencia",
    value: resumenPorTipo.contadoTransferencia,
  },
  {
    key: "entradaEfectivo",
    label: "Entrada Efectivo",
    value: resumenPorTipo.entradaEfectivo,
  },
  {
    key: "entradaTransferencia",
    label: "Entrada Transferencia",
    value: resumenPorTipo.entradaTransferencia,
  },
  {
    key: "entradaPendiente",
    label: "Entrada Pendiente",
    value: resumenPorTipo.entradaPendiente,
  },
  {
    key: "alcanceEfectivo",
    label: "Alcance Efectivo",
    value: resumenPorTipo.alcanceEfectivo,
  },
  {
    key: "alcanceTransferencia",
    label: "Alcance Transferencia",
    value: resumenPorTipo.alcanceTransferencia,
  },
];

const obtenerMensajeError = (error, fallback) => {
  if (error?.response?.status === 401) {
    return "Sesion expirada. Vuelve a iniciar sesion.";
  }
  return error?.response?.data?.message || fallback;
};

export default function CierresCajaTabla() {
  const navigate = useNavigate();
  const authUser = useAuthUser();
  const isAdmin = ["admin", "administrador"].includes(
    normalizarRol(authUser?.rol?.nombre),
  );

  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedCierreId, setSelectedCierreId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [fechaInicio, setFechaInicio] = useState(getHoyLocal());
  const [fechaFin, setFechaFin] = useState(getHoyLocal());
  const [agenciaId, setAgenciaId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [estadoCierre, setEstadoCierre] = useState("");

  const [filtros, setFiltros] = useState({
    agencias: [],
    usuarios: [],
    relaciones: [],
  });

  const manejarSesionExpirada = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("activeMode");
    Swal.fire("Sesion expirada", "Vuelve a iniciar sesion.", "warning").then(() => {
      navigate("/login");
    });
  };

  const usuariosFiltrados = useMemo(() => {
    if (!agenciaId) return filtros.usuarios;

    return uniqueById(
      filtros.relaciones
        .filter((relacion) => String(relacion.agenciaId) === String(agenciaId))
        .map((relacion) => relacion.usuario),
    );
  }, [agenciaId, filtros.relaciones, filtros.usuarios]);

  const selectedItem = useMemo(() => {
    if (!cierres.length) return null;
    return (
      cierres.find((item) => String(item.cierre.id) === String(selectedCierreId)) ||
      cierres[0]
    );
  }, [cierres, selectedCierreId]);

  const cargarFiltros = async () => {
    try {
      const { data } = await axios.get(
        `${API_URL}/api/contabilidad/cierres-caja/filtros`,
      );
      setFiltros({
        agencias: data.agencias || [],
        usuarios: data.usuarios || [],
        relaciones: data.relaciones || [],
      });
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 401) {
        manejarSesionExpirada();
        return;
      }
      Swal.fire("Error", obtenerMensajeError(err, "No se pudieron cargar filtros"), "error");
    }
  };

  const obtenerCierres = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await axios.get(`${API_URL}/api/contabilidad/cierres-caja`, {
        params: {
          fechaInicio,
          fechaFin,
          ...(agenciaId && { agenciaId }),
          ...(usuarioId && { usuarioId }),
          ...(estadoCierre && { estadoCierre }),
        },
      });

      setCierres(data?.data || []);
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 401) {
        setError("Sesion expirada. Vuelve a iniciar sesion.");
        manejarSesionExpirada();
        return;
      }
      setError(obtenerMensajeError(err, "Error al obtener los cierres de caja"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFiltros();
    obtenerCierres();
  }, []);

  useEffect(() => {
    setUsuarioId("");
  }, [agenciaId]);

  useEffect(() => {
    if (!cierres.length) {
      setSelectedCierreId(null);
      cancelarEdicion();
      return;
    }

    const existeSeleccion = cierres.some(
      (item) => String(item.cierre.id) === String(selectedCierreId),
    );

    if (!existeSeleccion) {
      setSelectedCierreId(cierres[0].cierre.id);
      cancelarEdicion();
    }
  }, [cierres, selectedCierreId]);

  const seleccionarCierre = (id) => {
    setSelectedCierreId(id);
    if (String(editingId) !== String(id)) cancelarEdicion();
  };

  const iniciarEdicion = (item) => {
    if (item.cierre.estadoCierre !== "REABIERTO") {
      Swal.fire("Atencion", "Solo se puede editar una caja reabierta", "warning");
      return;
    }

    setSelectedCierreId(item.cierre.id);
    setEditingId(item.cierre.id);
    setEditForm(crearEditForm(item));
  };

  const cancelarEdicion = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const reabrirCierre = async (cierre) => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: "Reabrir cierre",
      input: "textarea",
      inputLabel: "Motivo",
      inputPlaceholder: "Describe por que se reabre esta caja",
      inputValidator: (value) => (!value?.trim() ? "El motivo es obligatorio" : undefined),
      showCancelButton: true,
      confirmButtonText: "Reabrir",
      cancelButtonText: "Cancelar",
    });

    if (!isConfirmed) return;

    try {
      await axios.patch(`${API_URL}/api/contabilidad/cierre-caja/${cierre.id}/reabrir`, {
        motivo,
      });
      Swal.fire("Listo", "Caja reabierta correctamente", "success");
      await obtenerCierres();
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 401) {
        manejarSesionExpirada();
        return;
      }
      Swal.fire("Error", obtenerMensajeError(err, "No se pudo reabrir la caja"), "error");
    }
  };

  const guardarEdicion = async () => {
    if (!editingId || !editForm) return;

    const movimientosValidos = editForm.movimientos.filter(
      (m) => m.detalle?.trim() && Number(m.valor) > 0 && m.formaPago?.trim(),
    );

    if (!movimientosValidos.length) {
      Swal.fire("Atencion", "Debe existir al menos un movimiento valido", "warning");
      return;
    }

    if (!editForm.fecha || !editForm.agenciaId || !editForm.usuarioId) {
      Swal.fire("Atencion", "Debe seleccionar fecha, agencia y usuario", "warning");
      return;
    }

    setSaving(true);

    try {
      await axios.put(`${API_URL}/api/contabilidad/cierre-caja/${editingId}`, {
        cierre: {
          fecha: editForm.fecha,
          agenciaId: Number(editForm.agenciaId),
          usuarioId: Number(editForm.usuarioId),
          observacion: editForm.observacion,
          observacionContabilidad: editForm.observacionContabilidad,
        },
        denominaciones: editForm.denominaciones
          .filter((d) => Number(d.cantidad) > 0)
          .map((d) => ({
            valor: Number(d.valor),
            cantidad: Number(d.cantidad),
          })),
        movimientos: movimientosValidos.map((m) => ({
          responsable: m.responsable || "",
          detalle: m.detalle,
          valor: Number(m.valor),
          formaPago: m.formaPago,
          recibo: m.recibo || null,
          entidad: m.entidad || "",
          observacion: m.observacion || "",
        })),
        retiros: editForm.retiros
          .filter((r) => Number(r.monto) > 0 || r.motivo?.trim() || r.autorizadoPor?.trim())
          .map((r) => ({
            monto: Number(r.monto) || 0,
            motivo: r.motivo || "",
            autorizadoPor: r.autorizadoPor || "",
          })),
      });

      Swal.fire("Listo", "Caja actualizada y cerrada correctamente", "success");
      cancelarEdicion();
      await obtenerCierres();
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 401) {
        manejarSesionExpirada();
        return;
      }
      Swal.fire("Error", obtenerMensajeError(err, "No se pudo guardar la caja"), "error");
    } finally {
      setSaving(false);
    }
  };

  const actualizarEditForm = (path, value) => {
    setEditForm((prev) => ({
      ...prev,
      [path]: value,
    }));
  };

  const actualizarLista = (lista, index, field, value) => {
    setEditForm((prev) => {
      const next = [...prev[lista]];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [lista]: next };
    });
  };

  const agregarItem = (lista, item) => {
    setEditForm((prev) => ({
      ...prev,
      [lista]: [...prev[lista], item],
    }));
  };

  const eliminarItem = (lista, index) => {
    setEditForm((prev) => ({
      ...prev,
      [lista]: prev[lista].filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="p-4">
      <div className="border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Cierres de Caja</h2>
              <p className="text-sm text-gray-500">
                Consulta por agencia, usuario y estado operativo de caja.
              </p>
            </div>

            <button
              type="button"
              onClick={obtenerCierres}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw size={18} />
              {loading ? "Cargando" : "Recargar"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FiltroFecha label="Fecha Inicio" value={fechaInicio} onChange={setFechaInicio} />
            <FiltroFecha label="Fecha Fin" value={fechaFin} onChange={setFechaFin} />

            <label className="text-sm font-medium text-gray-700">
              Agencia
              <select
                className="mt-1 w-full rounded border px-2 py-2"
                value={agenciaId}
                onChange={(e) => setAgenciaId(e.target.value)}
              >
                <option value="">Todas</option>
                {filtros.agencias.map((agencia) => (
                  <option key={agencia.id} value={agencia.id}>
                    {agencia.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Usuario
              <select
                className="mt-1 w-full rounded border px-2 py-2"
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
              >
                <option value="">Todos</option>
                {usuariosFiltrados.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Estado cierre
              <select
                className="mt-1 w-full rounded border px-2 py-2"
                value={estadoCierre}
                onChange={(e) => setEstadoCierre(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="CERRADO">Cerrado</option>
                <option value="REABIERTO">Reabierto</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </label>
          </div>
        </div>

        {error && <div className="p-4 font-medium text-red-600">{error}</div>}

        {!error && (
          <div className="space-y-3 bg-gray-50 p-3">
            {loading ? (
              <div className="border bg-white px-3 py-6 text-center text-gray-500">
                Cargando cierres de caja...
              </div>
            ) : cierres.length === 0 ? (
              <div className="border bg-white px-3 py-6 text-center text-gray-500">
                No existen cierres de caja para los filtros seleccionados
              </div>
            ) : (
              <>
                <SelectorCierres
                  cierres={cierres}
                  selectedCierreId={selectedItem?.cierre.id}
                  seleccionarCierre={seleccionarCierre}
                />

                {selectedItem && (
                  <div className="space-y-3">
                    <BarraAccionesCierre
                      item={selectedItem}
                      isAdmin={isAdmin}
                      isEditing={editingId === selectedItem.cierre.id}
                      reabrirCierre={reabrirCierre}
                      iniciarEdicion={iniciarEdicion}
                    />

                    {editingId === selectedItem.cierre.id && editForm ? (
                      <EditorCierre
                        editForm={editForm}
                        filtros={filtros}
                        saving={saving}
                        actualizarEditForm={actualizarEditForm}
                        actualizarLista={actualizarLista}
                        agregarItem={agregarItem}
                        eliminarItem={eliminarItem}
                        guardarEdicion={guardarEdicion}
                        cancelarEdicion={cancelarEdicion}
                      />
                    ) : (
                      <VistaCierreVendedor item={selectedItem} />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FiltroFecha({ label, value, onChange }) {
  return (
    <label className="text-sm font-medium text-gray-700">
      {label}
      <input
        type="date"
        className="mt-1 w-full rounded border px-2 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Th({ children, align = "left" }) {
  const alignClass = align === "center" ? "text-center" : "text-left";

  return (
    <th className={`border px-3 py-2 ${alignClass} font-semibold text-gray-700`}>
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="border px-3 py-2 align-top">{children}</td>;
}

function IconButton({ children, title, onClick, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-600 hover:bg-blue-700",
    amber: "bg-amber-500 hover:bg-amber-600",
    green: "bg-green-600 hover:bg-green-700",
    red: "bg-red-600 hover:bg-red-700",
    gray: "bg-gray-600 hover:bg-gray-700",
  };

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded text-white ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function EstadoBadge({ estado }) {
  const cuadrado = estado === "CUADRADO";
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-semibold text-white ${
        cuadrado ? "bg-green-600" : "bg-red-600"
      }`}
    >
      {estado || "-"}
    </span>
  );
}

function EstadoCierreBadge({ estado }) {
  const colors = {
    CERRADO: "bg-slate-700",
    REABIERTO: "bg-amber-600",
    ANULADO: "bg-red-700",
  };

  return (
    <span className={`rounded px-2 py-1 text-xs font-semibold text-white ${colors[estado] || "bg-gray-600"}`}>
      {estado || "CERRADO"}
    </span>
  );
}

function SelectorCierres({ cierres, selectedCierreId, seleccionarCierre }) {
  return (
    <div className="overflow-x-auto border bg-white">
      <table className="w-full min-w-[1120px] border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
            <Th>ID</Th>
            <Th>Fecha</Th>
            <Th>Usuario</Th>
            <Th>Agencia</Th>
            <Th>Fisico</Th>
            <Th>Diferencia</Th>
            <Th>Cuadre</Th>
            <Th>Estado</Th>
            <Th>Observacion contabilidad</Th>
          </tr>
        </thead>
        <tbody>
          {cierres.map((item) => {
            const cierre = item.cierre;
            const activo = String(cierre.id) === String(selectedCierreId);

            return (
              <tr
                key={cierre.id}
                onClick={() => seleccionarCierre(cierre.id)}
                className={`cursor-pointer hover:bg-gray-50 ${
                  activo ? "bg-blue-50 outline outline-1 outline-blue-300" : ""
                }`}
              >
                <Td>{cierre.id}</Td>
                <Td>{formatearFecha(cierre.fecha)}</Td>
                <Td>{cierre.usuarioAgencia?.usuario?.nombre || "-"}</Td>
                <Td>{cierre.usuarioAgencia?.agencia?.nombre || "-"}</Td>
                <Td>{formatearMoneda(cierre.totalFisico)}</Td>
                <Td>
                  <span
                    className={claseDiferencia(cierre.diferencia)}
                  >
                    {formatearMoneda(cierre.diferencia)}
                  </span>
                </Td>
                <Td>
                  <EstadoBadge estado={estadoCuadre(cierre)} />
                </Td>
                <Td>
                  <EstadoCierreBadge estado={cierre.estadoCierre} />
                </Td>
                <Td>{cierre.observacionContabilidad || "-"}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BarraAccionesCierre({
  item,
  isAdmin,
  isEditing,
  reabrirCierre,
  iniciarEdicion,
}) {
  const { cierre } = item;

  return (
    <div className="flex flex-col gap-3 border bg-white p-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">
          Cierre #{cierre.id}
        </span>
        <span className="text-sm text-gray-500">{formatearFecha(cierre.fecha)}</span>
        <EstadoBadge estado={estadoCuadre(cierre)} />
        <EstadoCierreBadge estado={cierre.estadoCierre} />
      </div>

      <div className="flex flex-wrap gap-2">
        {isAdmin && cierre.estadoCierre === "CERRADO" && (
          <button
            type="button"
            onClick={() => reabrirCierre(cierre)}
            className="inline-flex items-center gap-2 bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            <RotateCcw size={16} />
            Reabrir
          </button>
        )}

        {isAdmin && cierre.estadoCierre === "REABIERTO" && (
          <button
            type="button"
            onClick={() => iniciarEdicion(item)}
            disabled={isEditing}
            className="inline-flex items-center gap-2 bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
          >
            <Pencil size={16} />
            {isEditing ? "Editando" : "Editar cierre reabierto"}
          </button>
        )}
      </div>
    </div>
  );
}

function VistaCierreVendedor({ item }) {
  const { cierre, resumenPorTipo, denominaciones, movimientos, retiros, reaperturas } = item;
  const denominacionesVista = crearDenominacionesEdit(denominaciones || []);
  const totalFisico = totalDenominaciones(denominacionesVista);
  const totalET = Number(cierre.totalEfectivo || 0) + Number(cierre.totalTransferencia || 0);
  const totalRetiros = (retiros || []).reduce(
    (total, retiro) => total + (Number(retiro.monto) || 0),
    0,
  );
  const agencia = cierre.usuarioAgencia?.agencia?.nombre || "Agencia Desconocida";
  const usuario = cierre.usuarioAgencia?.usuario?.nombre || "Usuario Desconocido";

  return (
    <div className="flex flex-col items-start gap-2 xl:flex-row">
      <div className="w-full shrink-0 border bg-gray-50 p-2 xl:w-[500px]">
        <h2 className="mb-2 text-xl font-bold uppercase">
          CUADRE DE CAJA AGENCIA {agencia}
        </h2>
        <div className="mb-3 text-sm font-semibold uppercase text-gray-700">
          {usuario}
        </div>

        <h3 className="font-bold">
          Conteo de Efectivo ({formatearMoneda(totalFisico)})
        </h3>

        <div className="m-2 overflow-hidden rounded-lg border shadow-lg">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Denominacion</th>
                <th className="p-2 text-left">Cantidad</th>
                <th className="p-2 text-left">Total</th>
              </tr>
            </thead>
            <tbody>
              {denominacionesVista.map((d) => (
                <tr key={d.valor} className="border-t">
                  <td className="p-2">{formatearMoneda(d.valor)}</td>
                  <td className="p-2">
                    <input
                      readOnly
                      value={d.cantidad}
                      className="w-full border bg-white p-1"
                    />
                  </td>
                  <td className="p-2 font-semibold">
                    {formatearMoneda(Number(d.valor) * (Number(d.cantidad) || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2">
        <div className="flex justify-between p-2">
          <h2 className="text-xl font-bold">Movimiento de Caja</h2>
          <input
            type="date"
            value={String(cierre.fecha || "").slice(0, 10)}
            disabled
            readOnly
            className="border bg-gray-50 px-2"
          />
        </div>

        <div className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          La caja del {formatearFecha(cierre.fecha)} fue cerrada por {usuario}.
          Estado: {cierre.estadoCierre || "CERRADO"}.
        </div>

        <div className="w-full border bg-gray-50 p-3 xl:w-fit">
          <h3 className="mb-2 font-bold">Resumen</h3>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div>
              Efectivo: <strong>{formatearMoneda(cierre.totalEfectivo)}</strong>
            </div>
            <div>
              Transferencia:{" "}
              <strong>{formatearMoneda(cierre.totalTransferencia)}</strong>
            </div>
            <div>
              Pendiente: <strong>{formatearMoneda(cierre.totalPendiente)}</strong>
            </div>
            <div className="font-semibold">
              Efectivo + Transferencia: {formatearMoneda(totalET)}
            </div>
            <div className="font-bold">
              Total General: {formatearMoneda(cierre.totalSistema)}
            </div>
            <div className={claseDiferencia(cierre.diferencia)}>
              Diferencia: {formatearMoneda(cierre.diferencia)}
            </div>
          </div>
        </div>

        <div className="border bg-gray-50 p-3">
          <h3 className="mb-2 font-bold">Resumen por Tipo</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            {getResumenPorTipo(resumenPorTipo).map((resumen) => (
              <div key={resumen.key} className="flex min-w-[120px] flex-col">
                <span className="text-gray-500">{resumen.label}</span>
                <span className="font-semibold">{formatearMoneda(resumen.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-auto border bg-gray-50 p-3">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th>Item</th>
                <th>Responsable</th>
                <th>Detalle</th>
                <th>Valor</th>
                <th>Forma Pago</th>
                <th>Recibo</th>
                <th>Cliente</th>
                <th>Observacion</th>
              </tr>
            </thead>
            <tbody>
              {movimientos?.length ? (
                movimientos.map((row, index) => (
                  <tr key={row.id || index} className="border-t">
                    <td className="p-1">{index + 1}</td>
                    <td className="p-1">{row.responsable || "-"}</td>
                    <td className="p-1">{row.detalle || "-"}</td>
                    <td className="p-1 font-semibold">{formatearMoneda(row.valor)}</td>
                    <td className="p-1">{row.formaPago || "-"}</td>
                    <td className="p-1">{row.recibo || "-"}</td>
                    <td className="p-1">{row.entidad || row.observacion || "-"}</td>
                    <td className="p-1">{row.entidad ? row.observacion || "-" : "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-gray-500">
                    Sin movimientos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border bg-red-50 p-3">
          <h3 className="mb-2 font-bold">
            Retiros de Caja - Total: {formatearMoneda(totalRetiros)}
          </h3>

          <table className="w-full text-sm">
            <thead className="bg-red-200">
              <tr>
                <th>#</th>
                <th>Monto</th>
                <th>Motivo</th>
                <th>Autorizado por</th>
              </tr>
            </thead>
            <tbody>
              {retiros?.length ? (
                retiros.map((retiro, index) => (
                  <tr key={retiro.id || index} className="border-t">
                    <td className="p-1">{index + 1}</td>
                    <td className="p-1 font-semibold">{formatearMoneda(retiro.monto)}</td>
                    <td className="p-1">{retiro.motivo || "-"}</td>
                    <td className="p-1">{retiro.autorizadoPor || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-500">
                    Sin retiros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablaReaperturas reaperturas={reaperturas} />
      </div>
    </div>
  );
}

function DetalleCierre({ item }) {
  const { cierre, resumenPorTipo, denominaciones, movimientos, retiros, reaperturas } = item;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-base font-bold">Resumen general</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Dato label="Agencia" value={cierre.usuarioAgencia?.agencia?.nombre} />
          <Dato label="Usuario" value={cierre.usuarioAgencia?.usuario?.nombre} />
          <Dato label="Fisico" value={formatearMoneda(cierre.totalFisico)} />
          <Dato label="Efectivo" value={formatearMoneda(cierre.totalEfectivo)} />
          <Dato label="Transferencia" value={formatearMoneda(cierre.totalTransferencia)} />
          <Dato label="Pendiente" value={formatearMoneda(cierre.totalPendiente)} />
          <Dato label="Sistema" value={formatearMoneda(cierre.totalSistema)} />
          <Dato
            label="Diferencia"
            value={formatearMoneda(cierre.diferencia)}
            valueClassName={claseDiferencia(cierre.diferencia)}
          />
          <Dato label="Cuadre" value={estadoCuadre(cierre)} />
          <Dato label="Estado cierre" value={cierre.estadoCierre || "CERRADO"} />
          <Dato label="Observacion" value={cierre.observacion || "-"} />
          <Dato
            label="Observacion contabilidad"
            value={cierre.observacionContabilidad || "-"}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-base font-bold">Resumen por tipo</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Dato label="Cuota Efectivo" value={formatearMoneda(resumenPorTipo.cuotaEfectivo)} />
          <Dato label="Cuota Transferencia" value={formatearMoneda(resumenPorTipo.cuotaTransferencia)} />
          <Dato label="Contado Efectivo" value={formatearMoneda(resumenPorTipo.contadoEfectivo)} />
          <Dato label="Contado Transferencia" value={formatearMoneda(resumenPorTipo.contadoTransferencia)} />
          <Dato label="Entrada Efectivo" value={formatearMoneda(resumenPorTipo.entradaEfectivo)} />
          <Dato label="Entrada Transferencia" value={formatearMoneda(resumenPorTipo.entradaTransferencia)} />
          <Dato label="Entrada Pendiente" value={formatearMoneda(resumenPorTipo.entradaPendiente)} />
          <Dato label="Alcance Efectivo" value={formatearMoneda(resumenPorTipo.alcanceEfectivo)} />
          <Dato label="Alcance Transferencia" value={formatearMoneda(resumenPorTipo.alcanceTransferencia)} />
        </div>
      </section>

      <TablaDenominaciones denominaciones={denominaciones} />
      <TablaMovimientos movimientos={movimientos} />
      <TablaRetiros retiros={retiros} />
      <TablaReaperturas reaperturas={reaperturas} />
    </div>
  );
}

function Dato({ label, value, valueClassName = "text-sm font-semibold text-gray-900" }) {
  return (
    <div className="border bg-white p-3">
      <div className="text-xs font-medium uppercase text-gray-500">{label}</div>
      <div className={`mt-1 break-words ${valueClassName}`}>{value || "-"}</div>
    </div>
  );
}

function TablaDenominaciones({ denominaciones }) {
  return (
    <TablaSimple title="Denominaciones" headers={["Denominacion", "Cantidad", "Total"]}>
      {denominaciones?.length ? (
        denominaciones.map((d) => (
          <tr key={d.id}>
            <Td>{formatearMoneda(d.valor)}</Td>
            <Td>{d.cantidad}</Td>
            <Td>{formatearMoneda(Number(d.valor) * Number(d.cantidad))}</Td>
          </tr>
        ))
      ) : (
        <FilaVacia colSpan={3} text="Sin denominaciones" />
      )}
    </TablaSimple>
  );
}

function TablaMovimientos({ movimientos }) {
  return (
    <TablaSimple
      title="Movimientos"
      headers={["#", "Responsable", "Detalle", "Valor", "Forma Pago", "Recibo", "Cliente", "Observacion"]}
    >
      {movimientos?.length ? (
        movimientos.map((m, index) => (
          <tr key={m.id || index}>
            <Td>{index + 1}</Td>
            <Td>{m.responsable || "-"}</Td>
            <Td>{m.detalle || "-"}</Td>
            <Td>{formatearMoneda(m.valor)}</Td>
            <Td>{m.formaPago || "-"}</Td>
            <Td>{m.recibo || "-"}</Td>
            <Td>{m.entidad || m.observacion || "-"}</Td>
            <Td>{m.entidad ? m.observacion || "-" : "-"}</Td>
          </tr>
        ))
      ) : (
        <FilaVacia colSpan={8} text="Sin movimientos" />
      )}
    </TablaSimple>
  );
}

function TablaRetiros({ retiros }) {
  return (
    <TablaSimple title="Retiros" headers={["#", "Monto", "Motivo", "Autorizado por"]}>
      {retiros?.length ? (
        retiros.map((r, index) => (
          <tr key={r.id || index}>
            <Td>{index + 1}</Td>
            <Td>{formatearMoneda(r.monto)}</Td>
            <Td>{r.motivo || "-"}</Td>
            <Td>{r.autorizadoPor || "-"}</Td>
          </tr>
        ))
      ) : (
        <FilaVacia colSpan={4} text="Sin retiros" />
      )}
    </TablaSimple>
  );
}

function TablaReaperturas({ reaperturas }) {
  return (
    <TablaSimple
      title="Auditoria de reaperturas"
      headers={["#", "Reabierto por", "Motivo", "Fecha reapertura", "Recerrado por", "Fecha recierre"]}
    >
      {reaperturas?.length ? (
        reaperturas.map((r, index) => (
          <tr key={r.id || index}>
            <Td>{index + 1}</Td>
            <Td>{r.reabiertoPor?.nombre || "-"}</Td>
            <Td>{r.motivo || "-"}</Td>
            <Td>{formatearFechaHora(r.fechaReapertura)}</Td>
            <Td>{r.recerradoPor?.nombre || "-"}</Td>
            <Td>{formatearFechaHora(r.fechaRecierre)}</Td>
          </tr>
        ))
      ) : (
        <FilaVacia colSpan={6} text="Sin reaperturas registradas" />
      )}
    </TablaSimple>
  );
}

function TablaSimple({ title, headers, children }) {
  return (
    <section>
      <h3 className="mb-2 text-base font-bold">{title}</h3>
      <div className="overflow-x-auto border bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              {headers.map((header) => (
                <Th key={header}>{header}</Th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function FilaVacia({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border px-3 py-4 text-center text-gray-500">
        {text}
      </td>
    </tr>
  );
}

function EditorCierre({
  editForm,
  filtros,
  saving,
  actualizarEditForm,
  actualizarLista,
  agregarItem,
  eliminarItem,
  guardarEdicion,
  cancelarEdicion,
}) {
  const totalFisico = editForm.denominaciones.reduce(
    (total, d) => total + Number(d.valor) * (Number(d.cantidad) || 0),
    0,
  );
  const usuariosEdit = useMemo(() => {
    if (!editForm.agenciaId) return filtros.usuarios || [];

    return uniqueById(
      (filtros.relaciones || [])
        .filter((relacion) => String(relacion.agenciaId) === String(editForm.agenciaId))
        .map((relacion) => relacion.usuario),
    );
  }, [editForm.agenciaId, filtros.relaciones, filtros.usuarios]);

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Editar cierre de caja
            </h3>
            <p className="text-xs text-gray-500">
              Ajusta los datos operativos, movimientos y observacion contable.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={guardarEdicion}
            disabled={saving}
              className="inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? "Guardando" : "Guardar y cerrar"}
          </button>
          <button
            type="button"
            onClick={cancelarEdicion}
            disabled={saving}
              className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
          >
            <X size={18} />
            Cancelar
          </button>
        </div>
      </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[1fr_360px]">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-gray-700">
              Fecha
              <input
                type="date"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editForm.fecha}
                onChange={(e) => actualizarEditForm("fecha", e.target.value)}
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Agencia
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editForm.agenciaId}
                onChange={(e) => {
                  actualizarEditForm("agenciaId", e.target.value);
                  actualizarEditForm("usuarioId", "");
                }}
              >
                <option value="">Seleccionar</option>
                {(filtros.agencias || []).map((agencia) => (
                  <option key={agencia.id} value={agencia.id}>
                    {agencia.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Usuario
              <select
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                value={editForm.usuarioId}
                onChange={(e) => actualizarEditForm("usuarioId", e.target.value)}
                disabled={!editForm.agenciaId}
              >
                <option value="">Seleccionar</option>
                {usuariosEdit.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="md:col-span-3 text-sm font-medium text-gray-700">
              Observacion interna
              <input
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={editForm.observacion}
                onChange={(e) => actualizarEditForm("observacion", e.target.value)}
              />
            </label>
          </div>

          <label className="text-sm font-medium text-gray-700">
            Observacion contabilidad
            <textarea
              className="mt-1 min-h-32 w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={editForm.observacionContabilidad}
              onChange={(e) =>
                actualizarEditForm("observacionContabilidad", e.target.value)
              }
            />
          </label>
        </div>
      </div>


      <section className="border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Denominaciones</h3>
          <span className="text-sm font-bold text-gray-900">
            {formatearMoneda(totalFisico)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <Th>Denominacion</Th>
                <Th>Cantidad</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {editForm.denominaciones.map((d, index) => (
                <tr key={d.valor}>
                  <Td>{formatearMoneda(d.valor)}</Td>
                  <Td>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-28 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={d.cantidad}
                      onChange={(e) =>
                        actualizarLista(
                          "denominaciones",
                          index,
                          "cantidad",
                          normalizarEnteroPositivoTexto(e.target.value),
                        )
                      }
                    />
                  </Td>
                  <Td>{formatearMoneda(Number(d.valor) * (Number(d.cantidad) || 0))}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Movimientos</h3>
          <button
            type="button"
            onClick={() => agregarItem("movimientos", { ...movimientoVacio })}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Agregar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <Th>Responsable</Th>
                <Th>Detalle</Th>
                <Th>Valor</Th>
                <Th>Forma Pago</Th>
                <Th>Recibo</Th>
                <Th>Cliente</Th>
                <Th>Observacion</Th>
                <Th align="center">Accion</Th>
              </tr>
            </thead>
            <tbody>
              {editForm.movimientos.map((m, index) => (
                <tr key={index}>
                  <Td>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={m.responsable}
                      onChange={(e) =>
                        actualizarLista("movimientos", index, "responsable", e.target.value)
                      }
                    />
                  </Td>
                  <Td>
                    <select
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={m.detalle}
                      onChange={(e) =>
                        actualizarLista("movimientos", index, "detalle", e.target.value)
                      }
                    >
                      <option value="">Seleccionar</option>
                      {DETALLES_CAJA.map((detalle) => (
                        <option key={detalle} value={detalle}>
                          {detalle}
                        </option>
                      ))}
                    </select>
                  </Td>

                  <Td>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-28 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={m.valor}
                      onChange={(e) =>
                        actualizarLista(
                          "movimientos",
                          index,
                          "valor",
                          normalizarNumeroPositivoTexto(e.target.value),
                        )
                      }
                    />
                  </Td>
                  <Td>
                    <select
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={m.formaPago}
                      onChange={(e) =>
                        actualizarLista("movimientos", index, "formaPago", e.target.value)
                      }
                    >
                      <option value="">Seleccionar</option>
                      {FORMAS_PAGO.map((forma) => (
                        <option key={forma} value={forma}>
                          {forma}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <input
                      className="w-24 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={m.recibo}
                      onChange={(e) =>
                        actualizarLista("movimientos", index, "recibo", e.target.value)
                      }
                    />
                  </Td>
                  <Td>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={m.entidad}
                      onChange={(e) =>
                        actualizarLista("movimientos", index, "entidad", e.target.value)
                      }
                    />
                  </Td>
                  <Td>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={m.observacion}
                      onChange={(e) =>
                        actualizarLista("movimientos", index, "observacion", e.target.value)
                      }
                    />
                  </Td>
                  <Td>
                    <div className="flex justify-center">
                      <IconButton
                        title="Eliminar movimiento"
                        tone="red"
                        onClick={() => eliminarItem("movimientos", index)}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Retiros</h3>
          <button
            type="button"
            onClick={() => agregarItem("retiros", { ...retiroVacio })}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Agregar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <Th>Monto</Th>
                <Th>Motivo</Th>
                <Th>Autorizado por</Th>
                <Th align="center">Accion</Th>
              </tr>
            </thead>
            <tbody>
              {editForm.retiros.length ? (
                editForm.retiros.map((r, index) => (
                  <tr key={index}>
                    <Td>
                      <input
                        type="number"
                        className="w-32 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.monto}
                        onChange={(e) =>
                          actualizarLista("retiros", index, "monto", e.target.value)
                        }
                      />
                    </Td>
                    <Td>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.motivo}
                        onChange={(e) =>
                          actualizarLista("retiros", index, "motivo", e.target.value)
                        }
                      />
                    </Td>
                    <Td>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={r.autorizadoPor}
                        onChange={(e) =>
                          actualizarLista("retiros", index, "autorizadoPor", e.target.value)
                        }
                      />
                    </Td>
                    <Td>
                      <div className="flex justify-center">
                        <IconButton
                          title="Eliminar retiro"
                          tone="red"
                          onClick={() => eliminarItem("retiros", index)}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </div>
                    </Td>
                  </tr>
                ))
              ) : (
                <FilaVacia colSpan={4} text="Sin retiros" />
              )}
            </tbody>
          </table>
        </div>
      </section>


    </div>
  );
}
