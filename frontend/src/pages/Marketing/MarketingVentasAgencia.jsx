import React, { useState, useEffect } from "react";
import axios from "axios";

export default function MarketingVentasAgencia() {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchVentas = async () => {
    if (!fechaInicio || !fechaFin) return;

    setLoading(true);
    setError("");
    try {
      const response = await axios.get(
        `http://localhost:5020/admin/ventastotales/completas?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`
      );

      setData(response.data);
      console.log(response.data);
    } catch (err) {
      setError("Error al obtener los datos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        width: "100%",
        height: "80vh",
        backgroundImage: "url('./CopaCreditek.jpg')",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#000",
      }}
    >
      <h2 style={{ color: "white", textShadow: "0px 0px 5px black" }}>
        Ventas por Agencia
      </h2>

      <div style={{ marginBottom: "20px", color: "white" }}>
        <label>Fecha Inicio:</label>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          style={{ marginLeft: "5px" }}
        />

        <label style={{ marginLeft: "10px" }}>Fecha Fin:</label>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          style={{ marginLeft: "5px" }}
        />

        <button
          onClick={fetchVentas}
          style={{
            marginLeft: "10px",
            padding: "6px 12px",
            background: "#ffffffaa",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Consultar
        </button>
      </div>

      {loading && (
        <p style={{ color: "white", textShadow: "0px 0px 5px black" }}>
          Cargando...
        </p>
      )}

      {error && (
        <p
          style={{
            color: "red",
            fontWeight: "bold",
            textShadow: "0px 0px 5px black",
          }}
        >
          {error}
        </p>
      )}

      <table
        border="1"
        cellPadding="8"
        style={{
          width: "100%",
          background: "#ffffffdd",
          borderRadius: "8px",
        }}
      >
        <thead>
          <tr>
            <th>Agencia</th>
            <th>Ventas</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.ventasPorAgencia).map(
            ([agencia, ventas], index) => (
              <tr key={index}>
                <td>{agencia}</td>
                <td>{ventas}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
