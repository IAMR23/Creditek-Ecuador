import React, { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AA336A", "#66CCFF"];

const VentasCompletas = () => {
  const [ventasData, setVentasData] = useState([]);
  const [totalVentas, setTotalVentas] = useState(0);
  const [agencias, setAgencias] = useState([]);

  const [filters, setFilters] = useState({
    fechaInicio: "",
    fechaFin: "",
    agenciaId: "",
  });
  const [loading, setLoading] = useState(false);

  // Cargar agencias al iniciar
  useEffect(() => {
    const cargarAgencias = async () => {
      try {
        const res = await axios.get("http://localhost:5020/agencias");
        setAgencias(res.data || []);
      } catch (err) {
        console.error(err);
        setAgencias([]);
      }
    };



    cargarAgencias();
  }, []);

  const fetchVentas = async () => {
    if (!filters.fechaInicio || !filters.fechaFin) {
      alert("Debes seleccionar fecha inicio y fecha fin");
      return;
    }

    setLoading(true);
    try {
      const params = {
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin
      };
      if (filters.agenciaId) params.agenciaId = filters.agenciaId;

      const res = await axios.get("http://localhost:5020/admin/ventastotales/completas", { params });
      setVentasData(res.data.ventas || []);
      setTotalVentas(res.data.totalVentas);
    } catch (error) {
      console.error(error);
      alert("Error al obtener los datos");
    }
    setLoading(false);
  };

  // Preparar datos para gráficos
  const origenChartData = [];
  const pagoChartData = [];
  const origenCount = {};
  const pagoCount = {};

  ventasData.forEach(venta => {
    // Origen
    const origen = venta.origen?.nombre || "Desconocido";
    origenCount[origen] = (origenCount[origen] || 0) + 1;

    // Forma de pago
    venta.detalleVenta.forEach(det => {
      const formaPago = det.formaPago?.nombre || "Desconocido";
      pagoCount[formaPago] = (pagoCount[formaPago] || 0) + 1;
    });
  });

  Object.keys(origenCount).forEach(key => {
    origenChartData.push({ name: key, value: origenCount[key] });
  });
  Object.keys(pagoCount).forEach(key => {
    pagoChartData.push({ name: key, value: pagoCount[key] });
  });

  return (
  <>cd</>
  );
};

export default VentasCompletas;
