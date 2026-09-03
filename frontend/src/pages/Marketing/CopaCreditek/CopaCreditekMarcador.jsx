/* eslint-disable react/prop-types */
import { POSTER_LAYOUT } from "./posterLayout";

const obtenerEquipo = (equipos, nombre) =>
  equipos.find((equipo) => equipo.nombre === nombre) || {
    nombre,
    total: 0,
    vendedores: [],
  };

const tamanoFuenteBloque = (cantidad) => {
  if (cantidad >= 10) return "clamp(8px, 1.3cqw, 17px)";
  if (cantidad >= 8) return "clamp(9px, 1.55cqw, 20px)";
  if (cantidad >= 6) return "clamp(10px, 1.85cqw, 24px)";
  return "clamp(12px, 2.45cqw, 32px)";
};

const tamanoNombre = (nombre) => {
  const longitud = String(nombre || "").length;
  if (longitud > 20) return "0.72em";
  if (longitud > 16) return "0.85em";
  if (longitud > 12) return "1.05em";
  return "1.22em";
};

function BloqueVendedores({ equipo, posicion }) {
  const cantidad = equipo.vendedores.length;
  return (
    <div
      data-copa-bloque-vendedores
      className="absolute z-20 flex flex-col justify-start overflow-visible"
      style={{
        left: `${posicion.left}%`,
        top: `${posicion.top}%`,
        width: `${posicion.width}%`,
        height: `${posicion.height}%`,
        color: posicion.color,
        fontSize: tamanoFuenteBloque(cantidad),
        fontFamily: '"Arial Narrow", "Bahnschrift Condensed", Impact, sans-serif',
        fontStretch: "condensed",
        fontWeight: 800,
        lineHeight: cantidad >= 8 ? 1.12 : 1.2,
        letterSpacing: "0.01em",
        textShadow: "0 1px 2px rgba(0,0,0,.9)",
      }}
    >
      {cantidad > 0 && (
        equipo.vendedores.map((vendedor) => (
          <div
            key={vendedor.usuarioId}
            data-copa-fila-vendedor
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.5em] overflow-visible px-[0.3em]"
            style={{ minHeight: "1.32em", paddingBlock: "0.1em" }}
          >
            <span
              data-copa-nombre-vendedor
              className="min-w-0 whitespace-nowrap"
              style={{
                fontSize: tamanoNombre(vendedor.nombreMostrado),
                lineHeight: 1.16,
                overflow: "visible",
              }}
            >
              {vendedor.nombreMostrado}
            </span>
            <span
              data-copa-resultado-vendedor
              className="whitespace-nowrap tabular-nums"
              style={{ lineHeight: 1.16 }}
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
        className="relative mx-auto w-full max-w-[1100px] overflow-hidden"
        style={{ containerType: "inline-size" }}
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
                fontSize: "clamp(28px, 7.4cqw, 94px)",
                lineHeight: 1,
                WebkitTextStroke: "max(3px, .65cqw) #000000",
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
