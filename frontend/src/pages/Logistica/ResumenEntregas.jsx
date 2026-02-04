import { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { API_URL } from "../../../config";

const ESTADOS_BASE = ["Entregado", "No Entregado", "Transito", "Pendiente"];

export default function ResumenEntregas({ userId }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResumen = async () => {
      try {
        const params = {};
        if (userId) params.userId = userId;

        const response = await axios.get(`${API_URL}/contador`, { params });

        // 🔹 Normalizar para que todos los estados existan
        const normalizado = ESTADOS_BASE.map((estado) => {
          const found = response.data.find((d) => d.estado === estado);
          return {
            estado,
            total: found ? Number(found.total) : 0,
          };
        });

        setData(normalizado);
      } catch (error) {
        console.error("Error al cargar resumen", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResumen();
  }, [userId]);

  if (loading) return <p>Cargando resumen...</p>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        width: "100%",
        height: 350,
        background: "#fff",
        padding: "1rem",
        borderRadius: "12px",
        boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ marginBottom: "1rem" }}>Resumen de Entregas</h3>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="estado" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="total" />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
