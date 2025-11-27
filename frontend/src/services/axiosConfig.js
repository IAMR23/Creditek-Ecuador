import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL; // Ajusta la URL de tu backend

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
