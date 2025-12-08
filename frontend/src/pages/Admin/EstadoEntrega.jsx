import { API_URL } from "../../../config";
import { useEffect, useState } from "react";

export default function EstadoEntrega() {
  const [estados, setEstados] = useState([]);
  const [nombre, setNombre] = useState("");
  const [editId, setEditId] = useState(null);

  // ====================
  //  Cargar todos
  // ====================
  const cargarEstados = async () => {
    try {
      const res = await fetch(`${API_URL}/estado-entrega`);
      const data = await res.json();
      setEstados(data);
    } catch (error) {
      console.error("Error cargando estados", error);
    }
  };

  useEffect(() => {
    cargarEstados();
  }, []);

  // ====================
  // Crear o Editar
  // ====================
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const metodo = editId ? "PUT" : "POST";
      const url = editId
        ? `${API_URL}/estado-entrega/${editId}`
        : `${API_URL}/estado-entrega`;

      await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });

      setNombre("");
      setEditId(null);
      cargarEstados();
    } catch (error) {
      console.error("Error guardando estado", error);
    }
  };

  // ====================
  // Eliminar
  // ====================
  const eliminarEstado = async (id) => {
    if (!confirm("¿Eliminar este estado?")) return;

    try {
      await fetch(`${API_URL}/estado-entrega/${id}`, {
        method: "DELETE",
      });

      cargarEstados();
    } catch (error) {
      console.error("Error eliminando", error);
    }
  };

  // ====================
  // Cargar datos en formulario
  // ====================
  const editar = (estado) => {
    setEditId(estado.id);
    setNombre(estado.nombre);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">

      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-4 rounded-xl shadow-md border"
      >
        <h2 className="text-xl font-semibold mb-3">
          {editId ? "Editar Estado de Entrega" : "Crear Estado de Entrega"}
        </h2>

        <input
          type="text"
          placeholder="Nombre del estado"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full p-2 border rounded mb-4"
          required
        />

        <button
          className="px-4 py-2 rounded text-white bg-green-600 hover:bg-green-500 transition"
        >
          {editId ? "Actualizar" : "Crear"}
        </button>

        {editId && (
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setNombre("");
            }}
            className="ml-3 px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
          >
            Cancelar
          </button>
        )}
      </form>

      {/* LISTA */}
      <div className="mt-6 bg-white rounded-xl shadow-md p-4 border">
        <h2 className="text-lg font-semibold mb-3">Estados Registrados</h2>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">ID</th>
              <th className="py-2">Nombre</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {estados.map((estado) => (
              <tr key={estado.id} className="border-b">
                <td className="py-2">{estado.id}</td>
                <td className="py-2">{estado.nombre}</td>

                <td className="py-2 flex gap-2">
                  {/* Editar */}
                  <button
                    onClick={() => editar(estado)}
                    className="px-3 py-1 rounded text-white bg-green-500 hover:bg-green-600 transition"
                  >
                    Editar
                  </button>

                  {/* Eliminar */}
                  <button
                    onClick={() => eliminarEstado(estado.id)}
                    className="px-3 py-1 rounded text-white bg-red-500 hover:bg-red-600 transition"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {estados.length === 0 && (
          <p className="text-gray-500 text-center mt-4">
            No hay estados registrados.
          </p>
        )}
      </div>
    </div>
  );
}
