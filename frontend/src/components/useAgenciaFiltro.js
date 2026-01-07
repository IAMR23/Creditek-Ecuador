import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { jwtDecode } from "jwt-decode";

export default function useAgenciasFiltro() {
  const [agencias, setAgencias] = useState([]);
  const [agenciaId, setAgenciaId] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [vendedorId, setVendedorId] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    }
  };

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data || []);
    } catch (error) {
      console.error("Error cargando agencias:", error);
      setAgencias([]);
    }
  };

  useEffect(() => {
    cargarAgencias();
    cargarUsuarios();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      setUsuarioInfo(decoded.usuario);
    } catch (error) {
      console.error("Error decodificando token:", error);
    }
  }, []);

  return {
    agencias,
    agenciaId,
    setAgenciaId,
    usuarios,
    vendedorId,
    setVendedorId,
    usuarioInfo,
    loading,
    recargarAgencias: cargarAgencias,
    recargarUsuarios: cargarUsuarios,
  };
}
