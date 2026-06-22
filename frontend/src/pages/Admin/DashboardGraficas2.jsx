/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import html2canvas from "html2canvas";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { FaCopy } from "react-icons/fa";
import { API_URL } from "../../../config";

const COLORS = {
  semana: "#4ADE80",
  gerencia: "#2563eb",
  enganche: "#16a34a",
  costo: "#f59e0b",
  costoEntrega: "#0891b2",
  margenPorcentual: "#7c3aed",
  tareasFinalizadas: "#db2777",
};

const crearFechaLocal = (fechaStr) => {
  const [year, month, day] = String(fechaStr || "").split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const getInicioBaseSemana = (fechaInicio) => {
  const inicio =
    crearFechaLocal(fechaInicio) || new Date(new Date().getFullYear(), 0, 1);

  while (inicio.getDay() !== 4) {
    inicio.setDate(inicio.getDate() - 1);
  }

  return inicio;
};

const getFechaInicioSemana = (semana, fechaInicio) => {
  const inicio = getInicioBaseSemana(fechaInicio);
  inicio.setDate(inicio.getDate() + (semana - 1) * 7);

  const year = inicio.getFullYear();
  const month = String(inicio.getMonth() + 1).padStart(2, "0");
  const day = String(inicio.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getRangoSemana = (semana, fechaInicio) => {
  const start = crearFechaLocal(getFechaInicioSemana(semana, fechaInicio));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const opciones = {
    month: "long",
    day: "numeric",
  };

  const inicioStr = start.toLocaleDateString("es-EC", opciones);
  const finStr = end.toLocaleDateString("es-EC", opciones);

  return `${inicioStr} - ${finStr}`;
};

const toSemanaArray = (obj = {}, fechaInicio = "2026-01-01") =>
  Object.entries(obj || {})
    .map(([name, value]) => {
      const semanaNumero = Number(String(name).replace(/\D/g, ""));

      return {
        name: getRangoSemana(semanaNumero, fechaInicio),
        ventas: value,
        semanaNumero,
      };
    })
    .sort((a, b) => a.semanaNumero - b.semanaNumero);

const toIndicadorGerenciaArray = (obj = {}, fechaInicio = "2026-01-01") =>
  Object.entries(obj || {})
    .map(([name, value]) => {
      const semanaNumero = Number(String(name).replace(/\D/g, ""));

      return {
        name: getRangoSemana(semanaNumero, fechaInicio),
        margen: Number(value) || 0,
        semanaNumero,
      };
    })
    .sort((a, b) => a.semanaNumero - b.semanaNumero);

const toMargenPorcentualSemanaArray = (obj = {}, fechaInicio = "2026-01-01") =>
  Object.entries(obj || {})
    .map(([name, value]) => {
      const semanaNumero = Number(String(name).replace(/\D/g, ""));

      return {
        name: getRangoSemana(semanaNumero, fechaInicio),
        margenPorcentual: Number(value) || 0,
        semanaNumero,
      };
    })
    .sort((a, b) => a.semanaNumero - b.semanaNumero);

const toEngancheJavierSemanaArray = (obj = {}, fechaInicio = "2026-01-01") =>
  Object.entries(obj || {})
    .map(([name, value]) => {
      const semanaNumero = Number(String(name).replace(/\D/g, ""));

      return {
        name: getRangoSemana(semanaNumero, fechaInicio),
        ventas: Number(value) || 0,
        semanaNumero,
      };
    })
    .sort((a, b) => a.semanaNumero - b.semanaNumero);

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

const percentFormatter = (value) => `${Number(value || 0).toFixed(2)}%`;

const formatFechaCorta = (fechaStr) => {
  const fecha = crearFechaLocal(fechaStr);
  if (!fecha) return fechaStr || "";

  return fecha.toLocaleDateString("es-EC", {
    month: "short",
    day: "2-digit",
  });
};

const toTareasFinalizadasArray = (items = []) =>
  (items || []).map((item) => ({
    fecha: item.fecha,
    name: formatFechaCorta(item.fecha),
    tareasFinalizadas: Number(item.tareasFinalizadas) || 0,
  }));

const tooltipStyle = {
  contentStyle: {
    borderRadius: "10px",
    border: "none",
    boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
  },
};

const minDataDomain = ([dataMin, dataMax]) => {
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) return [0, 1];
  if (dataMin === dataMax) return [dataMin, dataMin + 1];
  return [dataMin, dataMax];
};

function CopyButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-green-600 text-white px-4 py-2 rounded-lg"
      title="Copiar grafico"
    >
      <FaCopy size={18} />
    </button>
  );
}

export default function DashboardGraficas2({ estadisticas, fechaInicio, fechaFin }) {
  const [dataCostoVenta, setDataCostoVenta] = useState([]);
  const [dataCostoEntrega, setDataCostoEntrega] = useState([]);
  const [costoEntregaTotal, setCostoEntregaTotal] = useState(null);
  const [loadingCostoVenta, setLoadingCostoVenta] = useState(false);
  const [loadingCostoEntrega, setLoadingCostoEntrega] = useState(false);
  const [loadingCostoEntregaTotal, setLoadingCostoEntregaTotal] = useState(false);
  const refEnganche = useRef(null);
  const refSemana = useRef(null);
  const refGerencia = useRef(null);
  const refCostoVenta = useRef(null);
  const refCostoEntrega = useRef(null);
  const refMargenPorcentual = useRef(null);
  const refTareasFinalizadas = useRef(null);

  const dataSemana = useMemo(
    () => toSemanaArray(estadisticas?.porSemana, fechaInicio),
    [estadisticas?.porSemana, fechaInicio],
  );

  const dataIndicadorGerencia = useMemo(
    () =>
      toIndicadorGerenciaArray(
        estadisticas?.indicadorGerenciaPorSemana,
        fechaInicio,
      ),
    [estadisticas?.indicadorGerenciaPorSemana, fechaInicio],
  );

  const dataMargenPorcentual = useMemo(
    () =>
      toMargenPorcentualSemanaArray(
        estadisticas?.margenPorcentualPorSemana,
        fechaInicio,
      ),
    [estadisticas?.margenPorcentualPorSemana, fechaInicio],
  );

  const dataEngancheJavier = useMemo(
    () =>
      toEngancheJavierSemanaArray(
        estadisticas?.indicadorEngancheJavierPorSemana,
        fechaInicio,
      ),
    [estadisticas?.indicadorEngancheJavierPorSemana, fechaInicio],
  );

  const dataTareasFinalizadas = useMemo(
    () => toTareasFinalizadasArray(estadisticas?.tareasFinalizadasPorFecha),
    [estadisticas?.tareasFinalizadasPorFecha],
  );

  useEffect(() => {
    let cancelado = false;

    const cargarCostoEntregaTotal = async () => {
      if (!fechaInicio || !fechaFin) {
        setCostoEntregaTotal(null);
        return;
      }

      setLoadingCostoEntregaTotal(true);

      try {
        const { data } = await axios.get(
          `${API_URL}/api/gerencia/reporte-costo-entrega-total`,
          {
            params: {
              fechaInicio,
              fechaFin,
            },
          },
        );

        if (!cancelado) {
          setCostoEntregaTotal(data);
        }
      } catch (error) {
        console.error("Error cargando costo por entrega total:", error);

        if (!cancelado) {
          setCostoEntregaTotal(null);
          Swal.fire(
            "Error",
            "No se pudo cargar el costo por entrega total.",
            "error",
          );
        }
      } finally {
        if (!cancelado) {
          setLoadingCostoEntregaTotal(false);
        }
      }
    };

    const cargarCostosSemanales = async () => {
      if (!dataSemana.length) {
        setDataCostoVenta([]);
        setDataCostoEntrega([]);
        return;
      }

      setLoadingCostoVenta(true);
      setLoadingCostoEntrega(true);

      try {
        const [costoVenta, costoEntrega] = await Promise.all([
          Promise.all(
            dataSemana.map(async (semana) => {
              const inicioSemana = getFechaInicioSemana(
                semana.semanaNumero,
                fechaInicio,
              );
              const { data } = await axios.get(
                `${API_URL}/api/gerencia/reporte-costo-venta`,
                {
                  params: {
                    fechaInicio: inicioSemana,
                  },
                },
              );

              return {
                name: semana.name,
                semanaNumero: semana.semanaNumero,
                costoPorVenta: Number(data.costoPorVentaReal) || 0,
              };
            }),
          ),
          Promise.all(
            dataSemana.map(async (semana) => {
              const inicioSemana = getFechaInicioSemana(
                semana.semanaNumero,
                fechaInicio,
              );
              const { data } = await axios.get(
                `${API_URL}/api/gerencia/reporte-costo-entrega`,
                {
                  params: {
                    fechaInicio: inicioSemana,
                  },
                },
              );

              return {
                name: semana.name,
                semanaNumero: semana.semanaNumero,
                costoPorEntrega: Number(data.costoPorEntregaReal) || 0,
              };
            }),
          ),
        ]);

        if (!cancelado) {
          setDataCostoVenta(costoVenta);
          setDataCostoEntrega(costoEntrega);
        }
      } catch (error) {
        console.error("Error cargando costos semanales:", error);

        if (!cancelado) {
          setDataCostoVenta([]);
          setDataCostoEntrega([]);
          Swal.fire(
            "Error",
            "No se pudieron cargar los indicadores de costo por venta y entrega.",
            "error",
          );
        }
      } finally {
        if (!cancelado) {
          setLoadingCostoVenta(false);
          setLoadingCostoEntrega(false);
        }
      }
    };

    cargarCostoEntregaTotal();
    cargarCostosSemanales();

    return () => {
      cancelado = true;
    };
  }, [dataSemana, fechaFin, fechaInicio]);

  const copiarGrafico = async (ref, nombre) => {
    if (!ref.current) return;

    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });

      const blob = await new Promise((resolve) => canvas.toBlob(resolve));

      if (!blob) return;

      if (!window.ClipboardItem) {
        throw new Error("ClipboardItem no disponible");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);

      Swal.fire({
        icon: "success",
        title: "Grafico copiado",
        text: `${nombre} fue copiado al portapapeles.`,
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error copiando grafico:", error);

      Swal.fire(
        "No se pudo copiar",
        "Usa Chrome o Edge y verifica que el navegador permita copiar imagenes.",
        "error",
      );
    }
  };

  if (!estadisticas) return null;

  return (
    <div className="grid grid-cols-1 gap-6 mt-6 lg:grid-cols-2 xl:grid-cols-12">
      <div className="bg-white p-6 rounded-2xl shadow xl:col-span-3">
        <h3 className="text-gray-500 text-sm">Total Ventas</h3>

        <p className="text-4xl font-bold text-blue-800">
          {estadisticas.totalVentas}
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow xl:col-span-3">
        <h3 className="text-gray-500 text-sm">Indicador Gerencia</h3>

        <p className="text-4xl font-bold text-blue-800">
          {moneyFormatter.format(Number(estadisticas.indicadorGerenciaTotal) || 0)}
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow xl:col-span-3">
        <h3 className="text-gray-500 text-sm">Enganche Javier</h3>

        <p className="text-4xl font-bold text-green-700">
          {Number(estadisticas.indicadorEngancheJavierTotal) || 0}
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow xl:col-span-3">
        <h3 className="text-gray-500 text-sm">Costo por Entrega Total</h3>

        <p className="text-4xl font-bold text-cyan-700">
          {loadingCostoEntregaTotal
            ? "..."
            : moneyFormatter.format(
                Number(costoEntregaTotal?.costoPorEntregaTotal) || 0,
              )}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          {Number(costoEntregaTotal?.entregasRealizadas || 0)} entregas ·{" "}
          {moneyFormatter.format(Number(costoEntregaTotal?.gastoReal) || 0)} gastos
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow xl:col-span-3">
        <h3 className="text-gray-500 text-sm">Tareas Finalizadas</h3>

        <p className="text-4xl font-bold text-pink-700">
          {Number(estadisticas.totalTareasFinalizadas) || 0}
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow lg:col-span-1 xl:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Ventas Enganche Javier por Semana</h3>
          <CopyButton
            onClick={() =>
              copiarGrafico(refEnganche, "Ventas Enganche Javier por Semana")
            }
          />
        </div>

        <div ref={refEnganche} className="bg-white rounded-xl">
          <ResponsiveContainer width="100%" height={650}>
            <LineChart
              data={dataEngancheJavier}
              margin={{ top: 20, right: 12, left: 10, bottom: 110 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} />

              <YAxis allowDecimals={false} domain={minDataDomain} />

              <Tooltip {...tooltipStyle} />

              <Line
                type="linear"
                dataKey="ventas"
                name="Ventas"
                stroke={COLORS.enganche}
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 10 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow lg:col-span-1 xl:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold">Ventas por Semana</h3>

          <CopyButton
            onClick={() => copiarGrafico(refSemana, "Ventas por Semana")}
          />
        </div>

        <div ref={refSemana} className="bg-white rounded-xl">
          <h4 className="font-semibold mb-3">Ventas por Semana</h4>

          <ResponsiveContainer width="100%" height={650}>
            <LineChart
              data={dataSemana}
              margin={{ top: 20, right: 12, left: 10, bottom: 110 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis dataKey="name" angle={-50} textAnchor="end" interval={0} />

              <YAxis domain={minDataDomain} />

              <Tooltip {...tooltipStyle} />

              <Line
                type="linear"
                dataKey="ventas"
                stroke={COLORS.semana}
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 10 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow lg:col-span-1 xl:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Indicador Gerencia por Semana</h3>
          <CopyButton
            onClick={() => copiarGrafico(refGerencia, "Indicador Gerencia por Semana")}
          />
        </div>

        <div ref={refGerencia} className="bg-white rounded-xl">
          <ResponsiveContainer width="100%" height={650}>
            <LineChart
              data={dataIndicadorGerencia}
              margin={{ top: 20, right: 12, left: 22, bottom: 110 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis dataKey="name" angle={-50} textAnchor="end" interval={0} />

              <YAxis
                domain={minDataDomain}
                tickFormatter={(value) => moneyFormatter.format(value)}
              />

              <Tooltip
                {...tooltipStyle}
                formatter={(value) => moneyFormatter.format(Number(value) || 0)}
              />

              <Line
                type="linear"
                dataKey="margen"
                name="Indicador Gerencia"
                stroke={COLORS.gerencia}
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 10 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow lg:col-span-1 xl:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Margen Porcentual por Semana</h3>
          <CopyButton
            onClick={() =>
              copiarGrafico(
                refMargenPorcentual,
                "Margen Porcentual por Semana",
              )
            }
          />
        </div>

        <div ref={refMargenPorcentual} className="bg-white rounded-xl">
          <ResponsiveContainer width="100%" height={650}>
            <LineChart
              data={dataMargenPorcentual}
              margin={{ top: 20, right: 12, left: 12, bottom: 110 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis dataKey="name" angle={-50} textAnchor="end" interval={0} />

              <YAxis
                domain={minDataDomain}
                tickFormatter={(value) => percentFormatter(value)}
              />

              <Tooltip
                {...tooltipStyle}
                formatter={(value) => percentFormatter(value)}
              />

              <Line
                type="linear"
                dataKey="margenPorcentual"
                name="Margen %"
                stroke={COLORS.margenPorcentual}
                strokeWidth={3}
                dot={{ r: 6 }}
                activeDot={{ r: 10 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow lg:col-span-1 xl:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Tareas Finalizadas por Fecha</h3>
          <CopyButton
            onClick={() =>
              copiarGrafico(refTareasFinalizadas, "Tareas Finalizadas por Fecha")
            }
          />
        </div>

        <div ref={refTareasFinalizadas} className="bg-white rounded-xl">
          <ResponsiveContainer width="100%" height={650}>
            <BarChart
              data={dataTareasFinalizadas}
              margin={{ top: 20, right: 12, left: 10, bottom: 110 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

              <XAxis dataKey="name" angle={-50} textAnchor="end" interval={0} />

              <YAxis allowDecimals={false} domain={minDataDomain} />

              <Tooltip
                {...tooltipStyle}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fecha || ""}
              />

              <Bar
                dataKey="tareasFinalizadas"
                name="Tareas finalizadas"
                fill={COLORS.tareasFinalizadas}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow lg:col-span-1 xl:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Costo por Venta por Semana</h3>
          <CopyButton
            onClick={() => copiarGrafico(refCostoVenta, "Costo por Venta por Semana")}
          />
        </div>

        <div ref={refCostoVenta} className="bg-white rounded-xl">
          {loadingCostoVenta ? (
            <div className="flex h-[650px] items-center justify-center text-gray-500">
              Cargando costo por venta...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={650}>
              <LineChart
                data={dataCostoVenta}
                margin={{ top: 20, right: 12, left: 22, bottom: 110 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                <XAxis dataKey="name" angle={-50} textAnchor="end" interval={0} />

                <YAxis
                  reversed
                  domain={minDataDomain}
                  tickFormatter={(value) => moneyFormatter.format(value)}
                />

                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) => moneyFormatter.format(Number(value) || 0)}
                />

                <Line
                  type="linear"
                  dataKey="costoPorVenta"
                  name="Costo por venta"
                  stroke={COLORS.costo}
                  strokeWidth={3}
                  dot={{ r: 6 }}
                  activeDot={{ r: 10 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow lg:col-span-1 xl:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Costo por Entrega por Semana</h3>
          <CopyButton
            onClick={() =>
              copiarGrafico(refCostoEntrega, "Costo por Entrega por Semana")
            }
          />
        </div>

        <div ref={refCostoEntrega} className="bg-white rounded-xl">
          {loadingCostoEntrega ? (
            <div className="flex h-[650px] items-center justify-center text-gray-500">
              Cargando costo por entrega...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={650}>
              <LineChart
                data={dataCostoEntrega}
                margin={{ top: 20, right: 12, left: 22, bottom: 110 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                <XAxis dataKey="name" angle={-50} textAnchor="end" interval={0} />

                <YAxis
                  reversed
                  domain={minDataDomain}
                  tickFormatter={(value) => moneyFormatter.format(value)}
                />

                <Tooltip
                  {...tooltipStyle}
                  formatter={(value) => moneyFormatter.format(Number(value) || 0)}
                />

                <Line
                  type="linear"
                  dataKey="costoPorEntrega"
                  name="Costo por entrega"
                  stroke={COLORS.costoEntrega}
                  strokeWidth={3}
                  dot={{ r: 6 }}
                  activeDot={{ r: 10 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
