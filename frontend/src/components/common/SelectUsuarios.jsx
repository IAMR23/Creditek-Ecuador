import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";

export default function SelectUsuarios({
  value,
  onChange,
  label = "Usuario",
  incluirTodos = true,
}) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>

      <select
        className="border px-2 py-1 rounded w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        {incluirTodos && <option value="">Todos</option>}

        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}