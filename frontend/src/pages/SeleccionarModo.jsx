import { useNavigate } from "react-router-dom";

function SeleccionarModo() {
  const navigate = useNavigate();

  const seleccionarModo = (modo) => {
    localStorage.setItem("activeMode", modo);

    if (modo === "ADMIN") navigate("/dashboard");
    if (modo === "REPARTO") navigate("/logistica-panel");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">
          ¿Qué deseas hacer?
        </h2>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => seleccionarModo("ADMIN")}
            className="bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-500"
          >
            Administración
          </button>

          <button
            onClick={() => seleccionarModo("REPARTO")}
            className="bg-green-600 text-white py-3 rounded-lg hover:bg-green-500"
          >
            Repartos
          </button>
        </div>
      </div>
    </div>
  );
}

export default SeleccionarModo;
