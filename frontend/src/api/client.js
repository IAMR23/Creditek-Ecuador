import axios from "axios";
import { API_URL } from "../../config";

const TOKEN_KEY = "token";
const SESSION_EXPIRED_EVENT = "rve:session-expired";
const ACCESS_TOKEN_UPDATED_EVENT = "rve:access-token-updated";
const ACCESS_TOKEN_REFRESH_SKEW_MS = 30 * 1000;

let refreshPromise = null;
let sessionExpiredNotified = false;

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);

export const setAccessToken = (token) => {
  if (!token) return;

  sessionExpiredNotified = false;
  localStorage.setItem(TOKEN_KEY, token);

  window.dispatchEvent(
    new CustomEvent(ACCESS_TOKEN_UPDATED_EVENT, {
      detail: { token },
    }),
  );
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

export const onAccessTokenUpdated = (handler) => {
  window.addEventListener(ACCESS_TOKEN_UPDATED_EVENT, handler);
  return () => window.removeEventListener(ACCESS_TOKEN_UPDATED_EVENT, handler);
};

const isRefreshableExpiredToken = async (error) => {
  if (error.response?.status !== 401) return false;

  if (error.response?.data?.code === "TOKEN_EXPIRED") return true;

  if (error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const parsed = JSON.parse(text);
      return parsed?.code === "TOKEN_EXPIRED";
    } catch {
      return false;
    }
  }

  return false;
};

const isAuthRequest = (config = {}) => {
  const url = config.url || "";
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
  );
};

const decodeJwtPayload = (token) => {
  const payload = token?.split(".")?.[1];
  if (!payload || typeof globalThis.atob !== "function") return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
};

const shouldRefreshAccessToken = (token) => {
  const payload = decodeJwtPayload(token);
  const expMs = Number(payload?.exp) * 1000;

  if (!Number.isFinite(expMs)) return false;

  return expMs <= Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS;
};

const refreshAccessTokenOrExpireSession = async () => {
  try {
    return await refreshSession();
  } catch (error) {
    clearAccessToken();
    notifySessionExpired();
    throw error;
  }
};

export const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshApi
      .post("/auth/refresh")
      .then((res) => {
        const token = res.data?.accessToken || res.data?.token;
        if (!token) throw new Error("El backend no devolvio access token.");
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
  try {
    await refreshApi.post("/auth/logout");
  } catch {
    // El cierre local debe continuar aunque el backend no responda.
  } finally {
    clearAccessToken();
  }
};

const resolveFetchInput = (input) => {
  if (typeof input === "string" && input.startsWith("/")) {
    return `${API_URL || ""}${input}`;
  }

  return input;
};

const buildFetchOptions = (init = {}, token) => {
  const headers = new Headers(init.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return {
    ...init,
    credentials: "include",
    headers,
  };
};

const isRefreshableFetchResponse = async (response) => {
  if (response.status !== 401) return false;

  try {
    const data = await response.clone().json();
    return data?.code === "TOKEN_EXPIRED";
  } catch {
    return false;
  }
};

export const apiFetch = async (input, init = {}) => {
  let token = getAccessToken();

  if (token && shouldRefreshAccessToken(token)) {
    token = await refreshAccessTokenOrExpireSession();
  }

  const url = resolveFetchInput(input);
  let response = await fetch(url, buildFetchOptions(init, token));

  if (await isRefreshableFetchResponse(response)) {
    token = await refreshAccessTokenOrExpireSession();
    response = await fetch(url, buildFetchOptions(init, token));
  }

  return response;
};

const attachAuthInterceptors = (instance) => {
  instance.interceptors.request.use(async (config) => {
    config.withCredentials = true;

    let token = getAccessToken();
    if (token && !isAuthRequest(config) && shouldRefreshAccessToken(token)) {
      token = await refreshAccessTokenOrExpireSession();
    }

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (
        originalRequest &&
        !originalRequest._retry &&
        !isAuthRequest(originalRequest) &&
        (await isRefreshableExpiredToken(error))
      ) {
        originalRequest._retry = true;

        try {
          const token = await refreshSession();
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          originalRequest.withCredentials = true;
          return instance(originalRequest);
        } catch (refreshError) {
          clearAccessToken();
          notifySessionExpired();
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    },
  );
};

attachAuthInterceptors(api);
attachAuthInterceptors(axios);

export default api;
