// src/components/TaskItem.jsx

import { updateTaskStatus } from "../../api/task";

export default function TaskItem({ task, refresh }) {

  const changeStatus = async (status) => {
    await updateTaskStatus(task.id, status);
    refresh();
  };

  return (
    <div style={{ border: "1px solid gray", margin: 5, padding: 10 }}>
      <h4>{task.title}</h4>
      <p>{task.description}</p>
      <p>Estado: {task.status}</p>

      <button onClick={() => changeStatus("pendiente")}>Pendiente</button>
      <button onClick={() => changeStatus("en_progreso")}>En progreso</button>
      <button onClick={() => changeStatus("completada")}>Completar</button>
    </div>
  );
}