import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import HoraLocal from "../../components/HoraLocal";

export default function MarketingVentasAgencia() {
  const [fechaInicio, setFechaInicio] = useState("2025-12-01");
  const [fechaFin, setFechaFin] = useState("2025-12-18");
  const [ventas, setVentas] = useState({});
  const [loading, setLoading] = useState(false);

  const obtenerVentas = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/admin/ventastotales/agencias`,
        {
          params: { fechaInicio, fechaFin },
        }
      );

      setVentas(response.data.ventasPorAgencia || {});
    } catch (error) {
      console.error("Error al obtener ventas por agencia", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerVentas();
  }, []);

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Ventas por Agencia (Marketing)</h2>
      <div className="flex gap-4 mb-4 flex-wrap">
        <div>
          <label className="block text-sm">Fecha inicio</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm">Fecha fin</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="border p-2 rounded"
          />
        </div>

        <button
          onClick={obtenerVentas}
          className="bg-blue-600 text-white px-4 rounded mt-5"
        >
          Buscar
        </button>
      </div>

      <div className="relative w-[70vh] h-[70vh] overflow-hidden bg-red-400">
        {/* IMAGEN */}
        <img
          src="./CopaCreditek.jpg"
          alt="Fondo marketing"
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* CONTENIDO ENCIMA DE LA IMAGEN */}
        <div className="relative z-10 grid grid-rows-4 h-full">
          {/* PARTE 1 */}
          <div className="flex items-end relative">
               <HoraLocal />
          </div>
       
          {/* PARTE 2 */}
          <div></div>

          {/* PARTE 3 → CONTENIDO */}
          <div className="flex justify-center items-start w-full  overflow-hidden ">
            <div className="backdrop-blur rounded-lg p-4 shadow-lg w-full   overflow-y-auto">
              {loading ? (
                <p>Cargando...</p>
              ) : Object.keys(ventas).length === 0 ? (
                <p className="text-center ">No hay datos</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Object.entries(ventas).map(([agencia, total]) => (
                    <div
                      key={agencia}
                      className="bg-white rounded-lg flex justify-center items-center shadow-md p-4 border hover:shadow-lg transition"
                    >
                      <p className="text-4xl font-extrabold ">{total}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* PARTE 4 */}
          <div></div>
        </div>
      </div>
    </>
  );
}
