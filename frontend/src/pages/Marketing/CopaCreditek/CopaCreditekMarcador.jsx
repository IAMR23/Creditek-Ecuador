/* eslint-disable react/prop-types */
import { POSTER_LAYOUT } from "./posterLayout";

const POSTER_SIZE_PX = 1100;
const COPA_FONT_FAMILY =
  '"Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif';
const AGENCIA_FONT_SIZE = "39px";
const VENDEDOR_NOMBRE_FONT_SIZE = "27px";
const VENDEDOR_NUMERO_FONT_SIZE = "24px";

const obtenerEquipo = (equipos, nombre) =>
  equipos.find((equipo) => equipo.nombre === nombre) || {
    nombre,
    total: 0,
    vendedores: [],
  };

function BloqueVendedores({ equipo, posicion }) {
  return (
    <div
      data-copa-bloque-vendedores
      className="absolute z-20 flex flex-col justify-start overflow-hidden"
      style={{
        left: `${posicion.left}%`,
        top: `${posicion.top}%`,
        width: `${posicion.width}%`,
        height: `${posicion.height}%`,
        boxSizing: "border-box",
        padding: `${posicion.paddingTop || 7}px 8px 7px`,
        backgroundColor: "#000000",
        color: posicion.color,
        fontFamily: COPA_FONT_FAMILY,
        fontStretch: "condensed",
        fontWeight: 800,
        lineHeight: 1.12,
        letterSpacing: 0,
        textShadow: "0 1px 2px rgba(0,0,0,.9)",
      }}
    >
      <div
        className="whitespace-nowrap uppercase"
        style={{
          fontFamily: COPA_FONT_FAMILY,
          fontSize: AGENCIA_FONT_SIZE,
          lineHeight: 1,
          marginBottom: "10px",
        }}
      >
        {equipo.nombre}
      </div>
      {equipo.vendedores.length > 0 && (
        equipo.vendedores.map((vendedor) => (
          <div
            key={vendedor.usuarioId}
            data-copa-fila-vendedor
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center overflow-visible"
            style={{
              columnGap: "16px",
              minHeight: "31px",
              fontFamily: COPA_FONT_FAMILY,
              fontSize: VENDEDOR_NOMBRE_FONT_SIZE,
              lineHeight: 1.05,
              textTransform: "uppercase",
            }}
          >
            <span
              data-copa-nombre-vendedor
              className="min-w-0 whitespace-nowrap"
              style={{
                fontFamily: COPA_FONT_FAMILY,
                fontSize: VENDEDOR_NOMBRE_FONT_SIZE,
                lineHeight: 1.05,
                overflow: "visible",
              }}
            >
              {vendedor.nombreMostrado}
            </span>
            <span
              data-copa-resultado-vendedor
              className="whitespace-nowrap tabular-nums"
              style={{
                fontFamily: COPA_FONT_FAMILY,
                fontSize: VENDEDOR_NUMERO_FONT_SIZE,
                lineHeight: 1.05,
              }}
            >
              {vendedor.ventasMostradas} / {vendedor.meta}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export default function CopaCreditekMarcador({ copa, posterRef, onImageReady }) {
  const equipos = copa.equipos || [];

  return (
    <div className="overflow-x-auto rounded-xl bg-slate-100 p-2 sm:p-4">
      <div
        ref={posterRef}
        className="relative mx-auto shrink-0 overflow-hidden"
        style={{ width: `${POSTER_SIZE_PX}px` }}
      >
        <img
          src="/CopaCreditek2026.webp"
          alt="Copa Creditek 2026"
          className="block h-auto w-full"
          onLoad={() => onImageReady(true)}
          onError={() => onImageReady(false)}
        />

        {POSTER_LAYOUT.scores.map((posicion) => {
          const equipo = obtenerEquipo(equipos, posicion.equipo);
          return (
            <div
              key={posicion.equipo}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center font-black tabular-nums"
              style={{
                left: `${posicion.left}%`,
                top: `${posicion.top}%`,
                color: posicion.color,
                fontFamily: 'Impact, "Arial Black", sans-serif',
                fontSize: "82px",
                lineHeight: 1,
                WebkitTextStroke: "7px #000000",
                paintOrder: "stroke fill",
                textShadow: "0 3px 3px rgba(0,0,0,.95)",
              }}
            >
              {equipo.total}
            </div>
          );
        })}

        {Object.entries(POSTER_LAYOUT.vendedores).map(([nombre, posicion]) => (
          <BloqueVendedores
            key={nombre}
            equipo={obtenerEquipo(equipos, nombre)}
            posicion={posicion}
          />
        ))}
      </div>

      {copa.vendedoresSinEquipo?.length > 0 && (
        <p className="mx-auto mt-3 max-w-[1100px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {copa.vendedoresSinEquipo.length} vendedor(es) todavía no tienen un
          equipo Copa válido. Asígnalos desde Configuración.
        </p>
      )}
    </div>
  );
}
