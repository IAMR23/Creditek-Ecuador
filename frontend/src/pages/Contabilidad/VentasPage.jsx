import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { Calendar, Search, RotateCcw, Building2 } from "lucide-react";
import VentasTable from "./VentasTable";

export default function VentasPage() {
const hoyLocal =new Date().toLocaleDateString("en-CA"); 
  const [ventas, setVentas] = useState([]);
  const [agencias, setAgencias] = useState([]);
  const [usuariosAgencia, setUsuariosAgencia] = useState([]);
  const [productos, setProductos] = useState([]);

  const [filtros, setFiltros] = useState({
    fechaInicio: today,
    fechaFin: today,
    agenciaId: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ag, ua, pr] = await Promise.all([
          axios.get(`${API_URL}/agencias`),
          axios.get(`${API_URL}/usuario-agencia`),
          axios.get(`${API_URL}/dispositivos`),
        ]);

        setAgencias(ag.data);
        setUsuariosAgencia(ua.data);
        setProductos(pr.data);
      } catch (error) {
        console.error("Error cargando datos iniciales", error);
      }
    };

    fetchData();
  }, []);

  const handleChange = (e) => {
    setFiltros({
      ...filtros,
      [e.target.name]: e.target.value,
    });
  };

  const buscarVentas = async () => {
    if (filtros.fechaInicio > filtros.fechaFin) {
      alert("La fecha de inicio no puede ser mayor a la fecha de fin");
      return;
    }

    try {
      const params = {};
      Object.keys(filtros).forEach((key) => {
        if (filtros[key] !== "") params[key] = filtros[key];
      });

      const res = await axios.get(`${API_URL}/venta/filter`, { params });
      setVentas(res.data);
    } catch (error) {
      console.error("Error al filtrar ventas", error);
    }
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaInicio: today,
      fechaFin: today,
      agenciaId: "",
    });
    setVentas([]);
  };

  return (
    <div className="p-6">

      {/* Título */}
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3 text-green-500">
        <Search size={30} />
        Filtros de Ventas
      </h1>

      {/* Card de filtros */}
      <div className=" border  rounded-2xl p-6 shadow-xl mb-6">

        {/* GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Fecha Inicio */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold  mb-1">Fecha Inicio</label>
            <div className="flex items-center gap-2  rounded-xl px-4 py-2 border ">
              <Calendar size={18} className="" />
              <input
                type="date"
                name="fechaInicio"
                value={filtros.fechaInicio}
                max={filtros.fechaFin}
                onChange={handleChange}
                className="bg-transparent  w-full outline-none"
              />
            </div>
          </div>

          {/* Fecha Fin */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold  mb-1">Fecha Fin</label>
            <div className="flex items-center gap-2  rounded-xl px-4 py-2 border ">
              <Calendar size={18} className="" />
              <input
                type="date"
                name="fechaFin"
                value={filtros.fechaFin}
                min={filtros.fechaInicio}
                onChange={handleChange}
                className="bg-transparent  w-full outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold  mb-1">Agencia</label>
            <div className="flex items-center gap-2  rounded-xl px-4 py-2 border ">
              <Building2 size={18} className="" />
              <select
                name="agenciaId"
                value={filtros.agenciaId}
                onChange={handleChange}
                className="bg-transparent  w-full outline-none"
              >
                <option value="">Todas</option>
                {agencias.map((a) => (
                  <option key={a.id} value={a.id} className="text-black">
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Botones */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={buscarVentas}
            className=" text-white flex items-center gap-2 bg-green-600 hover:bg-green-500 transition-all px-6 py-2 rounded-xl  font-bold shadow-lg"
          >
            <Search size={18} />
            Buscar
          </button>

            <button
              onClick={limpiarFiltros}
              className="flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 transition-all px-6 py-2 rounded-xl text-white shadow-md"
            >
              <RotateCcw size={18} />
              Limpiar
            </button>
        </div>
      </div>

      {/* TABLA */}
      <VentasTable ventas={ventas} />
    </div>
  );
}
