/* eslint-disable react/prop-types */
import { useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { FaCopy } from "react-icons/fa";

const COLORS = {
  semana: "#4ADE80",
  enganche: "#16a34a",
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

const cargarImagen = (src) =>
  new Promise((resolve, reject) => {
    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () => reject(new Error("No se pudo renderizar el grafico"));
    imagen.src = src;
  });

const obtenerPngGrafico = async (contenedor, cache, clave) => {
  const svgOriginal = contenedor.querySelector("svg");

  if (!svgOriginal) {
    throw new Error("El grafico aun no esta disponible");
  }

  const rect = svgOriginal.getBoundingClientRect();
  const viewBox = svgOriginal.viewBox?.baseVal;
  const ancho = Math.max(1, Math.round(rect.width || viewBox?.width || 1));
  const alto = Math.max(1, Math.round(rect.height || viewBox?.height || 1));
  const svgClonado = svgOriginal.cloneNode(true);

  svgClonado.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgClonado.setAttribute("width", String(ancho));
  svgClonado.setAttribute("height", String(alto));

  const contenidoSvg = new XMLSerializer().serializeToString(svgClonado);
  const firma = `${ancho}x${alto}:${contenidoSvg}`;
  const copiaGuardada = cache.get(clave);

  if (copiaGuardada?.firma === firma) {
    return copiaGuardada.blob;
  }

  const svgBlob = new Blob([contenidoSvg], {
    type: "image/svg+xml;charset=utf-8",
  });
  const urlSvg = URL.createObjectURL(svgBlob);

  try {
    const imagen = await cargarImagen(urlSvg);
    const escala = 2;
    const canvas = document.createElement("canvas");

    canvas.width = ancho * escala;
    canvas.height = alto * escala;

    const contexto = canvas.getContext("2d");

    if (!contexto) {
      throw new Error("No se pudo crear la imagen del grafico");
    }

    contexto.scale(escala, escala);
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, ancho, alto);
    contexto.drawImage(imagen, 0, 0, ancho, alto);

    const pngBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("No se pudo convertir el grafico a PNG"));
      }, "image/png");
    });

    cache.set(clave, { firma, blob: pngBlob });
    return pngBlob;
  } finally {
    URL.revokeObjectURL(urlSvg);
  }
};

function CopyButton({ onClick, copiando = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={copiando}
      className="bg-green-600 text-white px-4 py-2 rounded-lg transition hover:bg-green-700 disabled:cursor-wait disabled:opacity-70"
      title={copiando ? "Copiando grafico" : "Copiar grafico"}
      aria-label={copiando ? "Copiando grafico" : "Copiar grafico"}
    >
      <FaCopy size={18} className={copiando ? "animate-pulse" : ""} />
    </button>
  );
}

export default function PowerBiGraficasSupervisores({
  estadisticas,
  fechaInicio,
}) {
  const [graficoCopiando, setGraficoCopiando] = useState("");
  const cacheImagenes = useRef(new Map());
  const refEnganche = useRef(null);
  const refSemana = useRef(null);

  const dataEngancheJavier = useMemo(
    () =>
      toEngancheJavierSemanaArray(
        estadisticas?.indicadorEngancheJavierPorSemana,
        fechaInicio,
      ),
    [estadisticas?.indicadorEngancheJavierPorSemana, fechaInicio],
  );

  const dataSemana = useMemo(
    () => toSemanaArray(estadisticas?.porSemana, fechaInicio),
    [estadisticas?.porSemana, fechaInicio],
  );

  const copiarGrafico = async (ref, nombre) => {
    if (!ref.current) return;

    try {
      if (!navigator.clipboard?.write || !window.ClipboardItem) {
        throw new Error("ClipboardItem no disponible");
      }

      setGraficoCopiando(nombre);

      const pngPromise = obtenerPngGrafico(
        ref.current,
        cacheImagenes.current,
        nombre,
      );

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngPromise,
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
    } finally {
      setGraficoCopiando("");
    }
  };

  if (!estadisticas) return null;

  return (
    <div className="grid grid-cols-1 gap-6 mt-6 lg:grid-cols-2 xl:grid-cols-12">
      <div className="bg-white p-4 rounded-2xl shadow lg:col-span-1 xl:col-span-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Ventas Javier por Semana</h3>
          <CopyButton
            copiando={graficoCopiando === "Ventas Javier por Semana"}
            onClick={() =>
              copiarGrafico(refEnganche, "Ventas Javier por Semana")
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
            copiando={graficoCopiando === "Ventas por Semana"}
            onClick={() => copiarGrafico(refSemana, "Ventas por Semana")}
          />
        </div>

        <div ref={refSemana} className="bg-white rounded-xl">
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
    </div>
  );
}
