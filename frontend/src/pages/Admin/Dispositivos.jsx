import { useEffect, useState } from "react"
import axios from "axios"
import Swal from "sweetalert2"
import { API_URL } from "../../../config"

export default function Dispositivos() {
  const [nombre, setNombre] = useState("")
  const [activo, setActivo] = useState(true)
  const [dispositivos, setDispositivos] = useState([])
  const [loading, setLoading] = useState(false)

  const cargarDatos = async () => {
    setLoading(true)
    const res = await axios.get(`${API_URL}/dispositivos`)
    setDispositivos(res.data)
    setLoading(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const crearDispositivo = async () => {
    if (!nombre.trim()) return
    try {
      await axios.post(`${API_URL}/dispositivos`, { nombre, activo })
      Swal.fire("Éxito", "Dispositivo creado", "success")
      setNombre("")
      setActivo(true)
      cargarDatos()
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Error", "error")
    }
  }

  const eliminar = async (id) => {
    const confirm = await Swal.fire({
      title: "¿Eliminar?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí",
    })
    if (!confirm.isConfirmed) return
    await axios.delete(`${API_URL}/dispositivos/${id}`)
    Swal.fire("Eliminado", "", "success")
    cargarDatos()
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Dispositivos</h1>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          className="border p-2 rounded w-60"
          placeholder="Nombre del dispositivo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <select
          className="border p-2 rounded"
          value={activo}
          onChange={(e) => setActivo(e.target.value === "true")}
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>

        <button
          onClick={crearDispositivo}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          Crear
        </button>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <table className="w-full border">
          <thead className="bg-gray-200">
            <tr>
              <th className="border p-2">#</th>
              <th className="border p-2">Nombre</th>
              <th className="border p-2">Activo</th>
              <th className="border p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {dispositivos.map((d , i) => (
              <tr key={i++}>
                <td className="border p-2">{i + 1}</td>
                <td className="border p-2">{d.nombre}</td>
                <td className="border p-2">{d.activo ? "Sí" : "No"}</td>
                <td className="border p-2">
                  <button
                    onClick={() => eliminar(d.id)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
