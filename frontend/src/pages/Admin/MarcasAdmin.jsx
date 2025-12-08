import { useEffect, useState } from "react"
import axios from "axios"
import Swal from "sweetalert2"
import { API_URL } from "../../../config"

export default function MarcasAdmin() {
  const [marcas, setMarcas] = useState([])
  const [loading, setLoading] = useState(false)
  const [nombre, setNombre] = useState("")
  const [activo, setActivo] = useState(true)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState("")

  const cargarMarcas = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/marcas`)
      setMarcas(res.data)
    } catch (err) {
      Swal.fire("Error", "No se pudo cargar las marcas", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarMarcas()
  }, [])

  const resetForm = () => {
    setNombre("")
    setActivo(true)
    setEditId(null)
  }

  const handleCrear = async () => {
    if (!nombre.trim()) return Swal.fire("Atención", "Nombre requerido", "warning")
    try {
      if (editId) {
        await axios.put(`${API_URL}/marcas/${editId}`, { nombre, activo })
        Swal.fire("Éxito", "Marca actualizada", "success")
      } else {
        await axios.post(`${API_URL}/marcas`, { nombre, activo })
        Swal.fire("Éxito", "Marca creada", "success")
      }
      resetForm()
      cargarMarcas()
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Error", "error")
    }
  }

  const handleEditar = (m) => {
    setEditId(m.id)
    setNombre(m.nombre)
    setActivo(!!m.activo)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleEliminar = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar marca?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    })
    if (!result.isConfirmed) return
    try {
      await axios.delete(`${API_URL}/marcas/${id}`)
      Swal.fire("Eliminada", "La marca fue eliminada", "success")
      cargarMarcas()
    } catch (err) {
      Swal.fire("Error", "No se pudo eliminar", "error")
    }
  }

  const filtradas = marcas.filter(m => m.nombre.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className=" mx-auto p-6">
      <div className="rounded-2xl bg-white shadow-2xl p-6 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">Gestión de Marcas</h2>
            <p className="text-sm text-gray-500">Crea, edita y elimina marcas desde aquí</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar marca..."
              className="px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={() => { resetForm(); window.scrollTo({ top: 0, behavior: "smooth" }) }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow-md hover:scale-105 transform transition"
            >
              Nuevo
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <div className="md:col-span-1 bg-gray-50 p-4 rounded-xl border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v4a1 1 0 001 1h3m10-6v6a1 1 0 01-1 1h-3m6 4v2a1 1 0 01-1 1h-4m-6 0H5a1 1 0 01-1-1v-2" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-600">Formulario</div>
                <div className="font-medium">{editId ? "Editar marca" : "Crear marca"}</div>
              </div>
            </div>

            <div className="mt-4">
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre de la marca"
                className="w-full px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4" />
                  Activo
                </label>
                <button
                  onClick={handleCrear}
                  className="ml-auto px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow hover:opacity-95"
                >
                  {editId ? "Actualizar" : "Crear"}
                </button>
              </div>
              {editId && (
                <button onClick={resetForm} className="mt-3 w-full text-sm px-3 py-2 rounded-md border text-gray-600">
                  Cancelar edición
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full table-auto">
                <thead className="bg-white">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium">#</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Nombre</th>
                    <th className="text-left px-4 py-3 text-sm font-medium">Activo</th>
                    <th className="px-4 py-3 text-sm font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-50">
                  {loading ? (
                    <tr><td colSpan="4" className="px-4 py-6 text-center">Cargando...</td></tr>
                  ) : filtradas.length === 0 ? (
                    <tr><td colSpan="4" className="px-4 py-6 text-center text-gray-500">No hay marcas</td></tr>
                  ) : (
                    filtradas.map((m, i) => (
                      <tr key={m.id} className="hover:bg-white transition">
                        <td className="px-4 py-3 text-sm">{i + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium">{m.nombre}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${m.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {m.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => handleEditar(m)} className="px-3 py-1 rounded-md border hover:shadow-sm">Editar</button>
                            <button onClick={() => handleEliminar(m.id)} className="px-3 py-1 rounded-md bg-gradient-to-r from-green-500 to-green-600 text-white">Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <div>{filtradas.length} marcas</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
