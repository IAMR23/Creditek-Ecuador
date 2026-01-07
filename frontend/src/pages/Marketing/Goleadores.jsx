import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";

export default function Goleadores() {
  const [fechaInicio, setFechaInicio] = useState("2025-12-05");
  const [fechaFin, setFechaFin] = useState("2025-12-18");
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);

  const obtenerVentas = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/admin/ventastotales/usuarios`,
        { params: { fechaInicio, fechaFin } }
      );

      setVentas(response.data.ventasUsuario || []);
    } catch (error) {
      console.error("Error al obtener ventas por usuario", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerVentas();
  }, []);

  /* ====== DEFINICIÓN DE GRUPOS ====== */
  const grupo1 = ["Fernando", "Raul"];
  const grupo2 = ["Damian", "Alexander", "Damaris"];
  const grupo3 = ["Anais", "Naomi", ];
  const grupo4 = ["Steveen" , "Oscar",  "Wiliam" ];

  const cuadrante1 = ventas.filter((v) => grupo1.includes(v.nombre));
  const cuadrante2 = ventas.filter((v) => grupo2.includes(v.nombre));
  const cuadrante3 = ventas.filter((v) => grupo3.includes(v.nombre));
  const cuadrante4 = ventas.filter((v) => grupo4.includes(v.nombre));

  const CardUsuario = ({ nombre, total }) => (
    <p className="text-white">
      <span className="font-bold text-2xl italic px-4">{nombre}</span>{" "}
      <span className="text-4xl font-extrabold ">{total}</span>
    </p>
  );

  return (
    <>
      <h2 className="text-xl font-bold mb-4">Ventas por Usuario (Marketing)</h2>

      {/* FILTROS */}
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
          className="bg-green-600 text-white px-4 rounded mt-5"
        >
          Buscar
        </button>
      </div>

      {/* CONTENEDOR IMAGEN */}
      <div className="relative w-[70vh] h-[70vh] overflow-hidden">
        <img
          src="./Goleadores2.jpg"
          alt="Fondo marketing"
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* GRID 2x2 */}
        <div className="relative z-10 grid grid-cols-2 grid-rows-2 h-full gap-4 p-4">
          {/* CUADRANTE 1 */}
          <div className="flex flex-col relative  top-24 ">
            {cuadrante1.map((u) => (
              <CardUsuario key={u.usuarioId} {...u} />
            ))}
          </div>

          {/* CUADRANTE 2 */}
          <div className="flex flex-col gap-2 relative top-24">
            {cuadrante2.map((u) => (
              <CardUsuario key={u.usuarioId} {...u} />
            ))}
          </div>

          {/* CUADRANTE 3 */}
          <div className="flex flex-col gap-2 ">
            {cuadrante3.map((u) => (
              <CardUsuario key={u.usuarioId} {...u} />
            ))}
          </div>

          {/* CUADRANTE 4 */}
         <div className="flex flex-col gap-2 ">
            {cuadrante4.map(u => (
              <CardUsuario key={u.usuarioId} {...u} />
            ))}
          </div> 
        </div>
      </div>

      {loading && <p className="mt-4">Cargando...</p>}
    </>
  );
}
