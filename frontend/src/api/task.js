// src/api/task.api.js
import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5020/api/tasks"
});

// interceptor para token
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// endpoints
export const createTask = (data) => API.post("/", data);
export const getMyTasks = () => API.get("/my");
export const filterTasks = (status) => API.get(`/?status=${status}`);
export const updateTaskStatus = (id, status) =>
  API.put(`/${id}/status`, { status });