import TaskList from "../pages/Tareas/TaskList";

export default function NotificacionesModal({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      
      <div className="bg-white text-black  rounded-lg shadow-lg p-4">
        
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold">Notificaciones</h2>
          <button 
            onClick={onClose}
            className="text-gray-600 hover:text-black"
          >
            X
          </button>
        </div>

        <div className="max-h-[400px] overflow-auto">
          <TaskList />
        </div>

      </div>
    </div>
  );
}