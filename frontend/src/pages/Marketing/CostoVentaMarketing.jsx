import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { API_URL } from "../../../config";

const categoriasGasto = ["REDES", "VOLANTES", "CAMISETAS", "GLOBOS", "OTROS"];
const DIA_INICIO_SEMANA = 4;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const presupuestoInicial = {
  presupuestoAsignado: "",
  metaVentas: "",
  descripcion: "",
};

const pad2 = (value) => String(value).padStart(2, "0");

const dateToISO = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const fechaToLocalDate = (fecha) => {
  const [year, month, day] = String(fecha).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const sumarDias = (date, dias) => {
  const copia = new Date(date);
  copia.setDate(copia.getDate() + dias);
  return copia;
};

const obtenerInicioSemanaJueves = (date) => {
  const diferencia = (date.getDay() - DIA_INICIO_SEMANA + 7) % 7;
  return sumarDias(date, -diferencia);
};

const normalizarInicioSemana = (fecha) => {
  if (!fecha) return "";
  return dateToISO(obtenerInicioSemanaJueves(fechaToLocalDate(fecha)));
};

const inicioSemanaActual = normalizarInicioSemana(dateToISO(new Date()));

const gastoInicial = (fechaInicio) => ({
  fecha: fechaInicio || inicioSemanaActual,
  categoria: "REDES",
  descripcion: "",
  monto: "",
});

const formatMoney = (value) => currencyFormatter.format(Number(value) || 0);

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

const normalizarNumeroNoNegativo = (value) =>
  String(value ?? "").includes("-") ? "" : value;

const preventInvalidNumberKeys = (event) => {
  if (["-", "+", "e", "E"].includes(event.key)) {
    event.preventDefault();
  }
};

const estadoClass = (estado) => {
  if (estado === "EXCEDIDO") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (estado === "DENTRO_PRESUPUESTO") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
};

export default function CostoVentaMarketing() {
  const [fechaInicio, setFechaInicio] = useState(inicioSemanaActual);
  const fechaFin = useMemo(
    () => dateToISO(sumarDias(fechaToLocalDate(fechaInicio), 6)),
    [fechaInicio],
  );
  const [presupuestoActual, setPresupuestoActual] = useState(null);
  const [presupuestoForm, setPresupuestoForm] = useState(presupuestoInicial);
  const [gastos, setGastos] = useState([]);
  const [gastoForm, setGastoForm] = useState(gastoInicial(inicioSemanaActual));
  const [editGastoId, setEditGastoId] = useState(null);
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingPresupuesto, setSavingPresupuesto] = useState(false);
  const [savingGasto, setSavingGasto] = useState(false);

  const cargarDatos = useCallback(async () => {
    if (!fechaInicio) return;

    setLoading(true);

    try {
      const params = new URLSearchParams({
        fechaInicio,
        fechaFin,
      });

      const [presupuestoRes, gastosRes, reporteRes] = await Promise.all([
        axios.get(
          `${API_URL}/api/gerencia/presupuesto-marketing?${params.toString()}&activo=true`,
        ),
        axios.get(`${API_URL}/api/gerencia/gastos-marketing?${params.toString()}`),
        axios.get(`${API_URL}/api/gerencia/reporte-costo-venta?${params.toString()}`),
      ]);

      const presupuesto = presupuestoRes.data?.[0] || null;
      setPresupuestoActual(presupuesto);
      setPresupuestoForm(
        presupuesto
          ? {
              presupuestoAsignado: presupuesto.presupuestoAsignado ?? "",
              metaVentas: presupuesto.metaVentas ?? "",
              descripcion: presupuesto.descripcion || "",
            }
          : presupuestoInicial,
      );
      setGastos(gastosRes.data || []);
      setReporte(reporteRes.data || null);
    } catch (error) {
      console.error(error);
      const message =
        error.response?.data?.message || "No se pudo cargar el modulo de marketing.";
      Swal.fire("Error", message, "error");
    } finally {
      setLoading(false);
    }
  }, [fechaFin, fechaInicio]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (!editGastoId) {
      setGastoForm(gastoInicial(fechaInicio));
    }
  }, [editGastoId, fechaInicio]);

  const indicadores = useMemo(() => {
    const data = reporte || {};

    return [
      {
        label: "Presupuesto asignado",
        value: formatMoney(data.presupuestoAsignado),
        warn: false,
      },
      {
        label: "Gasto real",
        value: formatMoney(data.gastoReal),
        warn: data.estado === "EXCEDIDO",
      },
      {
        label: "Diferencia",
        value: formatMoney(data.diferencia),
        warn: Number(data.diferencia) < 0,
      },
      {
        label: "% ejecucion presupuesto",
        value: formatPercent(data.porcentajeEjecucion),
        warn: Number(data.porcentajeEjecucion) > 100,
      },
      {
        label: "Ventas realizadas",
        value: Number(data.ventasRealizadas || 0),
        warn: false,
      },
      {
        label: "Costo por venta real",
        value: formatMoney(data.costoPorVentaReal),
        warn: false,
      },
      {
        label: "Costo por venta objetivo",
        value: formatMoney(data.costoPorVentaObjetivo),
        warn: false,
      },
      {
        label: "Diferencia por venta",
        value: formatMoney(data.diferenciaPorVenta),
        warn: Number(data.diferenciaPorVenta) > 0,
      },
    ];
  }, [reporte]);

  const handlePresupuestoChange = (field, value) => {
    setPresupuestoForm((prev) => ({
      ...prev,
      [field]: field === "descripcion" ? value : normalizarNumeroNoNegativo(value),
    }));
  };

  const handleGastoChange = (field, value) => {
    setGastoForm((prev) => ({
      ...prev,
      [field]: field === "monto" ? normalizarNumeroNoNegativo(value) : value,
    }));
  };

  const handleSemanaChange = (value) => {
    const inicioNormalizado = normalizarInicioSemana(value);
    if (inicioNormalizado) {
      setFechaInicio(inicioNormalizado);
    }
  };

  const guardarPresupuesto = async (event) => {
    event.preventDefault();

    setSavingPresupuesto(true);

    try {
      const payload = {
        fechaInicio,
        fechaFin,
        presupuestoAsignado:
          presupuestoForm.presupuestoAsignado === ""
            ? 0
            : presupuestoForm.presupuestoAsignado,
        metaVentas: presupuestoForm.metaVentas === "" ? 0 : presupuestoForm.metaVentas,
        descripcion: presupuestoForm.descripcion,
      };

      if (presupuestoActual?.id) {
        await axios.put(
          `${API_URL}/api/gerencia/presupuesto-marketing/${presupuestoActual.id}`,
          payload,
        );
      } else {
        await axios.post(`${API_URL}/api/gerencia/presupuesto-marketing`, payload);
      }

      await cargarDatos();
      Swal.fire({
        icon: "success",
        title: "Presupuesto guardado",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message || "No se pudo guardar.";
      Swal.fire("Error", message, "error");
    } finally {
      setSavingPresupuesto(false);
    }
  };

  const guardarGasto = async (event) => {
    event.preventDefault();

    setSavingGasto(true);

    try {
      const payload = {
        fecha: gastoForm.fecha,
        categoria: gastoForm.categoria,
        descripcion: gastoForm.descripcion,
        monto: gastoForm.monto === "" ? 0 : gastoForm.monto,
      };

      if (editGastoId) {
        await axios.put(
          `${API_URL}/api/gerencia/gastos-marketing/${editGastoId}`,
          payload,
        );
      } else {
        await axios.post(`${API_URL}/api/gerencia/gastos-marketing`, payload);
      }

      setEditGastoId(null);
      setGastoForm(gastoInicial(fechaInicio));
      await cargarDatos();
      Swal.fire({
        icon: "success",
        title: "Gasto guardado",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message || "No se pudo guardar el gasto.";
      Swal.fire("Error", message, "error");
    } finally {
      setSavingGasto(false);
    }
  };

  const editarGasto = (gasto) => {
    setEditGastoId(gasto.id);
    setGastoForm({
      fecha: gasto.fecha || fechaInicio,
      categoria: gasto.categoria || "REDES",
      descripcion: gasto.descripcion || "",
      monto: gasto.monto ?? "",
    });
  };

  const cancelarEdicionGasto = () => {
    setEditGastoId(null);
    setGastoForm(gastoInicial(fechaInicio));
  };

  const eliminarGasto = async (gasto) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Eliminar gasto",
      text: "Esta accion no se puede deshacer.",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${API_URL}/api/gerencia/gastos-marketing/${gasto.id}`);
      await cargarDatos();
      Swal.fire({
        icon: "success",
        title: "Eliminado",
        timer: 1000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      const message = error.response?.data?.message || "No se pudo eliminar.";
      Swal.fire("Error", message, "error");
    }
  };

  return (
    <div className="min-w-0 p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Costo por Venta / Presupuesto de Marketing
          </h1>
          <p className="text-sm text-gray-600">
            Control semanal de presupuesto, gastos reales y costo por venta.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarDatos}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <RefreshCw size={18} />
          Recargar
        </button>
      </div>

      <section className="mb-4 border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Inicio semana
            </span>
            <input
              type="date"
              value={fechaInicio}
              onChange={(event) => handleSemanaChange(event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Cierre semana
            </span>
            <input
              type="date"
              value={fechaFin}
              readOnly
              className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-3 border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Semana operativa: jueves {fechaInicio} a miercoles {fechaFin}.
        </div>
      </section>

      <section className="mb-4 border bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Presupuesto semanal</h2>
            <p className="text-sm text-gray-600">
              {presupuestoActual
                ? "Editando presupuesto del periodo."
                : "Sin presupuesto registrado para esta semana."}
            </p>
          </div>
          {reporte?.estado && (
            <span
              className={`inline-flex w-fit items-center rounded border px-3 py-1 text-sm font-semibold ${estadoClass(
                reporte.estado,
              )}`}
            >
              {reporte.estado}
            </span>
          )}
        </div>

        <form onSubmit={guardarPresupuesto} className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Presupuesto asignado
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={presupuestoForm.presupuestoAsignado}
              onKeyDown={preventInvalidNumberKeys}
              onChange={(event) =>
                handlePresupuestoChange("presupuestoAsignado", event.target.value)
              }
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Meta de ventas
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={presupuestoForm.metaVentas}
              onKeyDown={preventInvalidNumberKeys}
              onChange={(event) => handlePresupuestoChange("metaVentas", event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="0"
            />
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Descripcion
            </span>
            <input
              type="text"
              value={presupuestoForm.descripcion}
              onChange={(event) => handlePresupuestoChange("descripcion", event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Detalle del presupuesto"
            />
          </label>

          <div className="lg:col-span-4">
            <button
              type="submit"
              disabled={savingPresupuesto}
              className="inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
            >
              <Save size={18} />
              {savingPresupuesto ? "Guardando..." : "Guardar presupuesto"}
            </button>
          </div>
        </form>
      </section>

      <section className="mb-4 border bg-white p-4">
        <div className="mb-3">
          <h2 className="text-lg font-bold text-gray-900">Gastos reales</h2>
          <p className="text-sm text-gray-600">
            Registra los gastos de la misma semana.
          </p>
        </div>

        <form onSubmit={guardarGasto} className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Fecha</span>
            <input
              type="date"
              min={fechaInicio}
              max={fechaFin}
              value={gastoForm.fecha}
              onChange={(event) => handleGastoChange("fecha", event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Categoria
            </span>
            <select
              value={gastoForm.categoria}
              onChange={(event) => handleGastoChange("categoria", event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
            >
              {categoriasGasto.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </label>

          <label className="block lg:col-span-2">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Descripcion
            </span>
            <input
              type="text"
              value={gastoForm.descripcion}
              onChange={(event) => handleGastoChange("descripcion", event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="Detalle del gasto"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Monto</span>
            <input
              type="text"
              inputMode="decimal"
              value={gastoForm.monto}
              onKeyDown={preventInvalidNumberKeys}
              onChange={(event) => handleGastoChange("monto", event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2"
              placeholder="0.00"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={savingGasto}
              className="inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-60"
            >
              {editGastoId ? <Save size={18} /> : <Plus size={18} />}
              {savingGasto ? "Guardando..." : editGastoId ? "Actualizar" : "Agregar"}
            </button>

            {editGastoId && (
              <button
                type="button"
                onClick={cancelarEdicionGasto}
                className="inline-flex items-center justify-center rounded border px-3 py-2 text-gray-700 hover:bg-gray-100"
                title="Cancelar edicion"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </form>

        <div className="overflow-hidden border">
          <table className="w-full table-fixed border-collapse text-xs md:text-sm">
            <colgroup>
              <col className="w-28" />
              <col className="w-28" />
              <col />
              <col className="w-28" />
              <col className="w-24" />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2 text-left">Fecha</th>
                <th className="border px-2 py-2 text-left">Categoria</th>
                <th className="border px-2 py-2 text-left">Descripcion</th>
                <th className="border px-2 py-2 text-right">Monto</th>
                <th className="border px-2 py-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gastos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border px-3 py-6 text-center text-gray-500">
                    No hay gastos registrados para esta semana.
                  </td>
                </tr>
              ) : (
                gastos.map((gasto) => (
                  <tr key={gasto.id} className="hover:bg-gray-50">
                    <td className="break-words border px-2 py-2">{gasto.fecha}</td>
                    <td className="break-words border px-2 py-2">{gasto.categoria}</td>
                    <td className="break-words border px-2 py-2">
                      {gasto.descripcion || "-"}
                    </td>
                    <td className="border px-2 py-2 text-right font-semibold">
                      {formatMoney(gasto.monto)}
                    </td>
                    <td className="border px-2 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => editarGasto(gasto)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border text-blue-700 hover:bg-blue-50"
                          title="Editar gasto"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarGasto(gasto)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border text-red-700 hover:bg-red-50"
                          title="Eliminar gasto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border bg-white p-4">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Reporte final</h2>
            <p className="text-sm text-gray-600">
              Calculo automatico con presupuesto, gasto real y ventas de Gerencia.
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center rounded border px-3 py-1 text-sm font-semibold ${estadoClass(
              reporte?.estado,
            )}`}
          >
            {reporte?.estado || "SIN_DATOS"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {indicadores.map((indicador) => (
            <div
              key={indicador.label}
              className={`border p-3 ${indicador.warn ? "border-amber-300 bg-amber-50" : "bg-white"}`}
            >
              <div className="text-sm text-gray-600">{indicador.label}</div>
              <div
                className={`mt-1 text-xl font-bold ${
                  indicador.warn ? "text-amber-800" : "text-gray-900"
                }`}
              >
                {indicador.value}
              </div>
            </div>
          ))}
        </div>

        {loading && <p className="mt-3 text-sm text-gray-500">Cargando datos...</p>}
      </section>
    </div>
  );
}
