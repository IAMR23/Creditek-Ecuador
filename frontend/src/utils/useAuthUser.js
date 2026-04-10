import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";

export function useAuthUser() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      setUser(decoded.usuario);
    } catch (error) {
      console.error("Error al decodificar token", error);
      localStorage.removeItem("token");
      navigate("/login");
    }
  }, [navigate]);

  return user;
}