/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Fuel, Gauge, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import {
  compararRepartidores,
  formularioVacio,
  kilometrosCalculados,
  VEHICULOS_COMBUSTIBLE,
  validarFormularioCombustible,
} from "../../utils/logisticaCombustible";

const BASE = "/api/logistica/combustible";
const filtrosVacios = {
  desde: "",
  hasta: "",
  userId: "",
  kmMin: "",
  kmMax: "",
};
const formatoNumero = (valor) =>
  Number(valor || 0).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const formatoDinero = (valor) =>
  Number(valor || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
  });
const fechaVisible = (fecha) => String(fecha).split("-").reverse().join("/");
const entrada =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100";
const boton =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50";
const colores = [
  "#16a34a",
  "#2563eb",
  "#d97706",
  "#9333ea",
  "#dc2626",
  "#0891b2",
];

function Grafica({ titulo, datos, campo, dinero = false }) {
  return (
    <section
      className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      aria-label={titulo}
    >
      <h2 className="mb-4 font-semibold text-gray-800">{titulo}</h2>
      {datos.length === 0 ? (
        <p className="py-20 text-center text-gray-500">
          Sin datos para graficar.
        </p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={datos}
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="fecha"
                tickFormatter={(fecha) => fechaVisible(fecha).slice(0, 5)}
              />
              <YAxis
                width={75}
                tickFormatter={(valor) => (dinero ? `$${valor}` : valor)}
              />
              <Tooltip
                labelFormatter={fechaVisible}
                formatter={(valor) =>
                  dinero ? formatoDinero(valor) : `${formatoNumero(valor)} km`
                }
              />
              <Line
                type="linear"
                dataKey={campo}
                name={dinero ? "Gasto" : "Kilómetros"}
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default function GastoCombustible({ auth, modoRepartidor = false }) {
  const [resultado, setResultado] = useState(null);
  const [repartidores, setRepartidores] = useState([]);
  const [filtros, setFiltros] = useState(filtrosVacios);
  const [aplicados, setAplicados] = useState(filtrosVacios);
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [form, setForm] = useState(formularioVacio);
  const [pestana, setPestana] = useState("ingreso");
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const rol = String(auth?.rol || "")
    .trim()
    .toLowerCase();
  const autorizado = modoRepartidor
    ? rol === "repartidor"
    : ["admin", "administrador"].includes(rol);
  const mostrarHistorial = !modoRepartidor || pestana === "historial";

  useEffect(() => {
    if (!autorizado || !mostrarHistorial) return;
    const controller = new AbortController();
    setCargando(true);
    setError("");
    const params = Object.fromEntries(
      Object.entries(aplicados).filter(([, valor]) => valor !== ""),
    );
    const consultas = [
      api.get(BASE, {
        params: { ...params, pagina, limite: 20 },
        signal: controller.signal,
      }),
    ];
    if (!modoRepartidor)
      consultas.push(
        api.get(`${BASE}/repartidores`, { signal: controller.signal }),
      );
    Promise.all(consultas)
      .then(([lista, catalogo]) => {
        if (controller.signal.aborted) return;
        if (pagina > lista.data.paginacion.paginas) {
          setPagina(lista.data.paginacion.paginas);
          return;
        }
        setResultado(lista.data);
        if (catalogo) setRepartidores(catalogo.data.repartidores);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err.response?.data?.message ||
              "No se pudieron cargar los registros.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [
    aplicados,
    autorizado,
    modoRepartidor,
    mostrarHistorial,
    pagina,
    recarga,
  ]);

  const comparacion = useMemo(
    () => compararRepartidores(resultado?.porRepartidor || []),
    [resultado],
  );
  const km = kilometrosCalculados(
    form.kilometrajeInicial,
    form.kilometrajeFinal,
  );
  const cambiarForm = (event) =>
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  const cerrarForm = () => {
    setEditando(null);
    setForm(formularioVacio());
    setErrorForm("");
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (guardando || !modoRepartidor || !autorizado) return;
    setErrorForm("");
    let data;
    try {
      data = validarFormularioCombustible(form);
    } catch (err) {
      setErrorForm(err.message);
      return;
    }
    setGuardando(true);
    setExito("");
    try {
      if (editando) await api.put(`${BASE}/${editando}`, data);
      else await api.post(BASE, data);
      setExito(
        editando
          ? "Registro actualizado correctamente."
          : "Registro creado correctamente.",
      );
      cerrarForm();
      setPestana("historial");
      setPagina(1);
      setRecarga((valor) => valor + 1);
    } catch (err) {
      setErrorForm(
        err.response?.data?.message || "No se pudo guardar el registro.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const editar = (registro) => {
    setEditando(registro.id);
    setForm(
      Object.fromEntries(
        Object.keys(formularioVacio()).map((campo) => [
          campo,
          String(registro[campo] ?? ""),
        ]),
      ),
    );
    setErrorForm("");
    setExito("");
    setPestana("ingreso");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const eliminar = async (registro) => {
    const confirmacion = await Swal.fire({
      title: "¿Eliminar registro?",
      text: `Registro #${registro.id} del ${fechaVisible(registro.fecha)}. Se retirará de los reportes.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacion.isConfirmed) return;
    setGuardando(true);
    setExito("");
    setError("");
    try {
      await api.delete(`${BASE}/${registro.id}`);
      if (editando === registro.id) cerrarForm();
      setExito("Registro eliminado correctamente.");
      setRecarga((valor) => valor + 1);
    } catch (err) {
      setError(
        err.response?.data?.message || "No se pudo eliminar el registro.",
      );
    } finally {
      setGuardando(false);
    }
  };

  const aplicarFiltros = (event) => {
    event.preventDefault();
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setError("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }
    if (
      filtros.kmMin !== "" &&
      filtros.kmMax !== "" &&
      Number(filtros.kmMin) > Number(filtros.kmMax)
    ) {
      setError("Los kilómetros mínimos no pueden superar a los máximos.");
      return;
    }
    setPagina(1);
    setAplicados({ ...filtros });
  };

  const navegarPestanas = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const siguiente =
      event.key === "Home"
        ? "ingreso"
        : event.key === "End"
          ? "historial"
          : pestana === "ingreso"
            ? "historial"
            : "ingreso";
    setPestana(siguiente);
    document.getElementById(`combustible-tab-${siguiente}`)?.focus();
  };

  if (!autorizado)
    return (
      <div className="p-6 text-red-700" role="alert">
        No tienes acceso a esta sección.
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {modoRepartidor && (
              <Link
                className="text-sm font-medium text-green-700 hover:underline"
                to="/logistica-panel"
              >
                ← Volver a logística
              </Link>
            )}
            <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 sm:text-3xl">
              <Fuel className="text-green-600" />
              {modoRepartidor ? "Mi gasto de combustible" : "Gasto combustible"}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {modoRepartidor
                ? "Registra el gasto y el vehículo utilizado, y consulta tu historial."
                : "Consulta los gastos, vehículos y recorridos de todos los repartidores."}{" "}
              Gasto en USD y distancias en kilómetros.
            </p>
          </div>
          {modoRepartidor && mostrarHistorial && (
            <button
              type="button"
              disabled={guardando}
              className={`${boton} bg-green-600 text-white hover:bg-green-700`}
              onClick={() => {
                cerrarForm();
                setPestana("ingreso");
                setExito("");
              }}
            >
              <Plus size={18} />
              Nuevo gasto
            </button>
          )}
        </header>
        {modoRepartidor && (
          <div
            role="tablist"
            aria-label="Gastos de combustible"
            className="flex flex-wrap gap-2 rounded-xl border border-green-100 bg-white p-2 shadow-sm"
          >
            {[
              ["ingreso", "Ingreso del gasto"],
              ["historial", "Mis gastos realizados"],
            ].map(([id, titulo]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`combustible-tab-${id}`}
                aria-selected={pestana === id}
                aria-controls={`combustible-panel-${id}`}
                tabIndex={pestana === id ? 0 : -1}
                disabled={guardando}
                onClick={() => setPestana(id)}
                onKeyDown={navegarPestanas}
                className={`${boton} flex-1 focus:outline-none focus:ring-2 focus:ring-green-500 ${pestana === id ? "bg-green-600 text-white" : "text-gray-700 hover:bg-green-50"}`}
              >
                {titulo}
              </button>
            ))}
          </div>
        )}
        {exito && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
          >
            {exito}
          </div>
        )}
        {mostrarHistorial && error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {error}
            <button
              type="button"
              className={`${boton} border border-red-300`}
              onClick={() => setRecarga((valor) => valor + 1)}
              disabled={cargando}
            >
              Reintentar
            </button>
          </div>
        )}

        {modoRepartidor && pestana === "ingreso" && (
          <form
            role="tabpanel"
            id="combustible-panel-ingreso"
            aria-labelledby="combustible-tab-ingreso"
            onSubmit={guardar}
            className="rounded-xl border border-green-100 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold">
              {editando ? `Editar gasto #${editando}` : "Ingreso del gasto"}
            </h2>
            <fieldset
              disabled={guardando}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <label className="space-y-1 text-sm font-medium">
                Fecha
                <input
                  name="fecha"
                  type="date"
                  required
                  min="1900-01-01"
                  max="9999-12-31"
                  value={form.fecha}
                  onChange={cambiarForm}
                  className={entrada}
                />
              </label>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">
                Vehículo utilizado
                <select
                  name="vehiculo"
                  required
                  value={form.vehiculo}
                  onChange={cambiarForm}
                  className={entrada}
                >
                  <option value="">Selecciona un vehículo</option>
                  {VEHICULOS_COMBUSTIBLE.map((vehiculo) => (
                    <option key={vehiculo} value={vehiculo}>
                      {vehiculo}
                    </option>
                  ))}
                </select>
              </label>
              {[
                ["kilometrajeInicial", "Kilometraje inicial (km)"],
                ["kilometrajeFinal", "Kilometraje final (km)"],
                ["costoCombustible", "Gasto de combustible (USD)"],
              ].map(([campo, etiqueta]) => (
                <label key={campo} className="space-y-1 text-sm font-medium">
                  {etiqueta}
                  <input
                    name={campo}
                    type="number"
                    inputMode="decimal"
                    required
                    min={
                      campo === "kilometrajeFinal"
                        ? form.kilometrajeInicial || 0
                        : 0
                    }
                    max="99999999.99"
                    step="0.01"
                    value={form[campo]}
                    onChange={cambiarForm}
                    className={entrada}
                  />
                </label>
              ))}
              <div className="rounded-lg bg-green-50 p-3 text-green-800">
                <p className="text-sm">Kilómetros recorridos (automático)</p>
                <output className="text-xl font-bold">
                  {km === null || km < 0 ? "—" : `${formatoNumero(km)} km`}
                </output>
              </div>
              <label className="space-y-1 text-sm font-medium sm:col-span-2 lg:col-span-3">
                Observación (opcional)
                <textarea
                  name="observacion"
                  rows={2}
                  maxLength={2000}
                  value={form.observacion}
                  onChange={cambiarForm}
                  className={entrada}
                />
              </label>
            </fieldset>
            {errorForm && (
              <p role="alert" className="mt-4 text-red-700">
                {errorForm}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={guardando}
                className={`${boton} bg-green-600 text-white`}
              >
                {guardando ? "Guardando..." : "Guardar gasto"}
              </button>
              <button
                type="button"
                disabled={guardando}
                className={`${boton} border border-gray-300`}
                onClick={() => {
                  cerrarForm();
                  setPestana("historial");
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {mostrarHistorial && (
          <section
            role={modoRepartidor ? "tabpanel" : undefined}
            id="combustible-panel-historial"
            aria-labelledby={
              modoRepartidor ? "combustible-tab-historial" : undefined
            }
            className="space-y-6"
          >
            <form
              onSubmit={aplicarFiltros}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h2 className="mb-3 font-semibold text-gray-800">Filtros</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["desde", "Fecha desde", "date"],
                  ["hasta", "Fecha hasta", "date"],
                  ["kmMin", "Kilómetros recorridos mín.", "number"],
                  ["kmMax", "Kilómetros recorridos máx.", "number"],
                ].map(([campo, etiqueta, tipo]) => (
                  <label className="space-y-1 text-sm" key={campo}>
                    {etiqueta}
                    <input
                      type={tipo}
                      value={filtros[campo]}
                      min={tipo === "number" ? 0 : "1900-01-01"}
                      max={tipo === "number" ? "99999999.99" : "9999-12-31"}
                      step={tipo === "number" ? "0.01" : undefined}
                      onChange={(event) =>
                        setFiltros((prev) => ({
                          ...prev,
                          [campo]: event.target.value,
                        }))
                      }
                      className={entrada}
                    />
                  </label>
                ))}
                {!modoRepartidor && (
                  <label className="space-y-1 text-sm">
                    Repartidor
                    <select
                      value={filtros.userId}
                      onChange={(event) =>
                        setFiltros((prev) => ({
                          ...prev,
                          userId: event.target.value,
                        }))
                      }
                      className={entrada}
                    >
                      <option value="">Todos los repartidores</option>
                      {repartidores.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.nombre || `Usuario #${user.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={cargando || guardando}
                  className={`${boton} bg-green-600 text-white`}
                  type="submit"
                >
                  Aplicar filtros
                </button>
                <button
                  type="button"
                  disabled={cargando || guardando}
                  className={`${boton} border border-gray-300`}
                  onClick={() => {
                    setFiltros(filtrosVacios);
                    setAplicados({ ...filtrosVacios });
                    setPagina(1);
                  }}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  disabled={cargando || guardando}
                  className={`${boton} border border-gray-300`}
                  onClick={() => setRecarga((valor) => valor + 1)}
                >
                  <RefreshCw size={16} />
                  Actualizar
                </button>
              </div>
            </form>

            {cargando ? (
              <p
                role="status"
                className="rounded-xl bg-white p-8 text-center text-gray-600"
              >
                Cargando registros...
              </p>
            ) : (
              !error &&
              resultado && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      [
                        "Kilómetros recorridos",
                        `${formatoNumero(resultado.totales.kilometrosRecorridos)} km`,
                        Gauge,
                      ],
                      [
                        "Gasto de combustible",
                        formatoDinero(resultado.totales.costoCombustible),
                        Fuel,
                      ],
                    ].map(([titulo, valor, Icono]) => (
                      <div
                        key={titulo}
                        className="rounded-xl border border-green-100 bg-white p-5 shadow-sm"
                      >
                        <Icono className="mb-2 text-green-600" size={24} />
                        <p className="text-sm text-gray-600">{titulo}</p>
                        <p className="mt-1 break-words text-2xl font-bold text-gray-900">
                          {valor}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Todos los registros del filtro
                        </p>
                      </div>
                    ))}
                  </div>
                  {!modoRepartidor && (
                    <>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Grafica
                          titulo="Gasto de combustible por fecha"
                          datos={resultado.porFecha}
                          campo="costoCombustible"
                          dinero
                        />
                        <Grafica
                          titulo="Kilómetros recorridos por fecha"
                          datos={resultado.porFecha}
                          campo="kilometrosRecorridos"
                        />
                      </div>
                      {comparacion.ids.length > 0 && (
                        <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                          <h2 className="font-semibold text-gray-800">
                            Gasto por repartidor y fecha
                          </h2>
                          <p className="mb-4 text-sm text-gray-500">
                            {comparacion.total > 6
                              ? "Se muestran los 6 repartidores con mayor gasto. Usa el filtro para consultar otro repartidor."
                              : "Comparación de los repartidores incluidos en el filtro."}
                          </p>
                          <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={comparacion.datos}
                                margin={{
                                  top: 10,
                                  right: 20,
                                  left: 10,
                                  bottom: 10,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="fecha"
                                  tickFormatter={(fecha) =>
                                    fechaVisible(fecha).slice(0, 5)
                                  }
                                />
                                <YAxis
                                  width={75}
                                  tickFormatter={(valor) => `$${valor}`}
                                />
                                <Tooltip
                                  labelFormatter={fechaVisible}
                                  formatter={formatoDinero}
                                />
                                <Legend />
                                {comparacion.ids.map((id, index) => (
                                  <Line
                                    key={id}
                                    type="linear"
                                    dataKey={`repartidor_${id}`}
                                    name={
                                      repartidores.find(
                                        (user) => user.id === id,
                                      )?.nombre || `Repartidor #${id}`
                                    }
                                    stroke={colores[index]}
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </section>
                      )}
                    </>
                  )}

                  <section
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                    aria-label="Registros de combustible"
                  >
                    <div className="border-b border-gray-200 p-4">
                      <h2 className="font-semibold text-gray-800">
                        {modoRepartidor
                          ? "Mis gastos realizados"
                          : "Todos los gastos realizados"}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {resultado.paginacion.total} registros encontrados
                      </p>
                    </div>
                    {resultado.registros.length === 0 ? (
                      <p className="p-10 text-center text-gray-500">
                        No hay registros para los filtros seleccionados.
                        {modoRepartidor &&
                          " Registra tu primer gasto en la pestaña Ingreso del gasto."}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[950px] text-left text-sm">
                          <thead className="bg-green-50 text-gray-700">
                            <tr>
                              {[
                                "ID",
                                "Fecha",
                                ...(!modoRepartidor ? ["Repartidor"] : []),
                                "Vehículo",
                                "Km inicial",
                                "Km final",
                                "Recorrido (km)",
                                "Gasto (USD)",
                                "Observación",
                                "Acciones",
                              ].map((titulo) => (
                                <th
                                  scope="col"
                                  key={titulo}
                                  className="whitespace-nowrap px-4 py-3"
                                >
                                  {titulo}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {resultado.registros.map((registro) => (
                              <tr
                                key={registro.id}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-4 py-3">#{registro.id}</td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  {fechaVisible(registro.fecha)}
                                </td>
                                {!modoRepartidor && (
                                  <td className="px-4 py-3">
                                    {registro.repartidor?.nombre ||
                                      `Usuario #${registro.userId}`}
                                  </td>
                                )}
                                <td className="max-w-xs break-words px-4 py-3">
                                  {registro.vehiculo || "No registrado"}
                                </td>
                                {[
                                  "kilometrajeInicial",
                                  "kilometrajeFinal",
                                  "kilometrosRecorridos",
                                ].map((campo) => (
                                  <td
                                    key={campo}
                                    className="whitespace-nowrap px-4 py-3"
                                  >
                                    {formatoNumero(registro[campo])}
                                  </td>
                                ))}
                                <td className="whitespace-nowrap px-4 py-3 font-medium">
                                  {formatoDinero(registro.costoCombustible)}
                                </td>
                                <td className="max-w-xs whitespace-pre-wrap break-words px-4 py-3">
                                  {registro.observacion || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    {modoRepartidor && (
                                      <button
                                        type="button"
                                        disabled={guardando}
                                        className="rounded-lg p-2 text-green-700 hover:bg-green-50 disabled:opacity-50"
                                        aria-label={`Editar registro ${registro.id}`}
                                        onClick={() => editar(registro)}
                                      >
                                        <Pencil size={18} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={guardando}
                                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                      aria-label={`Eliminar registro ${registro.id}`}
                                      onClick={() => eliminar(registro)}
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4 text-sm">
                      <span>
                        Página {resultado.paginacion.pagina} de{" "}
                        {resultado.paginacion.paginas}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pagina <= 1 || guardando}
                          className={`${boton} border border-gray-300`}
                          onClick={() => setPagina((valor) => valor - 1)}
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={
                            pagina >= resultado.paginacion.paginas || guardando
                          }
                          className={`${boton} border border-gray-300`}
                          onClick={() => setPagina((valor) => valor + 1)}
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  </section>
                </>
              )
            )}
          </section>
        )}
      </div>
    </div>
  );
}
