// Simulación de llamadas a la API

export const getProperties = async () => {
    // Simular datos de propiedades
    return [
      {
        id: 1,
        title: 'Departamento en Belisario Quevedo',
        price: 500,
        image: 'https://via.placeholder.com/400x300',
      },
      {
        id: 2,
        title: 'Habitación amoblada cerca del campus',
        price: 300,
        image: 'https://via.placeholder.com/400x300',
      },
      // Se pueden agregar más propiedades
    ];
  };
  
  export const getPropertyById = async (id) => {
    const properties = await getProperties();
    return properties.find(p => p.id === parseInt(id));
  };
  