import { createContext, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { api } from "../api/client";

export const AuthContext = createContext(null);

const getAuthFromStorage = () => {
  const token = localStorage.getItem("token");
  if (!token) return { isAuthenticated: false, token: null, user: null };
  try {
    const decoded = jwtDecode(token);
    const exp = decoded.exp ? decoded.exp * 1000 : null;
    if (exp && Date.now() > exp) {
      localStorage.removeItem("token");
      return { isAuthenticated: false, token: null, user: null };
    }
    return {
      isAuthenticated: true,
      token,
      user: decoded.usuario || null,
    };
  } catch {
    localStorage.removeItem("token");
    return { isAuthenticated: false, token: null, user: null };
  }
};

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getAuthFromStorage());

  useEffect(() => {
    const onStorage = () => setAuth(getAuthFromStorage());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = async ({ email, password }) => {
    const res = await api.post("/auth/login", { email, password });
    const token = res.data?.token;
    localStorage.setItem("token", token);
    setAuth(getAuthFromStorage());
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setAuth({ isAuthenticated: false, token: null, user: null });
  };

  const value = useMemo(() => ({ ...auth, login, logout }), [auth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

