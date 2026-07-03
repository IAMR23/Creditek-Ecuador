import api from "./client";

export const createTask = (data) => api.post("/tasks", data);
export const getMyTasks = () => api.get("/tasks/me");
export const filterTasks = (status) => api.get("/tasks", { params: { status } });
export const updateTaskStatus = (id, status) =>
  api.put(`/tasks/${id}`, { status });
