import axios from "axios";
import { API_URL } from "../config";

const TOKEN_KEY = "token";
const SESSION_EXPIRED_EVENT = "apolo:session-expired";

let refreshPromise = null;
let sessionExpiredNotified = false;

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

const refreshApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);

export const setAccessToken = (token) => {
  if (token) {
    sessionExpiredNotified = false;
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const clearAccessToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const notifySessionExpired = () => {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
};

export const onSessionExpired = (handler) => {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
};

const isRefreshableExpiredToken = (error) => {
  return (
    error.response?.status === 401 &&
    error.response?.data?.code === "TOKEN_EXPIRED"
  );
};

const isAuthRequest = (config = {}) => {
  const url = config.url || "";
  return url.includes("/auth/login") || url.includes("/auth/refresh");
};

export const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshApi
      .post("/auth/refresh")
      .then((res) => {
        const token = res.data?.accessToken || res.data?.token;
        if (!token) throw new Error("El backend no devolvió access token.");
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const logoutSession = async () => {
  clearAccessToken();
  try {
    await refreshApi.post("/auth/logout");
  } catch {
    // El cierre local debe continuar aunque el backend no responda.
  }
};

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      originalRequest &&
      !originalRequest._retry &&
      !isAuthRequest(originalRequest) &&
      isRefreshableExpiredToken(error)
    ) {
      originalRequest._retry = true;

      try {
        const token = await refreshSession();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        clearAccessToken();
        notifySessionExpired();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
