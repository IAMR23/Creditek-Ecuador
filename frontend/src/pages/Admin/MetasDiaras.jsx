import React, { useMemo, useState, useEffect } from "react";

const STORAGE_KEY = "metas_diarias";

const MetasDiarias = ({ data, metaPorDefecto = 2 }) => {
  const normalizar = (str) => str?.trim().toLowerCase();

  // Fuente de datos
  const source = useMemo(() => {
    return data?.estadisticas?.porVendedor || data?.porVendedor || {};
  }, [data]);

  // 🔥 Cargar metas desde localStorage
  const [metas, setMetas] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 🔥 Guardar en localStorage cada vez que cambie
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metas));
  }, [metas]);

  // Manejo input
  const handleMetaChange = (nombre, value) => {
    const meta = Number(value);

    setMetas((prev) => ({
      ...prev,
      [normalizar(nombre)]: isNaN(meta) ? 0 : meta,
    }));
  };

  // Transformación
  const vendedores = useMemo(() => {
    return Object.entries(source).map(([nombre, ventas]) => {
      const nombreLimpio = nombre.trim();

      const meta =
        metas[normalizar(nombreLimpio)] ?? metaPorDefecto;

      const faltan = Math.max(meta - ventas, 0);

      return {
        nombre: nombreLimpio,
        meta,
        ventas,
        faltan,
      };
    });
  }, [source, metas, metaPorDefecto]);

  // Orden
  const vendedoresOrdenados = useMemo(() => {
    return [...vendedores].sort((a, b) => b.ventas - a.ventas);
  }, [vendedores]);

  // Total ventas
  const totalVentas = useMemo(() => {
    return vendedores.reduce((acc, v) => acc + v.ventas, 0);
  }, [vendedores]);

  // Colores
  const getColor = (faltan) => {
    if (faltan === 0) return "#00c853";
    if (faltan <= 2) return "#ffd600";
    return "#d50000";
  };

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>VENDEDOR</th>
            <th style={styles.th}>META</th>
            <th style={styles.th}>VENTAS</th>
            <th style={styles.th}>FALTAN</th>
          </tr>
        </thead>

        <tbody>
          {vendedoresOrdenados.map((v, index) => (
            <tr key={index} style={{ backgroundColor: getColor(v.faltan) }}>
              <td style={styles.td}>{v.nombre.toUpperCase()}</td>

              <td style={styles.tdCenter}>
                <input
                  type="number"
                  min="0"
                  value={v.meta}
                  onChange={(e) =>
                    handleMetaChange(v.nombre, e.target.value)
                  }
                  style={styles.input}
                />
              </td>

              <td style={styles.tdCenter}>{v.ventas}</td>
              <td style={styles.tdCenter}>{v.faltan}</td>
            </tr>
          ))}

          {/* TOTAL */}
          <tr style={styles.totalRow}>
            <td style={styles.td}>TOTAL</td>
            <td></td>
            <td style={styles.tdCenter}>{totalVentas}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// 🎨 estilos
const styles = {
  table: {
    borderCollapse: "collapse",
    width: "100%",
    fontFamily: "Arial",
    fontSize: "14px",
  },
  th: {
    border: "1px solid #000",
    padding: "8px",
    backgroundColor: "#e0e0e0",
    textAlign: "center",
    fontWeight: "bold",
  },
  td: {
    border: "1px solid #000",
    padding: "6px",
  },
  tdCenter: {
    border: "1px solid #000",
    padding: "6px",
    textAlign: "center",
  },
  input: {
    width: "60px",
    textAlign: "center",
    border: "1px solid #ccc",
    borderRadius: "4px",
    padding: "4px",
  },
  totalRow: {
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
  },
};

export default MetasDiarias;