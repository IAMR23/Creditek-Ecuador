import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../../../config";

export default function EntregaObsequioPage() {
  const { id: entregaId } = useParams();
  const location = useLocation();
  const cliente = location.state?.cliente;

  const [lista, setLista] = useState([]);
  const [obsequios, setObsequios] = useState([]);
  const [form, setForm] = useState({
    obsequioId: "",
    cantidad: 1,
  });
  const navigate = useNavigate();

  // Cargar obsequios activos para el select
  const cargarObsequios = async () => {
    try {
      const res = await axios.get(`${API_URL}/obsequios`);
      setObsequios(res.data.filter((o) => o.activo));
    } catch (error) {
      console.error("Error al cargar obsequios:", error);
    }
  };

  // Cargar obsequios de la entrega
  const cargarDatos = async () => {
    try {
      const res = await axios.get(
        `${API_URL}/entrega-obsequios/obsequios/${entregaId}`
      );
      setLista(res.data);
    } catch (error) {
      console.error("Error al cargar:", error);
    }
  };

  const crearRegistro = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/entrega-obsequios`, {
        entregaId,
        ...form,
      });


      setForm({ obsequioId: "", cantidad: 1 });
      cargarDatos();
    } catch (error) {
      console.error("Error al crear:", error);
    }
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar registro?")) return;
    try {
      await axios.delete(`${API_URL}/entrega-obsequios/obsequios/${id}`);
      cargarDatos();
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  useEffect(() => {
    cargarDatos();
    cargarObsequios();
  }, []);

    const handleFinalizarEntrega = async () => {

    if (
      window.confirm(
        "¿Está seguro de finalizar esta entrega? Esta acción no se puede deshacer."
      )
    ) {
      try {
        alert("Entrega finalizada exitosamente!");
        navigate(`/vendedor-panel`);
        
      } catch (err) {
        console.error(err);
        alert("Error al finalizar la entrega");
      }
    }
  };


  return (
    <div className="p-6">
      <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-orange-600">
              Información de la Entrega
            </h1>
            {cliente && (
              <p className="text-gray-700 mt-1">
                Cliente:{" "}
                <span className="font-semibold">{cliente.cliente}</span>
                {cliente.cedula && ` | Cédula: ${cliente.cedula}`}
                {cliente.telefono && ` | Teléfono: ${cliente.telefono}`}
              </p>
            )}
          </div>
        </div>
      </div>

      <form
        onSubmit={crearRegistro}
        className="bg-white p-4 rounded shadow mb-6 border border-orange-500"
      >
        <h2 className="text-lg font-semibold text-orange-600 mb-4">
          Agregar obsequio
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <select
            className="border p-2 rounded"
            value={form.obsequioId}
            onChange={(e) => setForm({ ...form, obsequioId: e.target.value })}
            disabled={
              obsequios.filter(
                (o) => !lista.some((item) => Number(item.obsequioId) === o.id)
              ).length === 0
            }
          >
            <option value="">Selecciona un obsequio</option>
            {obsequios
              .filter(
                (o) => !lista.some((item) => Number(item.obsequioId) === o.id)
              )
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
          </select>

          <input
            type="number"
            placeholder="Cantidad"
            className="border p-2 rounded"
            value={form.cantidad}
            onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
          />
        </div>

        <button
          type="submit"
          className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-semibold"
        >
          Agregar
        </button>
      </form>

      {/* Lista */}
      <div className="bg-white p-4 rounded shadow border border-orange-500">
        <h2 className="text-lg font-semibold text-orange-600 mb-4">
          Obsequios entregados
        </h2>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-orange-500 text-white">
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Obsequio</th>
              <th className="p-2 border">Cantidad</th>
              <th className="p-2 border">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {lista.map((item , index) => {
              const obsequio = item;
              return (
                <tr key={item.id} className="text-center">
                  <td className="p-2 border">{index + 1}</td>
                  <td className="p-2 border">
                    {obsequio ? obsequio.nombre : item.obsequioId}
                  </td>
                  <td className="p-2 border">{obsequio.cantidad}</td>
                  <td className="p-2 border">
                    <button
                      onClick={() => eliminar(item.id)}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}

            {lista.length === 0 && (
              <tr>
                <td colSpan="4" className="p-4 text-gray-500">
                  No hay obsequios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>

           <div className="flex justify-between items-center mb-4">
        {/* Botón izquierda */}
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded"
        >
          Volver
        </button>


          <button
            onClick={handleFinalizarEntrega}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded"
          >
            Finalizar
          </button>
        
      </div>

      </div>
    </div>
  );
}
