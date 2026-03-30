
import { useState } from "react";
import { createTask } from "../../api/task";

export default function TaskForm({ onTaskCreated }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    dueDate: "",
    reminderAt: ""
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await createTask(form);
    onTaskCreated(res.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="title" placeholder="Título" onChange={handleChange} required />
      <input name="description" placeholder="Descripción" onChange={handleChange} />
      <input name="assignedTo" placeholder="ID usuario" onChange={handleChange} required />
      <input type="datetime-local" name="dueDate" onChange={handleChange} />
      <input type="datetime-local" name="reminderAt" onChange={handleChange} />
      <button type="submit">Crear</button>
    </form>
  );
}