import { createContext, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import {
  api,
  clearAccessToken,
  getAccessToken,
  logoutSession,
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from "../api/client";

export const AuthContext = createContext(null);

const emptyAuth = {
  isAuthenticated: false,
  token: null,
  user: null,
};

const decodeAuthToken = (token) => {
  if (!token) return { ...emptyAuth, expired: false };

  try {
    const decoded = jwtDecode(token);
    const exp = decoded.exp ? decoded.exp * 1000 : null;
    const expired = Boolean(exp && Date.now() > exp);

    return {
      isAuthenticated: !expired,
      token,
      user: decoded.usuario || null,
      expired,
    };
  } catch {
    clearAccessToken();
    return { ...emptyAuth, expired: false };
  }
};

const getAuthFromStorage = () => {
  const token = getAccessToken();
  const auth = decodeAuthToken(token);
  return {
    isAuthenticated: auth.isAuthenticated,
    token: auth.token,
    user: auth.user,
  };
};

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getAuthFromStorage());
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      const current = decodeAuthToken(getAccessToken());

      if (current.isAuthenticated) {
        if (active) {
          setAuth(getAuthFromStorage());
          setInitializing(false);
        }
        return;
      }

      try {
        await refreshSession();
        if (active) setAuth(getAuthFromStorage());
      } catch {
        clearAccessToken();
        if (active) setAuth(emptyAuth);
      } finally {
        if (active) setInitializing(false);
      }
    };

    bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onStorage = () => setAuth(getAuthFromStorage());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      setAuth(emptyAuth);
      Swal.fire({
        icon: "info",
        title: "Sesión expirada",
        text: "Tu sesión ya no pudo renovarse. Inicia sesión nuevamente.",
        confirmButtonText: "Entendido",
      });
    });
  }, []);

  const login = async ({ email, password }) => {
    const res = await api.post("/auth/login", { email, password });
    const token = res.data?.accessToken || res.data?.token;

    if (!token) {
      throw new Error("El backend no devolvió access token.");
    }

    setAccessToken(token);
    setAuth(getAuthFromStorage());
    return res.data;
  };

  const logout = async () => {
    await logoutSession();
    setAuth(emptyAuth);
  };

  const value = useMemo(
    () => ({ ...auth, initializing, login, logout }),
    [auth, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
