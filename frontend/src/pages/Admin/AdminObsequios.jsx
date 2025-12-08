import React, { useState, useEffect } from 'react';
import { API_URL } from '../../../config';

const AdminObsequios = () => {
  // Estados
  const [obsequios, setObsequios] = useState([]);
  const [formData, setFormData] = useState({
    nombre: '',
    costoReferencial: '',
    activo: true
  });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch inicial de obsequios
  useEffect(() => {
    fetchObsequios();
  }, []);

  // Obtener todos los obsequios
  const fetchObsequios = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/obsequios`);
      if (!response.ok) throw new Error('Error al cargar obsequios');
      const data = await response.json();
      setObsequios(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Crear o actualizar obsequio
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      const url = editingId 
        ? `${API_URL}/obsequios/${editingId}`
        : `${API_URL}/obsequios`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          costoReferencial: parseFloat(formData.costoReferencial) || 0
        }),
      });

      if (!response.ok) throw new Error(`Error al ${editingId ? 'actualizar' : 'crear'} obsequio`);

      const data = await response.json();
      
      if (editingId) {
        // Actualizar en la lista
        setObsequios(prev => prev.map(obs => 
          obs.id === editingId ? data : obs
        ));
        setSuccessMessage('¡Obsequio actualizado exitosamente!');
      } else {
        // Agregar nuevo
        setObsequios(prev => [...prev, data]);
        setSuccessMessage('¡Obsequio creado exitosamente!');
      }

      // Limpiar formulario
      resetForm();
      fetchObsequios(); // Recargar datos
    } catch (err) {
      setError(err.message);
    }
  };

  // Cargar datos para editar
  const handleEdit = async (id) => {
    try {
      const response = await fetch(`${API_URL}/obsequios/${id}`);
      if (!response.ok) throw new Error('Error al cargar obsequio');
      const data = await response.json();
      
      setFormData({
        nombre: data.nombre,
        costoReferencial: data.costoReferencial,
        activo: data.activo
      });
      setEditingId(id);
      setSuccessMessage('');
    } catch (err) {
      setError(err.message);
    }
  };

  // Eliminar obsequio
  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este obsequio?')) return;
    
    try {
      const response = await fetch(`${API_URL}/obsequios/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Error al eliminar obsequio');

      setObsequios(prev => prev.filter(obs => obs.id !== id));
      setSuccessMessage('¡Obsequio eliminado exitosamente!');
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      nombre: '',
      costoReferencial: '',
      activo: true
    });
    setEditingId(null);
    setError('');
  };

  // Formatear moneda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Obsequios</h1>
          <p className="text-gray-600 mt-2">Administra los obsequios disponibles en el sistema</p>
        </div>

        {/* Mensajes de estado */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">{successMessage}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulario */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
              {editingId ? '✏️ Editar Obsequio' : '➕ Nuevo Obsequio'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Obsequio *
                </label>
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                  placeholder="Ej: Camiseta promocional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Costo Referencial *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="costoReferencial"
                    value={formData.costoReferencial}
                    onChange={handleInputChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="activo"
                  checked={formData.activo}
                  onChange={handleInputChange}
                  id="activo"
                  className="h-5 w-5 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="activo" className="ml-2 text-gray-700">
                  Disponible para asignación
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
                >
                  {editingId ? 'Actualizar Obsequio' : 'Crear Obsequio'}
                </button>
                
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lista de Obsequios */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">📦 Obsequios Registrados</h2>
              <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                {obsequios.length} total
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              </div>
            ) : obsequios.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🎁</div>
                <p className="text-gray-500">No hay obsequios registrados</p>
                <p className="text-gray-400 text-sm mt-1">Comienza agregando uno nuevo</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {obsequios.map((obsequio) => (
                  <div
                    key={obsequio.id}
                    className={`border rounded-lg p-4 hover:shadow-md transition ${obsequio.activo ? 'border-green-100' : 'border-gray-200'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-800">{obsequio.nombre}</h3>
                          {obsequio.activo ? (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                              Activo
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <p className="text-green-600 font-medium">
                          {formatCurrency(obsequio.costoReferencial)}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          ID: {obsequio.id}
                        </p>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(obsequio.id)}
                          className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(obsequio.id)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Estadísticas */}
            {!loading && obsequios.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Obsequios Activos</p>
                    <p className="text-2xl font-bold text-green-700">
                      {obsequios.filter(o => o.activo).length}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Costo Promedio</p>
                    <p className="text-2xl font-bold text-gray-700">
                      {formatCurrency(
                        obsequios.reduce((acc, curr) => acc + parseFloat(curr.costoReferencial), 0) / obsequios.length
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instrucciones */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-6">
          <h3 className="font-semibold text-green-800 mb-2">ℹ️ Instrucciones</h3>
          <ul className="text-green-700 text-sm space-y-1">
            <li>• Los campos marcados con * son obligatorios</li>
            <li>• El costo referencial debe ser un valor numérico positivo</li>
            <li>• Los obsequios inactivos no estarán disponibles para asignación</li>
            <li>• Haz clic en ✏️ para editar un obsequio existente</li>
            <li>• Haz clic en 🗑️ para eliminar un obsequio (acción irreversible)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminObsequios;