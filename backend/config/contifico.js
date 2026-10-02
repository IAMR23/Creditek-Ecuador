const axios = require("axios");
const http = require("http");
const https = require("https");

const DEFAULT_CONTIFICO_API_URL = "https://api.contifico.com/sistema/api/v1";

const getContificoApiKey = () =>
  String(process.env.CONTIFICO_API_KEY || process.env.API_KEY || "").trim();

const CONTIFICO_API_URL = String(
  process.env.CONTIFICO_API_URL ||
    process.env.API_CONTIFICO ||
    DEFAULT_CONTIFICO_API_URL,
).replace(/\/+$/, "");

const timeoutConfigurado = Number(process.env.CONTIFICO_TIMEOUT_MS);
const CONTIFICO_TIMEOUT_MS =
  Number.isFinite(timeoutConfigurado) && timeoutConfigurado > 0
    ? timeoutConfigurado
    : 30000;

const contificoAPI = axios.create({
  baseURL: CONTIFICO_API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: CONTIFICO_TIMEOUT_MS,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

contificoAPI.interceptors.request.use((config) => {
  const apiKey = getContificoApiKey();
  if (apiKey) {
    config.headers = config.headers || {};
    // Contifico espera la clave directamente, sin el prefijo Bearer.
    config.headers.Authorization = apiKey;
  }
  return config;
});

module.exports = {
  CONTIFICO_API_URL,
  CONTIFICO_TIMEOUT_MS,
  contificoAPI,
  getContificoApiKey,
};
