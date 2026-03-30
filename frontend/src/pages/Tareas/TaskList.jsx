// src/components/TaskList.jsx
import TaskItem from "./TaskItem";

export default function TaskList({ tasks, refresh }) {
  return (
    <div>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} refresh={refresh} />
      ))}
    </div>
  );
}